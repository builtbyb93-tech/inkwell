export function encodePlotCursor(position: number, sequenceVersion: number) {
  return btoa(JSON.stringify({ position, sequenceVersion }));
}
export function decodePlotCursor(
  raw: string,
): { position: number; sequenceVersion: number } | null {
  try {
    if (raw.length > 512) return null;
    const p = JSON.parse(atob(raw));
    return p &&
      Number.isSafeInteger(p.position) &&
      p.position >= 0 &&
      Number.isSafeInteger(p.sequenceVersion) &&
      p.sequenceVersion >= 0 &&
      Object.keys(p).length === 2
      ? p
      : null;
  } catch {
    return null;
  }
}
/** One sequence includes archived rows. Grouping is an independent assignment. */
export function moveSceneOrder(
  rows: readonly { id: string; archived: boolean }[],
  sourceId: string,
  input: { beforeId?: string | null | undefined; direction?: 'EARLIER' | 'LATER' | undefined },
): string[] {
  const source = rows.findIndex((r) => r.id === sourceId);
  if (source < 0 || rows[source]!.archived) throw new Error('Invalid scene');
  const ids = rows.map((r) => r.id);
  let target: number;
  if (input.direction) {
    const step = input.direction === 'EARLIER' ? -1 : 1;
    let other = source + step;
    while (other >= 0 && other < rows.length && rows[other]!.archived) other += step;
    if (other < 0 || other >= rows.length) return ids;
    target = input.direction === 'EARLIER' ? other : other + 1;
  } else if (input.beforeId === undefined || input.beforeId === sourceId) return ids;
  else if (input.beforeId === null) target = rows.length;
  else {
    target = rows.findIndex((r) => r.id === input.beforeId);
    if (target < 0 || rows[target]!.archived) throw new Error('Invalid destination');
  }
  ids.splice(source, 1);
  ids.splice(target - (source < target ? 1 : 0), 0, sourceId);
  return ids;
}
