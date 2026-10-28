import type { Board } from '../types';
import { GRID, wallsFromGrid } from './grid';

const W = 1200;
const H = 800;

/**
 * "Ricochet Alley": a mostly open board with long walls to bank shots off, and spawns tucked into pockets so that no
 * two of them have a straight line between them. Hitting anyone from where they start takes a bank shot, and a bounced
 * shell can still hit the tank that fired it. The AI only shoots along straight lines, so it has to come out into the
 * open; humans who bank their shots get the edge.
 *
 * Each character is one 40-unit square; `#` is wall. The picture *is* the board. Spawns are marked in the comment
 * below, not here (`S`):
 *
 * ```
 *    ......#................#......
 *    .S....#................#....S.
 *    ......#................#......
 *    ..............................
 *    ..........##########..........
 *    ..............................
 *    ###........................###
 *    ......#................#......
 *    ......#................#......
 *    ......#.......##.......#......
 *    .S....#.......##.......#....S.
 *    ......#................#......
 *    ......#................#......
 *    ###........................###
 *    ..............................
 *    ..........##########..........
 *    ..............................
 *    ......#................#......
 *    .S....#................#....S.
 *    ......#................#......
 * ```
 *
 * (The middle spawns sit on the line between rows 9 and 10, level with the centre block.)
 */
const MAZE = [
  '......#................#......',
  '......#................#......',
  '......#................#......',
  '..............................',
  '..........##########..........',
  '..............................',
  '###........................###',
  '......#................#......',
  '......#................#......',
  '......#.......##.......#......',
  '......#.......##.......#......',
  '......#................#......',
  '......#................#......',
  '###........................###',
  '..............................',
  '..........##########..........',
  '..............................',
  '......#................#......',
  '......#................#......',
  '......#................#......',
];

/** Heading from a point towards the arena centre. */
const towardsCentre = (x: number, y: number): number => Math.atan2(H / 2 - y, W / 2 - x);

/** A corner spawn at the centre of the square at column `col`, row `row`, facing the arena centre. */
const cornerAt = (col: number, row: number) => {
  const x = (col + 0.5) * GRID;
  const y = (row + 0.5) * GRID;
  return { x, y, heading: towardsCentre(x, y) };
};

export const RICOCHET_ALLEY: Board = {
  id: 'ricochet-alley',
  name: 'Ricochet Alley',
  width: W,
  height: H,
  obstacles: wallsFromGrid(MAZE),
  // A pocket in each corner, facing the centre block, and one behind each side post, facing into it.
  spawns: [
    cornerAt(1, 1),
    cornerAt(28, 1),
    cornerAt(1, 18),
    cornerAt(28, 18),
    { x: 1.5 * GRID, y: H / 2, heading: 0 },
    { x: W - 1.5 * GRID, y: H / 2, heading: Math.PI },
  ],
};
