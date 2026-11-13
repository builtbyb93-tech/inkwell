import { z } from 'zod';
import { RichDocumentSchema, type RichDocument } from './rich-text';
export const CanonKind = z.enum(['CHARACTER', 'LOCATION', 'LORE', 'EVENT', 'ORGANIZATION']);
export type CanonKind = z.infer<typeof CanonKind>;
export const CanonScope = z.enum(['SHARED', 'STORY']);
export const CanonInput = z
  .object({ kind: CanonKind, name: z.string().trim().min(1).max(120), content: RichDocumentSchema })
  .strict();
export const CanonPatch = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    content: RichDocumentSchema.optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const CanonQuery = z
  .object({
    storyId: z.uuid().optional(),
    kind: CanonKind.optional(),
    q: z.string().trim().max(120).default(''),
    archived: z.enum(['true', 'false']).default('false'),
    cursor: z.string().max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export const CanonContextQuery = z.object({ storyId: z.uuid().optional() }).strict();
const NameOverride = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('INHERIT') }).strict(),
  z.object({ mode: z.literal('CLEAR') }).strict(),
  z.object({ mode: z.literal('CUSTOM'), value: z.string().trim().min(1).max(120) }).strict(),
]);
const ContentOverride = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('INHERIT') }).strict(),
  z.object({ mode: z.literal('CLEAR') }).strict(),
  z.object({ mode: z.literal('CUSTOM'), value: RichDocumentSchema }).strict(),
]);
export const OverrideInput = z
  .object({
    baseVersion: z.number().int().positive().max(999999999),
    name: NameOverride,
    content: ContentOverride,
  })
  .strict();
export const OverrideReview = z
  .object({
    baseVersion: z.number().int().positive().max(999999999),
    name: z.enum(['KEEP', 'INHERIT']).optional(),
    content: z.enum(['KEEP', 'INHERIT']).optional(),
  })
  .strict();
export const RelationshipKind = z.enum([
  'RELATED',
  'KNOWS',
  'MEMBER_OF',
  'LOCATED_IN',
  'PART_OF',
  'PRECEDES',
]);
export type RelationshipKind = z.infer<typeof RelationshipKind>;
export const RelationshipInput = z
  .object({ toId: z.uuid(), kind: RelationshipKind, label: z.string().trim().max(80).default('') })
  .strict();
export const RelationshipPatch = z
  .object({ label: z.string().trim().max(80).optional(), archived: z.boolean().optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export type CanonRecord = {
  id: string;
  projectId: string;
  storyId: string | null;
  kind: CanonKind;
  scope: 'SHARED' | 'STORY';
  name: string;
  content: RichDocument;
  contentSchemaVersion: number;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  effective: { name: string; content: RichDocument };
  conflicts: ('name' | 'content')[];
  override: null | {
    version: number;
    baseVersion: number;
    baseName: string;
    baseContent: RichDocument;
    hasName: boolean;
    name: string | null;
    hasContent: boolean;
    content: RichDocument | null;
  };
};
export type CanonSummary = Pick<
  CanonRecord,
  | 'id'
  | 'projectId'
  | 'storyId'
  | 'kind'
  | 'scope'
  | 'name'
  | 'version'
  | 'archivedAt'
  | 'createdAt'
  | 'conflicts'
> & { overridden: boolean };
export type RelationshipRecord = {
  id: string;
  fromId: string;
  toId: string;
  kind: RelationshipKind;
  label: string;
  version: number;
  storyId: string | null;
  archivedAt: string | null;
  createdAt: string;
  other: { id: string; name: string; kind: CanonKind; archived: boolean };
  direction: 'OUTGOING' | 'INCOMING';
  editable: boolean;
};
