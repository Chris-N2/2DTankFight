import {
  BUILT_IN_BOARDS,
  HUMAN_ID,
  SEQUENCE_MAX,
  type GameMode,
  type LastOneStandingResult,
  type MatchOptions,
  type MatchState,
  type RoundOutcome,
  type Scores,
  type WaveChange,
} from '@tank/sim';
import type { BestResult } from './best';

// Pure text decisions for the overlays, kept apart from the DOM so they're easy to test.

/** Everything the setup screen remembers, for both modes, so switching mode back and forth loses nothing. */
export interface SetupChoices {
  mode: GameMode;
  aiCount: number;
  rounds: number;
  startAiCount: number;
  /** Off is classic play. */
  mortars: boolean;
  maps: MapMode;
  /** Board ids in the order they'll be played, when `maps` is `sequence`. Kept while Random is chosen, too. */
  sequence: string[];
  /** Whether one human's shells can hurt the other: online Waves only. */
  friendlyFire: boolean;
}

export type MapMode = 'random' | 'sequence';

export const DEFAULT_CHOICES: Readonly<SetupChoices> = {
  mode: 'lastOneStanding',
  aiCount: 3,
  rounds: 5,
  startAiCount: 1,
  mortars: true,
  maps: 'random',
  sequence: [],
  friendlyFire: false,
};

/** The match options for the setup screen's choices: the selected mode's options, plus mortars and maps. */
export function matchOptionsFor(choices: SetupChoices): MatchOptions {
  const { mode, aiCount, rounds, startAiCount, mortars } = choices;
  const maps: MatchOptions['maps'] =
    choices.maps === 'sequence' ? { kind: 'sequence', ids: [...choices.sequence] } : { kind: 'random' };
  return mode === 'waves' ? { mode, startAiCount, mortars, maps } : { mode, aiCount, rounds, mortars, maps };
}

/** The most maps the sequence can hold with these choices: 7, or fewer if Last One Standing has fewer rounds. */
export function sequenceLimitFor(choices: SetupChoices): number {
  return choices.mode === 'lastOneStanding' ? Math.min(SEQUENCE_MAX, choices.rounds) : SEQUENCE_MAX;
}

/** Adds a board to the end of the sequence, unless it's full. Returns whether it was added. */
export function addToSequence(choices: SetupChoices, id: string): boolean {
  if (choices.sequence.length >= sequenceLimitFor(choices)) return false;
  choices.sequence.push(id);
  return true;
}

/** Removes the sequence's entry at `index`. */
export function removeFromSequence(choices: SetupChoices, index: number): void {
  choices.sequence.splice(index, 1);
}

/**
 * Shortens the sequence from its end to fit the current limit. Called whenever the limit may have dropped (fewer
 * rounds, or a switch to Last One Standing), so a sequence that can't be played is never left on screen.
 */
export function fitSequence(choices: SetupChoices): void {
  choices.sequence.length = Math.min(choices.sequence.length, sequenceLimitFor(choices));
}

/** Why the setup screen's choices can't start a game, or null if they can. */
export function setupProblem(choices: SetupChoices): string | null {
  return choices.maps === 'sequence' && choices.sequence.length === 0
    ? 'Pick at least one map for the sequence, or choose Random.'
    : null;
}

/** The sequence's count against its limit, e.g. "3 / 5", and whether it's full. */
export function sequenceCount(choices: SetupChoices): { text: string; full: boolean } {
  const limit = sequenceLimitFor(choices);
  return { text: `${choices.sequence.length} / ${limit}`, full: choices.sequence.length >= limit };
}

/** A built-in board's display name, or its id if it isn't one. */
export function boardName(id: string): string {
  return BUILT_IN_BOARDS.find((b) => b.id === id)?.name ?? id;
}

export interface BannerText {
  title: string;
  sub: string;
}

export interface GameOverText {
  title: string;
  score: string;
  /** Empty when there's nothing to say, e.g. the best score couldn't be stored. */
  best: string;
  quip: string;
}

/**
 * The score from the point of view of the player in seat `viewer`: against the AI in single-player, and against the
 * other human when there are two ("You N – M Them"), since the AI's rounds score for nobody.
 */
export function scoreLine(scores: Scores, viewer: string = HUMAN_ID): string {
  const mine = scores.humans[viewer] ?? 0;
  const others = Object.keys(scores.humans).filter((id) => id !== viewer);
  if (others.length === 0) return `You ${mine} – ${scores.ai} AI`;
  return `You ${mine} – ${scores.humans[others[0]!] ?? 0} Them`;
}

const ROUND_TITLES: Record<RoundOutcome, string> = {
  human: 'Round won!',
  ai: 'Round lost',
  draw: 'Mutual destruction!',
};

/** How a two-human round went, for the player in seat `viewer`. */
function twoPlayerRoundTitle(state: MatchState, viewer: string): string {
  const scorers = state.lastRoundScorers;
  switch (state.lastRoundOutcome) {
    case 'human':
      if (scorers.length > 1) return 'Point shared!';
      return scorers.includes(viewer) ? 'Round won!' : 'They took the round';
    case 'ai':
      return 'The AI took the round';
    default:
      return 'Nobody scored';
  }
}

/** How each escalation step is announced in the countdown banner. */
const CHANGE_TEXT: Record<WaveChange, string> = {
  thinnerArmour: 'More tanks, thinner armour',
  armour: 'AI armour up',
  damage: 'AI hits harder',
  lethal: 'One hit is lethal!',
  speed: 'AI shells faster',
};

/**
 * What the centre banner should say right now, or null for nothing.
 * `showGo` is true briefly after play starts; `selfInflicted` is true if the human's own shell finished them off.
 * `changes` are the escalation steps the current wave applied (Waves only). `viewer` is the seat of the player
 * looking at the screen.
 */
export function bannerFor(
  state: MatchState,
  showGo: boolean,
  selfInflicted: boolean,
  changes: readonly WaveChange[] = [],
  viewer: string = HUMAN_ID,
): BannerText | null {
  const waves = state.options.mode === 'waves';
  switch (state.phase) {
    case 'countdown':
      // The countdown names the board: it has just changed under the player, and playtesters like to know.
      return {
        title: String(Math.max(1, Math.ceil(state.phaseTicks / state.config.tickRate))),
        sub: waves
          ? [`Wave ${state.round}`, state.board.name, ...changes.map((c) => CHANGE_TEXT[c])].join(' · ')
          : `Round ${state.round} of ${roundsOf(state)} · ${state.board.name}`,
      };
    case 'playing':
      return showGo ? { title: 'GO!', sub: '' } : null;
    case 'roundOver': {
      if (waves) return { title: `Wave ${state.round} cleared!`, sub: `Wave ${state.round + 1} incoming…` };
      const outcome = state.lastRoundOutcome ?? 'draw';
      if (Object.keys(state.scores.humans).length > 1) {
        const quip =
          selfInflicted && !state.lastRoundScorers.includes(viewer) ? ' · Hoisted by your own shell!' : '';
        return { title: twoPlayerRoundTitle(state, viewer), sub: scoreLine(state.scores, viewer) + quip };
      }
      const quip = outcome === 'ai' && selfInflicted ? ' · Hoisted by your own shell!' : '';
      return { title: ROUND_TITLES[outcome], sub: scoreLine(state.scores) + quip };
    }
    case 'gameOver':
      return null;
  }
}

export function gameOverText(result: LastOneStandingResult, scores: Scores): GameOverText {
  const titles: Record<LastOneStandingResult, [string, string]> = {
    win: ['Victory!', 'The last tank standing is yours.'],
    loss: ['Defeat', 'The machines win this time. Rematch?'],
    draw: ['A draw', "Honours even. Nobody's quite sure how."],
  };
  const [title, quip] = titles[result];
  return { title, score: scoreLine(scores), best: '', quip };
}

/**
 * The Waves result screen. `best` is the best on this device after this game, or null if it couldn't be
 * stored, in which case the best line is left out.
 */
export function wavesGameOverText(
  wave: number,
  cleared: number,
  best: BestResult | null,
  selfInflicted: boolean,
): GameOverText {
  return {
    title: `Destroyed on wave ${wave}`,
    score: cleared === 1 ? '1 wave cleared' : `${cleared} waves cleared`,
    best: best === null ? '' : best.isNew ? 'New best!' : `Best: ${best.best}`,
    quip: wavesQuip(cleared, best?.isNew ?? false, selfInflicted),
  };
}

function wavesQuip(cleared: number, isNew: boolean, selfInflicted: boolean): string {
  if (selfInflicted) return 'Hoisted by your own shell! The AI will be telling this one for years.';
  if (isNew) return 'A personal best. The machines are taking notes.';
  if (cleared === 0) return 'Everyone has to start somewhere. Usually slightly further than this.';
  if (cleared < 4) return 'The waves keep coming. So should you.';
  return 'They had more armour, bigger guns and faster shells. You had grit.';
}

/** Armour pips for the HUD, e.g. "■■□" for 2 of 3 hit points: the viewer's own. */
export function hpPips(state: MatchState, viewer: string = HUMAN_ID): string {
  const you = state.tanks.find((t) => t.id === viewer);
  const hp = you?.alive ? Math.max(0, you.hp) : 0;
  const max = you?.maxHp ?? state.config.tankMaxHp;
  return '■'.repeat(hp) + '□'.repeat(Math.max(0, max - hp));
}

/** The HUD's mortar cell: ready, aiming or used; null when mortars are off, so the cell is hidden. */
export function mortarHud(state: MatchState, viewer: string = HUMAN_ID): string | null {
  if (!state.options.mortars) return null;
  const you = state.tanks.find((t) => t.id === viewer);
  if (you?.alive && you.mortarCharge >= 0) return 'Aiming…';
  return you?.alive && you.mortars > 0 ? 'Ready' : 'Used';
}

/** The HUD's progress cell: the round in Last One Standing, the wave in Waves. */
export function roundLine(state: MatchState): string {
  if (state.options.mode === 'waves') return `Wave ${state.round}`;
  return `Round ${state.round} / ${roundsOf(state)}`;
}

/** The HUD's score cell: the score in Last One Standing, waves cleared in Waves. */
export function hudScore(state: MatchState, viewer: string = HUMAN_ID): string {
  if (state.waves) return `Cleared ${state.waves.cleared}`;
  return scoreLine(state.scores, viewer);
}

function roundsOf(state: MatchState): number {
  return state.options.mode === 'lastOneStanding' ? state.options.rounds : 0;
}
