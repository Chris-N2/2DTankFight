import type { Board } from '../types';

const W = 1200;
const H = 800;
const T = 24; // wall thickness

/** Heading from a point towards the arena centre. */
const towardsCentre = (x: number, y: number): number => Math.atan2(H / 2 - y, W / 2 - x);

/**
 * "Proving Ground": roughly symmetric cover — a central block flanked by two bars, four L-shaped
 * corner pieces and four mid-side barriers. Four corner spawns plus one at the bottom centre.
 */
export const PROVING_GROUND: Board = {
  id: 'proving-ground',
  name: 'Proving Ground',
  width: W,
  height: H,
  obstacles: [
    // Centre block and flanking bars
    { x: 550, y: 330, w: 100, h: 140 },
    { x: 360, y: 388, w: 100, h: T },
    { x: 740, y: 388, w: 100, h: T },
    // Corner Ls (horizontal arm, vertical arm)
    { x: 200, y: 150, w: 140, h: T },
    { x: 200, y: 150, w: T, h: 120 },
    { x: 860, y: 150, w: 140, h: T },
    { x: 976, y: 150, w: T, h: 120 },
    { x: 200, y: 626, w: 140, h: T },
    { x: 200, y: 530, w: T, h: 120 },
    { x: 860, y: 626, w: 140, h: T },
    { x: 976, y: 530, w: T, h: 120 },
    // Mid-side barriers
    { x: 560, y: 110, w: 80, h: T },
    { x: 560, y: 666, w: 80, h: T },
    { x: 110, y: 360, w: T, h: 80 },
    { x: 1066, y: 360, w: T, h: 80 },
  ],
  spawns: [
    { x: 70, y: 70, heading: towardsCentre(70, 70) },
    { x: W - 70, y: 70, heading: towardsCentre(W - 70, 70) },
    { x: 70, y: H - 70, heading: towardsCentre(70, H - 70) },
    { x: W - 70, y: H - 70, heading: towardsCentre(W - 70, H - 70) },
    { x: W / 2, y: H - 40, heading: -Math.PI / 2 },
  ],
};
