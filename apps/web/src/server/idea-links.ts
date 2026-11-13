import 'server-only';
import { Prisma } from '@inkwell/db';
import {
  IdeaLinkInput,
  type AccountRecord,
  type IdeaLinkRecord,
  ListQuery,
} from '@inkwell/contracts';
import type { z } from 'zod';
import { database } from './database';
import { HttpError, notFound } from './http';
import { id } from './records';
import { claimIdea, requireIdea, pageResult, prismaPosition } from './ideas';
import { lockProject, requireActiveStory } from './idea-targets';
export type LinkKind = 'STORY' | 'SCENE';
export async function addIdeaLink(
  account: AccountRecord,
  ideaId: string,
  version: number,
  input: z.infer<typeof IdeaLinkInput>,
) {
  try {
    return await database().$transaction(async (tx) => {
      await claimIdea(tx, account, ideaId, version);
      await lockProject(tx, account, input.projectId);
      await requireActiveStory(tx, account, input.projectId, input.storyId);
      const base = {
        workspaceId: account.workspaceId,
        ideaId,
        projectId: input.projectId,
        storyId: input.storyId,
      };
      if (input.kind === 'STORY') await tx.ideaStoryLink.create({ data: base });
      else {
        const scene = await tx.scene.findFirst({
          where: {
            id: input.sceneId,
            storyId: input.storyId,
            projectId: input.projectId,
            workspaceId: account.workspaceId,
            archivedAt: null,
          },
          select: { id: true },
        });
        if (!scene) notFound();
        await tx.ideaSceneLink.create({ data: { ...base, sceneId: input.sceneId } });
      }
      return { ideaVersion: version + 1 };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new HttpError(409, 'REVISION_CONFLICT', 'This idea is already linked to that record.');
    throw error;
  }
}
export async function listIdeaLinks(
  account: AccountRecord,
  ideaId: string,
  kind: LinkKind,
  search: URLSearchParams,
) {
  await requireIdea(account, ideaId);
  const parsed = ListQuery.safeParse(Object.fromEntries(search));
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid link filters.');
  const p = parsed.data;
  const db = database();
  const where = { ideaId, workspaceId: account.workspaceId, ...prismaPosition(p.cursor) };
  if (kind === 'STORY') {
    const rows = await db.ideaStoryLink.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: p.limit + 1,
      include: {
        story: {
          select: { title: true, archivedAt: true, project: { select: { archivedAt: true } } },
        },
      },
    });
    const conversions = await db.ideaConversion.findMany({
      where: {
        ideaId,
        workspaceId: account.workspaceId,
        targetStoryId: { in: rows.map((r) => r.storyId) },
      },
      select: { targetStoryId: true },
    });
    const converted = new Set(conversions.map((c) => c.targetStoryId));
    return pageResult(
      rows,
      p.limit,
      (row) =>
        ({
          id: row.id,
          kind,
          projectId: row.projectId,
          storyId: row.storyId,
          title: row.story.title,
          archived: Boolean(row.story.archivedAt || row.story.project.archivedAt),
          converted: converted.has(row.storyId),
          createdAt: row.createdAt.toISOString(),
        }) satisfies IdeaLinkRecord,
    );
  }
  const rows = await db.ideaSceneLink.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: p.limit + 1,
    include: {
      scene: {
        select: {
          title: true,
          archivedAt: true,
          project: { select: { archivedAt: true } },
          story: { select: { archivedAt: true } },
        },
      },
    },
  });
  const conversions = await db.ideaConversion.findMany({
    where: {
      ideaId,
      workspaceId: account.workspaceId,
      targetSceneId: { in: rows.map((r) => r.sceneId) },
    },
    select: { targetSceneId: true },
  });
  const converted = new Set(conversions.map((c) => c.targetSceneId));
  return pageResult(
    rows,
    p.limit,
    (row) =>
      ({
        id: row.id,
        kind,
        projectId: row.projectId,
        storyId: row.storyId,
        sceneId: row.sceneId,
        title: row.scene.title,
        archived: Boolean(
          row.scene.archivedAt || row.scene.project.archivedAt || row.scene.story.archivedAt,
        ),
        converted: converted.has(row.sceneId),
        createdAt: row.createdAt.toISOString(),
      }) satisfies IdeaLinkRecord,
  );
}
export async function removeIdeaLink(
  account: AccountRecord,
  ideaId: string,
  kind: LinkKind,
  linkId: string,
  version: number,
) {
  id(linkId);
  return database().$transaction(async (tx) => {
    await claimIdea(tx, account, ideaId, version);
    const where = { id: linkId, ideaId, workspaceId: account.workspaceId };
    if (kind === 'STORY') {
      const link = await tx.ideaStoryLink.findFirst({ where });
      if (!link) notFound();
      if (
        await tx.ideaConversion.findFirst({
          where: { ideaId, workspaceId: account.workspaceId, targetStoryId: link.storyId },
          select: { id: true },
        })
      )
        throw retained();
      await tx.ideaStoryLink.delete({ where: { id: linkId } });
    } else {
      const link = await tx.ideaSceneLink.findFirst({ where });
      if (!link) notFound();
      if (
        await tx.ideaConversion.findFirst({
          where: { ideaId, workspaceId: account.workspaceId, targetSceneId: link.sceneId },
          select: { id: true },
        })
      )
        throw retained();
      await tx.ideaSceneLink.delete({ where: { id: linkId } });
    }
    return { ideaVersion: version + 1 };
  });
}
function retained() {
  return new HttpError(
    409,
    'REVISION_CONFLICT',
    'Converted records retain their source relationship.',
  );
}
