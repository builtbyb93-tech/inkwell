import { it, expect } from 'vitest';
import { SnapshotInput, SnapshotDocument, plainDocument } from '@inkwell/contracts';
import { validateSnapshotDocument } from '@inkwell/domain';
import { storageConfiguration, objectKey } from '@inkwell/storage';
const id = '11111111-1111-4111-8111-111111111111';
const selection = {
  project: false,
  storyIds: [],
  ideaIds: [],
  canonIds: [],
  sceneIds: [id],
  groupIds: [],
  relationships: false,
};
it('requires explicit bounded unique content selection and rejects private payload injection', () => {
  expect(SnapshotInput.safeParse({ title: 'Copy', selection }).success).toBe(true);
  expect(
    SnapshotInput.safeParse({ title: 'Copy', selection: { ...selection, sceneIds: [] } }).success,
  ).toBe(false);
  expect(
    SnapshotInput.safeParse({ title: 'Copy', selection: { ...selection, sceneIds: [id, id] } })
      .success,
  ).toBe(false);
  expect(SnapshotInput.safeParse({ title: 'Copy', selection, workspaceId: id }).success).toBe(
    false,
  );
});
it('rejects dangling copied relationships, private source IDs, and unsupported assets', () => {
  const doc = {
    format: 'inkwell.snapshot',
    version: 1,
    title: 'Copy',
    createdAt: new Date().toISOString(),
    records: [{ id, kind: 'IDEA', title: 'Selected', content: plainDocument('Notes') }],
    relationships: [],
    assets: [],
  };
  expect(validateSnapshotDocument(doc).records).toHaveLength(1);
  expect(SnapshotDocument.safeParse({ ...doc, projectId: id }).success).toBe(false);
  expect(() =>
    validateSnapshotDocument({
      ...doc,
      relationships: [
        { fromId: id, toId: '22222222-2222-4222-8222-222222222222', kind: 'RELATED', label: '' },
      ],
    }),
  ).toThrow();
  expect(() =>
    validateSnapshotDocument({ ...doc, assets: [{ url: 'https://private.invalid' }] }),
  ).toThrow();
});
it('requires explicit S3 credentials and secure remote origins rather than falling back to unrelated credentials', () => {
  const env = {
    S3_ENDPOINT: 'http://127.0.0.1:13906',
    S3_REGION: 'inkwell',
    S3_BUCKET: 'inkwell-test',
    S3_ACCESS_KEY_ID: 'local-test-key',
    S3_SECRET_ACCESS_KEY: 'local-test-secret',
  };
  expect(storageConfiguration(env).bucket).toBe('inkwell-test');
  expect(() => storageConfiguration({ ...env, S3_ENDPOINT: 'http://remote.invalid' })).toThrow();
  expect(() => storageConfiguration({ ...env, S3_SECRET_ACCESS_KEY: '' })).toThrow();
  expect(() =>
    storageConfiguration({ ...env, S3_ENDPOINT: 'https://user:password@remote.invalid' }),
  ).toThrow();
});
it('only accepts server-generated workspace/snapshot object paths', () => {
  expect(objectKey(id, id)).toBe('workspaces/' + id + '/snapshots/' + id + '.json');
  expect(() => objectKey('../other-bucket', id)).toThrow();
  expect(() => objectKey(id, '../private')).toThrow();
});
