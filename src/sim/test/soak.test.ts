import { describe, expect, test } from 'vitest';
import { createMatch, PROVING_GROUND, step, type MatchState, type TankInput } from '../src';
import { think } from '../src/ai/think';
import { circleInBounds, circleRectOverlap } from '../src/geometry';
import { stepWorld } from '../src/world';
import { cfg } from './helpers';

const TIME_LIMIT_TICKS = 90 * cfg.tickRate;

/** Seeds that once froze an AI tank for good (QA finding B1), kept as regressions. */
const FROZE_AI_ONLY = [242];
const FROZE_IDLE_HUMAN: Record<number, number[]> = {
  1: [95, 126, 132, 266, 269, 333, 425],
  2: [240, 255, 415, 417],
  3: [32, 33, 39, 50, 390],
};

function seeds(count: number, extra: number[] = []): number[] {
  return [...Array.from({ length: count }, (_, i) => i + 1), ...extra];
}

function expectNoTankInWalls(state: MatchState): void {
  for (const t of state.tanks) {
    if (!t.alive) continue;
    expect(circleInBounds(t.x, t.y, cfg.tankRadius, state.board.width, state.board.height)).toBe(true);
    for (const rect of state.board.obstacles)
      expect(circleRectOverlap(t.x, t.y, cfg.tankRadius, rect)).toBe(false);
  }
}

describe('ai: soak', () => {
  test('AI-only rounds on Proving Ground all finish, with no tank ever inside a wall', () => {
    for (const seed of seeds(50, FROZE_AI_ONLY)) {
      const state = createMatch({ mode: 'lastOneStanding', aiCount: 4, rounds: 1 }, PROVING_GROUND, seed);
      state.phase = 'playing';
      state.tanks[0]!.alive = false; // no human: four AI tanks fight it out

      let tick = 0;
      for (; tick < TIME_LIMIT_TICKS && state.tanks.filter((t) => t.alive).length > 1; tick++) {
        const inputs: Record<string, TankInput> = {};
        for (const t of state.tanks) if (t.alive) inputs[t.id] = think(state, t);
        stepWorld(state, inputs, []);
        expectNoTankInWalls(state);
      }
      expect(tick, `seed ${seed} did not finish`).toBeLessThan(TIME_LIMIT_TICKS);
    }
  }, 120_000);

  test('rounds with a human who never moves all finish', () => {
    // Hiding is a real tactic, so the AI must find and finish off a still target rather than freezing.
    for (const aiCount of [1, 2, 3, 4]) {
      for (const seed of seeds(25, FROZE_IDLE_HUMAN[aiCount])) {
        const state = createMatch({ mode: 'lastOneStanding', aiCount, rounds: 1 }, PROVING_GROUND, seed);
        state.phase = 'playing';
        let tick = 0;
        for (; tick < TIME_LIMIT_TICKS && state.phase === 'playing'; tick++) step(state, {});
        expect(tick, `${aiCount} AI, seed ${seed} did not finish`).toBeLessThan(TIME_LIMIT_TICKS);
      }
    }
  }, 120_000);
});

describe('waves: soak', () => {
  test('Waves games with a human who never moves all end, with no tank ever inside a wall', () => {
    // Co-operating AI tanks converge on the same target, so this is where allies blocking each other's
    // lanes would show up as a freeze.
    for (const startAiCount of [1, 2, 3, 4]) {
      for (const seed of seeds(25)) {
        const state = createMatch({ mode: 'waves', startAiCount }, PROVING_GROUND, seed);
        let tick = 0;
        for (; tick < TIME_LIMIT_TICKS && state.phase !== 'gameOver'; tick++) {
          step(state, {});
          expectNoTankInWalls(state);
        }
        expect(tick, `start ${startAiCount}, seed ${seed} did not end`).toBeLessThan(TIME_LIMIT_TICKS);
        expect(state.result).toBe('over');
      }
    }
  }, 120_000);

  test('Waves run through every escalation step without stalling', () => {
    // An unkillable human, driven by the AI's own brain, so the waves keep being cleared and the
    // escalated waves (thicker armour, harder hits, faster shells) all get played.
    const LAST_WAVE = 16;
    for (const startAiCount of [1, 4]) {
      for (const seed of seeds(2)) {
        const state = createMatch({ mode: 'waves', startAiCount }, PROVING_GROUND, seed);
        const human = state.tanks[0]!;
        let waveTicks = 0;
        let wave = state.round;
        while (state.round < LAST_WAVE) {
          expect(state.phase, `start ${startAiCount}, seed ${seed}: the human was destroyed`).not.toBe(
            'gameOver',
          );
          human.hp = 1000; // more than any wave can take off in one tick, even once a hit is lethal
          const input = state.phase === 'playing' ? think(state, human) : undefined;
          step(state, input ? { p1: input } : {});
          expectNoTankInWalls(state);
          if (state.round !== wave) {
            wave = state.round;
            waveTicks = 0;
          }
          expect(++waveTicks, `start ${startAiCount}, seed ${seed} stalled in wave ${wave}`).toBeLessThan(
            TIME_LIMIT_TICKS,
          );
        }
        expect(state.waves?.cleared).toBe(LAST_WAVE - 1);
      }
    }
  }, 120_000);
});
