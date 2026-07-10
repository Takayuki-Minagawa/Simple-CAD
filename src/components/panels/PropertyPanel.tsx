import { useProjectStore, useEditorStore } from '@/app/store';
import { useI18n } from '@/i18n';
import type {
  Member,
  Annotation,
  Dimension,
  LineType,
  Opening,
  Section,
  TextAlign,
} from '@/domain/structural/types';
import { useMemo } from 'react';
import { polygonArea, polygonPerimeter, linearLength } from '@/domain/geometry/measurement';
import { CoordRow, VertexCoordInput } from './PropertyInputs';
import { isEntityLayerInteractive } from '@/domain/rendering/layerLock';
import { radiansToDisplayDegrees } from '@/domain/geometry/precision';

const LINE_TYPE_OPTIONS: LineType[] = ['solid', 'dashed', 'dotted', 'chain', 'dashdot'];
const TEXT_ALIGN_OPTIONS: TextAlign[] = ['left', 'center', 'right'];

export function PropertyPanel() {
  const data = useProjectStore((s) => s.data);
  const rawSelectedIds = useEditorStore((state) => state.selectedIds);
  const layerLocked = useEditorStore((state) => state.layerLocked);
  const layerVisibility = useEditorStore((state) => state.layerVisibility);
  const selectedIds = data
    ? rawSelectedIds.filter((id) =>
        isEntityLayerInteractive(data, id, layerLocked, layerVisibility),
      )
    : [];
  const { t } = useI18n();

  if (!data || selectedIds.length === 0) {
    return (
      <div>
        <div className="panel-header">{t.panelProperties}</div>
        <div className="panel-content" style={{ color: 'var(--text-secondary)' }}>
          {t.noSelection}
        </div>
      </div>
    );
  }

  // Multi-selection: show group info if all belong to same group
  if (selectedIds.length > 1) {
    const group = data.groups?.find((g) => selectedIds.every((id) => g.memberIds.includes(id)));
    const selectedMembers = data.members.filter((member) => selectedIds.includes(member.id));
    if (selectedMembers.length === selectedIds.length) {
      return <BulkMemberProps members={selectedMembers} groupName={group?.name} />;
    }
    return (
      <div>
        <div className="panel-header">{t.panelProperties}</div>
        <div className="panel-content">
          <div>
            {selectedIds.length} {t.objectsSelected}
          </div>
          {group && (
            <div className="prop-row" style={{ marginTop: 8 }}>
              <span className="prop-label">{t.groupName}</span>
              <span>{group.name}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const id = selectedIds[0];
  const member = data.members.find((m) => m.id === id);
  if (member) return <MemberProps member={member} />;

  const annotation = data.annotations.find((a) => a.id === id);
  if (annotation) return <AnnotationProps annotation={annotation} />;

  const dimension = data.dimensions.find((d) => d.id === id);
  if (dimension) return <DimensionProps dimension={dimension} />;

  const opening = data.openings.find((item) => item.id === id);
  if (opening) return <OpeningProps opening={opening} />;

  return (
    <div>
      <div className="panel-header">{t.panelProperties}</div>
      <div className="panel-content">Unknown</div>
    </div>
  );
}

function sectionSupportsMember(section: Section, memberType: Member['type']): boolean {
  switch (memberType) {
    case 'column':
      return ['rc_column_rect', 's_column_h', 's_pipe'].includes(section.kind);
    case 'beam':
      return ['rc_beam_rect', 's_beam_h', 's_pipe'].includes(section.kind);
    case 'wall':
      return section.kind === 'rc_wall';
    case 'slab':
      return section.kind === 'rc_slab';
  }
}

function commonValue<T>(values: T[]): T | undefined {
  return values.length > 0 && values.every((value) => value === values[0])
    ? values[0]
    : undefined;
}

function BulkMemberProps({ members, groupName }: { members: Member[]; groupName?: string }) {
  const data = useProjectStore((state) => state.data)!;
  const updateMembers = useProjectStore((state) => state.updateMembers);
  const { t } = useI18n();
  const ids = members.map((member) => member.id);
  const compatibleSections = data.sections.filter((section) =>
    members.every((member) => sectionSupportsMember(section, member.type)),
  );
  const story = commonValue(members.map((member) => member.story));
  const section = commonValue(members.map((member) => member.sectionId));
  const material = commonValue(members.map((member) => member.materialId));
  const rotation = commonValue(members.map((member) => member.rotation ?? 0));
  const color = commonValue(members.map((member) => member.color ?? '#000000'));

  return (
    <div>
      <div className="panel-header">{t.panelProperties}</div>
      <div className="panel-content">
        <div>{members.length} {t.objectsSelected}</div>
        <div className="prop-row">
          <span className="prop-label">{t.propStory}</span>
          <select className="prop-select" value={story ?? ''} onChange={(event) => {
            if (event.target.value) updateMembers(ids, { story: event.target.value });
          }}>
            <option value="">—</option>
            {data.stories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="prop-row">
          <span className="prop-label">{t.propSection}</span>
          <select className="prop-select" value={section ?? ''} onChange={(event) => {
            if (event.target.value) updateMembers(ids, { sectionId: event.target.value });
          }}>
            <option value="">—</option>
            {compatibleSections.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
          </select>
        </div>
        <div className="prop-row">
          <span className="prop-label">Material</span>
          <select className="prop-select" value={material ?? ''} onChange={(event) => {
            if (event.target.value) updateMembers(ids, { materialId: event.target.value });
          }}>
            <option value="">—</option>
            {data.materials.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <CoordRow
          label={`${t.propRotation} (°)`}
          value={rotation == null ? 0 : radiansToDisplayDegrees(rotation)}
          mixed={rotation == null}
          mixedLabel={t.propMixed}
          placeholder={rotation == null ? '—' : undefined}
          onChange={(value) => updateMembers(ids, { rotation: (value * Math.PI) / 180 })}
        />
        <div className="prop-row">
          <span className="prop-label">{t.propColor}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input
              type="color"
              aria-label={t.propColor}
              value={color ?? '#000000'}
              onChange={(event) => updateMembers(ids, { color: event.target.value })}
            />
            {color == null && (
              <>
                <small style={{ color: 'var(--text-secondary)' }}>{t.propMixed}</small>
                <button
                  type="button"
                  className="toolbar-btn"
                  aria-label={`${t.propApply} ${t.propColor}`}
                  onClick={() => updateMembers(ids, { color: '#000000' })}
                >
                  {t.propApply}
                </button>
              </>
            )}
          </span>
        </div>
        {groupName && <div className="prop-row"><span className="prop-label">{t.groupName}</span><span>{groupName}</span></div>}
      </div>
    </div>
  );
}

function MemberProps({ member }: { member: Member }) {
  const updateMember = useProjectStore((s) => s.updateMember);
  const updateSlabVertex = useProjectStore((s) => s.updateSlabVertex);
  const addSlabVertex = useProjectStore((s) => s.addSlabVertex);
  const removeSlabVertex = useProjectStore((s) => s.removeSlabVertex);
  const data = useProjectStore((s) => s.data)!;
  const { t } = useI18n();

  // Measurement: area/perimeter for slabs, length for linear members
  const measurement = useMemo((): { area?: number; perimeter?: number; length?: number } => {
    if (member.type === 'slab') {
      return {
        area: polygonArea(member.polygon),
        perimeter: polygonPerimeter(member.polygon),
      };
    }
    return {
      length: linearLength(
        { x: member.start.x, y: member.start.y },
        { x: member.end.x, y: member.end.y },
      ),
    };
  }, [member]);

  // Group info
  const group = data.groups?.find((g) => g.memberIds.includes(member.id));
  const compatibleSections = data.sections.filter((section) =>
    sectionSupportsMember(section, member.type),
  );

  return (
    <div>
      <div className="panel-header">{t.panelProperties}</div>
      <div className="panel-content">
        <div className="prop-row">
          <span className="prop-label">{t.propId}</span>
          <span>{member.id}</span>
        </div>
        <div className="prop-row">
          <span className="prop-label">{t.propType}</span>
          <span>{member.type}</span>
        </div>
        <div className="prop-row">
          <span className="prop-label">{t.propStory}</span>
          <select
            className="prop-select"
            value={member.story}
            onChange={(e) => updateMember(member.id, { story: e.target.value })}
          >
            {data.stories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="prop-row">
          <span className="prop-label">{t.propSection}</span>
          <select
            className="prop-select"
            value={member.sectionId}
            onChange={(e) => updateMember(member.id, { sectionId: e.target.value })}
          >
            {compatibleSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}
              </option>
            ))}
          </select>
        </div>
        <div className="prop-row">
          <span className="prop-label">Material</span>
          <select
            className="prop-select"
            value={member.materialId}
            onChange={(e) => updateMember(member.id, { materialId: e.target.value })}
          >
            {data.materials.map((material) => (
              <option key={material.id} value={material.id}>{material.name}</option>
            ))}
          </select>
        </div>
        <CoordRow
          label={`${t.propRotation} (°)`}
          value={radiansToDisplayDegrees(member.rotation ?? 0)}
          onChange={(value) => updateMember(member.id, { rotation: (value * Math.PI) / 180 })}
        />
        <CoordRow
          label="Axis offset X"
          value={member.axisOffset?.dx ?? 0}
          onChange={(value) => updateMember(member.id, {
            axisOffset: { dx: value, dy: member.axisOffset?.dy ?? 0 },
          })}
        />
        <CoordRow
          label="Axis offset Y"
          value={member.axisOffset?.dy ?? 0}
          onChange={(value) => updateMember(member.id, {
            axisOffset: { dx: member.axisOffset?.dx ?? 0, dy: value },
          })}
        />
        {(member.type === 'beam' || member.type === 'wall') && (
          <div className="prop-row">
            <span className="prop-label">Face align</span>
            <select
              className="prop-select"
              value={member.faceAlign ?? 'center'}
              onChange={(event) => updateMember(member.id, {
                faceAlign: event.target.value as 'center' | 'left' | 'right',
              })}
            >
              <option value="center">center</option>
              <option value="left">left</option>
              <option value="right">right</option>
            </select>
          </div>
        )}
        <GridReferenceEditor member={member} />

        {/* Linear member coordinates */}
        {member.type !== 'slab' && (
          <>
            <CoordRow
              label="Start X"
              value={member.start.x}
              onChange={(v) =>
                updateMember(member.id, { start: { ...member.start, x: v } } as Partial<Member>)
              }
            />
            <CoordRow
              label="Start Y"
              value={member.start.y}
              onChange={(v) =>
                updateMember(member.id, { start: { ...member.start, y: v } } as Partial<Member>)
              }
            />
            <CoordRow
              label="End X"
              value={member.end.x}
              onChange={(v) =>
                updateMember(member.id, { end: { ...member.end, x: v } } as Partial<Member>)
              }
            />
            <CoordRow
              label="End Y"
              value={member.end.y}
              onChange={(v) =>
                updateMember(member.id, { end: { ...member.end, y: v } } as Partial<Member>)
              }
            />
            <CoordRow
              label="Start Z"
              value={member.start.z}
              onChange={(v) =>
                updateMember(member.id, { start: { ...member.start, z: v } } as Partial<Member>)
              }
            />
            <CoordRow
              label="End Z"
              value={member.end.z}
              onChange={(v) =>
                updateMember(member.id, { end: { ...member.end, z: v } } as Partial<Member>)
              }
            />
          </>
        )}

        {member.type === 'slab' && (
          <CoordRow
            label="Level Z"
            value={member.level}
            onChange={(value) => updateMember(member.id, { level: value } as Partial<Member>)}
          />
        )}

        {/* Measurements */}
        {measurement.length != null && (
          <div className="prop-row">
            <span className="prop-label">{t.propLength}</span>
            <span>{measurement.length.toFixed(0)} mm</span>
          </div>
        )}
        {measurement.area != null && measurement.perimeter != null && (
          <>
            <div className="prop-row">
              <span className="prop-label">{t.propArea}</span>
              <span>{(measurement.area / 1e6).toFixed(3)} m2</span>
            </div>
            <div className="prop-row">
              <span className="prop-label">{t.propPerimeter}</span>
              <span>{measurement.perimeter.toFixed(0)} mm</span>
            </div>
          </>
        )}

        {/* Slab vertex editing */}
        {member.type === 'slab' && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{t.propVertices}</div>
            {member.polygon.map((pt, i) => (
              <div
                key={i}
                style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2 }}
              >
                <span style={{ fontSize: 10, width: 16, color: 'var(--text-secondary)' }}>{i}</span>
                <VertexCoordInput
                  value={pt.x}
                  onChange={(v) => updateSlabVertex(member.id, i, { x: v, y: pt.y })}
                />
                <VertexCoordInput
                  value={pt.y}
                  onChange={(v) => updateSlabVertex(member.id, i, { x: pt.x, y: v })}
                />
                <button
                  style={{
                    fontSize: 10,
                    padding: '1px 4px',
                    cursor: 'pointer',
                    background: 'var(--border-color)',
                    border: 'none',
                    borderRadius: 2,
                    color: 'var(--text-primary)',
                  }}
                  title={t.vertexAdd}
                  onClick={() => addSlabVertex(member.id, i)}
                >
                  +
                </button>
                {member.polygon.length > 3 && (
                  <button
                    style={{
                      fontSize: 10,
                      padding: '1px 4px',
                      cursor: 'pointer',
                      background: 'var(--border-color)',
                      border: 'none',
                      borderRadius: 2,
                      color: 'var(--text-primary)',
                    }}
                    title={t.vertexRemove}
                    onClick={() => removeSlabVertex(member.id, i)}
                  >
                    -
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Style properties */}
        <div className="prop-row">
          <span className="prop-label">{t.propColor}</span>
          <input
            type="color"
            value={member.color ?? '#000000'}
            onChange={(e) => updateMember(member.id, { color: e.target.value } as Partial<Member>)}
          />
        </div>
        <CoordRow
          label={t.propLineWeight}
          value={member.lineWeight ?? 20}
          onChange={(v) => updateMember(member.id, { lineWeight: v } as Partial<Member>)}
        />
        <div className="prop-row">
          <span className="prop-label">{t.propLineType}</span>
          <select
            className="prop-select"
            value={member.lineType ?? 'solid'}
            onChange={(e) =>
              updateMember(member.id, { lineType: e.target.value as LineType } as Partial<Member>)
            }
          >
            {LINE_TYPE_OPTIONS.map((lt) => (
              <option key={lt} value={lt}>
                {lt}
              </option>
            ))}
          </select>
        </div>
        {member.type === 'slab' && (
          <>
            <div className="prop-row">
              <span className="prop-label">{t.propFillColor}</span>
              <input
                type="color"
                value={member.fillColor ?? '#9b59b6'}
                onChange={(e) =>
                  updateMember(member.id, { fillColor: e.target.value } as Partial<Member>)
                }
              />
            </div>
            <CoordRow
              label={t.propFillOpacity}
              value={member.fillOpacity ?? 0.1}
              onChange={(v) =>
                updateMember(member.id, {
                  fillOpacity: Math.max(0, Math.min(1, v)),
                } as Partial<Member>)
              }
            />
          </>
        )}

        {/* Group info */}
        {group && (
          <div className="prop-row" style={{ marginTop: 8 }}>
            <span className="prop-label">{t.groupName}</span>
            <span>{group.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function GridReferenceEditor({ member }: { member: Member }) {
  const data = useProjectStore((state) => state.data)!;
  const updateMember = useProjectStore((state) => state.updateMember);
  if (member.type === 'slab') return null;
  const xNames = data.grids.filter((grid) => grid.axis === 'X').map((grid) => grid.name);
  const yNames = data.grids.filter((grid) => grid.axis === 'Y').map((grid) => grid.name);
  const pairs = xNames.flatMap((x) => yNames.map((y) => [x, y] as [string, string]));
  const setPair = (endpoint: 'startGrid' | 'endGrid', encoded: string) => {
    const nextGridRef = { ...(member.gridRef ?? {}) };
    nextGridRef[endpoint] = encoded ? encoded.split('|') as [string, string] : undefined;
    updateMember(member.id, {
      gridRef:
        nextGridRef.startGrid || nextGridRef.endGrid
          ? nextGridRef
          : undefined,
    });
  };

  return (
    <div style={{ marginTop: 6 }}>
      {(['startGrid', 'endGrid'] as const).map((endpoint) => (
        <div key={endpoint} className="prop-row">
          <span className="prop-label">{endpoint === 'startGrid' ? 'Start grid' : 'End grid'}</span>
          <select
            className="prop-select"
            value={member.gridRef?.[endpoint]?.join('|') ?? ''}
            onChange={(event) => setPair(endpoint, event.target.value)}
          >
            <option value="">—</option>
            {pairs.map(([x, y]) => <option key={`${x}|${y}`} value={`${x}|${y}`}>{x} / {y}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

const FONT_FAMILY_OPTIONS = ['sans-serif', 'serif', 'monospace'];

function AnnotationProps({ annotation }: { annotation: Annotation }) {
  const updateAnnotation = useProjectStore((s) => s.updateAnnotation);
  const { t } = useI18n();

  const isSpline = annotation.type === 'spline';

  return (
    <div>
      <div className="panel-header">{t.panelProperties}</div>
      <div className="panel-content">
        <div className="prop-row">
          <span className="prop-label">{t.propId}</span>
          <span>{annotation.id}</span>
        </div>
        <div className="prop-row">
          <span className="prop-label">{t.propType}</span>
          <span>{annotation.type}</span>
        </div>
        {!isSpline && (
          <>
            <div className="prop-row">
              <span className="prop-label">{t.propText}</span>
              <textarea
                className="prop-input"
                value={annotation.text}
                onChange={(e) => updateAnnotation(annotation.id, { text: e.target.value })}
                rows={3}
                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 'inherit' }}
              />
            </div>
            <CoordRow
              label="X"
              value={annotation.x}
              onChange={(v) => updateAnnotation(annotation.id, { x: v })}
            />
            <CoordRow
              label="Y"
              value={annotation.y}
              onChange={(v) => updateAnnotation(annotation.id, { y: v })}
            />
            <div className="prop-row">
              <span className="prop-label">{t.propColor}</span>
              <input
                type="color"
                value={annotation.color ?? '#000000'}
                onChange={(e) => updateAnnotation(annotation.id, { color: e.target.value })}
              />
            </div>
            <div className="prop-row">
              <span className="prop-label">{t.propTextAlign}</span>
              <select
                className="prop-select"
                value={annotation.textAlign ?? 'left'}
                onChange={(e) =>
                  updateAnnotation(annotation.id, { textAlign: e.target.value as TextAlign })
                }
              >
                {TEXT_ALIGN_OPTIONS.map((ta) => (
                  <option key={ta} value={ta}>
                    {ta}
                  </option>
                ))}
              </select>
            </div>
            <CoordRow
              label={t.propRotation}
              value={annotation.rotation ?? 0}
              onChange={(v) => updateAnnotation(annotation.id, { rotation: v })}
            />

            {/* Text Formatting */}
            <div className="prop-row" style={{ marginTop: 8 }}>
              <span className="prop-label">{t.propFontWeight}</span>
              <button
                className={`toolbar-btn ${annotation.fontWeight === 'bold' ? 'active' : ''}`}
                style={{ minWidth: 32, fontWeight: 'bold' }}
                onClick={() =>
                  updateAnnotation(annotation.id, {
                    fontWeight: annotation.fontWeight === 'bold' ? 'normal' : 'bold',
                  })
                }
              >
                B
              </button>
            </div>
            <div className="prop-row">
              <span className="prop-label">{t.propFontStyle}</span>
              <button
                className={`toolbar-btn ${annotation.fontStyle === 'italic' ? 'active' : ''}`}
                style={{ minWidth: 32, fontStyle: 'italic' }}
                onClick={() =>
                  updateAnnotation(annotation.id, {
                    fontStyle: annotation.fontStyle === 'italic' ? 'normal' : 'italic',
                  })
                }
              >
                I
              </button>
            </div>
            <div className="prop-row">
              <span className="prop-label">{t.propTextDecoration}</span>
              <button
                className={`toolbar-btn ${annotation.textDecoration === 'underline' ? 'active' : ''}`}
                style={{ minWidth: 32, textDecoration: 'underline' }}
                onClick={() =>
                  updateAnnotation(annotation.id, {
                    textDecoration:
                      annotation.textDecoration === 'underline' ? 'none' : 'underline',
                  })
                }
              >
                U
              </button>
            </div>
            <div className="prop-row">
              <span className="prop-label">{t.propFontFamily}</span>
              <select
                className="prop-select"
                value={annotation.fontFamily ?? 'sans-serif'}
                onChange={(e) => updateAnnotation(annotation.id, { fontFamily: e.target.value })}
              >
                {FONT_FAMILY_OPTIONS.map((ff) => (
                  <option key={ff} value={ff}>
                    {ff}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        {isSpline && (
          <>
            <div className="prop-row">
              <span className="prop-label">{t.propColor}</span>
              <input
                type="color"
                value={annotation.color ?? '#000000'}
                onChange={(e) => updateAnnotation(annotation.id, { color: e.target.value })}
              />
            </div>
            <div className="prop-row">
              <span className="prop-label">Points</span>
              <span>{annotation.points?.length ?? 0}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DimensionProps({ dimension }: { dimension: Dimension }) {
  const updateDimension = useProjectStore((s) => s.updateDimension);
  const { t } = useI18n();

  return (
    <div>
      <div className="panel-header">{t.panelProperties}</div>
      <div className="panel-content">
        <div className="prop-row">
          <span className="prop-label">{t.propId}</span>
          <span>{dimension.id}</span>
        </div>
        <div className="prop-row">
          <span className="prop-label">{t.propLength}</span>
          <span>
            {Math.sqrt(
              (dimension.end.x - dimension.start.x) ** 2 +
                (dimension.end.y - dimension.start.y) ** 2,
            ).toFixed(0)}{' '}
            mm
          </span>
        </div>
        <CoordRow
          label={t.propOffset}
          value={dimension.offset}
          onChange={(v) => updateDimension(dimension.id, { offset: v })}
        />
        <div className="prop-row">
          <span className="prop-label">{t.propColor}</span>
          <input
            type="color"
            value={dimension.color ?? '#000000'}
            onChange={(e) => updateDimension(dimension.id, { color: e.target.value })}
          />
        </div>
        <CoordRow
          label={t.propLineWeight}
          value={dimension.lineWeight ?? 15}
          onChange={(v) => updateDimension(dimension.id, { lineWeight: v })}
        />
        <div className="prop-row">
          <span className="prop-label">{t.propLineType}</span>
          <select
            className="prop-select"
            value={dimension.lineType ?? 'solid'}
            onChange={(e) =>
              updateDimension(dimension.id, { lineType: e.target.value as LineType })
            }
          >
            {LINE_TYPE_OPTIONS.map((lt) => (
              <option key={lt} value={lt}>
                {lt}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function OpeningProps({ opening }: { opening: Opening }) {
  const updateOpening = useProjectStore((state) => state.updateOpening);
  const { t } = useI18n();
  return (
    <div>
      <div className="panel-header">{t.panelProperties}</div>
      <div className="panel-content">
        <div className="prop-row"><span className="prop-label">{t.propId}</span><span>{opening.id}</span></div>
        <div className="prop-row">
          <span className="prop-label">{t.propType}</span>
          <select
            className="prop-select"
            value={opening.type}
            onChange={(event) => updateOpening(opening.id, {
              type: event.target.value as Opening['type'],
            })}
          >
            <option value="door">door</option>
            <option value="window">window</option>
            <option value="void">void</option>
          </select>
        </div>
        <div className="prop-row"><span className="prop-label">Host</span><span>{opening.memberId}</span></div>
        <CoordRow label="X" value={opening.position.x} onChange={(value) => updateOpening(opening.id, {
          position: { ...opening.position, x: value },
        })} />
        <CoordRow label="Y" value={opening.position.y} onChange={(value) => updateOpening(opening.id, {
          position: { ...opening.position, y: value },
        })} />
        <CoordRow label="Z" value={opening.position.z} onChange={(value) => updateOpening(opening.id, {
          position: { ...opening.position, z: value },
        })} />
        <CoordRow label="Width" value={opening.width} onChange={(width) =>
          updateOpening(opening.id, { width })
        } />
        <CoordRow label="Height" value={opening.height} onChange={(height) =>
          updateOpening(opening.id, { height })
        } />
      </div>
    </div>
  );
}
