import { parseClientMessage, type ClientMessage, type SeatId, type ServerMessage } from '@tank/protocol';
import type { MatchOptions, SimEvent } from '@tank/sim';
import type { Outgoing, Room } from '../src/room';
import { RoomRegistry, type RegistryDeps, type RegistrySettings } from '../src/rooms';

export const SETTINGS: RegistrySettings = {
  graceMs: 15_000,
  lobbyIdleMs: 30 * 60_000,
  testBot: true,
  maxRooms: 10,
};

export type LosOptions = Extract<MatchOptions, { mode: 'lastOneStanding' }>;
export type WavesOptions = Extract<MatchOptions, { mode: 'waves' }>;

export const LOS: LosOptions = {
  mode: 'lastOneStanding',
  aiCount: 2,
  rounds: 5,
  mortars: true,
  maps: { kind: 'random' },
  humans: 2,
};
export const WAVES: WavesOptions = {
  mode: 'waves',
  startAiCount: 2,
  mortars: true,
  maps: { kind: 'random' },
  humans: 2,
};

/** Seeds, tokens and codes that are the same every run. */
export function fakeDeps(): RegistryDeps {
  let tokens = 0;
  let seeds = 0;
  let r = 12345;
  return {
    token: () => `token-${++tokens}`,
    seed: () => 1000 + ++seeds,
    random: () => (r = (r * 16807) % 2147483647) / 2147483647,
  };
}

/** How often the fake server ticker runs, ms (the real one runs about every 4 ms). */
const TICK_MS = 4;

/**
 * A registry driven by a fake clock, with what each seat of one room has been sent. The clock only moves when a test
 * says so, so grace periods, countdowns and snapshots happen exactly when expected.
 */
export class Table {
  now = 0;
  readonly reg: RoomRegistry;
  readonly inbox: Record<SeatId, ServerMessage[]> = { p1: [], p2: [] };
  room!: Room;
  /** The token each seat was last given; kept when the inbox is cleared. */
  private readonly tokens: Partial<Record<SeatId, string>> = {};

  constructor(settings: Partial<RegistrySettings> = {}, deps: RegistryDeps = fakeDeps()) {
    this.reg = new RoomRegistry({ ...SETTINGS, ...settings }, deps);
  }

  /** A host creates a room. */
  host(options: MatchOptions = LOS): Room {
    const made = this.reg.create(options, this.now);
    if (!('room' in made)) throw new Error(`Room refused: ${made.refused} ${made.detail ?? ''}`);
    this.room = made.room;
    this.deliver(made.out);
    return made.room;
  }

  /** A guest joins by the room's code. */
  guest(): void {
    const joined = this.reg.join(this.room.code);
    if (!('room' in joined)) throw new Error(`Join refused: ${joined.refused}`);
    this.deliver(joined.out);
  }

  /** A host and a guest, in a game that has started. */
  started(options: MatchOptions = LOS): Room {
    this.host(options);
    this.guest();
    this.send('p1', { t: 'start' });
    return this.room;
  }

  /** Into the first round's play, past the countdown. */
  playing(options: MatchOptions = LOS): Room {
    this.started(options);
    this.advanceUntil(() => this.room.match?.phase === 'playing', 10_000);
    return this.room;
  }

  send(seat: SeatId, msg: ClientMessage): void {
    this.deliver(this.room.handle(seat, msg, this.now));
  }

  /** Sends text as a socket would: whatever doesn't parse never reaches the room. */
  sendRaw(seat: SeatId, raw: string): void {
    const msg = parseClientMessage(raw);
    if (msg) this.send(seat, msg);
  }

  drop(seat: SeatId): void {
    this.deliver(this.room.disconnect(seat, this.now));
  }

  /** The seat's player comes back with their token. */
  rejoin(seat: SeatId, token = this.token(seat)): ReturnType<RoomRegistry['rejoin']> {
    const back = this.reg.rejoin(this.room.code, token, this.now);
    if ('out' in back) this.deliver(back.out);
    return back;
  }

  /** The token the seat was given. */
  token(seat: SeatId): string {
    const token = this.tokens[seat];
    if (token === undefined) throw new Error(`${seat} has no token`);
    return token;
  }

  /** Moves the clock on by `ms`, ticking every room as the server would. */
  advance(ms: number): void {
    const end = this.now + ms;
    while (this.now < end) {
      this.now = Math.min(end, this.now + TICK_MS);
      this.tick();
    }
  }

  advanceUntil(done: () => boolean, maxMs: number): void {
    const end = this.now + maxMs;
    while (!done()) {
      if (this.now >= end) throw new Error(`Still waiting after ${maxMs} ms`);
      this.advance(TICK_MS);
    }
  }

  tick(): void {
    for (const { room, out } of this.reg.tick(this.now)) if (room === this.room) this.deliver(out);
  }

  /** Messages a seat has had of one kind. */
  sent<T extends ServerMessage['t']>(seat: SeatId, t: T): Extract<ServerMessage, { t: T }>[] {
    return this.inbox[seat].filter((m): m is Extract<ServerMessage, { t: T }> => m.t === t);
  }

  /** Every event a seat has been sent, in order. */
  events(seat: SeatId): SimEvent[] {
    return this.sent(seat, 'snap').flatMap((s) => s.events);
  }

  last(seat: SeatId): ServerMessage | undefined {
    return this.inbox[seat].at(-1);
  }

  clear(): void {
    this.inbox.p1 = [];
    this.inbox.p2 = [];
  }

  private deliver(out: Outgoing[]): void {
    for (const { seat, message } of out) {
      this.inbox[seat].push(message);
      if (message.t === 'room') this.tokens[seat] = message.token;
    }
  }
}
