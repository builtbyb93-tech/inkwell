import { describe, it, expect } from 'vitest';
import {
  canonicalJson,
  decodeSearchCursor,
  encodeSearchCursor,
  parseProjectArchive,
} from '@inkwell/domain';
import { DraftSaveInput, plainDocument, recoveryDays } from '@inkwell/contracts';
const id = '11111111-1111-4111-8111-111111111111';
describe('reliability contracts', () => {
  it('keeps equivalent save payload hashes stable and preserves field presence', () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: [null, 'x'] } })).toBe(
      canonicalJson({ a: { c: [null, 'x'] }, b: 1 }),
    );
    expect(canonicalJson({ field: null })).not.toBe(canonicalJson({}));
  });
  it('validates draft targets without accepting archive or unknown fields', () => {
    const input = {
      kind: 'IDEA',
      recordId: id,
      requestKey: id,
      version: 1,
      fields: { title: 'Valid title', content: plainDocument('Notes') },
    };
    expect(DraftSaveInput.safeParse(input).success).toBe(true);
    expect(DraftSaveInput.safeParse({ ...input, fields: { archived: true } }).success).toBe(false);
    expect(DraftSaveInput.safeParse({ ...input, version: 0 }).success).toBe(false);
    expect(DraftSaveInput.safeParse({ ...input, fields: {} }).success).toBe(false);
    expect(DraftSaveInput.safeParse({ ...input, workspaceId: id }).success).toBe(false);
    expect(recoveryDays).toBe(7);
  });
  it('bounds search cursors and rejects unsupported ranks or target kinds', () => {
    const c = { rank: 0.25, kind: 'IDEA', resultId: id, hash: 'a'.repeat(64) };
    expect(decodeSearchCursor(encodeSearchCursor(c))).toEqual(c);
    expect(decodeSearchCursor('x'.repeat(701))).toBe(null);
    expect(decodeSearchCursor(btoa(JSON.stringify({ ...c, rank: -1 })))).toBe(null);
    expect(decodeSearchCursor(btoa(JSON.stringify({ ...c, kind: 'PRIVATE_SESSION' })))).toBe(null);
  });
  it('rejects unknown archive versions, deep input, and non-archive data safely', () => {
    expect(() => parseProjectArchive('{"version":2}')).toThrow('Unsupported archive version');
    expect(() => parseProjectArchive('{"version":1}')).toThrow();
    expect(() => parseProjectArchive('['.repeat(65) + ']'.repeat(65))).toThrow();
    expect(() => parseProjectArchive('not json')).toThrow();
  });
});
