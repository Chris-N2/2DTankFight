import { describe, expect, test } from 'vitest';
import {
  DEFAULT_CONFIG,
  PROVING_GROUND,
  step,
  type MatchState,
  type SimConfig,
  type TankInput,
} from '../src';
import { matchOn, type GameOptions } from './helpers';

// Recorded before map selection was added. Map choice draws from its own random stream, so a one-map Proving Ground
// game must still give every tank the same spawn point and play out identically. If this fails after a change that
// deliberately alters gameplay, re-record the values; if it fails after a change to map selection, that's a bug.
// Re-recorded for ai-steady-at-corners, which changed how AI tanks move, aim and pick targets (and so their random
// draws). The spawns are unchanged; Last One Standing now plays four rounds in the scripted time, not five.
// Re-recorded for mortar-silences-ai: every tank gained a field (the only change in Last One Standing), and in Waves
// a mortared AI can't fire, so the scripted human now reaches one more wave in the same time.
// Re-recorded for two-player-sim: scores became per human and the round and game events gained fields, which the
// fingerprint includes. Play itself didn't change: the spawns are the same, and a temporary test that mapped the new
// shapes back to the old ones matched 168 recorded single-player games across every board.

function scripted(tick: number): TankInput {
  return {
    throttle: tick % 150 < 100 ? 1 : tick % 150 < 120 ? -1 : 0,
    turn: tick % 70 < 20 ? -1 : tick % 70 < 35 ? 1 : 0,
    fire: tick % 17 < 3,
    mortar: tick % 400 > 360,
  };
}

/** FNV-1a over a string, as 8 hex digits. */
function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** The parts of the state that gameplay decides (not board or map bookkeeping). */
function gameplay(state: MatchState): string {
  const { tick, phase, round, roundsPlayed, scores, result, tanks, shells, mortarShells, rng, aiRng, ai } =
    state;
  return JSON.stringify({
    tick,
    phase,
    round,
    roundsPlayed,
    scores,
    result,
    tanks,
    shells,
    mortarShells,
    rng,
    aiRng,
    ai,
  });
}

function record(
  options: GameOptions,
  seed: number,
  ticks: number,
  config: SimConfig = DEFAULT_CONFIG,
): { spawns: string[]; fingerprint: string } {
  const state = matchOn(options, PROVING_GROUND, seed, config);
  const spawns: string[] = [];
  const noteSpawns = (): void => {
    spawns.push(state.tanks.map((t) => `${t.id}@${t.x},${t.y}`).join(' '));
  };
  noteSpawns();
  let events = '';
  for (let i = 0; i < ticks && state.phase !== 'gameOver'; i++) {
    const before = state.round;
    // A second human, if there is one, plays the same script half a cycle later.
    const tickEvents = step(state, { p1: scripted(i), p2: scripted(i + 75) });
    events += JSON.stringify(tickEvents);
    if (state.round !== before) noteSpawns();
  }
  return { spawns, fingerprint: fnv(gameplay(state) + events) };
}

describe('map selection: golden replay', () => {
  test('Last One Standing on Proving Ground plays as recorded', () => {
    const got = record({ mode: 'lastOneStanding', aiCount: 4, rounds: 7, mortars: true }, 4242, 20_000);
    expect(got).toEqual({
      spawns: [
        'p1@600,760 ai1@1130,730 ai2@70,730 ai3@1130,70 ai4@70,70',
        'p1@70,70 ai1@70,730 ai2@1130,70 ai3@600,760 ai4@1130,730',
        'p1@1130,730 ai1@70,730 ai2@70,70 ai3@600,760 ai4@1130,70',
        'p1@600,760 ai1@1130,730 ai2@70,70 ai3@70,730 ai4@1130,70',
      ],
      fingerprint: '0b2b83bf',
    });
  });

  test('Waves on Proving Ground plays as recorded', () => {
    // A tougher human survives the script for several waves, so wave changes are covered too.
    const got = record({ mode: 'waves', startAiCount: 2, mortars: true }, 9001, 40_000, {
      ...DEFAULT_CONFIG,
      tankMaxHp: 1000,
    });
    expect(got).toEqual({
      spawns: [
        'p1@70,730 ai1@600,760 ai2@1130,730',
        'p1@1130,730 ai1@600,760 ai2@1130,70 ai3@70,730',
        'p1@1130,730 ai1@1130,70 ai2@70,70 ai3@600,760 ai4@70,730',
        'p1@1130,70 ai1@600,760 ai2@70,70 ai3@1130,730 ai4@70,730',
        'p1@600,760 ai1@70,730 ai2@1130,730 ai3@1130,70 ai4@70,70',
        'p1@600,760 ai1@70,730 ai2@1130,730 ai3@1130,70 ai4@70,70',
        'p1@600,760 ai1@70,730 ai2@1130,730 ai3@1130,70 ai4@70,70',
        'p1@1130,730 ai1@1130,70 ai2@600,760 ai3@70,70 ai4@70,730',
        'p1@70,730 ai1@70,70 ai2@1130,730 ai3@600,760 ai4@1130,70',
        'p1@1130,730 ai1@70,70 ai2@1130,70 ai3@600,760 ai4@70,730',
      ],
      fingerprint: '274498e6',
    });
  });
});

// Recorded for two-player-sim. Nothing depended on two-player play before, so these pin it down for later changes.
describe('two players: golden replay', () => {
  test('two-player Last One Standing on Proving Ground plays as recorded', () => {
    const got = record(
      { mode: 'lastOneStanding', aiCount: 3, rounds: 7, mortars: true, humans: 2 },
      4242,
      20_000,
    );
    expect(got).toEqual({
      spawns: [
        'p1@600,760 p2@1130,730 ai1@70,730 ai2@1130,70 ai3@70,70',
        'p1@70,70 p2@70,730 ai1@1130,70 ai2@600,760 ai3@1130,730',
        'p1@1130,730 p2@70,730 ai1@70,70 ai2@600,760 ai3@1130,70',
        'p1@600,760 p2@1130,730 ai1@70,70 ai2@70,730 ai3@1130,70',
        'p1@600,760 p2@70,730 ai1@1130,730 ai2@1130,70 ai3@70,70',
        'p1@1130,730 p2@600,760 ai1@1130,70 ai2@70,730 ai3@70,70',
        'p1@1130,70 p2@600,760 ai1@1130,730 ai2@70,730 ai3@70,70',
      ],
      fingerprint: '9f39354f',
    });
  });

  test('two-player Waves on Proving Ground plays as recorded', () => {
    const got = record({ mode: 'waves', startAiCount: 1, mortars: true, humans: 2 }, 9001, 40_000, {
      ...DEFAULT_CONFIG,
      tankMaxHp: 1000,
    });
    expect(got).toEqual({
      spawns: [
        'p1@70,730 p2@600,760 ai1@1130,730',
        'p1@1130,730 p2@600,760 ai1@1130,70 ai2@70,730',
        'p1@1130,730 p2@1130,70 ai1@70,70 ai2@600,760 ai3@70,730',
        'p1@1130,70 p2@600,760 ai1@70,70 ai2@1130,730 ai3@70,730',
        'p1@600,760 p2@70,730 ai1@1130,730 ai2@1130,70 ai3@70,70',
        'p1@600,760 p2@70,730 ai1@1130,730 ai2@1130,70 ai3@70,70',
        'p1@600,760 p2@70,730 ai1@1130,730 ai2@1130,70 ai3@70,70',
        'p1@1130,730 p2@1130,70 ai1@600,760 ai2@70,70 ai3@70,730',
        'p1@70,730 p2@70,70 ai1@1130,730 ai2@600,760 ai3@1130,70',
        'p1@1130,730 p2@70,70 ai1@1130,70 ai2@600,760 ai3@70,730',
        'p1@1130,730 p2@1130,70 ai1@70,70 ai2@600,760 ai3@70,730',
        'p1@1130,70 p2@1130,730 ai1@70,70 ai2@600,760 ai3@70,730',
      ],
      fingerprint: 'd6543c17',
    });
  });
});
