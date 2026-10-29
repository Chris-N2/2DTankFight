import {
  isRoomCode,
  normalizeCode,
  type ClosedReason,
  type RefusedReason,
  type SeatId,
} from '@tank/protocol';
import { aiCountMax, HUMAN_ID, SECOND_HUMAN_ID, type MatchOptions, type MatchState } from '@tank/sim';
import type { ConnectionFailure, StoredSeat } from './net';
import { matchOptionsFor, scoreLine, type GameOverText, type SetupChoices } from './screens';

// Pure text and decisions for online play, kept apart from the DOM so they're easy to test, as screens.ts is.

/** The query parameter a join link carries the room code in. */
export const JOIN_PARAM = 'join';

const TWO_PLAYER_AI_MAX = aiCountMax(2);

/**
 * Fits the setup screen's choices to a two-player game: at most 3 AI. Returns a note saying what was lowered, or
 * null if nothing had to change.
 */
export function fitForTwo(choices: SetupChoices): string | null {
  const lowered: string[] = [];
  if (choices.aiCount > TWO_PLAYER_AI_MAX) {
    choices.aiCount = TWO_PLAYER_AI_MAX;
    lowered.push('AI opponents');
  }
  if (choices.startAiCount > TWO_PLAYER_AI_MAX) {
    choices.startAiCount = TWO_PLAYER_AI_MAX;
    lowered.push('starting AI tanks');
  }
  if (lowered.length === 0) return null;
  const what = lowered.join(' and ');
  return `${what[0]!.toUpperCase()}${what.slice(1)} lowered to ${TWO_PLAYER_AI_MAX} for two players.`;
}

/** The options for an online game: the setup screen's choices as a two-player match, with friendly fire for Waves. */
export function onlineOptionsFor(choices: SetupChoices): MatchOptions {
  const options = matchOptionsFor(choices);
  return options.mode === 'waves'
    ? { ...options, humans: 2, friendlyFire: choices.friendlyFire }
    : { ...options, humans: 2 };
}

/** Shows a room's options on the setup screen's rows (the guest's read-only view). */
export function applyOptions(choices: SetupChoices, options: MatchOptions): void {
  choices.mode = options.mode;
  choices.mortars = options.mortars;
  if (options.mode === 'waves') {
    choices.startAiCount = options.startAiCount;
    choices.friendlyFire = options.friendlyFire === true;
  } else {
    choices.aiCount = options.aiCount;
    choices.rounds = options.rounds;
  }
  choices.maps = options.maps.kind;
  if (options.maps.kind === 'sequence') choices.sequence = [...options.maps.ids];
}

/** The link that joins a room: the page the game is on, with everything it already had, plus the room code. */
export function joinLink(pageUrl: string, code: string): string {
  const url = new URL(pageUrl);
  url.searchParams.set(JOIN_PARAM, code);
  return url.href;
}

/** The room code a page was opened with, if it's the shape of one. */
export function joinCodeIn(pageUrl: string): string | null {
  const raw = new URL(pageUrl).searchParams.get(JOIN_PARAM);
  const code = raw === null ? '' : normalizeCode(raw);
  return isRoomCode(code) ? code : null;
}

/** The page's address without the room code, for after joining, so a refresh rejoins by token instead. */
export function withoutJoin(pageUrl: string): string {
  const url = new URL(pageUrl);
  url.searchParams.delete(JOIN_PARAM);
  return url.href;
}

/** What to do online as the page loads. */
export type LoadAction = { t: 'none' } | { t: 'rejoin'; seat: StoredSeat } | { t: 'join'; code: string };

/**
 * With no server there's no online play, and no connection at all, whatever the address says. Otherwise a seat this
 * tab already holds on this server is taken back first (a refresh mid-game), before any join link.
 */
export function onLoad(server: string | null, stored: StoredSeat | null, pageUrl: string): LoadAction {
  if (server === null) return { t: 'none' };
  if (stored?.server === server) return { t: 'rejoin', seat: stored };
  const code = joinCodeIn(pageUrl);
  return code === null ? { t: 'none' } : { t: 'join', code };
}

/** What a typed code needs to be before it's worth asking the server. */
export function typedCodeProblem(typed: string): string | null {
  const code = normalizeCode(typed);
  if (code.length === 0) return 'Type the four-character code the host gave you.';
  return isRoomCode(code) ? null : 'Room codes are four letters and digits, like KTXW.';
}

export function refusedText(reason: RefusedReason, detail?: string): string {
  switch (reason) {
    case 'noSuchGame':
      return "There's no game with that code. Check it with the host?";
    case 'full':
      return 'That game is full.';
    case 'started':
      return 'That game has already started.';
    case 'busy':
      return 'The server is busy right now. Try again in a little while.';
    case 'invalid':
      return detail ?? "The server didn't accept that.";
  }
}

export function closedText(reason: ClosedReason): string {
  switch (reason) {
    case 'hostLeft':
      return 'The host has left the game.';
    case 'expired':
      return 'The room closed after waiting too long.';
    case 'gone':
      return 'The game went on without you.';
  }
}

export function failureText(why: ConnectionFailure): string {
  switch (why) {
    case 'unreachable':
      return "The online server isn't available right now. Single-player still works.";
    case 'lost':
      return 'Lost the connection to the online server.';
    case 'replaced':
      return 'This game was picked up in another tab or window.';
  }
}

/** The lobby's status line. */
export function lobbyStatus(seat: SeatId, guest: boolean): string {
  if (seat === SECOND_HUMAN_ID) return 'Waiting for the host to start…';
  return guest ? 'A player has joined. Start when you’re ready.' : 'Waiting for a player…';
}

/** What the freeze overlay says, or null when play isn't frozen. */
export interface FreezeView {
  /** This player's own connection dropped and is coming back. */
  reconnecting: boolean;
  /** When the other player's grace period ends, if they're the one away. */
  othersDeadline: number | null;
  /** When play resumes, during the 3-2-1. */
  resumeAt: number | null;
}

export function freezeText(view: FreezeView, now: number): { title: string; sub: string } | null {
  if (view.reconnecting)
    return { title: 'Reconnecting…', sub: 'Hang on: the game is frozen until you’re back.' };
  if (view.resumeAt !== null) {
    return { title: String(Math.max(1, Math.ceil((view.resumeAt - now) / 1000))), sub: 'Back in the game!' };
  }
  if (view.othersDeadline !== null) {
    const left = Math.max(0, Math.ceil((view.othersDeadline - now) / 1000));
    return {
      title: 'Game frozen',
      sub: `The other player dropped out. Waiting ${left} s for them to come back…`,
    };
  }
  return null;
}

/** The other human's seat. */
export function otherSeat(seat: string): SeatId {
  return seat === HUMAN_ID ? SECOND_HUMAN_ID : HUMAN_ID;
}

/**
 * The online result screen, from the point of view of the player in seat `viewer`. Nothing is recorded: online
 * games don't set a best on this device.
 */
export function onlineResultText(state: MatchState, viewer: string): GameOverText {
  if (state.options.mode === 'waves') {
    const cleared = state.waves?.cleared ?? 0;
    return {
      title: `Overrun on wave ${state.round}`,
      score: `The team cleared ${cleared === 1 ? '1 wave' : `${cleared} waves`}`,
      best: '',
      quip:
        cleared === 0 ? 'Two tanks, zero waves. The AI is still laughing.' : 'Not bad for a scratch crew.',
    };
  }
  const forfeit = state.forfeit;
  const [title, quip] =
    state.winnerId === viewer
      ? forfeit
        ? ['Victory by forfeit!', 'They left the field. A win is a win.']
        : ['Victory!', 'The last tank standing is yours.']
      : state.winnerId !== null
        ? forfeit
          ? ['Defeat by forfeit', 'Leaving early hands them the win.']
          : ['Defeat', 'They had your number this time. Rematch?']
        : ['A draw', "Honours even. Nobody's quite sure how."];
  return { title, score: scoreLine(state.scores, viewer), best: aiRibbing(state), quip };
}

/** A line about the rounds the AI won, with a little light ribbing for the pair of them; empty if it won none. */
export function aiRibbing(state: MatchState): string {
  const ai = state.scores.ai;
  if (ai === 0) return '';
  if (ai === state.roundsPlayed) {
    const rounds = ai === 1 ? 'the only round' : `all ${ai} rounds`;
    return `The AI took ${rounds}. Perhaps try shooting at it, rather than each other?`;
  }
  return ai === 1
    ? 'The AI took 1 round while you two were busy with each other.'
    : `The AI took ${ai} rounds while you two were busy with each other.`;
}
