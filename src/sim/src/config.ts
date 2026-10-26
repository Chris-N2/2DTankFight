/**
 * Balance and tuning values. Everything a playtest might want to change lives here.
 * Durations are in seconds and distances in world units; the simulation converts
 * durations to whole ticks with {@link ticks} so timers never drift.
 */
export interface SimConfig {
  /** Simulation ticks per second. */
  tickRate: number;

  tankRadius: number;
  /** Forward speed, units per second. */
  tankSpeed: number;
  /** Reverse speed, units per second. Slower than forward. */
  tankReverseSpeed: number;
  /** Turn rate, radians per second. */
  tankTurnRate: number;
  tankMaxHp: number;

  shellSpeed: number;
  shellLifetime: number;
  shellDamage: number;
  /** Distance beyond the tank's radius at which a shell leaves the barrel. */
  muzzleOffset: number;
  fireCooldown: number;

  countdownDuration: number;
  /** The pause after a round, or after a cleared wave, seconds. */
  roundResultDuration: number;

  /**
   * Waves: AI maximum hit points by the number of AI tanks in the wave (index 0 is one tank), before escalation.
   * Bigger waves get thinner armour, so the human can still fight their way through them.
   */
  wavesAiMaxHpByCount: readonly number[];
  /** Waves: AI maximum hit points added per armour step, rebuilding armour up to {@link tankMaxHp}. */
  wavesArmourStep: number;
  /** Waves: AI shell damage added per damage step, until one hit destroys a full-health human. */
  wavesDamageStep: number;
  /** Waves: AI shell speed added per speed step, as a fraction of the normal shell speed. */
  wavesSpeedStep: number;
  /** Waves: the cap on AI shell speed, as a multiple of the normal shell speed. */
  wavesMaxShellSpeedFactor: number;
  /**
   * Waves: AI tanks are allies who don't target each other or fire through each other. Turning this off
   * brings back Last One Standing's infighting, for comparing difficulty in a playtest. Not shown in the UI.
   */
  wavesAiCooperate: boolean;

  aiReactionDelay: number;
  /** Maximum random aim error either side of dead-on, radians. */
  aiAimError: number;
  /** Heading must be within this of the (error-adjusted) aim angle to fire, radians. */
  aiAimTolerance: number;
  /**
   * After reloading, an AI waits a random extra pause of up to this long before firing again, seconds.
   * Keeps it from always firing the instant it can, which no human manages.
   */
  aiFirePauseMax: number;
  /** How often an AI re-evaluates its target, seconds. */
  aiRetargetInterval: number;
  /** How often an AI re-plans its route, seconds. */
  aiReplanInterval: number;
  /** Window over which an AI checks it's still making progress, seconds. */
  aiStuckWindow: number;
  /** Minimum distance moved within the stuck window to count as progress. */
  aiStuckDistance: number;
  /** How long an AI reverses and turns when it's stuck, seconds. */
  aiRecoverDuration: number;

  /** Navigation grid cell size in world units. */
  navCellSize: number;
  /** Extra clearance around obstacles when deciding a nav cell is drivable. */
  navMargin: number;

  boardMinObstacles: number;
  boardMinSpawnSpacing: number;
}

const DEG = Math.PI / 180;

export const DEFAULT_CONFIG: Readonly<SimConfig> = Object.freeze({
  tickRate: 60,

  tankRadius: 18,
  tankSpeed: 120,
  tankReverseSpeed: 70,
  tankTurnRate: 180 * DEG,
  tankMaxHp: 3,

  shellSpeed: 360,
  shellLifetime: 3,
  shellDamage: 1,
  muzzleOffset: 6,
  fireCooldown: 0.5,

  countdownDuration: 3,
  roundResultDuration: 2.5,

  wavesAiMaxHpByCount: Object.freeze([3, 2, 1, 1]),
  wavesArmourStep: 1,
  wavesDamageStep: 1,
  wavesSpeedStep: 0.2,
  wavesMaxShellSpeedFactor: 2,
  wavesAiCooperate: true,

  aiReactionDelay: 0.35,
  aiAimError: 3 * DEG,
  aiAimTolerance: 4 * DEG,
  aiFirePauseMax: 0.15,
  aiRetargetInterval: 0.5,
  aiReplanInterval: 0.5,
  aiStuckWindow: 1,
  aiStuckDistance: 10,
  aiRecoverDuration: 0.5,

  navCellSize: 18,
  navMargin: 2,

  boardMinObstacles: 6,
  boardMinSpawnSpacing: 250,
});

/** Converts a duration in seconds to a whole number of ticks. */
export function ticks(config: Pick<SimConfig, 'tickRate'>, seconds: number): number {
  return Math.round(seconds * config.tickRate);
}

/** The fixed duration of one tick, in seconds. */
export function tickDuration(config: Pick<SimConfig, 'tickRate'>): number {
  return 1 / config.tickRate;
}
