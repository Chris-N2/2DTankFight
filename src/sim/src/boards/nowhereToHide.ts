import type { Board } from '../types';
import { GRID } from './grid';

const W = 1200;
const H = 800;

/** Heading from a point towards the arena centre. */
const towardsCentre = (x: number, y: number): number => Math.atan2(H / 2 - y, W / 2 - x);

/** A 1 × 3-square barrier, upright, at the given top-left corner. */
const upright = (x: number, y: number) => ({ x, y, w: GRID, h: 3 * GRID });
/** A 3 × 1-square barrier, lying flat, at the given top-left corner. */
const flat = (x: number, y: number) => ({ x, y, w: 3 * GRID, h: GRID });

/**
 * "Nowhere (Much) To Hide": each spawn point gets one short barrier on the side facing the centre, and there's a
 * small piece in the middle. Everything else is open floor. Fast, frantic, and very scary in Waves.
 *
 * ```
 * +------------------------------+
 * |  S|        S          |S     |
 * |   |       ---         |      |
 * |                              |
 * |             --               |
 * |                              |
 * |   |       ---         |      |
 * |  S|        S          |S     |
 * +------------------------------+
 * ```
 */
export const NOWHERE_TO_HIDE: Board = {
  id: 'nowhere-to-hide',
  name: 'Nowhere (Much) To Hide',
  width: W,
  height: H,
  obstacles: [
    upright(160, 60),
    upright(W - 200, 60),
    upright(160, H - 180),
    upright(W - 200, H - 180),
    flat(540, 140),
    flat(540, H - 180),
    { x: 560, y: 380, w: 2 * GRID, h: GRID },
  ],
  spawns: [
    { x: 100, y: 100, heading: towardsCentre(100, 100) },
    { x: W - 100, y: 100, heading: towardsCentre(W - 100, 100) },
    { x: 100, y: H - 100, heading: towardsCentre(100, H - 100) },
    { x: W - 100, y: H - 100, heading: towardsCentre(W - 100, H - 100) },
    { x: W / 2, y: 80, heading: Math.PI / 2 },
    { x: W / 2, y: H - 80, heading: -Math.PI / 2 },
  ],
};
