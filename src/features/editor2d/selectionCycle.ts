import type { MouseEvent as ReactMouseEvent } from 'react';

export function uniqueCandidateIds(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function pickSelectionCandidate(candidateIds: string[], selectedIds: string[]): string | null {
  if (candidateIds.length === 0) return null;
  if (candidateIds.length === 1) return candidateIds[0];

  const activeId = selectedIds.length === 1 ? selectedIds[0] : null;
  const index = activeId ? candidateIds.indexOf(activeId) : -1;
  if (index === -1) return candidateIds[0];
  return candidateIds[(index + 1) % candidateIds.length];
}

export function getEventCandidateIds(e: ReactMouseEvent): string[] {
  const fromPoint = document.elementsFromPoint?.(e.clientX, e.clientY) ?? [];
  const ids = fromPoint.map((element) => element.closest('[data-id]')?.getAttribute('data-id'));
  const fallback = (e.target as Element | null)?.closest?.('[data-id]')?.getAttribute('data-id');
  return uniqueCandidateIds([...ids, fallback]);
}
