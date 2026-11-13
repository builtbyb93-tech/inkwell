import { describe, it, expect } from 'vitest';
import {
  ProjectInput,
  ProjectPatch,
  StoryPatch,
  RegisterInput,
  ListQuery,
} from '@inkwell/contracts';
import { expectedVersion, encodeCursor, decodeCursor } from '@inkwell/domain';

describe('native-compatible request contracts', () => {
  it('bounds input, normalizes email, and rejects injected ownership', () => {
    expect(
      RegisterInput.parse({
        email: ' AUTHOR@EXAMPLE.TEST ',
        displayName: ' Author ',
        password: 'a long passphrase!',
      }).email,
    ).toBe('author@example.test');
    expect(ProjectInput.safeParse({ title: 'World', workspaceId: 'foreign' }).success).toBe(false);
    expect(ProjectInput.safeParse({ title: ' ' }).success).toBe(false);
    expect(ListQuery.safeParse({ limit: 500 }).success).toBe(false);
  });
  it('partial updates never clear omitted creative content', () => {
    expect(ProjectPatch.parse({ archived: true })).toEqual({ archived: true });
    expect(StoryPatch.parse({ title: 'Changed' })).toEqual({ title: 'Changed' });
    expect(ProjectPatch.safeParse({}).success).toBe(false);
  });
  it('accepts only explicit bounded version preconditions and validated cursor positions', () => {
    expect(expectedVersion('"12"')).toBe(12);
    for (const invalid of [null, '12', '*', '"0"', '"-1"', '"1", "2"'])
      expect(expectedVersion(invalid)).toBeNull();
    const row = {
      id: 'd7ac4d24-8069-43e6-a423-6f58669d82f1',
      createdAt: new Date('2026-11-13T00:00:00.000Z'),
    };
    expect(decodeCursor(encodeCursor(row))).toEqual(row);
    expect(decodeCursor('bad')).toBeNull();
  });
});
