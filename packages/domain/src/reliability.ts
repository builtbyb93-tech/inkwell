export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonicalJson(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value) ?? 'null';
}
export type SearchCursor = { rank: number; kind: string; resultId: string; hash: string };
export function encodeSearchCursor(p: SearchCursor) {
  return btoa(JSON.stringify(p));
}
export function decodeSearchCursor(raw: string): SearchCursor | null {
  try {
    if (raw.length > 700) return null;
    const p = JSON.parse(atob(raw));
    if (
      !p ||
      typeof p !== 'object' ||
      Object.keys(p).length !== 4 ||
      !Number.isFinite(p.rank) ||
      p.rank < 0 ||
      !['PROJECT', 'STORY', 'IDEA', 'CANON', 'OVERRIDE', 'SCENE', 'GROUP'].includes(p.kind) ||
      typeof p.resultId !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(p.resultId) ||
      typeof p.hash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(p.hash)
    )
      return null;
    return p;
  } catch {
    return null;
  }
}
