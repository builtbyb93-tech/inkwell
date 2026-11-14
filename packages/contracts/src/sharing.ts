import { z } from 'zod';
import { RichDocumentSchema } from './rich-text';
import { CanonKind, RelationshipKind } from './canon';
import { SceneStatus } from './plot';
export const snapshotMaxRecords = 1000,
  snapshotMaxBytes = 8 * 1024 * 1024;
const ids = z
  .array(z.uuid())
  .max(snapshotMaxRecords)
  .refine((a) => new Set(a).size === a.length);
export const SnapshotInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    storyId: z.uuid().optional(),
    selection: z
      .object({
        project: z.boolean(),
        storyIds: ids,
        ideaIds: ids,
        canonIds: ids,
        sceneIds: ids,
        groupIds: ids,
        relationships: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .refine((v) => {
    const n =
      Number(v.selection.project) +
      v.selection.storyIds.length +
      v.selection.ideaIds.length +
      v.selection.canonIds.length +
      v.selection.sceneIds.length +
      v.selection.groupIds.length;
    return n > 0 && n <= snapshotMaxRecords;
  });
export type SnapshotInput = z.infer<typeof SnapshotInput>;
const base = { id: z.uuid(), title: z.string().max(120) },
  storyRef = z.uuid().nullable();
export const SnapshotRecord = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('PROJECT'), text: z.string().max(10000) }).strict(),
  z
    .object({
      ...base,
      kind: z.literal('STORY'),
      text: z.string().max(10000),
      format: z.string().max(80),
    })
    .strict(),
  z.object({ ...base, kind: z.literal('IDEA'), content: RichDocumentSchema }).strict(),
  z
    .object({
      ...base,
      kind: z.literal('CANON'),
      canonKind: CanonKind,
      storyId: storyRef,
      content: RichDocumentSchema,
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal('GROUP'),
      storyId: storyRef,
      parentId: storyRef,
      text: z.string().max(2000),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal('SCENE'),
      storyId: storyRef,
      groupId: storyRef,
      position: z.number().int().min(0),
      status: SceneStatus,
      content: RichDocumentSchema,
    })
    .strict(),
]);
export type SnapshotRecord = z.infer<typeof SnapshotRecord>;
export const SnapshotEdge = z
  .object({
    fromId: z.uuid(),
    toId: z.uuid(),
    kind: z.union([
      RelationshipKind,
      z.enum(['STORY_IDEA', 'SCENE_IDEA', 'SCENE_CHARACTER', 'SCENE_LOCATION']),
    ]),
    label: z.string().max(80),
  })
  .strict();
export const SnapshotDocument = z
  .object({
    format: z.literal('inkwell.snapshot'),
    version: z.literal(1),
    title: z.string().trim().min(1).max(120),
    createdAt: z.iso.datetime(),
    records: z.array(SnapshotRecord).min(1).max(snapshotMaxRecords),
    relationships: z.array(SnapshotEdge).max(10000),
    assets: z.array(z.never()).max(0),
  })
  .strict();
export type SnapshotDocument = z.infer<typeof SnapshotDocument>;
export const ShareLinkInput = z
  .object({ expiresAt: z.iso.datetime({ offset: true }), allowDownload: z.boolean() })
  .strict();
export const ShareAccessInput = z
  .object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
  .strict();
export type ShareLinkRecord = {
  id: string;
  expiresAt: string;
  allowDownload: boolean;
  revokedAt: string | null;
  version: number;
  createdAt: string;
};
export type SnapshotSummary = {
  id: string;
  title: string;
  recordCount: number;
  createdAt: string;
  version: 1;
};
export type SnapshotPreview = { snapshot: SnapshotSummary; document: SnapshotDocument };
export type SharedSnapshot = {
  document: SnapshotDocument;
  expiresAt: string;
  allowDownload: boolean;
};
export type SnapshotOption = {
  id: string;
  kind: 'PROJECT' | 'STORY' | 'IDEA' | 'CANON' | 'SCENE' | 'GROUP';
  title: string;
  archived: boolean;
  storyId: string | null;
  canonKind?: z.infer<typeof CanonKind>;
};
export const SnapshotOptionsQuery = z
  .object({
    kind: z.enum(['STORY', 'IDEA', 'CANON', 'SCENE', 'GROUP']),
    storyId: z.uuid().optional(),
    archive: z.enum(['active', 'archived']).default('active'),
    cursor: z.string().max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(30),
  })
  .strict();
