import { useProjectStore, useEditorStore } from '@/app/store';
import type { Member, Annotation, Dimension } from '@/domain/structural/types';
import { useState, useEffect } from 'react';

export function PropertyPanel() {
  const data = useProjectStore((s) => s.data);
  const { selectedIds } = useEditorStore();

  if (!data || selectedIds.length === 0) {
    return (
      <div>
        <div className="panel-header">Properties</div>
        <div className="panel-content" style={{ color: 'var(--text-secondary)' }}>
          No selection
        </div>
      </div>
    );
  }

  if (selectedIds.length > 1) {
    return (
      <div>
        <div className="panel-header">Properties</div>
        <div className="panel-content">{selectedIds.length} objects selected</div>
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
      <div className="panel-header">Properties</div>
      <div className="panel-content">Unknown object</div>
    </div>
  );
}

function MemberProps({ member }: { member: Member }) {
  const updateMember = useProjectStore((s) => s.updateMember);
  const data = useProjectStore((s) => s.data)!;

  return (
    <div>
      <div className="panel-header">Member</div>
      <div className="panel-content">
        <div className="prop-row">
          <span className="prop-label">ID</span>
          <span>{member.id}</span>
        </div>
        <div className="prop-row">
          <span className="prop-label">Type</span>
          <span>{member.type}</span>
        </div>
        <div className="prop-row">
          <span className="prop-label">Story</span>
          <select
            className="prop-select"
            value={member.story}
            onChange={(e) => updateMember(member.id, { story: e.target.value })}
          >
            {data.stories.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="prop-row">
          <span className="prop-label">Section</span>
          <select
            className="prop-select"
            value={member.sectionId}
            onChange={(e) => updateMember(member.id, { sectionId: e.target.value })}
          >
            {data.sections.map((s) => (
              <option key={s.id} value={s.id}>{s.id}</option>
            ))}
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
      </div>
    </div>
  );
}

function AnnotationProps({ annotation }: { annotation: Annotation }) {
  const updateAnnotation = useProjectStore((s) => s.updateAnnotation);

  return (
    <div>
      <div className="panel-header">Annotation</div>
      <div className="panel-content">
        <div className="prop-row">
          <span className="prop-label">ID</span>
          <span>{annotation.id}</span>
        </div>
        <div className="prop-row">
          <span className="prop-label">Text</span>
          <input
            className="prop-input"
            value={annotation.text}
            onChange={(e) => updateAnnotation(annotation.id, { text: e.target.value })}
          />
        </div>
        <CoordRow label="X" value={annotation.x} onChange={(v) => updateAnnotation(annotation.id, { x: v })} />
        <CoordRow label="Y" value={annotation.y} onChange={(v) => updateAnnotation(annotation.id, { y: v })} />
      </div>
    </div>
  );
}

function DimensionProps({ dimension }: { dimension: Dimension }) {
  return (
    <div>
      <div className="panel-header">Dimension</div>
      <div className="panel-content">
        <div className="prop-row">
          <span className="prop-label">ID</span>
          <span>{dimension.id}</span>
        </div>
        <div className="prop-row">
          <span className="prop-label">Length</span>
          <span>
            {Math.sqrt(
              (dimension.end.x - dimension.start.x) ** 2 +
              (dimension.end.y - dimension.start.y) ** 2,
            ).toFixed(0)} mm
          </span>
        </div>
        <div className="prop-row">
          <span className="prop-label">Offset</span>
          <span>{dimension.offset}</span>
        </div>
      </div>
    </div>
  );
}

function CoordRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = () => {
    const num = parseFloat(text);
    if (!isNaN(num) && num !== value) {
      onChange(num);
    } else {
      setText(String(value));
    }
  };

  return (
    <div className="prop-row">
      <span className="prop-label">{label}</span>
      <input
        className="prop-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </div>
  );
}
