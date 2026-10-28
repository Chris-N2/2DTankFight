import type { Board } from '../types';
import { GRID, wallsFromGrid } from './grid';

const W = 1200;
const H = 800;

/**
 * "Frustration": a ring of barriers with a gap in each side. Spurs from the ring's corners to the edge of the board
 * cut the outside into four strips, each joined to the inside only through its own gap, and a baffle inside each gap
 * stops straight shots through it. Every outer spawn starts alone in its strip, so reaching anyone means a detour.
 * Slower than the other boards, on purpose.
 *
 * Each character is one 40-unit square; `#` is wall. The picture *is* the board. Spawns are marked in the comment
 * below, not here (`A` outer, `B` inside):
 *
 * ```
 *    ...#......................#...
 *    ...#...A..................#...
 *    ...#......................#...
 *    ...##########....##########...
 *    ...#......................#.A.
 *    ...#......................#...
 *    ...#......................#...
 *    ...#...#...########...#...#...
 *    .......#..............#.......
 *    .......#.B....##......#.......
 *    .......#......##....B.#.......
 *    .......#..............#.......
 *    ...#...#...########...#...#...
 *    ...#......................#...
 *    ...#......................#...
 *    .A.#......................#...
 *    ...##########....##########...
 *    ...#..................A...#...
 *    ...#......................#...
 *    ...#......................#...
 * ```
 */
const MAZE = [
  '...#......................#...',
  '...#......................#...',
  '...#......................#...',
  '...##########....##########...',
  '...#......................#...',
  '...#......................#...',
  '...#......................#...',
  '...#...#...########...#...#...',
  '.......#..............#.......',
  '.......#......##......#.......',
  '.......#......##......#.......',
  '.......#..............#.......',
  '...#...#...########...#...#...',
  '...#......................#...',
  '...#......................#...',
  '...#......................#...',
  '...##########....##########...',
  '...#......................#...',
  '...#......................#...',
  '...#......................#...',
];

/** A spawn at the centre of the square at column `col`, row `row`. */
const spawnAt = (col: number, row: number, heading: number) => ({
  x: (col + 0.5) * GRID,
  y: (row + 0.5) * GRID,
  heading,
});

export const FRUSTRATION: Board = {
  id: 'frustration',
  name: 'Frustration',
  width: W,
  height: H,
  obstacles: wallsFromGrid(MAZE),
  // One in each outer strip, facing along the strip towards its gap, and two inside the ring, facing away from the
  // centre block. Half-turn symmetric.
  spawns: [
    spawnAt(7, 1, 0),
    spawnAt(28, 4, Math.PI / 2),
    spawnAt(22, 18, Math.PI),
    spawnAt(1, 15, -Math.PI / 2),
    spawnAt(9, 9, -Math.PI / 2),
    spawnAt(20, 10, Math.PI / 2),
  ],
};
