import { IDLE_INPUT, type Board, type MatchOptions, type TankInput } from '@tank/sim';
import type { Snapshot } from './snapshot';

/** Bumped whenever a message changes shape, so a client and server from different releases can tell. */
export const PROTOCOL_VERSION = 1;

/** The largest message either side may send, in bytes. The server closes a socket that sends more. */
export const MAX_MESSAGE_BYTES = 4096;

/** A human seat: the host is always `p1` and the guest `p2`, the same ids as their tanks. */
export type SeatId = 'p1' | 'p2';

export type ClientMessage =
  | { t: 'hello' }
  | { t: 'create'; options: MatchOptions }
  | { t: 'join'; code: string }
  | { t: 'rejoin'; code: string; token: string }
  | { t: 'options'; options: MatchOptions }
  | { t: 'start' }
  | { t: 'bot' }
  | ({ t: 'input' } & Required<TankInput>)
  | { t: 'playAgain' }
  | { t: 'toLobby' }
  | { t: 'leave' };

export type RefusedReason = 'noSuchGame' | 'full' | 'started' | 'busy' | 'invalid';
export type ClosedReason = 'hostLeft' | 'expired' | 'gone';

export type ServerMessage =
  | { t: 'welcome'; bot: boolean; version: number }
  | { t: 'room'; code: string; seat: SeatId; token: string; options: MatchOptions; guest: boolean }
  | { t: 'refused'; reason: RefusedReason; detail?: string }
  | { t: 'options'; options: MatchOptions }
  | { t: 'board'; board: Board }
  | ({ t: 'snap' } & Snapshot)
  /** `until`: milliseconds left in the dropped player's grace period. */
  | { t: 'frozen'; seat: SeatId; until: number }
  /** `at`: milliseconds until play resumes. */
  | { t: 'resume'; at: number }
  | { t: 'lobby'; guest: boolean }
  | { t: 'closed'; reason: ClosedReason };

const REFUSED_REASONS: readonly RefusedReason[] = ['noSuchGame', 'full', 'started', 'busy', 'invalid'];
const CLOSED_REASONS: readonly ClosedReason[] = ['hostLeft', 'expired', 'gone'];
const OPTION_KEYS = [
  'mode',
  'aiCount',
  'rounds',
  'startAiCount',
  'mortars',
  'maps',
  'humans',
  'friendlyFire',
];

export function encode(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}

/**
 * Reads a message from a player. Returns null for anything that isn't a message the server knows, so it can be
 * dropped. Fields of the wrong type don't drop a known message: controls become idle, and codes, tokens and options
 * become values the server will refuse.
 */
export function parseClientMessage(raw: string): ClientMessage | null {
  const msg = readObject(raw);
  if (!msg) return null;
  switch (msg.t) {
    case 'hello':
    case 'start':
    case 'bot':
    case 'playAgain':
    case 'toLobby':
    case 'leave':
      return { t: msg.t };
    case 'create':
    case 'options':
      return { t: msg.t, options: readOptions(msg.options) };
    case 'join':
      return { t: 'join', code: str(msg.code) };
    case 'rejoin':
      return { t: 'rejoin', code: str(msg.code), token: str(msg.token) };
    case 'input':
      return { t: 'input', ...readInput(msg) };
    default:
      return null;
  }
}

/** Reads a message from the server. Returns null for anything malformed, so the client can ignore it. */
export function parseServerMessage(raw: string): ServerMessage | null {
  const msg = readObject(raw);
  if (!msg) return null;
  switch (msg.t) {
    case 'welcome':
      return typeof msg.bot === 'boolean' && isNum(msg.version)
        ? { t: 'welcome', bot: msg.bot, version: msg.version }
        : null;
    case 'room':
      return typeof msg.code === 'string' &&
        isSeat(msg.seat) &&
        typeof msg.token === 'string' &&
        isObject(msg.options) &&
        typeof msg.guest === 'boolean'
        ? {
            t: 'room',
            code: msg.code,
            seat: msg.seat,
            token: msg.token,
            options: msg.options as MatchOptions,
            guest: msg.guest,
          }
        : null;
    case 'refused':
      if (!REFUSED_REASONS.includes(msg.reason as RefusedReason)) return null;
      return typeof msg.detail === 'string'
        ? { t: 'refused', reason: msg.reason as RefusedReason, detail: msg.detail }
        : { t: 'refused', reason: msg.reason as RefusedReason };
    case 'options':
      return isObject(msg.options) ? { t: 'options', options: msg.options as MatchOptions } : null;
    case 'board':
      return isBoard(msg.board) ? { t: 'board', board: msg.board } : null;
    case 'snap':
      return isSnapshot(msg) ? (msg as ServerMessage) : null;
    case 'frozen':
      return isSeat(msg.seat) && isNum(msg.until) ? { t: 'frozen', seat: msg.seat, until: msg.until } : null;
    case 'resume':
      return isNum(msg.at) ? { t: 'resume', at: msg.at } : null;
    case 'lobby':
      return typeof msg.guest === 'boolean' ? { t: 'lobby', guest: msg.guest } : null;
    case 'closed':
      return CLOSED_REASONS.includes(msg.reason as ClosedReason)
        ? { t: 'closed', reason: msg.reason as ClosedReason }
        : null;
    default:
      return null;
  }
}

/**
 * A player's controls, field by field: anything of the wrong type is idle. `turn` is passed on as any finite number;
 * the simulation clamps it.
 */
function readInput(msg: Record<string, unknown>): Required<TankInput> {
  const { throttle, turn, fire, mortar } = msg;
  return {
    throttle: throttle === 1 || throttle === -1 ? throttle : IDLE_INPUT.throttle,
    turn: isNum(turn) ? turn : IDLE_INPUT.turn,
    fire: fire === true,
    mortar: mortar === true,
  };
}

/**
 * The option fields a match knows about, copied from whatever was sent. The values aren't checked here: the server
 * checks them with the simulation's own rules, and refuses what's wrong with the reason.
 */
function readOptions(raw: unknown): MatchOptions {
  const options: Record<string, unknown> = {};
  if (isObject(raw)) for (const key of OPTION_KEYS) if (key in raw) options[key] = raw[key];
  return options as MatchOptions;
}

function readObject(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw);
    return isObject(value) && typeof value.t === 'string' ? value : null;
  } catch {
    return null;
  }
}

function isSnapshot(msg: Record<string, unknown>): boolean {
  return (
    isNum(msg.tick) &&
    typeof msg.phase === 'string' &&
    isNum(msg.phaseTicks) &&
    isNum(msg.round) &&
    isObject(msg.scores) &&
    Array.isArray(msg.tanks) &&
    Array.isArray(msg.shells) &&
    Array.isArray(msg.mortarShells) &&
    Array.isArray(msg.events)
  );
}

function isBoard(value: unknown): value is Board {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    isNum(value.width) &&
    isNum(value.height) &&
    Array.isArray(value.obstacles) &&
    Array.isArray(value.spawns)
  );
}

function isSeat(value: unknown): value is SeatId {
  return value === 'p1' || value === 'p2';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNum(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
