'use client';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  DraftSaveInput,
  type DraftSaveAck,
  RichDocumentSchema,
  CanonKind,
  SceneStatus,
  type RichDocument,
} from '@inkwell/contracts';
import { canonicalJson } from '@inkwell/domain';
import { RichTextView } from '@inkwell/editor/render';
import {
  RecoveryStorageError,
  putRecovery,
  getRecovery,
  dropRecovery,
  type Recovered,
} from '@/client/recovery';
import { useRecovery } from './recovery-provider';
import { api, ApiClientError, message } from './api-client';
const title = z.string().max(120),
  rich = RichDocumentSchema;
const tax = z
  .object({
    id: z.uuid(),
    name: z.string().max(50),
    version: z.number().int().positive(),
    createdAt: z.string().max(40),
  })
  .strict();
export const draftSchemas = {
  CAPTURE: z.object({ capture: z.string().max(10000) }).strict(),
  PROJECT: z.object({ title, description: z.string().max(10000) }).strict(),
  STORY: z.object({ title, synopsis: z.string().max(10000), format: z.string().max(80) }).strict(),
  IDEA: z
    .object({ title, content: rich, category: tax.nullable(), tags: z.array(tax).max(20) })
    .strict(),
  CANON: z.object({ kind: CanonKind, name: title, content: rich }).strict(),
  SCENE: z
    .object({ title, content: rich, status: SceneStatus, groupId: z.uuid().nullable() })
    .strict(),
  OVERRIDE: z
    .object({
      baseVersion: z.number().int().positive(),
      nameMode: z.enum(['INHERIT', 'CUSTOM', 'CLEAR']),
      contentMode: z.enum(['INHERIT', 'CUSTOM', 'CLEAR']),
      name: title,
      content: rich,
    })
    .strict(),
  GROUP: z
    .object({ title, description: z.string().max(2000), parentId: z.uuid().nullable() })
    .strict(),
};
type Options<F> = {
  kind: DraftSaveInput['kind'];
  slot: string;
  recordId?: string | undefined;
  projectId?: string | undefined;
  storyId?: string | undefined;
  version: number;
  fields: F;
  baseline: F;
  schema: z.ZodType<F>;
  loaded: boolean;
  enabled: boolean;
  auto?: boolean;
  saveFields?: (f: F) => unknown;
  apply: (f: F) => void;
  ack: (f: F, v: number) => void;
  current?: () => Promise<{ fields: F; version: number }>;
};
export function useReliableEditor<F>(options: Options<F>) {
  const recovery = useRecovery(),
    latest = useRef(options);
  latest.current = options;
  const [basis, setBasis] = useState(canonicalJson(options.baseline)),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [conflict, setConflict] = useState(false),
    [candidate, setCandidate] = useState<(Recovered & { fields: F }) | null>(null),
    [comparison, setComparison] = useState<{ fields: F; version: number } | null>(null),
    [checking, setChecking] = useState(true),
    [device, setDevice] = useState('');
  const state = useRef({
    initialized: false,
    epoch: 0,
    version: options.version,
    basis: canonicalJson(options.baseline),
    halt: false,
    retry: null as null | { input: DraftSaveInput; fields: F; serialized: string },
    flight: null as Promise<boolean> | null,
    alive: true,
  });
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const serialized = canonicalJson(options.fields),
    dirty = serialized !== basis;
  function setBase(fields: F, version: number) {
    const text = canonicalJson(fields);
    state.current.version = version;
    state.current.basis = text;
    setBasis(text);
  }
  function queue(task: () => Promise<unknown>) {
    chain.current = chain.current
      .catch(() => {})
      .then(task)
      .catch((e) => {
        if (state.current.alive)
          setDevice(
            e instanceof RecoveryStorageError
              ? e.message
              : 'Device recovery could not be updated. Keep this tab open or save online.',
          );
      });
    return chain.current;
  }
  useEffect(() => {
    state.current.alive = true;
    return () => {
      state.current.alive = false;
    };
  }, []);
  useEffect(() => {
    if (!options.loaded) return;
    const s = state.current;
    if (!s.initialized) {
      s.initialized = true;
      setBase(options.baseline, options.version);
    } else if (!s.halt && !s.retry && options.version !== s.version && !s.flight) {
      if (
        canonicalJson(options.fields) === canonicalJson(options.baseline) ||
        canonicalJson(options.baseline) === s.basis
      ) {
        setBase(options.baseline, options.version);
      } else {
        s.halt = true;
        setConflict(true);
        setError('This record changed. Compare the current version before saving your draft.');
      }
    }
  });
  useEffect(() => {
    if (!options.loaded || !recovery.ready) return;
    let live = true;
    setChecking(true);
    if (!recovery.lease?.enabled) {
      setChecking(false);
      return;
    }
    getRecovery(recovery.lease, options.slot)
      .then((r) => {
        if (!live) return;
        if (r) {
          const parsed = options.schema.safeParse(r.fields);
          if (
            parsed.success &&
            canonicalJson(parsed.data) !== canonicalJson(latest.current.baseline)
          ) {
            setCandidate({ ...r, fields: parsed.data });
          } else if (!parsed.success)
            setDevice('An incompatible device draft is available. Clear it in Account & privacy.');
        }
      })
      .catch(() => {
        if (live) setDevice('Device recovery is unavailable. Online saves still work.');
      })
      .finally(() => {
        if (live) setChecking(false);
      });
    return () => {
      live = false;
    };
    // Recheck when settings rotate the lease; field edits must not reread old buffers.
  }, [options.slot, options.loaded, recovery.ready, recovery.lease?.generation]);
  useEffect(() => {
    if (!options.loaded || checking || candidate || !recovery.lease?.enabled || !dirty) return;
    const lease = recovery.lease,
      slot = options.slot,
      fields = options.fields,
      epoch = state.current.epoch;
    const timer = setTimeout(() => {
      void queue(async () => {
        if (epoch !== state.current.epoch) return;
        await putRecovery(lease, slot, state.current.version, fields);
        if (state.current.alive) setDevice('Draft protected on this device for seven days.');
      });
    }, 100);
    return () => clearTimeout(timer);
    // Serialized content is the stable dependency for snapshots.
  }, [serialized, options.loaded, checking, candidate, recovery.lease?.generation, dirty, basis]);
  async function discardStored() {
    if (recovery.lease?.enabled)
      await queue(() => dropRecovery(recovery.lease!, latest.current.slot));
  }
  async function flush(): Promise<boolean> {
    const s = state.current,
      o = latest.current;
    if (s.flight) return s.flight;
    if (!o.recordId || !o.enabled || checking || candidate || s.halt) return false;
    if (!s.retry && canonicalJson(o.fields) === s.basis) return true;
    let req = s.retry;
    if (!req) {
      const parsed = DraftSaveInput.safeParse({
        kind: o.kind,
        recordId: o.recordId,
        version: s.version,
        requestKey: crypto.randomUUID(),
        ...(o.projectId ? { projectId: o.projectId } : {}),
        ...(o.storyId ? { storyId: o.storyId } : {}),
        fields: o.saveFields ? o.saveFields(o.fields) : o.fields,
      });
      if (!parsed.success) {
        setError('Complete the fields before saving. Your draft is still here.');
        return false;
      }
      req = {
        input: parsed.data,
        fields: structuredClone(o.fields),
        serialized: canonicalJson(o.fields),
      };
    }
    const sent = req;
    s.retry = sent;
    setSaving(true);
    setError('');
    const work = (async () => {
      try {
        const ack = await api<DraftSaveAck>('/draft-saves', { method: 'POST', body: sent.input });
        if (ack.requestKey !== sent.input.requestKey || ack.version !== sent.input.version + 1)
          throw new Error('Invalid save acknowledgement.');
        s.retry = null;
        setBase(sent.fields, ack.version);
        latest.current.ack(sent.fields, ack.version);
        if (canonicalJson(latest.current.fields) === sent.serialized) {
          s.epoch++;
          await discardStored();
        }
        return true;
      } catch (e) {
        if (
          e instanceof ApiClientError &&
          [400, 403, 404, 409, 410, 413, 415, 422, 428].includes(e.status)
        ) {
          s.retry = null;
          s.halt = true;
          setConflict(e.status === 409);
        }
        setError(message(e));
        return false;
      } finally {
        s.flight = null;
        if (s.alive) setSaving(false);
      }
    })();
    s.flight = work;
    return work;
  }
  useEffect(() => {
    if (
      !dirty ||
      !options.recordId ||
      !options.enabled ||
      options.auto === false ||
      checking ||
      candidate ||
      saving ||
      error ||
      state.current.halt
    )
      return;
    const timer = setTimeout(() => {
      void flush();
    }, 900);
    return () => clearTimeout(timer);
    // Serialized content, rather than function identities, drives the debounce.
  }, [
    serialized,
    basis,
    dirty,
    options.recordId,
    options.enabled,
    options.auto,
    checking,
    candidate,
    saving,
    error,
  ]);
  // Validation errors can be corrected locally; conflicts need an explicit comparison.
  useEffect(() => {
    if (!conflict && !state.current.retry) {
      state.current.halt = false;
      setError('');
    }
  }, [serialized, conflict]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (canonicalJson(latest.current.fields) !== state.current.basis) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  function reset(fields: F, version: number) {
    state.current.epoch++;
    state.current.halt = false;
    state.current.retry = null;
    setBase(fields, version);
    setCandidate(null);
    setComparison(null);
    setConflict(false);
    setError('');
    void discardStored();
  }
  async function compare() {
    if (!latest.current.current) return;
    try {
      const value = await latest.current.current();
      setComparison(value);
    } catch (e) {
      setError(message(e));
    }
  }
  function rebase() {
    if (!comparison) return;
    const value = comparison;
    state.current.halt = false;
    state.current.retry = null;
    setBase(value.fields, value.version);
    latest.current.ack(value.fields, value.version);
    setComparison(null);
    setConflict(false);
    setError('');
  }
  async function restore() {
    if (!candidate) return;
    const r = candidate;
    latest.current.apply(r.fields);
    state.current.version = r.version;
    setCandidate(null);
    if (r.version !== latest.current.version) {
      state.current.halt = true;
      setConflict(true);
      setError('This recovered draft used an older revision. Compare before saving.');
    }
  }
  async function discardCandidate() {
    setCandidate(null);
    await discardStored();
  }
  return {
    dirty,
    saving,
    error,
    conflict,
    candidate,
    comparison,
    checking,
    device: recovery.error || device,
    flush,
    reset,
    restore,
    discardCandidate,
    compare,
    rebase,
    created: async () => {
      state.current.epoch++;
      await discardStored();
    },
    blocked: saving || Boolean(candidate) || checking || conflict || Boolean(state.current.retry),
    state: saving
      ? 'Saving…'
      : error
        ? 'Save needs attention'
        : dirty
          ? options.recordId
            ? 'Unsaved changes'
            : 'Not saved yet'
          : options.recordId
            ? 'All changes saved'
            : 'Not saved yet',
  };
}
function Fields({ value }: { value: unknown }) {
  if (!value || typeof value !== 'object') return null;
  return (
    <dl>
      {Object.entries(value).map(([key, v]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>
            {v && typeof v === 'object' && 'type' in v && v.type === 'doc' ? (
              <RichTextView document={v as RichDocument} />
            ) : typeof v === 'string' ? (
              v
            ) : (
              JSON.stringify(v)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function ReliableStatus<F>({ editor }: { editor: ReturnType<typeof useReliableEditor<F>> }) {
  return (
    <div className="reliability-panel">
      <p role="status" className="save-state">
        {editor.state}
      </p>
      {editor.device && <p className="field-help">{editor.device}</p>}
      {editor.candidate && (
        <div className="recovery-choice">
          <p>
            A device draft from {new Date(editor.candidate.savedAt).toLocaleString()} is available.
            Saved content will stay intact until you restore and save.
          </p>
          <button type="button" className="quiet-button" onClick={() => void editor.restore()}>
            Restore device draft
          </button>
          <button
            type="button"
            className="quiet-button"
            onClick={() => void editor.discardCandidate()}
          >
            Discard device draft
          </button>
        </div>
      )}
      {editor.error && (
        <p role="alert" className="form-error">
          {editor.error} Your draft is still here.
        </p>
      )}
      {editor.conflict ? (
        <button type="button" className="quiet-button" onClick={() => void editor.compare()}>
          Compare current record
        </button>
      ) : (
        editor.error && (
          <button type="button" className="quiet-button" onClick={() => void editor.flush()}>
            Retry save
          </button>
        )
      )}
      {editor.comparison && (
        <div className="recovery-choice">
          <h2>Current saved record</h2>
          <Fields value={editor.comparison.fields} />
          <p>
            Your edits remain in the editor above. Review these values before choosing a new base.
          </p>
          <button type="button" className="button" onClick={editor.rebase}>
            Use current version as base and keep my draft
          </button>
        </div>
      )}
    </div>
  );
}
