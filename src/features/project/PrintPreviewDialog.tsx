import { useState, useMemo } from 'react';
import { useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { exportSvg } from '@/domain/export/svgExport';

const PAPER_SIZES: Record<string, { width: number; height: number }> = {
  A0: { width: 1189, height: 841 },
  A1: { width: 841, height: 594 },
  A2: { width: 594, height: 420 },
  A3: { width: 420, height: 297 },
  A4: { width: 297, height: 210 },
};

interface Props {
  onClose: () => void;
}

export function PrintPreviewDialog({ onClose }: Props) {
  const data = useProjectStore((s) => s.data);
  const { t } = useI18n();
  const [sheetId, setSheetId] = useState(data?.sheets[0]?.id ?? '');

  const svgContent = useMemo(() => {
    if (!data || !sheetId) return null;
    try {
      return exportSvg(data, sheetId);
    } catch {
      return null;
    }
  }, [data, sheetId]);

  if (!data) return null;

  const sheet = data.sheets.find((s) => s.id === sheetId);
  const paper = sheet ? PAPER_SIZES[sheet.paperSize] ?? PAPER_SIZES.A3 : PAPER_SIZES.A3;
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-modal-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-modal)',
          borderRadius: 8,
          padding: 24,
          maxWidth: 'min(800px, calc(100vw - 32px))',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{t.printPreviewTitle}</h3>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{t.exportSheet}</label>
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
          {svgContent ? (
            <div
              style={{ width: '100%', height: '100%' }}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
              {t.printPreviewEmpty}
            </div>
          )}
        </div>

        {sheet && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>
            {sheet.paperSize} &mdash; {sheet.scale}
            {sheet.titleBlock?.drawingTitle ? ` &mdash; ${sheet.titleBlock.drawingTitle}` : ''}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="toolbar-btn" style={{ background: 'var(--border-color)', color: 'var(--text-primary)' }} onClick={onClose}>
            {t.printPreviewClose}
          </button>
        </div>
      </div>
    </div>
  );
}
