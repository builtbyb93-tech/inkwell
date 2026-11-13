import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma } from '@inkwell/db';
import {
  IdeaConversionInput,
  Id,
  ListQuery,
  type AccountRecord,
  type IdeaConversionRecord,
  type ConversionResult,
} from '@inkwell/contracts';
import type { z } from 'zod';
import { database } from './database';
import { HttpError, notFound } from './http';
import { id } from './records';
import {
  claimIdea,
  requireIdea,
  jsonDocument,
  prismaPosition,
  pageResult,
  readDocument,
} from './ideas';
import { lockProject, seedStory, seedCharacter, appendSceneSeed } from './idea-targets';
const selection = {
  id: true,
  kind: true,
  projectId: true,
  parentStoryId: true,
  targetStoryId: true,
  targetCharacterId: true,
  targetSceneId: true,
  sourceVersion: true,
  sourceContentSchemaVersion: true,
  titleSnapshot: true,
  createdAt: true,
} as const;
type Conversion = Prisma.IdeaConversionGetPayload<{ select: typeof selection }>;
export function conversionDto(row: Conversion): IdeaConversionRecord {
  return {
    id: row.id,
    kind: row.kind,
    projectId: row.projectId,
    parentStoryId: row.parentStoryId,
    targetStoryId: row.targetStoryId,
    targetCharacterId: row.targetCharacterId,
    targetSceneId: row.targetSceneId,
    sourceVersion: row.sourceVersion,
    sourceContentSchemaVersion: row.sourceContentSchemaVersion,
    titleSnapshot: row.titleSnapshot,
    createdAt: row.createdAt.toISOString(),
  };
}
export async function listConversions(
  account: AccountRecord,
  ideaId: string,
  search: URLSearchParams,
) {
  await requireIdea(account, ideaId);
  const parsed = ListQuery.safeParse(Object.fromEntries(search));
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid conversion filters.');
  const p = parsed.data;
  const rows = await database().ideaConversion.findMany({
    where: { ideaId, workspaceId: account.workspaceId, ...prismaPosition(p.cursor) },
    select: selection,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: p.limit + 1,
  });
  return pageResult(rows, p.limit, conversionDto);
}
export async function convertIdea(
  account: AccountRecord,
  ideaId: string,
  version: number,
  requestKey: string,
  input: z.infer<typeof IdeaConversionInput>,
): Promise<ConversionResult> {
  id(ideaId);
  if (!Id.safeParse(requestKey).success)
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'A UUID Idempotency-Key is required for conversion.',
    );
  const requestHash = createHash('sha256')
    .update(
      JSON.stringify({
        ideaId,
        version,
        kind: input.kind,
        projectId: input.projectId,
        storyId: input.kind === 'SCENE' ? input.storyId : null,
      }),
    )
    .digest('hex');
  try {
    return await database().$transaction(async (tx) => {
      // Serialize retries on the source row before reading the idempotency record.
      const locked = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Idea" WHERE id=${ideaId}::uuid AND "workspaceId"=${account.workspaceId}::uuid FOR UPDATE`;
      if (!locked.length) notFound();
      const source = await requireIdea(account, ideaId, tx);
      const previous = await tx.ideaConversion.findUnique({
        where: { workspaceId_requestKey: { workspaceId: account.workspaceId, requestKey } },
        select: { ...selection, requestHash: true },
      });
      if (previous) {
        if (previous.requestHash !== requestHash) throw mismatch();
        return {
          conversion: conversionDto(previous),
          ideaVersion: previous.sourceVersion + 1,
          replayed: true,
        };
      }
      await claimIdea(tx, account, ideaId, version);
      await lockProject(tx, account, input.projectId);
      const seed = {
        title: source.title,
        content: readDocument(source.content, source.contentSchemaVersion),
        contentText: source.contentText,
      };
      let targetStoryId: string | null = null,
        targetCharacterId: string | null = null,
        targetSceneId: string | null = null,
        parentStoryId: string | null = null;
      if (input.kind === 'STORY') {
        const target = await seedStory(tx, account, input.projectId, seed);
        targetStoryId = target.id;
        await tx.ideaStoryLink.create({
          data: {
            ideaId,
            workspaceId: account.workspaceId,
            projectId: input.projectId,
            storyId: target.id,
          },
        });
      } else if (input.kind === 'CHARACTER') {
        const target = await seedCharacter(tx, account, input.projectId, seed);
        targetCharacterId = target.id;
      } else {
        parentStoryId = input.storyId;
        const target = await appendSceneSeed(tx, account, input.projectId, input.storyId, seed);
        targetSceneId = target.id;
        await tx.ideaSceneLink.create({
          data: {
            ideaId,
            workspaceId: account.workspaceId,
            projectId: input.projectId,
            storyId: input.storyId,
            sceneId: target.id,
          },
        });
      }
      const conversion = await tx.ideaConversion.create({
        data: {
          workspaceId: account.workspaceId,
          ideaId,
          requestKey,
          requestHash,
          kind: input.kind,
          projectId: input.projectId,
          parentStoryId,
          targetStoryId,
          targetCharacterId,
          targetSceneId,
          sourceVersion: version,
          sourceContentSchemaVersion: source.contentSchemaVersion,
          titleSnapshot: source.title,
          contentSnapshot: jsonDocument(seed.content),
        },
        select: selection,
      });
      return { conversion: conversionDto(conversion), ideaVersion: version + 1, replayed: false };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw mismatch();
    throw error;
  }
}
function mismatch() {
  return new HttpError(
    409,
    'REVISION_CONFLICT',
    'This conversion request key was already used for a different request.',
  );
}
