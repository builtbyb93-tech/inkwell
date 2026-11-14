import { z } from 'zod';
import { CanonKind, CanonPatch, OverrideInput } from './canon';
import { ScenePatch, PlotGroupPatch } from './plot';
import { IdeaPatch } from './ideas';
export const SearchKind = z.enum([
  'PROJECT',
  'STORY',
  'IDEA',
  'CANON',
  'OVERRIDE',
  'SCENE',
  'GROUP',
]);
export type SearchKind = z.infer<typeof SearchKind>;
export const SearchQuery = z
  .object({
    q: z.string().trim().min(1).max(200),
    kinds: z.string().max(100).optional(),
    projectId: z.uuid().optional(),
    storyId: z.uuid().optional(),
    canonKind: CanonKind.optional(),
    archive: z.enum(['active', 'archived', 'all']).default('active'),
    cursor: z.string().max(700).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()
  .refine((v) => !v.storyId || Boolean(v.projectId));
export type SearchResult = {
  id: string;
  resultId: string;
  kind: SearchKind;
  recordType: string | null;
  title: string;
  excerpt: string;
  projectId: string | null;
  storyId: string | null;
  archived: boolean;
  href: string;
};
export type SearchPage = { items: SearchResult[]; nextCursor: string | null };
const title = z.string().trim().min(1).max(120);
const project = z.object({ title, description: z.string().max(10000) }).strict(),
  story = z.object({ title, synopsis: z.string().max(10000), format: z.string().max(80) }).strict();
const common = {
  requestKey: z.uuid(),
  recordId: z.uuid(),
  version: z.number().int().min(0).max(999999999),
};
export const DraftSaveInput = z
  .discriminatedUnion('kind', [
    z.object({ ...common, kind: z.literal('PROJECT'), fields: project }).strict(),
    z.object({ ...common, kind: z.literal('STORY'), projectId: z.uuid(), fields: story }).strict(),
    z
      .object({
        ...common,
        kind: z.literal('IDEA'),
        fields: z
          .object(IdeaPatch.shape)
          .omit({ archived: true })
          .strict()
          .refine((v) => Object.keys(v).length > 0),
      })
      .strict(),
    z
      .object({
        ...common,
        kind: z.literal('CANON'),
        projectId: z.uuid(),
        storyId: z.uuid().optional(),
        fields: z
          .object(CanonPatch.shape)
          .omit({ archived: true })
          .strict()
          .refine((v) => Object.keys(v).length > 0),
      })
      .strict(),
    z
      .object({
        ...common,
        kind: z.literal('SCENE'),
        projectId: z.uuid(),
        storyId: z.uuid(),
        fields: z
          .object(ScenePatch.shape)
          .omit({ archived: true })
          .strict()
          .refine((v) => Object.keys(v).length > 0),
      })
      .strict(),
    z
      .object({
        ...common,
        kind: z.literal('GROUP'),
        projectId: z.uuid(),
        storyId: z.uuid(),
        fields: z
          .object(PlotGroupPatch.shape)
          .omit({ archived: true })
          .strict()
          .refine((v) => Object.keys(v).length > 0),
      })
      .strict(),
    z
      .object({
        ...common,
        kind: z.literal('OVERRIDE'),
        projectId: z.uuid(),
        storyId: z.uuid(),
        fields: OverrideInput,
      })
      .strict(),
  ])
  .refine((v) => v.version > 0 || v.kind === 'OVERRIDE');
export type DraftSaveInput = z.infer<typeof DraftSaveInput>;
export type DraftSaveAck = { version: number; replayed: boolean; requestKey: string };
export const recoveryDays = 7;
export const recoveryMaxBytes = 65536;
export const recoveryMaxRecords = 50;
