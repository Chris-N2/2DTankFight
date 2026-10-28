import { describe, expect, test } from 'vitest';
import {
  BUILT_IN_BOARDS,
  FRUSTRATION,
  NOWHERE_TO_HIDE,
  PAC_TANK,
  PROVING_GROUND,
  RICOCHET_ALLEY,
  RUN_FOR_COVER,
  validateBoard,
  type Board,
} from '../src';
import { GRID, wallsFromGrid } from '../src/boards/grid';
import { lineOfSight, sweepBounds, sweepRect } from '../src/geometry';
import { buildNavGrid, cellAt, floodFill } from '../src/nav';
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

/**
 * The spawn points that the tank starting at `spawns[i]` is aimed straight at: a ray along its heading passes within a
 * tank's radius of them before reaching an obstacle or the boundary. Bounces are ignored: a bank shot isn't a free shot.
 */
function aimedAt(board: Board, i: number): number[] {
  const from = board.spawns[i]!;
  const ux = Math.cos(from.heading);
  const uy = Math.sin(from.heading);
  const far = board.width + board.height;
  const [x1, y1] = [from.x + ux * far, from.y + uy * far];
  let reach = sweepBounds(from.x, from.y, x1, y1, board.width, board.height)?.t ?? 1;
  for (const rect of board.obstacles) {
    const hit = sweepRect(from.x, from.y, x1, y1, rect);
    if (hit && hit.t < reach) reach = hit.t;
  }
  reach *= far;
  const aimed: number[] = [];
  board.spawns.forEach((to, j) => {
    if (j === i) return;
    const along = (to.x - from.x) * ux + (to.y - from.y) * uy;
    const across = Math.abs((to.x - from.x) * uy - (to.y - from.y) * ux);
    if (along > 0 && along < reach && across < cfg.tankRadius) aimed.push(j);
  });
  return aimed;
}

/** Every pair of spawn points with nothing blocking the straight line between them, as "i-j". */
function openLines(board: Board): string[] {
  const open: string[] = [];
  board.spawns.forEach((a, i) =>
    board.spawns.forEach((b, j) => {
      if (j > i && lineOfSight(a.x, a.y, b.x, b.y, board.obstacles)) open.push(`${i}-${j}`);
    }),
  );
  return open;
}

describe('arena: built-in boards', () => {
  test('No free first shot', () => {
    const freeShots = BUILT_IN_BOARDS.flatMap((board) =>
      board.spawns.flatMap((_, i) =>
        aimedAt(board, i).map((j) => `${board.id}: spawn ${i} is aimed at spawn ${j}`),
      ),
    );
    expect(freeShots).toEqual([]);
  });

  test('the free-first-shot check spots a spawn aimed down a clear lane', () => {
    const board = makeBoard(sixBlocks);
    board.spawns[0] = { x: 60, y: 60, heading: 0 }; // straight along the top at spawn 1
    expect(aimedAt(board, 0)).toEqual([1]);
    board.obstacles.push({ x: 400, y: 40, w: 20, h: 40 }); // a wall in between
    expect(aimedAt(board, 0)).toEqual([]);
  });

  test('Seven boards available', () => {
    expect(BUILT_IN_BOARDS.map((b) => b.name)).toEqual([
      'Proving Ground',
      'Run For Cover',
      'Nowhere (Much) To Hide',
      'Pac-Tank',
      'Frustration',
      'Ricochet Alley',
      'Checkerboard',
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

  test('Pac-Tank has room to spare', () => {
    // The outer corridor is the 3-square ring round the maze; the corners are where its sides meet.
    const ring = 3 * GRID;
    const { width: W, height: H } = PAC_TANK;
    const inCorner = (x: number, y: number) => (x < ring || x > W - ring) && (y < ring || y > H - ring);
    const inside = (x: number, y: number) => x > ring && x < W - ring && y > ring && y < H - ring;
    const spawns = PAC_TANK.spawns;
    expect(spawns).toHaveLength(7);
    expect(spawns.filter((s) => inCorner(s.x, s.y))).toHaveLength(4);
    expect(spawns.filter((s) => s.x === W / 2 && s.y === H / 2)).toHaveLength(1);
    expect(spawns.filter((s) => inside(s.x, s.y) && !(s.x === W / 2 && s.y === H / 2))).toHaveLength(2);
  });

  test("Frustration's outer strips are sealed", () => {
    // The ring runs one square in from the outer strips, three squares from the edge. Plug its four gaps: if the
    // outer spawns are then cut off from each other, every route between them went through the inside of the ring.
    const ring = { left: 3 * GRID, right: 26 * GRID, top: 3 * GRID, bottom: 16 * GRID };
    const plugs = [
      { x: 13 * GRID, y: ring.top, w: 4 * GRID, h: GRID },
      { x: 13 * GRID, y: ring.bottom, w: 4 * GRID, h: GRID },
      { x: ring.left, y: 8 * GRID, w: GRID, h: 4 * GRID },
      { x: ring.right, y: 8 * GRID, w: GRID, h: 4 * GRID },
    ];
    const outer = FRUSTRATION.spawns.filter(
      (s) => s.x < ring.left || s.x > ring.right + GRID || s.y < ring.top || s.y > ring.bottom + GRID,
    );
    expect(outer).toHaveLength(4);
    const open = buildNavGrid(FRUSTRATION, cfg);
    const plugged = buildNavGrid({ ...FRUSTRATION, obstacles: [...FRUSTRATION.obstacles, ...plugs] }, cfg);
    for (const s of outer) {
      expect(floodFill(open, cellAt(open, s.x, s.y)).size).toBeGreaterThan(0);
      const strip = floodFill(plugged, cellAt(plugged, s.x, s.y));
      const others = outer.filter((o) => o !== s && strip.has(cellAt(plugged, o.x, o.y)));
      expect(others).toEqual([]);
    }
  });

  test('No straight line between spawns on Frustration', () => {
    expect(openLines(FRUSTRATION)).toEqual([]);
  });

  test('No straight line between spawns on Ricochet Alley', () => {
    expect(openLines(RICOCHET_ALLEY)).toEqual([]);
  });

  test('the straight-line check finds open lines where there are some', () => {
    // Run For Cover's top corners look at each other along the top edge.
    expect(openLines(RUN_FOR_COVER)).toContain('0-1');
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
