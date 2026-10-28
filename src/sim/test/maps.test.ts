import { describe, expect, test } from 'vitest';
import {
  BUILT_IN_BOARDS,
  cloneState,
  createMatch,
  step,
  validateOptions,
  type MapOptions,
  type MatchOptions,
  type MatchState,
} from '../src';
import { buildNavGrid } from '../src/nav';
import { cfg, finishRound, makeBoard, skipToPlay, tank } from './helpers';

const sequence = (...ids: string[]): MapOptions => ({ kind: 'sequence', ids });
const RANDOM: MapOptions = { kind: 'random' };

const los = (maps: MapOptions, rounds = 7): MatchOptions => ({
  mode: 'lastOneStanding',
  aiCount: 2,
  rounds,
  mortars: false,
  maps,
});
const waves = (maps: MapOptions): MatchOptions => ({ mode: 'waves', startAiCount: 1, mortars: false, maps });

/**
 * The board each of the first `count` rounds or waves is played on. Last One Standing rounds are drawn, so the game
 * runs to its full length; waves are cleared.
 */
function boardsPlayed(state: MatchState, count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    skipToPlay(state);
    ids.push(state.board.id);
    if (i < count - 1) finishRound(state, state.options.mode === 'waves' ? 'human' : 'draw');
  }
  return ids;
}

describe('map selection: map mode option', () => {
  test('Valid sequence accepted', () => {
    const options = los(sequence('pac-tank', 'run-for-cover', 'pac-tank'), 5);
    expect(validateOptions(options)).toBeNull();
    expect(() => createMatch(options, 1)).not.toThrow();
  });

  test('Sequence longer than the rounds rejected', () => {
    const options = los(sequence('pac-tank', 'run-for-cover', 'pac-tank', 'proving-ground'), 3);
    expect(validateOptions(options)).toMatch(/longer than the number of rounds/);
    expect(() => createMatch(options, 1)).toThrow(/longer than the number of rounds/);
  });

  test('Waves sequence limit', () => {
    const eight = sequence(...Array<string>(8).fill('pac-tank'));
    expect(validateOptions(waves(eight))).toMatch(/at most 7/);
    expect(() => createMatch(waves(eight), 1)).toThrow(/at most 7/);
    expect(validateOptions(waves(sequence()))).toMatch(/at least one map/);
    expect(() => createMatch(waves(sequence()), 1)).toThrow(/at least one map/);
    expect(validateOptions(waves(sequence(...Array<string>(7).fill('pac-tank'))))).toBeNull();
  });

  test('Unknown map rejected', () => {
    const options = los(sequence('pac-tank', 'the-moon'));
    expect(validateOptions(options)).toMatch(/Unknown map: the-moon/);
    expect(() => createMatch(options, 1)).toThrow(/Unknown map/);
  });

  test('Unknown map mode rejected', () => {
    for (const maps of [{ kind: 'shuffle' }, { kind: 'sequence' }, null, undefined, 'random']) {
      const options = { ...los(RANDOM), maps } as unknown as MatchOptions;
      expect(validateOptions(options)).not.toBeNull();
      expect(() => createMatch(options, 1)).toThrow();
    }
  });

  test('a board without enough spawn points for the match is refused', () => {
    const cramped = { ...makeBoard(), id: 'cramped' };
    cramped.spawns = cramped.spawns.slice(0, 2); // a 3-tank match needs 3
    expect(() => createMatch(los(sequence('cramped')), 1, cfg, [cramped])).toThrow(/too few spawn points/);
    expect(() => createMatch(los(RANDOM), 1, cfg, [makeBoard(), cramped])).toThrow(/too few spawn points/);
  });
});

describe('map selection: board for each round or wave', () => {
  test('Board changes between rounds', () => {
    const state = createMatch(los(sequence('run-for-cover', 'pac-tank')), 1);
    skipToPlay(state);
    expect(state.board.id).toBe('run-for-cover');
    finishRound(state, 'draw');
    skipToPlay(state);
    const pac = BUILT_IN_BOARDS.find((b) => b.id === 'pac-tank')!;
    expect(state.board).toEqual(pac);
    expect(state.nav).toEqual(buildNavGrid(pac, state.config));
    const spawnKeys = pac.spawns.map((s) => `${s.x},${s.y}`);
    for (const t of state.tanks) expect(spawnKeys).toContain(`${t.x},${t.y}`);
  });

  test('Board fixed within a wave', () => {
    const state = createMatch(waves(RANDOM), 3);
    skipToPlay(state);
    const id = state.board.id;
    const obstacles = JSON.stringify(state.board.obstacles);
    for (let i = 0; i < 1200 && state.phase === 'playing'; i++) {
      // Keep the human alive so the wave runs on.
      tank(state, 'p1').hp = tank(state, 'p1').maxHp;
      step(state, {});
      expect(state.board.id).toBe(id);
      expect(JSON.stringify(state.board.obstacles)).toBe(obstacles);
    }
  });
});

describe('map selection: sequence order', () => {
  test('Played in order', () => {
    const state = createMatch(los(sequence('run-for-cover', 'pac-tank', 'proving-ground'), 3), 1);
    expect(boardsPlayed(state, 3)).toEqual(['run-for-cover', 'pac-tank', 'proving-ground']);
  });

  test('Sequence repeats in Waves', () => {
    const state = createMatch(waves(sequence('nowhere-to-hide', 'pac-tank')), 1);
    expect(boardsPlayed(state, 4)).toEqual(['nowhere-to-hide', 'pac-tank', 'nowhere-to-hide', 'pac-tank']);
  });

  test('Sequence repeats in Last One Standing when shorter than the rounds', () => {
    const state = createMatch(los(sequence('pac-tank', 'run-for-cover'), 5), 1);
    expect(boardsPlayed(state, 5)).toEqual([
      'pac-tank',
      'run-for-cover',
      'pac-tank',
      'run-for-cover',
      'pac-tank',
    ]);
  });

  test('Always this map', () => {
    expect(boardsPlayed(createMatch(los(sequence('pac-tank')), 4), 7)).toEqual(Array(7).fill('pac-tank'));
    expect(boardsPlayed(createMatch(waves(sequence('pac-tank')), 4), 6)).toEqual(Array(6).fill('pac-tank'));
  });

  test('A long game outlasts its sequence', () => {
    const seven = [
      'pac-tank',
      'run-for-cover',
      'proving-ground',
      'nowhere-to-hide',
      'pac-tank',
      'proving-ground',
    ];
    seven.push('run-for-cover');
    const played = boardsPlayed(createMatch(waves(sequence(...seven)), 2), 8);
    expect(played.slice(0, 7)).toEqual(seven);
    expect(played[7]).toBe('pac-tank');
  });
});

describe('map selection: random without repeats', () => {
  const ids = BUILT_IN_BOARDS.map((b) => b.id);

  test('Every map before a repeat', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const played = boardsPlayed(createMatch(waves(RANDOM), seed), ids.length);
      expect([...played].sort()).toEqual([...ids].sort());
    }
  });

  test('No back-to-back repeat', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const played = boardsPlayed(createMatch(waves(RANDOM), seed), ids.length * 3);
      for (let i = 1; i < played.length; i++) expect(played[i]).not.toBe(played[i - 1]);
      // Each shuffled bag still holds every board once.
      for (let bag = 0; bag < 3; bag++) {
        expect(played.slice(bag * ids.length, (bag + 1) * ids.length).sort()).toEqual([...ids].sort());
      }
    }
  });

  test('a one-board catalogue repeats, as it must', () => {
    const only = { ...makeBoard(), id: 'only' };
    expect(boardsPlayed(createMatch(waves(RANDOM), 1, cfg, [only]), 3)).toEqual(['only', 'only', 'only']);
  });
});

describe('map selection: reproducible map choice', () => {
  test('Same seed, same maps', () => {
    const a = boardsPlayed(createMatch(waves(RANDOM), 99), 10);
    const b = boardsPlayed(createMatch(waves(RANDOM), 99), 10);
    expect(a).toEqual(b);
    // ...and the seed does matter.
    const others = [100, 101, 102, 103].map((seed) => boardsPlayed(createMatch(waves(RANDOM), seed), 10));
    expect(others.some((o) => o.join() !== a.join())).toBe(true);
  });

  test('map choice survives cloning the state', () => {
    const state = createMatch(los(RANDOM), 5);
    finishRound(state, 'draw');
    const copy = cloneState(state);
    expect(copy).toEqual(state);
    expect(boardsPlayed(copy, 4)).toEqual(boardsPlayed(state, 4));
  });
});

describe('last one standing: rounds are independent', () => {
  test('New board, same difficulty', () => {
    const state = createMatch(los(sequence('proving-ground', 'pac-tank')), 8);
    skipToPlay(state);
    const before = state.tanks
      .filter((t) => t.kind === 'ai')
      .map(({ maxHp, shellDamage, shellSpeed }) => ({
        maxHp,
        shellDamage,
        shellSpeed,
      }));
    finishRound(state, 'ai');
    skipToPlay(state);
    expect(state.board.id).toBe('pac-tank');
    const after = state.tanks
      .filter((t) => t.kind === 'ai')
      .map(({ maxHp, shellDamage, shellSpeed }) => ({
        maxHp,
        shellDamage,
        shellSpeed,
      }));
    expect(after).toEqual(before);
  });
});
