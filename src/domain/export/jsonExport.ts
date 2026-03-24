import type { ProjectData } from '@/domain/structural/types';

export function exportProjectJson(data: ProjectData): string {
  return JSON.stringify(data, null, 2);
}
