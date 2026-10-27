import { ticks, type SimConfig } from './config';
import { distance } from './geometry';
import {
  IDLE_INPUT,
  type InputMap,
  type MatchState,
  type MortarState,
  type SimEvent,
  type TankState,
} from './types';

/**
 * The mortar's range for a charge of `chargeTicks`: the minimum range on the tick the button is pressed, growing
 * steadily to the maximum over the full-charge time, then holding there.
 */
export function mortarRange(config: SimConfig, chargeTicks: number): number {
  const full = ticks(config, config.mortarChargeTime);
  const fraction = full <= 0 ? 1 : Math.min(1, Math.max(0, chargeTicks) / full);
  return config.mortarMinRange + (config.mortarMaxRange - config.mortarMinRange) * fraction;
}

/**
 * Where a mortar launched now by `tank` with this charge would land: straight ahead at the charged range, pulled
 * back inside the arena if that's beyond the edge. The client draws its aiming reticle from this too.
 */
export function mortarLanding(
  state: MatchState,
  tank: TankState,
  chargeTicks: number,
): { x: number; y: number } {
  const range = mortarRange(state.config, chargeTicks);
  const { width, height } = state.board;
  return {
    x: Math.min(width, Math.max(0, tank.x + Math.cos(tank.heading) * range)),
    y: Math.min(height, Math.max(0, tank.y + Math.sin(tank.heading) * range)),
  };
}

/**
 * Flies every mortar in the air for one tick and lands those that are due. A landing slows every live tank whose
 * body is within the splash radius, the firer included; walls don't shield anyone, and nobody is damaged.
 */
export function flyMortars(state: MatchState, events: SimEvent[]): void {
  const cfg = state.config;
  const reach = cfg.mortarSplashRadius + cfg.tankRadius;
  const inFlight: MortarState[] = [];
  for (const mortar of state.mortarShells) {
    if (--mortar.ticksLeft > 0) {
      inFlight.push(mortar);
      continue;
    }
    const slowedIds: string[] = [];
    for (const tank of state.tanks) {
      if (!tank.alive || distance(tank.x, tank.y, mortar.toX, mortar.toY) > reach) continue;
      // A second splash restarts the slow; it never makes the tank any slower.
      tank.slowTicks = ticks(cfg, cfg.mortarSlowDuration);
      slowedIds.push(tank.id);
    }
    events.push({
      type: 'mortarLanded',
      mortarId: mortar.id,
      ownerId: mortar.ownerId,
      x: mortar.toX,
      y: mortar.toY,
      slowedIds,
    });
  }
  state.mortarShells = inFlight;
}

/**
 * Charging and launching. Pressing the mortar button with a mortar loaded starts a charge; each further tick
 * held adds to it; releasing launches. Holding never launches by itself.
 */
export function chargeMortars(state: MatchState, inputs: InputMap, events: SimEvent[]): void {
  for (const tank of state.tanks) {
    if (!tank.alive) continue;
    const held = (inputs[tank.id] ?? IDLE_INPUT).mortar === true;
    const pressed = held && !tank.mortarHeld;
    tank.mortarHeld = held;

    if (tank.mortarCharge >= 0) {
      if (held) tank.mortarCharge++;
      else if (tank.hp > 0) launch(state, tank, events);
      else tank.mortarCharge = -1; // destroyed this tick: the mortar goes nowhere
    } else if (pressed && tank.mortars > 0) {
      tank.mortarCharge = 0;
    }
  }
}

function launch(state: MatchState, tank: TankState, events: SimEvent[]): void {
  const cfg = state.config;
  const to = mortarLanding(state, tank, tank.mortarCharge);
  const flightTicks = Math.max(1, ticks(cfg, cfg.mortarFlightTime));
  const mortar: MortarState = {
    id: state.nextMortarId++,
    ownerId: tank.id,
    fromX: tank.x,
    fromY: tank.y,
    toX: to.x,
    toY: to.y,
    flightTicks,
    ticksLeft: flightTicks,
  };
  state.mortarShells.push(mortar);
  tank.mortars--;
  tank.mortarCharge = -1;
  events.push({
    type: 'mortarLaunched',
    mortarId: mortar.id,
    tankId: tank.id,
    x: tank.x,
    y: tank.y,
    toX: to.x,
    toY: to.y,
  });
}
