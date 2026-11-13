export type ReadinessProbe = () => Promise<void>;

/** No infrastructure details or exception messages cross this boundary. */
export async function assessReadiness(probe: ReadinessProbe): Promise<boolean> {
  try {
    await probe();
    return true;
  } catch {
    return false;
  }
}
export function expectedVersion(header: string | null): number | null {
  if (!header || !/^"[1-9][0-9]{0,8}"$/.test(header)) return null;
  return Number(header.slice(1, -1));
}

export function encodeCursor(record: { id: string; createdAt: Date }): string {
  return btoa(JSON.stringify({ id: record.id, createdAt: record.createdAt.toISOString() }));
}

export function decodeCursor(value: string): { id: string; createdAt: Date } | null {
  try {
    if (value.length > 512) return null;
    const item = JSON.parse(atob(value)) as Record<string, unknown>;
    if (
      typeof item.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id) ||
      typeof item.createdAt !== 'string'
    )
      return null;
    const date = new Date(item.createdAt);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== item.createdAt) return null;
    return { id: item.id, createdAt: date };
  } catch {
    return null;
  }
}

export function taxonomyNameKey(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}
export function ideaTitle(text: string): string {
  return text.trim().split(/\r?\n/)[0]?.slice(0, 120) || 'Untitled idea';
}
