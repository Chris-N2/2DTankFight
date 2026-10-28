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

  /**
   * Mortar: the landing distance of a quick tap. Must be more than the splash radius plus two tank radii, so a
   * tap never catches the firer.
   */
  mortarMinRange: number;
  /** Mortar: the landing distance at full charge. */
  mortarMaxRange: number;
  /** Mortar: how long the button must be held to charge from minimum to maximum range, seconds. */
  mortarChargeTime: number;
  /** Mortar: time from launch to landing, whatever the range, seconds. */
  mortarFlightTime: number;
  /** Mortar: tanks whose body comes within this distance of the landing point are slowed. */
  mortarSplashRadius: number;
  /** Mortar: driving speed multiplier while slowed. Turning is unaffected. */
  mortarSlowFactor: number;
  /** Mortar: how long a splash slows a tank, seconds. */
  mortarSlowDuration: number;
  /** Mortar: tanks can't drive while charging. A playtest switch for comparing feel; not shown in the UI. */
  mortarPlantWhileCharging: boolean;

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
  /** How long an AI's target must stay hidden behind cover before the AI lobs its mortar, seconds. */
  aiMortarPatience: number;
  /** Maximum random error in an AI's mortar range either side of exact, as a fraction of the distance. */
  aiMortarRangeError: number;
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
  /**
   * An AI that neither moves `aiStuckDistance` nor fires for this long, whatever it's doing (other than lobbing),
   * backs off and plans afresh, seconds.
   */
  aiProgressWindow: number;

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

  mortarMinRange: 150,
  mortarMaxRange: 600,
  mortarChargeTime: 1,
  mortarFlightTime: 0.8,
  mortarSplashRadius: 60,
  mortarSlowFactor: 0.5,
  mortarSlowDuration: 2.5,
  mortarPlantWhileCharging: false,

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
  aiMortarPatience: 2,
  aiMortarRangeError: 0.08,
  aiRetargetInterval: 0.5,
  aiReplanInterval: 0.5,
  aiStuckWindow: 1,
  aiStuckDistance: 10,
  aiRecoverDuration: 0.5,
  aiProgressWindow: 1.5,

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
