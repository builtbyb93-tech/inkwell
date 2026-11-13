export type CanonType = 'CHARACTER' | 'LOCATION' | 'LORE' | 'EVENT' | 'ORGANIZATION';
export function validCanonRelationship(kind: string, from: CanonType, to: CanonType) {
  switch (kind) {
    case 'RELATED':
      return true;
    case 'KNOWS':
      return from === 'CHARACTER' && to === 'CHARACTER';
    case 'MEMBER_OF':
      return (from === 'CHARACTER' || from === 'ORGANIZATION') && to === 'ORGANIZATION';
    case 'LOCATED_IN':
      return ['CHARACTER', 'EVENT', 'ORGANIZATION'].includes(from) && to === 'LOCATION';
    case 'PART_OF':
      return from === to && ['LOCATION', 'ORGANIZATION', 'EVENT', 'LORE'].includes(from);
    case 'PRECEDES':
      return from === 'EVENT' && to === 'EVENT';
    default:
      return false;
  }
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value) ?? 'null';
}
export function canonConflicts(
  base: { name: string; content: unknown },
  override: null | {
    hasName: boolean;
    hasContent: boolean;
    baseName: string;
    baseContent: unknown;
  },
): ('name' | 'content')[] {
  const fields: ('name' | 'content')[] = [];
  if (override?.hasName && override.baseName !== base.name) fields.push('name');
  if (override?.hasContent && canonical(override.baseContent) !== canonical(base.content))
    fields.push('content');
  return fields;
}
