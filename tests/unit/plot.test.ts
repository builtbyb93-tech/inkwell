import { describe, it, expect } from 'vitest';
import {
  PlotGroupInput,
  PlotGroupPatch,
  SceneInput,
  ScenePatch,
  SceneMove,
  PlotQuery,
  plainDocument,
} from '@inkwell/contracts';
import { moveSceneOrder, encodePlotCursor, decodePlotCursor } from '@inkwell/domain';
describe('portable plot contracts and canonical movement', () => {
  it('rejects ownership/scope injection and separates scene edits from structural moves', () => {
    expect(
      PlotGroupInput.safeParse({ title: 'Act', workspaceId: crypto.randomUUID() }).success,
    ).toBe(false);
    expect(PlotGroupPatch.safeParse({ storyId: crypto.randomUUID() }).success).toBe(false);
    expect(
      SceneInput.safeParse({ title: 'Scene', content: plainDocument(''), position: 9 }).success,
    ).toBe(false);
    expect(ScenePatch.safeParse({ groupId: crypto.randomUUID() }).success).toBe(false);
    expect(ScenePatch.safeParse({ duplicatedFromId: crypto.randomUUID() }).success).toBe(false);
    expect(ScenePatch.parse({ archived: true })).toEqual({ archived: true });
    expect(SceneMove.safeParse({}).success).toBe(false);
    expect(SceneMove.safeParse({ direction: 'EARLIER', beforeId: null }).success).toBe(false);
    expect(SceneMove.parse({ groupId: null })).toEqual({ groupId: null });
    expect(PlotQuery.safeParse({ limit: 101 }).success).toBe(false);
  });
  it('moves by canonical adjacency across archived rows and never removes a record', () => {
    const rows = [
      { id: 'a', archived: false },
      { id: 'b', archived: true },
      { id: 'c', archived: false },
      { id: 'd', archived: false },
    ];
    expect(moveSceneOrder(rows, 'a', { direction: 'LATER' })).toEqual(['b', 'c', 'a', 'd']);
    expect(moveSceneOrder(rows, 'c', { direction: 'EARLIER' })).toEqual(['c', 'a', 'b', 'd']);
    expect(moveSceneOrder(rows, 'd', { beforeId: 'a' })).toEqual(['d', 'a', 'b', 'c']);
    expect(moveSceneOrder(rows, 'a', { beforeId: null })).toEqual(['b', 'c', 'd', 'a']);
    expect(moveSceneOrder(rows, 'c', { beforeId: 'c' })).toEqual(['a', 'b', 'c', 'd']);
    expect(moveSceneOrder(rows, 'a', { direction: 'EARLIER' })).toEqual(['a', 'b', 'c', 'd']);
    expect(moveSceneOrder(rows, 'd', { direction: 'LATER' })).toEqual(['a', 'b', 'c', 'd']);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(() => moveSceneOrder(rows, 'b', { beforeId: null })).toThrow();
    expect(() => moveSceneOrder(rows, 'a', { beforeId: 'b' })).toThrow();
    expect(() => moveSceneOrder(rows, 'a', { beforeId: 'foreign' })).toThrow();
  });
  it('binds bounded plot cursors to a structural revision', () => {
    expect(decodePlotCursor(encodePlotCursor(12, 9))).toEqual({ position: 12, sequenceVersion: 9 });
    for (const p of [
      { position: -1, sequenceVersion: 1 },
      { position: 1.5, sequenceVersion: 1 },
      { position: 1, sequenceVersion: -1 },
      { position: 1, sequenceVersion: 2, foreign: true },
    ])
      expect(decodePlotCursor(btoa(JSON.stringify(p)))).toBeNull();
    expect(decodePlotCursor('invalid')).toBeNull();
    expect(decodePlotCursor('x'.repeat(513))).toBeNull();
  });
});
