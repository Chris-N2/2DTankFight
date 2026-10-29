import { describe, expect, test } from 'vitest';
import { BUILT_IN_BOARDS, PROVING_GROUND, step, type Board, type MatchState, type TankInput } from '../src';
import { think } from '../src/ai/think';
import { circleInBounds, circleRectOverlap } from '../src/geometry';
import { stepWorld } from '../src/world';
import { cfg, matchOn } from './helpers';

const TIME_LIMIT_TICKS = 90 * cfg.tickRate;

/** Seeds that once froze an AI tank for good (QA finding B1), kept as regressions. */
const FROZE_AI_ONLY = [242];
const FROZE_IDLE_HUMAN: Record<number, number[]> = {
  1: [95, 126, 132, 266, 269, 333, 425],
  2: [240, 255, 415, 417],
  3: [32, 33, 39, 50, 390],
};

/**
 * Every built-in board is soaked. Proving Ground gets the full run, plus the regression seeds found on it; the other
 * boards get a fifth of the seeds, which keeps the suite quick while still catching a board the AI can't cope with.
 */
function seeds(board: Board, count: number, extra: number[] = []): number[] {
  if (board !== PROVING_GROUND) return Array.from({ length: Math.ceil(count / 5) }, (_, i) => i + 1);
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
  for (const board of BUILT_IN_BOARDS) {
    test(`${board.name}: AI-only rounds all finish, with no tank ever inside a wall`, () => {
      for (const seed of seeds(board, 50, FROZE_AI_ONLY)) {
        const state = matchOn(
          { mode: 'lastOneStanding', aiCount: 4, rounds: 1, mortars: false },
          board,
          seed,
        );
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

    test(`${board.name}: rounds with a human who never moves all finish`, () => {
      // Hiding is a real tactic, so the AI must find and finish off a still target rather than freezing.
      for (const aiCount of [1, 2, 3, 4]) {
        for (const seed of seeds(board, 25, FROZE_IDLE_HUMAN[aiCount])) {
          const state = matchOn({ mode: 'lastOneStanding', aiCount, rounds: 1, mortars: false }, board, seed);
          state.phase = 'playing';
          let tick = 0;
          for (; tick < TIME_LIMIT_TICKS && state.phase === 'playing'; tick++) step(state, {});
          expect(tick, `${aiCount} AI, seed ${seed} did not finish`).toBeLessThan(TIME_LIMIT_TICKS);
        }
      }
    }, 120_000);
  }
});

describe('mortars: soak', () => {
  for (const board of BUILT_IN_BOARDS) {
    test(`${board.name}: with mortars on, AI-only and idle-human rounds all finish, with no tank ever inside a wall`, () => {
      // Lobbing stops an AI in its tracks for a moment; it mustn't leave one stuck there.
      for (const seed of seeds(board, 25)) {
        const aiOnly = matchOn(
          { mode: 'lastOneStanding', aiCount: 4, rounds: 1, mortars: true },
          board,
          seed,
        );
        aiOnly.phase = 'playing';
        aiOnly.tanks[0]!.alive = false;
        let tick = 0;
        for (; tick < TIME_LIMIT_TICKS && aiOnly.tanks.filter((t) => t.alive).length > 1; tick++) {
          const inputs: Record<string, TankInput> = {};
          for (const t of aiOnly.tanks) if (t.alive) inputs[t.id] = think(aiOnly, t);
          stepWorld(aiOnly, inputs, []);
          expectNoTankInWalls(aiOnly);
        }
        expect(tick, `AI-only, seed ${seed} did not finish`).toBeLessThan(TIME_LIMIT_TICKS);

        for (const aiCount of [2, 4]) {
          const state = matchOn({ mode: 'lastOneStanding', aiCount, rounds: 1, mortars: true }, board, seed);
          state.phase = 'playing';
          let t = 0;
          for (; t < TIME_LIMIT_TICKS && state.phase === 'playing'; t++) step(state, {});
          expect(t, `${aiCount} AI, seed ${seed} did not finish`).toBeLessThan(TIME_LIMIT_TICKS);
        }
      }
    }, 120_000);
  }
});

describe('two players: soak', () => {
  for (const board of BUILT_IN_BOARDS) {
    test(`${board.name}: two-player games with humans who never move all end, with no tank ever inside a wall`, () => {
      for (const seed of seeds(board, 10)) {
        for (const options of [
          { mode: 'lastOneStanding', aiCount: 3, rounds: 1, mortars: true, humans: 2 },
          { mode: 'waves', startAiCount: 3, mortars: true, humans: 2 },
        ] as const) {
          const state = matchOn(options, board, seed);
          // If the AI tanks finish each other off in Last One Standing, two still humans would play on for ever:
          // the round is theirs to fight out, so the AI's part is done.
          const aiDone = (): boolean =>
            state.phase === 'playing' && !state.tanks.some((t) => t.kind === 'ai' && t.alive);
          let tick = 0;
          for (; tick < TIME_LIMIT_TICKS && state.phase !== 'gameOver' && !aiDone(); tick++) {
            step(state, {});
            expectNoTankInWalls(state);
          }
          expect(tick, `${options.mode}, seed ${seed} did not end`).toBeLessThan(TIME_LIMIT_TICKS);
        }
      }
    }, 120_000);

    test(`${board.name}: two-player Waves keep moving with both humans driving`, () => {
      // Two unkillable humans driven by the AI's own brain, so waves keep being cleared with two targets about. The
      // brain treats every other tank as an enemy, so each human's partner is hidden from it while it thinks.
      for (const seed of seeds(board, 2)) {
        const state = matchOn({ mode: 'waves', startAiCount: 1, mortars: true, humans: 2 }, board, seed);
        let waveTicks = 0;
        let wave = state.round;
        while (state.round < 6) {
          expect(state.phase, `seed ${seed}: a human was destroyed for good`).not.toBe('gameOver');
          const inputs: Record<string, TankInput> = {};
          const humans = state.tanks.filter((t) => t.kind === 'human');
          for (const human of humans) {
            human.hp = 1000;
            if (state.phase !== 'playing') continue;
            const partner = humans.find((t) => t !== human)!;
            const tanks = state.tanks;
            state.tanks = tanks.filter((t) => t !== partner);
            inputs[human.id] = think(state, human);
            state.tanks = tanks;
          }
          step(state, inputs);
          expectNoTankInWalls(state);
          if (state.round !== wave) {
            wave = state.round;
            waveTicks = 0;
          }
          expect(++waveTicks, `seed ${seed} stalled in wave ${wave}`).toBeLessThan(TIME_LIMIT_TICKS);
        }
      }
    }, 120_000);
  }
});

describe('waves: soak', () => {
  for (const board of BUILT_IN_BOARDS) {
    test(`${board.name}: Waves games with a human who never moves all end, with no tank ever inside a wall`, () => {
      // Co-operating AI tanks converge on the same target, so this is where allies blocking each other's
      // lanes would show up as a freeze.
      for (const startAiCount of [1, 2, 3, 4]) {
        for (const seed of seeds(board, 25)) {
          const state = matchOn({ mode: 'waves', startAiCount, mortars: false }, board, seed);
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

    test(`${board.name}: Waves run through every escalation step without stalling`, () => {
      // An unkillable human, driven by the AI's own brain, so the waves keep being cleared and the
      // escalated waves (thicker armour, harder hits, faster shells) all get played.
      const LAST_WAVE = 16;
      for (const startAiCount of [1, 4]) {
        for (const seed of seeds(board, 2)) {
          const state = matchOn({ mode: 'waves', startAiCount, mortars: false }, board, seed);
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
  }
});
