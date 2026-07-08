export function assignById<T extends { id: string }>(
  items: T[],
  id: string,
  updates: Partial<T>,
): boolean {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) return false;
  Object.assign(item, updates);
  return true;
}

export function removeById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}
