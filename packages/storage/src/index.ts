import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
export const maxObjectBytes = 8 * 1024 * 1024;
export class StorageUnavailable extends Error {
  constructor() {
    super('Private object storage is unavailable.');
  }
}
export class StorageAlreadyExists extends StorageUnavailable {}
export type StorageConfiguration = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};
export function storageConfiguration(
  env: Readonly<Record<string, string | undefined>> = process.env,
): StorageConfiguration {
  const {
    S3_ENDPOINT: endpoint,
    S3_REGION: region,
    S3_BUCKET: bucket,
    S3_ACCESS_KEY_ID: accessKeyId,
    S3_SECRET_ACCESS_KEY: secretAccessKey,
  } = env;
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey)
    throw new StorageUnavailable();
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new StorageUnavailable();
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '') ||
    (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) ||
    !/^inkwell-[a-z0-9][a-z0-9.-]{1,53}$/.test(bucket)
  )
    throw new StorageUnavailable();
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}
export function objectKey(workspaceId: string, snapshotId: string) {
  const key = `workspaces/${workspaceId}/snapshots/${snapshotId}.json`;
  assertKey(key);
  return key;
}
function assertKey(key: string) {
  if (
    !/^workspaces\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/snapshots\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json$/.test(
      key,
    )
  )
    throw new StorageUnavailable();
}
export interface PrivateStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string, max?: number): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}
export function s3Storage(config = storageConfiguration()): PrivateStorage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    forcePathStyle: true,
    maxAttempts: 1,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    requestHandler: { connectionTimeout: 2500, requestTimeout: 5000 },
  });
  return {
    async put(key, bytes) {
      assertKey(key);
      if (!bytes.length || bytes.length > maxObjectBytes) throw new StorageUnavailable();
      try {
        await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
        throw new StorageAlreadyExists();
      } catch (error) {
        if (error instanceof StorageAlreadyExists) throw error;
        if (
          !error ||
          typeof error !== 'object' ||
          !('$metadata' in error) ||
          (error.$metadata as { httpStatusCode?: number }).httpStatusCode !== 404
        )
          throw new StorageUnavailable();
      }
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: bytes,
            ContentType: 'application/json',
            IfNoneMatch: '*',
          }),
        );
      } catch {
        throw new StorageUnavailable();
      }
    },
    async get(key, max = maxObjectBytes) {
      assertKey(key);
      if (!Number.isInteger(max) || max < 1 || max > maxObjectBytes) throw new StorageUnavailable();
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        if (!result.Body) throw new StorageUnavailable();
        const reader = result.Body.transformToWebStream().getReader();
        if (result.ContentLength !== undefined && result.ContentLength > max) {
          await reader.cancel();
          throw new StorageUnavailable();
        }
        const chunks: Uint8Array[] = [];
        let size = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > max) {
            await reader.cancel();
            throw new StorageUnavailable();
          }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return bytes;
      } catch {
        throw new StorageUnavailable();
      }
    },
    async remove(key) {
      assertKey(key);
      try {
        await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
      } catch {
        throw new StorageUnavailable();
      }
    },
  };
}

/** Test runners never use a remote bucket or a staging/production namespace. */
export function assertLocalTestStorage(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const config = storageConfiguration(env),
    url = new URL(config.endpoint);
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^inkwell-(?:phase[0-9]+|ci|local|test)(?:-[a-z0-9-]+)?$/.test(config.bucket)
  )
    throw new Error('Tests require dedicated loopback S3 and a test bucket.');
  return config;
}
