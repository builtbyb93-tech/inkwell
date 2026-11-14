import { setTimeout as delay } from 'node:timers/promises';
import { randomBytes } from 'node:crypto';
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  appendFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
async function main() {
  const project = process.env.COMPOSE_PROJECT_NAME ?? 'inkwell_storage_local',
    bucket = process.env.S3_BUCKET ?? 'inkwell-local',
    port = process.env.S3_PORT ?? '13906';
  if (
    !/^inkwell_[a-z0-9_]+$/.test(project) ||
    !/^inkwell-[a-z0-9-]+$/.test(bucket) ||
    !/^\d{4,5}$/.test(port)
  )
    throw new Error('Use dedicated local Inkwell storage.');
  mkdirSync('.local', { recursive: true, mode: 0o700 });
  if (!existsSync('.local/garage.toml'))
    writeFileSync(
      '.local/garage.toml',
      `metadata_dir = "/var/lib/garage/meta"\ndata_dir = "/var/lib/garage/data"\ndb_engine = "lmdb"\nreplication_factor = 1\nrpc_bind_addr = "0.0.0.0:3901"\nrpc_public_addr = "127.0.0.1:3901"\nrpc_secret = "${randomBytes(32).toString('hex')}"\n[s3_api]\ns3_region = "inkwell"\napi_bind_addr = "0.0.0.0:3900"\n[admin]\napi_bind_addr = "127.0.0.1:3903"\nadmin_token = "${randomBytes(32).toString('hex')}"\n`,
      { mode: 0o600 },
    );
  const env = { ...process.env, COMPOSE_PROJECT_NAME: project, S3_PORT: port };
  function command(args) {
    const r = spawnSync('docker', args, { env, encoding: 'utf8' });
    if (r.status !== 0)
      throw new Error(
        'Local storage command failed; inspect the dedicated container without printing credentials.',
      );
    return r.stdout;
  }
  command(['compose', '-f', 'compose.storage.yaml', 'up', '-d']);
  const container = command(['compose', '-f', 'compose.storage.yaml', 'ps', '-q', 'garage']).trim();
  const garage = (...args) => command(['exec', container, '/garage', ...args]);
  let status = '';
  for (let i = 0; i < 30; i++) {
    try {
      status = garage('status');
      break;
    } catch {
      await delay(500);
    }
  }
  if (!status) throw new Error('Local storage is not ready.');
  if (status.includes('NO ROLE ASSIGNED')) {
    const node = status.match(/^([a-f0-9]{16})\s/m)?.[1];
    if (!node) throw new Error('Local node unavailable.');
    garage('layout', 'assign', '-z', 'local', '-c', '1GB', node);
    garage('layout', 'apply', '--version', '1');
  }
  const marker = '.local/storage-credentials.json';
  let credentials;
  if (existsSync(marker)) {
    credentials = JSON.parse(readFileSync(marker, 'utf8'));
    if (credentials.bucket !== bucket)
      throw new Error('This local storage directory belongs to a different bucket.');
  } else {
    garage('bucket', 'create', bucket);
    const result = garage('key', 'create', 'inkwell-runtime');
    const accessKeyId = result.match(/Key ID:\s*(\S+)/)?.[1],
      secretAccessKey = result.match(/Secret key:\s*(\S+)/i)?.[1];
    if (!accessKeyId || !secretAccessKey) throw new Error('Local credential setup failed.');
    garage('bucket', 'allow', '--read', '--write', '--key', accessKeyId, bucket);
    credentials = { bucket, accessKeyId, secretAccessKey };
    writeFileSync(marker, JSON.stringify(credentials), { mode: 0o600 });
  }
  const values = {
    S3_ENDPOINT: `http://127.0.0.1:${port}`,
    S3_REGION: 'inkwell',
    S3_BUCKET: bucket,
    S3_ACCESS_KEY_ID: credentials.accessKeyId,
    S3_SECRET_ACCESS_KEY: credentials.secretAccessKey,
  };
  const client = new S3Client({
      endpoint: values.S3_ENDPOINT,
      region: values.S3_REGION,
      forcePathStyle: true,
      credentials,
      maxAttempts: 1,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
    key = 'local-readiness-' + randomBytes(12).toString('hex'),
    body = 'inkwell-local-storage-check';
  for (let i = 0; i < 20; i++) {
    try {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, IfNoneMatch: '*' }),
      );
      break;
    } catch {
      if (i === 19) throw new Error('Local private write unavailable.');
      await delay(500);
    }
  }
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if ((await object.Body.transformToString()) !== body)
    throw new Error('Local read verification failed.');
  const anonymous = await fetch(`${values.S3_ENDPOINT}/${bucket}/${key}`);
  if (anonymous.ok) throw new Error('Local bucket must not permit anonymous reads.');
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  let text = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
  for (const [name, value] of Object.entries(values)) {
    text = text.replace(new RegExp('^' + name + '=.*$', 'mg'), '').replace(/\n{3,}/g, '\n\n');
    text += '\n' + name + '=' + value;
  }
  writeFileSync('.env', text + '\n', { mode: 0o600 });
  chmodSync('.env', 0o600);
  if (process.env.GITHUB_ENV)
    for (const [name, value] of Object.entries(values))
      appendFileSync(process.env.GITHUB_ENV, name + '=' + value + '\n');
  console.log(
    'Dedicated local S3: private put/get/delete and anonymous-read rejection verified. Credentials stored only in ignored local files/environment.',
  );
}
main().catch(() => {
  console.error(
    'Local S3 bootstrap failed. Verify the dedicated local container and ignored configuration without printing credentials.',
  );
  process.exitCode = 1;
});
