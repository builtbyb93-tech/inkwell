import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma } from '@inkwell/db';
import { type AccountRecord, type DraftSaveInput, type DraftSaveAck } from '@inkwell/contracts';
import { canonicalJson } from '@inkwell/domain';
import { database } from './database';
import { updateProject, updateStory } from './records';
import { updateIdea } from './ideas';
import { updateCanon, saveOverride } from './canon';
import { updateScene, updateGroup } from './plot';
import { HttpError } from './http';
export async function saveDraft(a: AccountRecord, input: DraftSaveInput): Promise<DraftSaveAck> {
  const targetKey = [
      input.kind,
      'projectId' in input ? input.projectId : '',
      'storyId' in input ? (input.storyId ?? '') : '',
      input.recordId,
    ].join(':'),
    requestHash = createHash('sha256')
      .update(canonicalJson({ ...input, requestKey: undefined }))
      .digest('hex');
  try {
    return await database().$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${a.workspaceId + ':' + targetKey},0))::text`;
      const old = await tx.saveReceipt.findUnique({
        where: { workspaceId_targetKey: { workspaceId: a.workspaceId, targetKey } },
      });
      if (old?.requestKey === input.requestKey) {
        if (old.requestHash !== requestHash) throw mismatch();
        return { version: old.appliedVersion, replayed: true, requestKey: input.requestKey };
      }
      let version: number;
      switch (input.kind) {
        case 'PROJECT':
          version = (await updateProject(a, input.recordId, input.version, input.fields, tx))
            .version;
          break;
        case 'STORY':
          version = (
            await updateStory(a, input.projectId, input.recordId, input.version, input.fields, tx)
          ).version;
          break;
        case 'IDEA':
          version = (await updateIdea(a, input.recordId, input.version, input.fields, tx)).version;
          break;
        case 'CANON':
          version = (
            await updateCanon(
              a,
              { projectId: input.projectId, ...(input.storyId ? { storyId: input.storyId } : {}) },
              input.recordId,
              input.version,
              input.fields,
              tx,
            )
          ).version;
          break;
        case 'SCENE':
          version = (
            await updateScene(
              a,
              { projectId: input.projectId, storyId: input.storyId },
              input.recordId,
              input.version,
              input.fields,
              tx,
            )
          ).version;
          break;
        case 'GROUP':
          version = (
            await updateGroup(
              a,
              { projectId: input.projectId, storyId: input.storyId },
              input.recordId,
              input.version,
              input.fields,
              tx,
            )
          ).version;
          break;
        case 'OVERRIDE':
          version = (
            await saveOverride(
              a,
              { projectId: input.projectId, storyId: input.storyId },
              input.recordId,
              input.version,
              input.fields,
              tx,
            )
          ).override!.version;
          break;
      }
      await tx.saveReceipt.upsert({
        where: { workspaceId_targetKey: { workspaceId: a.workspaceId, targetKey } },
        create: {
          workspaceId: a.workspaceId,
          targetKey,
          requestKey: input.requestKey,
          requestHash,
          appliedVersion: version,
        },
        update: { requestKey: input.requestKey, requestHash, appliedVersion: version },
      });
      return { version, replayed: false, requestKey: input.requestKey };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw mismatch();
    throw e;
  }
}
function mismatch() {
  return new HttpError(
    409,
    'REVISION_CONFLICT',
    'This save request key already belongs to another edit. Your draft is still here.',
  );
}
