import { describe, expect, test } from 'vitest';
import {
  botInput,
  BUILT_IN_BOARDS,
  createMatch,
  IDLE_INPUT,
  step,
  type MatchState,
  type SimEvent,
} from '../src';
import { cfg, makeBoard, matchOn, retire, type GameOptions } from './helpers';

const TWO_LOS: GameOptions = { mode: 'lastOneStanding', aiCount: 3, rounds: 3, mortars: true, humans: 2 };
const TWO_WAVES: GameOptions = { mode: 'waves', startAiCount: 1, mortars: true, humans: 2 };

describe('test bot', () => {
  test('never targets the other human, and never shoots them on purpose', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const state = matchOn(TWO_LOS, makeBoard(), seed);
      // p1 sits still in the open: the easiest target there is, if the bot could see it.
      for (let i = 0; i < 60 * cfg.tickRate && state.phase !== 'gameOver'; i++) {
        const events = step(state, { p2: botInput(state, 'p2') });
        expect(state.ai['p2']?.targetId ?? null, `seed ${seed}`).not.toBe('p1');
        const lob = state.ai['p2']?.lob;
        if (lob) expect(lob.targetId).not.toBe('p1');
        // Only a shell that has bounced may stray onto p1.
        for (const e of events) {
          if (e.type === 'hit' && e.shooterId === 'p2' && e.targetId === 'p1') {
            expect(events.some((b) => b.type === 'bounce' && b.shellId === e.shellId)).toBe(false);
          }
        }
      }
    }
  });

  test('goes after the AI tanks', () => {
    const state = matchOn(TWO_LOS, makeBoard(), 3);
    const shots: SimEvent[] = [];
    for (let i = 0; i < 30 * cfg.tickRate && state.phase !== 'gameOver'; i++) {
      shots.push(...step(state, { p2: botInput(state, 'p2') }).filter((e) => e.type === 'shotFired'));
    }
    expect(shots.some((e) => e.type === 'shotFired' && e.tankId === 'p2')).toBe(true);
  });

  test('is idle for a tank that is destroyed, gone or not a human', () => {
    const state = matchOn(TWO_LOS, makeBoard(), 1);
    expect(botInput(state, 'ai1')).toEqual(IDLE_INPUT);
    expect(botInput(state, 'nobody')).toEqual(IDLE_INPUT);
    retire(state, 'p2');
    expect(botInput(state, 'p2')).toEqual(IDLE_INPUT);
  });

  test('leaves the match untouched apart from its own memory and the AI random numbers', () => {
    const state = matchOn(TWO_LOS, makeBoard(), 1);
    state.phase = 'playing';
    const before = JSON.stringify({ ...state, ai: null, aiRng: null });
    botInput(state, 'p2');
    expect(JSON.stringify({ ...state, ai: null, aiRng: null })).toBe(before);
    expect(state.tanks.map((t) => t.id)).toContain('p1');
  });

  test('soak: two bots playing Waves together keep clearing waves', () => {
    for (const board of BUILT_IN_BOARDS) {
      const state: MatchState = createMatch(
        { ...TWO_WAVES, maps: { kind: 'sequence', ids: [board.id] } } as never,
        board.name.length,
      );
      for (let i = 0; i < 180 * cfg.tickRate && state.phase !== 'gameOver'; i++) {
        step(state, { p1: botInput(state, 'p1'), p2: botInput(state, 'p2') });
      }
      expect(state.waves!.cleared, board.name).toBeGreaterThanOrEqual(1);
    }
  }, 120_000);
});
