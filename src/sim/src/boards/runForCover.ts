import type { Board } from '../types';
import { GRID } from './grid';

const W = 1200;
const H = 800;

/** Heading from a point towards the arena centre. */
const towardsCentre = (x: number, y: number): number => Math.atan2(H / 2 - y, W / 2 - x);

/** A 3 × 2-square block (wide) at the given top-left corner, in world units. */
const wide = (x: number, y: number) => ({ x, y, w: 3 * GRID, h: 2 * GRID });
/** A 2 × 3-square block (tall) at the given top-left corner, in world units. */
const tall = (x: number, y: number) => ({ x, y, w: 2 * GRID, h: 3 * GRID });

/**
 * "Run For Cover": six small blocks along the top and bottom and one on each side, around a wide-open centre where
 * nobody spawns. Fast and open; the cover is there to run to, not to live behind.
 *
 * ```
 * +------------------------------+
 * | S          S              S  |
 * |    ###     ###      ###      |
 * |                              |
 * | ##                        ## |
 * | ##                        ## |
 * |                              |
 * |    ###     ###      ###      |
 * | S          S              S  |
 * +------------------------------+
 * ```
 */
export const RUN_FOR_COVER: Board = {
  id: 'run-for-cover',
  name: 'Run For Cover',
  width: W,
  height: H,
  obstacles: [
    wide(160, 120),
    wide(540, 120),
    wide(920, 120),
    wide(160, 600),
    wide(540, 600),
    wide(920, 600),
    tall(120, 340),
    tall(1000, 340),
  ],
  spawns: [
    { x: 70, y: 70, heading: towardsCentre(70, 70) },
    { x: W - 70, y: 70, heading: towardsCentre(W - 70, 70) },
    { x: 70, y: H - 70, heading: towardsCentre(70, H - 70) },
    { x: W - 70, y: H - 70, heading: towardsCentre(W - 70, H - 70) },
    // Behind the centre blocks, facing along the edge rather than into the block.
    { x: W / 2, y: 60, heading: 0 },
    { x: W / 2, y: H - 60, heading: Math.PI },
  ],
};
