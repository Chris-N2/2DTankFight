import type { Board } from '../types';
import { GRID, wallsFromGrid } from './grid';

const W = 1200;
const H = 800;

/**
 * "Checkerboard": rows of 2 × 2 blocks, the middle row staggered half a step like brickwork. An aligned grid would give
 * every open square two long, clear lanes; the stagger breaks up the lanes running top to bottom, so spawns can shelter
 * behind blocks. A half-step only lands on the design grid if the repeat is an even number of squares, so the gaps
 * between blocks are 4 squares.
 *
 * Each character is one 40-unit square; `#` is wall. The picture *is* the board. Spawns are marked in the comment
 * below, not here (`S`). Each spawn sits on the corner at the top left of its `S` square:
 *
 * ```
 *    ..............................
 *    ..............................
 *    ..............................
 *    .....##....##....##....##.....
 *    .....##..S.##....##..S.##.....
 *    ..............................
 *    ..............................
 *    ..............................
 *    ..............................
 *    ........##....##....##........
 *    .....S..##....##....##...S....
 *    ..............................
 *    ..............................
 *    ..............................
 *    ..............................
 *    .....##....##....##....##.....
 *    .....##..S.##....##..S.##.....
 *    ..............................
 *    ..............................
 *    ..............................
 * ```
 */
const MAZE = [
  '..............................',
  '..............................',
  '..............................',
  '.....##....##....##....##.....',
  '.....##....##....##....##.....',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '........##....##....##........',
  '........##....##....##........',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '.....##....##....##....##.....',
  '.....##....##....##....##.....',
  '..............................',
  '..............................',
  '..............................',
];

/** Heading from a point towards the arena centre. */
const towardsCentre = (x: number, y: number): number => Math.atan2(H / 2 - y, W / 2 - x);

/** A spawn on the grid corner at column `col`, row `row`, facing the arena centre. */
const spawnAt = (col: number, row: number) => {
  const x = col * GRID;
  const y = row * GRID;
  return { x, y, heading: towardsCentre(x, y) };
};

export const CHECKERBOARD: Board = {
  id: 'checkerboard',
  name: 'Checkerboard',
  width: W,
  height: H,
  obstacles: wallsFromGrid(MAZE),
  // In the gaps of the top and bottom rows, with a block either side and one of the middle row's blocks straight
  // ahead; and one at each end of the middle row, beside its outermost block.
  spawns: [spawnAt(9, 4), spawnAt(21, 4), spawnAt(9, 16), spawnAt(21, 16), spawnAt(5, 10), spawnAt(25, 10)],
};
