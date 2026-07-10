import { useState } from 'react';
import { useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { importProjectJson } from '@/domain/import/jsonImport';
import { exportProjectJson } from '@/domain/export/jsonExport';
import { Modal } from '@/components/common/Modal';
import { showConfirm } from '@/app/browserDialogs';
import { saveWorkspace } from '@/libs/persistence';

const PROMPT_TEMPLATE = `あなたは構造設計向け Web CAD の JSON データ生成 AI です。
必ず有効な JSON のみを返してください。説明文、コードフェンス、コメントは不要です。

出力ルール:
- ルートに schemaVersion, project, stories, grids, materials, sections, members, openings, annotations, dimensions, sheets, views を含める
- 単位は mm
- すべての要素に一意の id を付与
- 座標は数値で出力
- 不明点は issues 配列に warning を出力

部材タイプ: column, beam, wall, slab
断面タイプ: rc_column_rect, rc_beam_rect, rc_slab, rc_wall`;

interface Props {
  onClose: () => void;
}

export function AiAssistPanel({ onClose }: Props) {
  const { data, loadProject } = useProjectStore();
  const { t, locale } = useI18n();
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const copyText = async (value: string) => {
    setError('');
    setNotice('');
    try {
      await navigator.clipboard.writeText(value);
      setNotice(locale === 'ja' ? 'クリップボードにコピーしました。' : 'Copied to clipboard.');
    } catch (copyError) {
      setError(
        `${locale === 'ja' ? 'クリップボードへコピーできませんでした' : 'Could not copy to clipboard'}: ${String(copyError)}`,
      );
    }
  };

  const handleImport = async () => {
    setError('');
    const result = importProjectJson(jsonInput);
    if (!result.ok) {
      setError(result.errors.map((e) => e.message).join('\n'));
      return;
    }
    const summary =
      locale === 'ja'
        ? `${result.data.project.name}\n階: ${result.data.stories.length} / 部材: ${result.data.members.length}\n\nこの内容を読み込みますか？`
        : `${result.data.project.name}\nStories: ${result.data.stories.length} / Members: ${result.data.members.length}\n\nImport this project?`;
    if (!showConfirm(summary)) return;
    if (useProjectStore.getState().isDirty && !showConfirm(t.confirmUnsaved)) return;
    loadProject(result.data);
    await saveWorkspace(result.data, false).catch(() => undefined);
    onClose();
  };

  const [showGuide, setShowGuide] = useState(false);

  return (
    <Modal
      title={t.aiTitle}
      onClose={onClose}
      width={600}
      maxHeight="84vh"
      footer={
        <>
          <button
            className="toolbar-btn"
            style={{ background: 'var(--border-color)', color: 'var(--text-primary)' }}
            onClick={onClose}
          >
            {t.aiClose}
          </button>
          <button
            className="toolbar-btn"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onClick={handleImport}
            disabled={!jsonInput.trim()}
          >
            {t.aiImport}
          </button>
        </>
      }
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <button
          className="toolbar-btn"
          style={{
            background: 'none',
            color: 'var(--accent)',
            fontSize: 12,
            textDecoration: 'underline',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
          }}
          onClick={() => setShowGuide(!showGuide)}
          aria-expanded={showGuide}
        >
          {showGuide ? t.aiGuideHide : t.aiGuideShow}
        </button>
      </div>

      {showGuide && (
        <div
          style={{
            background: 'var(--code-bg)',
            borderRadius: 6,
            padding: 14,
            marginBottom: 16,
            fontSize: 12,
            lineHeight: 1.7,
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
            {t.aiGuideTitle}
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{t.aiGuideSteps}</div>
          <div
            style={{
              fontWeight: 600,
              marginTop: 10,
              marginBottom: 4,
              color: 'var(--text-primary)',
            }}
          >
            {t.aiGuideTipsTitle}
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{t.aiGuideTips}</div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {t.aiPromptLabel}
        </label>
        <pre
          style={{
            background: 'var(--code-bg)',
            color: 'var(--text-primary)',
            padding: 8,
            borderRadius: 4,
            fontSize: 11,
            maxHeight: 120,
            overflow: 'auto',
            marginTop: 4,
          }}
        >
          {PROMPT_TEMPLATE}
        </pre>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            className="toolbar-btn"
            style={{ background: 'var(--border-color)', color: 'var(--text-primary)' }}
            onClick={() => void copyText(PROMPT_TEMPLATE)}
          >
            {t.aiCopyPrompt}
          </button>
          <button
            className="toolbar-btn"
            style={{ background: 'var(--border-color)', color: 'var(--text-primary)' }}
            onClick={() => data && void copyText(exportProjectJson(data))}
            disabled={!data}
          >
            {t.aiCopyJson}
          </button>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {t.aiPasteLabel}
        </label>
        <textarea
          style={{
            width: '100%',
            height: 150,
            marginTop: 4,
            padding: 8,
            fontFamily: 'monospace',
            fontSize: 11,
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            resize: 'vertical',
            background: 'var(--input-bg)',
            color: 'var(--text-primary)',
          }}
          placeholder={t.aiPastePlaceholder}
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
        />
        {error && (
          <pre
            role="alert"
            style={{ color: 'var(--error)', fontSize: 11, marginTop: 4, whiteSpace: 'pre-wrap' }}
          >
            {error}
          </pre>
        )}
        {notice && (
          <div role="status" style={{ color: 'var(--accent)', fontSize: 11, marginTop: 4 }}>
            {notice}
          </div>
        )}
      </div>
    </Modal>
  );
}
