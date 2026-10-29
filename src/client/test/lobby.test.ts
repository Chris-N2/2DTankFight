import { createMatch, type MatchOptions, type MatchState } from '@tank/sim';
import { describe, expect, test } from 'vitest';
import {
  aiRibbing,
  applyOptions,
  fitForTwo,
  freezeText,
  joinCodeIn,
  joinLink,
  lobbyStatus,
  onlineOptionsFor,
  onlineResultText,
  typedCodeProblem,
  withoutJoin,
} from '../src/lobby';
import { DEFAULT_CHOICES, type SetupChoices } from '../src/screens';

const fresh = (changes: Partial<SetupChoices> = {}): SetupChoices => ({
  ...DEFAULT_CHOICES,
  sequence: [],
  ...changes,
});

describe('online play: join links', () => {
  test('A link to the same page', () => {
    const link = joinLink('https://example.com/games/tank-command/?ref=menu', 'KTXW');
    const url = new URL(link);
    expect(url.origin + url.pathname).toBe('https://example.com/games/tank-command/');
    expect(url.searchParams.get('ref')).toBe('menu');
    expect(url.searchParams.get('join')).toBe('KTXW');
  });

  test('a link replaces any code the page was opened with', () => {
    expect(joinLink('https://example.com/?join=ABCD', 'KTXW')).toBe('https://example.com/?join=KTXW');
  });

  test('the code comes off the address after joining, and nothing else does', () => {
    expect(withoutJoin('https://example.com/games/?ref=menu&join=KTXW#top')).toBe(
      'https://example.com/games/?ref=menu#top',
    );
    expect(joinCodeIn('https://example.com/?join=ktxw')).toBe('KTXW');
    expect(joinCodeIn('https://example.com/?join=K0XW')).toBeNull();
  });

  test('a typed code is checked before anyone asks the server', () => {
    expect(typedCodeProblem('ktxw')).toBeNull();
    expect(typedCodeProblem(' KTXW ')).toBeNull();
    expect(typedCodeProblem('')).toMatch(/four-character/);
    expect(typedCodeProblem('KTX')).toMatch(/four letters/);
    expect(typedCodeProblem('OIL0')).toMatch(/four letters/);
  });
});

describe('online play: hosting options', () => {
  test('Four AI won’t fit', () => {
    const choices = fresh({ aiCount: 4 });
    expect(fitForTwo(choices)).toBe('AI opponents lowered to 3 for two players.');
    expect(choices.aiCount).toBe(3);
    expect(onlineOptionsFor(choices)).toMatchObject({ aiCount: 3, humans: 2 });
    expect(fitForTwo(choices)).toBeNull(); // nothing more to lower
  });

  test('the starting AI tanks in Waves are lowered too', () => {
    const choices = fresh({ mode: 'waves', startAiCount: 4 });
    expect(fitForTwo(choices)).toMatch(/Starting AI tanks lowered to 3/);
  });

  test('Friendly fire offered for Waves, off by default', () => {
    expect(DEFAULT_CHOICES.friendlyFire).toBe(false);
    expect(onlineOptionsFor(fresh({ mode: 'waves' }))).toMatchObject({
      mode: 'waves',
      friendlyFire: false,
      humans: 2,
    });
    expect(onlineOptionsFor(fresh({ mode: 'waves', friendlyFire: true }))).toMatchObject({
      friendlyFire: true,
    });
    expect(onlineOptionsFor(fresh())).not.toHaveProperty('friendlyFire');
  });

  test('the guest sees the room’s options on the setup rows', () => {
    const choices = fresh();
    const waves: MatchOptions = {
      mode: 'waves',
      startAiCount: 2,
      mortars: false,
      friendlyFire: true,
      maps: { kind: 'sequence', ids: ['pac-tank'] },
      humans: 2,
    };
    applyOptions(choices, waves);
    expect(choices).toMatchObject({
      mode: 'waves',
      startAiCount: 2,
      mortars: false,
      friendlyFire: true,
      maps: 'sequence',
      sequence: ['pac-tank'],
    });
    expect(onlineOptionsFor(choices)).toEqual(waves);
  });

  test('the lobby says who it is waiting for', () => {
    expect(lobbyStatus('p1', false)).toBe('Waiting for a player…');
    expect(lobbyStatus('p1', true)).toMatch(/joined/);
    expect(lobbyStatus('p2', true)).toBe('Waiting for the host to start…');
  });
});

describe('online play: dropped connections on screen', () => {
  test('frozen, with the seconds left; reconnecting; then 3-2-1', () => {
    expect(freezeText({ reconnecting: false, othersDeadline: null, resumeAt: null }, 0)).toBeNull();
    expect(freezeText({ reconnecting: false, othersDeadline: 15_000, resumeAt: null }, 2500)).toEqual({
      title: 'Game frozen',
      sub: 'The other player dropped out. Waiting 13 s for them to come back…',
    });
    expect(freezeText({ reconnecting: true, othersDeadline: null, resumeAt: null }, 0)?.title).toBe(
      'Reconnecting…',
    );
    const at = (now: number) =>
      freezeText({ reconnecting: false, othersDeadline: 9000, resumeAt: 3000 }, now)?.title;
    expect([at(0), at(1001), at(2001)]).toEqual(['3', '2', '1']);
  });
});

function finished(changes: Partial<MatchState>, options: Partial<MatchOptions> = {}): MatchState {
  const state = createMatch(
    {
      mode: 'lastOneStanding',
      aiCount: 2,
      rounds: 5,
      mortars: true,
      maps: { kind: 'random' },
      humans: 2,
      ...options,
    } as MatchOptions,
    1,
  );
  return { ...state, phase: 'gameOver', ...changes };
}

describe('online play: results from each side', () => {
  test('One screen’s win is the other’s loss', () => {
    const state = finished({
      result: 'win',
      winnerId: 'p1',
      scores: { humans: { p1: 3, p2: 1 }, ai: 0 },
      roundsPlayed: 4,
    });
    expect(onlineResultText(state, 'p1')).toMatchObject({ title: 'Victory!', score: 'You 3 – 1 Them' });
    expect(onlineResultText(state, 'p2')).toMatchObject({ title: 'Defeat', score: 'You 1 – 3 Them' });
  });

  test('The AI cleaned up', () => {
    const state = finished(
      { result: 'draw', winnerId: null, scores: { humans: { p1: 0, p2: 0 }, ai: 3 }, roundsPlayed: 3 },
      { rounds: 3 },
    );
    for (const viewer of ['p1', 'p2']) {
      const text = onlineResultText(state, viewer);
      expect(text.title).toBe('A draw');
      expect(text.best).toMatch(/AI took all 3 rounds/);
    }
  });

  test('some rounds to the AI get a mention too, and none get none', () => {
    const some = finished({ scores: { humans: { p1: 3, p2: 0 }, ai: 1 }, roundsPlayed: 4 });
    expect(aiRibbing(some)).toBe('The AI took 1 round while you two were busy with each other.');
    expect(aiRibbing(finished({ scores: { humans: { p1: 3, p2: 1 }, ai: 0 }, roundsPlayed: 4 }))).toBe('');
  });

  test('Forfeit spelled out', () => {
    const state = finished({
      result: 'win',
      winnerId: 'p1',
      forfeit: true,
      scores: { humans: { p1: 0, p2: 1 }, ai: 0 },
    });
    expect(onlineResultText(state, 'p1').title).toBe('Victory by forfeit!');
    expect(onlineResultText(state, 'p2').title).toBe('Defeat by forfeit');
  });

  test('No online bests: Waves shows what the team cleared, and no best', () => {
    const state = createMatch(
      { mode: 'waves', startAiCount: 1, mortars: true, maps: { kind: 'random' }, humans: 2 },
      1,
    );
    const over = { ...state, phase: 'gameOver' as const, round: 7, waves: { startAiCount: 1, cleared: 6 } };
    expect(onlineResultText(over, 'p2')).toMatchObject({
      title: 'Overrun on wave 7',
      score: 'The team cleared 6 waves',
      best: '',
    });
  });
});
