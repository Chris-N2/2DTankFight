import {
  BUILT_IN_BOARDS,
  type GameMode,
  type MatchState,
  type Phase,
  type SimEvent,
  type TankState,
} from '@tank/sim';
import type { StorageLike } from './best';

// Achievements: the list, the tracker that spots them in a game's events, and the book that remembers them in this
// browser. Each player earns their own, from the game as their own client sees it, so local and online games take
// the same path. Pure: the page wires it up in main.ts.

/** Which games can earn an achievement: any, single-player only, or two-player (online) only. */
export type Where = 'any' | 'single' | 'two';

/** What the tracker knows about the round or wave in progress, from your point of view. */
export interface RoundFacts {
  /**
   * Whether these facts were collected from the round's start. They aren't after a rejoin mid-round, when some of
   * it went by unseen.
   */
  complete: boolean;
  /** Shells you fired. Mortars don't count. */
  shotsFired: number;
  /** Shells that hit you and did damage. */
  hitsTaken: number;
  /** Opponents you destroyed. */
  kills: number;
  /** Opponents you destroyed with bank shots. */
  bankKills: number;
  /** The AI tanks in this wave; 0 in Last One Standing. */
  aiCount: number;
  /** The tick you were destroyed on, or null while you're in play. */
  yourEliminationTick: number | null;
  /** The latest tick any tank was destroyed on, or null if none has been. */
  lastEliminationTick: number | null;
}

/** One event, with everything an achievement's check might want to know about it. */
export interface Moment {
  event: SimEvent;
  /** The match as it is after the event (online, as at the snapshot the event arrived with). */
  state: MatchState;
  /** Your tank's id. */
  viewer: string;
  mode: GameMode;
  /** The game started with two humans, even if one has since left. */
  twoPlayer: boolean;
  facts: RoundFacts;
  /**
   * The state has already moved on to a later round than the event is about. Online, a long stall makes playback
   * jump ahead, so a round's end can arrive with the next round's state. Checks that read the state then can't
   * trust it, and are skipped: better to miss an achievement than award the wrong one.
   */
  stale: boolean;
  /** A Last One Standing round has just ended with you as its only scorer, still in play. */
  wonRound: boolean;
  /** A wave has just been cleared with you still in play. */
  clearedWave: boolean;
  /** Completionist progress, including this moment. */
  completed: ReadonlySet<string>;
}

export interface Achievement {
  /** Stable kebab-case id: the storage key. Never rename one, or players lose it. */
  id: string;
  name: string;
  /** What earns it, as shown to players. */
  description: string;
  where: Where;
  /** Depends on the whole round having been seen (see {@link RoundFacts.complete}). */
  needsCompleteRound?: boolean;
  /** Whether this moment earns it. Where, completeness and "already earned" are checked before this is called. */
  earned(m: Moment): boolean;
}

const MODES: readonly GameMode[] = ['lastOneStanding', 'waves'];

/** Completionist's checklist: every built-in board in both modes, as `mode:board-id`. */
export const COMPLETIONIST_KEYS: readonly string[] = MODES.flatMap((mode) =>
  BUILT_IN_BOARDS.map((board) => completionKey(mode, board.id)),
);

export function completionKey(mode: GameMode, boardId: string): string {
  return `${mode}:${boardId}`;
}

/** Won a round or cleared a wave: the "win" the round-based achievements ask for, in either mode. */
function won(m: Moment): boolean {
  return m.wonRound || m.clearedWave;
}

function tankOf(state: MatchState, id: string): TankState | undefined {
  return state.tanks.find((t) => t.id === id);
}

/** Your opponents: every other tank in Last One Standing, the AI tanks in Waves. */
function isOpponent(m: Moment, id: string): boolean {
  if (id === m.viewer) return false;
  return m.mode === 'lastOneStanding' || tankOf(m.state, id)?.kind === 'ai';
}

/** The round or wave ended with nobody left, and you went down in its final tick. */
function mutuallyDestroyed(m: Moment): boolean {
  const { yourEliminationTick, lastEliminationTick } = m.facts;
  return (
    !m.stale &&
    yourEliminationTick !== null &&
    yourEliminationTick === lastEliminationTick &&
    !m.state.tanks.some((t) => t.alive)
  );
}

function wavesCleared(m: Moment, target: number): boolean {
  return m.event.type === 'waveCleared' && m.event.cleared >= target;
}

/** Every achievement, in the order the Achievements screen lists them. */
export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'taunted',
    name: 'Taunted',
    description: 'Be destroyed in Waves before clearing a single wave.',
    where: 'any',
    earned: (m) => m.event.type === 'gameEnded' && m.event.result === 'over' && m.event.wavesCleared === 0,
  },
  {
    id: 'last-one-standing',
    name: 'Last One Standing',
    description: 'Win a game of Last One Standing. Forfeits don’t count.',
    where: 'any',
    earned: (m) =>
      m.event.type === 'gameEnded' &&
      m.event.result === 'win' &&
      m.event.winnerId === m.viewer &&
      !m.event.forfeit,
  },
  {
    id: 'surfer',
    name: 'Surfer',
    description: 'Clear a wave in Waves.',
    where: 'any',
    earned: (m) => m.event.type === 'waveCleared',
  },
  {
    id: 'madness',
    name: 'MADness',
    description: 'Go down in the same instant as the last of your opponents. Mutually assured destruction.',
    where: 'any',
    earned: (m) =>
      (m.event.type === 'roundEnded' || (m.event.type === 'gameEnded' && m.event.result === 'over')) &&
      mutuallyDestroyed(m),
  },
  {
    id: 'mudslinger',
    name: 'Mudslinger',
    description: 'Bog down two or more other tanks with a single mortar.',
    where: 'any',
    earned: (m) =>
      m.event.type === 'mortarLanded' &&
      m.event.ownerId === m.viewer &&
      m.event.slowedIds.filter((id) => id !== m.viewer).length >= 2,
  },
  {
    id: 'banked',
    name: 'Banked',
    description: 'Destroy an enemy with a bank shot.',
    where: 'any',
    earned: (m) =>
      m.event.type === 'eliminated' &&
      m.event.byId === m.viewer &&
      m.event.bankShot === true &&
      isOpponent(m, m.event.tankId),
  },
  {
    id: 'perfection',
    name: 'Perfection',
    description: 'Win a round, or clear a wave, without being hit by a single shell.',
    where: 'any',
    needsCompleteRound: true,
    earned: (m) => won(m) && m.facts.hitsTaken === 0,
  },
  {
    id: 'pacifist',
    name: 'Pacifist',
    description: 'Win a round of Last One Standing without firing a shell. Mud is allowed.',
    where: 'any',
    needsCompleteRound: true,
    earned: (m) => m.wonRound && m.facts.shotsFired === 0,
  },
  {
    id: 'stop-hitting-yourself',
    name: 'Stop Hitting Yourself',
    description:
      'Clear a wave of single-player Waves without firing a shell. Every last tank has to go by AI fire.',
    where: 'single',
    needsCompleteRound: true,
    earned: (m) => m.clearedWave && m.facts.shotsFired === 0 && m.facts.kills === 0,
  },
  {
    id: 'with-friends-like-this',
    name: 'With Friends Like This…',
    description: 'Play a two-player game of Last One Standing to the end.',
    where: 'two',
    earned: (m) => m.event.type === 'gameEnded' && m.mode === 'lastOneStanding',
  },
  {
    id: 'friends-with-benefits',
    name: 'Friends with Benefits',
    description: 'Play a two-player game of Waves to the end.',
    where: 'two',
    earned: (m) => m.event.type === 'gameEnded' && m.mode === 'waves',
  },
  {
    id: 'ride-the-wave',
    name: 'Ride the Wave',
    description: 'Clear 5 waves in one game of single-player Waves.',
    where: 'single',
    earned: (m) => wavesCleared(m, 5),
  },
  {
    id: 'completionist',
    name: 'Completionist',
    description: 'Win a round of Last One Standing and clear a wave of Waves on every board.',
    where: 'any',
    earned: (m) => won(m) && COMPLETIONIST_KEYS.every((key) => m.completed.has(key)),
  },
  {
    id: 'obsessed',
    name: 'Why Are You So Obsessed with Me?',
    description: 'Draw a two-player game of Last One Standing in which the AI won at least one round.',
    where: 'two',
    earned: (m) =>
      m.event.type === 'gameEnded' && m.event.result === 'draw' && !m.event.forfeit && m.event.scores.ai >= 1,
  },
  {
    id: 'take-it-to-the-bank',
    name: 'You Can Take That to the Bank',
    description: 'In single-player Waves, destroy all four AI tanks of a wave with bank shots.',
    where: 'single',
    needsCompleteRound: true,
    earned: (m) => m.event.type === 'waveCleared' && m.facts.aiCount === 4 && m.facts.bankKills === 4,
  },
  {
    id: 'inconceivable',
    name: 'Inconceivable!',
    description: 'Clear 8 waves in one game of single-player Waves.',
    where: 'single',
    earned: (m) => wavesCleared(m, 8),
  },
  {
    id: 'dream-team',
    name: 'Dream Team',
    description: 'Clear 9 waves in one two-player game of Waves.',
    where: 'two',
    earned: (m) => wavesCleared(m, 9),
  },
  {
    id: 'gluttons-for-punishment',
    name: 'Gluttons for Punishment',
    description: 'Play a two-player game of Waves to the end with friendly fire on.',
    where: 'two',
    earned: (m) =>
      m.event.type === 'gameEnded' &&
      m.state.options.mode === 'waves' &&
      m.state.options.friendlyFire === true,
  },
  {
    id: 'unfair-advantage',
    name: 'Unfair Advantage',
    description: 'In Waves, destroy an AI tank while mud has jammed its turret.',
    where: 'any',
    earned: (m) =>
      m.mode === 'waves' &&
      m.event.type === 'eliminated' &&
      m.event.byId === m.viewer &&
      m.event.slowed === true &&
      tankOf(m.state, m.event.tankId)?.kind === 'ai',
  },
  {
    id: 'close-shave',
    name: 'Close Shave',
    description: 'Win a round, or clear a wave, with 1 armour left.',
    where: 'any',
    earned: (m) => won(m) && tankOf(m.state, m.viewer)?.hp === 1,
  },
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function achievementById(id: string): Achievement | undefined {
  return BY_ID.get(id);
}

/** Where everything is kept, as one JSON value. */
export const ACHIEVEMENTS_KEY = 'tank-command.achievements';

interface Stored {
  v: 1;
  /** Earned achievement ids, with when (an ISO date). Ids this version doesn't know are kept. */
  earned: Record<string, string>;
  /** Completionist progress: `mode:board-id` for each board won on. */
  completed: string[];
}

/**
 * The achievements earned in this browser, and Completionist's progress. Every change is saved at once. If storage
 * is blocked or broken, the book works for this visit only and {@link saving} is false.
 */
export class AchievementBook {
  private earned: Record<string, string>;
  private completed: Set<string>;
  private storageWorks: boolean;

  private constructor(
    private readonly storage: StorageLike | null,
    stored: Stored,
    storageWorks: boolean,
  ) {
    this.earned = stored.earned;
    this.completed = new Set(stored.completed);
    this.storageWorks = storageWorks;
  }

  static open(storage: StorageLike | null): AchievementBook {
    if (!storage) return new AchievementBook(null, empty(), false);
    try {
      return new AchievementBook(storage, parse(storage.getItem(ACHIEVEMENTS_KEY)), true);
    } catch {
      return new AchievementBook(null, empty(), false);
    }
  }

  /** Whether achievements are being kept in this browser. */
  get saving(): boolean {
    return this.storageWorks;
  }

  has(id: string): boolean {
    return id in this.earned;
  }

  /** How many of the current achievements have been earned. */
  get earnedCount(): number {
    return ACHIEVEMENTS.filter((a) => this.has(a.id)).length;
  }

  /** Records an achievement; false if it was already earned. */
  earn(id: string, now: Date = new Date()): boolean {
    if (this.has(id)) return false;
    this.earned[id] = now.toISOString();
    this.save();
    return true;
  }

  /** Adds a board to Completionist's progress. */
  complete(key: string): void {
    if (this.completed.has(key)) return;
    this.completed.add(key);
    this.save();
  }

  get completedKeys(): ReadonlySet<string> {
    return this.completed;
  }

  private save(): void {
    if (!this.storage || !this.storageWorks) return;
    const stored: Stored = { v: 1, earned: this.earned, completed: [...this.completed] };
    try {
      this.storage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(stored));
    } catch {
      this.storageWorks = false;
    }
  }
}

function empty(): Stored {
  return { v: 1, earned: {}, completed: [] };
}

/** Whatever is stored, as far as it makes sense; anything else is treated as nothing earned. */
function parse(text: string | null): Stored {
  if (text === null) return empty();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return empty();
  }
  if (typeof raw !== 'object' || raw === null) return empty();
  const { earned, completed } = raw as Partial<Record<keyof Stored, unknown>>;
  const result = empty();
  if (typeof earned === 'object' && earned !== null && !Array.isArray(earned)) {
    for (const [id, when] of Object.entries(earned)) {
      if (typeof when === 'string') result.earned[id] = when;
    }
  }
  if (Array.isArray(completed))
    result.completed = completed.filter((k): k is string => typeof k === 'string');
  return result;
}

function freshFacts(complete: boolean, aiCount = 0): RoundFacts {
  return {
    complete,
    shotsFired: 0,
    hitsTaken: 0,
    kills: 0,
    bankKills: 0,
    aiCount,
    yourEliminationTick: null,
    lastEliminationTick: null,
  };
}

/**
 * Spots achievements in one game's events, for the player in seat `viewer`. Make one per game, and one again after
 * rejoining a game: `first` is the first state seen, and the round in progress only counts in full if it was seen
 * from its countdown. With `eligible` false (a game against the test bot) nothing is earned.
 */
export class AchievementTracker {
  private facts: RoundFacts;

  constructor(
    private readonly book: AchievementBook,
    private readonly viewer: string,
    first: MatchState,
    private readonly eligible = true,
  ) {
    const aiCount = first.options.mode === 'waves' ? first.tanks.filter((t) => t.kind === 'ai').length : 0;
    this.facts = freshFacts(first.phase === 'countdown', aiCount);
  }

  /** Takes one event, in order, and returns the achievements it earned (already recorded in the book). */
  onEvent(state: MatchState, event: SimEvent): Achievement[] {
    if (!this.eligible) return [];
    this.note(state, event);
    const viewer = this.viewer;
    const you = tankOf(state, viewer);
    const stale =
      (event.type === 'roundEnded' && state.round !== event.round) ||
      (event.type === 'waveCleared' && state.round !== event.wave);
    const wonRound =
      !stale &&
      event.type === 'roundEnded' &&
      event.scorers.length === 1 &&
      event.scorers[0] === viewer &&
      you?.alive === true;
    const clearedWave = !stale && event.type === 'waveCleared' && you?.alive === true;
    if (wonRound || clearedWave) this.book.complete(completionKey(state.options.mode, state.board.id));

    const twoPlayer = (state.options.humans ?? 1) === 2;
    const moment: Moment = {
      event,
      state,
      viewer,
      mode: state.options.mode,
      twoPlayer,
      facts: this.facts,
      stale,
      wonRound,
      clearedWave,
      completed: this.book.completedKeys,
    };
    const earned: Achievement[] = [];
    for (const a of ACHIEVEMENTS) {
      if (this.book.has(a.id)) continue;
      if ((a.where === 'single' && twoPlayer) || (a.where === 'two' && !twoPlayer)) continue;
      if (a.needsCompleteRound && !this.facts.complete) continue;
      if (a.earned(moment) && this.book.earn(a.id)) earned.push(a);
    }
    return earned;
  }

  /** Updates the round's facts with an event. */
  private note(state: MatchState, event: SimEvent): void {
    const facts = this.facts;
    switch (event.type) {
      case 'roundStarted':
        this.facts = freshFacts(true);
        break;
      case 'waveStarted':
        this.facts = freshFacts(true, event.aiCount);
        break;
      case 'shotFired':
        if (event.tankId === this.viewer) facts.shotsFired++;
        break;
      case 'hit':
        if (event.targetId === this.viewer) facts.hitsTaken++;
        break;
      case 'eliminated': {
        // Old servers don't send the tick: then nobody's elimination can be matched to the final one.
        const tick = typeof event.tick === 'number' ? event.tick : null;
        if (tick !== null) facts.lastEliminationTick = Math.max(facts.lastEliminationTick ?? tick, tick);
        if (event.tankId === this.viewer) facts.yourEliminationTick = tick;
        const opponent =
          event.tankId !== this.viewer &&
          (state.options.mode === 'lastOneStanding' || tankOf(state, event.tankId)?.kind === 'ai');
        if (event.byId === this.viewer && opponent) {
          facts.kills++;
          if (event.bankShot === true) facts.bankKills++;
        }
        break;
      }
      default:
        break;
    }
  }
}

/** One line of the Achievements screen. */
export interface AchievementRow {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  /** A note under the description, or empty: Completionist's progress, or that it needs online play. */
  note: string;
}

/** The Achievements screen's list. `hasServer` is whether this site has a game server for online play. */
export function achievementRows(book: AchievementBook, hasServer: boolean): AchievementRow[] {
  return ACHIEVEMENTS.map((a) => {
    const earned = book.has(a.id);
    let note = '';
    if (!earned && a.where === 'two' && !hasServer) note = 'Needs online play, which this site doesn’t offer';
    else if (!earned && a.id === 'completionist') note = completionistProgress(book);
    return { id: a.id, name: a.name, description: a.description, earned, note };
  });
}

/** Completionist's progress, e.g. "9 of 14 boards done". */
export function completionistProgress(book: AchievementBook): string {
  const done = COMPLETIONIST_KEYS.filter((key) => book.completedKeys.has(key)).length;
  return `${done} of ${COMPLETIONIST_KEYS.length} boards done`;
}

/** The setup screen's button, e.g. "Achievements 3 / 20". */
export function achievementsButtonLabel(book: AchievementBook): string {
  return `Achievements ${book.earnedCount} / ${ACHIEVEMENTS.length}`;
}

/** The note at the foot of the Achievements screen. */
export function storageNote(book: AchievementBook): string {
  return book.saving
    ? 'Achievements are kept in this browser. Clearing its data for this site clears them too.'
    : 'This browser isn’t letting the game save anything, so achievements will be forgotten when you leave.';
}

/** How an unlock is announced: name, then what earned it. */
export function unlockLine(a: Achievement): { name: string; description: string } {
  return { name: `Achievement: ${a.name}`, description: a.description };
}

/**
 * Unlocks waiting to be announced. Nothing is shown during play: what's been earned waits for the pause after the
 * round or wave, or for the result screen.
 */
export class UnlockQueue {
  private pending: Achievement[] = [];

  add(earned: readonly Achievement[]): void {
    this.pending.push(...earned);
  }

  /** Everything waiting, if it can be shown in this phase (and it is then no longer waiting); otherwise nothing. */
  release(phase: Phase): Achievement[] {
    if (phase !== 'roundOver' && phase !== 'gameOver') return [];
    const out = this.pending;
    this.pending = [];
    return out;
  }

  clear(): void {
    this.pending = [];
  }
}
