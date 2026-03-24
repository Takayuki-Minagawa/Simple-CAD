import { useProjectStore, useEditorStore } from '@/app/store';
import { useI18n } from '@/i18n';
import type { Member, Annotation, Dimension, LineType, TextAlign } from '@/domain/structural/types';
import { useState, useEffect } from 'react';

const LINE_TYPE_OPTIONS: LineType[] = ['solid', 'dashed', 'dotted', 'chain', 'dashdot'];
const TEXT_ALIGN_OPTIONS: TextAlign[] = ['left', 'center', 'right'];

export function PropertyPanel() {
  const data = useProjectStore((s) => s.data);
  const { selectedIds } = useEditorStore();
  const { t } = useI18n();

  if (!data || selectedIds.length === 0) {
    return (
      <div>
        <div className="panel-header">{t.panelProperties}</div>
        <div className="panel-content" style={{ color: 'var(--text-secondary)' }}>{t.noSelection}</div>
      </div>
    );
  }

  if (selectedIds.length > 1) {
    return (
      <div>
        <div className="panel-header">{t.panelProperties}</div>
        <div className="panel-content">{selectedIds.length} {t.objectsSelected}</div>
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

  return (
    <div>
      <div className="panel-header">{t.panelProperties}</div>
      <div className="panel-content">Unknown</div>
    </div>
  );
}

function MemberProps({ member }: { member: Member }) {
  const updateMember = useProjectStore((s) => s.updateMember);
  const data = useProjectStore((s) => s.data)!;
  const { t } = useI18n();

  return (
    <div>
      <div className="panel-header">{t.panelProperties}</div>
      <div className="panel-content">
        <div className="prop-row"><span className="prop-label">{t.propId}</span><span>{member.id}</span></div>
        <div className="prop-row"><span className="prop-label">{t.propType}</span><span>{member.type}</span></div>
        <div className="prop-row">
          <span className="prop-label">{t.propStory}</span>
          <select className="prop-select" value={member.story} onChange={(e) => updateMember(member.id, { story: e.target.value })}>
            {data.stories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="prop-row">
          <span className="prop-label">{t.propSection}</span>
          <select className="prop-select" value={member.sectionId} onChange={(e) => updateMember(member.id, { sectionId: e.target.value })}>
            {data.sections.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
          </select>
        </div>
        {member.type !== 'slab' && (
          <>
            <CoordRow label="Start X" value={member.start.x} onChange={(v) => updateMember(member.id, { start: { ...member.start, x: v } } as Partial<Member>)} />
            <CoordRow label="Start Y" value={member.start.y} onChange={(v) => updateMember(member.id, { start: { ...member.start, y: v } } as Partial<Member>)} />
            <CoordRow label="End X" value={member.end.x} onChange={(v) => updateMember(member.id, { end: { ...member.end, x: v } } as Partial<Member>)} />
            <CoordRow label="End Y" value={member.end.y} onChange={(v) => updateMember(member.id, { end: { ...member.end, y: v } } as Partial<Member>)} />
          </>
        )}
        {/* Style properties */}
        <div className="prop-row">
          <span className="prop-label">{t.propColor}</span>
          <input type="color" value={member.color ?? '#000000'} onChange={(e) => updateMember(member.id, { color: e.target.value } as Partial<Member>)} />
        </div>
        <CoordRow label={t.propLineWeight} value={member.lineWeight ?? 20} onChange={(v) => updateMember(member.id, { lineWeight: v } as Partial<Member>)} />
        <div className="prop-row">
          <span className="prop-label">{t.propLineType}</span>
          <select className="prop-select" value={member.lineType ?? 'solid'} onChange={(e) => updateMember(member.id, { lineType: e.target.value as LineType } as Partial<Member>)}>
            {LINE_TYPE_OPTIONS.map((lt) => <option key={lt} value={lt}>{lt}</option>)}
          </select>
        </div>
        {member.type === 'slab' && (
          <>
            <div className="prop-row">
              <span className="prop-label">{t.propFillColor}</span>
              <input type="color" value={member.fillColor ?? '#9b59b6'} onChange={(e) => updateMember(member.id, { fillColor: e.target.value } as Partial<Member>)} />
            </div>
            <CoordRow label={t.propFillOpacity} value={member.fillOpacity ?? 0.1} onChange={(v) => updateMember(member.id, { fillOpacity: Math.max(0, Math.min(1, v)) } as Partial<Member>)} />
          </>
        )}
      </div>
    </div>
  );
}

function AnnotationProps({ annotation }: { annotation: Annotation }) {
  const updateAnnotation = useProjectStore((s) => s.updateAnnotation);
  const { t } = useI18n();

  return (
    <div>
      <div className="panel-header">{t.panelProperties}</div>
      <div className="panel-content">
        <div className="prop-row"><span className="prop-label">{t.propId}</span><span>{annotation.id}</span></div>
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
        <CoordRow label="X" value={annotation.x} onChange={(v) => updateAnnotation(annotation.id, { x: v })} />
        <CoordRow label="Y" value={annotation.y} onChange={(v) => updateAnnotation(annotation.id, { y: v })} />
        <div className="prop-row">
          <span className="prop-label">{t.propColor}</span>
          <input type="color" value={annotation.color ?? '#000000'} onChange={(e) => updateAnnotation(annotation.id, { color: e.target.value })} />
        </div>
        <div className="prop-row">
          <span className="prop-label">{t.propTextAlign}</span>
          <select className="prop-select" value={annotation.textAlign ?? 'left'} onChange={(e) => updateAnnotation(annotation.id, { textAlign: e.target.value as TextAlign })}>
            {TEXT_ALIGN_OPTIONS.map((ta) => <option key={ta} value={ta}>{ta}</option>)}
          </select>
        </div>
        <CoordRow label={t.propRotation} value={annotation.rotation ?? 0} onChange={(v) => updateAnnotation(annotation.id, { rotation: v })} />
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
        <div className="prop-row"><span className="prop-label">{t.propId}</span><span>{dimension.id}</span></div>
        <div className="prop-row">
          <span className="prop-label">{t.propLength}</span>
          <span>{Math.sqrt((dimension.end.x - dimension.start.x) ** 2 + (dimension.end.y - dimension.start.y) ** 2).toFixed(0)} mm</span>
        </div>
        <CoordRow label={t.propOffset} value={dimension.offset} onChange={(v) => updateDimension(dimension.id, { offset: v })} />
        <div className="prop-row">
          <span className="prop-label">{t.propColor}</span>
          <input type="color" value={dimension.color ?? '#000000'} onChange={(e) => updateDimension(dimension.id, { color: e.target.value })} />
        </div>
        <CoordRow label={t.propLineWeight} value={dimension.lineWeight ?? 15} onChange={(v) => updateDimension(dimension.id, { lineWeight: v })} />
        <div className="prop-row">
          <span className="prop-label">{t.propLineType}</span>
          <select className="prop-select" value={dimension.lineType ?? 'solid'} onChange={(e) => updateDimension(dimension.id, { lineType: e.target.value as LineType })}>
            {LINE_TYPE_OPTIONS.map((lt) => <option key={lt} value={lt}>{lt}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function CoordRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  const commit = () => {
    const num = parseFloat(text);
    if (!isNaN(num) && num !== value) onChange(num);
    else setText(String(value));
  };
  return (
    <div className="prop-row">
      <span className="prop-label">{label}</span>
      <input className="prop-input" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
    </div>
  );
}
