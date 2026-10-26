import { ticks, tickDuration } from '../config';
import { angleDiff, distance, lineOfSight } from '../geometry';
import { cellAt, cellCenter, findNearest, findPath, nearestWalkable } from '../nav';
import { nextFloat, nextRange } from '../rng';
import type { AiMemory, MatchState, TankInput, TankState } from '../types';

/** Beyond this distance a lined-up AI keeps closing in (shells have a limited lifetime). */
const ENGAGE_ADVANCE_DISTANCE = 420;
/** Only drive forward when facing within this angle of the next waypoint; otherwise turn on the spot. */
const DRIVE_ANGLE = (35 * Math.PI) / 180;
/**
 * Half-width of the firing lane an AI wants clear before engaging. A bare centre-to-centre line of
 * sight isn't enough: with aim error, shells graze nearby corners and two AIs can trade misses forever.
 */
const SHOT_LANE = 8;

export function createAiMemory(): AiMemory {
  return {
    targetId: null,
    retargetTicks: 0,
    path: [],
    pathIndex: 0,
    replanTicks: 0,
    seenTicks: 0,
    aimOffset: 0,
    fireWaitTicks: 0,
    blockedTicks: 0,
    stuckTicks: 0,
    stuckRefX: 0,
    stuckRefY: 0,
    recoverTicks: 0,
    recoverTurn: 1,
  };
}

/**
 * Decides one AI tank's input for this tick. The AI may read the whole match state, but it can
 * only act through the returned input — exactly what a human could press.
 */
export function think(state: MatchState, tank: TankState): TankInput {
  const cfg = state.config;
  const mem = state.ai[tank.id] ?? (state.ai[tank.id] = createAiMemory());
  if (mem.fireWaitTicks > 0) mem.fireWaitTicks--;

  const target = selectTarget(state, tank, mem);
  if (!target) return { throttle: 0, turn: 0, fire: false };

  if (mem.recoverTicks > 0) {
    mem.recoverTicks--;
    return { throttle: -1, turn: mem.recoverTurn, fire: false };
  }

  const halfTurnStep = (cfg.tankTurnRate * tickDuration(cfg)) / 2;
  const obstacles = state.board.obstacles;

  if (hasClearLane(tank.x, tank.y, target.x, target.y, obstacles, SHOT_LANE)) {
    mem.seenTicks++;
    if (mem.seenTicks === 1) mem.aimOffset = rollAimError(state);

    const range = distance(tank.x, tank.y, target.x, target.y);
    // Too far away, and no room for the tank itself to drive straight there: take a route instead.
    if (
      range > ENGAGE_ADVANCE_DISTANCE &&
      !hasClearLane(tank.x, tank.y, target.x, target.y, obstacles, cfg.tankRadius)
    ) {
      mem.blockedTicks = 0;
      return navigate(state, tank, target, mem, halfTurnStep);
    }
    const aim = Math.atan2(target.y - tank.y, target.x - tank.x) + mem.aimOffset;
    const diff = angleDiff(tank.heading, aim);
    const turn = Math.abs(diff) > halfTurnStep ? (diff > 0 ? 1 : -1) : 0;
    const ready = mem.seenTicks > ticks(cfg, cfg.aiReactionDelay) && mem.fireWaitTicks === 0;
    // Never knowingly fire into cover, or into an ally: the barrel's actual line must be clear up to the target.
    const barrelClear =
      lineOfSight(
        tank.x,
        tank.y,
        tank.x + Math.cos(tank.heading) * range,
        tank.y + Math.sin(tank.heading) * range,
        obstacles,
      ) && !allyInLane(state, tank, range);
    const linedUp = ready && Math.abs(diff) <= cfg.aiAimTolerance;
    // Release between shots: firing is edge-triggered, for the AI as for a human.
    const fire = linedUp && barrelClear && !tank.fireHeld;
    if (fire) {
      mem.aimOffset = rollAimError(state); // each shot gets its own error
      mem.fireWaitTicks =
        ticks(cfg, cfg.fireCooldown) + ticks(cfg, nextRange(state.aiRng, 0, cfg.aiFirePauseMax));
    }

    // Lined up, but the aim error has the barrel clipping cover, or an ally is in the way. Re-aim every so
    // often; if that still doesn't clear it (turning only goes in whole steps, and allies may not move),
    // back off and come at it from a new spot.
    if (linedUp && !barrelClear) {
      mem.blockedTicks++;
      if (mem.blockedTicks >= ticks(cfg, cfg.aiStuckWindow)) return startRecovery(state, mem);
      if (mem.blockedTicks % ticks(cfg, cfg.aiReactionDelay) === 0) mem.aimOffset = rollAimError(state);
    } else if (barrelClear) {
      mem.blockedTicks = 0;
    }

    const throttle = range > ENGAGE_ADVANCE_DISTANCE && Math.abs(diff) < DRIVE_ANGLE ? 1 : 0;
    if (throttle === 0) mem.stuckTicks = 0;
    else if (isStuck(state, tank, mem)) return startRecovery(state, mem);
    return { throttle, turn, fire };
  }

  mem.seenTicks = 0;
  mem.blockedTicks = 0;
  return navigate(state, tank, target, mem, halfTurnStep);
}

function selectTarget(state: MatchState, tank: TankState, mem: AiMemory): TankState | null {
  const cfg = state.config;
  let current = state.tanks.find((t) => t.id === mem.targetId && t.alive) ?? null;
  mem.retargetTicks--;
  if (current && mem.retargetTicks > 0) return current;

  mem.retargetTicks = ticks(cfg, cfg.aiRetargetInterval);
  let best: TankState | null = null;
  let bestScore = Infinity;
  for (const other of state.tanks) {
    if (!other.alive || !isEnemy(state, tank, other)) continue;
    const visible = lineOfSight(tank.x, tank.y, other.x, other.y, state.board.obstacles);
    const score = (visible ? 0 : 1e6) + distance(tank.x, tank.y, other.x, other.y);
    if (score < bestScore) {
      bestScore = score;
      best = other;
    }
  }
  if (best?.id !== current?.id) {
    mem.targetId = best?.id ?? null;
    mem.seenTicks = 0;
    mem.path = [];
    mem.replanTicks = 0;
  }
  current = best;
  return current;
}

/**
 * Whether tank `a` treats tank `b` as an enemy. In Last One Standing it's every tank for itself. In Waves
 * the AI tanks are allies, unless co-operation is switched off in the config.
 */
export function isEnemy(state: MatchState, a: TankState, b: TankState): boolean {
  if (a === b) return false;
  if (state.options.mode === 'waves' && state.config.wavesAiCooperate)
    return a.kind === 'human' || b.kind === 'human';
  return true;
}

/**
 * True if a live ally's hull comes within the firing lane along the barrel, nearer than `range`.
 * Shells hurt whoever they hit, so an AI holds fire rather than shoot an ally in the back.
 */
function allyInLane(state: MatchState, tank: TankState, range: number): boolean {
  const dirX = Math.cos(tank.heading);
  const dirY = Math.sin(tank.heading);
  const reach = SHOT_LANE + state.config.tankRadius;
  for (const other of state.tanks) {
    if (other === tank || !other.alive || isEnemy(state, tank, other)) continue;
    const ox = other.x - tank.x;
    const oy = other.y - tank.y;
    const along = ox * dirX + oy * dirY;
    if (along > 0 && along < range && Math.abs(ox * dirY - oy * dirX) <= reach) return true;
  }
  return false;
}

function navigate(
  state: MatchState,
  tank: TankState,
  target: TankState,
  mem: AiMemory,
  halfTurnStep: number,
): TankInput {
  const cfg = state.config;
  const nav = state.nav;

  mem.replanTicks--;
  if (mem.replanTicks <= 0 || mem.pathIndex >= mem.path.length) {
    plan(state, tank, target, mem);
    mem.replanTicks = ticks(cfg, cfg.aiReplanInterval);
  }

  // Skip waypoints we've already reached.
  while (mem.pathIndex < mem.path.length) {
    const wp = cellCenter(nav, mem.path[mem.pathIndex]!);
    if (distance(tank.x, tank.y, wp.x, wp.y) > nav.cellSize * 0.75) break;
    mem.pathIndex++;
  }
  const next = mem.pathIndex < mem.path.length ? cellCenter(nav, mem.path[mem.pathIndex]!) : target;

  const diff = angleDiff(tank.heading, Math.atan2(next.y - tank.y, next.x - tank.x));
  const turn = Math.abs(diff) > halfTurnStep ? (diff > 0 ? 1 : -1) : 0;
  const throttle = Math.abs(diff) < DRIVE_ANGLE ? 1 : 0;

  // Only count time spent trying to drive; turning on the spot isn't being stuck.
  if (throttle === 1 && isStuck(state, tank, mem)) return startRecovery(state, mem);
  return { throttle, turn, fire: false };
}

/**
 * Called on ticks when the AI is driving forward. True if it has spent a whole stuck window
 * trying to drive without getting anywhere.
 */
function isStuck(state: MatchState, tank: TankState, mem: AiMemory): boolean {
  const cfg = state.config;
  if (mem.stuckTicks === 0) {
    mem.stuckRefX = tank.x;
    mem.stuckRefY = tank.y;
  }
  mem.stuckTicks++;
  if (mem.stuckTicks < ticks(cfg, cfg.aiStuckWindow)) return false;
  mem.stuckTicks = 0;
  return distance(tank.x, tank.y, mem.stuckRefX, mem.stuckRefY) < cfg.aiStuckDistance;
}

/** Reverses and turns away for a moment, then plans and aims afresh. Returns this tick's input. */
function startRecovery(state: MatchState, mem: AiMemory): TankInput {
  mem.recoverTicks = ticks(state.config, state.config.aiRecoverDuration) - 1;
  mem.recoverTurn = nextFloat(state.aiRng) < 0.5 ? -1 : 1;
  mem.stuckTicks = 0;
  mem.blockedTicks = 0;
  mem.path = [];
  mem.replanTicks = 0;
  mem.aimOffset = rollAimError(state);
  return { throttle: -1, turn: mem.recoverTurn, fire: false };
}

/** Plans a route to the nearest spot with a clear shot at the target, close enough to engage from. */
function plan(state: MatchState, tank: TankState, target: TankState, mem: AiMemory): void {
  const nav = state.nav;
  const obstacles = state.board.obstacles;
  const start = nearestWalkable(nav, cellAt(nav, tank.x, tank.y));
  if (start < 0) {
    mem.path = [];
    mem.pathIndex = 0;
    return;
  }
  const clearShotFrom = (cell: number, maxRange: number): boolean => {
    const c = cellCenter(nav, cell);
    return (
      distance(c.x, c.y, target.x, target.y) <= maxRange &&
      hasClearLane(c.x, c.y, target.x, target.y, obstacles, SHOT_LANE)
    );
  };
  let goal = findNearest(nav, start, (cell) => clearShotFrom(cell, ENGAGE_ADVANCE_DISTANCE));
  if (goal < 0) goal = findNearest(nav, start, (cell) => clearShotFrom(cell, Infinity));
  if (goal < 0) goal = nearestWalkable(nav, cellAt(nav, target.x, target.y));
  const path = goal >= 0 ? findPath(nav, start, goal) : null;
  mem.path = path ?? [];
  mem.pathIndex = mem.path.length > 1 ? 1 : 0;
}

function rollAimError(state: MatchState): number {
  return nextRange(state.aiRng, -state.config.aiAimError, state.config.aiAimError);
}

/** True if a lane of the given half-width between the two points is free of obstacles. */
function hasClearLane(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  obstacles: MatchState['board']['obstacles'],
  halfWidth: number,
): boolean {
  if (!lineOfSight(ax, ay, bx, by, obstacles)) return false;
  const len = distance(ax, ay, bx, by);
  if (len === 0) return true;
  const ox = (-(by - ay) / len) * halfWidth;
  const oy = ((bx - ax) / len) * halfWidth;
  return (
    lineOfSight(ax + ox, ay + oy, bx + ox, by + oy, obstacles) &&
    lineOfSight(ax - ox, ay - oy, bx - ox, by - oy, obstacles)
  );
}
