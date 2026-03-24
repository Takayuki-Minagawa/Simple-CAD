import { useState } from 'react';
import { useProjectStore, useEditorStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { exportSvg } from '@/domain/export/svgExport';
import { exportPdf } from '@/domain/export/pdfExport';
import { exportDxf } from '@/domain/export/dxfExport';
import { downloadBlob, saveFile } from '@/libs/fileSystem';

interface Props { onClose: () => void; }

export function ExportDialog({ onClose }: Props) {
  const data = useProjectStore((s) => s.data);
  const activeStory = useEditorStore((s) => s.activeStory);
  const { t, locale } = useI18n();
  const [format, setFormat] = useState<'svg' | 'pdf' | 'dxf'>('svg');
  const [sheetId, setSheetId] = useState(data?.sheets[0]?.id ?? '');
  const [exportAllSheets, setExportAllSheets] = useState(false);
  const [exporting, setExporting] = useState(false);
  const allSheetsLabel = locale === 'ja' ? 'すべてのシートを1つのPDFに出力' : 'Export all sheets into one PDF';

  if (!data) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const name = data.project.name;
      switch (format) {
        case 'svg': { const svg = exportSvg(data, sheetId); await saveFile(svg, `${name}.svg`, 'image/svg+xml'); break; }
        case 'pdf': {
          const targetSheets = exportAllSheets ? data.sheets.map((sheet) => sheet.id) : sheetId;
          const blob = await exportPdf(data, targetSheets);
          downloadBlob(blob, `${name}${exportAllSheets ? '-sheets' : ''}.pdf`, 'application/pdf');
          break;
        }
        case 'dxf': { const sid = activeStory ?? data.stories[0]?.id ?? ''; const dxf = exportDxf(data, sid); await saveFile(dxf, `${name}.dxf`, 'application/dxf'); break; }
      }
      onClose();
    } catch (e) { alert(`Export error: ${String(e)}`); } finally { setExporting(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-modal)', borderRadius: 8, padding: 24, minWidth: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', color: 'var(--text-primary)' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>{t.exportTitle}</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{t.exportFormat}</label>
          <select className="prop-select" style={{ maxWidth: '100%', width: '100%' }} value={format} onChange={(e) => setFormat(e.target.value as 'svg' | 'pdf' | 'dxf')}>
            <option value="svg">SVG</option><option value="pdf">PDF</option><option value="dxf">DXF</option>
          </select>
        </div>
        {(format === 'svg' || format === 'pdf') && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{t.exportSheet}</label>
            <select
              className="prop-select"
              style={{ maxWidth: '100%', width: '100%' }}
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
              disabled={format === 'pdf' && exportAllSheets}
            >
              {data.sheets.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.paperSize}, {s.scale})</option>)}
            </select>
          </div>
        )}
        {format === 'pdf' && data.sheets.length > 1 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>
            <input type="checkbox" checked={exportAllSheets} onChange={(e) => setExportAllSheets(e.target.checked)} />
            <span>{allSheetsLabel}</span>
          </label>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="toolbar-btn" style={{ background: 'var(--border-color)', color: 'var(--text-primary)' }} onClick={onClose}>{t.exportCancel}</button>
          <button className="toolbar-btn" style={{ background: 'var(--accent)', color: '#fff' }} onClick={handleExport} disabled={exporting}>
            {exporting ? t.exportExporting : t.exportExecute}
          </button>
        </div>
      </div>
    </div>
  );
}
