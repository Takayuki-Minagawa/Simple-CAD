import { type ReactNode, useState } from 'react';
import { useI18n } from '@/i18n';
import type {
  AreaLoad,
  Diaphragm,
  DofRelease,
  DofRestraint,
  LoadCombination,
  LoadDirection,
  LumpedMass,
  Member,
  MemberLoad,
  NodalLoad,
  ProjectData,
  StructuralSupport,
} from '@/domain/structural/types';
import type { AnalysisDataPatch } from '@/app/store/projectStoreTypes';
import { NumberField, ReadonlyField, SelectField, TextField } from './masterDataFields';
import { radiansToDisplayDegrees } from '@/domain/geometry/precision';

interface AnalysisModelSectionProps {
  data: ProjectData;
  onUpdate: (updates: AnalysisDataPatch) => void;
  onUpdateMember: (id: string, updates: Partial<Member>) => void;
}

const DIRECTIONS: LoadDirection[] = [
  'globalX',
  'globalY',
  'globalZ',
  'localX',
  'localY',
  'localZ',
];
const MEMBER_LOAD_KINDS: MemberLoad['kind'][] = ['point', 'uniform', 'trapezoidal'];
const COMBINATION_TYPES: LoadCombination['type'][] = ['linear', 'envelope'];
const DIAPHRAGM_TYPES: Diaphragm['type'][] = ['rigid', 'semiRigid'];
const DOFS: Array<keyof DofRestraint> = ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'];

interface AnalysisNodeOption {
  key: string;
  storyId: string;
  position: { x: number; y: number; z: number };
}

function collectAnalysisNodes(data: ProjectData): AnalysisNodeOption[] {
  const nodes: AnalysisNodeOption[] = [];
  const seen = new Set<string>();
  const add = (storyId: string, position: { x: number; y: number; z: number }) => {
    const key = `${storyId}:${position.x}:${position.y}:${position.z}`;
    if (seen.has(key)) return;
    seen.add(key);
    nodes.push({ key, storyId, position: { ...position } });
  };
  for (const member of data.members) {
    if (member.type === 'slab') {
      for (const point of member.polygon) add(member.story, { ...point, z: member.level });
    } else {
      add(member.story, member.start);
      add(member.story, member.end);
    }
  }
  for (const diaphragm of data.diaphragms ?? []) {
    if (diaphragm.masterPosition) add(diaphragm.storyId, diaphragm.masterPosition);
  }
  return nodes;
}

function nextId(prefix: string, items: Array<{ id: string }>): string {
  const used = new Set(items.map((item) => item.id));
  let index = items.length + 1;
  let id = `${prefix}-${String(index).padStart(3, '0')}`;
  while (used.has(id)) {
    index += 1;
    id = `${prefix}-${String(index).padStart(3, '0')}`;
  }
  return id;
}

function replaceItem<T extends { id: string }>(items: T[], id: string, updates: Partial<T>): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...updates } : item));
}

function removeItem<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}

function Collection({
  title,
  count,
  addLabel,
  onAdd,
  disabled,
  emptyLabel,
  children,
}: {
  title: string;
  count: number;
  addLabel: string;
  onAdd: () => void;
  disabled?: boolean;
  emptyLabel: string;
  children: ReactNode;
}) {
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h5 style={{ margin: 0, fontSize: 13 }}>{title} ({count})</h5>
        <button className="toolbar-btn" onClick={onAdd} disabled={disabled}>{addLabel}</button>
      </div>
      {count === 0 ? (
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{emptyLabel}</span>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>{children}</div>
      )}
    </section>
  );
}

function Card({ children, onDelete, deleteLabel }: { children: ReactNode; onDelete: () => void; deleteLabel: string }) {
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
      {children}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="toolbar-btn" onClick={onDelete}>{deleteLabel}</button>
      </div>
    </div>
  );
}

function FieldGrid({ children, columns = 4 }: { children: ReactNode; columns?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 8, alignItems: 'end' }}>
      {children}
    </div>
  );
}

function RestraintFields({
  value,
  onChange,
  label,
}: {
  value: DofRestraint;
  onChange: (next: DofRestraint) => void;
  label: string;
}) {
  return (
    <fieldset style={{ margin: 0, border: '1px solid var(--border-color)', borderRadius: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <legend style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</legend>
      {DOFS.map((dof) => (
        <label key={dof} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
          <input
            type="checkbox"
            checked={value[dof]}
            onChange={(event) => onChange({ ...value, [dof]: event.target.checked })}
          />
          {dof.toUpperCase()}
        </label>
      ))}
    </fieldset>
  );
}

function ReleaseFields({
  value,
  onChange,
  label,
}: {
  value: DofRelease | undefined;
  onChange: (next: DofRelease) => void;
  label: string;
}) {
  return (
    <fieldset style={{ margin: 0, border: '1px solid var(--border-color)', borderRadius: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <legend style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</legend>
      {DOFS.map((dof) => (
        <label key={dof} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
          <input
            type="checkbox"
            checked={Boolean(value?.[dof])}
            onChange={(event) => onChange({ ...value, [dof]: event.target.checked })}
          />
          {dof.toUpperCase()}
        </label>
      ))}
    </fieldset>
  );
}

export function AnalysisModelSection({ data, onUpdate, onUpdateMember }: AnalysisModelSectionProps) {
  const { locale } = useI18n();
  const ja = locale === 'ja';
  const labels = ja
    ? {
        title: '構造解析モデル',
        description: '解析JSONに出力する境界条件・荷重・質量・剛床を編集します。',
        add: '追加', delete: '削除', empty: '未登録', id: 'ID', story: '階', loadCase: '荷重ケース',
        supports: '支持条件', restraints: '拘束自由度', position: '位置',
        connectedNode: '接続節点',
        nodalLoads: '節点荷重', force: '力 (kN)', moment: 'モーメント (kN·m)',
        memberLoads: '部材荷重', member: '部材', kind: '種別', direction: '方向', magnitude: '大きさ', endMagnitude: '終点側', ratio: '位置 (0-1)',
        areaLoads: '面荷重',
        combinations: '荷重組合せ', name: '名称', type: '種別', factor: '係数', addFactor: '係数追加',
        masses: '集中質量', mass: '並進質量 (t)', rotationalMass: '回転質量 (t·m²)',
        diaphragms: '剛床', members: '対象部材（複数選択）', master: 'マスター位置',
        results: '解析結果', clearResults: '結果をクリア', noResults: '解析結果はまだ取り込まれていません。',
        nodes: '節点変位', resultMembers: '部材結果', warnings: '警告',
        memberSettings: '部材解析パラメータ', startRelease: '始点側リリース', endRelease: '終点側リリース',
        rigidStart: '始点側剛域 (mm)', rigidEnd: '終点側剛域 (mm)', localRotation: 'ローカル軸回転 (度)', referenceVector: '基準ベクトル', clearSettings: '部材解析設定をクリア',
      }
    : {
        title: 'Structural analysis model',
        description: 'Edit boundary conditions, loads, masses, and diaphragms exported in the analysis JSON.',
        add: 'Add', delete: 'Delete', empty: 'No entries', id: 'ID', story: 'Story', loadCase: 'Load case',
        supports: 'Supports', restraints: 'Restrained DOFs', position: 'Position',
        connectedNode: 'Connected node',
        nodalLoads: 'Nodal loads', force: 'Force (kN)', moment: 'Moment (kN·m)',
        memberLoads: 'Member loads', member: 'Member', kind: 'Kind', direction: 'Direction', magnitude: 'Magnitude', endMagnitude: 'End magnitude', ratio: 'Position (0-1)',
        areaLoads: 'Area loads',
        combinations: 'Load combinations', name: 'Name', type: 'Type', factor: 'Factor', addFactor: 'Add factor',
        masses: 'Lumped masses', mass: 'Translational mass (t)', rotationalMass: 'Rotational mass (t·m²)',
        diaphragms: 'Diaphragms', members: 'Members (multiple)', master: 'Master position',
        results: 'Analysis results', clearResults: 'Clear results', noResults: 'No analysis results have been imported.',
        nodes: 'Node displacements', resultMembers: 'Member results', warnings: 'Warnings',
        memberSettings: 'Member analysis parameters', startRelease: 'Start releases', endRelease: 'End releases',
        rigidStart: 'Start rigid zone (mm)', rigidEnd: 'End rigid zone (mm)', localRotation: 'Local-axis rotation (deg)', referenceVector: 'Reference vector', clearSettings: 'Clear member analysis settings',
      };

  const stories = data.stories;
  const storyIds = stories.map((story) => story.id);
  const loadCaseIds = (data.loadCases ?? []).map((loadCase) => loadCase.id);
  const linearMembers = data.members.filter((member) => member.type !== 'slab');
  const linearMemberIds = linearMembers.map((member) => member.id);
  const slabIds = data.members.filter((member) => member.type === 'slab').map((member) => member.id);
  const firstStory = stories[0];
  const storyZ = firstStory?.elevation ?? 0;
  const firstLoadCase = loadCaseIds[0] ?? '';
  const analysisNodes = collectAnalysisNodes(data);
  const analysisNodeByKey = new Map(analysisNodes.map((node) => [node.key, node]));
  const nodeKeysForStory = (storyId: string) => analysisNodes
    .filter((node) => node.storyId === storyId)
    .map((node) => node.key);
  const storyIdsWithNodes = storyIds.filter((storyId) => nodeKeysForStory(storyId).length > 0);
  const firstAnalysisNode = analysisNodes[0];
  const nodeKeyFor = (storyId: string, position: { x: number; y: number; z: number }) =>
    `${storyId}:${position.x}:${position.y}:${position.z}`;

  const supports = data.supports ?? [];
  const nodalLoads = data.nodalLoads ?? [];
  const memberLoads = data.memberLoads ?? [];
  const areaLoads = data.areaLoads ?? [];
  const combinations = data.loadCombinations ?? [];
  const masses = data.masses ?? [];
  const diaphragms = data.diaphragms ?? [];
  const [selectedMemberId, setSelectedMemberId] = useState(linearMemberIds[0] ?? '');
  const selectedMember = linearMembers.find((member) => member.id === selectedMemberId) ?? linearMembers[0];
  const selectedReference = (() => {
    if (!selectedMember) return { x: 0, y: 0, z: 1 };
    if (selectedMember.localAxis?.referenceVector) return selectedMember.localAxis.referenceVector;
    const dx = selectedMember.end.x - selectedMember.start.x;
    const dy = selectedMember.end.y - selectedMember.start.y;
    const dz = selectedMember.end.z - selectedMember.start.z;
    return Math.abs(dz) > Math.hypot(dx, dy) ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
  })();

  const updateSupport = (id: string, updates: Partial<StructuralSupport>) =>
    onUpdate({ supports: replaceItem(supports, id, updates) });
  const updateNodalLoad = (id: string, updates: Partial<NodalLoad>) =>
    onUpdate({ nodalLoads: replaceItem(nodalLoads, id, updates) });
  const updateMemberLoad = (id: string, updates: Partial<MemberLoad>) =>
    onUpdate({ memberLoads: replaceItem(memberLoads, id, updates) });
  const updateAreaLoad = (id: string, updates: Partial<AreaLoad>) =>
    onUpdate({ areaLoads: replaceItem(areaLoads, id, updates) });
  const updateCombination = (id: string, updates: Partial<LoadCombination>) =>
    onUpdate({ loadCombinations: replaceItem(combinations, id, updates) });
  const updateMass = (id: string, updates: Partial<LumpedMass>) =>
    onUpdate({ masses: replaceItem(masses, id, updates) });
  const updateDiaphragm = (id: string, updates: Partial<Diaphragm>) =>
    onUpdate({ diaphragms: replaceItem(diaphragms, id, updates) });

  return (
    <section style={{ display: 'grid', gap: 14, borderTop: '2px solid var(--border-color)', paddingTop: 16 }}>
      <div>
        <h4 style={{ margin: 0, fontSize: 14, color: 'var(--accent)' }}>{labels.title}</h4>
        <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 12 }}>{labels.description}</p>
      </div>

      <section style={{ display: 'grid', gap: 8 }}>
        <h5 style={{ margin: 0, fontSize: 13 }}>{labels.memberSettings}</h5>
        {selectedMember ? (
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
            <SelectField
              label={labels.member}
              value={selectedMember.id}
              options={linearMemberIds}
              onChange={setSelectedMemberId}
            />
            <FieldGrid columns={3}>
              <NumberField
                label={labels.rigidStart}
                value={selectedMember.rigidZones?.start ?? 0}
                onChange={(start) => onUpdateMember(selectedMember.id, { rigidZones: { ...selectedMember.rigidZones, start: Math.max(0, start) } })}
              />
              <NumberField
                label={labels.rigidEnd}
                value={selectedMember.rigidZones?.end ?? 0}
                onChange={(end) => onUpdateMember(selectedMember.id, { rigidZones: { ...selectedMember.rigidZones, end: Math.max(0, end) } })}
              />
              <NumberField
                label={labels.localRotation}
                value={radiansToDisplayDegrees(selectedMember.localAxis?.rotation ?? 0)}
                onChange={(degrees) => onUpdateMember(selectedMember.id, { localAxis: { ...selectedMember.localAxis, rotation: (degrees * Math.PI) / 180 } })}
              />
            </FieldGrid>
            <ReleaseFields
              label={labels.startRelease}
              value={selectedMember.releases?.start}
              onChange={(start) => onUpdateMember(selectedMember.id, { releases: { ...selectedMember.releases, start } })}
            />
            <ReleaseFields
              label={labels.endRelease}
              value={selectedMember.releases?.end}
              onChange={(end) => onUpdateMember(selectedMember.id, { releases: { ...selectedMember.releases, end } })}
            />
            <FieldGrid columns={3}>
              <NumberField
                label={`${labels.referenceVector} X`}
                value={selectedReference.x}
                onChange={(x) => onUpdateMember(selectedMember.id, { localAxis: { rotation: selectedMember.localAxis?.rotation ?? 0, referenceVector: { ...selectedReference, x } } })}
              />
              <NumberField
                label={`${labels.referenceVector} Y`}
                value={selectedReference.y}
                onChange={(y) => onUpdateMember(selectedMember.id, { localAxis: { rotation: selectedMember.localAxis?.rotation ?? 0, referenceVector: { ...selectedReference, y } } })}
              />
              <NumberField
                label={`${labels.referenceVector} Z`}
                value={selectedReference.z}
                onChange={(z) => onUpdateMember(selectedMember.id, { localAxis: { rotation: selectedMember.localAxis?.rotation ?? 0, referenceVector: { ...selectedReference, z } } })}
              />
            </FieldGrid>
            <button
              className="toolbar-btn"
              onClick={() => onUpdateMember(selectedMember.id, { releases: undefined, rigidZones: undefined, localAxis: undefined })}
            >
              {labels.clearSettings}
            </button>
          </div>
        ) : (
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{labels.empty}</span>
        )}
      </section>

      <Collection
        title={labels.supports}
        count={supports.length}
        addLabel={labels.add}
        disabled={!firstAnalysisNode}
        emptyLabel={labels.empty}
        onAdd={() => firstAnalysisNode && onUpdate({ supports: [...supports, {
          id: nextId('SUP', supports), storyId: firstAnalysisNode.storyId, position: firstAnalysisNode.position,
          restraints: { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true },
        }] })}
      >
        {supports.map((support) => (
          <Card key={support.id} deleteLabel={labels.delete} onDelete={() => onUpdate({ supports: removeItem(supports, support.id) })}>
            <FieldGrid>
              <ReadonlyField label={labels.id} value={support.id} />
              <SelectField label={labels.story} value={support.storyId} options={storyIdsWithNodes} onChange={(storyId) => {
                const node = analysisNodeByKey.get(nodeKeysForStory(storyId)[0]);
                if (node) updateSupport(support.id, { storyId, position: node.position });
              }} />
              <SelectField label={labels.connectedNode} value={nodeKeyFor(support.storyId, support.position)} options={nodeKeysForStory(support.storyId)} onChange={(key) => {
                const node = analysisNodeByKey.get(key);
                if (node) updateSupport(support.id, { position: node.position });
              }} />
              <ReadonlyField label="X / Y / Z (mm)" value={`${support.position.x} / ${support.position.y} / ${support.position.z}`} />
            </FieldGrid>
            <RestraintFields label={labels.restraints} value={support.restraints} onChange={(restraints) => updateSupport(support.id, { restraints })} />
          </Card>
        ))}
      </Collection>

      <Collection
        title={labels.nodalLoads}
        count={nodalLoads.length}
        addLabel={labels.add}
        disabled={!firstAnalysisNode || !firstLoadCase}
        emptyLabel={labels.empty}
        onAdd={() => firstAnalysisNode && firstLoadCase && onUpdate({ nodalLoads: [...nodalLoads, {
          id: nextId('NL', nodalLoads), loadCaseId: firstLoadCase, storyId: firstAnalysisNode.storyId,
          position: firstAnalysisNode.position, force: { x: 0, y: 0, z: -1 }, moment: { x: 0, y: 0, z: 0 },
        }] })}
      >
        {nodalLoads.map((load) => (
          <Card key={load.id} deleteLabel={labels.delete} onDelete={() => onUpdate({ nodalLoads: removeItem(nodalLoads, load.id) })}>
            <FieldGrid>
              <ReadonlyField label={labels.id} value={load.id} />
              <SelectField label={labels.loadCase} value={load.loadCaseId} options={loadCaseIds} onChange={(loadCaseId) => updateNodalLoad(load.id, { loadCaseId })} />
              <SelectField label={labels.story} value={load.storyId} options={storyIdsWithNodes} onChange={(storyId) => {
                const node = analysisNodeByKey.get(nodeKeysForStory(storyId)[0]);
                if (node) updateNodalLoad(load.id, { storyId, position: node.position });
              }} />
              <SelectField label={labels.connectedNode} value={nodeKeyFor(load.storyId, load.position)} options={nodeKeysForStory(load.storyId)} onChange={(key) => {
                const node = analysisNodeByKey.get(key);
                if (node) updateNodalLoad(load.id, { position: node.position });
              }} />
            </FieldGrid>
            <FieldGrid columns={3}>
              <ReadonlyField label={`${labels.position} X/Y/Z (mm)`} value={`${load.position.x} / ${load.position.y} / ${load.position.z}`} />
              <NumberField label={`${labels.force} X`} value={load.force.x} onChange={(x) => updateNodalLoad(load.id, { force: { ...load.force, x } })} />
              <NumberField label={`${labels.force} Y`} value={load.force.y} onChange={(y) => updateNodalLoad(load.id, { force: { ...load.force, y } })} />
              <NumberField label={`${labels.force} Z`} value={load.force.z} onChange={(z) => updateNodalLoad(load.id, { force: { ...load.force, z } })} />
              <NumberField label={`${labels.moment} X`} value={load.moment?.x ?? 0} onChange={(x) => updateNodalLoad(load.id, { moment: { x, y: load.moment?.y ?? 0, z: load.moment?.z ?? 0 } })} />
              <NumberField label={`${labels.moment} Y`} value={load.moment?.y ?? 0} onChange={(y) => updateNodalLoad(load.id, { moment: { x: load.moment?.x ?? 0, y, z: load.moment?.z ?? 0 } })} />
              <NumberField label={`${labels.moment} Z`} value={load.moment?.z ?? 0} onChange={(z) => updateNodalLoad(load.id, { moment: { x: load.moment?.x ?? 0, y: load.moment?.y ?? 0, z } })} />
            </FieldGrid>
          </Card>
        ))}
      </Collection>

      <Collection
        title={labels.memberLoads}
        count={memberLoads.length}
        addLabel={labels.add}
        disabled={!firstLoadCase || linearMemberIds.length === 0}
        emptyLabel={labels.empty}
        onAdd={() => firstLoadCase && linearMemberIds[0] && onUpdate({ memberLoads: [...memberLoads, {
          id: nextId('ML', memberLoads), loadCaseId: firstLoadCase, memberId: linearMemberIds[0],
          kind: 'uniform', direction: 'globalZ', magnitude: -1,
        }] })}
      >
        {memberLoads.map((load) => (
          <Card key={load.id} deleteLabel={labels.delete} onDelete={() => onUpdate({ memberLoads: removeItem(memberLoads, load.id) })}>
            <FieldGrid columns={4}>
              <ReadonlyField label={labels.id} value={load.id} />
              <SelectField label={labels.loadCase} value={load.loadCaseId} options={loadCaseIds} onChange={(loadCaseId) => updateMemberLoad(load.id, { loadCaseId })} />
              <SelectField label={labels.member} value={load.memberId} options={linearMemberIds} onChange={(memberId) => updateMemberLoad(load.id, { memberId })} />
              <SelectField
                label={labels.kind}
                value={load.kind}
                options={MEMBER_LOAD_KINDS}
                onChange={(value) => {
                  const kind = value as MemberLoad['kind'];
                  updateMemberLoad(load.id, {
                    kind,
                    endMagnitude: kind === 'trapezoidal' ? (load.endMagnitude ?? load.magnitude) : undefined,
                    position: kind === 'point' ? (load.position ?? 0.5) : undefined,
                  });
                }}
              />
              <SelectField label={labels.direction} value={load.direction} options={DIRECTIONS} onChange={(direction) => updateMemberLoad(load.id, { direction: direction as LoadDirection })} />
              <NumberField label={labels.magnitude} value={load.magnitude} onChange={(magnitude) => updateMemberLoad(load.id, { magnitude })} />
              {load.kind === 'trapezoidal' && (
                <NumberField label={labels.endMagnitude} value={load.endMagnitude ?? load.magnitude} onChange={(endMagnitude) => updateMemberLoad(load.id, { endMagnitude })} />
              )}
              {load.kind === 'point' && (
                <NumberField label={labels.ratio} value={load.position ?? 0.5} onChange={(position) => updateMemberLoad(load.id, { position: Math.max(0, Math.min(1, position)) })} />
              )}
            </FieldGrid>
          </Card>
        ))}
      </Collection>

      <Collection
        title={labels.areaLoads}
        count={areaLoads.length}
        addLabel={labels.add}
        disabled={!firstLoadCase || slabIds.length === 0}
        emptyLabel={labels.empty}
        onAdd={() => firstLoadCase && slabIds[0] && onUpdate({ areaLoads: [...areaLoads, {
          id: nextId('AL', areaLoads), loadCaseId: firstLoadCase, memberId: slabIds[0], direction: 'globalZ', magnitude: -1,
        }] })}
      >
        {areaLoads.map((load) => (
          <Card key={load.id} deleteLabel={labels.delete} onDelete={() => onUpdate({ areaLoads: removeItem(areaLoads, load.id) })}>
            <FieldGrid>
              <ReadonlyField label={labels.id} value={load.id} />
              <SelectField label={labels.loadCase} value={load.loadCaseId} options={loadCaseIds} onChange={(loadCaseId) => updateAreaLoad(load.id, { loadCaseId })} />
              <SelectField label={labels.member} value={load.memberId} options={slabIds} onChange={(memberId) => updateAreaLoad(load.id, { memberId })} />
              <SelectField label={labels.direction} value={load.direction} options={DIRECTIONS} onChange={(direction) => updateAreaLoad(load.id, { direction: direction as LoadDirection })} />
              <NumberField label={`${labels.magnitude} (kN/m²)`} value={load.magnitude} onChange={(magnitude) => updateAreaLoad(load.id, { magnitude })} />
            </FieldGrid>
          </Card>
        ))}
      </Collection>

      <Collection
        title={labels.combinations}
        count={combinations.length}
        addLabel={labels.add}
        disabled={!firstLoadCase}
        emptyLabel={labels.empty}
        onAdd={() => firstLoadCase && onUpdate({ loadCombinations: [...combinations, {
          id: nextId('COMB', combinations), name: nextId('Combination', combinations), type: 'linear',
          factors: [{ loadCaseId: firstLoadCase, factor: 1 }],
        }] })}
      >
        {combinations.map((combination) => (
          <Card key={combination.id} deleteLabel={labels.delete} onDelete={() => onUpdate({ loadCombinations: removeItem(combinations, combination.id) })}>
            <FieldGrid columns={3}>
              <ReadonlyField label={labels.id} value={combination.id} />
              <TextField label={labels.name} value={combination.name} onChange={(name) => updateCombination(combination.id, { name })} />
              <SelectField label={labels.type} value={combination.type} options={COMBINATION_TYPES} onChange={(type) => updateCombination(combination.id, { type: type as LoadCombination['type'] })} />
            </FieldGrid>
            {combination.factors.map((factor, index) => (
              <div key={`${combination.id}:${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <SelectField label={labels.loadCase} value={factor.loadCaseId} options={loadCaseIds.filter((loadCaseId) => loadCaseId === factor.loadCaseId || !combination.factors.some((item, itemIndex) => itemIndex !== index && item.loadCaseId === loadCaseId))} onChange={(loadCaseId) => {
                  const factors = combination.factors.map((item, itemIndex) => itemIndex === index ? { ...item, loadCaseId } : item);
                  updateCombination(combination.id, { factors });
                }} />
                <NumberField label={labels.factor} value={factor.factor} onChange={(value) => {
                  const factors = combination.factors.map((item, itemIndex) => itemIndex === index ? { ...item, factor: value } : item);
                  updateCombination(combination.id, { factors });
                }} />
                <button
                  className="toolbar-btn"
                  disabled={combination.factors.length <= 1}
                  onClick={() => updateCombination(combination.id, { factors: combination.factors.filter((_, itemIndex) => itemIndex !== index) })}
                >
                  {labels.delete}
                </button>
              </div>
            ))}
            <button
              className="toolbar-btn"
              disabled={!loadCaseIds.some((loadCaseId) => !combination.factors.some((factor) => factor.loadCaseId === loadCaseId))}
              onClick={() => {
                const loadCaseId = loadCaseIds.find((candidate) => !combination.factors.some((factor) => factor.loadCaseId === candidate));
                if (loadCaseId) updateCombination(combination.id, { factors: [...combination.factors, { loadCaseId, factor: 1 }] });
              }}
            >
              {labels.addFactor}
            </button>
          </Card>
        ))}
      </Collection>

      <Collection
        title={labels.masses}
        count={masses.length}
        addLabel={labels.add}
        disabled={!firstAnalysisNode}
        emptyLabel={labels.empty}
        onAdd={() => firstAnalysisNode && onUpdate({ masses: [...masses, {
          id: nextId('MASS', masses), storyId: firstAnalysisNode.storyId, position: firstAnalysisNode.position,
          mass: { x: 1, y: 1, z: 1 }, rotationalMass: { x: 0, y: 0, z: 0 },
        }] })}
      >
        {masses.map((mass) => (
          <Card key={mass.id} deleteLabel={labels.delete} onDelete={() => onUpdate({ masses: removeItem(masses, mass.id) })}>
            <FieldGrid>
              <ReadonlyField label={labels.id} value={mass.id} />
              <SelectField label={labels.story} value={mass.storyId} options={storyIdsWithNodes} onChange={(storyId) => {
                const node = analysisNodeByKey.get(nodeKeysForStory(storyId)[0]);
                if (node) updateMass(mass.id, { storyId, position: node.position });
              }} />
              <SelectField label={labels.connectedNode} value={nodeKeyFor(mass.storyId, mass.position)} options={nodeKeysForStory(mass.storyId)} onChange={(key) => {
                const node = analysisNodeByKey.get(key);
                if (node) updateMass(mass.id, { position: node.position });
              }} />
              <ReadonlyField label="X / Y / Z (mm)" value={`${mass.position.x} / ${mass.position.y} / ${mass.position.z}`} />
              <NumberField label={`${labels.mass} X`} value={mass.mass.x} onChange={(x) => updateMass(mass.id, { mass: { ...mass.mass, x: Math.max(0, x) } })} />
              <NumberField label={`${labels.mass} Y`} value={mass.mass.y} onChange={(y) => updateMass(mass.id, { mass: { ...mass.mass, y: Math.max(0, y) } })} />
              <NumberField label={`${labels.mass} Z`} value={mass.mass.z} onChange={(z) => updateMass(mass.id, { mass: { ...mass.mass, z: Math.max(0, z) } })} />
              <NumberField label={`${labels.rotationalMass} X`} value={mass.rotationalMass?.x ?? 0} onChange={(x) => updateMass(mass.id, { rotationalMass: { x: Math.max(0, x), y: mass.rotationalMass?.y ?? 0, z: mass.rotationalMass?.z ?? 0 } })} />
              <NumberField label={`${labels.rotationalMass} Y`} value={mass.rotationalMass?.y ?? 0} onChange={(y) => updateMass(mass.id, { rotationalMass: { x: mass.rotationalMass?.x ?? 0, y: Math.max(0, y), z: mass.rotationalMass?.z ?? 0 } })} />
              <NumberField label={`${labels.rotationalMass} Z`} value={mass.rotationalMass?.z ?? 0} onChange={(z) => updateMass(mass.id, { rotationalMass: { x: mass.rotationalMass?.x ?? 0, y: mass.rotationalMass?.y ?? 0, z: Math.max(0, z) } })} />
            </FieldGrid>
          </Card>
        ))}
      </Collection>

      <Collection
        title={labels.diaphragms}
        count={diaphragms.length}
        addLabel={labels.add}
        disabled={!firstStory}
        emptyLabel={labels.empty}
        onAdd={() => firstStory && onUpdate({ diaphragms: [...diaphragms, {
          id: nextId('DIA', diaphragms), storyId: firstStory.id, type: 'rigid',
          memberIds: data.members.filter((member) => member.story === firstStory.id && member.type === 'slab').map((member) => member.id),
          masterPosition: { x: 0, y: 0, z: storyZ },
        }] })}
      >
        {diaphragms.map((diaphragm) => {
          const storyMemberIds = data.members.filter((member) => member.story === diaphragm.storyId).map((member) => member.id);
          return (
            <Card key={diaphragm.id} deleteLabel={labels.delete} onDelete={() => onUpdate({ diaphragms: removeItem(diaphragms, diaphragm.id) })}>
              <FieldGrid>
                <ReadonlyField label={labels.id} value={diaphragm.id} />
                <SelectField label={labels.story} value={diaphragm.storyId} options={storyIds} onChange={(storyId) => updateDiaphragm(diaphragm.id, { storyId, memberIds: [] })} />
                <SelectField label={labels.type} value={diaphragm.type} options={DIAPHRAGM_TYPES} onChange={(type) => updateDiaphragm(diaphragm.id, { type: type as Diaphragm['type'] })} />
              </FieldGrid>
              <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                {labels.members}
                <select
                  className="prop-select"
                  multiple
                  size={Math.min(Math.max(storyMemberIds.length, 2), 6)}
                  value={diaphragm.memberIds ?? []}
                  onChange={(event) => updateDiaphragm(diaphragm.id, { memberIds: Array.from(event.currentTarget.selectedOptions, (option) => option.value) })}
                >
                  {storyMemberIds.map((memberId) => <option key={memberId} value={memberId}>{memberId}</option>)}
                </select>
              </label>
              <FieldGrid columns={3}>
                <NumberField label={`${labels.master} X (mm)`} value={diaphragm.masterPosition?.x ?? 0} onChange={(x) => updateDiaphragm(diaphragm.id, { masterPosition: { x, y: diaphragm.masterPosition?.y ?? 0, z: diaphragm.masterPosition?.z ?? 0 } })} />
                <NumberField label={`${labels.master} Y (mm)`} value={diaphragm.masterPosition?.y ?? 0} onChange={(y) => updateDiaphragm(diaphragm.id, { masterPosition: { x: diaphragm.masterPosition?.x ?? 0, y, z: diaphragm.masterPosition?.z ?? 0 } })} />
                <NumberField label={`${labels.master} Z (mm)`} value={diaphragm.masterPosition?.z ?? 0} onChange={(z) => updateDiaphragm(diaphragm.id, { masterPosition: { x: diaphragm.masterPosition?.x ?? 0, y: diaphragm.masterPosition?.y ?? 0, z } })} />
              </FieldGrid>
            </Card>
          );
        })}
      </Collection>

      <section style={{ display: 'grid', gap: 7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h5 style={{ margin: 0, fontSize: 13 }}>{labels.results}</h5>
          {data.analysisResults && <button className="toolbar-btn" onClick={() => onUpdate({ analysisResults: undefined })}>{labels.clearResults}</button>}
        </div>
        {data.analysisResults ? (
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 12 }}>
            <span>{data.analysisResults.solver ?? data.analysisResults.source}</span>
            <span>{data.analysisResults.analysisType}</span>
            <span>{labels.nodes}: {data.analysisResults.nodeDisplacements?.length ?? 0}</span>
            <span>{labels.resultMembers}: {data.analysisResults.memberResults?.length ?? 0}</span>
            {(data.analysisResults.warnings?.length ?? 0) > 0 && <span style={{ color: 'var(--warning, #d97706)' }}>{labels.warnings}: {data.analysisResults.warnings!.length}</span>}
          </div>
        ) : (
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{labels.noResults}</span>
        )}
      </section>
    </section>
  );
}
