/** An axis-aligned rectangle: top-left corner plus width and height (y grows downwards). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a swept segment first touches something, as a fraction t ∈ [0, 1] of the segment, plus the surface normal. */
export interface Contact {
  t: number;
  nx: number;
  ny: number;
}

/** Wraps an angle into (-π, π]. */
export function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  let r = a % twoPi;
  if (r <= -Math.PI) r += twoPi;
  else if (r > Math.PI) r -= twoPi;
  return r;
}

/** Signed smallest rotation from angle `from` to angle `to`, in (-π, π]. */
export function angleDiff(from: number, to: number): number {
  return wrapAngle(to - from);
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

/** True if a circle overlaps a rectangle (touching edges do not count). */
export function circleRectOverlap(cx: number, cy: number, r: number, rect: Rect): boolean {
  const px = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const py = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - px;
  const dy = cy - py;
  return dx * dx + dy * dy < r * r;
}

/** True if a circle lies entirely inside a width × height area anchored at the origin. */
export function circleInBounds(cx: number, cy: number, r: number, width: number, height: number): boolean {
  return cx - r >= 0 && cy - r >= 0 && cx + r <= width && cy + r <= height;
}

/**
 * Sweeps the segment (x0,y0)→(x1,y1) against a rectangle using the slab method and returns the
 * first contact, or null. A segment that starts inside the rectangle returns null: callers always
 * sweep from outside, and this stops a shell resting on a face from re-colliding with it.
 */
export function sweepRect(x0: number, y0: number, x1: number, y1: number, rect: Rect): Contact | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tEnter = -Infinity;
  let tExit = Infinity;
  let nx = 0;
  let ny = 0;

  if (dx === 0) {
    if (x0 < rect.x || x0 > rect.x + rect.w) return null;
  } else {
    const ta = (rect.x - x0) / dx;
    const tb = (rect.x + rect.w - x0) / dx;
    const tNear = Math.min(ta, tb);
    tExit = Math.min(tExit, Math.max(ta, tb));
    if (tNear > tEnter) {
      tEnter = tNear;
      nx = dx > 0 ? -1 : 1;
      ny = 0;
    }
  }

  if (dy === 0) {
    if (y0 < rect.y || y0 > rect.y + rect.h) return null;
  } else {
    const ta = (rect.y - y0) / dy;
    const tb = (rect.y + rect.h - y0) / dy;
    const tNear = Math.min(ta, tb);
    tExit = Math.min(tExit, Math.max(ta, tb));
    if (tNear > tEnter) {
      tEnter = tNear;
      nx = 0;
      ny = dy > 0 ? -1 : 1;
    }
  }

  if (tEnter > tExit || tExit < 0 || tEnter > 1 || tEnter < 0) return null;
  return { t: tEnter, nx, ny };
}

/**
 * Sweeps a segment that starts inside the area [0,width]×[0,height] and returns where it first
 * leaves it (the inside face of the boundary), or null if it stays inside.
 */
export function sweepBounds(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  height: number,
): Contact | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let best: Contact | null = null;
  const consider = (t: number, nx: number, ny: number): void => {
    if (t >= 0 && t <= 1 && (best === null || t < best.t)) best = { t, nx, ny };
  };
  if (x1 < 0 && dx !== 0) consider((0 - x0) / dx, 1, 0);
  if (x1 > width && dx !== 0) consider((width - x0) / dx, -1, 0);
  if (y1 < 0 && dy !== 0) consider((0 - y0) / dy, 0, 1);
  if (y1 > height && dy !== 0) consider((height - y0) / dy, 0, -1);
  return best;
}

/**
 * First fraction t ∈ [0, 1] at which the segment (x0,y0)→(x1,y1) touches a circle, or null.
 * A segment starting inside the circle returns 0.
 */
export function sweepCircle(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  r: number,
): number | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const fx = x0 - cx;
  const fy = y0 - cy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (fx * dx + fy * dy);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/** True if the segment touches or crosses the rectangle (including starting inside it). */
export function segmentIntersectsRect(x0: number, y0: number, x1: number, y1: number, rect: Rect): boolean {
  // Liang–Barsky clipping.
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, x0 - rect.x],
    [dx, rect.x + rect.w - x0],
    [-dy, y0 - rect.y],
    [dy, rect.y + rect.h - y0],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}

/** True if nothing in `obstacles` blocks the straight line between two points. */
export function lineOfSight(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  obstacles: readonly Rect[],
): boolean {
  for (const rect of obstacles) {
    if (segmentIntersectsRect(ax, ay, bx, by, rect)) return false;
  }
  return true;
}
