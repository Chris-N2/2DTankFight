import { describe, expect, test } from 'vitest';
import { cloneState, createMatch, PROVING_GROUND, step, type SimEvent, type TankInput } from '../src';
import { ofType } from './helpers';

/** A deterministic but busy human input script. */
function scripted(tick: number): TankInput {
  return {
    throttle: tick % 150 < 100 ? 1 : tick % 150 < 120 ? -1 : 0,
    turn: tick % 70 < 20 ? -1 : tick % 70 < 35 ? 1 : 0,
    fire: tick % 17 < 3,
  };
}

function run(seed: number, ticks: number): { state: unknown; events: SimEvent[] } {
  const state = createMatch({ aiCount: 4, rounds: 7 }, PROVING_GROUND, seed);
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) events.push(...step(state, { p1: scripted(i) }));
  return { state: cloneState(state), events };
}

describe('simulation: determinism', () => {
  test('Deterministic replay', () => {
    const a = run(12345, 1200);
    const b = run(12345, 1200);
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
    expect(a.events.length).toBeGreaterThan(0);
  });

  test('Randomness is seeded: different seeds diverge', () => {
    expect(run(1, 300).state).not.toEqual(run(2, 300).state);
  });

  test('Runs headless in Node', () => {
    // No DOM here: this test runs in Vitest's Node environment.
    expect(typeof (globalThis as Record<string, unknown>)['document']).toBe('undefined');
    const state = createMatch({ aiCount: 4, rounds: 1 }, PROVING_GROUND, 2026);
    const events: SimEvent[] = [];
    for (let i = 0; i < 120 * 60 && state.phase !== 'gameOver'; i++) events.push(...step(state, {}));
    expect(ofType(events, 'roundEnded')).toHaveLength(1);
    expect(state.phase).toBe('gameOver');
  });
});
