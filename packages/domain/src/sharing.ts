import { SnapshotDocument, snapshotMaxBytes } from '@inkwell/contracts';
export function validateSnapshotDocument(value: unknown): SnapshotDocument {
  const doc = SnapshotDocument.parse(value),
    ids = new Set(doc.records.map((r) => r.id));
  if (
    ids.size !== doc.records.length ||
    new TextEncoder().encode(JSON.stringify(doc)).byteLength > snapshotMaxBytes
  )
    throw new Error('Invalid snapshot.');
  const byId = new Map(doc.records.map((r) => [r.id, r]));
  for (const r of doc.records) {
    if ('storyId' in r && r.storyId && byId.get(r.storyId)?.kind !== 'STORY')
      throw new Error('Invalid snapshot.');
    if ('parentId' in r && r.parentId) {
      const parent = byId.get(r.parentId);
      if (parent?.kind !== 'GROUP' || parent.parentId || parent.storyId !== r.storyId)
        throw new Error('Invalid snapshot.');
    }
    if ('groupId' in r && r.groupId) {
      const group = byId.get(r.groupId);
      if (group?.kind !== 'GROUP' || group.storyId !== r.storyId)
        throw new Error('Invalid snapshot.');
    }
  }
  for (const edge of doc.relationships)
    if (!ids.has(edge.fromId) || !ids.has(edge.toId) || edge.fromId === edge.toId)
      throw new Error('Invalid snapshot.');
  return doc;
}
