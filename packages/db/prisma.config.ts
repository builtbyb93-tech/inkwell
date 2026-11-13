import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Generation/validation need a syntactically valid URL, not a live database.
    // scripts/database.mjs requires an explicit URL for migration commands.
    url: process.env.DATABASE_URL ?? 'postgresql://unused:unused@127.0.0.1:5432/unused',
  },
});
