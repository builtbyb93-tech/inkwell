import { it, expect } from 'vitest';
import { releaseConfiguration } from '@inkwell/operations';
const valid = {
  INKWELL_ENV: 'staging',
  NEXTAUTH_URL: 'https://staging.example.test/api/v1/auth',
  DATABASE_URL: 'postgresql://inkwell_staging_runtime_login:synthetic@db/inkwell_staging',
  NEXTAUTH_SECRET: 'synthetic-value-for-a-local-configuration-test-only',
  S3_ENDPOINT: 'http://127.0.0.1:3900',
  S3_BUCKET: 'inkwell-staging',
  S3_REGION: 'inkwell',
  S3_ACCESS_KEY_ID: 'synthetic-local-identity',
  S3_SECRET_ACCESS_KEY: 'synthetic-local-value',
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_FROM: 'no-reply@example.test',
  SMTP_USER: 'synthetic-mail-identity',
  SMTP_PASSWORD: 'synthetic-local-value',
  INKWELL_IMAGE: 'ghcr.io/builtbyb93-tech/inkwell@sha256:' + 'a'.repeat(64),
};
it('accepts complete environment-specific immutable configuration without activating deployment', () => {
  expect(releaseConfiguration(valid)).toMatchObject({
    configurationValid: true,
    deploymentActivated: false,
    dailyBackupRetention: 30,
  });
  expect(
    releaseConfiguration({ ...valid, NEXTAUTH_URL: 'http://127.0.0.1:3306/api/v1/auth' })
      .configurationValid,
  ).toBe(true);
});
it('rejects environment mixing, plaintext public origins, privileged default SQL users, unencrypted SMTP and mutable images', () => {
  for (const changes of [
    { S3_BUCKET: 'inkwell-production' },
    { DATABASE_URL: valid.DATABASE_URL.replace('/inkwell_staging', '/inkwell_production') },
    { NEXTAUTH_URL: 'http://staging.example.test/api/v1/auth' },
    { DATABASE_URL: valid.DATABASE_URL.replace('inkwell_staging_runtime_login', 'postgres') },
    { SMTP_PORT: '25' },
    { SMTP_SECURE: 'true' },
    { INKWELL_IMAGE: 'inkwell:latest' },
    { S3_ENDPOINT: 'http://untrusted.example.test' },
    { NEXTAUTH_SECRET: '' },
  ])
    expect(() => releaseConfiguration({ ...valid, ...changes })).toThrow('Backup operation failed');
  expect(() =>
    releaseConfiguration({
      ...valid,
      INKWELL_ENV: 'production',
      NEXTAUTH_URL: 'http://127.0.0.1:3306/api/v1/auth',
    }),
  ).toThrow();
});
