import { DEFAULT_CONFIG, type SimConfig } from './config';
import { circleInBounds, circleRectOverlap, distance } from './geometry';
import { buildNavGrid, cellAt, floodFill, isWalkable } from './nav';
import type { Board } from './types';

export interface BoardValidation {
  ok: boolean;
  errors: string[];
}

/** Extra space a spawn point needs beyond the tank's own radius. */
const SPAWN_CLEARANCE = 4;

/** Checks a board against the arena rules: cover, spawn clearance, spawn spacing and connectivity. */
export function validateBoard(board: Board, config: SimConfig = DEFAULT_CONFIG): BoardValidation {
  const errors: string[] = [];
  const r = config.tankRadius + SPAWN_CLEARANCE;

  if (board.obstacles.length < config.boardMinObstacles) {
    errors.push(
      `Board has ${board.obstacles.length} obstacles; at least ${config.boardMinObstacles} are required.`,
    );
  }
  if (board.spawns.length < 5) {
    errors.push(`Board has ${board.spawns.length} spawn points; at least 5 are required.`);
  }

  board.spawns.forEach((spawn, i) => {
    const clear =
      circleInBounds(spawn.x, spawn.y, r, board.width, board.height) &&
      board.obstacles.every((rect) => !circleRectOverlap(spawn.x, spawn.y, r, rect));
    if (!clear) errors.push(`Spawn ${i} does not have room for a tank.`);
  });

  for (let i = 0; i < board.spawns.length; i++) {
    for (let j = i + 1; j < board.spawns.length; j++) {
      const a = board.spawns[i]!;
      const b = board.spawns[j]!;
      const d = distance(a.x, a.y, b.x, b.y);
      if (d < config.boardMinSpawnSpacing) {
        errors.push(
          `Spawns ${i} and ${j} are ${Math.round(d)} units apart; minimum is ${config.boardMinSpawnSpacing}.`,
        );
      }
    }
  }

  // Group the spawns by which drivable area they're in. The area holding the most spawns is the arena;
  // any spawn outside it is cut off, whichever spawn that happens to be.
  const nav = buildNavGrid(board, config);
  const cells = board.spawns.map((spawn) => cellAt(nav, spawn.x, spawn.y));
  let arena = new Set<number>();
  let arenaSpawns = 0;
  for (const cell of cells) {
    if (!isWalkable(nav, cell) || arena.has(cell)) continue;
    const area = floodFill(nav, cell);
    const count = cells.filter((c) => area.has(c)).length;
    if (count > arenaSpawns) {
      arena = area;
      arenaSpawns = count;
    }
  }
  cells.forEach((cell, i) => {
    if (!arena.has(cell)) errors.push(`Spawn ${i} is unreachable from the other spawn points.`);
  });

  return { ok: errors.length === 0, errors };
}
