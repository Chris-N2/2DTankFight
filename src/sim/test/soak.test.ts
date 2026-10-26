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
      const state = createMatch({ aiCount: 4, rounds: 1 }, PROVING_GROUND, seed);
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
        const state = createMatch({ aiCount, rounds: 1 }, PROVING_GROUND, seed);
        state.phase = 'playing';
        let tick = 0;
        for (; tick < TIME_LIMIT_TICKS && state.phase === 'playing'; tick++) step(state, {});
        expect(tick, `${aiCount} AI, seed ${seed} did not finish`).toBeLessThan(TIME_LIMIT_TICKS);
      }
    }
  }, 120_000);
});
