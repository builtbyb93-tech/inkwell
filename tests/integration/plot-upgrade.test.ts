import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { it, expect } from 'vitest';
import { plainDocument } from '@inkwell/contracts';
it('upgrades existing converted scenes without changing IDs, positions, content or source links', async () => {
  const raw = process.env.DATABASE_URL!,
    url = new URL(raw);
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !url.pathname.startsWith('/inkwell_test_')
  )
    throw new Error('Isolated local database required.');
  const name = 'inkwell_test_plot_upgrade_' + randomUUID().replaceAll('-', ''),
    admin = new pg.Client({ connectionString: raw });
  let target: pg.Client | undefined,
    created = false;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    url.pathname = '/' + name;
    target = new pg.Client({ connectionString: url.toString() });
    await target.connect();
    const root = new URL('../../packages/db/prisma/migrations/', import.meta.url);
    for (const dir of (await readdir(root))
      .filter((n) => /^\d/.test(n) && n < '20261113040000_plot_board')
      .sort())
      await target.query(await readFile(new URL(dir + '/migration.sql', root), 'utf8'));
    const user = randomUUID(),
      ws = randomUUID(),
      project = randomUUID(),
      story = randomUUID(),
      scene = randomUUID(),
      idea = randomUUID(),
      link = randomUUID(),
      conversion = randomUUID(),
      doc = plainDocument('An existing scene');
    await target.query('INSERT INTO "User"(id,email,"updatedAt") VALUES($1,$2,now())', [
      user,
      randomUUID() + '@example.test',
    ]);
    await target.query('INSERT INTO "Workspace"(id,"ownerId","updatedAt") VALUES($1,$2,now())', [
      ws,
      user,
    ]);
    await target.query(
      'INSERT INTO "Project"(id,"workspaceId",title,"updatedAt") VALUES($1,$2,$3,now())',
      [project, ws, 'Legacy universe'],
    );
    await target.query(
      'INSERT INTO "Story"(id,"workspaceId","projectId",title,"sequenceVersion","updatedAt") VALUES($1,$2,$3,$4,1,now())',
      [story, ws, project, 'Legacy story'],
    );
    await target.query(
      'INSERT INTO "Scene"(id,"workspaceId","projectId","storyId",title,content,"contentText",position,"updatedAt") VALUES($1,$2,$3,$4,$5,$6,$7,0,now())',
      [scene, ws, project, story, 'Existing scene', JSON.stringify(doc), 'An existing scene'],
    );
    await target.query(
      'INSERT INTO "Idea"(id,"workspaceId",title,content,"contentText","updatedAt") VALUES($1,$2,$3,$4,$5,now())',
      [idea, ws, 'Source idea', JSON.stringify(doc), 'An existing scene'],
    );
    await target.query(
      'INSERT INTO "IdeaSceneLink"(id,"workspaceId","projectId","storyId","sceneId","ideaId") VALUES($1,$2,$3,$4,$5,$6)',
      [link, ws, project, story, scene, idea],
    );
    await target.query(
      'INSERT INTO "IdeaConversion"(id,"workspaceId","requestKey","requestHash","ideaId","projectId","parentStoryId","targetSceneId",kind,"sourceVersion","titleSnapshot","contentSnapshot") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,1,$10,$11)',
      [
        conversion,
        ws,
        randomUUID(),
        'upgrade-test',
        idea,
        project,
        story,
        scene,
        'SCENE',
        'Source idea',
        JSON.stringify(doc),
      ],
    );
    await target.query(
      await readFile(new URL('20261113040000_plot_board/migration.sql', root), 'utf8'),
    );
    expect(
      (
        await target.query(
          'SELECT id,position,content,status,"groupId","duplicatedFromId",version FROM "Scene" WHERE id=$1',
          [scene],
        )
      ).rows[0],
    ).toEqual({
      id: scene,
      position: 0,
      content: doc,
      status: 'PLANNED',
      groupId: null,
      duplicatedFromId: null,
      version: 1,
    });
    expect(
      (
        await target.query(
          'SELECT "targetSceneId","contentSnapshot" FROM "IdeaConversion" WHERE id=$1',
          [conversion],
        )
      ).rows[0],
    ).toEqual({ targetSceneId: scene, contentSnapshot: doc });
    expect(
      (await target.query('SELECT id FROM "IdeaSceneLink" WHERE "sceneId"=$1', [scene])).rows[0].id,
    ).toBe(link);
    const canon = randomUUID(),
      override = randomUUID();
    await target.query(
      'INSERT INTO "Character"(id,"workspaceId","projectId",name,content,"contentText","updatedAt") VALUES($1,$2,$3,$4,$5,$6,now())',
      [canon, ws, project, 'Legacy canon', JSON.stringify(doc), 'Legacy notes'],
    );
    await target.query(
      'INSERT INTO "CanonOverride"(id,"workspaceId","projectId","storyId","canonId","hasName",name,"baseVersion","baseName","baseContent",version,"updatedAt") VALUES($1,$2,$3,$4,$5,true,$6,1,$7,$8,3,$9)',
      [
        override,
        ws,
        project,
        story,
        canon,
        'Legacy story canon',
        'Legacy canon',
        JSON.stringify(doc),
        new Date('2026-01-01T00:00:00Z'),
      ],
    );
    const before = (await target.query('SELECT * FROM "CanonOverride" WHERE id=$1', [override]))
      .rows[0];
    await target.query(
      await readFile(new URL('20261114050000_search_and_saves/migration.sql', root), 'utf8'),
    );
    const after = (await target.query('SELECT * FROM "CanonOverride" WHERE id=$1', [override]))
      .rows[0];
    const { effectiveName, effectiveText, searchVector, ...kept } = after;
    void searchVector;
    expect(kept).toEqual(before);
    expect(effectiveName).toBe('Legacy story canon');
    expect(effectiveText).toBe('Legacy notes');
    expect(
      (
        await target.query(
          'SELECT "searchVector" @@ websearch_to_tsquery(\'simple\',\'existing\') AS found FROM "Idea" WHERE id=$1',
          [idea],
        )
      ).rows[0].found,
    ).toBe(true);
    expect(
      (
        await target.query(
          "SELECT condeferrable FROM pg_constraint WHERE conname='Scene_storyId_position_key'",
        )
      ).rows[0].condeferrable,
    ).toBe(true);
  } finally {
    await target?.end();
    if (created) await admin.query(`DROP DATABASE "${name}"`);
    await admin.end();
  }
});
