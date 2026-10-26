import { ticks, tickDuration } from './config';
import {
  circleInBounds,
  circleRectOverlap,
  distance,
  sweepBounds,
  sweepCircle,
  sweepRect,
  wrapAngle,
} from './geometry';
import {
  IDLE_INPUT,
  type InputMap,
  type MatchState,
  type ShellState,
  type SimEvent,
  type TankState,
} from './types';

/** How far a shell is pushed off a surface after bouncing, so it doesn't immediately touch it again. */
const BOUNCE_NUDGE = 0.01;

/**
 * Advances the physical world by one tick: tank movement and collisions, shell flight, bounces,
 * hits, new shots and eliminations. Game rules (rounds, scoring) are handled by the match layer.
 */
export function stepWorld(state: MatchState, inputs: InputMap, events: SimEvent[]): void {
  const lastHitBy: Record<string, string> = {};

  for (const tank of state.tanks) {
    if (!tank.alive) continue;
    if (tank.cooldown > 0) tank.cooldown--;
    moveTank(state, tank, inputs[tank.id] ?? IDLE_INPUT);
  }

  // Existing shells fly before new ones are fired, so a fresh shell only travels its muzzle distance this tick.
  const survivors: ShellState[] = [];
  for (const shell of state.shells) {
    shell.ticksLeft--;
    if (shell.ticksLeft <= 0) {
      events.push({ type: 'shellDestroyed', shellId: shell.id, x: shell.x, y: shell.y });
      continue;
    }
    if (moveShell(state, shell, state.config.shellSpeed * tickDuration(state.config), events, lastHitBy)) {
      survivors.push(shell);
    }
  }
  state.shells = survivors;

  // Decide who fires before any new shell can do damage, so point-blank shots in the same tick are
  // simultaneous: being hit by one doesn't stop a tank getting its own shot away.
  const firing: TankState[] = [];
  for (const tank of state.tanks) {
    if (!tank.alive) continue;
    const input = inputs[tank.id] ?? IDLE_INPUT;
    const pressed = input.fire && !tank.fireHeld;
    tank.fireHeld = input.fire;
    if (pressed && tank.cooldown === 0 && tank.hp > 0) firing.push(tank);
  }
  for (const tank of firing) fire(state, tank, events, lastHitBy);

  // All hits in this tick are resolved together, so several tanks can be eliminated at once.
  for (const tank of state.tanks) {
    if (tank.alive && tank.hp <= 0) {
      tank.alive = false;
      tank.hp = 0;
      events.push({
        type: 'eliminated',
        tankId: tank.id,
        byId: lastHitBy[tank.id] ?? tank.id,
        x: tank.x,
        y: tank.y,
      });
    }
  }
}

function moveTank(state: MatchState, tank: TankState, input: TankInputLike): void {
  const cfg = state.config;
  const dt = tickDuration(cfg);
  tank.heading = wrapAngle(tank.heading + cleanTurn(input.turn) * cfg.tankTurnRate * dt);

  const speed = input.throttle > 0 ? cfg.tankSpeed : input.throttle < 0 ? -cfg.tankReverseSpeed : 0;
  if (speed === 0) return;
  const dx = Math.cos(tank.heading) * speed * dt;
  const dy = Math.sin(tank.heading) * speed * dt;

  // Resolve each axis separately: against axis-aligned walls this cancels only the blocked
  // component, so a tank driving diagonally into a wall slides along it.
  if (!isBlocked(state, tank, tank.x + dx, tank.y)) tank.x += dx;
  if (!isBlocked(state, tank, tank.x, tank.y + dy)) tank.y += dy;
}

type TankInputLike = { throttle: number; turn: number };

/**
 * Inputs may one day arrive from untrusted network clients, and a NaN in a heading would spread into every
 * later tick, so the turn amount is cleaned here, where every input passes through.
 */
function cleanTurn(turn: number): number {
  if (!Number.isFinite(turn)) return 0;
  return Math.max(-1, Math.min(1, turn));
}

function isBlocked(state: MatchState, tank: TankState, nx: number, ny: number): boolean {
  const r = state.config.tankRadius;
  const { board } = state;
  if (!circleInBounds(nx, ny, r, board.width, board.height)) return true;
  for (const rect of board.obstacles) {
    if (circleRectOverlap(nx, ny, r, rect)) return true;
  }
  for (const other of state.tanks) {
    if (other === tank || !other.alive) continue;
    const after = distance(nx, ny, other.x, other.y);
    // Only block moves that make an overlap worse, so tanks can always separate.
    if (after < 2 * r && after < distance(tank.x, tank.y, other.x, other.y)) return true;
  }
  return false;
}

function fire(
  state: MatchState,
  tank: TankState,
  events: SimEvent[],
  lastHitBy: Record<string, string>,
): void {
  const cfg = state.config;
  const dirX = Math.cos(tank.heading);
  const dirY = Math.sin(tank.heading);
  const muzzle = cfg.tankRadius + cfg.muzzleOffset;
  const shell: ShellState = {
    id: state.nextShellId++,
    ownerId: tank.id,
    x: tank.x,
    y: tank.y,
    vx: dirX * cfg.shellSpeed,
    vy: dirY * cfg.shellSpeed,
    bounces: 0,
    ticksLeft: ticks(cfg, cfg.shellLifetime),
  };
  tank.cooldown = ticks(cfg, cfg.fireCooldown);
  events.push({
    type: 'shotFired',
    tankId: tank.id,
    shellId: shell.id,
    x: tank.x + dirX * muzzle,
    y: tank.y + dirY * muzzle,
    heading: tank.heading,
  });
  // The shell starts at the tank's centre and travels to the muzzle. If the tank is pressed against
  // a wall, that first sweep hits the wall and the shell bounces straight back. As tradition demands.
  if (moveShell(state, shell, muzzle, events, lastHitBy)) state.shells.push(shell);
}

/**
 * Moves a shell `dist` units along its velocity, handling bounces and hits.
 * Returns false if the shell was destroyed.
 */
function moveShell(
  state: MatchState,
  shell: ShellState,
  dist: number,
  events: SimEvent[],
  lastHitBy: Record<string, string>,
): boolean {
  const cfg = state.config;
  const { board } = state;
  let remaining = dist;

  // At most one bounce plus the final contact, so this loop runs at most three times.
  for (let guard = 0; guard < 4 && remaining > 0; guard++) {
    const speed = Math.hypot(shell.vx, shell.vy);
    const x1 = shell.x + (shell.vx / speed) * remaining;
    const y1 = shell.y + (shell.vy / speed) * remaining;

    let bestT = Infinity;
    let wallNx = 0;
    let wallNy = 0;
    let hitTank: TankState | null = null;

    for (const tank of state.tanks) {
      if (!tank.alive) continue;
      if (tank.id === shell.ownerId && shell.bounces === 0) continue; // no self-hits before a bounce
      const t = sweepCircle(shell.x, shell.y, x1, y1, tank.x, tank.y, cfg.tankRadius);
      if (t !== null && t < bestT) {
        bestT = t;
        hitTank = tank;
      }
    }
    for (const rect of board.obstacles) {
      const c = sweepRect(shell.x, shell.y, x1, y1, rect);
      if (c && c.t < bestT) {
        bestT = c.t;
        wallNx = c.nx;
        wallNy = c.ny;
        hitTank = null;
      }
    }
    const edge = sweepBounds(shell.x, shell.y, x1, y1, board.width, board.height);
    if (edge && edge.t < bestT) {
      bestT = edge.t;
      wallNx = edge.nx;
      wallNy = edge.ny;
      hitTank = null;
    }

    if (bestT === Infinity) {
      shell.x = x1;
      shell.y = y1;
      return true;
    }

    const cx = shell.x + (x1 - shell.x) * bestT;
    const cy = shell.y + (y1 - shell.y) * bestT;

    if (hitTank) {
      hitTank.hp -= cfg.shellDamage;
      lastHitBy[hitTank.id] = shell.ownerId;
      events.push({
        type: 'hit',
        shooterId: shell.ownerId,
        targetId: hitTank.id,
        shellId: shell.id,
        damage: cfg.shellDamage,
        x: cx,
        y: cy,
      });
      return false;
    }

    if (shell.bounces >= 1) {
      events.push({ type: 'shellDestroyed', shellId: shell.id, x: cx, y: cy });
      return false;
    }

    // Reflect: negate the velocity component along the surface normal.
    if (wallNx !== 0) shell.vx = -shell.vx;
    if (wallNy !== 0) shell.vy = -shell.vy;
    shell.bounces++;
    shell.x = cx + wallNx * BOUNCE_NUDGE;
    shell.y = cy + wallNy * BOUNCE_NUDGE;
    remaining *= 1 - bestT;
    events.push({ type: 'bounce', shellId: shell.id, x: cx, y: cy });
  }
  return true;
}
