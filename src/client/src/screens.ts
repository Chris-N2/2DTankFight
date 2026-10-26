import {
  HUMAN_ID,
  type LastOneStandingResult,
  type MatchState,
  type RoundOutcome,
  type Scores,
  type WaveChange,
} from '@tank/sim';
import type { BestResult } from './best';

// Pure text decisions for the overlays, kept apart from the DOM so they're easy to test.

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

export function scoreLine(scores: Scores): string {
  return `You ${scores.human} – ${scores.ai} AI`;
}

const ROUND_TITLES: Record<RoundOutcome, string> = {
  human: 'Round won!',
  ai: 'Round lost',
  draw: 'Mutual destruction!',
};

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
 * `changes` are the escalation steps the current wave applied (Waves only).
 */
export function bannerFor(
  state: MatchState,
  showGo: boolean,
  selfInflicted: boolean,
  changes: readonly WaveChange[] = [],
): BannerText | null {
  const waves = state.options.mode === 'waves';
  switch (state.phase) {
    case 'countdown':
      return {
        title: String(Math.max(1, Math.ceil(state.phaseTicks / state.config.tickRate))),
        sub: waves
          ? [`Wave ${state.round}`, ...changes.map((c) => CHANGE_TEXT[c])].join(' · ')
          : `Round ${state.round} of ${roundsOf(state)}`,
      };
    case 'playing':
      return showGo ? { title: 'GO!', sub: '' } : null;
    case 'roundOver': {
      if (waves) return { title: `Wave ${state.round} cleared!`, sub: `Wave ${state.round + 1} incoming…` };
      const outcome = state.lastRoundOutcome ?? 'draw';
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

/** Armour pips for the HUD, e.g. "■■□" for 2 of 3 hit points. */
export function hpPips(state: MatchState): string {
  const you = state.tanks.find((t) => t.id === HUMAN_ID);
  const hp = you?.alive ? Math.max(0, you.hp) : 0;
  const max = you?.maxHp ?? state.config.tankMaxHp;
  return '■'.repeat(hp) + '□'.repeat(Math.max(0, max - hp));
}

/** The HUD's progress cell: the round in Last One Standing, the wave in Waves. */
export function roundLine(state: MatchState): string {
  if (state.options.mode === 'waves') return `Wave ${state.round}`;
  return `Round ${state.round} / ${roundsOf(state)}`;
}

/** The HUD's score cell: the score in Last One Standing, waves cleared in Waves. */
export function hudScore(state: MatchState): string {
  if (state.waves) return `Cleared ${state.waves.cleared}`;
  return scoreLine(state.scores);
}

function roundsOf(state: MatchState): number {
  return state.options.mode === 'lastOneStanding' ? state.options.rounds : 0;
}
