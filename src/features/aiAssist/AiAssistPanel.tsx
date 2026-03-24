import { useState } from 'react';
import { useProjectStore } from '@/app/store';
import { importProjectJson } from '@/domain/import/jsonImport';
import { exportProjectJson } from '@/domain/export/jsonExport';

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
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState('');

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(PROMPT_TEMPLATE);
    alert('プロンプトをクリップボードにコピーしました');
  };

  const handleCopyCurrentJson = () => {
    if (data) {
      navigator.clipboard.writeText(exportProjectJson(data));
      alert('現在のプロジェクト JSON をコピーしました');
    }
  };

  const handleImportJson = () => {
    setError('');
    const result = importProjectJson(jsonInput);
    if (!result.ok) {
      setError(result.errors.map((e) => e.message).join('\n'));
      return;
    }
    loadProject(result.data);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 24,
          width: 520,
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>AI Assist</h3>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>
            AI 用プロンプトテンプレート
          </label>
          <pre
            style={{
              background: '#f5f5f5',
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
            <button className="toolbar-btn" style={{ background: '#555', color: '#fff' }} onClick={handleCopyPrompt}>
              Copy Prompt
            </button>
            <button
              className="toolbar-btn"
              style={{ background: '#555', color: '#fff' }}
              onClick={handleCopyCurrentJson}
              disabled={!data}
            >
              Copy Current JSON
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>
            JSON 貼り付け読み込み
          </label>
          <textarea
            style={{
              width: '100%',
              height: 150,
              marginTop: 4,
              padding: 8,
              fontFamily: 'monospace',
              fontSize: 11,
              border: '1px solid #ccc',
              borderRadius: 4,
              resize: 'vertical',
            }}
            placeholder="AI が生成した JSON をここに貼り付けてください..."
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
          />
          {error && (
            <pre style={{ color: 'var(--error)', fontSize: 11, marginTop: 4, whiteSpace: 'pre-wrap' }}>
              {error}
            </pre>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="toolbar-btn" style={{ background: '#ccc', color: '#333' }} onClick={onClose}>
            Close
          </button>
          <button
            className="toolbar-btn"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onClick={handleImportJson}
            disabled={!jsonInput.trim()}
          >
            Import JSON
          </button>
        </div>
      </div>
    </div>
  );
}
