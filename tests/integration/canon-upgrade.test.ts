import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { it, expect } from 'vitest';
import { plainDocument } from '@inkwell/contracts';
it('upgrades existing Phase 2 characters without changing IDs, content or conversion provenance', async () => {
  const raw = process.env.DATABASE_URL!;
  const url = new URL(raw);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !url.pathname.startsWith('/inkwell_test_')
  )
    throw new Error('Isolated local integration database required.');
  const name = 'inkwell_test_upgrade_' + randomUUID().replaceAll('-', ''),
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
    const root = new URL('../../packages/db/prisma/migrations/', import.meta.url),
      names = (await readdir(root)).filter((n) => /^\d/.test(n)).sort();
    for (const dir of names.filter((n) => n < '20261113030000_story_bible'))
      await target.query(await readFile(new URL(dir + '/migration.sql', root), 'utf8'));
    const user = randomUUID(),
      ws = randomUUID(),
      project = randomUUID(),
      character = randomUUID(),
      idea = randomUUID(),
      conversion = randomUUID(),
      doc = plainDocument('Keep the original structured notes');
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
      'INSERT INTO "Character"(id,"workspaceId","projectId",name,content,"contentText","updatedAt") VALUES($1,$2,$3,$4,$5,$6,now())',
      [
        character,
        ws,
        project,
        'Legacy character',
        JSON.stringify(doc),
        'Keep the original structured notes',
      ],
    );
    await target.query(
      'INSERT INTO "Idea"(id,"workspaceId",title,content,"contentText","updatedAt") VALUES($1,$2,$3,$4,$5,now())',
      [idea, ws, 'Legacy idea', JSON.stringify(doc), 'Keep the original structured notes'],
    );
    await target.query(
      'INSERT INTO "IdeaConversion"(id,"workspaceId","requestKey","requestHash","ideaId","projectId",kind,"sourceVersion","titleSnapshot","contentSnapshot","targetCharacterId") VALUES($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10)',
      [
        conversion,
        ws,
        randomUUID(),
        'legacy-test',
        idea,
        project,
        'CHARACTER',
        'Legacy idea',
        JSON.stringify(doc),
        character,
      ],
    );
    await target.query(
      await readFile(new URL('20261113030000_story_bible/migration.sql', root), 'utf8'),
    );
    expect(
      (
        await target.query(
          'SELECT id,name,content,kind,scope,"storyId",version FROM "Character" WHERE id=$1',
          [character],
        )
      ).rows[0],
    ).toEqual({
      id: character,
      name: 'Legacy character',
      content: doc,
      kind: 'CHARACTER',
      scope: 'SHARED',
      storyId: null,
      version: 1,
    });
    expect(
      (
        await target.query(
          'SELECT "targetCharacterId","contentSnapshot" FROM "IdeaConversion" WHERE id=$1',
          [conversion],
        )
      ).rows[0],
    ).toEqual({ targetCharacterId: character, contentSnapshot: doc });
  } finally {
    await target?.end();
    if (created) await admin.query(`DROP DATABASE "${name}"`);
    await admin.end();
  }
});
