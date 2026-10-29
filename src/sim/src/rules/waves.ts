import type { SimConfig } from '../config';
import { AI_COUNT_MAX, aiCountMax, humansOf } from '../options';
import { aiColorIndex, createTank, setDefaultCombat } from '../tank';
import type { MatchState, SimEvent, WaveChange, WavesState } from '../types';
import type { ModeRules } from '.';

/** One wave's AI line-up and combat values. */
export interface WaveSetup {
  aiCount: number;
  aiMaxHp: number;
  aiShellDamage: number;
  aiShellSpeed: number;
  /** What this wave changed for the AI tanks, compared with the wave before. */
  changes: WaveChange[];
}

/**
 * The whole Waves difficulty curve in one place. Wave sizes grow by one AI tank until there are `aiCap` (4 in
 * single-player, 3 with two humans), and the more AI tanks there are, the thinner their armour. Each wave after the
 * first full-size one applies one more escalation step: armour back up to normal first, then damage until one hit
 * is lethal, then shell speed up to the cap.
 */
export function waveSetup(
  config: SimConfig,
  startAiCount: number,
  wave: number,
  aiCap: number = AI_COUNT_MAX,
): WaveSetup {
  const aiCount = aiCountFor(startAiCount, wave, aiCap);
  const fullSizeHp = baseAiMaxHp(config, aiCap);
  const schedule = escalationSchedule(config, fullSizeHp);
  const firstFullWave = aiCap - startAiCount + 1;
  const step = wave - firstFullWave;

  let aiMaxHp = baseAiMaxHp(config, aiCount);
  let aiShellDamage = config.shellDamage;
  let speedSteps = 0;
  for (const change of schedule.slice(0, Math.max(0, step))) {
    if (change === 'armour') aiMaxHp = Math.min(aiMaxHp + config.wavesArmourStep, config.tankMaxHp);
    else if (change === 'speed') speedSteps++;
    else aiShellDamage += config.wavesDamageStep;
  }
  const speedFactor = Math.min(1 + config.wavesSpeedStep * speedSteps, config.wavesMaxShellSpeedFactor);

  let changes: WaveChange[] = [];
  if (step >= 1 && step <= schedule.length) changes = [schedule[step - 1]!];
  else if (wave > 1 && aiMaxHp < baseAiMaxHp(config, aiCountFor(startAiCount, wave - 1, aiCap)))
    changes = ['thinnerArmour'];

  return {
    aiCount,
    aiMaxHp,
    aiShellDamage,
    aiShellSpeed: config.shellSpeed * speedFactor,
    changes,
  };
}

function aiCountFor(startAiCount: number, wave: number, aiCap: number): number {
  return Math.min(startAiCount + wave - 1, aiCap);
}

/** AI maximum hit points for a wave of this many AI tanks, before any escalation. */
function baseAiMaxHp(config: SimConfig, aiCount: number): number {
  return config.wavesAiMaxHpByCount[aiCount - 1] ?? config.tankMaxHp;
}

/** The escalation steps in the order they apply, one per wave. */
function escalationSchedule(config: SimConfig, fullSizeHp: number): WaveChange[] {
  const schedule: WaveChange[] = [];
  // Armour rebuilds from the full-size wave's value to normal, never beyond it.
  if (config.wavesArmourStep > 0) {
    for (let hp = fullSizeHp; hp < config.tankMaxHp; hp += config.wavesArmourStep) schedule.push('armour');
  }

  // A human always has the configured maximum hit points; escalation never touches them.
  if (config.wavesDamageStep > 0) {
    for (let damage = config.shellDamage; damage < config.tankMaxHp;) {
      damage += config.wavesDamageStep;
      schedule.push(damage >= config.tankMaxHp ? 'lethal' : 'damage');
    }
  }

  if (config.wavesSpeedStep > 0) {
    // The small allowance stops floating-point error adding a step that changes nothing.
    const speedSteps = Math.ceil((config.wavesMaxShellSpeedFactor - 1) / config.wavesSpeedStep - 1e-9);
    for (let i = 0; i < speedSteps; i++) schedule.push('speed');
  }
  return schedule;
}

/**
 * Survive wave after wave of co-operating AI tanks; the score is the number of waves cleared. With two humans, a
 * human destroyed mid-wave sits out the rest of it and is back for the next: every human starts every wave.
 */
export const waves: ModeRules = {
  setUp(state, events) {
    const cfg = state.config;
    // Wave sizes follow the humans the game started with, so a player left on their own after their partner has
    // gone isn't punished with an extra AI tank.
    const humanCount = humansOf(state.options);
    const setup = waveSetup(cfg, wavesOf(state).startAiCount, state.round, aiCountMax(humanCount));
    const humans = state.tanks.filter((t) => t.kind === 'human');
    for (const human of humans) {
      setDefaultCombat(cfg, human);
      human.mortars = state.options.mortars ? 1 : 0;
    }

    // AI tanks are rebuilt every wave. A tank keeps its id and colour from wave to wave. They never get a
    // mortar: in Waves it's the outnumbered human's tool, and the mud jams their turrets while they're slowed.
    const ai = [];
    for (let i = 1; i <= setup.aiCount; i++) {
      const tank = createTank(cfg, `ai${i}`, 'ai', aiColorIndex(humanCount, i));
      tank.maxHp = setup.aiMaxHp;
      tank.hp = setup.aiMaxHp;
      tank.shellDamage = setup.aiShellDamage;
      tank.shellSpeed = setup.aiShellSpeed;
      tank.mudJamsTurret = true;
      ai.push(tank);
    }
    state.tanks = [...humans, ...ai];
    events.push({ type: 'waveStarted', wave: state.round, aiCount: setup.aiCount, changes: setup.changes });
  },

  evaluate(state) {
    // The last human and the last AI tank going down in the same tick still clears the wave (see finish).
    if (!state.tanks.some((t) => t.kind === 'human' && t.alive)) return 'gameOver';
    return state.tanks.some((t) => t.kind === 'ai' && t.alive) ? 'continue' : 'next';
  },

  finish(state, ending, events) {
    const data = wavesOf(state);
    if (!state.tanks.some((t) => t.kind === 'ai' && t.alive)) {
      data.cleared++;
      events.push({ type: 'waveCleared', wave: state.round, cleared: data.cleared });
    }
    if (ending === 'gameOver') endGame(state, events);
  },

  left(state, _humanId, events) {
    // The game carries on for the human who stays, unless they're out for the rest of this wave. Once the wave is
    // cleared they're only waiting to respawn, so the game carries on then too. With both humans gone, whatever
    // the phase, there's nobody to carry on.
    const humans = state.tanks.filter((t) => t.kind === 'human');
    if (humans.length === 0 || (state.phase === 'playing' && !humans.some((t) => t.alive))) {
      endGame(state, events);
    }
  },
};

function endGame(state: MatchState, events: SimEvent[]): void {
  state.result = 'over';
  events.push({ type: 'gameEnded', result: 'over', wavesCleared: wavesOf(state).cleared });
}

function wavesOf(state: MatchState): WavesState {
  if (!state.waves) throw new Error('Not a Waves match.');
  return state.waves;
}
