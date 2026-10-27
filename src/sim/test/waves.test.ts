import { describe, expect, test } from 'vitest';
import {
  createMatch,
  DEFAULT_CONFIG,
  PROVING_GROUND,
  step,
  validateOptions,
  waveSetup,
  type MatchState,
  type SimEvent,
  type WaveChange,
} from '../src';
import {
  addShell,
  cfg,
  finishRound,
  makeBoard,
  ofType,
  place,
  playingWaves,
  skipToPlay,
  tank,
} from './helpers';

const COUNTDOWN_TICKS = Math.round(cfg.countdownDuration * cfg.tickRate);
const RESULT_TICKS = Math.round(cfg.roundResultDuration * cfg.tickRate);

function waves(startAiCount: number, seed = 5): MatchState {
  return createMatch({ mode: 'waves', startAiCount, mortars: false }, PROVING_GROUND, seed);
}

/** Clears the current wave through the real rules and steps on until the next wave is in play. */
function clearWave(state: MatchState): SimEvent[] {
  const events = finishRound(state, 'human');
  events.push(...skipToPlay(state));
  return events;
}

const aiTanks = (state: MatchState) => state.tanks.filter((t) => t.kind === 'ai');

describe('waves: escalation schedule', () => {
  // [wave, AI count, AI max HP, AI damage, AI shell speed factor, changes]
  type Row = [number, number, number, number, number, WaveChange[]];

  // The D4 example from the design, starting with 1 AI tank.
  const START_1: Row[] = [
    [1, 1, 3, 1, 1, []],
    [2, 2, 2, 1, 1, ['thinnerArmour']],
    [3, 3, 1, 1, 1, ['thinnerArmour']],
    [4, 4, 1, 1, 1, []],
    [5, 4, 2, 1, 1, ['armour']],
    [6, 4, 3, 1, 1, ['armour']],
    [7, 4, 3, 2, 1, ['damage']],
    [8, 4, 3, 3, 1, ['lethal']],
    [9, 4, 3, 3, 1.2, ['speed']],
    [10, 4, 3, 3, 1.4, ['speed']],
    [11, 4, 3, 3, 1.6, ['speed']],
    [12, 4, 3, 3, 1.8, ['speed']],
    [13, 4, 3, 3, 2, ['speed']],
    [14, 4, 3, 3, 2, []],
    [30, 4, 3, 3, 2, []],
  ];

  const START_3: Row[] = [
    [1, 3, 1, 1, 1, []],
    [2, 4, 1, 1, 1, []],
    [3, 4, 2, 1, 1, ['armour']],
    [4, 4, 3, 1, 1, ['armour']],
    [5, 4, 3, 2, 1, ['damage']],
    [6, 4, 3, 3, 1, ['lethal']],
    [7, 4, 3, 3, 1.2, ['speed']],
    [11, 4, 3, 3, 2, ['speed']],
    [12, 4, 3, 3, 2, []],
  ];

  const START_4: Row[] = [
    [1, 4, 1, 1, 1, []],
    [2, 4, 2, 1, 1, ['armour']],
    [3, 4, 3, 1, 1, ['armour']],
    [4, 4, 3, 2, 1, ['damage']],
    [5, 4, 3, 3, 1, ['lethal']],
    [6, 4, 3, 3, 1.2, ['speed']],
    [10, 4, 3, 3, 2, ['speed']],
    [11, 4, 3, 3, 2, []],
  ];

  for (const [start, rows] of [
    [1, START_1],
    [3, START_3],
    [4, START_4],
  ] as const) {
    test.each(rows)(
      `start ${start}, wave %i: %i AI, HP %i, damage %i, speed ×%f`,
      (wave, ai, hp, damage, speed, changes) => {
        const setup = waveSetup(DEFAULT_CONFIG, start, wave);
        expect(setup.aiCount).toBe(ai);
        expect(setup.aiMaxHp).toBe(hp);
        expect(setup.aiShellDamage).toBe(damage);
        expect(setup.aiShellSpeed).toBeCloseTo(DEFAULT_CONFIG.shellSpeed * speed);
        expect(setup.changes).toEqual(changes);
      },
    );
  }

  test('Never more than five tanks', () => {
    for (let start = 1; start <= 4; start++) {
      for (let wave = 1; wave <= 40; wave++) {
        expect(waveSetup(DEFAULT_CONFIG, start, wave).aiCount).toBeLessThanOrEqual(4);
      }
    }
  });

  test('Shell speed is capped', () => {
    let previous = 0;
    for (let wave = 1; wave <= 40; wave++) {
      const { aiShellSpeed } = waveSetup(DEFAULT_CONFIG, 1, wave);
      expect(aiShellSpeed).toBeGreaterThanOrEqual(previous);
      expect(aiShellSpeed).toBeLessThanOrEqual(DEFAULT_CONFIG.shellSpeed * 2 + 1e-9);
      previous = aiShellSpeed;
    }
  });

  test('Damage rises until one hit is lethal, and then stops rising', () => {
    const damages = Array.from({ length: 40 }, (_, i) => waveSetup(DEFAULT_CONFIG, 1, i + 1).aiShellDamage);
    expect(Math.max(...damages)).toBe(DEFAULT_CONFIG.tankMaxHp);
    for (let i = 1; i < damages.length; i++) expect(damages[i]).toBeGreaterThanOrEqual(damages[i - 1]!);
  });

  test('the schedule follows the config', () => {
    const config = {
      ...DEFAULT_CONFIG,
      wavesAiMaxHpByCount: [4, 3, 2, 2],
      tankMaxHp: 4,
      wavesSpeedStep: 0.5,
    };
    const changes = Array.from({ length: 12 }, (_, i) => waveSetup(config, 1, i + 1).changes).flat();
    expect(changes).toEqual([
      'thinnerArmour',
      'thinnerArmour',
      'armour',
      'armour',
      'damage',
      'damage',
      'lethal',
      'speed',
      'speed',
    ]);
  });

  test('wave 1 never announces thinner armour', () => {
    for (let start = 1; start <= 4; start++) expect(waveSetup(DEFAULT_CONFIG, start, 1).changes).toEqual([]);
  });

  test('Armour recovers to normal', () => {
    for (let start = 1; start <= 4; start++) {
      const firstFull = 5 - start;
      let previous = 0;
      for (let wave = firstFull; wave <= 40; wave++) {
        const { aiMaxHp } = waveSetup(DEFAULT_CONFIG, start, wave);
        expect(aiMaxHp).toBeGreaterThanOrEqual(previous);
        expect(aiMaxHp).toBeLessThanOrEqual(DEFAULT_CONFIG.tankMaxHp);
        previous = aiMaxHp;
      }
      expect(previous).toBe(DEFAULT_CONFIG.tankMaxHp);
    }
  });
});

describe('waves: options', () => {
  test('Choosing the starting wave size', () => {
    const state = waves(2);
    expect(state.round).toBe(1);
    expect(aiTanks(state)).toHaveLength(2);
    expect(state.tanks.filter((t) => t.kind === 'human')).toHaveLength(1);
    expect(state.waves).toEqual({ startAiCount: 2, cleared: 0 });
  });

  test('Invalid starting count is rejected', () => {
    for (const startAiCount of [0, 5, 1.5, NaN]) {
      const options = { mode: 'waves' as const, startAiCount, mortars: false };
      expect(validateOptions(options)).toMatch(/Starting number of AI tanks/);
      expect(() => createMatch(options, PROVING_GROUND, 1)).toThrow(/Starting number of AI tanks/);
    }
    for (const startAiCount of [1, 2, 3, 4])
      expect(validateOptions({ mode: 'waves', startAiCount, mortars: false })).toBeNull();
  });

  test('an unknown mode is rejected', () => {
    const options = { mode: 'captureTheFlag', aiCount: 1, rounds: 1 } as never;
    expect(validateOptions(options)).not.toBeNull();
    expect(() => createMatch(options, PROVING_GROUND, 1)).toThrow();
  });
});

describe('waves: wave start and size', () => {
  test('One more tank each wave', () => {
    const state = waves(1);
    const sizes = [aiTanks(state).length];
    for (let i = 0; i < 4; i++) {
      clearWave(state);
      sizes.push(aiTanks(state).length);
    }
    expect(sizes).toEqual([1, 2, 3, 4, 4]);
  });

  test('Never more than five tanks, in play', () => {
    const state = waves(3);
    for (let i = 0; i < 6; i++) {
      expect(state.tanks.length).toBeLessThanOrEqual(5);
      clearWave(state);
    }
  });

  test('every tank starts a wave alive at its own spawn, with shells cleared', () => {
    const state = waves(2);
    skipToPlay(state);
    addShell(state, 400, 300, 0);
    const events = clearWave(state);
    expect(ofType(events, 'waveStarted')[0]).toMatchObject({
      wave: 2,
      aiCount: 3,
      changes: ['thinnerArmour'],
    });
    expect(state.shells).toHaveLength(0);
    const spots = new Set(state.tanks.map((t) => `${t.x},${t.y}`));
    expect(spots.size).toBe(state.tanks.length);
    for (const t of state.tanks) expect(t.alive).toBe(true);
    // A tank keeps its id and colour from wave to wave.
    expect(aiTanks(state).map((t) => [t.id, t.colorIndex])).toEqual([
      ['ai1', 1],
      ['ai2', 2],
      ['ai3', 3],
    ]);
  });

  test('Full armour every wave', () => {
    const state = waves(1);
    skipToPlay(state);
    tank(state, 'p1').hp = 1;
    finishRound(state, 'human');
    expect(tank(state, 'p1').hp).toBe(1);
    skipToPlay(state);
    expect(tank(state, 'p1').hp).toBe(cfg.tankMaxHp);
  });

  test('Countdown before each wave', () => {
    const state = waves(1);
    finishRound(state, 'human');
    // Through the breather and the next countdown, nothing moves or fires, whatever the human presses.
    let started = false;
    let before = '';
    for (let i = 0; i < RESULT_TICKS + COUNTDOWN_TICKS - 1; i++) {
      const events = step(state, { p1: { throttle: 1, turn: 1, fire: i % 2 === 0 } });
      if (ofType(events, 'waveStarted').length > 0) {
        started = true;
        before = JSON.stringify(state.tanks);
      }
      expect(ofType(events, 'shotFired')).toHaveLength(0);
    }
    expect(started).toBe(true);
    expect(state.phase).toBe('countdown');
    expect(JSON.stringify(state.tanks)).toBe(before);
    expect(state.shells).toHaveLength(0);
    expect(ofType(step(state, {}), 'playStarted')).toHaveLength(1);
    expect(state.phase).toBe('playing');
  });

  test('Bigger waves, thinner armour', () => {
    const state = waves(1);
    const armour = [];
    for (let i = 0; i < 4; i++) {
      armour.push(aiTanks(state).map((t) => [t.maxHp, t.hp]));
      clearWave(state);
    }
    expect(armour).toEqual([
      [[3, 3]],
      [
        [2, 2],
        [2, 2],
      ],
      [
        [1, 1],
        [1, 1],
        [1, 1],
      ],
      [
        [1, 1],
        [1, 1],
        [1, 1],
        [1, 1],
      ],
    ]);
    expect(tank(state, 'p1').maxHp).toBe(cfg.tankMaxHp);
  });

  test('A big start is a thin start', () => {
    for (const t of aiTanks(waves(4))) expect([t.maxHp, t.hp]).toEqual([1, 1]);
    for (const t of aiTanks(waves(3))) expect([t.maxHp, t.hp]).toEqual([1, 1]);
  });

  test('Armour comes first, and escalation is announced', () => {
    const state = waves(4);
    const before = { ...aiTanks(state)[0]! };
    const events = clearWave(state);
    expect(ofType(events, 'waveStarted')[0]).toMatchObject({ wave: 2, aiCount: 4, changes: ['armour'] });
    for (const t of aiTanks(state)) {
      expect(t.maxHp).toBe(before.maxHp + 1);
      expect(t.hp).toBe(t.maxHp);
      expect(t.shellDamage).toBe(before.shellDamage);
      expect(t.shellSpeed).toBe(before.shellSpeed);
    }
  });

  test('The human never escalates', () => {
    const state = waves(4);
    for (let wave = 1; wave <= 14; wave++) {
      expect(state.round).toBe(wave);
      expect(tank(state, 'p1')).toMatchObject({
        maxHp: cfg.tankMaxHp,
        hp: cfg.tankMaxHp,
        shellDamage: cfg.shellDamage,
        shellSpeed: cfg.shellSpeed,
      });
      clearWave(state);
    }
    // By now the AI tanks are at maximum difficulty.
    for (const t of aiTanks(state)) expect(t.shellSpeed).toBeCloseTo(cfg.shellSpeed * 2);
  });
});

describe('waves: wave end and score', () => {
  test('Clearing a wave', () => {
    const state = playingWaves(makeBoard(), 2);
    tank(state, 'ai1').hp = 0;
    expect(ofType(step(state, {}), 'waveCleared')).toHaveLength(0); // one AI tank is still alive
    tank(state, 'ai2').hp = 0;
    const events = step(state, {});
    expect(ofType(events, 'waveCleared')).toEqual([{ type: 'waveCleared', wave: 1, cleared: 1 }]);
    expect(state.waves?.cleared).toBe(1);
    expect(state.phase).toBe('roundOver');

    const later: SimEvent[] = [];
    for (let i = 0; i < RESULT_TICKS; i++) later.push(...step(state, {}));
    expect(ofType(later, 'waveStarted')).toEqual([
      { type: 'waveStarted', wave: 2, aiCount: 3, changes: ['thinnerArmour'] },
    ]);
    expect(state.phase).toBe('countdown');
  });

  test('Game over', () => {
    const state = playingWaves(makeBoard(), 3);
    tank(state, 'p1').hp = 0;
    tank(state, 'ai1').hp = 0;
    const events = step(state, {});
    expect(ofType(events, 'waveCleared')).toHaveLength(0);
    expect(ofType(events, 'gameEnded')).toEqual([{ type: 'gameEnded', result: 'over', wavesCleared: 0 }]);
    expect(state.phase).toBe('gameOver');
    expect(state.result).toBe('over');
    expect(step(state, { p1: { throttle: 1, turn: 0, fire: true } })).toHaveLength(0);
  });

  test('Going down together', () => {
    const state = playingWaves(makeBoard(), 1);
    const p1 = place(state, 'p1', 200, 300, 0);
    const ai1 = place(state, 'ai1', 400, 300, Math.PI);
    p1.hp = 1;
    ai1.hp = 1;
    // Both shells are already in flight towards each tank and arrive in the same tick.
    addShell(state, 300, 300, 0, { ownerId: 'p1' });
    addShell(state, 300, 300, Math.PI, { ownerId: 'ai1' });
    const events: SimEvent[] = [];
    for (let i = 0; i < 60 && state.phase === 'playing'; i++) events.push(...step(state, {}));
    expect(ofType(events, 'eliminated')).toHaveLength(2);
    expect(ofType(events, 'waveCleared')).toEqual([{ type: 'waveCleared', wave: 1, cleared: 1 }]);
    expect(ofType(events, 'gameEnded')).toEqual([{ type: 'gameEnded', result: 'over', wavesCleared: 1 }]);
    expect(state.phase).toBe('gameOver');
  });

  test('Hoisted by your own shell', () => {
    // A full-height wall seals the AI tank off on the far side, so only the bounce can hurt the human.
    const wall = { x: 400, y: 0, w: 20, h: 600 };
    const state = playingWaves(makeBoard([wall]), 1);
    const p1 = place(state, 'p1', 300, 300, 0);
    place(state, 'ai1', 700, 300, Math.PI);
    p1.hp = 1;
    const events = step(state, { p1: { throttle: 0, turn: 0, fire: true } });
    for (let i = 0; i < 60 && state.phase === 'playing'; i++) events.push(...step(state, {}));
    expect(ofType(events, 'eliminated')[0]).toMatchObject({ tankId: 'p1', byId: 'p1' });
    expect(ofType(events, 'gameEnded')).toEqual([{ type: 'gameEnded', result: 'over', wavesCleared: 0 }]);
    expect(state.phase).toBe('gameOver');
  });

  test('Score at game over', () => {
    const state = waves(1);
    for (let i = 0; i < 4; i++) clearWave(state);
    expect(state.round).toBe(5);
    tank(state, 'p1').hp = 0;
    const events = step(state, {});
    expect(ofType(events, 'gameEnded')[0]).toMatchObject({ result: 'over', wavesCleared: 4 });
    expect(state.waves?.cleared).toBe(4);
  });
});
