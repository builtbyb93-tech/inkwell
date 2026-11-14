import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const synthetic = randomBytes(32).toString('hex');
const result = spawnSync(
  'docker',
  ['compose', '--env-file', '/dev/null', '-f', 'deploy/compose.release.yaml', 'config', '--quiet'],
  {
    env: {
      ...process.env,
      INKWELL_ENV: 'staging',
      INKWELL_IMAGE: 'ghcr.io/builtbyb93-tech/inkwell@sha256:' + 'a'.repeat(64),
      APP_BIND_PORT: '3306',
      DATABASE_URL: 'postgresql://runtime:' + synthetic + '@postgres/inkwell_staging',
      NEXTAUTH_URL: 'https://staging.example.test/api/v1/auth',
      NEXTAUTH_SECRET: synthetic,
      SMTP_HOST: 'smtp.example.test',
      SMTP_FROM: 'no-reply@example.test',
      SMTP_USER: 'synthetic',
      SMTP_PASSWORD: synthetic,
      S3_BUCKET: 'inkwell-staging',
      S3_ACCESS_KEY_ID: 'synthetic',
      S3_SECRET_ACCESS_KEY: synthetic,
      POSTGRES_USER: 'inkwell_staging_owner',
      POSTGRES_PASSWORD: synthetic,
      POSTGRES_DB: 'inkwell_staging',
      GARAGE_CONFIG_FILE: '/tmp/inkwell-compose-validation-only.toml',
    },
    stdio: ['ignore', 'ignore', 'ignore'],
  },
);
if (result.status !== 0) {
  console.error('Release Compose validation failed; no resource was provisioned.');
  process.exitCode = 1;
} else
  console.log(
    'Release Compose validates with synthetic configuration. No resource was provisioned.',
  );
