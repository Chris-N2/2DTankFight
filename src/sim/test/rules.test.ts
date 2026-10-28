import { describe, expect, test } from 'vitest';
import {
  createMatch,
  PROVING_GROUND,
  step,
  validateOptions,
  type MatchState,
  type RoundOutcome,
} from '../src';
import {
  addShell,
  cfg,
  count,
  finishRound,
  ofType,
  place,
  playing,
  skipToPlay,
  tank,
  matchOn,
  withMaps,
} from './helpers';

const COUNTDOWN_TICKS = Math.round(cfg.countdownDuration * cfg.tickRate);
const RESULT_TICKS = Math.round(cfg.roundResultDuration * cfg.tickRate);

function playOut(rounds: number, outcomes: RoundOutcome[]): MatchState {
  const state = matchOn({ mode: 'lastOneStanding', aiCount: 2, rounds, mortars: false }, PROVING_GROUND, 77);
  for (const o of outcomes) finishRound(state, o);
  return state;
}

describe('last-one-standing: game options', () => {
  test('Valid options accepted', () => {
    const options = withMaps({ mode: 'lastOneStanding', aiCount: 4, rounds: 5, mortars: true });
    expect(validateOptions(options)).toBeNull();
    const state = createMatch(options, 1);
    expect(state.tanks.filter((t) => t.kind === 'ai')).toHaveLength(4);
    expect(state.tanks.filter((t) => t.kind === 'human')).toHaveLength(1);
    expect(state.tanks.every((t) => t.mortars === 1)).toBe(true);
    expect(state.options).toMatchObject({
      mode: 'lastOneStanding',
      rounds: 5,
      mortars: true,
      maps: { kind: 'random' },
    });
  });

  test('Out-of-range options rejected', () => {
    for (const options of [
      { mode: 'lastOneStanding' as const, aiCount: 0, rounds: 5, mortars: false },
      { mode: 'lastOneStanding' as const, aiCount: 5, rounds: 5, mortars: false },
      { mode: 'lastOneStanding' as const, aiCount: 2, rounds: 0, mortars: false },
      { mode: 'lastOneStanding' as const, aiCount: 2, rounds: 2, mortars: false },
      { mode: 'lastOneStanding' as const, aiCount: 2, rounds: 4, mortars: false },
      { mode: 'lastOneStanding' as const, aiCount: 2, rounds: 9, mortars: false },
      { mode: 'lastOneStanding' as const, aiCount: 1.5, rounds: 3, mortars: false },
    ]) {
      expect(validateOptions(withMaps(options))).not.toBeNull();
      expect(() => matchOn(options, PROVING_GROUND, 1)).toThrow();
    }
    for (const rounds of [1, 3, 5, 7])
      expect(
        validateOptions(withMaps({ mode: 'lastOneStanding', aiCount: 1, rounds, mortars: false })),
      ).toBeNull();
  });
});

describe('last-one-standing: round start', () => {
  test('Countdown freezes tanks', () => {
    const state = matchOn(
      { mode: 'lastOneStanding', aiCount: 4, rounds: 3, mortars: false },
      PROVING_GROUND,
      8,
    );
    expect(state.phase).toBe('countdown');
    const before = JSON.stringify(state.tanks);
    for (let i = 0; i < COUNTDOWN_TICKS - 1; i++) {
      const events = step(state, { p1: { throttle: 1, turn: 1, fire: i % 2 === 0 } });
      expect(events).toHaveLength(0);
    }
    expect(JSON.stringify(state.tanks)).toBe(before);
    expect(state.shells).toHaveLength(0);
    expect(state.phase).toBe('countdown');
    expect(ofType(step(state, {}), 'playStarted')).toHaveLength(1);
    expect(state.phase).toBe('playing');
  });

  test('Full health at round start', () => {
    const state = matchOn(
      { mode: 'lastOneStanding', aiCount: 3, rounds: 5, mortars: false },
      PROVING_GROUND,
      4,
    );
    for (const t of state.tanks) expect(t.hp).toBe(cfg.tankMaxHp);
    finishRound(state, 'human');
    skipToPlay(state);
    for (const t of state.tanks) {
      expect(t.alive).toBe(true);
      expect(t.hp).toBe(cfg.tankMaxHp);
    }
  });
});

describe('last-one-standing: round end and scoring', () => {
  test('Human wins the round', () => {
    const state = playing(undefined, 1);
    tank(state, 'ai1').hp = 0;
    const events = step(state, {});
    expect(ofType(events, 'roundEnded')[0]).toMatchObject({ outcome: 'human', scores: { human: 1, ai: 0 } });
    expect(state.scores).toEqual({ human: 1, ai: 0 });
    expect(state.phase).toBe('roundOver');
  });

  test('Human eliminated', () => {
    const state = playing(undefined, 3);
    tank(state, 'p1').hp = 0;
    tank(state, 'ai1').hp = 0; // one AI goes down too; two remain
    const events = step(state, {});
    expect(state.tanks.filter((t) => t.kind === 'ai' && t.alive)).toHaveLength(2);
    expect(ofType(events, 'roundEnded')[0]).toMatchObject({ outcome: 'ai' });
    expect(state.scores).toEqual({ human: 0, ai: 1 });
    expect(state.phase).toBe('roundOver'); // ended immediately, without waiting for the AI to finish each other off
  });

  test('Mutual destruction', () => {
    const state = playing(undefined, 1);
    const p1 = place(state, 'p1', 200, 300, 0);
    const ai1 = place(state, 'ai1', 400, 300, Math.PI);
    p1.hp = 1;
    ai1.hp = 1;
    // Both shells are already in flight towards each tank and arrive in the same tick.
    addShell(state, 300, 300, 0, { ownerId: 'p1' });
    addShell(state, 300, 300, Math.PI, { ownerId: 'ai1' });
    let ended: ReturnType<typeof ofType<'roundEnded'>> = [];
    for (let i = 0; i < 60 && ended.length === 0; i++) ended = ofType(step(state, {}), 'roundEnded');
    expect(ended[0]).toMatchObject({ outcome: 'draw', scores: { human: 0, ai: 0 } });
    expect(state.roundsPlayed).toBe(1);
  });

  test('Shells after round end have no effect', () => {
    const state = playing(undefined, 1);
    const p1 = place(state, 'p1', 200, 300, 0);
    tank(state, 'ai1').hp = 0;
    addShell(state, 300, 300, Math.PI, { ownerId: 'ai1' }); // heading straight for p1
    step(state, {});
    expect(state.phase).toBe('roundOver');
    const shellBefore = JSON.stringify(state.shells);
    const events = [];
    for (let i = 0; i < RESULT_TICKS - 1; i++) events.push(...step(state, {}));
    expect(JSON.stringify(state.shells)).toBe(shellBefore); // frozen
    expect(p1.hp).toBe(cfg.tankMaxHp);
    expect(count(events, 'hit')).toBe(0);
    expect(state.scores).toEqual({ human: 1, ai: 0 });
  });

  test('every finished round counts towards rounds played', () => {
    const state = playOut(7, ['human', 'draw', 'ai']);
    expect(state.roundsPlayed).toBe(3);
    expect(state.scores).toEqual({ human: 1, ai: 1 });
  });
});

describe('last-one-standing: game end', () => {
  test('Majority clinches the game', () => {
    const state = playOut(5, ['human', 'ai', 'human']);
    expect(state.phase).not.toBe('gameOver');
    const events = finishRound(state, 'human');
    expect(state.phase).toBe('gameOver');
    expect(state.result).toBe('win');
    expect(state.roundsPlayed).toBe(4);
    expect(ofType(events, 'gameEnded')[0]).toMatchObject({ result: 'win', scores: { human: 3, ai: 1 } });
  });

  test('AI clinches the game', () => {
    const state = playOut(5, ['ai', 'ai', 'ai']);
    expect(state.phase).toBe('gameOver');
    expect(state.result).toBe('loss');
    expect(state.roundsPlayed).toBe(3);
  });

  test('Early end despite draws', () => {
    const state = playOut(5, ['draw', 'draw', 'human']);
    expect(state.phase).not.toBe('gameOver'); // 1–0 with two to play: still open
    finishRound(state, 'human');
    expect(state.phase).toBe('gameOver');
    expect(state.result).toBe('win');
    expect(state.scores).toEqual({ human: 2, ai: 0 });
  });

  test('Drawn game', () => {
    const state = playOut(3, ['human', 'ai', 'draw']);
    expect(state.phase).toBe('gameOver');
    expect(state.result).toBe('draw');
    expect(state.scores).toEqual({ human: 1, ai: 1 });
  });

  test('a single-round game ends after one round', () => {
    const state = playOut(1, ['ai']);
    expect(state.result).toBe('loss');
  });

  test('nothing happens after the game is over', () => {
    const state = playOut(1, ['human']);
    const snapshot = JSON.stringify({ ...state, tick: 0 });
    for (let i = 0; i < 300; i++)
      expect(step(state, { p1: { throttle: 1, turn: 0, fire: true } })).toHaveLength(0);
    expect(JSON.stringify({ ...state, tick: 0 })).toBe(snapshot);
  });
});

describe('last-one-standing: rounds are independent', () => {
  test('Fresh round', () => {
    const state = matchOn(
      { mode: 'lastOneStanding', aiCount: 2, rounds: 5, mortars: false },
      PROVING_GROUND,
      31,
    );
    const configBefore = JSON.stringify(state.config);
    skipToPlay(state);
    for (let i = 0; i < 30; i++) step(state, {}); // let the AI build up some memory
    tank(state, 'p1').hp = 1;
    finishRound(state, 'human');
    expect(tank(state, 'p1').hp).toBe(1);
    const events = skipToPlay(state);
    expect(ofType(events, 'roundStarted')[0]).toMatchObject({ round: 2 });
    expect(tank(state, 'p1').hp).toBe(cfg.tankMaxHp);
    expect(state.shells).toHaveLength(0);
    expect(JSON.stringify(state.config)).toBe(configBefore); // AI difficulty unchanged
    for (const id of ['ai1', 'ai2']) expect(state.ai[id]).toMatchObject({ targetId: null, path: [] });
    expect(state.scores).toEqual({ human: 1, ai: 0 });
  });
});
