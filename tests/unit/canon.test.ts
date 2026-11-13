import { describe, it, expect } from 'vitest';
import {
  CanonInput,
  CanonPatch,
  CanonQuery,
  OverrideInput,
  OverrideReview,
  RelationshipInput,
  plainDocument,
} from '@inkwell/contracts';
import { validCanonRelationship, canonConflicts } from '@inkwell/domain';
describe('portable canon contracts and rules', () => {
  it('rejects scope/type mutation, ownership injection and ambiguous override values', () => {
    expect(
      CanonInput.safeParse({
        kind: 'CHARACTER',
        name: 'Ada',
        content: plainDocument(''),
        storyId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
    expect(CanonPatch.safeParse({ kind: 'LOCATION' }).success).toBe(false);
    expect(CanonPatch.parse({ archived: true })).toEqual({ archived: true });
    expect(CanonPatch.safeParse({}).success).toBe(false);
    expect(
      OverrideInput.safeParse({
        baseVersion: 1,
        name: { mode: 'CLEAR', value: 'hidden' },
        content: { mode: 'INHERIT' },
      }).success,
    ).toBe(false);
    expect(
      OverrideInput.safeParse({
        baseVersion: 1,
        name: { mode: 'CUSTOM' },
        content: { mode: 'CLEAR' },
      }).success,
    ).toBe(false);
    expect(OverrideReview.safeParse({ baseVersion: 0, name: 'KEEP' }).success).toBe(false);
    expect(
      RelationshipInput.safeParse({ toId: crypto.randomUUID(), kind: 'UNSUPPORTED' }).success,
    ).toBe(false);
    expect(CanonQuery.safeParse({ limit: 51 }).success).toBe(false);
  });
  it('allows only the typed endpoint matrix and leaves related available for every type', () => {
    const kinds = ['CHARACTER', 'LOCATION', 'LORE', 'EVENT', 'ORGANIZATION'] as const;
    for (const from of kinds)
      for (const to of kinds) {
        expect(validCanonRelationship('KNOWS', from, to)).toBe(
          from === 'CHARACTER' && to === 'CHARACTER',
        );
        expect(validCanonRelationship('MEMBER_OF', from, to)).toBe(
          ['CHARACTER', 'ORGANIZATION'].includes(from) && to === 'ORGANIZATION',
        );
        expect(validCanonRelationship('LOCATED_IN', from, to)).toBe(
          ['CHARACTER', 'EVENT', 'ORGANIZATION'].includes(from) && to === 'LOCATION',
        );
        expect(validCanonRelationship('PART_OF', from, to)).toBe(
          from === to && ['LOCATION', 'LORE', 'EVENT', 'ORGANIZATION'].includes(from),
        );
        expect(validCanonRelationship('PRECEDES', from, to)).toBe(
          from === 'EVENT' && to === 'EVENT',
        );
        expect(validCanonRelationship('RELATED', from, to)).toBe(true);
      }
    expect(validCanonRelationship('unknown', 'CHARACTER', 'CHARACTER')).toBe(false);
  });
  it('compares only overridden fields semantically, including explicit clears', () => {
    const base = { name: 'Ada', content: { type: 'doc', content: [] } },
      o = {
        hasName: false,
        hasContent: true,
        baseName: 'Old Ada',
        baseContent: { content: [], type: 'doc' },
      };
    expect(canonConflicts(base, o)).toEqual([]);
    expect(canonConflicts(base, { ...o, hasName: true })).toEqual(['name']);
    expect(canonConflicts({ ...base, content: plainDocument('New') }, o)).toEqual(['content']);
    expect(canonConflicts(base, null)).toEqual([]);
  });
});
