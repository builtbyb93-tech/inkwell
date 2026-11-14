import { recoveryDays, recoveryMaxBytes, recoveryMaxRecords } from '@inkwell/contracts';
export type RecoveryIdentity = { owner: string; tag: string; startedAt: number };
export type RecoveryLease = RecoveryIdentity & { generation: number; enabled: boolean };
type Pref = RecoveryLease & { key: CryptoKey; blocked: boolean };
type Stored = {
  id: string;
  owner: string;
  slot: string;
  expiresAt: number;
  savedAt: number;
  iv: Uint8Array<ArrayBuffer>;
  cipher: ArrayBuffer;
};
export type Recovered = { version: number; fields: unknown; savedAt: number };
export class RecoveryStorageError extends Error {}
let pending: Promise<IDBDatabase> | undefined;
function db() {
  return (pending ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('inkwell-recovery-v1', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('prefs', { keyPath: 'owner' });
      req.result.createObjectStore('drafts', { keyPath: 'id' }).createIndex('owner', 'owner');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      pending = undefined;
      reject(new RecoveryStorageError('Device recovery storage is unavailable.'));
    };
  }));
}
function request<T>(r: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function complete(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new RecoveryStorageError('Device recovery update was interrupted.'));
    tx.onerror = () => reject(tx.error);
  });
}
async function removeOwner(tx: IDBTransaction, owner: string) {
  const store = tx.objectStore('drafts'),
    keys = await request(store.index('owner').getAllKeys(owner));
  for (const id of keys) store.delete(id);
}
function check(p: Pref | undefined, lease: RecoveryLease) {
  if (!p || p.blocked || !p.enabled || p.tag !== lease.tag || p.generation !== lease.generation)
    throw new RecoveryStorageError(
      'Device recovery changed in another tab. Reload to continue using it.',
    );
  return p;
}
export async function openRecovery(identity: RecoveryIdentity): Promise<RecoveryLease> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  const database = await db(),
    tx = database.transaction(['prefs', 'drafts'], 'readwrite'),
    done = complete(tx),
    store = tx.objectStore('prefs');
  const old = await request<Pref | undefined>(store.get(identity.owner));
  if (
    old &&
    (old.startedAt > identity.startedAt ||
      (old.tag === identity.tag && old.blocked) ||
      (old.tag !== identity.tag && old.startedAt === identity.startedAt))
  ) {
    await done;
    throw new RecoveryStorageError('Sign in again to use device recovery.');
  }
  let pref = old;
  if (!old || old.tag !== identity.tag) {
    await removeOwner(tx, identity.owner);
    pref = {
      ...identity,
      key,
      generation: (old?.generation ?? 0) + 1,
      enabled: old?.enabled ?? true,
      blocked: false,
    };
    store.put(pref);
  }
  const drafts = tx.objectStore('drafts'),
    expired = await request<Stored[]>(drafts.index('owner').getAll(identity.owner));
  for (const r of expired) if (r.expiresAt <= Date.now()) drafts.delete(r.id);
  await done;
  return { ...identity, generation: pref!.generation, enabled: pref!.enabled };
}
export async function putRecovery(
  lease: RecoveryLease,
  slot: string,
  version: number,
  fields: unknown,
  editedAt: number,
) {
  const text = JSON.stringify({ version, fields });
  if (new TextEncoder().encode(text).byteLength > recoveryMaxBytes)
    throw new RecoveryStorageError(
      'This draft exceeds the device recovery limit. Save online to protect it.',
    );
  const database = await db();
  let tx = database.transaction('prefs', 'readonly'),
    done = complete(tx);
  const p = check(await request<Pref | undefined>(tx.objectStore('prefs').get(lease.owner)), lease);
  await done;
  const iv = crypto.getRandomValues(new Uint8Array(12)),
    cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(lease.owner + '|' + slot) },
      p.key,
      new TextEncoder().encode(text),
    );
  tx = database.transaction(['prefs', 'drafts'], 'readwrite');
  done = complete(tx);
  const current = await request<Pref | undefined>(tx.objectStore('prefs').get(lease.owner));
  // This second check is deliberately inside the write transaction, after encryption.
  if (
    !current ||
    current.blocked ||
    !current.enabled ||
    current.tag !== lease.tag ||
    current.generation !== lease.generation
  ) {
    await done;
    throw new RecoveryStorageError('Device recovery changed. Reload before editing.');
  }
  const store = tx.objectStore('drafts'),
    rows = await request<Stored[]>(store.index('owner').getAll(lease.owner)),
    now = Date.now(),
    id = lease.owner + '|' + slot;
  for (const r of rows) if (r.expiresAt <= now) store.delete(r.id);
  if (
    !rows.some((r) => r.id === id) &&
    rows.filter((r) => r.expiresAt > now).length >= recoveryMaxRecords
  ) {
    await done;
    throw new RecoveryStorageError(
      'Device recovery is full. Clear drafts in Account & privacy, or save online.',
    );
  }
  const expiresAt = editedAt + recoveryDays * 86400000;
  if (!Number.isFinite(editedAt) || expiresAt <= now) {
    await done;
    throw new RecoveryStorageError(
      'This device draft expired. Save online or make a new edit to protect it.',
    );
  }
  store.put({
    id,
    owner: lease.owner,
    slot,
    expiresAt,
    savedAt: editedAt,
    iv,
    cipher,
  } satisfies Stored);
  await done;
}
export async function getRecovery(lease: RecoveryLease, slot: string): Promise<Recovered | null> {
  const database = await db(),
    tx = database.transaction(['prefs', 'drafts'], 'readwrite'),
    done = complete(tx),
    p = check(await request<Pref | undefined>(tx.objectStore('prefs').get(lease.owner)), lease),
    store = tx.objectStore('drafts'),
    row = await request<Stored | undefined>(store.get(lease.owner + '|' + slot));
  if (row && row.expiresAt <= Date.now()) store.delete(row.id);
  await done;
  if (!row || row.expiresAt <= Date.now()) return null;
  try {
    const text = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: row.iv,
        additionalData: new TextEncoder().encode(lease.owner + '|' + slot),
      },
      p.key,
      row.cipher,
    );
    const value = JSON.parse(new TextDecoder().decode(text));
    if (!value || !Number.isInteger(value.version) || value.version < 0 || !('fields' in value))
      return null;
    return { version: value.version, fields: value.fields, savedAt: row.savedAt };
  } catch {
    throw new RecoveryStorageError('This recovery draft could not be read.');
  }
}
export async function dropRecovery(lease: RecoveryLease, slot: string) {
  const database = await db(),
    tx = database.transaction(['prefs', 'drafts'], 'readwrite'),
    done = complete(tx);
  check(await request<Pref | undefined>(tx.objectStore('prefs').get(lease.owner)), lease);
  tx.objectStore('drafts').delete(lease.owner + '|' + slot);
  await done;
}
export async function clearRecovery(
  identity: RecoveryIdentity,
  options: { signOut?: boolean; enabled?: boolean } = {},
): Promise<RecoveryLease> {
  const database = await db(),
    tx = database.transaction(['prefs', 'drafts'], 'readwrite'),
    done = complete(tx),
    store = tx.objectStore('prefs'),
    p = await request<Pref | undefined>(store.get(identity.owner));
  if (p && p.tag !== identity.tag) {
    await done;
    throw new RecoveryStorageError('This browser session has changed.');
  }
  await removeOwner(tx, identity.owner);
  let generation = p?.generation ?? 0,
    enabled = p?.enabled ?? true;
  if (p) {
    generation++;
    enabled = options.enabled ?? p.enabled;
    store.put({ ...p, generation, enabled, blocked: p.blocked || Boolean(options.signOut) });
  }
  await done;
  return { ...identity, generation, enabled };
}
