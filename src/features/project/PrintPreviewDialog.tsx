import { useEffect, useState } from 'react';
import { useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { getPaperDimensions } from '@/domain/drawing/paper';
import { Modal } from '@/components/common/Modal';
import { SafeSvgPreview } from '@/components/common/SafeSvgPreview';

interface Props {
  onClose: () => void;
}

export function PrintPreviewDialog({ onClose }: Props) {
  const data = useProjectStore((s) => s.data);
  const { t, locale } = useI18n();
  const [sheetId, setSheetId] = useState(data?.sheets[0]?.id ?? '');
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setSvgContent(null);
    setPreviewError('');
    if (!data || !sheetId) return;
    void import('@/domain/export/svgExport')
      .then(({ exportSvg }) => {
        if (!cancelled) setSvgContent(exportSvg(data, sheetId));
      })
      .catch((error) => {
        if (!cancelled) {
          setSvgContent(null);
          setPreviewError(String(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [data, sheetId]);

  if (!data) return null;

  const sheet = data.sheets.find((s) => s.id === sheetId);
  const viewports = sheet?.viewports ?? [];
  const paper = getPaperDimensions(sheet?.paperSize ?? 'A3');
  const aspectRatio = paper.width / paper.height;

  // Compute preview dimensions to fit within a max area
  const maxWidth = 720;
  const maxHeight = 540;
  let previewWidth = maxWidth;
  let previewHeight = previewWidth / aspectRatio;
  if (previewHeight > maxHeight) {
    previewHeight = maxHeight;
    previewWidth = previewHeight * aspectRatio;
  }

  return (
    <Modal
      title={t.printPreviewTitle}
      onClose={onClose}
      width={800}
      footer={
        <button
          className="toolbar-btn"
          style={{ background: 'var(--border-color)', color: 'var(--text-primary)' }}
          onClick={onClose}
        >
          {t.printPreviewClose}
        </button>
      }
    >
      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            display: 'block',
            marginBottom: 4,
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
        >
          {t.exportSheet}
        </label>
        <select
          className="prop-select"
          style={{ maxWidth: '100%', width: '100%' }}
          value={sheetId}
          onChange={(e) => setSheetId(e.target.value)}
        >
          {data.sheets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.paperSize}, {s.scale})
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          width: previewWidth,
          height: previewHeight,
          border: '1px solid var(--border-color)',
          background: '#ffffff',
          overflow: 'hidden',
          margin: '0 auto',
        }}
      >
        {previewError ? (
          <div
            role="alert"
            style={{ padding: 16, color: 'var(--error)', overflowWrap: 'anywhere' }}
          >
            {locale === 'ja'
              ? 'プレビューを生成できませんでした: '
              : 'Could not generate preview: '}
            {previewError}
          </div>
        ) : svgContent ? (
          <SafeSvgPreview
            markup={svgContent}
            label={`${sheet?.name ?? t.printPreviewTitle} preview`}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#999',
            }}
          >
            <span role="status">
              {sheetId
                ? locale === 'ja'
                  ? 'プレビューを読み込み中…'
                  : 'Loading preview…'
                : t.printPreviewEmpty}
            </span>
          </div>
        )}
      </div>

      {sheet && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--text-secondary)',
            textAlign: 'center',
          }}
        >
          {sheet.paperSize} &mdash; {sheet.scale}
          {sheet.titleBlock?.drawingTitle ? ` &mdash; ${sheet.titleBlock.drawingTitle}` : ''}
          {viewports.length > 0 && ` | ${viewports.length} viewport(s)`}
        </div>
      )}
    </Modal>
  );
}
