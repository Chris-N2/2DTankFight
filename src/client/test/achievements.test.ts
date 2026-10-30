import {
  BUILT_IN_BOARDS,
  createMatch,
  DEFAULT_CONFIG,
  step,
  type Board,
  type MatchOptions,
  type MatchState,
  type Scores,
  type SimEvent,
} from '@tank/sim';
import { describe, expect, test } from 'vitest';
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_KEY,
  AchievementBook,
  achievementById,
  achievementRows,
  achievementsButtonLabel,
  AchievementTracker,
  COMPLETIONIST_KEYS,
  completionKey,
  completionistProgress,
  storageNote,
  UnlockQueue,
} from '../src/achievements';
import type { StorageLike } from '../src/best';

class FakeStorage implements StorageLike {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

/** Storage that throws on every access, as some browsers do when site data is blocked. */
const blocked: StorageLike = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('SecurityError');
  },
};

const BOARD = 'proving-ground';

function los(aiCount = 2, humans: 1 | 2 = 1): MatchState {
  return createMatch(
    {
      mode: 'lastOneStanding',
      aiCount,
      rounds: 5,
      mortars: true,
      humans,
      maps: { kind: 'sequence', ids: [BOARD] },
    },
    1,
  );
}

function waves(startAiCount = 1, humans: 1 | 2 = 1, friendlyFire = false): MatchState {
  return createMatch(
    {
      mode: 'waves',
      startAiCount,
      mortars: true,
      humans,
      friendlyFire,
      maps: { kind: 'sequence', ids: [BOARD] },
    },
    1,
  );
}

/**
 * A tracker for `viewer` on `state`, and a feed that plays events into it as the client would, keeping the state's
 * tanks in step with eliminations. Returns the ids earned so far.
 */
function track(
  state: MatchState,
  viewer = 'p1',
  book = AchievementBook.open(new FakeStorage()),
  eligible = true,
): { book: AchievementBook; feed: (...events: SimEvent[]) => string[] } {
  const tracker = new AchievementTracker(book, viewer, state, eligible);
  const earned: string[] = [];
  return {
    book,
    feed: (...events) => {
      for (const event of events) {
        if (event.type === 'eliminated') {
          const t = state.tanks.find((x) => x.id === event.tankId);
          if (t) {
            t.alive = false;
            t.hp = 0;
          }
        }
        earned.push(...tracker.onEvent(state, event).map((a) => a.id));
      }
      return earned;
    },
  };
}

/** Two players' trackers on the same game, fed the same events. */
function trackBoth(state: MatchState): (...events: SimEvent[]) => { p1: string[]; p2: string[] } {
  const a = track(state, 'p1');
  const b = track(state, 'p2');
  return (...events) => {
    let p1: string[] = [];
    let p2: string[] = [];
    for (const e of events) {
      p1 = a.feed(e);
      p2 = b.feed(e);
    }
    return { p1, p2 };
  };
}

function elim(
  tankId: string,
  byId: string,
  opts: { tick?: number; bankShot?: boolean; slowed?: boolean } = {},
): SimEvent {
  return {
    type: 'eliminated',
    tankId,
    byId,
    x: 0,
    y: 0,
    tick: opts.tick ?? 100,
    bankShot: opts.bankShot ?? false,
    slowed: opts.slowed ?? false,
  };
}

const shot = (tankId: string): SimEvent => ({
  type: 'shotFired',
  tankId,
  shellId: 1,
  x: 0,
  y: 0,
  heading: 0,
});
const hit = (shooterId: string, targetId: string): SimEvent => ({
  type: 'hit',
  shooterId,
  targetId,
  shellId: 1,
  damage: 1,
  x: 0,
  y: 0,
});
const scores = (humans: Record<string, number>, ai = 0): Scores => ({ humans, ai });
const roundEnded = (scorers: string[], outcome: 'human' | 'ai' | 'draw' = 'human'): SimEvent => ({
  type: 'roundEnded',
  round: 1,
  outcome,
  scorers,
  scores: scores({ p1: 0 }),
});
const losEnded = (
  result: 'win' | 'loss' | 'draw',
  winnerId: string | null,
  forfeit = false,
  s: Scores = scores({ p1: 0 }),
): SimEvent => ({ type: 'gameEnded', result, scores: s, winnerId, forfeit });
const waveCleared = (cleared: number): SimEvent => ({ type: 'waveCleared', wave: cleared, cleared });
const wavesEnded = (wavesCleared: number): SimEvent => ({ type: 'gameEnded', result: 'over', wavesCleared });
const waveStarted = (wave: number, aiCount: number): SimEvent => ({
  type: 'waveStarted',
  wave,
  aiCount,
  changes: [],
});
const mortarLanded = (ownerId: string, slowedIds: string[]): SimEvent => ({
  type: 'mortarLanded',
  mortarId: 1,
  ownerId,
  x: 0,
  y: 0,
  slowedIds,
});
const ROUND_STARTED: SimEvent = { type: 'roundStarted', round: 2 };

/** Destroys every AI tank in the state, credited to `byId`, and returns the events. */
function killAllAi(state: MatchState, byId: string, opts: { bankShot?: boolean } = {}): SimEvent[] {
  return state.tanks.filter((t) => t.kind === 'ai').map((t) => elim(t.id, byId, opts));
}

describe('achievements: the list', () => {
  test('Every achievement is listed', () => {
    expect(ACHIEVEMENTS.map((a) => a.name)).toEqual([
      'Taunted',
      'Last One Standing',
      'Surfer',
      'MADness',
      'Mudslinger',
      'Banked',
      'Perfection',
      'Pacifist',
      'Stop Hitting Yourself',
      'With Friends Like This…',
      'Friends with Benefits',
      'Ride the Wave',
      'Completionist',
      'Why Are You So Obsessed with Me?',
      'You Can Take That to the Bank',
      'Inconceivable!',
      'Dream Team',
      'Gluttons for Punishment',
      'Unfair Advantage',
      'Close Shave',
    ]);
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(20);
    for (const a of ACHIEVEMENTS) {
      expect(a.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(a.description.length).toBeGreaterThan(10);
    }
    const rows = achievementRows(AchievementBook.open(new FakeStorage()), true);
    expect(rows.map((r) => r.name)).toEqual(ACHIEVEMENTS.map((a) => a.name));
    expect(rows.every((r) => r.description.length > 0)).toBe(true);
  });

  test('where each can be earned matches the spec', () => {
    const where = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a.where]));
    expect(
      Object.entries(where)
        .filter(([, w]) => w === 'single')
        .map(([id]) => id),
    ).toEqual(['stop-hitting-yourself', 'ride-the-wave', 'take-it-to-the-bank', 'inconceivable']);
    expect(
      Object.entries(where)
        .filter(([, w]) => w === 'two')
        .map(([id]) => id),
    ).toEqual([
      'with-friends-like-this',
      'friends-with-benefits',
      'obsessed',
      'dream-team',
      'gluttons-for-punishment',
    ]);
  });
});

describe('achievements: whose, and in which games', () => {
  test('Each player earns their own', () => {
    const state = waves(2, 2);
    const feed = trackBoth(state);
    const got = feed(elim('ai1', 'p1', { bankShot: true }));
    expect(got.p1).toContain('banked');
    expect(got.p2).not.toContain('banked');
  });

  test('Shared credit for shared goals', () => {
    const state = waves(1, 2);
    const feed = trackBoth(state);
    const got = feed(wavesEnded(3));
    expect(got.p1).toContain('friends-with-benefits');
    expect(got.p2).toContain('friends-with-benefits');
  });

  test('Partner left', () => {
    const state = waves(1, 2);
    const { feed } = track(state);
    state.tanks = state.tanks.filter((t) => t.id !== 'p2');
    const earned = feed({ type: 'left', tankId: 'p2' }, waveCleared(5), waveCleared(8));
    expect(earned).not.toContain('ride-the-wave');
    expect(earned).not.toContain('inconceivable');
  });

  test('Not against the test bot', () => {
    const state = waves(1, 2);
    const { feed, book } = track(state, 'p1', AchievementBook.open(new FakeStorage()), false);
    expect(feed(...killAllAi(state, 'p1', { bankShot: true }), waveCleared(1), wavesEnded(1))).toEqual([]);
    expect(book.earnedCount).toBe(0);
    expect(book.completedKeys.size).toBe(0);
  });

  test("A dead partner's wave", () => {
    const state = waves(1, 2);
    const { feed, book } = track(state);
    const earned = feed(elim('p1', 'ai1', { tick: 50 }), ...killAllAi(state, 'p2'), waveCleared(1));
    expect(earned).toContain('surfer');
    for (const id of ['perfection', 'close-shave', 'completionist']) expect(earned).not.toContain(id);
    expect(book.completedKeys.has(completionKey('waves', BOARD))).toBe(false);
    expect(feed(waveCleared(9))).toContain('dream-team');
  });
});

describe('achievements: Taunted', () => {
  test('Out on wave 1', () => {
    const state = waves();
    expect(track(state).feed(elim('p1', 'ai1'), wavesEnded(0))).toContain('taunted');
  });

  test('Hoisted on wave 1', () => {
    const state = waves();
    expect(track(state).feed(elim('p1', 'p1'), wavesEnded(0))).toContain('taunted');
  });

  test('Got going first', () => {
    const state = waves();
    expect(track(state).feed(waveCleared(1), elim('p1', 'ai1'), wavesEnded(1))).not.toContain('taunted');
  });
});

describe('achievements: Last One Standing', () => {
  test('Winning the game', () => {
    expect(track(los()).feed(losEnded('win', 'p1'))).toContain('last-one-standing');
  });

  test('Two-player win', () => {
    const got = trackBoth(los(2, 2))(losEnded('win', 'p1', false, scores({ p1: 3, p2: 1 })));
    expect(got.p1).toContain('last-one-standing');
    expect(got.p2).not.toContain('last-one-standing');
  });

  test('Forfeit', () => {
    expect(track(los(2, 2)).feed(losEnded('win', 'p1', true))).not.toContain('last-one-standing');
  });
});

describe('achievements: Surfer', () => {
  test('First wave cleared', () => {
    const state = waves();
    expect(track(state).feed(...killAllAi(state, 'p1'), waveCleared(1))).toContain('surfer');
  });
});

describe('achievements: MADness', () => {
  test('Mutual destruction in single-player', () => {
    const state = los(1);
    const earned = track(state).feed(
      elim('p1', 'ai1', { tick: 300 }),
      elim('ai1', 'p1', { tick: 300 }),
      roundEnded([], 'draw'),
    );
    expect(earned).toContain('madness');
  });

  test('Shared point', () => {
    const state = los(1, 2);
    const feed = trackBoth(state);
    feed(elim('ai1', 'p1', { tick: 100 }));
    const got = feed(
      elim('p1', 'p2', { tick: 300 }),
      elim('p2', 'p1', { tick: 300 }),
      roundEnded(['p1', 'p2']),
    );
    expect(got.p1).toContain('madness');
    expect(got.p2).toContain('madness');
  });

  test('Taking the last one with you in Waves', () => {
    const state = waves();
    const earned = track(state).feed(
      elim('p1', 'ai1', { tick: 300 }),
      elim('ai1', 'p1', { tick: 300 }),
      waveCleared(1),
      wavesEnded(1),
    );
    expect(earned).toContain('madness');
  });

  test('Already gone', () => {
    const state = los(1, 2);
    const feed = trackBoth(state);
    const got = feed(
      elim('p1', 'ai1', { tick: 100 }),
      elim('p2', 'ai1', { tick: 300 }),
      elim('ai1', 'p2', { tick: 300 }),
      roundEnded([], 'draw'),
    );
    expect(got.p2).toContain('madness');
    expect(got.p1).not.toContain('madness');
  });

  test('Someone survived', () => {
    const state = los(2);
    const earned = track(state).feed(
      elim('p1', 'ai1', { tick: 300 }),
      elim('ai1', 'p1', { tick: 300 }),
      roundEnded([], 'ai'),
    );
    expect(earned).not.toContain('madness');
  });
});

describe('achievements: Mudslinger', () => {
  test('Two in the mud', () => {
    expect(track(los(3)).feed(mortarLanded('p1', ['ai1', 'ai2']))).toContain('mudslinger');
  });

  test("Yourself doesn't count", () => {
    expect(track(los(3)).feed(mortarLanded('p1', ['ai1', 'p1']))).not.toContain('mudslinger');
  });

  test("someone else's mortar doesn't count", () => {
    expect(track(los(3)).feed(mortarLanded('ai1', ['ai2', 'ai3']))).not.toContain('mudslinger');
  });
});

describe('achievements: Banked', () => {
  test('Bank-shot kill', () => {
    expect(track(los()).feed(elim('ai1', 'p1', { bankShot: true }))).toContain('banked');
  });

  test('Straight shot', () => {
    expect(track(los()).feed(elim('ai1', 'p1'))).not.toContain('banked');
  });

  test('Not your partner', () => {
    const state = waves(1, 2, true);
    expect(track(state).feed(elim('p2', 'p1', { bankShot: true }))).not.toContain('banked');
  });

  test('Not yourself', () => {
    expect(track(los()).feed(elim('p1', 'p1', { bankShot: true }))).not.toContain('banked');
  });

  test('the other human counts in two-player Last One Standing', () => {
    expect(track(los(1, 2)).feed(elim('p2', 'p1', { bankShot: true }))).toContain('banked');
  });
});

describe('achievements: Perfection', () => {
  test('Untouched', () => {
    const state = los(1);
    expect(track(state).feed(shot('p1'), elim('ai1', 'p1'), roundEnded(['p1']))).toContain('perfection');
  });

  test('One scratch', () => {
    const state = waves();
    state.tanks.find((t) => t.id === 'p1')!.hp = 2;
    const earned = track(state).feed(hit('ai1', 'p1'), ...killAllAi(state, 'p1'), waveCleared(1));
    expect(earned).not.toContain('perfection');
  });

  test('Harmless clang', () => {
    const state = waves(1, 2, false);
    const clang: SimEvent = { type: 'friendlyHit', shooterId: 'p2', targetId: 'p1', shellId: 1, x: 0, y: 0 };
    expect(track(state).feed(clang, ...killAllAi(state, 'p2'), waveCleared(1))).toContain('perfection');
  });

  test('your own bounced shell counts as a hit', () => {
    const state = los(1);
    state.tanks.find((t) => t.id === 'p1')!.hp = 2;
    expect(track(state).feed(hit('p1', 'p1'), elim('ai1', 'p1'), roundEnded(['p1']))).not.toContain(
      'perfection',
    );
  });
});

describe('achievements: Pacifist', () => {
  test('Let them sort it out', () => {
    const state = los(2);
    const earned = track(state).feed(elim('ai1', 'ai2'), elim('ai2', 'ai2'), roundEnded(['p1']));
    expect(earned).toContain('pacifist');
  });

  test('Mud is allowed', () => {
    const state = los(2);
    const launched: SimEvent = {
      type: 'mortarLaunched',
      mortarId: 1,
      tankId: 'p1',
      x: 0,
      y: 0,
      toX: 1,
      toY: 1,
    };
    const earned = track(state).feed(launched, elim('ai1', 'ai2'), elim('ai2', 'ai2'), roundEnded(['p1']));
    expect(earned).toContain('pacifist');
  });

  test('One shot', () => {
    const state = los(1);
    expect(track(state).feed(shot('p1'), elim('ai1', 'ai1'), roundEnded(['p1']))).not.toContain('pacifist');
  });
});

describe('achievements: Stop Hitting Yourself', () => {
  test('They did it to themselves', () => {
    const state = waves(2);
    const earned = track(state).feed(elim('ai1', 'ai2'), elim('ai2', 'ai2'), waveCleared(1));
    expect(earned).toContain('stop-hitting-yourself');
  });

  test('one of yours spoils it', () => {
    const state = waves(2);
    const earned = track(state).feed(elim('ai1', 'p1'), elim('ai2', 'ai2'), waveCleared(1));
    expect(earned).not.toContain('stop-hitting-yourself');
  });

  test('Not with a friend', () => {
    const state = waves(2, 2);
    const earned = track(state).feed(elim('ai1', 'ai2'), elim('ai2', 'ai2'), waveCleared(1));
    expect(earned).not.toContain('stop-hitting-yourself');
  });
});

describe('achievements: playing two-player games to the end', () => {
  test('Last One Standing together', () => {
    const got = trackBoth(los(1, 2))(losEnded('win', 'p2', false, scores({ p1: 0, p2: 3 })));
    expect(got.p1).toContain('with-friends-like-this');
    expect(got.p2).toContain('with-friends-like-this');
  });

  test('Waves with friendly fire', () => {
    const got = trackBoth(waves(1, 2, true))(wavesEnded(2));
    for (const ids of [got.p1, got.p2]) {
      expect(ids).toContain('friends-with-benefits');
      expect(ids).toContain('gluttons-for-punishment');
    }
  });

  test('Waves without friendly fire', () => {
    const got = trackBoth(waves(1, 2, false))(wavesEnded(2));
    for (const ids of [got.p1, got.p2]) {
      expect(ids).toContain('friends-with-benefits');
      expect(ids).not.toContain('gluttons-for-punishment');
    }
  });

  test('The one who stayed', () => {
    expect(track(los(1, 2)).feed({ type: 'left', tankId: 'p2' }, losEnded('win', 'p1', true))).toContain(
      'with-friends-like-this',
    );
  });

  test('The one who left', () => {
    // Once you've left, your client sees no more of the game, so there's no end for it to see.
    expect(track(los(1, 2)).feed({ type: 'left', tankId: 'p1' })).toEqual([]);
  });

  test('not in single-player', () => {
    expect(track(los()).feed(losEnded('loss', null))).not.toContain('with-friends-like-this');
    expect(track(waves()).feed(wavesEnded(2))).not.toContain('friends-with-benefits');
  });
});

describe('achievements: Waves milestones', () => {
  test('Five in one go', () => {
    const { feed } = track(waves());
    expect(feed(waveCleared(4))).not.toContain('ride-the-wave');
    expect(feed(waveCleared(5))).toContain('ride-the-wave');
  });

  test('Inconceivable', () => {
    expect(track(waves()).feed(waveCleared(8))).toContain('inconceivable');
  });

  test('Dream Team', () => {
    const got = trackBoth(waves(1, 2))(waveCleared(9));
    expect(got.p1).toContain('dream-team');
    expect(got.p2).toContain('dream-team');
    expect(trackBoth(waves(1, 2))(waveCleared(8)).p1).not.toContain('dream-team');
  });

  test('Not across games', () => {
    const book = AchievementBook.open(new FakeStorage());
    expect(track(waves(), 'p1', book).feed(waveCleared(3))).not.toContain('ride-the-wave');
    expect(track(waves(), 'p1', book).feed(waveCleared(3))).not.toContain('ride-the-wave');
  });
});

describe('achievements: Completionist', () => {
  test('Progress is kept', () => {
    const storage = new FakeStorage();
    const state = los(1);
    state.board = BUILT_IN_BOARDS.find((b) => b.id === 'pac-tank')!;
    track(state, 'p1', AchievementBook.open(storage)).feed(elim('ai1', 'p1'), roundEnded(['p1']));
    const later = AchievementBook.open(storage);
    expect(later.completedKeys.has('lastOneStanding:pac-tank')).toBe(true);
    expect(completionistProgress(later)).toBe(`1 of ${COMPLETIONIST_KEYS.length} boards done`);
  });

  test('Both modes needed', () => {
    const book = AchievementBook.open(new FakeStorage());
    for (const key of COMPLETIONIST_KEYS) if (key !== 'waves:checkerboard') book.complete(key);
    const state = los(1);
    expect(track(state, 'p1', book).feed(elim('ai1', 'p1'), roundEnded(['p1']))).not.toContain(
      'completionist',
    );
  });

  test('Final board', () => {
    const book = AchievementBook.open(new FakeStorage());
    for (const key of COMPLETIONIST_KEYS) if (key !== 'waves:checkerboard') book.complete(key);
    const state = waves();
    state.board = BUILT_IN_BOARDS.find((b) => b.id === 'checkerboard')!;
    expect(track(state, 'p1', book).feed(...killAllAi(state, 'p1'), waveCleared(1))).toContain(
      'completionist',
    );
  });

  test('there are 14 boards to do: every built-in board in both modes', () => {
    expect(COMPLETIONIST_KEYS).toHaveLength(BUILT_IN_BOARDS.length * 2);
    expect(BUILT_IN_BOARDS).toHaveLength(7);
  });
});

describe('achievements: Why Are You So Obsessed with Me?', () => {
  test('The AI took advantage', () => {
    const got = trackBoth(los(1, 2))(losEnded('draw', null, false, scores({ p1: 1, p2: 1 }, 1)));
    expect(got.p1).toContain('obsessed');
    expect(got.p2).toContain('obsessed');
  });

  test('Somebody won', () => {
    const got = trackBoth(los(1, 2))(losEnded('win', 'p1', false, scores({ p1: 2, p2: 1 }, 2)));
    expect(got.p1).not.toContain('obsessed');
    expect(got.p2).not.toContain('obsessed');
  });

  test('not without an AI round', () => {
    const got = trackBoth(los(1, 2))(losEnded('draw', null, false, scores({ p1: 2, p2: 2 }, 0)));
    expect(got.p1).not.toContain('obsessed');
  });
});

describe('achievements: You Can Take That to the Bank', () => {
  test('Four for four', () => {
    const state = waves(4);
    const { feed } = track(state);
    feed(waveStarted(1, 4));
    expect(feed(...killAllAi(state, 'p1', { bankShot: true }), waveCleared(1))).toContain(
      'take-it-to-the-bank',
    );
  });

  test('Three out of four', () => {
    const state = waves(4);
    const { feed } = track(state);
    feed(waveStarted(1, 4));
    const [a, b, c, d] = state.tanks.filter((t) => t.kind === 'ai').map((t) => t.id);
    const earned = feed(
      elim(a!, 'p1', { bankShot: true }),
      elim(b!, 'p1', { bankShot: true }),
      elim(c!, 'p1', { bankShot: true }),
      elim(d!, 'p1'),
      waveCleared(1),
    );
    expect(earned).not.toContain('take-it-to-the-bank');
    const other = waves(4);
    const second = track(other);
    second.feed(waveStarted(1, 4));
    const [e, f, g, h] = other.tanks.filter((t) => t.kind === 'ai').map((t) => t.id);
    const more = second.feed(
      elim(e!, 'p1', { bankShot: true }),
      elim(f!, 'p1', { bankShot: true }),
      elim(g!, 'p1', { bankShot: true }),
      elim(h!, e!, { bankShot: true }),
      waveCleared(1),
    );
    expect(more).not.toContain('take-it-to-the-bank');
  });

  test('wave 1 with four AI tanks counts from its countdown', () => {
    // Wave 1's start event comes from creating the match, which the tracker never sees.
    const state = waves(4);
    expect(track(state).feed(...killAllAi(state, 'p1', { bankShot: true }), waveCleared(1))).toContain(
      'take-it-to-the-bank',
    );
  });
});

describe('achievements: Unfair Advantage', () => {
  test('Shooting fish in a barrel', () => {
    expect(track(waves()).feed(elim('ai1', 'p1', { slowed: true }))).toContain('unfair-advantage');
  });

  test('Mud has dried', () => {
    expect(track(waves()).feed(elim('ai1', 'p1'))).not.toContain('unfair-advantage');
  });

  test('Not in Last One Standing', () => {
    expect(track(los()).feed(elim('ai1', 'p1', { slowed: true }))).not.toContain('unfair-advantage');
  });

  test("whoever's mortar it was, the kill must be yours", () => {
    expect(track(waves(1, 2)).feed(elim('ai1', 'p2', { slowed: true }))).not.toContain('unfair-advantage');
  });
});

describe('achievements: Close Shave', () => {
  test('Hanging on', () => {
    const state = waves();
    state.tanks.find((t) => t.id === 'p1')!.hp = 1;
    expect(track(state).feed(...killAllAi(state, 'p1'), waveCleared(1))).toContain('close-shave');
  });

  test('Comfortable', () => {
    const state = los(1);
    state.tanks.find((t) => t.id === 'p1')!.hp = 2;
    expect(track(state).feed(elim('ai1', 'p1'), roundEnded(['p1']))).not.toContain('close-shave');
  });
});

describe('achievements: earned once, kept between visits', () => {
  test('Remembered', () => {
    const storage = new FakeStorage();
    track(los(), 'p1', AchievementBook.open(storage)).feed(elim('ai1', 'p1', { bankShot: true }));
    const later = AchievementBook.open(storage);
    expect(later.has('banked')).toBe(true);
    expect(achievementRows(later, true).find((r) => r.id === 'banked')?.earned).toBe(true);
  });

  test('Earned only once', () => {
    const book = AchievementBook.open(new FakeStorage());
    const { feed } = track(los(2), 'p1', book);
    expect(feed(elim('ai1', 'p1', { bankShot: true }))).toEqual(['banked']);
    expect(feed(elim('ai2', 'p1', { bankShot: true }))).toEqual(['banked']);
    expect(track(los(2), 'p1', book).feed(elim('ai1', 'p1', { bankShot: true }))).toEqual([]);
  });

  test('Storage blocked', () => {
    const book = AchievementBook.open(blocked);
    const state = waves();
    expect(track(state, 'p1', book).feed(waveCleared(1))).toContain('surfer');
    expect(book.saving).toBe(false);
    expect(storageNote(book)).toMatch(/forgotten/);
    expect(AchievementBook.open(null).saving).toBe(false);
  });

  test('a storage write that fails is noticed', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const book = AchievementBook.open(storage);
    expect(book.saving).toBe(true);
    expect(book.earn('surfer')).toBe(true);
    expect(book.saving).toBe(false);
    expect(book.has('surfer')).toBe(true);
  });

  test('Damaged storage', () => {
    for (const text of ['not json', 'null', '42', '[]', '{"earned":"nope","completed":7}']) {
      const storage = new FakeStorage();
      storage.setItem(ACHIEVEMENTS_KEY, text);
      const book = AchievementBook.open(storage);
      expect(book.earnedCount).toBe(0);
      expect(book.completedKeys.size).toBe(0);
      expect(book.saving).toBe(true);
    }
  });

  test('ids this version does not know are kept', () => {
    const storage = new FakeStorage();
    storage.setItem(
      ACHIEVEMENTS_KEY,
      JSON.stringify({ v: 1, earned: { 'from-the-future': '2030-01-01T00:00:00.000Z' }, completed: [] }),
    );
    const book = AchievementBook.open(storage);
    book.earn('surfer');
    const saved = JSON.parse(storage.getItem(ACHIEVEMENTS_KEY)!) as { earned: Record<string, string> };
    expect(Object.keys(saved.earned).sort()).toEqual(['from-the-future', 'surfer']);
    expect(book.earnedCount).toBe(1);
  });
});

describe('achievements: rejoining mid-round', () => {
  test('Back from a drop', () => {
    const state = los(2, 2);
    state.phase = 'playing';
    const { feed } = track(state);
    expect(feed(elim('ai1', 'ai2'), elim('ai2', 'ai2'), elim('p2', 'ai2'), roundEnded(['p1']))).not.toContain(
      'pacifist',
    );
    for (const t of state.tanks) {
      t.alive = true;
      t.hp = 3;
    }
    state.phase = 'countdown';
    expect(
      feed(ROUND_STARTED, elim('ai1', 'ai2'), elim('ai2', 'ai2'), elim('p2', 'ai2'), roundEnded(['p1'])),
    ).toContain('pacifist');
  });

  test('Earned, then dropped', () => {
    const storage = new FakeStorage();
    const state = los(2, 2);
    track(state, 'p1', AchievementBook.open(storage)).feed(elim('ai1', 'p1', { bankShot: true }));
    // The connection drops before the round ends, and the page is reloaded: the unannounced Banked is still there.
    const reloaded = AchievementBook.open(storage);
    expect(achievementRows(reloaded, true).find((r) => r.id === 'banked')?.earned).toBe(true);
  });

  test('achievements that need only the moment still count', () => {
    const state = waves();
    state.phase = 'playing';
    expect(track(state).feed(elim('ai1', 'p1', { bankShot: true }))).toContain('banked');
  });
});

describe('achievements: after a stall online', () => {
  // A long stall makes playback jump: a round's end can arrive with the next round's state already in place.
  test('a wave cleared, seen only once the next wave is under way, still counts for Surfer but nothing that reads the state', () => {
    const state = waves();
    const { feed, book } = track(state);
    state.tanks.find((t) => t.id === 'p1')!.hp = 1;
    state.round = 2; // the next wave has started
    state.board = BUILT_IN_BOARDS.find((b) => b.id === 'checkerboard')!;
    const earned = feed(...killAllAi(state, 'p1'), waveCleared(1));
    expect(earned).toContain('surfer');
    for (const id of ['perfection', 'close-shave', 'stop-hitting-yourself']) expect(earned).not.toContain(id);
    // Nor does the next wave's board get the credit.
    expect(book.completedKeys.size).toBe(0);
  });

  test('a round won, seen only once the next round is under way, counts for nothing that reads the state', () => {
    const state = los(1);
    const { feed, book } = track(state);
    state.round = 2;
    for (const t of state.tanks) t.alive = true; // everyone's back for the next round
    const earned = feed({
      type: 'roundEnded',
      round: 1,
      outcome: 'human',
      scorers: ['p1'],
      scores: scores({ p1: 1 }),
    });
    expect(earned).toEqual([]);
    expect(book.completedKeys.size).toBe(0);
  });

  test('no MADness from a stale state', () => {
    const state = los(1);
    const { feed } = track(state);
    feed(elim('p1', 'ai1', { tick: 300 }), elim('ai1', 'p1', { tick: 300 }));
    state.round = 2;
    expect(
      feed({ type: 'roundEnded', round: 1, outcome: 'draw', scorers: [], scores: scores({ p1: 0 }) }),
    ).toEqual([]);
  });
});

describe('achievements: announcing unlocks', () => {
  const banked = achievementById('banked')!;
  const surfer = achievementById('surfer')!;

  test('Earned mid-round', () => {
    const queue = new UnlockQueue();
    queue.add([banked]);
    expect(queue.release('playing')).toEqual([]);
    expect(queue.release('countdown')).toEqual([]);
    expect(queue.release('roundOver')).toEqual([banked]);
    expect(queue.release('roundOver')).toEqual([]);
  });

  test('Earned in the last round', () => {
    const queue = new UnlockQueue();
    queue.add([achievementById('close-shave')!]);
    queue.add([achievementById('last-one-standing')!]);
    expect(queue.release('gameOver').map((a) => a.id)).toEqual(['close-shave', 'last-one-standing']);
  });

  test('Several at once', () => {
    const state = waves();
    state.tanks.find((t) => t.id === 'p1')!.hp = 1;
    const queue = new UnlockQueue();
    const tracker = new AchievementTracker(AchievementBook.open(new FakeStorage()), 'p1', state);
    for (const e of [...killAllAi(state, 'p1'), waveCleared(1)]) {
      for (const t of state.tanks) if (e.type === 'eliminated' && t.id === e.tankId) t.alive = false;
      queue.add(tracker.onEvent(state, e));
    }
    expect(queue.release('roundOver').map((a) => a.id)).toEqual(['surfer', 'perfection', 'close-shave']);
    queue.add([surfer]);
    queue.clear();
    expect(queue.release('gameOver')).toEqual([]);
  });
});

describe('achievements: the Achievements screen', () => {
  test('Locked ones greyed', () => {
    const book = AchievementBook.open(new FakeStorage());
    book.earn('surfer');
    const rows = achievementRows(book, true);
    expect(rows.filter((r) => r.earned).map((r) => r.id)).toEqual(['surfer']);
    expect(rows.filter((r) => !r.earned)).toHaveLength(19);
    expect(rows.every((r) => r.description.length > 0)).toBe(true);
    expect(achievementsButtonLabel(book)).toBe('Achievements 1 / 20');
  });

  test('No server', () => {
    const rows = achievementRows(AchievementBook.open(new FakeStorage()), false);
    const marked = rows.filter((r) => r.note.startsWith('Needs online play')).map((r) => r.id);
    expect(marked).toEqual(ACHIEVEMENTS.filter((a) => a.where === 'two').map((a) => a.id));
    expect(marked).toHaveLength(5);
    const withServer = achievementRows(AchievementBook.open(new FakeStorage()), true);
    expect(withServer.some((r) => r.note.startsWith('Needs online play'))).toBe(false);
  });

  test("Completionist shows its progress until it's earned", () => {
    const book = AchievementBook.open(new FakeStorage());
    book.complete('waves:pac-tank');
    expect(achievementRows(book, true).find((r) => r.id === 'completionist')?.note).toBe(
      '1 of 14 boards done',
    );
    book.earn('completionist');
    expect(achievementRows(book, true).find((r) => r.id === 'completionist')?.note).toBe('');
  });

  test('the storage note says where they are kept', () => {
    expect(storageNote(AchievementBook.open(new FakeStorage()))).toMatch(/kept in this browser/);
  });
});

describe('achievements: with the real simulation', () => {
  const R = DEFAULT_CONFIG.tankRadius;
  const WALLED: Board = {
    id: 'test',
    name: 'Test',
    width: 800,
    height: 600,
    obstacles: [{ x: 400, y: 0, w: 20, h: 600 }],
    spawns: [
      { x: 60, y: 60, heading: 0 },
      { x: 740, y: 60, heading: Math.PI },
      { x: 60, y: 540, heading: 0 },
      { x: 740, y: 540, heading: Math.PI },
      { x: 200, y: 540, heading: 0 },
    ],
  };

  /** A match on the walled test board, a tracker for p1, and a way to step it with the earned ids collected. */
  function simulate(options: MatchOptions): { state: MatchState; run: (ticks: number) => string[] } {
    const state = createMatch(options, 1, DEFAULT_CONFIG, [WALLED]);
    const tracker = new AchievementTracker(AchievementBook.open(new FakeStorage()), 'p1', state);
    const earned: string[] = [];
    const run = (ticks: number): string[] => {
      for (let i = 0; i < ticks && state.phase !== 'gameOver'; i++) {
        for (const e of step(state, {})) earned.push(...tracker.onEvent(state, e).map((a) => a.id));
      }
      return earned;
    };
    while (state.phase === 'countdown') run(1);
    return { state, run };
  }

  /** Puts a shell of p1's just short of the wall, heading for it, with `target` waiting behind. */
  function bankShotAt(state: MatchState, target: string): void {
    const p1 = state.tanks.find((t) => t.id === 'p1')!;
    p1.x = 100;
    p1.y = 100;
    const t = state.tanks.find((x) => x.id === target)!;
    t.x = 380 - 3 * R;
    t.y = 300;
    t.hp = 1;
    state.shells.push({
      id: state.nextShellId++,
      ownerId: 'p1',
      x: 395 - R,
      y: 300,
      vx: DEFAULT_CONFIG.shellSpeed,
      vy: 0,
      speed: DEFAULT_CONFIG.shellSpeed,
      damage: 1,
      bounces: 0,
      ticksLeft: 100,
    });
  }

  test('a real bank shot earns Banked', () => {
    const { state, run } = simulate({
      mode: 'lastOneStanding',
      aiCount: 1,
      rounds: 3,
      mortars: false,
      maps: { kind: 'sequence', ids: ['test'] },
    });
    bankShotAt(state, 'ai1');
    const earned = run(20);
    expect(state.tanks.find((t) => t.id === 'ai1')?.alive).toBe(false);
    expect(earned).toContain('banked');
  });

  test('a real bank shot into a bogged-down AI tank in Waves earns Unfair Advantage too', () => {
    const { state, run } = simulate({
      mode: 'waves',
      startAiCount: 1,
      mortars: true,
      maps: { kind: 'sequence', ids: ['test'] },
    });
    bankShotAt(state, 'ai1');
    state.tanks.find((t) => t.id === 'ai1')!.slowTicks = 200;
    const earned = run(20);
    expect(earned).toEqual(expect.arrayContaining(['banked', 'unfair-advantage']));
  });

  test('an AI tank that finishes itself clears the wave for a pacifist', () => {
    const { state, run } = simulate({
      mode: 'waves',
      startAiCount: 1,
      mortars: false,
      maps: { kind: 'sequence', ids: ['test'] },
    });
    // Its own shell, as far as the simulation's credit goes: nobody hit it, so it's down to itself.
    state.tanks.find((t) => t.id === 'ai1')!.hp = 0;
    const earned = run(1);
    expect(state.phase).toBe('roundOver');
    expect(earned).toEqual(['surfer', 'perfection', 'stop-hitting-yourself']);
  });

  test('the same moments seen through online snapshots earn the same', () => {
    // Online, the events of several ticks arrive together, with the state as it is afterwards.
    const { state, run } = simulate({
      mode: 'lastOneStanding',
      aiCount: 1,
      rounds: 3,
      mortars: false,
      maps: { kind: 'sequence', ids: ['test'] },
    });
    const events: SimEvent[] = [];
    bankShotAt(state, 'ai1');
    for (let i = 0; i < 20; i++) events.push(...step(state, {}));
    run(0);
    const tracker = new AchievementTracker(AchievementBook.open(new FakeStorage()), 'p1', {
      ...state,
      phase: 'countdown',
    });
    const earned = events.flatMap((e) => tracker.onEvent(state, e).map((a) => a.id));
    expect(earned).toEqual(expect.arrayContaining(['banked', 'perfection']));
  });
});
