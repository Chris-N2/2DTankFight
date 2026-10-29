import { ticks, tickDuration } from '../config';
import { angleDiff, distance, lineOfSight } from '../geometry';
import { mortarRange } from '../mortar';
import { cellAt, cellCenter, findNearest, findPath, nearestWalkable } from '../nav';
import { nextFloat, nextRange } from '../rng';
import { turretJammed } from '../tank';
import type { AiMemory, MatchState, TankInput, TankState } from '../types';

/** Beyond this distance a lined-up AI keeps closing in (shells have a limited lifetime). */
const ENGAGE_ADVANCE_DISTANCE = 420;
/**
 * After backing off, an AI won't settle back within this distance of where it got stuck (one grid square) for
 * `AVOID_SECONDS`, whether by engaging from there or planning a route back. Otherwise it reverses a tank's length,
 * still sees the target, drives straight back in and gets stuck the same way: a shuffle instead of a wobble.
 */
const AVOID_RADIUS = 40;
const AVOID_SECONDS = 3;
/**
 * A spot to drive to needs a firing lane this much wider than `SHOT_LANE`, checked from its cell's centre, because a
 * tank stops anywhere within reach of that centre. A little slack means it can usually shoot once it arrives; much more
 * would send it to cleaner spots than before, and it would hit noticeably more often.
 */
const GOAL_LANE_MARGIN = 4;
/**
 * When choosing a target, a hidden tank counts as this much farther away than a visible one. A visible target used to
 * win outright, however far away: an AI hunting a nearby hidden tank would swing round towards a distant one that came
 * into view at the edge of its sight, lose sight of it, and swing back again.
 */
const HIDDEN_TARGET_PENALTY = 500;
/**
 * An AI sticks with its target until that target has been out of its sights this long, unless another one is in plain
 * view. Otherwise a target ducking in and out of sight has the AI turning to another tank and back every retarget.
 */
const TARGET_GRACE_SECONDS = 2;
/** A waypoint counts as reached within this many cells of its centre. */
const WAYPOINT_REACH = 0.75;
/**
 * While navigating, don't reverse the way it's turning for less than this. A tank nudged by a collision sees the bearing
 * to a nearby waypoint jump about, and would otherwise twitch left and right every tick.
 */
const NAV_REVERSE_ANGLE = (10 * Math.PI) / 180;
/** Only drive forward when facing within this angle of the next waypoint; otherwise turn on the spot. */
const DRIVE_ANGLE = (35 * Math.PI) / 180;
/**
 * Half-width of the firing lane an AI wants clear before engaging. A bare centre-to-centre line of
 * sight isn't enough: with aim error, shells graze nearby corners and two AIs can trade misses forever.
 */
export const SHOT_LANE = 8;
/**
 * Once engaging, the AI keeps at it until the lane narrows to this half-width (or the line of sight goes), rather than
 * dropping out the moment it's under `SHOT_LANE`. Next to a corner, a tank nudged by a unit or two would otherwise flip
 * between engaging and navigating every few ticks, turning one way and then the other on the spot. Entering is as strict
 * as ever, and the barrel is still checked before every shot.
 */
const SHOT_LANE_KEEP = 4;
/** Likewise, an engaging AI only gives up and takes a route once the target is this far away... */
const ENGAGE_KEEP_DISTANCE = 450;
/** ...and the straight drive there has narrowed by this much more than the tank's own radius. */
const ROUTE_LANE_SLACK = 4;

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
    hiddenTicks: 0,
    engaging: false,
    progressTicks: 0,
    progressRefX: 0,
    progressRefY: 0,
    avoidX: 0,
    avoidY: 0,
    avoidTicks: 0,
    navTurn: 0,
    lob: null,
  };
}

/**
 * Decides one AI tank's input for this tick. The AI may read the whole match state, but it can
 * only act through the returned input — exactly what a human could press.
 */
export function think(state: MatchState, tank: TankState): TankInput {
  const mem = state.ai[tank.id] ?? (state.ai[tank.id] = createAiMemory());
  const input = decide(state, tank, mem);
  return makingProgress(state, tank, mem, input) ? input : startRecovery(state, tank, mem);
}

/**
 * The backstop against every kind of stall, found or not yet found: an AI that has neither moved nor fired for a
 * whole progress window backs off and plans afresh. Only a committed lob (short, and meant to be stood still for), a
 * turret jammed by mud (short, and it holds its aim to fire the moment it clears) and a recovery already under way
 * pause it; nothing else can reset it.
 */
function makingProgress(state: MatchState, tank: TankState, mem: AiMemory, input: TankInput): boolean {
  const cfg = state.config;
  const moved = distance(tank.x, tank.y, mem.progressRefX, mem.progressRefY) > cfg.aiStuckDistance;
  const paused = mem.lob || turretJammed(tank) || mem.recoverTicks > 0 || mem.targetId === null;
  if (input.fire || moved || paused) {
    mem.progressTicks = 0;
    mem.progressRefX = tank.x;
    mem.progressRefY = tank.y;
    return true;
  }
  return ++mem.progressTicks < ticks(cfg, cfg.aiProgressWindow);
}

function decide(state: MatchState, tank: TankState, mem: AiMemory): TankInput {
  const cfg = state.config;
  if (mem.fireWaitTicks > 0) mem.fireWaitTicks--;
  if (mem.avoidTicks > 0) mem.avoidTicks--;

  const target = selectTarget(state, tank, mem);
  const halfTurnStep = (cfg.tankTurnRate * tickDuration(cfg)) / 2;

  // A lob is aimed at the tank it was meant for, whatever the AI retargets to meanwhile. Until the button is
  // pressed it's called off (keeping the mortar) if that tank is destroyed or steps into a clear turret shot. Once
  // charging, it's seen through, at the tank's last position if need be: it's short, and the AI is a sitting duck
  // while it lasts.
  if (mem.lob) {
    const lobTarget = state.tanks.find((t) => t.id === mem.lob?.targetId && t.alive);
    if (lobTarget) {
      mem.lob.x = lobTarget.x;
      mem.lob.y = lobTarget.y;
    }
    const charging = tank.mortarCharge >= 0;
    const stillHidden =
      lobTarget && !hasClearLane(tank.x, tank.y, lobTarget.x, lobTarget.y, state.board.obstacles, SHOT_LANE);
    if (charging || stillHidden) return lob(state, tank, mem.lob, mem, halfTurnStep);
    mem.lob = null;
  }

  if (!target) return { throttle: 0, turn: 0, fire: false };

  if (mem.recoverTicks > 0) {
    mem.recoverTicks--;
    return { throttle: -1, turn: mem.recoverTurn, fire: false };
  }

  const obstacles = state.board.obstacles;
  const engaging = mem.engaging;
  mem.engaging = false;

  if (hasClearLane(tank.x, tank.y, target.x, target.y, obstacles, engaging ? SHOT_LANE_KEEP : SHOT_LANE)) {
    mem.hiddenTicks = 0;
    mem.seenTicks++;
    if (mem.seenTicks === 1) mem.aimOffset = rollAimError(state);

    const range = distance(tank.x, tank.y, target.x, target.y);
    // Too far away, and no room for the tank itself to drive straight there: take a route instead.
    if (
      range > (engaging ? ENGAGE_KEEP_DISTANCE : ENGAGE_ADVANCE_DISTANCE) &&
      !hasClearLane(
        tank.x,
        tank.y,
        target.x,
        target.y,
        obstacles,
        engaging ? cfg.tankRadius - ROUTE_LANE_SLACK : cfg.tankRadius,
      )
    ) {
      mem.blockedTicks = 0;
      return navigate(state, tank, target, mem, halfTurnStep);
    }
    if (avoiding(mem, tank.x, tank.y)) {
      mem.blockedTicks = 0;
      return navigate(state, tank, target, mem, halfTurnStep);
    }
    mem.engaging = true;
    const aim = Math.atan2(target.y - tank.y, target.x - tank.x) + mem.aimOffset;
    const diff = angleDiff(tank.heading, aim);
    const turn = Math.abs(diff) > halfTurnStep ? (diff > 0 ? 1 : -1) : 0;
    // A jammed turret keeps the aim but doesn't waste a press (or the pause and fresh aim error that follow a shot).
    const ready =
      mem.seenTicks > ticks(cfg, cfg.aiReactionDelay) && mem.fireWaitTicks === 0 && !turretJammed(tank);
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

    // Lined up, but the aim error has the barrel clipping cover, or an ally is in the way. Hold the aim (re-rolling it
    // swung the barrel left and right on the spot, which looked broken) in case the way clears, then back off and come
    // at it from a new spot, with a fresh aim.
    if (linedUp && !barrelClear) {
      mem.blockedTicks++;
      if (mem.blockedTicks >= ticks(cfg, cfg.aiStuckWindow)) return startRecovery(state, tank, mem);
    } else if (barrelClear) {
      mem.blockedTicks = 0;
    }

    const throttle = range > ENGAGE_ADVANCE_DISTANCE && Math.abs(diff) < DRIVE_ANGLE ? 1 : 0;
    if (throttle === 0) mem.stuckTicks = 0;
    else if (isStuck(state, tank, mem)) return startRecovery(state, tank, mem);
    return { throttle, turn, fire };
  }

  mem.seenTicks = 0;
  mem.blockedTicks = 0;
  mem.hiddenTicks++;
  if (shouldLob(state, tank, target, mem)) {
    const range = distance(tank.x, tank.y, target.x, target.y);
    const error = nextRange(state.aiRng, -cfg.aiMortarRangeError, cfg.aiMortarRangeError);
    mem.lob = {
      targetId: target.id,
      x: target.x,
      y: target.y,
      range: Math.min(cfg.mortarMaxRange, Math.max(cfg.mortarMinRange, range * (1 + error))),
      aimOffset: rollAimError(state),
    };
    return lob(state, tank, mem.lob, mem, halfTurnStep);
  }
  return navigate(state, tank, target, mem, halfTurnStep);
}

/**
 * Whether to lob the mortar at a target hidden from the turret. The AI waits for the target to stay hidden a
 * while (no round-start barrage), and only lobs within range. The minimum range is well outside the splash, so a
 * lob at that range never catches the AI itself.
 */
function shouldLob(state: MatchState, tank: TankState, target: TankState, mem: AiMemory): boolean {
  const cfg = state.config;
  if (tank.mortars <= 0 || tank.mortarCharge >= 0) return false;
  if (mem.hiddenTicks < ticks(cfg, cfg.aiMortarPatience)) return false;
  const range = distance(tank.x, tank.y, target.x, target.y);
  return range >= cfg.mortarMinRange && range <= cfg.mortarMaxRange;
}

/**
 * One tick of a committed lob: stop, turn to face the lob's target, press the mortar button once lined up, hold
 * until the charge reaches the planned range, then release (which launches).
 */
function lob(
  state: MatchState,
  tank: TankState,
  plan: NonNullable<AiMemory['lob']>,
  mem: AiMemory,
  halfTurnStep: number,
): TankInput {
  const cfg = state.config;
  const aim = Math.atan2(plan.y - tank.y, plan.x - tank.x) + plan.aimOffset;
  const diff = angleDiff(tank.heading, aim);
  const turn = Math.abs(diff) > halfTurnStep ? (diff > 0 ? 1 : -1) : 0;
  mem.stuckTicks = 0;

  if (tank.mortarCharge < 0) {
    if (tank.mortars <= 0) {
      mem.lob = null; // nothing left to lob (it can't happen in play, but never wait forever)
      return { throttle: 0, turn, fire: false };
    }
    return { throttle: 0, turn, fire: false, mortar: Math.abs(diff) <= cfg.aiAimTolerance };
  }
  const hold = mortarRange(cfg, tank.mortarCharge) < plan.range;
  if (!hold) mem.lob = null; // releasing this tick launches
  return { throttle: 0, turn, fire: false, mortar: hold };
}

function selectTarget(state: MatchState, tank: TankState, mem: AiMemory): TankState | null {
  const cfg = state.config;
  let current = state.tanks.find((t) => t.id === mem.targetId && t.alive) ?? null;
  mem.retargetTicks--;
  if (current && mem.retargetTicks > 0) return current;

  mem.retargetTicks = ticks(cfg, cfg.aiRetargetInterval);
  let best: TankState | null = null;
  let bestScore = Infinity;
  let bestVisible = false;
  for (const other of state.tanks) {
    if (!other.alive || !isEnemy(state, tank, other)) continue;
    const visible = lineOfSight(tank.x, tank.y, other.x, other.y, state.board.obstacles);
    const score = (visible ? 0 : HIDDEN_TARGET_PENALTY) + distance(tank.x, tank.y, other.x, other.y);
    if (score < bestScore) {
      bestScore = score;
      best = other;
      bestVisible = visible;
    }
  }
  if (current && !bestVisible && mem.hiddenTicks < ticks(cfg, TARGET_GRACE_SECONDS)) return current;
  if (best?.id !== current?.id) {
    mem.targetId = best?.id ?? null;
    mem.seenTicks = 0;
    mem.engaging = false;
    mem.hiddenTicks = 0;
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
    if (distance(tank.x, tank.y, wp.x, wp.y) > nav.cellSize * WAYPOINT_REACH) break;
    mem.pathIndex++;
  }
  const arrived = mem.path.length > 0 && mem.pathIndex >= mem.path.length;
  const next = mem.pathIndex < mem.path.length ? cellCenter(nav, mem.path[mem.pathIndex]!) : target;

  const diff = angleDiff(tank.heading, Math.atan2(next.y - tank.y, next.x - tank.x));
  let turn = Math.abs(diff) > halfTurnStep ? (diff > 0 ? 1 : -1) : 0;
  // Arrived, but the shot from exactly where the tank stopped isn't quite clear (the goal was checked from its cell's
  // centre). Face the target and wait there, rather than driving at it, leaving the cell and being sent back: round
  // and round on the spot. If the shot never opens up, the progress watchdog moves it on.
  if (arrived) return { throttle: 0, turn, fire: false };
  if (turn === -mem.navTurn && Math.abs(diff) < NAV_REVERSE_ANGLE) turn = 0;
  if (turn !== 0) mem.navTurn = turn;
  const throttle = Math.abs(diff) < DRIVE_ANGLE ? 1 : 0;

  // Only count time spent trying to drive; turning on the spot isn't being stuck.
  if (throttle === 1 && isStuck(state, tank, mem)) return startRecovery(state, tank, mem);
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

/**
 * Reverses and turns away for a moment, then plans and aims afresh, steering clear of this spot for a while. Returns
 * this tick's input.
 */
function startRecovery(state: MatchState, tank: TankState, mem: AiMemory): TankInput {
  mem.recoverTicks = ticks(state.config, state.config.aiRecoverDuration) - 1;
  mem.recoverTurn = nextFloat(state.aiRng) < 0.5 ? -1 : 1;
  mem.stuckTicks = 0;
  mem.blockedTicks = 0;
  mem.progressTicks = 0;
  mem.avoidX = tank.x;
  mem.avoidY = tank.y;
  mem.avoidTicks = ticks(state.config, AVOID_SECONDS);
  mem.engaging = false;
  mem.path = [];
  mem.replanTicks = 0;
  mem.aimOffset = rollAimError(state);
  return { throttle: -1, turn: mem.recoverTurn, fire: false };
}

/**
 * Plans a route to the nearest spot with a clear shot at the target, close enough to engage from, or sticks with the
 * spot it was already heading for while that still has a clear shot (a replan that flips the goal to the other side of
 * an obstacle has a tank turning one way and then the other on the spot).
 */
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
      !avoiding(mem, c.x, c.y, nav.cellSize * WAYPOINT_REACH) &&
      hasClearLane(c.x, c.y, target.x, target.y, obstacles, SHOT_LANE + GOAL_LANE_MARGIN)
    );
  };
  const previous = mem.path.length > 0 ? mem.path[mem.path.length - 1]! : -1;
  let goal = previous >= 0 && clearShotFrom(previous, ENGAGE_KEEP_DISTANCE) ? previous : -1;
  if (goal < 0) goal = findNearest(nav, start, (cell) => clearShotFrom(cell, ENGAGE_ADVANCE_DISTANCE));
  if (goal < 0) goal = findNearest(nav, start, (cell) => clearShotFrom(cell, Infinity));
  if (goal < 0) goal = nearestWalkable(nav, cellAt(nav, target.x, target.y));
  const path = goal >= 0 ? findPath(nav, start, goal) : null;
  mem.path = path ?? [];
  mem.pathIndex = mem.path.length > 1 ? 1 : 0;
}

/**
 * Whether (x, y) is too close to where this AI recently got stuck to settle there. Planning adds a margin, because a
 * tank stops anywhere within reach of its goal and must not find itself inside the zone on arrival.
 */
function avoiding(mem: AiMemory, x: number, y: number, margin = 0): boolean {
  return mem.avoidTicks > 0 && distance(x, y, mem.avoidX, mem.avoidY) < AVOID_RADIUS + margin;
}

function rollAimError(state: MatchState): number {
  return nextRange(state.aiRng, -state.config.aiAimError, state.config.aiAimError);
}

/** True if a lane of the given half-width between the two points is free of obstacles. */
export function hasClearLane(
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
