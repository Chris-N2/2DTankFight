import type { SimConfig } from './config';
import type { TankKind, TankState } from './types';

/** Colour indices: the host is green (0) and the second human blue (2). */
export const HUMAN_COLOR_INDEX = 0;
export const SECOND_HUMAN_COLOR_INDEX = 2;

/** AI colour indices by number of humans. With two humans blue is theirs, so the AI are red, yellow and purple. */
const AI_COLOR_INDICES: Record<number, readonly number[]> = { 1: [1, 2, 3, 4], 2: [1, 3, 4] };

/** The colour of AI tank `ai{i}` (1-based), the same whichever wave or round it plays in. */
export function aiColorIndex(humans: number, i: number): number {
  return AI_COLOR_INDICES[humans]![i - 1]!;
}

/** A new tank with the configured default combat values. Its position is set when it spawns. */
export function createTank(config: SimConfig, id: string, kind: TankKind, colorIndex: number): TankState {
  const tank: TankState = {
    id,
    kind,
    colorIndex,
    x: 0,
    y: 0,
    heading: 0,
    hp: 0,
    maxHp: 0,
    shellDamage: 0,
    shellSpeed: 0,
    alive: true,
    cooldown: 0,
    fireHeld: false,
    mortars: 0,
    mortarCharge: -1,
    mortarHeld: false,
    slowTicks: 0,
    mudJamsTurret: false,
  };
  setDefaultCombat(config, tank);
  tank.hp = tank.maxHp;
  return tank;
}

/** Resets a tank's maximum hit points, shell damage and shell speed to the configured defaults. */
export function setDefaultCombat(config: SimConfig, tank: TankState): void {
  tank.maxHp = config.tankMaxHp;
  tank.shellDamage = config.shellDamage;
  tank.shellSpeed = config.shellSpeed;
}

/** Whether a mortar splash has jammed this tank's turret: it can't fire for as long as it's slowed. */
export function turretJammed(tank: TankState): boolean {
  return tank.mudJamsTurret && tank.slowTicks > 0;
}
