import { describe, expect, test } from 'vitest';
import { cloneState, PROVING_GROUND, step, type SimEvent, type TankInput } from '../src';
import { ofType, matchOn, type GameOptions } from './helpers';

/** A deterministic but busy human input script. */
function scripted(tick: number): TankInput {
  return {
    throttle: tick % 150 < 100 ? 1 : tick % 150 < 120 ? -1 : 0,
    turn: tick % 70 < 20 ? -1 : tick % 70 < 35 ? 1 : 0,
    fire: tick % 17 < 3,
    mortar: tick % 400 > 360,
  };
}

function run(
  seed: number,
  ticks: number,
  options: GameOptions = { mode: 'lastOneStanding', aiCount: 4, rounds: 7, mortars: false },
): { state: unknown; events: SimEvent[] } {
  const state = matchOn(options, PROVING_GROUND, seed);
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) events.push(...step(state, { p1: scripted(i), p2: scripted(i + 75) }));
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

  test('Deterministic replay in Waves', () => {
    const options: GameOptions = { mode: 'waves', startAiCount: 2, mortars: false };
    const a = run(2468, 3000, options);
    const b = run(2468, 3000, options);
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
    expect(a.events.length).toBeGreaterThan(0);
  });

  test('Deterministic replay with mortars', () => {
    for (const options of [
      { mode: 'lastOneStanding', aiCount: 4, rounds: 7, mortars: true },
      { mode: 'waves', startAiCount: 2, mortars: true },
    ] satisfies GameOptions[]) {
      const a = run(777, 3000, options);
      const b = run(777, 3000, options);
      expect(a.state).toEqual(b.state);
      expect(a.events).toEqual(b.events);
      expect(ofType(a.events, 'mortarLaunched').length).toBeGreaterThan(0);
    }
  });

  test('Deterministic replay with two humans', () => {
    for (const options of [
      { mode: 'lastOneStanding', aiCount: 3, rounds: 7, mortars: true, humans: 2 },
      { mode: 'waves', startAiCount: 2, mortars: true, humans: 2 },
    ] satisfies GameOptions[]) {
      const a = run(4321, 3000, options);
      const b = run(4321, 3000, options);
      expect(a.state).toEqual(b.state);
      expect(a.events).toEqual(b.events);
    }
  });

  test('Randomness is seeded: different seeds diverge', () => {
    expect(run(1, 300).state).not.toEqual(run(2, 300).state);
  });

  test('Runs headless in Node', () => {
    // No DOM here: this test runs in Vitest's Node environment.
    expect(typeof (globalThis as Record<string, unknown>)['document']).toBe('undefined');
    const state = matchOn(
      { mode: 'lastOneStanding', aiCount: 4, rounds: 1, mortars: false },
      PROVING_GROUND,
      2026,
    );
    const events: SimEvent[] = [];
    for (let i = 0; i < 120 * 60 && state.phase !== 'gameOver'; i++) events.push(...step(state, {}));
    expect(ofType(events, 'roundEnded')).toHaveLength(1);
    expect(state.phase).toBe('gameOver');
  });
});
