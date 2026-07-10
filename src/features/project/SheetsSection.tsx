import type { Sheet, TitleBlockTemplate, View, Viewport } from '@/domain/structural/types';
import type { Labels } from './masterDataHelpers';
import { PAPER_SIZES, TEMPLATE_OPTIONS } from './masterDataHelpers';
import { DeleteButton, NumberField, ReadonlyField, SectionHeader, SelectField, TextField } from './masterDataFields';

interface SheetsSectionProps {
  sheets: Sheet[];
  views: View[];
  projectName: string;
  labels: Labels;
  updateSheet: (id: string, updates: Partial<Sheet>) => void;
  updateSheetTitleBlock: (sheet: Sheet, updates: NonNullable<Sheet['titleBlock']>) => void;
  addViewport: (viewport: Viewport) => void;
  removeViewport: (id: string) => void;
  updateViewport: (id: string, updates: Partial<Viewport>) => void;
  onDeleteSheet: (id: string) => void;
  onMoveSheet: (id: string, direction: -1 | 1) => void;
}

export function SheetsSection({
  sheets,
  views,
  projectName,
  labels,
  updateSheet,
  updateSheetTitleBlock,
  addViewport,
  removeViewport,
  updateViewport,
  onDeleteSheet,
  onMoveSheet,
}: SheetsSectionProps) {
  return (
    <section>
      <SectionHeader title={labels.sheets} />
      <div style={{ display: 'grid', gap: 10 }}>
        {sheets.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{labels.noSheets}</div>
        )}
        {sheets.map((sheet, sheetIndex) => (
          <div
            key={sheet.id}
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: 12,
              display: 'grid',
              gap: 8,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 90px 90px auto', gap: 8 }}>
              <ReadonlyField label={labels.id} value={sheet.id} />
              <TextField label={labels.name} value={sheet.name} onChange={(value) => updateSheet(sheet.id, { name: value })} />
              <SelectField
                label={labels.paperSize}
                value={sheet.paperSize}
                options={PAPER_SIZES}
                onChange={(value) => updateSheet(sheet.id, { paperSize: value as Sheet['paperSize'] })}
              />
              <TextField label={labels.scale} value={sheet.scale} onChange={(value) => updateSheet(sheet.id, { scale: value })} />
              <div style={{ display: 'flex', gap: 4, alignItems: 'end' }}>
                <button
                  className="toolbar-btn"
                  onClick={() => onMoveSheet(sheet.id, -1)}
                  disabled={sheetIndex === 0}
                  aria-label={`${sheet.name}: ${labels.moveUp}`}
                  title={labels.moveUp}
                >
                  ↑
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => onMoveSheet(sheet.id, 1)}
                  disabled={sheetIndex === sheets.length - 1}
                  aria-label={`${sheet.name}: ${labels.moveDown}`}
                  title={labels.moveDown}
                >
                  ↓
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => onDeleteSheet(sheet.id)}
                  aria-label={`${sheet.name}: ${labels.deleteSheet}`}
                  title={labels.deleteSheet}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: 8 }}>
              <SelectField
                label={labels.template}
                value={sheet.titleBlockTemplate ?? 'standard'}
                options={TEMPLATE_OPTIONS}
                onChange={(value) => updateSheet(sheet.id, { titleBlockTemplate: value as TitleBlockTemplate })}
              />
              <TextField
                label={labels.projectName}
                value={sheet.titleBlock?.projectName ?? projectName}
                onChange={(value) => updateSheetTitleBlock(sheet, { projectName: value })}
              />
              <TextField
                label={labels.drawingTitle}
                value={sheet.titleBlock?.drawingTitle ?? sheet.name}
                onChange={(value) => updateSheetTitleBlock(sheet, { drawingTitle: value })}
              />
              <TextField
                label={labels.issueDate}
                value={sheet.titleBlock?.issueDate ?? ''}
                onChange={(value) => updateSheetTitleBlock(sheet, { issueDate: value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
              <TextField
                label={labels.drawnBy}
                value={sheet.titleBlock?.drawnBy ?? ''}
                onChange={(value) => updateSheetTitleBlock(sheet, { drawnBy: value })}
              />
              <TextField
                label={labels.checkedBy}
                value={sheet.titleBlock?.checkedBy ?? ''}
                onChange={(value) => updateSheetTitleBlock(sheet, { checkedBy: value })}
              />
              <TextField
                label={labels.revision}
                value={sheet.titleBlock?.revision ?? ''}
                onChange={(value) => updateSheetTitleBlock(sheet, { revision: value })}
              />
              <TextField
                label={labels.note}
                value={sheet.titleBlock?.note ?? ''}
                onChange={(value) => updateSheetTitleBlock(sheet, { note: value })}
              />
            </div>

            {/* Viewports */}
            <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 8, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{labels.viewports}</span>
                <button
                  className="toolbar-btn"
                  style={{ fontSize: 11 }}
                  onClick={() => {
                    const firstViewId = views[0]?.id ?? '';
                    if (!firstViewId) return;
                    const vp: Viewport = {
                      id: `VP-${sheet.id}-${(sheet.viewports?.length ?? 0) + 1}`,
                      sheetId: sheet.id,
                      viewId: firstViewId,
                      x: 30,
                      y: 30,
                      width: 200,
                      height: 150,
                      scale: sheet.scale,
                    };
                    addViewport(vp);
                  }}
                >
                  {labels.addViewport}
                </button>
              </div>
              {(sheet.viewports ?? []).map((vp) => (
                <div key={vp.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 60px 60px 70px 70px auto', gap: 6, alignItems: 'end', marginBottom: 4 }}>
                  <ReadonlyField label={labels.id} value={vp.id} />
                  <SelectField
                    label={labels.viewId}
                    value={vp.viewId}
                    options={views.map((v) => v.id)}
                    onChange={(value) => updateViewport(vp.id, { viewId: value })}
                  />
                  <NumberField label={labels.x} value={vp.x} onChange={(value) => updateViewport(vp.id, { x: value })} />
                  <NumberField label={labels.y} value={vp.y} onChange={(value) => updateViewport(vp.id, { y: value })} />
                  <NumberField label={labels.width} value={vp.width} onChange={(value) => updateViewport(vp.id, { width: value })} />
                  <NumberField label={labels.height} value={vp.height} onChange={(value) => updateViewport(vp.id, { height: value })} />
                  <DeleteButton label={labels.removeViewport} onClick={() => removeViewport(vp.id)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
