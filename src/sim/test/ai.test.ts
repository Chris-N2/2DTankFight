import { describe, expect, test } from 'vitest';
import { DEFAULT_CONFIG, RICOCHET_ALLEY, step, type Board, type MatchState, type TankInput } from '../src';
import { think } from '../src/ai/think';
import { angleDiff, lineOfSight } from '../src/geometry';
import { buildNavGrid, cellAt, findPath } from '../src/nav';
import {
  addShell,
  cfg,
  makeBoard,
  ofType,
  place,
  playing,
  playingWaves,
  tank,
  world,
  matchOn,
} from './helpers';

const REACTION_TICKS = Math.round(cfg.aiReactionDelay * cfg.tickRate);
const RETARGET_TICKS = Math.round(cfg.aiRetargetInterval * cfg.tickRate);

/** Calls the AI for one tank repeatedly while holding every tank still. Returns its inputs. */
function thinkPinned(state: MatchState, id: string, n: number): TankInput[] {
  const t = tank(state, id);
  const out: TankInput[] = [];
  for (let i = 0; i < n; i++) {
    const input = think(state, t);
    t.fireHeld = input.fire;
    out.push(input);
  }
  return out;
}

describe('ai: pathfinding', () => {
  test('a path is found around an obstacle', () => {
    const wall = { x: 380, y: 100, w: 40, h: 400 };
    const nav = buildNavGrid(makeBoard([wall]), cfg);
    const path = findPath(nav, cellAt(nav, 200, 300), cellAt(nav, 600, 300));
    expect(path).not.toBeNull();
    expect(path![0]).toBe(cellAt(nav, 200, 300));
    expect(path![path!.length - 1]).toBe(cellAt(nav, 600, 300));
    // The route must go round the wall: every step stays on walkable cells.
    for (const cell of path!) expect(nav.walkable[cell]).toBe(1);
  });

  test('no path exists into a sealed area', () => {
    const box = [
      { x: 500, y: 200, w: 200, h: 10 },
      { x: 500, y: 390, w: 200, h: 10 },
      { x: 500, y: 200, w: 10, h: 200 },
      { x: 690, y: 200, w: 10, h: 200 },
    ];
    const nav = buildNavGrid(makeBoard(box), cfg);
    expect(findPath(nav, cellAt(nav, 200, 300), cellAt(nav, 600, 300))).toBeNull();
  });
});

describe('ai: acts only through player inputs', () => {
  test('Same rules for everyone', () => {
    const state = playing();
    const human = place(state, 'p1', 200, 150, 0);
    const ai = place(state, 'ai1', 200, 450, 0);
    const script: Partial<TankInput>[] = [];
    for (let i = 0; i < 90; i++)
      script.push({ throttle: i < 60 ? 1 : -1, turn: i % 30 < 10 ? 1 : 0, fire: i % 40 === 0 });
    const shots: Record<string, number> = { p1: 0, ai1: 0 };
    for (const input of script) {
      for (const e of ofType(world(state, { p1: input, ai1: input }), 'shotFired')) shots[e.tankId]!++;
    }
    expect(ai.x).toBeCloseTo(human.x, 9);
    expect(ai.y - 300).toBeCloseTo(human.y, 9);
    expect(ai.heading).toBeCloseTo(human.heading, 9);
    expect(ai.cooldown).toBe(human.cooldown);
    expect(shots.ai1).toBe(shots.p1);
    expect(ai.hp).toBe(human.hp);
  });
});

describe('ai: every tank for itself', () => {
  test('AI tanks fight each other', () => {
    // A full-height wall hides the human from both AI tanks, which can see each other.
    const wall = { x: 150, y: 0, w: 20, h: 600 };
    const state = playing(makeBoard([wall]), 2);
    place(state, 'p1', 60, 300, 0);
    place(state, 'ai1', 350, 300, Math.PI / 2);
    place(state, 'ai2', 650, 300, Math.PI / 2);
    const events = [];
    const ai1Targets = new Set<string | null>();
    for (let i = 0; i < 180; i++) {
      events.push(...step(state, {}));
      if (tank(state, 'ai2').alive && tank(state, 'ai1').alive) ai1Targets.add(state.ai['ai1']!.targetId);
    }
    expect([...ai1Targets]).toEqual(['ai2']); // while both lived, ai1 only ever went after ai2
    const aiShots = ofType(events, 'shotFired').filter((e) => e.tankId.startsWith('ai'));
    expect(aiShots.length).toBeGreaterThan(0);
    const hits = ofType(events, 'hit');
    expect(hits.some((h) => h.shooterId.startsWith('ai') && h.targetId.startsWith('ai'))).toBe(true);
  });
});

describe('ai: target selection', () => {
  test('Retarget after elimination', () => {
    const state = playing(makeBoard(), 2);
    place(state, 'p1', 300, 300, 0);
    place(state, 'ai1', 400, 300, Math.PI);
    place(state, 'ai2', 700, 500, Math.PI);
    thinkPinned(state, 'ai1', 2);
    expect(state.ai['ai1']!.targetId).toBe('p1'); // nearest visible
    tank(state, 'p1').alive = false;
    thinkPinned(state, 'ai1', 1);
    expect(state.ai['ai1']!.targetId).toBe('ai2');
  });

  test('prefers a visible target over a nearer hidden one', () => {
    const wall = { x: 330, y: 200, w: 20, h: 200 };
    const state = playing(makeBoard([wall]), 2);
    place(state, 'p1', 300, 300, 0); // near but behind the wall
    place(state, 'ai1', 400, 300, Math.PI);
    place(state, 'ai2', 700, 300, Math.PI); // farther but visible
    thinkPinned(state, 'ai1', 1);
    expect(state.ai['ai1']!.targetId).toBe('ai2');
  });

  test('re-evaluates its target periodically', () => {
    const state = playing(makeBoard(), 2);
    place(state, 'p1', 50, 300, 0);
    place(state, 'ai1', 400, 300, Math.PI);
    place(state, 'ai2', 700, 300, Math.PI);
    thinkPinned(state, 'ai1', 1);
    expect(state.ai['ai1']!.targetId).toBe('ai2'); // 300 away, versus 350 for p1
    place(state, 'p1', 330, 300, 0); // p1 moves much closer
    thinkPinned(state, 'ai1', RETARGET_TICKS + 1);
    expect(state.ai['ai1']!.targetId).toBe('p1');
  });

  test('Sticks with a target that ducks out of sight', () => {
    const wall = { x: 290, y: 200, w: 20, h: 200 };
    const state = playing(makeBoard([wall]), 2);
    place(state, 'ai1', 400, 300, Math.PI);
    place(state, 'p1', 200, 40, 0); // in view, over the end of the wall
    place(state, 'ai2', 250, 300, 0); // nearer, but behind the wall
    thinkPinned(state, 'ai1', 1);
    expect(state.ai['ai1']!.targetId).toBe('p1');

    place(state, 'p1', 200, 300, 0); // ducks behind the wall too, a little farther away than ai2
    thinkPinned(state, 'ai1', cfg.tickRate);
    expect(state.ai['ai1']!.targetId).toBe('p1'); // still after it, through several retargets...
    thinkPinned(state, 'ai1', 2 * cfg.tickRate);
    expect(state.ai['ai1']!.targetId).toBe('ai2'); // ...until it has been out of sight a while
  });

  test("A distant tank in view doesn't pull it off a nearby hunt", () => {
    const wall = { x: 290, y: 200, w: 20, h: 200 };
    const state = playing(makeBoard([wall], 1200, 800), 2);
    place(state, 'ai1', 400, 300, Math.PI);
    place(state, 'p1', 250, 300, 0); // close, behind the wall
    place(state, 'ai2', 1150, 750, 0); // in view, right across the board
    thinkPinned(state, 'ai1', 1);
    expect(state.ai['ai1']!.targetId).toBe('p1');
  });
});

describe('ai: navigation', () => {
  test('Hunting a hidden target', () => {
    const block = { x: 350, y: 150, w: 100, h: 300 };
    const state = playing(makeBoard([block]), 1);
    const human = place(state, 'p1', 250, 300, 0);
    const ai = place(state, 'ai1', 550, 300, Math.PI);
    expect(lineOfSight(ai.x, ai.y, human.x, human.y, [block])).toBe(false);
    let foundAt = -1;
    for (let i = 0; i < 10 * cfg.tickRate && foundAt < 0; i++) {
      step(state, {}); // the human stays still
      if (lineOfSight(ai.x, ai.y, human.x, human.y, [block])) foundAt = i;
    }
    expect(foundAt).toBeGreaterThanOrEqual(0);
  });

  test('Recovering from being stuck', () => {
    const wall = { x: 150, y: 0, w: 20, h: 600 };
    const state = playing(makeBoard([wall]), 1);
    place(state, 'p1', 60, 300, 0);
    const ai = place(state, 'ai1', 500, 300, Math.PI);
    // Pin the AI in place, as if wedged against something, while it tries to drive.
    const inputs: TankInput[] = [];
    for (let i = 0; i < 3 * cfg.tickRate; i++) {
      inputs.push(think(state, ai));
      ai.x = 500;
      ai.y = 300;
    }
    const firstReverse = inputs.findIndex((i) => i.throttle === -1);
    expect(firstReverse).toBeGreaterThan(0);
    expect(inputs[firstReverse]!.turn).not.toBe(0);
    // ...and afterwards it resumes driving forward.
    expect(inputs.slice(firstReverse).some((i) => i.throttle === 1)).toBe(true);
  });

  test('also recovers when wedged while closing in on a visible target', () => {
    const state = playing(makeBoard(), 1);
    place(state, 'p1', 60, 300, 0);
    const ai = place(state, 'ai1', 600, 300, Math.PI); // in plain view but out of engage range, so it advances
    const inputs: TankInput[] = [];
    for (let i = 0; i < 3 * cfg.tickRate; i++) {
      inputs.push(think(state, ai));
      ai.x = 600;
      ai.y = 300;
    }
    expect(inputs[0]!.throttle).toBe(1);
    expect(inputs.some((i) => i.throttle === -1)).toBe(true);
  });
});

describe('ai: aiming and firing', () => {
  test('Fires when lined up', () => {
    const state = playing(makeBoard(), 1);
    place(state, 'p1', 200, 300, 0);
    place(state, 'ai1', 400, 300, Math.PI);
    const events = [];
    for (let i = 0; i < 60; i++) events.push(...step(state, {}));
    expect(ofType(events, 'shotFired').some((e) => e.tankId === 'ai1')).toBe(true);
  });

  test('Lined up but blocked by cover', () => {
    // The lane between the tanks is clear, but this corner sits just off it: a +3° aim error puts the barrel into it.
    const corner = { x: 180, y: 240, w: 60, h: 51 };
    const state = playing(makeBoard([corner]), 1);
    const target = place(state, 'p1', 150, 300, 0);
    const ai = place(state, 'ai1', 400, 300, Math.PI);
    step(state, {});
    state.ai['ai1']!.aimOffset = cfg.aiAimError;
    const mem = state.ai['ai1']!;
    let firedAt = -1;
    let reversalsWhileBlocked = 0;
    let reaimsWhileBlocked = 0;
    let lastTurn = 0;
    for (let i = 0; i < 3 * cfg.tickRate && firedAt < 0; i++) {
      target.hp = cfg.tankMaxHp;
      const heading = ai.heading;
      const aim = mem.aimOffset;
      const wasBlocked = mem.blockedTicks > 0;
      if (ofType(step(state, {}), 'shotFired').some((e) => e.tankId === 'ai1')) firedAt = i;
      const turn = Math.sign(angleDiff(heading, ai.heading));
      if (wasBlocked && mem.blockedTicks > 0) {
        if (mem.aimOffset !== aim) reaimsWhileBlocked++;
        if (turn !== 0 && lastTurn !== 0 && turn !== lastTurn) reversalsWhileBlocked++;
        if (turn !== 0) lastTurn = turn;
      }
    }
    expect(reaimsWhileBlocked).toBe(0); // it holds its aim while it waits...
    expect(reversalsWhileBlocked).toBe(0);
    expect(firedAt).toBeGreaterThanOrEqual(0); // ...then repositions and fires, rather than freezing
    expect(ai.alive).toBe(true);
  });

  test('Holds fire behind cover', () => {
    const wall = { x: 290, y: 200, w: 20, h: 200 };
    const state = playing(makeBoard([wall]), 1);
    place(state, 'p1', 200, 300, 0);
    const ai = place(state, 'ai1', 400, 300, Math.PI);
    for (let i = 0; i < 5 * cfg.tickRate; i++) {
      const input = think(state, ai);
      expect(input.fire).toBe(false);
      ai.x = 400; // pinned, so it can't simply drive round the wall
      ai.y = 300;
      ai.heading = Math.PI;
    }
  });

  test('Reaction delay', () => {
    const wall = { x: 290, y: 200, w: 20, h: 200 };
    const state = playing(makeBoard([wall]), 1);
    place(state, 'p1', 200, 300, 0);
    place(state, 'ai1', 400, 300, Math.PI); // already facing the target
    thinkPinned(state, 'ai1', 30); // target hidden
    state.board.obstacles = []; // the target is suddenly visible
    const inputs = thinkPinned(state, 'ai1', 60);
    const firstShot = inputs.findIndex((i) => i.fire);
    expect(firstShot).toBeGreaterThanOrEqual(REACTION_TICKS);
  });

  test('aim includes a small random error within the configured bound', () => {
    const offsets = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const state = playing(makeBoard(), 1, seed);
      place(state, 'p1', 200, 300, 0);
      place(state, 'ai1', 400, 300, Math.PI);
      thinkPinned(state, 'ai1', 2);
      const offset = state.ai['ai1']!.aimOffset;
      expect(Math.abs(offset)).toBeLessThanOrEqual(cfg.aiAimError);
      offsets.add(offset);
    }
    expect(offsets.size).toBeGreaterThan(1);
  });
});

describe('ai: beatable imperfection', () => {
  test('AI fires slower than the reload allows', () => {
    const state = playing(makeBoard(), 1);
    const target = place(state, 'p1', 200, 300, 0);
    place(state, 'ai1', 400, 300, Math.PI);
    const shotTicks: number[] = [];
    for (let i = 0; i < 30 * cfg.tickRate; i++) {
      target.hp = cfg.tankMaxHp; // an indestructible target, so the AI keeps shooting
      for (const e of ofType(step(state, {}), 'shotFired'))
        if (e.tankId === 'ai1') shotTicks.push(state.tick);
    }
    const gaps = shotTicks.slice(1).map((t, i) => t - shotTicks[i]!);
    const cooldown = Math.round(cfg.fireCooldown * cfg.tickRate);
    const pauseMax = Math.round(cfg.aiFirePauseMax * cfg.tickRate);
    expect(gaps.length).toBeGreaterThan(20);
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(cooldown);
      expect(gap).toBeLessThanOrEqual(cooldown + pauseMax);
    }
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(mean).toBeGreaterThan(cooldown + 1); // slower on average than firing at every reload...
    expect(new Set(gaps).size).toBeGreaterThan(1); // ...and irregular, not a metronome
  });

  test('Reproducible behaviour', () => {
    const run = (): string[] => {
      const state = matchOn(
        { mode: 'lastOneStanding', aiCount: 4, rounds: 7, mortars: false },
        makeBoard([{ x: 350, y: 250, w: 100, h: 100 }]),
        99,
      );
      const trace: string[] = [];
      for (let i = 0; i < 900; i++) {
        step(state, {
          p1: { throttle: i % 120 < 60 ? 1 : 0, turn: i % 90 < 30 ? -1 : 0, fire: i % 25 === 0 },
        });
        // AI inputs fully determine AI tank state, so identical traces mean identical inputs.
        trace.push(JSON.stringify(state.tanks.filter((t) => t.kind === 'ai')));
      }
      return trace;
    };
    expect(run()).toEqual(run());
  });
});

describe('waves: AI tanks are allies', () => {
  /** The infighting layout above: a full-height wall seals the human off, and the AI tanks can see each other. */
  function sealedHuman(state: MatchState): MatchState {
    place(state, 'p1', 60, 300, 0);
    place(state, 'ai1', 350, 300, Math.PI / 2);
    place(state, 'ai2', 650, 300, Math.PI / 2);
    return state;
  }
  const sealedBoard = (): Board => makeBoard([{ x: 150, y: 0, w: 20, h: 600 }]);

  test("AI tanks don't fight each other", () => {
    const state = sealedHuman(playingWaves(sealedBoard(), 2));
    const events = [];
    const targets = new Set<string | null>();
    for (let i = 0; i < 180; i++) {
      events.push(...step(state, {}));
      for (const id of ['ai1', 'ai2']) targets.add(state.ai[id]!.targetId);
    }
    expect([...targets]).toEqual(['p1']);
    expect(ofType(events, 'shotFired')).toHaveLength(0);
    for (const id of ['ai1', 'ai2']) expect(tank(state, id).hp).toBe(tank(state, id).maxHp);
  });

  test('switching co-operation off brings back infighting', () => {
    const config = { ...DEFAULT_CONFIG, wavesAiCooperate: false };
    const state = matchOn({ mode: 'waves', startAiCount: 2, mortars: false }, sealedBoard(), 1, config);
    state.phase = 'playing';
    sealedHuman(state);
    const events = [];
    for (let i = 0; i < 180; i++) events.push(...step(state, {}));
    const hits = ofType(events, 'hit');
    expect(hits.some((h) => h.shooterId.startsWith('ai') && h.targetId.startsWith('ai'))).toBe(true);
  });

  /** ai1 lined up on the human, with ai2 parked directly between them. */
  function allyInTheWay(): MatchState {
    const state = playingWaves(makeBoard(), 2);
    // Within engaging range, so ai1 sits still and waits for its shot rather than advancing.
    place(state, 'ai1', 150, 300, 0);
    place(state, 'ai2', 300, 300, Math.PI / 2);
    place(state, 'p1', 500, 300, Math.PI);
    return state;
  }

  test('Holding fire for an ally', () => {
    const state = allyInTheWay();
    const inputs = thinkPinned(state, 'ai1', 3 * cfg.tickRate);
    expect(state.ai['ai1']!.targetId).toBe('p1');
    expect(inputs.some((i) => i.fire)).toBe(false);

    // Once the ally moves out of the lane, the shot goes. Having backed off while it waited, the AI steers clear of
    // that spot for a while, so this time it's left free to drive and find another.
    place(state, 'ai2', 300, 500, Math.PI / 2);
    const ai = tank(state, 'ai1');
    let fired = false;
    for (let i = 0; i < 5 * cfg.tickRate && !fired; i++) {
      tank(state, 'p1').hp = cfg.tankMaxHp;
      const input = think(state, ai);
      fired = input.fire;
      world(state, { ai1: input });
      place(state, 'ai2', 300, 500, Math.PI / 2);
    }
    expect(fired).toBe(true);
  });

  test("An ally in the way doesn't freeze the AI", () => {
    const state = allyInTheWay();
    const inputs = thinkPinned(state, 'ai1', 2 * cfg.tickRate);
    const firstMove = inputs.findIndex((i) => i.throttle !== 0);
    // Lined up and waiting at first; within a bounded time it backs off to find a new spot.
    expect(firstMove).toBeGreaterThan(REACTION_TICKS);
    expect(firstMove).toBeLessThanOrEqual(REACTION_TICKS + Math.round(cfg.aiStuckWindow * cfg.tickRate) + 1);

    // Left to drive for real, with the ally held still as the worst case, it never sits motionless for
    // longer than it takes to re-aim and decide it's blocked.
    const ai = tank(state, 'ai1');
    const bound = REACTION_TICKS + Math.round((cfg.aiStuckWindow + cfg.aiRecoverDuration) * cfg.tickRate);
    let still = 0;
    let longestStill = 0;
    for (let i = 0; i < 10 * cfg.tickRate; i++) {
      const before = { x: ai.x, y: ai.y, heading: ai.heading };
      world(state, { ai1: think(state, ai) });
      place(state, 'ai2', 300, 300, Math.PI / 2);
      tank(state, 'p1').hp = cfg.tankMaxHp;
      const moved = ai.x !== before.x || ai.y !== before.y || ai.heading !== before.heading;
      still = moved ? 0 : still + 1;
      longestStill = Math.max(longestStill, still);
    }
    expect(longestStill).toBeLessThanOrEqual(bound);
  });

  test('Accidents still happen', () => {
    const state = playingWaves(makeBoard(), 2);
    place(state, 'p1', 60, 60, 0);
    const shooter = place(state, 'ai1', 200, 300, 0);
    const ally = place(state, 'ai2', 400, 300, Math.PI);
    shooter.shellDamage = 2;
    ally.maxHp = 5; // tough enough to survive both shells
    ally.hp = 5;
    const events = world(state, { ai1: { fire: true } });
    for (let i = 0; i < 60; i++) events.push(...world(state));
    expect(ofType(events, 'hit')).toEqual([
      expect.objectContaining({ shooterId: 'ai1', targetId: 'ai2', damage: 2 }),
    ]);
    expect(ally.hp).toBe(ally.maxHp - 2);

    // Bounced shells too.
    addShell(state, 300, 300, 0, { ownerId: 'ai1', bounces: 1 });
    const later = world(state);
    for (let i = 0; i < 30; i++) later.push(...world(state));
    expect(ofType(later, 'hit')).toEqual([expect.objectContaining({ shooterId: 'ai1', targetId: 'ai2' })]);
    expect(ally.hp).toBe(ally.maxHp - 2 - cfg.shellDamage);
  });
});

describe('ai: decisive movement', () => {
  /**
   * Found by simulation on Ricochet Alley: ai2 has parked just west of the upper bar's end, firing at a human camped in
   * the top-left corner. ai1 wants to get past it, ends up nose-to-tail with it beside the corner, and used to sit there
   * turning back and forth for over a minute.
   */
  function queuedAtCorner(): MatchState {
    const state = playingWaves(RICOCHET_ALLEY, 2);
    place(state, 'p1', 20, 19, 0);
    place(state, 'ai1', 415, 237, Math.PI);
    place(state, 'ai2', 377, 238, (-148 * Math.PI) / 180);
    return state;
  }

  /** Plays the match with the human and ai2 held where they are; returns ai1's inputs. */
  function playHeld(state: MatchState, seconds: number): TankInput[] {
    const ai = tank(state, 'ai1');
    const inputs: TankInput[] = [];
    for (let i = 0; i < seconds * cfg.tickRate; i++) {
      tank(state, 'p1').hp = cfg.tankMaxHp;
      const input = think(state, ai);
      inputs.push(input);
      ai.fireHeld = input.fire;
      world(state, { ai1: input });
      place(state, 'p1', 20, 19, 0);
      place(state, 'ai2', 377, 238, (-148 * Math.PI) / 180);
    }
    return inputs;
  }

  test('Steady at a corner', () => {
    // Only the time at the corner, up to when it first backs off. After that it's queuing behind an ally that never
    // moves, which can still look like jostling: that's for a later change (AI tanks spreading out).
    const all = playHeld(queuedAtCorner(), 6);
    const backsOff = all.findIndex((i) => i.throttle === -1);
    expect(backsOff).toBeGreaterThan(cfg.tickRate);
    const inputs = all.slice(0, backsOff);
    for (let start = 0; start < inputs.length; start += cfg.tickRate) {
      // Count swings: turns held for two ticks or more. A one-tick nudge is just keeping the aim on a moving target.
      let reversals = 0;
      let swing = 0;
      let run = 0;
      let runTurn = 0;
      for (const { turn } of [...inputs.slice(start, start + cfg.tickRate), { turn: 0 }]) {
        if (turn === runTurn) {
          run++;
          continue;
        }
        if (runTurn !== 0 && run >= 2) {
          if (swing !== 0 && runTurn !== swing) reversals++;
          swing = runTurn;
        }
        runTurn = turn;
        run = 1;
      }
      expect(reversals, `second ${start / cfg.tickRate}`).toBeLessThanOrEqual(1);
    }
  });

  test('Blocked by an ally', () => {
    const inputs = playHeld(queuedAtCorner(), 3);
    expect(inputs.some((i) => i.throttle === -1)).toBe(true); // it backs off rather than pushing on
  });
});
