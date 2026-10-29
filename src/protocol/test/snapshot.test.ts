import { createMatch, step, type MatchState, type SimEvent } from '@tank/sim';
import { describe, expect, test } from 'vitest';
import { SNAPSHOT_FIELDS, snapshotOf } from '../src';

function playing(): MatchState {
  const state = createMatch(
    { mode: 'lastOneStanding', aiCount: 2, rounds: 3, mortars: true, maps: { kind: 'random' }, humans: 2 },
    7,
  );
  while (state.phase === 'countdown') step(state, {});
  return state;
}

describe('snapshots', () => {
  test('hold exactly the dynamic fields, plus the events', () => {
    const state = playing();
    const snap = snapshotOf(state, []);
    expect(Object.keys(snap).sort()).toEqual([...SNAPSHOT_FIELDS, 'events'].sort());
    for (const field of SNAPSHOT_FIELDS) expect(snap[field]).toEqual(state[field]);
    for (const left of [
      'board',
      'boards',
      'nav',
      'rng',
      'aiRng',
      'mapRng',
      'ai',
      'maps',
      'config',
      'options',
    ]) {
      expect(snap).not.toHaveProperty(left);
    }
  });

  test('carry every event given, in order', () => {
    const state = playing();
    const events: SimEvent[] = [];
    for (let i = 0; i < 120; i++) {
      events.push(
        ...step(state, {
          p1: { throttle: 1, turn: 0, fire: i % 20 === 0 },
          p2: { throttle: 0, turn: 1, fire: true },
        }),
      );
    }
    expect(events.length).toBeGreaterThan(2);
    expect(snapshotOf(state, events).events).toEqual(events);
  });

  test('are copies, unaffected by later steps', () => {
    const state = playing();
    const snap = snapshotOf(state, []);
    const x = snap.tanks[0]!.x;
    for (let i = 0; i < 30; i++) step(state, { p1: { throttle: 1, turn: 0, fire: false } });
    expect(state.tanks[0]!.x).not.toBe(x);
    expect(snap.tanks[0]!.x).toBe(x);
  });

  test('are small enough to send 30 times a second', () => {
    const state = playing();
    expect(JSON.stringify(snapshotOf(state, [])).length).toBeLessThan(2048);
  });
});
