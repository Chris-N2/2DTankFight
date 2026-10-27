import type { SimConfig } from './config';
import type { TankKind, TankState } from './types';

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
