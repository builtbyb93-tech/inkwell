import { z } from 'zod';
import { RichDocumentSchema, type RichDocument } from './rich-text';
const uuid = z.uuid();
const tagIds = z
  .array(uuid)
  .max(20)
  .refine((ids) => new Set(ids).size === ids.length);
export const IdeaInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    content: RichDocumentSchema,
    categoryId: uuid.nullable().default(null),
    tagIds: tagIds.default([]),
  })
  .strict();
export const IdeaPatch = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    content: RichDocumentSchema.optional(),
    categoryId: uuid.nullable().optional(),
    tagIds: tagIds.optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const TaxonomyInput = z.object({ name: z.string().trim().min(1).max(50) }).strict();
export const IdeaLinkInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('STORY'), projectId: uuid, storyId: uuid }).strict(),
  z.object({ kind: z.literal('SCENE'), projectId: uuid, storyId: uuid, sceneId: uuid }).strict(),
]);
export const IdeaConversionInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('STORY'), projectId: uuid }).strict(),
  z.object({ kind: z.literal('CHARACTER'), projectId: uuid }).strict(),
  z.object({ kind: z.literal('SCENE'), projectId: uuid, storyId: uuid }).strict(),
]);
export const IdeaListQuery = z
  .object({
    q: z.string().trim().max(200).default(''),
    categoryId: uuid.optional(),
    tagIds: z.string().max(750).optional(),
    storyId: uuid.optional(),
    sceneId: uuid.optional(),
    archived: z.enum(['true', 'false']).default('false'),
    cursor: z.string().max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export const TaxonomyQuery = z
  .object({
    q: z.string().trim().max(50).default(''),
    cursor: z.string().max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(50),
  })
  .strict();
export type TaxonomyRecord = { id: string; name: string; version: number; createdAt: string };
export type IdeaRecord = {
  id: string;
  title: string;
  content: RichDocument;
  contentSchemaVersion: number;
  version: number;
  category: TaxonomyRecord | null;
  tags: TaxonomyRecord[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  counts: { stories: number; scenes: number; conversions: number };
};
export type IdeaSummary = Omit<IdeaRecord, 'content'> & { preview: string };
export type IdeaLinkRecord = {
  id: string;
  kind: 'STORY' | 'SCENE';
  projectId: string;
  storyId: string;
  sceneId?: string;
  title: string;
  archived: boolean;
  converted: boolean;
  createdAt: string;
};
export type IdeaConversionRecord = {
  id: string;
  kind: 'STORY' | 'CHARACTER' | 'SCENE';
  projectId: string;
  parentStoryId: string | null;
  targetStoryId: string | null;
  targetCharacterId: string | null;
  targetSceneId: string | null;
  sourceVersion: number;
  sourceContentSchemaVersion: number;
  titleSnapshot: string;
  createdAt: string;
};
export type ConversionResult = {
  conversion: IdeaConversionRecord;
  ideaVersion: number;
  replayed: boolean;
};
export type TargetRecord = {
  id: string;
  kind: 'CHARACTER' | 'SCENE';
  projectId: string;
  storyId?: string;
  title: string;
  content: RichDocument;
  contentSchemaVersion: number;
  version: number;
  archivedAt: string | null;
  position?: number;
  sources: { id: string; title: string; archived: boolean }[];
};
