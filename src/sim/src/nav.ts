import type { SimConfig } from './config';
import { circleInBounds, circleRectOverlap } from './geometry';
import type { Board, NavGrid } from './types';

/**
 * Builds a grid of cells where a tank's centre can sit without touching an obstacle or the
 * boundary. Obstacles are effectively inflated by the tank radius (plus a margin), so any path
 * through walkable cell centres is drivable.
 */
export function buildNavGrid(
  board: Board,
  config: Pick<SimConfig, 'tankRadius' | 'navCellSize' | 'navMargin'>,
): NavGrid {
  const cellSize = config.navCellSize;
  const cols = Math.ceil(board.width / cellSize);
  const rows = Math.ceil(board.height / cellSize);
  const clearance = config.tankRadius + config.navMargin;
  const walkable: number[] = new Array<number>(cols * rows).fill(0);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col + 0.5) * cellSize;
      const y = (row + 0.5) * cellSize;
      let ok = circleInBounds(x, y, clearance, board.width, board.height);
      for (let i = 0; ok && i < board.obstacles.length; i++) {
        if (circleRectOverlap(x, y, clearance, board.obstacles[i]!)) ok = false;
      }
      walkable[row * cols + col] = ok ? 1 : 0;
    }
  }
  return { cellSize, cols, rows, walkable };
}

export function cellAt(nav: NavGrid, x: number, y: number): number {
  const col = Math.min(nav.cols - 1, Math.max(0, Math.floor(x / nav.cellSize)));
  const row = Math.min(nav.rows - 1, Math.max(0, Math.floor(y / nav.cellSize)));
  return row * nav.cols + col;
}

export function cellCenter(nav: NavGrid, cell: number): { x: number; y: number } {
  const col = cell % nav.cols;
  const row = Math.floor(cell / nav.cols);
  return { x: (col + 0.5) * nav.cellSize, y: (row + 0.5) * nav.cellSize };
}

export function isWalkable(nav: NavGrid, cell: number): boolean {
  return nav.walkable[cell] === 1;
}

const DIRS_4: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Orthogonal neighbours that are walkable. */
function neighbours4(nav: NavGrid, cell: number): number[] {
  const col = cell % nav.cols;
  const row = Math.floor(cell / nav.cols);
  const out: number[] = [];
  for (const [dc, dr] of DIRS_4) {
    const c = col + dc;
    const r = row + dr;
    if (c < 0 || r < 0 || c >= nav.cols || r >= nav.rows) continue;
    const n = r * nav.cols + c;
    if (nav.walkable[n] === 1) out.push(n);
  }
  return out;
}

/** The walkable cell nearest to `cell` (by grid steps), or -1 if the grid has none. */
export function nearestWalkable(nav: NavGrid, cell: number): number {
  if (isWalkable(nav, cell)) return cell;
  const seen = new Uint8Array(nav.cols * nav.rows);
  const queue = [cell];
  seen[cell] = 1;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    if (isWalkable(nav, cur)) return cur;
    const col = cur % nav.cols;
    const row = Math.floor(cur / nav.cols);
    for (const [dc, dr] of DIRS_4) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || r < 0 || c >= nav.cols || r >= nav.rows) continue;
      const n = r * nav.cols + c;
      if (!seen[n]) {
        seen[n] = 1;
        queue.push(n);
      }
    }
  }
  return -1;
}

/** All walkable cells reachable from `start` (4-connected). */
export function floodFill(nav: NavGrid, start: number): Set<number> {
  const reached = new Set<number>();
  if (!isWalkable(nav, start)) return reached;
  const queue = [start];
  reached.add(start);
  for (let head = 0; head < queue.length; head++) {
    for (const n of neighbours4(nav, queue[head]!)) {
      if (!reached.has(n)) {
        reached.add(n);
        queue.push(n);
      }
    }
  }
  return reached;
}

/**
 * Breadth-first search from `start` over walkable cells, returning the first cell for which
 * `accept` is true (i.e. the nearest such cell by path length), or -1.
 */
export function findNearest(nav: NavGrid, start: number, accept: (cell: number) => boolean): number {
  if (!isWalkable(nav, start)) return -1;
  const seen = new Uint8Array(nav.cols * nav.rows);
  const queue = [start];
  seen[start] = 1;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    if (accept(cur)) return cur;
    for (const n of neighbours4(nav, cur)) {
      if (!seen[n]) {
        seen[n] = 1;
        queue.push(n);
      }
    }
  }
  return -1;
}

/**
 * A* over the grid, 8-connected, never cutting corners (a diagonal step needs both orthogonal
 * neighbours walkable). Returns the cells from start to goal inclusive, or null if unreachable.
 */
export function findPath(nav: NavGrid, start: number, goal: number): number[] | null {
  if (!isWalkable(nav, start) || !isWalkable(nav, goal)) return null;
  if (start === goal) return [start];

  const size = nav.cols * nav.rows;
  const g = new Float64Array(size).fill(Infinity);
  const parent = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const heap = new MinHeap();
  const goalCol = goal % nav.cols;
  const goalRow = Math.floor(goal / nav.cols);
  const h = (cell: number): number => {
    const dx = Math.abs((cell % nav.cols) - goalCol);
    const dy = Math.abs(Math.floor(cell / nav.cols) - goalRow);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); // octile distance
  };

  g[start] = 0;
  heap.push(start, h(start));
  while (heap.size > 0) {
    const cur = heap.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const col = cur % nav.cols;
    const row = Math.floor(cur / nav.cols);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dc === 0 && dr === 0) continue;
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || r < 0 || c >= nav.cols || r >= nav.rows) continue;
        const n = r * nav.cols + c;
        if (nav.walkable[n] !== 1 || closed[n]) continue;
        if (dc !== 0 && dr !== 0) {
          if (nav.walkable[row * nav.cols + c] !== 1 || nav.walkable[r * nav.cols + col] !== 1) continue;
        }
        const cost = g[cur]! + (dc !== 0 && dr !== 0 ? Math.SQRT2 : 1);
        if (cost < g[n]!) {
          g[n] = cost;
          parent[n] = cur;
          heap.push(n, cost + h(n));
        }
      }
    }
  }

  if (parent[goal] === -1) return null;
  const path: number[] = [];
  for (let cur = goal; cur !== -1; cur = parent[cur]!) path.push(cur);
  return path.reverse();
}

/** Minimal binary heap keyed by priority; ties broken by insertion order for determinism. */
class MinHeap {
  private items: { value: number; priority: number; seq: number }[] = [];
  private seq = 0;

  get size(): number {
    return this.items.length;
  }

  push(value: number, priority: number): void {
    const items = this.items;
    items.push({ value, priority, seq: this.seq++ });
    let i = items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      [items[i], items[p]] = [items[p]!, items[i]!];
      i = p;
    }
  }

  pop(): number {
    const items = this.items;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && this.less(l, m)) m = l;
        if (r < items.length && this.less(r, m)) m = r;
        if (m === i) break;
        [items[i], items[m]] = [items[m]!, items[i]!];
        i = m;
      }
    }
    return top.value;
  }

  private less(a: number, b: number): boolean {
    const x = this.items[a]!;
    const y = this.items[b]!;
    return x.priority < y.priority || (x.priority === y.priority && x.seq < y.seq);
  }
}
