export function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function nowIsoString(now = new Date()): string {
  return now.toISOString();
}
