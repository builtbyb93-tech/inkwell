import { z } from 'zod';
import { RichDocumentSchema } from './rich-text';
import { CanonKind, CanonScope, RelationshipKind } from './canon';
import { SceneStatus } from './plot';
export const archiveMaxBytes = 8 * 1024 * 1024;
export const archiveMaxRecords = 10000;
const id = z.uuid(),
  version = z.number().int().min(1).max(999999999),
  timestamp = z.iso.datetime({ offset: true }),
  nullableId = id.nullable();
const identity = { id, createdAt: timestamp },
  editable = { ...identity, updatedAt: timestamp, version, archivedAt: timestamp.nullable() },
  rich = { content: RichDocumentSchema, contentSchemaVersion: z.literal(1) },
  title = z.string().trim().min(1).max(120);
export const ProjectArchive = z
  .object({
    format: z.literal('inkwell.project'),
    version: z.literal(1),
    exportedAt: timestamp,
    project: z.object({ ...editable, title, description: z.string().max(10000) }).strict(),
    stories: z
      .array(
        z
          .object({
            ...editable,
            title,
            synopsis: z.string().max(10000),
            format: z.string().max(80),
            sequenceVersion: z.number().int().min(0).max(999999999),
          })
          .strict(),
      )
      .max(archiveMaxRecords),
    canon: z
      .array(
        z
          .object({
            ...editable,
            ...rich,
            kind: CanonKind,
            scope: CanonScope,
            storyId: nullableId,
            name: title,
          })
          .strict(),
      )
      .max(archiveMaxRecords),
    overrides: z
      .array(
        z
          .object({
            ...identity,
            updatedAt: timestamp,
            version,
            storyId: id,
            canonId: id,
            hasName: z.boolean(),
            name: title.nullable(),
            hasContent: z.boolean(),
            content: RichDocumentSchema.nullable(),
            contentSchemaVersion: z.literal(1),
            baseVersion: version,
            baseName: title,
            baseContent: RichDocumentSchema,
            baseContentSchemaVersion: z.literal(1),
          })
          .strict(),
      )
      .max(archiveMaxRecords),
    groups: z
      .array(
        z
          .object({
            ...editable,
            storyId: id,
            parentId: nullableId,
            title,
            description: z.string().max(2000),
          })
          .strict(),
      )
      .max(archiveMaxRecords),
    scenes: z
      .array(
        z
          .object({
            ...editable,
            ...rich,
            storyId: id,
            groupId: nullableId,
            duplicatedFromId: nullableId,
            title,
            status: SceneStatus,
            position: z.number().int().min(0).max(2147483647),
          })
          .strict(),
      )
      .max(archiveMaxRecords),
    relationships: z
      .array(
        z
          .object({
            ...editable,
            storyId: nullableId,
            fromId: id,
            toId: id,
            kind: RelationshipKind,
            label: z.string().max(80),
          })
          .strict(),
      )
      .max(archiveMaxRecords),
    sceneCharacters: z
      .array(z.object({ ...identity, storyId: id, sceneId: id, canonId: id }).strict())
      .max(archiveMaxRecords),
    sceneLocations: z
      .array(z.object({ ...identity, storyId: id, sceneId: id, canonId: id }).strict())
      .max(archiveMaxRecords),
    categories: z
      .array(
        z
          .object({
            ...identity,
            updatedAt: timestamp,
            version,
            name: z.string().trim().min(1).max(50),
          })
          .strict(),
      )
      .max(archiveMaxRecords),
    tags: z
      .array(
        z
          .object({
            ...identity,
            updatedAt: timestamp,
            version,
            name: z.string().trim().min(1).max(50),
          })
          .strict(),
      )
      .max(archiveMaxRecords),
    ideas: z
      .array(
        z
          .object({
            ...editable,
            ...rich,
            title,
            categoryId: nullableId,
            tagIds: z.array(id).max(20),
          })
          .strict(),
      )
      .max(archiveMaxRecords),
    ideaStoryLinks: z
      .array(z.object({ ...identity, ideaId: id, storyId: id }).strict())
      .max(archiveMaxRecords),
    ideaSceneLinks: z
      .array(z.object({ ...identity, ideaId: id, storyId: id, sceneId: id }).strict())
      .max(archiveMaxRecords),
    conversions: z
      .array(
        z
          .object({
            ...identity,
            ideaId: id,
            kind: z.enum(['STORY', 'CHARACTER', 'SCENE']),
            parentStoryId: nullableId,
            targetStoryId: nullableId,
            targetCharacterId: nullableId,
            targetSceneId: nullableId,
            sourceVersion: version,
            sourceContentSchemaVersion: z.literal(1),
            titleSnapshot: title,
            contentSnapshot: RichDocumentSchema,
          })
          .strict(),
      )
      .max(archiveMaxRecords),
    assets: z.array(z.never()).max(0),
  })
  .strict();
export type ProjectArchive = z.infer<typeof ProjectArchive>;
export type ImportPreview = { title: string; counts: Record<string, number>; notes: string[] };
