import { HUMAN_ID, type GameResult, type MatchState, type RoundOutcome, type Scores } from '@tank/sim';

// Pure text decisions for the overlays, kept apart from the DOM so they're easy to test.

export interface BannerText {
  title: string;
  sub: string;
}

export function scoreLine(scores: Scores): string {
  return `You ${scores.human} – ${scores.ai} AI`;
}

const ROUND_TITLES: Record<RoundOutcome, string> = {
  human: 'Round won!',
  ai: 'Round lost',
  draw: 'Mutual destruction!',
};

/**
 * What the centre banner should say right now, or null for nothing.
 * `showGo` is true briefly after play starts; `selfInflicted` is true if the human's own shell finished them off.
 */
export function bannerFor(state: MatchState, showGo: boolean, selfInflicted: boolean): BannerText | null {
  switch (state.phase) {
    case 'countdown':
      return {
        title: String(Math.max(1, Math.ceil(state.phaseTicks / state.config.tickRate))),
        sub: `Round ${state.round} of ${state.options.rounds}`,
      };
    case 'playing':
      return showGo ? { title: 'GO!', sub: '' } : null;
    case 'roundOver': {
      const outcome = state.lastRoundOutcome ?? 'draw';
      const quip = outcome === 'ai' && selfInflicted ? ' · Hoisted by your own shell!' : '';
      return { title: ROUND_TITLES[outcome], sub: scoreLine(state.scores) + quip };
    }
    case 'gameOver':
      return null;
  }
}

export function gameOverText(
  result: GameResult,
  scores: Scores,
): { title: string; score: string; quip: string } {
  const titles: Record<GameResult, [string, string]> = {
    win: ['Victory!', 'The last tank standing is yours.'],
    loss: ['Defeat', 'The machines win this time. Rematch?'],
    draw: ['A draw', "Honours even. Nobody's quite sure how."],
  };
  const [title, quip] = titles[result];
  return { title, score: scoreLine(scores), quip };
}

/** Armour pips for the HUD, e.g. "■■□" for 2 of 3 hit points. */
export function hpPips(state: MatchState): string {
  const you = state.tanks.find((t) => t.id === HUMAN_ID);
  const hp = you?.alive ? Math.max(0, you.hp) : 0;
  const max = state.config.tankMaxHp;
  return '■'.repeat(hp) + '□'.repeat(Math.max(0, max - hp));
}

export function roundLine(state: MatchState): string {
  return `Round ${state.round} / ${state.options.rounds}`;
}
