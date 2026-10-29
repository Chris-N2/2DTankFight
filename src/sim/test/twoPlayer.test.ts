import { describe, expect, test } from 'vitest';
import {
  cloneState,
  createMatch,
  leave,
  step,
  validateOptions,
  waveSetup,
  type MatchState,
  type SimEvent,
} from '../src';
import { think } from '../src/ai/think';
import {
  addMortar,
  addShell,
  cfg,
  finishRound,
  makeBoard,
  matchOn,
  ofType,
  place,
  retire,
  skipToPlay,
  tank,
  withMaps,
  world,
  type GameOptions,
} from './helpers';

const LOS: GameOptions = { mode: 'lastOneStanding', aiCount: 1, rounds: 5, mortars: false, humans: 2 };
const WAVES: GameOptions = { mode: 'waves', startAiCount: 1, mortars: false, humans: 2 };

/** A two-player match (or any other options) that has skipped the first countdown and is in play. */
function inPlay(options: GameOptions, seed = 1): MatchState {
  const state = matchOn(options, makeBoard(), seed);
  state.phase = 'playing';
  state.phaseTicks = 0;
  return state;
}

/** Destroys the named tanks in the same tick, through the real rules. */
function destroy(state: MatchState, ...ids: string[]): SimEvent[] {
  for (const id of ids) tank(state, id).hp = 0;
  return step(state, {});
}

const ais = (state: MatchState): string[] => state.tanks.filter((t) => t.kind === 'ai').map((t) => t.id);

/**
 * Plays a two-player Last One Standing round to the given end: a human's id (they're the last tank), `ai` (both
 * humans out), or `shared` (the humans are the last two and destroy each other).
 */
function playRound(state: MatchState, end: 'p1' | 'p2' | 'ai' | 'shared'): SimEvent[] {
  const events = skipToPlay(state);
  if (end === 'ai') return [...events, ...destroy(state, 'p1', 'p2')];
  if (end === 'shared') return [...events, ...destroy(state, ...ais(state)), ...destroy(state, 'p1', 'p2')];
  return [...events, ...destroy(state, end === 'p1' ? 'p2' : 'p1', ...ais(state))];
}

/** Runs physics ticks (no AI) until a shell event or the tick limit, returning every event. */
function fly(state: MatchState, ticks = 120): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    events.push(...world(state));
    if (events.some((e) => e.type === 'hit' || e.type === 'friendlyHit' || e.type === 'shellDestroyed'))
      break;
  }
  return events;
}

describe('simulation: one or two human players', () => {
  test('Two humans, two sets of controls', () => {
    const state = inPlay(LOS);
    retire(state, 'ai1');
    const p1 = place(state, 'p1', 200, 200, 0);
    const p2 = place(state, 'p2', 200, 400, 0);
    world(state, { p1: { throttle: 1 } });
    expect(p1.x).toBeGreaterThan(200);
    expect(p2.x).toBe(200);
  });

  test('a match has one human unless it asks for two', () => {
    const one = matchOn({ mode: 'lastOneStanding', aiCount: 2, rounds: 3, mortars: false }, makeBoard(), 1);
    expect(one.tanks.map((t) => t.id)).toEqual(['p1', 'ai1', 'ai2']);
    expect(one.scores).toEqual({ humans: { p1: 0 }, ai: 0 });
    const two = matchOn({ ...LOS, aiCount: 2 }, makeBoard(), 1);
    expect(two.tanks.map((t) => t.id)).toEqual(['p1', 'p2', 'ai1', 'ai2']);
    expect(two.scores).toEqual({ humans: { p1: 0, p2: 0 }, ai: 0 });
  });

  test('Too many tanks rejected', () => {
    for (const options of [
      { ...LOS, aiCount: 4 },
      { ...WAVES, startAiCount: 4 },
    ]) {
      expect(validateOptions(withMaps(options))).toMatch(/between 1 and 3/);
      expect(() => createMatch(withMaps(options), 1)).toThrow();
    }
  });

  test('the number of humans and friendly fire are checked', () => {
    expect(validateOptions(withMaps({ ...LOS, humans: 3 as 2 }))).toMatch(/1 or 2 human/);
    expect(validateOptions(withMaps({ ...WAVES, friendlyFire: 'yes' as unknown as boolean }))).toMatch(
      /Friendly fire/,
    );
    expect(validateOptions(withMaps({ ...WAVES, friendlyFire: true }))).toBeNull();
  });
});

describe('simulation: leaving a match', () => {
  test('A clean exit', () => {
    const state = inPlay({ ...WAVES, mortars: true });
    retire(state, 'ai1');
    addShell(state, 600, 100, 0, { ownerId: 'p2' });
    addShell(state, 600, 500, 0, { ownerId: 'p2' });
    addShell(state, 300, 300, 0, { ownerId: 'p1' });
    addMortar(state, 400, 300, 30, 'p2');
    const events = leave(state, 'p2');
    expect(events[0]).toEqual({ type: 'left', tankId: 'p2' });
    expect(state.tanks.some((t) => t.id === 'p2')).toBe(false);
    expect(state.shells.map((s) => s.ownerId)).toEqual(['p1']);
    expect(state.mortarShells).toEqual([]);
    expect(state.phase).toBe('playing');
  });

  test('Too late to leave', () => {
    const state = inPlay(WAVES);
    destroy(state, 'p1', 'p2');
    expect(state.phase).toBe('gameOver');
    const before = cloneState(state);
    expect(leave(state, 'p2')).toEqual([]);
    expect(state).toEqual(before);
  });

  test('leaving does nothing in single-player, or for a tank that is not a human', () => {
    const solo = inPlay({ mode: 'waves', startAiCount: 1, mortars: false });
    const before = cloneState(solo);
    expect(leave(solo, 'p1')).toEqual([]);
    expect(solo).toEqual(before);
    const two = inPlay(WAVES);
    expect(leave(two, 'ai1')).toEqual([]);
    expect(leave(two, 'p3')).toEqual([]);
    expect(two.tanks).toHaveLength(3);
  });
});

describe('simulation: friendly fire', () => {
  /** A two-player Waves match in play, AI out of the way, p1 lined up on p2 at close range. */
  function lined(friendlyFire?: boolean): MatchState {
    const state = inPlay({ ...WAVES, ...(friendlyFire === undefined ? {} : { friendlyFire }) });
    retire(state, 'ai1');
    place(state, 'p1', 200, 300, 0);
    place(state, 'p2', 400, 300, 0);
    return state;
  }

  test('Friendly fire off (and Friendly fire is off unless chosen)', () => {
    for (const state of [lined(), lined(false)]) {
      const events = [...world(state, { p1: { fire: true } }), ...fly(state)];
      expect(ofType(events, 'friendlyHit')).toMatchObject([{ shooterId: 'p1', targetId: 'p2' }]);
      expect(ofType(events, 'hit')).toEqual([]);
      expect(tank(state, 'p2').hp).toBe(cfg.tankMaxHp);
      expect(state.shells).toEqual([]);
    }
  });

  test('a bounced shell from the other human does no damage either', () => {
    const state = lined();
    // p1's shell, already bounced, heading back west into p2.
    addShell(state, 500, 300, Math.PI, { ownerId: 'p1', bounces: 1 });
    const events = fly(state);
    expect(ofType(events, 'friendlyHit')).toHaveLength(1);
    expect(tank(state, 'p2').hp).toBe(cfg.tankMaxHp);
  });

  test('Friendly fire on', () => {
    const state = lined(true);
    const events = [...world(state, { p1: { fire: true } }), ...fly(state)];
    expect(ofType(events, 'hit')).toMatchObject([{ shooterId: 'p1', targetId: 'p2' }]);
    expect(tank(state, 'p2').hp).toBe(cfg.tankMaxHp - cfg.shellDamage);
  });

  test('Still hoisted by your own shell', () => {
    const state = lined();
    addShell(state, 300, 300, Math.PI, { ownerId: 'p1', bounces: 1 });
    const events = fly(state);
    expect(ofType(events, 'hit')).toMatchObject([{ shooterId: 'p1', targetId: 'p1' }]);
    expect(tank(state, 'p1').hp).toBe(cfg.tankMaxHp - cfg.shellDamage);
  });

  test('AI shells still damage humans with friendly fire off', () => {
    const state = lined();
    addShell(state, 500, 300, Math.PI, { ownerId: 'ai1' });
    fly(state);
    expect(tank(state, 'p2').hp).toBe(cfg.tankMaxHp - cfg.shellDamage);
  });

  test('in Last One Standing everyone is fair game', () => {
    const state = inPlay(LOS);
    retire(state, 'ai1');
    place(state, 'p1', 200, 300, 0);
    place(state, 'p2', 400, 300, 0);
    const events = [...world(state, { p1: { fire: true } }), ...fly(state)];
    expect(ofType(events, 'hit')).toMatchObject([{ targetId: 'p2' }]);
  });
});

describe('game client: AI colours with two humans', () => {
  test('No blue AI in a two-player match', () => {
    const state = matchOn({ ...LOS, aiCount: 3 }, makeBoard(), 1);
    expect(state.tanks.map((t) => [t.id, t.colorIndex])).toEqual([
      ['p1', 0],
      ['p2', 2],
      ['ai1', 1],
      ['ai2', 3],
      ['ai3', 4],
    ]);
  });

  test('Single-player colours unchanged', () => {
    const state = matchOn({ mode: 'lastOneStanding', aiCount: 4, rounds: 3, mortars: false }, makeBoard(), 1);
    expect(state.tanks.map((t) => t.colorIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  test('Colours stay put across waves', () => {
    const state = matchOn({ ...WAVES, startAiCount: 2 }, makeBoard(), 1);
    const colours = (): Record<string, number> =>
      Object.fromEntries(state.tanks.filter((t) => t.kind === 'ai').map((t) => [t.id, t.colorIndex]));
    expect(colours()).toEqual({ ai1: 1, ai2: 3 });
    finishRound(state, 'human');
    skipToPlay(state);
    expect(colours()).toEqual({ ai1: 1, ai2: 3, ai3: 4 });
  });
});

describe('waves: two humans', () => {
  test('Two humans, three AI at most', () => {
    const state = matchOn(WAVES, makeBoard(), 1);
    const sizes: number[] = [];
    for (let wave = 1; wave <= 5; wave++) {
      skipToPlay(state);
      sizes.push(ais(state).length);
      finishRound(state, 'human');
    }
    expect(sizes).toEqual([1, 2, 3, 3, 3]);
  });

  test('Two-player escalation starts at three', () => {
    const first = waveSetup(cfg, 3, 1, 3);
    const second = waveSetup(cfg, 3, 2, 3);
    expect(second.aiCount).toBe(3);
    expect(second.aiMaxHp).toBeGreaterThan(first.aiMaxHp);
    expect(second.changes).toEqual(['armour']);
    // And the game uses it.
    const state = matchOn({ ...WAVES, startAiCount: 3 }, makeBoard(), 1);
    const wave1Hp = tank(state, 'ai1').maxHp;
    finishRound(state, 'human');
    skipToPlay(state);
    expect(tank(state, 'ai1').maxHp).toBeGreaterThan(wave1Hp);
  });

  test('Both humans armed', () => {
    const state = matchOn({ ...WAVES, mortars: true }, makeBoard(), 1);
    expect(state.tanks.map((t) => [t.id, t.mortars])).toEqual([
      ['p1', 1],
      ['p2', 1],
      ['ai1', 0],
    ]);
  });

  test('One down is not game over', () => {
    const state = inPlay(WAVES);
    destroy(state, 'p1');
    expect(tank(state, 'p1').alive).toBe(false);
    expect(state.phase).toBe('playing');
  });

  test('Both down is game over', () => {
    const state = inPlay(WAVES);
    destroy(state, 'p1');
    const events = destroy(state, 'p2');
    expect(state.phase).toBe('gameOver');
    expect(ofType(events, 'gameEnded')).toEqual([{ type: 'gameEnded', result: 'over', wavesCleared: 0 }]);
  });

  test('Back for the next wave', () => {
    const state = inPlay(WAVES);
    tank(state, 'p2').hp = 1;
    destroy(state, 'p1');
    finishRound(state, 'human');
    expect(state.waves?.cleared).toBe(1);
    skipToPlay(state);
    for (const id of ['p1', 'p2']) {
      expect(tank(state, id).alive).toBe(true);
      expect(tank(state, id).hp).toBe(cfg.tankMaxHp);
    }
  });

  test('Sitting it out', () => {
    const state = inPlay(WAVES);
    destroy(state, 'p1');
    const p1 = tank(state, 'p1');
    const where = [p1.x, p1.y, p1.heading];
    // Ten seconds of the wave with nobody else going down, and the destroyed human pressing everything.
    const events: SimEvent[] = [];
    for (let i = 0; i < 600; i++) {
      tank(state, 'p2').hp = 1000;
      tank(state, 'ai1').hp = 1000;
      events.push(...step(state, { p1: { throttle: 1, turn: 1, fire: i % 2 === 0, mortar: false } }));
      expect(state.phase).toBe('playing');
    }
    expect(p1.alive).toBe(false);
    expect([p1.x, p1.y, p1.heading]).toEqual(where);
    expect(ofType(events, 'shotFired').filter((e) => e.tankId === 'p1')).toEqual([]);
    // Back once the other human clears the wave, and not before.
    finishRound(state, 'human');
    skipToPlay(state);
    expect(state.round).toBe(2);
    expect(p1.alive).toBe(true);
  });

  test('an AI whose target is destroyed moves on to the other human', () => {
    const state = inPlay(WAVES);
    const ai = tank(state, 'ai1');
    place(state, 'ai1', 400, 300, 0);
    place(state, 'p1', 500, 300, 0);
    place(state, 'p2', 400, 500, 0);
    think(state, ai);
    expect(state.ai['ai1']!.targetId).toBe('p1');
    destroy(state, 'p1');
    think(state, ai);
    expect(state.ai['ai1']!.targetId).toBe('p2');
  });
});

describe('waves: a human leaves', () => {
  test('Carrying on alone', () => {
    const state = matchOn(WAVES, makeBoard(), 1);
    finishRound(state, 'human');
    finishRound(state, 'human');
    skipToPlay(state);
    expect(state.round).toBe(3);
    const events = leave(state, 'p2');
    expect(ofType(events, 'gameEnded')).toEqual([]);
    expect(state.phase).toBe('playing');
    const end = destroy(state, 'p1');
    expect(ofType(end, 'gameEnded')).toEqual([{ type: 'gameEnded', result: 'over', wavesCleared: 2 }]);
  });

  test('Nobody left to carry on', () => {
    const state = inPlay(WAVES);
    destroy(state, 'p1');
    const events = leave(state, 'p2');
    expect(state.phase).toBe('gameOver');
    expect(state.result).toBe('over');
    expect(ofType(events, 'gameEnded')).toEqual([{ type: 'gameEnded', result: 'over', wavesCleared: 0 }]);
  });

  test('A cleared wave still earns the respawn', () => {
    const state = inPlay(WAVES);
    destroy(state, 'p1');
    finishRound(state, 'human');
    expect(state.phase).toBe('roundOver');
    leave(state, 'p2');
    expect(state.phase).toBe('roundOver');
    skipToPlay(state);
    expect(state.phase).toBe('playing');
    expect(tank(state, 'p1').alive).toBe(true);
  });

  test('leaving during the countdown: the other human plays the wave alone', () => {
    const state = matchOn(WAVES, makeBoard(), 1);
    expect(state.phase).toBe('countdown');
    leave(state, 'p1');
    expect(state.phase).toBe('countdown');
    skipToPlay(state);
    expect(state.phase).toBe('playing');
    expect(state.tanks.filter((t) => t.kind === 'human').map((t) => t.id)).toEqual(['p2']);
  });

  test('both humans leaving ends the game at once, whatever the phase', () => {
    const countdown = matchOn(WAVES, makeBoard(), 1);
    leave(countdown, 'p2');
    const events = leave(countdown, 'p1');
    expect(countdown.phase).toBe('gameOver');
    expect(ofType(events, 'gameEnded')).toEqual([{ type: 'gameEnded', result: 'over', wavesCleared: 0 }]);

    const pause = inPlay(WAVES);
    finishRound(pause, 'human');
    expect(pause.phase).toBe('roundOver');
    leave(pause, 'p1');
    leave(pause, 'p2');
    expect(pause.phase).toBe('gameOver');
    expect(pause.result).toBe('over');
    expect(pause.waves?.cleared).toBe(1);
  });

  test('No reinforcements for the AI', () => {
    const state = inPlay({ ...WAVES, startAiCount: 3 });
    leave(state, 'p2');
    finishRound(state, 'human');
    skipToPlay(state);
    expect(state.round).toBe(2);
    expect(ais(state)).toHaveLength(3);
  });
});

describe('last one standing: two humans', () => {
  test('Two humans, at most three AI', () => {
    const state = matchOn({ ...LOS, aiCount: 3 }, makeBoard(), 1);
    expect(state.tanks.map((t) => t.id)).toEqual(['p1', 'p2', 'ai1', 'ai2', 'ai3']);
    expect(() => matchOn({ ...LOS, aiCount: 4 }, makeBoard(), 1)).toThrow();
  });

  test('One human down, play on', () => {
    const state = inPlay(LOS);
    destroy(state, 'p1');
    expect(state.phase).toBe('playing');
  });

  test('Last human standing', () => {
    const state = inPlay(LOS);
    destroy(state, 'p1');
    const events = destroy(state, 'ai1');
    expect(state.phase).toBe('roundOver');
    expect(ofType(events, 'roundEnded')).toMatchObject([{ outcome: 'human', scorers: ['p2'] }]);
    expect(state.scores).toEqual({ humans: { p1: 0, p2: 1 }, ai: 0 });
    expect(state.lastRoundScorers).toEqual(['p2']);
  });

  test('two humans left after the AI is gone keep fighting', () => {
    const state = inPlay(LOS);
    destroy(state, 'ai1');
    expect(state.phase).toBe('playing');
  });

  test('The AI wins a two-player round', () => {
    const state = inPlay({ ...LOS, aiCount: 2 });
    const events = destroy(state, 'p1', 'p2');
    expect(state.phase).toBe('roundOver');
    expect(ofType(events, 'roundEnded')).toMatchObject([{ outcome: 'ai', scorers: [] }]);
    expect(state.scores).toEqual({ humans: { p1: 0, p2: 0 }, ai: 1 });
    expect(state.roundsPlayed).toBe(1);
  });

  test('Sharing the point', () => {
    const state = inPlay(LOS);
    destroy(state, 'ai1');
    const events = destroy(state, 'p1', 'p2');
    expect(ofType(events, 'roundEnded')).toMatchObject([{ outcome: 'human', scorers: ['p1', 'p2'] }]);
    expect(state.scores).toEqual({ humans: { p1: 1, p2: 1 }, ai: 0 });
  });

  test('everyone going out together is a shared point too', () => {
    const state = inPlay(LOS);
    destroy(state, 'p1', 'p2', 'ai1');
    expect(state.scores).toEqual({ humans: { p1: 1, p2: 1 }, ai: 0 });
  });

  test('Going out with the last AI', () => {
    const state = inPlay(LOS);
    destroy(state, 'p1');
    const events = destroy(state, 'p2', 'ai1');
    expect(ofType(events, 'roundEnded')).toMatchObject([{ outcome: 'draw', scorers: [] }]);
    expect(state.scores).toEqual({ humans: { p1: 0, p2: 0 }, ai: 0 });
    expect(state.roundsPlayed).toBe(1);
  });

  test('Out of reach', () => {
    const state = matchOn(LOS, makeBoard(), 1);
    playRound(state, 'p1');
    playRound(state, 'p1');
    expect(state.phase).toBe('roundOver');
    const events = playRound(state, 'p1');
    expect(state.phase).toBe('gameOver');
    expect(state.roundsPlayed).toBe(3);
    expect(ofType(events, 'gameEnded')).toMatchObject([{ result: 'win', winnerId: 'p1', forfeit: false }]);
    expect(state.winnerId).toBe('p1');
  });

  test('AI rounds still count', () => {
    const state = matchOn({ ...LOS, rounds: 3 }, makeBoard(), 1);
    playRound(state, 'ai');
    playRound(state, 'ai');
    expect(state.phase).toBe('roundOver');
    const events = playRound(state, 'p2');
    expect(state.phase).toBe('gameOver');
    expect(ofType(events, 'gameEnded')).toMatchObject([
      { result: 'win', winnerId: 'p2', scores: { humans: { p1: 0, p2: 1 }, ai: 2 } },
    ]);
  });

  test('Level after the last round', () => {
    const state = matchOn({ ...LOS, rounds: 3 }, makeBoard(), 1);
    playRound(state, 'shared');
    playRound(state, 'ai');
    const events = playRound(state, 'ai');
    expect(ofType(events, 'gameEnded')).toMatchObject([
      { result: 'draw', winnerId: null, scores: { humans: { p1: 1, p2: 1 } } },
    ]);
  });

  test("The AI's rounds are only for show", () => {
    const state = matchOn({ ...LOS, rounds: 3 }, makeBoard(), 1);
    playRound(state, 'ai');
    playRound(state, 'ai');
    expect(state.phase).toBe('roundOver'); // 0–0 with a round to go: anyone's game
    const events = playRound(state, 'ai');
    expect(ofType(events, 'gameEnded')).toMatchObject([
      { result: 'draw', winnerId: null, scores: { humans: { p1: 0, p2: 0 }, ai: 3 } },
    ]);
  });

  test('Winning by forfeit', () => {
    const state = matchOn(LOS, makeBoard(), 1);
    playRound(state, 'p1');
    playRound(state, 'p1');
    skipToPlay(state);
    const events = leave(state, 'p2');
    expect(state.phase).toBe('gameOver');
    expect(state.roundsPlayed).toBe(2);
    expect(ofType(events, 'gameEnded')).toEqual([
      {
        type: 'gameEnded',
        result: 'win',
        scores: { humans: { p1: 2, p2: 0 }, ai: 0 },
        winnerId: 'p1',
        forfeit: true,
      },
    ]);
    expect(state.forfeit).toBe(true);
  });

  test('leaving during the countdown is a forfeit too', () => {
    const state = matchOn(LOS, makeBoard(), 1);
    expect(state.phase).toBe('countdown');
    const events = leave(state, 'p1');
    expect(state.phase).toBe('gameOver');
    expect(ofType(events, 'gameEnded')).toMatchObject([{ result: 'win', winnerId: 'p2', forfeit: true }]);
    expect(state.roundsPlayed).toBe(0);
    // The second human leaving afterwards changes nothing.
    expect(leave(state, 'p2')).toEqual([]);
    expect(state.winnerId).toBe('p2');
  });

  test('Leaving between rounds', () => {
    const state = matchOn(LOS, makeBoard(), 1);
    playRound(state, 'p1');
    expect(state.phase).toBe('roundOver');
    leave(state, 'p1');
    expect(state.phase).toBe('gameOver');
    expect(state.winnerId).toBe('p2');
    for (let i = 0; i < 600; i++) step(state, {});
    expect(state.round).toBe(1);
  });
});
