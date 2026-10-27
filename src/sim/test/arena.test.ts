import { describe, expect, test } from 'vitest';
import { BUILT_IN_BOARDS, createMatch, PROVING_GROUND, validateBoard, type Board } from '../src';
import { cfg, finishRound, makeBoard, skipToPlay, tank } from './helpers';

const sixBlocks = [
  { x: 150, y: 150, w: 40, h: 40 },
  { x: 300, y: 150, w: 40, h: 40 },
  { x: 450, y: 150, w: 40, h: 40 },
  { x: 150, y: 400, w: 40, h: 40 },
  { x: 300, y: 400, w: 40, h: 40 },
  { x: 450, y: 400, w: 40, h: 40 },
];

describe('arena: board definition', () => {
  test('Board loads from data', () => {
    const state = createMatch(
      { mode: 'lastOneStanding', aiCount: 4, rounds: 5, mortars: false },
      PROVING_GROUND,
      3,
    );
    expect(state.board).toEqual(PROVING_GROUND);
    expect(state.nav.cols * state.nav.rows).toBe(state.nav.walkable.length);
    const spawnKeys = PROVING_GROUND.spawns.map((s) => `${s.x},${s.y}`);
    for (const t of state.tanks) expect(spawnKeys).toContain(`${t.x},${t.y}`);
  });
});

describe('arena: board validity', () => {
  test('Built-in board passes validation', () => {
    expect(BUILT_IN_BOARDS.length).toBeGreaterThan(0);
    for (const board of BUILT_IN_BOARDS) expect(validateBoard(board)).toEqual({ ok: true, errors: [] });
  });

  test('Sealed spawn is rejected', () => {
    // Spawn 0 matters too: it mustn't be treated as the reference point everything else is measured from.
    for (const sealed of [2, 0]) {
      const board = makeBoard(sixBlocks);
      const s = board.spawns[sealed]!;
      // A box around the spawn with walls 10 units thick and a 40-unit gap all round.
      board.obstacles.push(
        { x: s.x - 50, y: s.y - 50, w: 100, h: 10 },
        { x: s.x - 50, y: s.y + 40, w: 100, h: 10 },
        { x: s.x - 50, y: s.y - 50, w: 10, h: 100 },
        { x: s.x + 40, y: s.y - 50, w: 10, h: 100 },
      );
      const result = validateBoard(board);
      expect(result.ok).toBe(false);
      const unreachable = result.errors.filter((e) => e.includes('unreachable'));
      expect(unreachable).toEqual([`Spawn ${sealed} is unreachable from the other spawn points.`]);
    }
  });

  test('Too few obstacles is rejected', () => {
    const board = makeBoard(sixBlocks.slice(0, 3));
    const result = validateBoard(board);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('obstacles'))).toBe(true);
  });

  test('spawns that are too close together are rejected', () => {
    const board: Board = makeBoard(sixBlocks);
    board.spawns[1] = { x: 100, y: 60, heading: 0 };
    expect(validateBoard(board).errors.some((e) => e.includes('apart'))).toBe(true);
  });

  test('a spawn without room for a tank is rejected', () => {
    const board: Board = makeBoard(sixBlocks);
    board.spawns[4] = { x: 170, y: 170 - cfg.tankRadius, heading: 0 };
    expect(validateBoard(board).errors.some((e) => e.includes('room'))).toBe(true);
  });
});

describe('arena: single built-in board', () => {
  test('Same board each round', () => {
    const state = createMatch(
      { mode: 'lastOneStanding', aiCount: 2, rounds: 5, mortars: false },
      PROVING_GROUND,
      5,
    );
    finishRound(state, 'human');
    finishRound(state, 'ai');
    skipToPlay(state);
    expect(state.round).toBe(3);
    expect(state.board).toEqual(PROVING_GROUND);
  });
});

describe('arena: spawn assignment', () => {
  test('Distinct spawns', () => {
    const state = createMatch(
      { mode: 'lastOneStanding', aiCount: 4, rounds: 5, mortars: false },
      PROVING_GROUND,
      11,
    );
    const keys = new Set(state.tanks.map((t) => `${t.x},${t.y}`));
    expect(keys.size).toBe(5);
    for (const t of state.tanks) {
      const spawn = PROVING_GROUND.spawns.find((s) => s.x === t.x && s.y === t.y);
      expect(spawn).toBeDefined();
      expect(t.heading).toBe(spawn!.heading);
    }
  });

  test('Spawns vary between rounds', () => {
    const humanSpawns = (seed: number): string[] => {
      const state = createMatch(
        { mode: 'lastOneStanding', aiCount: 4, rounds: 7, mortars: false },
        PROVING_GROUND,
        seed,
      );
      const seen: string[] = [];
      for (let r = 0; r < 6; r++) {
        skipToPlay(state); // the next round (and its spawn assignment) has begun
        expect(state.round).toBe(r + 1);
        const p1 = tank(state, 'p1');
        seen.push(`${p1.x},${p1.y}`);
        finishRound(state, r % 2 === 0 ? 'human' : 'ai');
      }
      return seen;
    };
    const a = humanSpawns(2024);
    expect(new Set(a).size).toBeGreaterThan(1);
    expect(humanSpawns(2024)).toEqual(a); // reproducible for a given seed
  });
});
