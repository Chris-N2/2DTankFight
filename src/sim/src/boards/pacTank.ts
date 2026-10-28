import type { Board } from '../types';
import { GRID, wallsFromGrid } from './grid';

const W = 1200;
const H = 800;

/**
 * "Pac-Tank": a maze in the spirit of the arcade classic, minus the wraparound. Corridors are 3 squares wide (4 down
 * the middle), so tanks can pass each other. Every junction has at least two ways out, so there are no dead ends to
 * be cornered in. The long walls make bank shots round corners the main skill.
 *
 * Each character is one 40-unit square; `#` is wall. The picture *is* the board.
 */
const MAZE = [
  '..............................',
  '..............................',
  '..............................',
  '...####...##########...####...',
  '...####...##########...####...',
  '...####...##########...####...',
  '...####................####...',
  '...####................####...',
  '...####................####...',
  '...##########....##########...',
  '...##########....##########...',
  '...####................####...',
  '...####................####...',
  '...####................####...',
  '...####...##########...####...',
  '...####...##########...####...',
  '...####...##########...####...',
  '..............................',
  '..............................',
  '..............................',
];

/** Heading from a point towards the arena centre. */
const towardsCentre = (x: number, y: number): number => Math.atan2(H / 2 - y, W / 2 - x);

/** A spawn at the centre of the square at column `col`, row `row`, facing the arena centre. */
const spawnAt = (col: number, row: number) => {
  const x = (col + 0.5) * GRID;
  const y = (row + 0.5) * GRID;
  return { x, y, heading: towardsCentre(x, y) };
};

export const PAC_TANK: Board = {
  id: 'pac-tank',
  name: 'Pac-Tank',
  width: W,
  height: H,
  obstacles: wallsFromGrid(MAZE),
  // The four corners, facing into the maze rather than along the outer corridor at each other, and the sheltered
  // gap in the middle.
  spawns: [
    spawnAt(1, 1),
    spawnAt(28, 1),
    spawnAt(1, 18),
    spawnAt(28, 18),
    { x: W / 2, y: H / 2, heading: -Math.PI / 2 },
  ],
};
