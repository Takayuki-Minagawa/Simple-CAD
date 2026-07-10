import type { ProjectData } from './structural/types';
import { deepClone } from '@/libs/clone';

export function generateProjectId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `proj-${uuid}`;
  return `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Create an independent working copy without reusing persistence identity. */
export function instantiateProject(source: ProjectData): ProjectData {
  const copy = deepClone(source);
  copy.project.id = generateProjectId();
  return copy;
}
