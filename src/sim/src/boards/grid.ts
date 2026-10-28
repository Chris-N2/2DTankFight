import type { Rect } from '../geometry';

/** Boards are laid out on a design grid of this many world units per square: about one tank across. */
export const GRID = 40;

/**
 * Turns a picture of a board into wall rectangles. Each string is a row of squares: `#` is wall, anything else is
 * open floor. Walls are merged greedily into as few rectangles as practical — runs along a row first, then
 * identical runs on the rows below — so a maze drawn as a picture doesn't become hundreds of tiny obstacles.
 */
export function wallsFromGrid(rows: readonly string[], square = GRID): Rect[] {
  // true once a square is open floor or already part of a rectangle.
  const done = rows.map((row) => [...row].map((c) => c !== '#'));
  const rects: Rect[] = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y]!.length; x++) {
      if (done[y]![x]) continue;
      let w = 1;
      while (x + w < rows[y]!.length && !done[y]![x + w]) w++;
      let h = 1;
      while (y + h < rows.length && isUnusedWall(done[y + h]!, x, w)) h++;
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) done[y + dy]![x + dx] = true;
      rects.push({ x: x * square, y: y * square, w: w * square, h: h * square });
    }
  }
  return rects;
}

function isUnusedWall(row: boolean[], x: number, w: number): boolean {
  for (let i = x; i < x + w; i++) if (row[i] !== false) return false;
  return true;
}
