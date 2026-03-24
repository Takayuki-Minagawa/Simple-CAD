import { useState } from 'react';
import { useProjectStore, useEditorStore } from '@/app/store';
import { exportSvg } from '@/domain/export/svgExport';
import { exportPdf } from '@/domain/export/pdfExport';
import { exportDxf } from '@/domain/export/dxfExport';
import { downloadBlob, saveFile } from '@/libs/fileSystem';

interface Props {
  onClose: () => void;
}

export function ExportDialog({ onClose }: Props) {
  const data = useProjectStore((s) => s.data);
  const activeStory = useEditorStore((s) => s.activeStory);
  const [format, setFormat] = useState<'svg' | 'pdf' | 'dxf'>('svg');
  const [sheetId, setSheetId] = useState(data?.sheets[0]?.id ?? '');
  const [exporting, setExporting] = useState(false);

  if (!data) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const name = data.project.name;
      switch (format) {
        case 'svg': {
          const svg = exportSvg(data, sheetId);
          await saveFile(svg, `${name}.svg`, 'image/svg+xml');
          break;
        }
        case 'pdf': {
          const blob = await exportPdf(data, sheetId);
          downloadBlob(blob, `${name}.pdf`, 'application/pdf');
          break;
        }
        case 'dxf': {
          const storyId = activeStory ?? data.stories[0]?.id ?? '';
          const dxf = exportDxf(data, storyId);
          await saveFile(dxf, `${name}.dxf`, 'application/dxf');
          break;
        }
      }
      onClose();
    } catch (e) {
      alert(`Export error: ${String(e)}`);
    } finally {
      setExporting(false);
    }
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
          minWidth: 320,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Export</h3>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#666' }}>
            Format
          </label>
          <select
            className="prop-select"
            style={{ maxWidth: '100%', width: '100%' }}
            value={format}
            onChange={(e) => setFormat(e.target.value as 'svg' | 'pdf' | 'dxf')}
          >
            <option value="svg">SVG</option>
            <option value="pdf">PDF</option>
            <option value="dxf">DXF</option>
          </select>
        </div>

        {(format === 'svg' || format === 'pdf') && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#666' }}>
              Sheet
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
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="toolbar-btn" style={{ background: '#ccc', color: '#333' }} onClick={onClose}>
            Cancel
          </button>
          <button
            className="toolbar-btn"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
