import Ajv2020 from 'ajv/dist/2020';
import type { ValidationError } from '@/domain/validation';
import analysisSchema from '@/schemas/structuralAnalysis.schema.json';
import type { StructuralAnalysisModel } from './structuralAnalysisJson';

const ajv = new Ajv2020({ allErrors: true });
const validateAnalysisSchema = ajv.compile(analysisSchema);

/**
 * Validate the structural-analysis JSON with the JSON Schema plus
 * reference-integrity checks that schema alone cannot express.
 */
export function validateStructuralAnalysisModel(
  value: unknown,
  expectedSchema: string,
): ValidationError[] {
  if (isRecord(value) && value.schema !== expectedSchema) {
    return [
      {
        level: 'error',
        message: `Unsupported structural analysis schema: ${String(value.schema)}`,
        path: '/schema',
      },
    ];
  }

  const valid = validateAnalysisSchema(value);
  if (!valid) {
    return (validateAnalysisSchema.errors ?? []).map((error) => ({
      level: 'error' as const,
      message: `Schema: ${error.instancePath || '/'} ${error.message ?? 'unknown error'}`,
      path: error.instancePath || undefined,
    }));
  }

  const model = value as unknown as StructuralAnalysisModel;
  const errors: ValidationError[] = [];
  const nodeIds = new Set(model.nodes.map((node) => node.id));
  const nodeById = new Map(model.nodes.map((node) => [node.id, node] as const));
  const storyIds = new Set(model.stories.map((story) => story.id));
  const sectionIds = new Set(model.sections.map((section) => section.id));
  const materialIds = new Set(model.materials.map((material) => material.id));
  const linearMemberIds = new Set(model.linearMembers.map((member) => member.id));
  const areaMemberIds = new Set(model.areaMembers.map((member) => member.id));
  const memberIds = new Set([...linearMemberIds, ...areaMemberIds]);
  const loadCaseIds = new Set((model.loadCases ?? []).map((loadCase) => loadCase.id));
  const combinationIds = new Set(
    (model.loadCombinations ?? []).map((combination) => combination.id),
  );

  checkUnique(model.nodes.map((node) => node.id), 'nodes', errors);
  checkUnique(model.stories.map((story) => story.id), 'stories', errors);
  checkUnique(model.sections.map((section) => section.id), 'sections', errors);
  checkUnique(model.materials.map((material) => material.id), 'materials', errors);
  checkUnique(model.linearMembers.map((member) => member.id), 'linearMembers', errors);
  checkUnique(model.areaMembers.map((member) => member.id), 'areaMembers', errors);
  checkUnique(model.openings.map((opening) => opening.id), 'openings', errors);
  checkUnique((model.loadCases ?? []).map((item) => item.id), 'loadCases', errors);
  checkUnique((model.supports ?? []).map((item) => item.id), 'supports', errors);
  checkUnique((model.nodalLoads ?? []).map((item) => item.id), 'nodalLoads', errors);
  checkUnique((model.memberLoads ?? []).map((item) => item.id), 'memberLoads', errors);
  checkUnique((model.areaLoads ?? []).map((item) => item.id), 'areaLoads', errors);
  checkUnique((model.loadCombinations ?? []).map((item) => item.id), 'loadCombinations', errors);
  checkUnique((model.masses ?? []).map((item) => item.id), 'masses', errors);
  checkUnique((model.diaphragms ?? []).map((item) => item.id), 'diaphragms', errors);

  for (const node of model.nodes) {
    if (node.storyId && !storyIds.has(node.storyId)) {
      addMissing(errors, `node ${node.id}`, 'story', node.storyId, '/nodes');
    }
  }

  for (const member of model.linearMembers) {
    if (!nodeIds.has(member.startNodeId)) {
      errors.push({
        level: 'error',
        message: `linearMember ${member.id} references missing startNode ${member.startNodeId}`,
        path: '/linearMembers',
      });
    }
    if (!nodeIds.has(member.endNodeId)) {
      errors.push({
        level: 'error',
        message: `linearMember ${member.id} references missing endNode ${member.endNodeId}`,
        path: '/linearMembers',
      });
    }
    if (member.startNodeId === member.endNodeId) {
      errors.push({
        level: 'error',
        message: `linearMember ${member.id} has identical start/end node ${member.startNodeId}`,
        path: '/linearMembers',
      });
    }
    const startNode = nodeById.get(member.startNodeId);
    const endNode = nodeById.get(member.endNodeId);
    if (startNode && endNode && member.rigidZones) {
      const length = Math.hypot(
        endNode.x - startNode.x,
        endNode.y - startNode.y,
        endNode.z - startNode.z,
      );
      const rigidLength = (member.rigidZones.start ?? 0) + (member.rigidZones.end ?? 0);
      if (rigidLength >= length) {
        errors.push({
          level: 'error',
          message: `linearMember ${member.id} rigid-zone length ${rigidLength} is not shorter than member length ${length}`,
          path: '/linearMembers',
        });
      }
    }
    validateMemberReferences(member, storyIds, sectionIds, materialIds, errors, '/linearMembers');
  }

  for (const member of model.areaMembers) {
    validateMemberReferences(member, storyIds, sectionIds, materialIds, errors, '/areaMembers');
    const uniqueNodes = new Set(member.nodeIds);
    if (uniqueNodes.size < 3) {
      errors.push({
        level: 'error',
        message: `areaMember ${member.id} requires at least three unique nodes`,
        path: '/areaMembers',
      });
    }
    for (const nodeId of member.nodeIds) {
      if (!nodeIds.has(nodeId)) addMissing(errors, `areaMember ${member.id}`, 'node', nodeId, '/areaMembers');
    }
  }

  for (const opening of model.openings) {
    if (!memberIds.has(opening.memberId)) {
      addMissing(errors, `opening ${opening.id}`, 'member', opening.memberId, '/openings');
    }
  }

  for (const support of model.supports ?? []) {
    checkStoryAndNode(support.id, support.storyId, support.nodeId, storyIds, nodeIds, 'support', '/supports', errors);
  }

  for (const load of model.nodalLoads ?? []) {
    checkStoryAndNode(load.id, load.storyId, load.nodeId, storyIds, nodeIds, 'nodalLoad', '/nodalLoads', errors);
    checkLoadCase(load.id, load.loadCaseId, loadCaseIds, 'nodalLoad', '/nodalLoads', errors);
  }

  for (const load of model.memberLoads ?? []) {
    if (!linearMemberIds.has(load.memberId)) {
      addMissing(errors, `memberLoad ${load.id}`, 'linear member', load.memberId, '/memberLoads');
    }
    checkLoadCase(load.id, load.loadCaseId, loadCaseIds, 'memberLoad', '/memberLoads', errors);
  }

  for (const load of model.areaLoads ?? []) {
    if (!areaMemberIds.has(load.memberId)) {
      addMissing(errors, `areaLoad ${load.id}`, 'area member', load.memberId, '/areaLoads');
    }
    checkLoadCase(load.id, load.loadCaseId, loadCaseIds, 'areaLoad', '/areaLoads', errors);
  }

  for (const combination of model.loadCombinations ?? []) {
    const caseIds = combination.factors.map((factor) => factor.loadCaseId);
    if (new Set(caseIds).size !== caseIds.length) {
      errors.push({
        level: 'error',
        message: `loadCombination ${combination.id} contains duplicate load-case factors`,
        path: '/loadCombinations',
      });
    }
    for (const factor of combination.factors) {
      checkLoadCase(
        combination.id,
        factor.loadCaseId,
        loadCaseIds,
        'loadCombination',
        '/loadCombinations',
        errors,
      );
    }
  }

  for (const mass of model.masses ?? []) {
    checkStoryAndNode(mass.id, mass.storyId, mass.nodeId, storyIds, nodeIds, 'mass', '/masses', errors);
  }

  for (const diaphragm of model.diaphragms ?? []) {
    if (!storyIds.has(diaphragm.storyId)) {
      addMissing(errors, `diaphragm ${diaphragm.id}`, 'story', diaphragm.storyId, '/diaphragms');
    }
    if (diaphragm.masterNodeId && !nodeIds.has(diaphragm.masterNodeId)) {
      addMissing(errors, `diaphragm ${diaphragm.id}`, 'master node', diaphragm.masterNodeId, '/diaphragms');
    }
    for (const memberId of diaphragm.memberIds ?? []) {
      if (!memberIds.has(memberId)) {
        addMissing(errors, `diaphragm ${diaphragm.id}`, 'member', memberId, '/diaphragms');
      }
    }
  }

  if (model.analysisResults?.caseId && !loadCaseIds.has(model.analysisResults.caseId)) {
    addMissing(errors, 'analysisResults', 'load case', model.analysisResults.caseId, '/analysisResults');
  }
  if (
    model.analysisResults?.combinationId &&
    !combinationIds.has(model.analysisResults.combinationId)
  ) {
    addMissing(
      errors,
      'analysisResults',
      'load combination',
      model.analysisResults.combinationId,
      '/analysisResults',
    );
  }
  for (const result of model.analysisResults?.memberResults ?? []) {
    if (!memberIds.has(result.memberId)) {
      addMissing(errors, 'analysis member result', 'member', result.memberId, '/analysisResults/memberResults');
    }
  }

  return errors;
}

function validateMemberReferences(
  member: { id: string; storyId: string; sectionId: string; materialId: string },
  storyIds: Set<string>,
  sectionIds: Set<string>,
  materialIds: Set<string>,
  errors: ValidationError[],
  path: string,
) {
  if (!storyIds.has(member.storyId)) addMissing(errors, `member ${member.id}`, 'story', member.storyId, path);
  if (!sectionIds.has(member.sectionId)) addMissing(errors, `member ${member.id}`, 'section', member.sectionId, path);
  if (!materialIds.has(member.materialId)) addMissing(errors, `member ${member.id}`, 'material', member.materialId, path);
}

function checkStoryAndNode(
  id: string,
  storyId: string,
  nodeId: string,
  storyIds: Set<string>,
  nodeIds: Set<string>,
  kind: string,
  path: string,
  errors: ValidationError[],
) {
  if (!storyIds.has(storyId)) addMissing(errors, `${kind} ${id}`, 'story', storyId, path);
  if (!nodeIds.has(nodeId)) addMissing(errors, `${kind} ${id}`, 'node', nodeId, path);
}

function checkLoadCase(
  id: string,
  loadCaseId: string,
  loadCaseIds: Set<string>,
  kind: string,
  path: string,
  errors: ValidationError[],
) {
  if (!loadCaseIds.has(loadCaseId)) {
    addMissing(errors, `${kind} ${id}`, 'load case', loadCaseId, path);
  }
}

function addMissing(
  errors: ValidationError[],
  owner: string,
  targetKind: string,
  targetId: string,
  path: string,
) {
  errors.push({
    level: 'error',
    message: `${owner} references missing ${targetKind} ${targetId}`,
    path,
  });
}

function checkUnique(ids: string[], collection: string, errors: ValidationError[]) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push({
        level: 'error',
        message: `${collection} contains duplicate id ${id}`,
        path: `/${collection}`,
      });
    }
    seen.add(id);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
