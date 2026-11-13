import { z } from 'zod';
import { RichDocumentSchema, type RichDocument } from './rich-text';
export const SceneStatus = z.enum(['PLANNED', 'DRAFT', 'REVIEW', 'COMPLETE']);
export type SceneStatus = z.infer<typeof SceneStatus>;
export const PlotGroupInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().max(2000).default(''),
    parentId: z.uuid().nullable().default(null),
  })
  .strict();
export const PlotGroupPatch = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    parentId: z.uuid().nullable().optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const SceneInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    content: RichDocumentSchema,
    status: SceneStatus.default('PLANNED'),
    groupId: z.uuid().nullable().default(null),
  })
  .strict();
export const ScenePatch = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    content: RichDocumentSchema.optional(),
    status: SceneStatus.optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const SceneMove = z
  .object({
    beforeId: z.uuid().nullable().optional(),
    groupId: z.uuid().nullable().optional(),
    direction: z.enum(['EARLIER', 'LATER']).optional(),
  })
  .strict()
  .refine((v) =>
    v.direction !== undefined
      ? v.beforeId === undefined && v.groupId === undefined
      : v.beforeId !== undefined || v.groupId !== undefined,
  );
export const PlotQuery = z
  .object({
    cursor: z.string().max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    archived: z.enum(['true', 'false']).default('false'),
    groupId: z.union([z.uuid(), z.literal('ungrouped')]).optional(),
  })
  .strict();
export const SceneCanonInput = z
  .object({ kind: z.enum(['CHARACTER', 'LOCATION']), canonId: z.uuid() })
  .strict();
export type PlotGroupRecord = {
  id: string;
  title: string;
  description: string;
  parentId: string | null;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type SceneRecord = {
  id: string;
  projectId: string;
  storyId: string;
  title: string;
  content: RichDocument;
  contentSchemaVersion: number;
  status: SceneStatus;
  position: number;
  groupId: string | null;
  group: Pick<PlotGroupRecord, 'id' | 'title' | 'archivedAt'> | null;
  duplicatedFromId: string | null;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type SceneCard = Omit<
  SceneRecord,
  'content' | 'contentSchemaVersion' | 'updatedAt' | 'group'
> & {
  excerpt: string;
  groupTitle: string | null;
  counts: { characters: number; locations: number; ideas: number };
};
export type PlotPage = {
  items: SceneCard[];
  nextCursor: string | null;
  sequenceVersion: number;
  storyTitle: string;
  groups: PlotGroupRecord[];
  groupCursor: string | null;
};
export type SceneCanonReference = {
  id: string;
  kind: 'CHARACTER' | 'LOCATION';
  canonId: string;
  name: string;
  archived: boolean;
  createdAt: string;
};
export type SceneIdeaReference = {
  id: string;
  ideaId: string;
  title: string;
  ideaVersion: number;
  archived: boolean;
  converted: boolean;
  createdAt: string;
};
export type CanonSceneReference = {
  id: string;
  sceneId: string;
  title: string;
  storyId: string;
  storyTitle: string;
  archived: boolean;
  createdAt: string;
};
