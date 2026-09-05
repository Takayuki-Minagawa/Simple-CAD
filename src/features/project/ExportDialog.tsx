import { useState } from 'react';
import { DEFAULT_DXF_VERSION, DXF_VERSIONS, type DxfVersion } from '@/domain/dxf/format';
import { useProjectStore, useEditorStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { downloadBlob, isAbortError, saveFile } from '@/libs/fileSystem';
import { showAlert, showConfirm } from '@/app/browserDialogs';
import { Modal } from '@/components/common/Modal';

interface Props {
  onClose: () => void;
}

export function ExportDialog({ onClose }: Props) {
  const data = useProjectStore((s) => s.data);
  const activeStory = useEditorStore((s) => s.activeStory);
  const { t, locale } = useI18n();
  const [format, setFormat] = useState<'svg' | 'pdf' | 'dxf' | 'ifc' | 'structural-json'>('svg');
  const [dxfVersion, setDxfVersion] = useState<DxfVersion>(DEFAULT_DXF_VERSION);
  const [dxfStoryId, setDxfStoryId] = useState(activeStory ?? data?.stories[0]?.id ?? '');
  const [sheetId, setSheetId] = useState(data?.sheets[0]?.id ?? '');
  const [exportAllSheets, setExportAllSheets] = useState(false);
  const [exporting, setExporting] = useState(false);
  const allSheetsLabel =
    locale === 'ja' ? 'すべてのシートを1つのPDFに出力' : 'Export all sheets into one PDF';
  const ifcLabel = locale === 'ja' ? 'IFC (基本連携)' : 'IFC (Basic)';
  const structuralJsonLabel = locale === 'ja' ? '構造計算 JSON' : 'Structural JSON';

  if (!data) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const { validateProject } = await import('@/domain/validation');
      const validation = validateProject(data);
      const errors = validation.errors.filter((issue) => issue.level === 'error');
      if (errors.length > 0) {
        showAlert(
          `${locale === 'ja' ? '出力を中止しました。先にエラーを修正してください。' : 'Export stopped. Fix validation errors first.'}\n\n${errors
            .slice(0, 12)
            .map((issue) => issue.message)
            .join('\n')}`,
        );
        return;
      }
      const warnings = validation.errors.filter((issue) => issue.level === 'warning');
      if (
        warnings.length > 0 &&
        !showConfirm(
          `${locale === 'ja' ? `警告が ${warnings.length} 件あります。出力を続けますか？` : `${warnings.length} warning(s) found. Continue export?`}\n\n${warnings
            .slice(0, 8)
            .map((issue) => issue.message)
            .join('\n')}`,
        )
      ) {
        return;
      }

      if (
        (format === 'svg' || format === 'pdf') &&
        (!sheetId || !data.sheets.some((sheet) => sheet.id === sheetId)) &&
        !(format === 'pdf' && exportAllSheets && data.sheets.length > 0)
      ) {
        showAlert(
          locale === 'ja' ? '出力するシートを選択してください。' : 'Select a sheet to export.',
        );
        return;
      }
      if (format === 'dxf' && !data.stories.some((story) => story.id === dxfStoryId)) {
        showAlert(locale === 'ja' ? '出力する階がありません。' : 'There is no story to export.');
        return;
      }

      const name = data.project.name;
      switch (format) {
        case 'svg': {
          const { exportSvg } = await import('@/domain/export/svgExport');
          const svg = exportSvg(data, sheetId);
          await saveFile(svg, `${name}.svg`, 'image/svg+xml');
          break;
        }
        case 'pdf': {
          const { exportPdf } = await import('@/domain/export/pdfExport');
          const targetSheets = exportAllSheets ? data.sheets.map((sheet) => sheet.id) : sheetId;
          const blob = await exportPdf(data, targetSheets);
          downloadBlob(blob, `${name}${exportAllSheets ? '-sheets' : ''}.pdf`, 'application/pdf');
          break;
        }
        case 'dxf': {
          const { exportDxfWithWarnings } = await import('@/domain/export/dxfExport');
          const result = exportDxfWithWarnings(data, dxfStoryId, { version: dxfVersion });
          if (
            result.warnings.length > 0 &&
            !showConfirm(
              `${locale === 'ja' ? 'DXF出力時に次の置換・省略があります。続けますか？' : 'DXF export has substitutions or omissions. Continue?'}\n\n${result.warnings
                .slice(0, 12)
                .join('\n')}`,
            )
          ) {
            return;
          }
          await saveFile(result.content, `${name}.dxf`, 'application/dxf');
          break;
        }
        case 'ifc': {
          const { exportIfcWithWarnings } = await import('@/domain/integration/ifc');
          const result = exportIfcWithWarnings(data);
          if (
            result.warnings.length > 0 &&
            !showConfirm(
              `${locale === 'ja' ? 'IFC出力時に次の置換・省略があります。続けますか？' : 'IFC export has substitutions or omissions. Continue?'}\n\n${result.warnings
                .slice(0, 12)
                .join('\n')}`,
            )
          ) {
            return;
          }
          await saveFile(result.content, `${name}.ifc`, 'application/octet-stream');
          break;
        }
        case 'structural-json': {
          const { exportStructuralAnalysisJson } =
            await import('@/domain/integration/structuralAnalysisJson');
          const json = exportStructuralAnalysisJson(data);
          await saveFile(json, `${name}.structural.json`, 'application/json');
          break;
        }
      }
      onClose();
    } catch (e) {
      if (isAbortError(e)) return;
      showAlert(`Export error: ${String(e)}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      title={t.exportTitle}
      onClose={onClose}
      width={360}
      footer={
        <>
          <button
            className="toolbar-btn"
            style={{ background: 'var(--border-color)', color: 'var(--text-primary)' }}
            onClick={onClose}
          >
            {t.exportCancel}
          </button>
          <button
            className="toolbar-btn"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onClick={handleExport}
            disabled={
              exporting ||
              (format === 'dxf' && !data.stories.some((story) => story.id === dxfStoryId)) ||
              ((format === 'svg' || format === 'pdf') && data.sheets.length === 0)
            }
          >
            {exporting ? t.exportExporting : t.exportExecute}
          </button>
        </>
      }
    >
      <div style={{ marginBottom: 12 }}>
        <label
          htmlFor="export-format"
          style={{
            display: 'block',
            marginBottom: 4,
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
        >
          {t.exportFormat}
        </label>
        <select
          id="export-format"
          className="prop-select"
          style={{ maxWidth: '100%', width: '100%' }}
          value={format}
          onChange={(e) =>
            setFormat(e.target.value as 'svg' | 'pdf' | 'dxf' | 'ifc' | 'structural-json')
          }
        >
          <option value="svg">SVG</option>
          <option value="pdf">PDF</option>
          <option value="dxf">DXF</option>
          <option value="ifc">{ifcLabel}</option>
          <option value="structural-json">{structuralJsonLabel}</option>
        </select>
      </div>
      {format === 'dxf' && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <label htmlFor="dxf-version">{locale === 'ja' ? 'DXFバージョン' : 'DXF version'}</label>
          <select
            id="dxf-version"
            className="prop-select"
            style={{ width: '100%', maxWidth: '100%' }}
            value={dxfVersion}
            onChange={(e) => setDxfVersion(e.target.value as DxfVersion)}
          >
            {Object.entries(DXF_VERSIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label htmlFor="dxf-story">{locale === 'ja' ? '出力する階' : 'Story to export'}</label>
          <select
            id="dxf-story"
            className="prop-select"
            style={{ width: '100%', maxWidth: '100%' }}
            value={dxfStoryId}
            onChange={(e) => setDxfStoryId(e.target.value)}
          >
            {data.stories.map((story) => (
              <option key={story.id} value={story.id}>
                {story.name}
              </option>
            ))}
          </select>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
            {locale === 'ja'
              ? '単位はmm。2015〜2017ではDXF 2013形式を使用します。読み込んだ対応図形も、選択した形式で再出力できます。'
              : 'Units: mm. AutoCAD 2015–2017 uses DXF 2013. Imported supported geometry can be re-exported in the selected version.'}
          </p>
        </div>
      )}
      {(format === 'svg' || format === 'pdf') && (
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
            disabled={format === 'pdf' && exportAllSheets}
          >
            {data.sheets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.paperSize}, {s.scale})
              </option>
            ))}
          </select>
        </div>
      )}
      {format === 'pdf' && data.sheets.length > 1 && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}
        >
          <input
            type="checkbox"
            checked={exportAllSheets}
            onChange={(e) => setExportAllSheets(e.target.checked)}
          />
          <span>{allSheetsLabel}</span>
        </label>
      )}
    </Modal>
  );
}
