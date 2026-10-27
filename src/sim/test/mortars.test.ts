import { describe, expect, test } from 'vitest';
import {
  createMatch,
  DEFAULT_CONFIG,
  mortarLanding,
  mortarRange,
  PROVING_GROUND,
  step,
  validateOptions,
  type Board,
  type MatchState,
  type SimConfig,
  type SimEvent,
  type TankInput,
} from '../src';
import { hasClearLane, SHOT_LANE } from '../src/ai/think';
import {
  DT,
  R,
  cfg,
  finishRound,
  makeBoard,
  ofType,
  place,
  retire,
  skipToPlay,
  tank,
  world,
} from './helpers';

const FULL = Math.round(cfg.mortarChargeTime * cfg.tickRate);
const FLIGHT = Math.round(cfg.mortarFlightTime * cfg.tickRate);
const SLOW = Math.round(cfg.mortarSlowDuration * cfg.tickRate);
const REACH = cfg.mortarSplashRadius + R;

/** A Last One Standing match with mortars on, in play, with the human and one AI tank. */
function armed(board: Board = makeBoard(), config: SimConfig = DEFAULT_CONFIG): MatchState {
  const state = createMatch(
    { mode: 'lastOneStanding', aiCount: 1, rounds: 5, mortars: true },
    board,
    1,
    config,
  );
  state.phase = 'playing';
  state.phaseTicks = 0;
  return state;
}

/** Holds the mortar button for `heldTicks` ticks (the press included), then releases. Returns the events. */
function lobFor(state: MatchState, heldTicks: number, extra: Partial<TankInput> = {}): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < heldTicks; i++) events.push(...world(state, { p1: { ...extra, mortar: true } }));
  events.push(...world(state, { p1: { ...extra, mortar: false } }));
  return events;
}

/** Puts a mortar in the air directly, landing at (x, y) after `ticksLeft` ticks. */
function addMortar(state: MatchState, x: number, y: number, ticksLeft = 1, ownerId = 'nobody'): void {
  state.mortarShells.push({
    id: state.nextMortarId++,
    ownerId,
    fromX: x,
    fromY: y,
    toX: x,
    toY: y,
    flightTicks: ticksLeft,
    ticksLeft,
  });
}

/** Steps the physics until the next mortar lands. */
function untilLanded(state: MatchState, inputs: Record<string, Partial<TankInput>> = {}): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < 10 * cfg.tickRate && !events.some((e) => e.type === 'mortarLanded'); i++)
    events.push(...world(state, inputs));
  return events;
}

describe('mortars: config', () => {
  test('a tap never lands close enough to catch the firer', () => {
    expect(cfg.mortarMinRange).toBeGreaterThan(cfg.mortarSplashRadius + 2 * cfg.tankRadius);
  });

  test('range grows from minimum to maximum over the charge time', () => {
    expect(mortarRange(cfg, 0)).toBe(cfg.mortarMinRange);
    expect(mortarRange(cfg, FULL / 2)).toBeCloseTo((cfg.mortarMinRange + cfg.mortarMaxRange) / 2);
    expect(mortarRange(cfg, FULL)).toBe(cfg.mortarMaxRange);
    expect(mortarRange(cfg, FULL * 3)).toBe(cfg.mortarMaxRange);
  });
});

describe('mortars: option', () => {
  test('Invalid setting rejected', () => {
    const bad = { mode: 'lastOneStanding', aiCount: 1, rounds: 3, mortars: 'yes' } as unknown as Parameters<
      typeof validateOptions
    >[0];
    expect(validateOptions(bad)).toMatch(/mortars/i);
    expect(() => createMatch(bad, makeBoard(), 1)).toThrow(/mortars/i);
    const missing = { mode: 'waves', startAiCount: 1 } as unknown as Parameters<typeof validateOptions>[0];
    expect(validateOptions(missing)).not.toBeNull();
  });

  test('Classic play', () => {
    const state = createMatch(
      { mode: 'lastOneStanding', aiCount: 1, rounds: 5, mortars: false },
      makeBoard(),
      1,
    );
    state.phase = 'playing';
    place(state, 'p1', 100, 300, 0);
    retire(state, 'ai1');
    expect(tank(state, 'p1').mortars).toBe(0);
    const events = [...lobFor(state, 20), ...lobFor(state, 1)];
    for (let i = 0; i < 120; i++) events.push(...world(state, { p1: { throttle: 1 } }));
    expect(ofType(events, 'mortarLaunched')).toHaveLength(0);
    expect(state.mortarShells).toHaveLength(0);
    expect(tank(state, 'p1').slowTicks).toBe(0);
  });
});

describe('mortars: charging and launching', () => {
  function ready(): MatchState {
    const state = armed();
    place(state, 'p1', 100, 300, 0);
    place(state, 'ai1', 700, 100, 0);
    return state;
  }

  test('A tap is the minimum range', () => {
    const state = ready();
    const [launch] = ofType(lobFor(state, 1), 'mortarLaunched');
    expect(launch).toMatchObject({ tankId: 'p1', toX: 100 + cfg.mortarMinRange, toY: 300 });
  });

  test('Range grows with the hold', () => {
    const state = ready();
    // The press is the first tick held; half the charge time more brings the charge to halfway.
    const [launch] = ofType(lobFor(state, 1 + FULL / 2), 'mortarLaunched');
    expect(launch!.toX).toBeCloseTo(100 + (cfg.mortarMinRange + cfg.mortarMaxRange) / 2);
  });

  test('Full charge is capped', () => {
    const state = ready();
    const held: SimEvent[] = [];
    for (let i = 0; i < FULL * 2; i++) held.push(...world(state, { p1: { mortar: true } }));
    expect(ofType(held, 'mortarLaunched')).toHaveLength(0);
    const [launch] = ofType(world(state, { p1: { mortar: false } }), 'mortarLaunched');
    expect(launch!.toX).toBeCloseTo(100 + cfg.mortarMaxRange);
  });

  test('Aiming near a wall', () => {
    const state = ready();
    place(state, 'p1', 700, 300, -Math.PI / 4); // up and to the right, towards the corner
    const [launch] = ofType(lobFor(state, FULL), 'mortarLaunched');
    expect(launch!.toX).toBe(state.board.width);
    expect(launch!.toY).toBe(0);
  });

  test('Moving while charging', () => {
    const charging = ready();
    const plain = ready();
    const drive = { throttle: 1 as const, turn: 0.5, fire: true };
    const shots: SimEvent[] = [];
    for (let i = 0; i < 30; i++) {
      shots.push(...world(charging, { p1: { ...drive, mortar: true } }));
      world(plain, { p1: drive });
    }
    expect(ofType(shots, 'shotFired')).toHaveLength(1);
    const p1 = tank(charging, 'p1');
    expect(p1.x).toBeCloseTo(tank(plain, 'p1').x);
    expect(p1.y).toBeCloseTo(tank(plain, 'p1').y);
    expect(p1.heading).toBeCloseTo(tank(plain, 'p1').heading);

    const heading = p1.heading;
    const [launch] = ofType(world(charging, { p1: { mortar: false } }), 'mortarLaunched');
    const range = mortarRange(cfg, 29);
    expect(launch!.toX).toBeCloseTo(p1.x + Math.cos(heading) * range);
    expect(launch!.toY).toBeCloseTo(p1.y + Math.sin(heading) * range);
  });

  test('Destroyed mid-charge', () => {
    const state = ready();
    for (let i = 0; i < 20; i++) world(state, { p1: { mortar: true } });
    tank(state, 'p1').hp = 0;
    const events = world(state, { p1: { mortar: true } });
    expect(ofType(events, 'eliminated')).toHaveLength(1);
    events.push(...world(state, { p1: { mortar: false } }));
    expect(ofType(events, 'mortarLaunched')).toHaveLength(0);
    expect(state.mortarShells).toHaveLength(0);
  });

  test('Released in the tick it is destroyed', () => {
    const state = ready();
    for (let i = 0; i < 20; i++) world(state, { p1: { mortar: true } });
    tank(state, 'p1').hp = 0;
    expect(ofType(world(state, { p1: { mortar: false } }), 'mortarLaunched')).toHaveLength(0);
  });

  test('One shot only', () => {
    const state = ready();
    expect(ofType(lobFor(state, 5), 'mortarLaunched')).toHaveLength(1);
    expect(tank(state, 'p1').mortars).toBe(0);
    expect(ofType(lobFor(state, 5), 'mortarLaunched')).toHaveLength(0);
  });

  test('a held button only charges from a fresh press', () => {
    const state = ready();
    tank(state, 'p1').mortars = 0;
    world(state, { p1: { mortar: true } }); // pressed while empty: nothing
    tank(state, 'p1').mortars = 1;
    world(state, { p1: { mortar: true } }); // still the same press
    expect(tank(state, 'p1').mortarCharge).toBe(-1);
    expect(ofType(world(state, { p1: { mortar: false } }), 'mortarLaunched')).toHaveLength(0);
  });

  test('the plant-while-charging playtest switch stops the tank driving', () => {
    const state = armed(makeBoard(), { ...DEFAULT_CONFIG, mortarPlantWhileCharging: true });
    place(state, 'p1', 100, 300, 0);
    place(state, 'ai1', 700, 100, 0);
    const p1 = tank(state, 'p1');
    world(state, { p1: { throttle: 1, turn: 1, mortar: true } }); // the press: the charge starts after moving
    const x = p1.x;
    for (let i = 0; i < 10; i++) world(state, { p1: { throttle: 1, turn: 1, mortar: true } });
    expect(p1.x).toBe(x);
    expect(tank(state, 'p1').heading).not.toBe(0); // turning still works
  });
});

describe('mortars: flight', () => {
  test('Over the wall', () => {
    const state = armed(makeBoard([{ x: 200, y: 200, w: 20, h: 200 }]));
    place(state, 'p1', 100, 300, 0);
    place(state, 'ai1', 100 + cfg.mortarMinRange, 300, Math.PI / 2); // just behind the wall
    lobFor(state, 1);
    let ticks = 0;
    let landed: SimEvent[] = [];
    while (landed.length === 0 && ticks < 1000) {
      ticks++;
      landed = ofType(world(state), 'mortarLanded');
    }
    expect(ticks).toBe(FLIGHT);
    expect(landed[0]).toMatchObject({ x: 100 + cfg.mortarMinRange, y: 300, slowedIds: ['ai1'] });
  });

  test("Flight time doesn't depend on range", () => {
    const flightTicks = (heldTicks: number): number => {
      const state = armed();
      place(state, 'p1', 100, 300, 0);
      retire(state, 'ai1');
      lobFor(state, heldTicks);
      let n = 0;
      while (ofType(world(state), 'mortarLanded').length === 0) n++;
      return n;
    };
    expect(flightTicks(1)).toBe(flightTicks(FULL));
  });

  test('Outlives its tank', () => {
    const state = armed();
    place(state, 'p1', 100, 300, 0);
    place(state, 'ai1', 100 + cfg.mortarMinRange, 300, Math.PI / 2);
    lobFor(state, 1);
    tank(state, 'p1').hp = 0;
    const events = untilLanded(state);
    expect(ofType(events, 'eliminated')[0]!.tankId).toBe('p1');
    expect(ofType(events, 'mortarLanded')[0]!.slowedIds).toEqual(['ai1']);
    expect(tank(state, 'ai1').slowTicks).toBeGreaterThan(0);
  });
});

describe('mortars: splash', () => {
  function target(): MatchState {
    const state = armed();
    place(state, 'p1', 100, 100, 0);
    place(state, 'ai1', 400, 300, 0);
    return state;
  }

  test('Bogged down', () => {
    const state = target();
    addMortar(state, 400, 300);
    world(state);
    const ai = tank(state, 'ai1');
    for (let i = 0; i < SLOW; i++) {
      const x = ai.x;
      world(state, { ai1: { throttle: 1 } });
      expect(ai.x - x).toBeCloseTo(cfg.tankSpeed * cfg.mortarSlowFactor * DT);
    }
    const x = ai.x;
    world(state, { ai1: { throttle: 1 } });
    expect(ai.x - x).toBeCloseTo(cfg.tankSpeed * DT);
  });

  test('Slowed driving (reverse too)', () => {
    const state = target();
    addMortar(state, 400, 300);
    world(state);
    const ai = tank(state, 'ai1');
    world(state, { ai1: { throttle: -1 } });
    expect(400 - ai.x).toBeCloseTo(cfg.tankReverseSpeed * cfg.mortarSlowFactor * DT);
  });

  test('No damage', () => {
    const state = target();
    addMortar(state, 400, 300);
    const [landed] = ofType(world(state), 'mortarLanded');
    expect(landed!.slowedIds).toEqual(['ai1']);
    expect(tank(state, 'ai1').hp).toBe(cfg.tankMaxHp);
    expect(ofType(world(state), 'hit')).toHaveLength(0);
  });

  test('Turning and firing unaffected', () => {
    const state = target();
    addMortar(state, 400, 300);
    world(state);
    const ai = tank(state, 'ai1');
    const shots = ofType(world(state, { ai1: { turn: 1, fire: true } }), 'shotFired');
    expect(ai.heading).toBeCloseTo(cfg.tankTurnRate * DT);
    expect(shots).toHaveLength(1);
    // And again as soon as the normal cooldown allows.
    const cooldown = Math.round(cfg.fireCooldown * cfg.tickRate);
    let more = 0;
    for (let i = 0; i < cooldown; i++)
      more += ofType(world(state, { ai1: { fire: i % 2 === 1 } }), 'shotFired').length;
    expect(more).toBe(1);
  });

  test('Caught in your own splash', () => {
    const state = target();
    place(state, 'p1', 100, 500, 0);
    lobFor(state, 1, { throttle: 1 });
    // Driving on into your own landing zone: the mortar flies for less time than it takes to clear it.
    const [landed] = ofType(untilLanded(state, { p1: { throttle: 1 } }), 'mortarLanded');
    expect(landed!.slowedIds).toContain('p1');
    expect(tank(state, 'p1').slowTicks).toBe(SLOW);
  });

  test("Walls don't shield", () => {
    const state = armed(makeBoard([{ x: 420, y: 250, w: 10, h: 100 }]));
    place(state, 'p1', 100, 100, 0);
    place(state, 'ai1', 450, 300, 0);
    addMortar(state, 400, 300);
    expect(ofType(world(state), 'mortarLanded')[0]!.slowedIds).toEqual(['ai1']);
  });

  test('Out of range', () => {
    const state = target();
    addMortar(state, 400 - REACH - 0.5, 300);
    expect(ofType(world(state), 'mortarLanded')[0]!.slowedIds).toEqual([]);
    expect(tank(state, 'ai1').slowTicks).toBe(0);
    // Just inside: part of the body is within the splash.
    addMortar(state, 400 - REACH + 0.5, 300);
    expect(ofType(world(state), 'mortarLanded')[0]!.slowedIds).toEqual(['ai1']);
  });

  test('A second splash restarts the slow', () => {
    const state = target();
    addMortar(state, 400, 300);
    world(state);
    for (let i = 0; i < 60; i++) world(state);
    const ai = tank(state, 'ai1');
    expect(ai.slowTicks).toBe(SLOW - 60);
    addMortar(state, 400, 300);
    world(state);
    expect(ai.slowTicks).toBe(SLOW);
    const x = ai.x;
    world(state, { ai1: { throttle: 1 } });
    expect(ai.x - x).toBeCloseTo(cfg.tankSpeed * cfg.mortarSlowFactor * DT);
  });

  test('Same rules for everyone', () => {
    const state = armed();
    place(state, 'p1', 100, 200, 0);
    place(state, 'ai1', 100, 400, 0);
    const press = { throttle: 1 as const, mortar: true };
    for (let i = 0; i < 10; i++) world(state, { p1: press, ai1: press });
    const launches = ofType(world(state, { p1: { throttle: 1 }, ai1: { throttle: 1 } }), 'mortarLaunched');
    expect(launches).toHaveLength(2);
    expect(launches[0]!.toX).toBeCloseTo(launches[1]!.toX);
    expect(launches[1]!.toY - launches[0]!.toY).toBeCloseTo(200);
  });
});

describe('mortars: landing helper', () => {
  test('the reticle point matches where the mortar lands', () => {
    const state = armed();
    const p1 = place(state, 'p1', 300, 300, 0.3);
    place(state, 'ai1', 700, 100, 0);
    for (let i = 0; i < 25; i++) world(state, { p1: { mortar: true } });
    const aimed = mortarLanding(state, p1, p1.mortarCharge);
    const [launch] = ofType(world(state, { p1: { mortar: false } }), 'mortarLaunched');
    expect(launch!.toX).toBeCloseTo(aimed.x);
    expect(launch!.toY).toBeCloseTo(aimed.y);
  });

  test('missing input is idle, mortar included', () => {
    const state = armed();
    place(state, 'p1', 300, 300, 0);
    place(state, 'ai1', 700, 100, 0);
    world(state, { p1: { mortar: true } });
    world(state, {}); // no input: the button counts as released
    expect(state.mortarShells).toHaveLength(1);
  });
});

describe('mortars: rounds and waves', () => {
  test('Everyone is armed', () => {
    const state = createMatch(
      { mode: 'lastOneStanding', aiCount: 4, rounds: 3, mortars: true },
      PROVING_GROUND,
      1,
    );
    expect(state.tanks).toHaveLength(5);
    for (const t of state.tanks) expect(t.mortars).toBe(1);
  });

  test('Refilled each round', () => {
    const state = armed();
    lobFor(state, 1);
    expect(tank(state, 'p1').mortars).toBe(0);
    finishRound(state, 'human');
    skipToPlay(state);
    expect(state.round).toBe(2);
    expect(tank(state, 'p1').mortars).toBe(1);
  });

  test("Unused mortars don't stack", () => {
    const state = armed();
    finishRound(state, 'ai');
    skipToPlay(state);
    finishRound(state, 'human');
    skipToPlay(state);
    for (const t of state.tanks) expect(t.mortars).toBe(1);
  });

  test('Countdown freezes tanks, mortar included', () => {
    const state = createMatch(
      { mode: 'lastOneStanding', aiCount: 1, rounds: 3, mortars: true },
      makeBoard(),
      1,
    );
    expect(state.phase).toBe('countdown');
    const events: SimEvent[] = [];
    for (let i = 0; i < 20; i++)
      events.push(...step(state, { p1: { throttle: 0, turn: 0, fire: false, mortar: i < 10 } }));
    expect(ofType(events, 'mortarLaunched')).toHaveLength(0);
    expect(tank(state, 'p1').mortarCharge).toBe(-1);
  });

  test('Fresh start each round', () => {
    const state = armed();
    place(state, 'p1', 100, 300, 0);
    for (let i = 0; i < 10; i++) world(state, { p1: { mortar: true } });
    tank(state, 'ai1').slowTicks = 100;
    addMortar(state, 500, 500, 50);
    finishRound(state, 'human');
    skipToPlay(state);
    expect(state.mortarShells).toHaveLength(0);
    for (const t of state.tanks) {
      expect(t.slowTicks).toBe(0);
      expect(t.mortarCharge).toBe(-1);
      expect(t.mortarHeld).toBe(false);
    }
  });

  test('Mortar refilled each wave', () => {
    const state = createMatch({ mode: 'waves', startAiCount: 1, mortars: true }, makeBoard(), 1);
    expect(tank(state, 'p1').mortars).toBe(1);
    skipToPlay(state);
    lobFor(state, 1);
    expect(tank(state, 'p1').mortars).toBe(0);
    finishRound(state, 'human'); // the wave is cleared
    skipToPlay(state);
    expect(state.round).toBe(2);
    expect(tank(state, 'p1').mortars).toBe(1);
  });

  test('Only humans have mortars', () => {
    const state = createMatch({ mode: 'waves', startAiCount: 4, mortars: true }, PROVING_GROUND, 5);
    for (const t of state.tanks) expect(t.mortars).toBe(t.kind === 'human' ? 1 : 0);
    // A long wave with a human who can't be destroyed and hides: the AI never lobs.
    skipToPlay(state);
    const events: SimEvent[] = [];
    for (let i = 0; i < 30 * cfg.tickRate && state.phase === 'playing'; i++) {
      tank(state, 'p1').hp = 1000;
      events.push(...step(state, {}));
      for (const t of state.tanks) if (t.kind === 'ai') expect(t.mortarHeld).toBe(false);
    }
    expect(ofType(events, 'mortarLaunched')).toHaveLength(0);
  });
});

/** The human hidden behind a full-height wall, out of reach, with ai1 on the other side in mortar range. */
function hidden(mortars = true, mode: 'lastOneStanding' | 'waves' = 'lastOneStanding', seed = 1): MatchState {
  const board = makeBoard([{ x: 390, y: 0, w: 20, h: 600 }]);
  const state =
    mode === 'waves'
      ? createMatch({ mode, startAiCount: 1, mortars }, board, seed)
      : createMatch({ mode, aiCount: 1, rounds: 3, mortars }, board, seed);
  state.phase = 'playing';
  place(state, 'p1', 200, 300, 0);
  place(state, 'ai1', 600, 300, Math.PI);
  return state;
}

describe('ai: mortar use', () => {
  test('Flushing out a hider', () => {
    const state = hidden();
    const events: SimEvent[] = [];
    for (let i = 0; i < 10 * cfg.tickRate && ofType(events, 'mortarLaunched').length === 0; i++)
      events.push(...step(state, {}));
    const [launch] = ofType(events, 'mortarLaunched');
    expect(launch?.tankId).toBe('ai1');
    const landed = ofType(untilLanded(state), 'mortarLanded');
    expect(landed[0]!.slowedIds).toContain('p1');
  });

  test('Patience', () => {
    const state = hidden();
    const patience = Math.round(cfg.aiMortarPatience * cfg.tickRate);
    for (let i = 0; i < patience - 1; i++) {
      step(state, {});
      expect(tank(state, 'ai1').mortarHeld).toBe(false);
    }
    let pressedAt = -1;
    for (let i = 0; i < 5 * cfg.tickRate && pressedAt < 0; i++) {
      step(state, {});
      if (tank(state, 'ai1').mortarHeld) pressedAt = i;
    }
    expect(pressedAt).toBeGreaterThanOrEqual(0);
  });

  test('Turret first', () => {
    const state = armed();
    place(state, 'p1', 150, 300, 0);
    place(state, 'ai1', 550, 300, Math.PI);
    const events: SimEvent[] = [];
    for (let i = 0; i < 6 * cfg.tickRate; i++) {
      tank(state, 'p1').hp = 1000; // keeps the target alive and in plain sight
      events.push(...step(state, {}));
    }
    expect(ofType(events, 'shotFired').length).toBeGreaterThan(0);
    expect(ofType(events, 'mortarLaunched')).toHaveLength(0);
  });

  test('No mortars, no lobbing', () => {
    for (const state of [hidden(false), hidden(true, 'waves')]) {
      for (let i = 0; i < 10 * cfg.tickRate; i++) {
        step(state, {});
        expect(tank(state, 'ai1').mortarHeld).toBe(false);
      }
    }
  });

  test('with several AI tanks, a lob stays on the tank it was meant for, which is hidden when the button goes down', () => {
    // Regression (QA): an AI that retargeted mid-lob used to swing round and lob at a tank it could simply shoot.
    let launches = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const state = createMatch(
        { mode: 'lastOneStanding', aiCount: 4, rounds: 1, mortars: true },
        PROVING_GROUND,
        seed,
      );
      state.phase = 'playing';
      const committed: Record<string, string> = {};
      for (let i = 0; i < 60 * cfg.tickRate && state.phase === 'playing'; i++) {
        tank(state, 'p1').hp = 1000;
        const before: Record<string, { lob: string | null; held: boolean }> = {};
        for (const t of state.tanks)
          if (t.kind === 'ai')
            before[t.id] = { lob: state.ai[t.id]?.lob?.targetId ?? null, held: t.mortarHeld };
        const events = step(state, {});
        for (const t of state.tanks) {
          if (t.kind !== 'ai' || !t.alive) continue;
          if (t.mortarHeld && !before[t.id]!.held) {
            // The button has just gone down: the lob's target is hidden from this tank's turret.
            const targetId = state.ai[t.id]!.lob!.targetId;
            const target = tank(state, targetId);
            committed[t.id] = targetId;
            expect(
              hasClearLane(t.x, t.y, target.x, target.y, state.board.obstacles, SHOT_LANE),
              `seed ${seed}, ${t.id} pressed at a visible ${targetId}`,
            ).toBe(false);
          }
        }
        for (const launch of ofType(events, 'mortarLaunched')) {
          if (launch.tankId === 'p1') continue;
          launches++;
          expect(before[launch.tankId]!.lob, `seed ${seed}, ${launch.tankId} switched target`).toBe(
            committed[launch.tankId],
          );
        }
      }
    }
    expect(launches).toBeGreaterThan(5);
  });

  test('Reproducible lobs', () => {
    const run = (): SimEvent[] => {
      const state = createMatch(
        { mode: 'lastOneStanding', aiCount: 4, rounds: 1, mortars: true },
        PROVING_GROUND,
        1, // a seed where an AI's target stays hidden long enough for a lob
      );
      const events: SimEvent[] = [];
      for (let i = 0; i < 60 * cfg.tickRate && state.phase !== 'gameOver'; i++) {
        tank(state, 'p1').hp = 1000; // a long round, so the AI tanks get to hide and lob
        events.push(...step(state, {}));
      }
      return ofType(events, 'mortarLaunched');
    };
    const a = run();
    expect(a.length).toBeGreaterThan(0);
    expect(run()).toEqual(a);
  });
});
