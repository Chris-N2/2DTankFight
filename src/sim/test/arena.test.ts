import { describe, expect, test } from 'vitest';
import {
  BUILT_IN_BOARDS,
  NOWHERE_TO_HIDE,
  PAC_TANK,
  PROVING_GROUND,
  RUN_FOR_COVER,
  validateBoard,
  type Board,
} from '../src';
import { GRID, wallsFromGrid } from '../src/boards/grid';
import { cfg, finishRound, makeBoard, skipToPlay, tank, matchOn } from './helpers';

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
    const state = matchOn(
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

describe('arena: built-in boards', () => {
  test('Four boards available', () => {
    expect(BUILT_IN_BOARDS.map((b) => b.name)).toEqual([
      'Proving Ground',
      'Run For Cover',
      'Nowhere (Much) To Hide',
      'Pac-Tank',
    ]);
  });

  test('Built-in boards share a size and have unique ids', () => {
    for (const board of BUILT_IN_BOARDS) {
      expect([board.width, board.height]).toEqual([1200, 800]);
      expect(board.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
    expect(new Set(BUILT_IN_BOARDS.map((b) => b.id)).size).toBe(BUILT_IN_BOARDS.length);
  });

  test('Board loads from data, for every built-in board', () => {
    for (const board of BUILT_IN_BOARDS) {
      const state = matchOn({ mode: 'lastOneStanding', aiCount: 4, rounds: 1, mortars: false }, board, 3);
      expect(state.board).toEqual(board);
      expect(state.nav.cols * state.nav.rows).toBe(state.nav.walkable.length);
      expect(state.nav.walkable.some((w) => w === 1)).toBe(true);
    }
  });

  test('Open centre: nobody spawns in the middle of Run For Cover', () => {
    // The open centre is the space between the top and bottom rows of blocks and the side blocks.
    const centre = { left: 200, right: 1000, top: 200, bottom: 600 };
    for (const s of RUN_FOR_COVER.spawns) {
      const inside = s.x > centre.left && s.x < centre.right && s.y > centre.top && s.y < centre.bottom;
      expect(inside).toBe(false);
    }
    for (let seed = 1; seed <= 20; seed++) {
      const state = matchOn(
        { mode: 'lastOneStanding', aiCount: 4, rounds: 1, mortars: false },
        RUN_FOR_COVER,
        seed,
      );
      for (const t of state.tanks)
        expect(t.y < centre.top || t.y > centre.bottom || t.x < centre.left || t.x > centre.right).toBe(true);
    }
  });

  test('Nowhere (Much) To Hide gives every spawn a barrier nearby', () => {
    for (const s of NOWHERE_TO_HIDE.spawns) {
      const near = NOWHERE_TO_HIDE.obstacles.some((r) => {
        const dx = Math.max(r.x - s.x, 0, s.x - (r.x + r.w));
        const dy = Math.max(r.y - s.y, 0, s.y - (r.y + r.h));
        return Math.hypot(dx, dy) < 100;
      });
      expect(near).toBe(true);
    }
  });
});

describe('arena: boards drawn on the design grid', () => {
  test('a picture becomes merged wall rectangles', () => {
    expect(wallsFromGrid(['##..', '##..', '...#'], 10)).toEqual([
      { x: 0, y: 0, w: 20, h: 20 },
      { x: 30, y: 20, w: 10, h: 10 },
    ]);
  });

  test('an L shape needs two rectangles, not one per square', () => {
    expect(wallsFromGrid(['###', '#..', '#..'], 10)).toEqual([
      { x: 0, y: 0, w: 30, h: 10 },
      { x: 0, y: 10, w: 10, h: 20 },
    ]);
  });

  test('Pac-Tank is symmetric', () => {
    // Compare square by square: mirrored rectangles may be merged differently.
    const wallAt = (x: number, y: number): boolean =>
      PAC_TANK.obstacles.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    for (let y = GRID / 2; y < PAC_TANK.height; y += GRID) {
      for (let x = GRID / 2; x < PAC_TANK.width; x += GRID) {
        expect(wallAt(PAC_TANK.width - x, y)).toBe(wallAt(x, y));
        expect(wallAt(x, PAC_TANK.height - y)).toBe(wallAt(x, y));
      }
    }
  });
});

describe('arena: spawn assignment', () => {
  test('Distinct spawns', () => {
    const state = matchOn(
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
      const state = matchOn(
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
