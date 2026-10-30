import {
  encode,
  parseServerMessage,
  type ClientMessage,
  type SeatId,
  type ServerMessage,
} from '@tank/protocol';
import type { TankInput } from '@tank/sim';

// The connection to the multiplayer server. Sockets and time are passed in, so all of this runs in tests without a
// browser or a server.

/** The parts of a browser WebSocket the game uses. */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export type SocketFactory = (url: string) => SocketLike;

/** Time for the connection: the clock, and a timer that can be cancelled. */
export interface Clock {
  now(): number;
  /** Runs `fn` after `ms`; returns a function that cancels it. */
  after(ms: number, fn: () => void): () => void;
}

export const OPEN = 1;
/** A server that hasn't answered by now isn't there. */
export const CONNECT_TIMEOUT_MS = 5000;
/** How long to keep trying to get back after a drop. The server keeps the seat for its grace period (15 s). */
export const RECONNECT_FOR_MS = 20_000;
/** The close code the server uses when another connection has taken the seat over. */
export const SEAT_TAKEN_OVER = 4000;

/** The wait before reconnection attempt `attempt` (from 0): 0.5 s, 1 s, 2 s, then every 4 s. */
export function backoffMs(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 4000);
}

export type ConnectionFailure =
  /** The first try never connected. */
  | 'unreachable'
  /** Dropped, and couldn't get back in time. */
  | 'lost'
  /** This seat was taken over by another tab or device. */
  | 'replaced';

export interface ConnectionEvents {
  /** A socket has opened: the first one, or one that got back after a drop. Time to say who we are. */
  open(reconnected: boolean): void;
  message(msg: ServerMessage): void;
  /** An open connection dropped; it's trying to get back. */
  dropped(): void;
  failed(why: ConnectionFailure): void;
}

/**
 * One connection to the server, which gets itself back after a drop: it tries again with backoff until
 * {@link RECONNECT_FOR_MS} has passed. Closing it on purpose stops all that.
 */
export class Connection {
  private socket: SocketLike | null = null;
  private everOpened = false;
  private connected = false;
  private closed = false;
  private attempt = 0;
  private giveUpAt = 0;
  private cancelTimer: (() => void) | null = null;

  constructor(
    readonly url: string,
    private readonly factory: SocketFactory,
    private readonly clock: Clock,
    private readonly events: ConnectionEvents,
  ) {}

  get isOpen(): boolean {
    return this.connected;
  }

  connect(): void {
    this.dial();
  }

  /** Sends a message if connected; anything sent while away is dropped, since the rejoin brings the state back. */
  send(msg: ClientMessage): void {
    if (this.connected && this.socket?.readyState === OPEN) this.socket.send(encode(msg));
  }

  /** Closes the connection on purpose: no reconnecting. */
  close(): void {
    this.closed = true;
    this.connected = false;
    this.cancelTimer?.();
    this.cancelTimer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      detach(socket);
      socket.close();
    }
  }

  private dial(): void {
    if (this.closed) return;
    const socket = this.factory(this.url);
    this.socket = socket;
    this.cancelTimer = this.clock.after(CONNECT_TIMEOUT_MS, () => {
      // Nothing back from the server: give this socket up as if it had closed.
      detach(socket);
      socket.close();
      if (this.socket === socket) this.lost(0);
    });
    socket.onopen = () => {
      this.cancelTimer?.();
      this.cancelTimer = null;
      const reconnected = this.everOpened;
      this.everOpened = true;
      this.connected = true;
      this.attempt = 0;
      this.giveUpAt = 0;
      this.events.open(reconnected);
    };
    socket.onmessage = (ev) => {
      const msg = parseServerMessage(String(ev.data));
      if (msg) this.events.message(msg);
    };
    socket.onclose = (ev) => {
      if (this.socket !== socket) return;
      this.cancelTimer?.();
      this.cancelTimer = null;
      this.lost(ev.code);
    };
    socket.onerror = () => {
      // A close always follows.
    };
  }

  private lost(code: number): void {
    this.socket = null;
    const wasConnected = this.connected;
    this.connected = false;
    if (this.closed) return;
    if (code === SEAT_TAKEN_OVER) {
      this.closed = true;
      this.events.failed('replaced');
      return;
    }
    if (!this.everOpened) {
      this.closed = true;
      this.events.failed('unreachable');
      return;
    }
    if (wasConnected) {
      this.giveUpAt = this.clock.now() + RECONNECT_FOR_MS;
      this.events.dropped();
    }
    if (this.clock.now() >= this.giveUpAt) {
      this.closed = true;
      this.events.failed('lost');
      return;
    }
    this.cancelTimer = this.clock.after(backoffMs(this.attempt++), () => this.dial());
  }
}

function detach(socket: SocketLike): void {
  socket.onopen = null;
  socket.onmessage = null;
  socket.onclose = null;
  socket.onerror = null;
}

/** Controls are sent whenever they change, and at least this often anyway, which also keeps the socket busy. */
export const HEARTBEAT_MS = 250;

/** Sends the player's controls: on every change, and as a heartbeat when nothing changes. */
export class InputSender {
  private last = '';
  private lastAt = -Infinity;

  constructor(private readonly send: (msg: ClientMessage) => void) {}

  update(input: TankInput, now: number): void {
    const msg: ClientMessage = {
      t: 'input',
      throttle: input.throttle,
      turn: input.turn,
      fire: input.fire,
      mortar: input.mortar === true,
    };
    const key = encode(msg);
    if (key === this.last && now - this.lastAt < HEARTBEAT_MS) return;
    this.send(msg);
    this.last = key;
    this.lastAt = now;
  }

  /** Forgets what was sent, so the next controls go straight away (after a reconnect, say). */
  reset(): void {
    this.last = '';
    this.lastAt = -Infinity;
  }
}

/** A seat this tab holds in a room: enough to get back into it after a refresh or a dropped connection. */
export interface StoredSeat {
  server: string;
  code: string;
  seat: SeatId;
  token: string;
  /** The host is playing the test bot, so a refresh mid-game still knows not to award achievements. */
  vsBot?: boolean;
}

export interface SeatStore {
  load(): StoredSeat | null;
  save(seat: StoredSeat): void;
  clear(): void;
}

export const SEAT_KEY = 'tank-command-seat';

/**
 * The seat, kept in `sessionStorage`: it survives a refresh but belongs to the one tab, so two tabs on one machine
 * can be host and guest. Storage that's blocked just means no rejoining after a refresh.
 */
export function sessionSeatStore(
  storage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): SeatStore {
  return {
    load() {
      try {
        const value: unknown = JSON.parse(storage().getItem(SEAT_KEY) ?? 'null');
        if (typeof value !== 'object' || value === null) return null;
        const { server, code, seat, token, vsBot } = value as Record<string, unknown>;
        if (typeof server !== 'string' || typeof code !== 'string' || typeof token !== 'string') return null;
        if (seat !== 'p1' && seat !== 'p2') return null;
        return vsBot === true ? { server, code, seat, token, vsBot } : { server, code, seat, token };
      } catch {
        return null;
      }
    },
    save(seat) {
      try {
        storage().setItem(SEAT_KEY, JSON.stringify(seat));
      } catch {
        // Not kept; a refresh won't rejoin.
      }
    },
    clear() {
      try {
        storage().removeItem(SEAT_KEY);
      } catch {
        // Nothing to clear.
      }
    },
  };
}
