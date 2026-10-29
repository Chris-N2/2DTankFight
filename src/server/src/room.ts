import {
  FixedStepLoop,
  snapshotOf,
  type ClientMessage,
  type SeatId,
  type ServerMessage,
} from '@tank/protocol';
import {
  botInput,
  createMatch,
  HUMAN_ID,
  IDLE_INPUT,
  leave,
  SECOND_HUMAN_ID,
  DEFAULT_CONFIG,
  step,
  validateOptions,
  type MatchOptions,
  type MatchState,
  type SimEvent,
  type TankInput,
} from '@tank/sim';

/** Where a room is: waiting for players, playing a game, or showing a game's result. */
export type RoomPhase = 'lobby' | 'game' | 'result';

/** A message for whoever is sitting in a seat. */
export interface Outgoing {
  seat: SeatId;
  message: ServerMessage;
}

export interface RoomSettings {
  /** How long a dropped player's seat is kept for them, ms. */
  graceMs: number;
  /** How long a room may wait without a game starting, ms. */
  lobbyIdleMs: number;
  /** Whether a host may fill the second seat with the test bot. */
  testBot: boolean;
}

/** Where a room's randomness comes from, so tests can choose it. */
export interface RoomDeps {
  /** A new secret seat token. */
  token(): string;
  /** A fresh seed for each game. */
  seed(): number;
}

/** The 3-2-1 before a frozen game carries on, ms. */
export const RESUME_MS = 3000;
/** Simulation ticks per snapshot: 2 at 60 ticks per second is 30 snapshots a second. */
export const TICKS_PER_SNAPSHOT = 2;
/** The most ticks one call to `tick` may run, so a stalled server can't spiral. */
const MAX_STEPS_PER_TICK = 4;

interface Seat {
  token: string;
  bot: boolean;
  connected: boolean;
  /** When a dropped player's grace period ends, ms. */
  graceUntil: number;
  /** The grace period ran out while the other player was away too; the leave waits for one of them to return. */
  expired: boolean;
  /** The latest controls sent. */
  input: Required<TankInput>;
  /** Fire or mortar pressed at any time since the last tick, so a quick tap isn't lost between ticks. */
  firePressed: boolean;
  mortarPressed: boolean;
}

/**
 * One two-player room: its seats, its lobby, the game being played and the result. A pure state machine, driven by
 * method calls with the time passed in; each call returns the messages to send. Sockets live in `server.ts`.
 */
export class Room {
  phase: RoomPhase = 'lobby';
  /** Once closed, a room does nothing more and its code no longer works. */
  closed = false;
  /** The game being played or just finished; null before the first start. */
  match: MatchState | null = null;

  private readonly seats: Partial<Record<SeatId, Seat>> = {};
  /** Guests who dropped out of the lobby, who can come back while the seat is still free. */
  private readonly droppedGuests = new Set<string>();
  /** Tokens of players who left a game, so they can be told it went on without them. */
  private readonly goneTokens = new Set<string>();
  /** Since when the room has waited without a game starting. */
  private idleSince: number;
  private readonly loop: FixedStepLoop;
  private frozen = false;
  /** When a frozen game carries on, or null while it's waiting for a player. */
  private resumeAt: number | null = null;
  /** Events since the last snapshot. */
  private pending: SimEvent[] = [];
  private steps = 0;
  private boardId = '';
  /** The host left mid-game: the guest plays on, and the room closes when the game ends. */
  private hostGone = false;
  /** The time of the latest call, for the simulation's ticks, which aren't given it. */
  private clock = 0;
  private out: Outgoing[] = [];

  constructor(
    readonly code: string,
    /** Two-player options, already checked (see {@link Room.problemWith}). */
    public options: MatchOptions,
    private readonly settings: RoomSettings,
    private readonly deps: RoomDeps,
    now: number,
  ) {
    this.idleSince = now;
    this.seats.p1 = newSeat(deps.token());
    this.loop = new FixedStepLoop(1000 / DEFAULT_CONFIG.tickRate, () => this.step(), MAX_STEPS_PER_TICK);
    this.send(HUMAN_ID, this.roomMessage(HUMAN_ID));
  }

  /** The options for a room's game, as a two-player match: whatever the client said, a room is for two. */
  static twoPlayer(options: MatchOptions): MatchOptions {
    return { ...options, humans: 2 };
  }

  /** Why these options can't be played in a room, or null if they can. */
  static problemWith(options: MatchOptions): string | null {
    return validateOptions(Room.twoPlayer(options));
  }

  /** Whether a guest (or the bot) is sitting in the second seat. */
  get hasGuest(): boolean {
    return this.seats.p2 !== undefined;
  }

  /** Takes the messages queued so far. */
  flush(): Outgoing[] {
    const out = this.out;
    this.out = [];
    return out;
  }

  /** A guest asks to join by code. */
  join(): { seat: SeatId; out: Outgoing[] } | { refused: 'full' | 'started' } {
    if (this.phase !== 'lobby') return { refused: 'started' };
    if (this.seats.p2) return { refused: 'full' };
    this.seatGuest(newSeat(this.deps.token()));
    return { seat: SECOND_HUMAN_ID, out: this.flush() };
  }

  /**
   * A connection presents a seat token. A valid one takes the seat over, whether or not the old connection has
   * closed; a guest who dropped out of the lobby gets the seat back if nobody else has taken it.
   */
  rejoin(
    token: string,
    now: number,
  ): { seat: SeatId; out: Outgoing[] } | { refused: 'full' | 'started' | 'invalid' } | { gone: true } {
    const id = (Object.keys(this.seats) as SeatId[]).find(
      (s) => !this.seats[s]!.bot && this.seats[s]!.token === token,
    );
    if (id) {
      this.reconnect(id, now);
      return { seat: id, out: this.flush() };
    }
    if (this.droppedGuests.has(token)) {
      if (this.phase !== 'lobby') return { refused: 'started' };
      if (this.seats.p2) return { refused: 'full' };
      this.droppedGuests.delete(token);
      this.seatGuest(newSeat(token));
      return { seat: SECOND_HUMAN_ID, out: this.flush() };
    }
    if (this.goneTokens.has(token)) return { gone: true };
    return { refused: 'invalid' };
  }

  /** A seat's connection closed or stopped answering. */
  disconnect(id: SeatId, now: number): Outgoing[] {
    const seat = this.seats[id];
    if (!seat || seat.bot || !seat.connected) return [];
    switch (this.phase) {
      case 'lobby':
        if (id === SECOND_HUMAN_ID) {
          // A guest who closes the tab frees the seat at once; a refresh can still have it back (see rejoin).
          this.droppedGuests.add(seat.token);
          delete this.seats.p2;
          this.send(HUMAN_ID, { t: 'lobby', guest: false });
        } else {
          seat.connected = false;
          seat.graceUntil = now + this.settings.graceMs;
        }
        break;
      case 'game':
        seat.connected = false;
        seat.graceUntil = now + this.settings.graceMs;
        this.freeze();
        this.send(other(id), { t: 'frozen', seat: id, until: this.settings.graceMs });
        break;
      case 'result':
        // After the game nobody needs to be waited for.
        if (id === HUMAN_ID) this.close('hostLeft');
        else this.guestGoneAfterGame(now, false);
        break;
    }
    return this.flush();
  }

  /** A message from the player in seat `id`. Messages that don't fit the seat or the moment are ignored. */
  handle(id: SeatId, msg: ClientMessage, now: number): Outgoing[] {
    const seat = this.seats[id];
    if (!seat || this.closed) return [];
    const host = id === HUMAN_ID;
    switch (msg.t) {
      case 'options':
        if (host && this.phase === 'lobby') this.changeOptions(msg.options);
        break;
      case 'start':
        if (host && this.phase === 'lobby' && this.seats.p2) this.startGame(now);
        break;
      case 'bot':
        if (host && this.phase === 'lobby') this.addBot(now);
        break;
      case 'input':
        if (this.phase === 'game') {
          const { throttle, turn, fire, mortar } = msg;
          seat.input = { throttle, turn, fire, mortar };
          seat.firePressed ||= fire;
          seat.mortarPressed ||= mortar;
        }
        break;
      case 'playAgain':
        if (host && this.phase === 'result' && this.seats.p2) this.startGame(now);
        break;
      case 'toLobby':
        if (host && this.phase === 'result') this.backToLobby(now);
        break;
      case 'leave':
        this.leaveOnPurpose(id, now);
        break;
      default:
        // hello, create, join and rejoin are for the server, not a room.
        break;
    }
    return this.flush();
  }

  /** Moves time on: runs the game's ticks, and checks grace periods and idle lobbies. */
  tick(now: number): Outgoing[] {
    if (this.closed) return [];
    this.clock = now;
    if (this.phase === 'game') this.tickGame(now);
    else if (now - this.idleSince >= this.settings.lobbyIdleMs) this.close('expired');
    else if (this.phase === 'lobby' && !this.seats.p1!.connected && now >= this.seats.p1!.graceUntil) {
      this.close('hostLeft');
    } else if (this.phase === 'result') this.tickResult(now);
    return this.flush();
  }

  /**
   * A player who was away when the game ended has their grace period to come back and see the result. After that
   * it's a drop after the game: the host gone closes the room, the guest gone puts the host back in the lobby.
   */
  private tickResult(now: number): void {
    const host = this.seats.p1;
    const guest = this.seats.p2;
    if (host && !host.connected && now >= host.graceUntil) this.close('hostLeft');
    else if (guest && !guest.bot && !guest.connected && now >= guest.graceUntil) {
      if (this.hostGone) this.close('hostLeft');
      else this.guestGoneAfterGame(now, false);
    }
  }

  private tickGame(now: number): void {
    for (const id of [HUMAN_ID, SECOND_HUMAN_ID] as const) {
      const seat = this.seats[id];
      if (!seat || seat.connected || seat.expired || now < seat.graceUntil) continue;
      const otherSeat = this.seats[other(id)];
      if (otherSeat && (otherSeat.bot || otherSeat.connected)) {
        this.depart(id, now);
      } else {
        // Both are away: the game stays frozen until one of them returns, or both have run out of time.
        seat.expired = true;
        if (!otherSeat || otherSeat.expired) this.close('expired');
      }
      if (this.closed || this.phase !== 'game') return;
    }

    if (this.frozen) {
      if (this.resumeAt === null || now < this.resumeAt) return;
      this.frozen = false;
      this.resumeAt = null;
      for (const seat of Object.values(this.seats)) {
        seat.firePressed = false;
        seat.mortarPressed = false;
      }
      this.loop.setPaused(false);
    }
    this.loop.frame(now);
  }

  /** One simulation tick, run by the fixed-step loop. */
  private step(): void {
    const match = this.match;
    if (!match || this.phase !== 'game') return;
    const inputs: Record<string, TankInput> = {};
    for (const [id, seat] of Object.entries(this.seats)) {
      if (seat.bot) {
        inputs[id] = botInput(match, id);
      } else {
        inputs[id] = {
          ...seat.input,
          fire: seat.input.fire || seat.firePressed,
          mortar: seat.input.mortar || seat.mortarPressed,
        };
        seat.firePressed = false;
        seat.mortarPressed = false;
      }
    }
    this.pending.push(...step(match, inputs));
    if (match.board.id !== this.boardId) {
      // The client holds a new board until the snapshot after it, so the old board's last moments still look right.
      this.boardId = match.board.id;
      this.broadcast({ t: 'board', board: match.board });
    }
    if (++this.steps % TICKS_PER_SNAPSHOT === 0 || match.phase === 'gameOver') this.snapshot();
    this.checkGameOver(this.clock);
  }

  private startGame(now: number): void {
    const match = createMatch(Room.twoPlayer(this.options), this.deps.seed());
    this.match = match;
    this.phase = 'game';
    this.frozen = false;
    this.resumeAt = null;
    this.pending = [];
    this.steps = 0;
    this.hostGone = false;
    this.idleSince = now;
    for (const seat of Object.values(this.seats)) {
      seat.input = { ...IDLE_INPUT, mortar: false };
      seat.firePressed = false;
      seat.mortarPressed = false;
    }
    this.loop.reset();
    this.loop.setPaused(false);
    this.boardId = match.board.id;
    this.broadcast({ t: 'board', board: match.board });
    this.snapshot();
  }

  private changeOptions(options: MatchOptions): void {
    const problem = Room.problemWith(options);
    if (problem) {
      this.send(HUMAN_ID, { t: 'refused', reason: 'invalid', detail: problem });
      return;
    }
    this.options = Room.twoPlayer(options);
    this.send(SECOND_HUMAN_ID, { t: 'options', options: this.options });
  }

  private addBot(now: number): void {
    if (!this.settings.testBot) {
      this.send(HUMAN_ID, {
        t: 'refused',
        reason: 'invalid',
        detail: 'The test bot is switched off on this server.',
      });
      return;
    }
    if (this.seats.p2) {
      this.send(HUMAN_ID, { t: 'refused', reason: 'full' });
      return;
    }
    this.seats.p2 = { ...newSeat(''), bot: true };
    this.startGame(now);
  }

  private seatGuest(seat: Seat): void {
    this.seats.p2 = seat;
    this.send(SECOND_HUMAN_ID, this.roomMessage(SECOND_HUMAN_ID));
    this.send(HUMAN_ID, { t: 'lobby', guest: true });
  }

  private reconnect(id: SeatId, now: number): void {
    const seat = this.seats[id]!;
    const wasAway = !seat.connected;
    seat.connected = true;
    seat.expired = false;
    this.send(id, this.roomMessage(id));
    if (this.phase === 'lobby') return;

    const match = this.match!;
    this.send(id, { t: 'board', board: match.board });
    this.send(id, { t: 'snap', ...snapshotOf(match, []) });
    // A guest back to find the host left while they were away has seen the result; now they're told.
    if (this.phase === 'result' && this.hostGone) this.close('hostLeft');
    if (this.phase !== 'game') return;

    const otherId = other(id);
    if (this.seats[otherId]?.expired) {
      // Their time ran out while this player was away too: they've left, and this player plays on.
      this.depart(otherId, now);
      if (this.closed || this.phase !== 'game') return;
    }
    const otherSeat = this.seats[otherId];
    if (otherSeat && !otherSeat.bot && !otherSeat.connected) {
      this.send(id, { t: 'frozen', seat: otherId, until: Math.max(0, otherSeat.graceUntil - now) });
    } else if (this.resumeAt !== null) {
      this.send(id, { t: 'resume', at: Math.max(0, this.resumeAt - now) });
    } else if (wasAway) {
      this.resume(now);
    }
  }

  /** Starts the 3-2-1 before a frozen game carries on. */
  private resume(now: number): void {
    this.resumeAt = now + RESUME_MS;
    this.broadcast({ t: 'resume', at: RESUME_MS });
  }

  /** Stops the game's clock until it resumes. Anything that happened before the drop is sent first. */
  private freeze(): void {
    if (this.pending.length > 0) this.snapshot();
    this.frozen = true;
    this.resumeAt = null;
    this.loop.setPaused(true);
  }

  private leaveOnPurpose(id: SeatId, now: number): void {
    switch (this.phase) {
      case 'lobby':
        if (id === HUMAN_ID) {
          this.close('hostLeft');
        } else {
          this.goneTokens.add(this.seats.p2!.token);
          delete this.seats.p2;
          this.send(HUMAN_ID, { t: 'lobby', guest: false });
        }
        break;
      case 'game':
        this.depart(id, now);
        break;
      case 'result':
        if (id === HUMAN_ID) this.close('hostLeft');
        else this.guestGoneAfterGame(now, true);
        break;
    }
  }

  /**
   * A player leaves a game in progress, on purpose or because their grace period ran out. The game's rules decide
   * what that means: a forfeit in Last One Standing, playing on alone in Waves.
   */
  private depart(id: SeatId, now: number): void {
    const seat = this.seats[id]!;
    this.goneTokens.add(seat.token);
    delete this.seats[id];
    if (id === HUMAN_ID) this.hostGone = true;

    const remaining = this.seats[other(id)];
    if (!remaining || remaining.bot) {
      this.close(id === HUMAN_ID ? 'hostLeft' : 'expired');
      return;
    }
    this.pending.push(...leave(this.match!, id));
    this.snapshot();
    this.checkGameOver(now);
    if (this.phase !== 'game') return;
    if (this.frozen && remaining.connected && this.resumeAt === null) this.resume(now);
  }

  private checkGameOver(now: number): void {
    if (this.phase !== 'game' || this.match?.phase !== 'gameOver') return;
    this.phase = 'result';
    this.frozen = false;
    this.resumeAt = null;
    // The result screen waits for the host; waiting there too long closes the room like an idle lobby.
    this.idleSince = now;
    // With the host gone, the guest is told once they've seen the result: now, or when they're back.
    if (this.hostGone && this.seats.p2?.connected) this.close('hostLeft');
  }

  /** The guest leaves after a game: the host is back in the lobby, waiting for a player, with the same code. */
  private guestGoneAfterGame(now: number, onPurpose: boolean): void {
    const guest = this.seats.p2;
    if (guest) (onPurpose ? this.goneTokens : this.droppedGuests).add(guest.token);
    delete this.seats.p2;
    this.phase = 'lobby';
    this.idleSince = now;
    this.send(HUMAN_ID, { t: 'lobby', guest: false });
  }

  private backToLobby(now: number): void {
    if (this.seats.p2?.bot) delete this.seats.p2;
    this.phase = 'lobby';
    this.idleSince = now;
    this.broadcast({ t: 'lobby', guest: this.hasGuest });
  }

  private snapshot(): void {
    this.broadcast({ t: 'snap', ...snapshotOf(this.match!, this.pending) });
    this.pending = [];
  }

  private close(reason: 'hostLeft' | 'expired'): void {
    // The host is the one who left, so only the guest needs telling; anyone else is told the room has expired.
    for (const id of reason === 'hostLeft' ? [SECOND_HUMAN_ID] : [HUMAN_ID, SECOND_HUMAN_ID]) {
      this.send(id as SeatId, { t: 'closed', reason });
    }
    this.closed = true;
  }

  private roomMessage(id: SeatId): ServerMessage {
    return {
      t: 'room',
      code: this.code,
      seat: id,
      token: this.seats[id]!.token,
      options: this.options,
      guest: this.hasGuest,
    };
  }

  /** Queues a message for a connected human in a seat; the bot and players who are away get nothing. */
  private send(id: SeatId, message: ServerMessage): void {
    const seat = this.seats[id];
    if (seat && !seat.bot && seat.connected) this.out.push({ seat: id, message });
  }

  private broadcast(message: ServerMessage): void {
    this.send(HUMAN_ID, message);
    this.send(SECOND_HUMAN_ID, message);
  }
}

function newSeat(token: string): Seat {
  return {
    token,
    bot: false,
    connected: true,
    graceUntil: 0,
    expired: false,
    input: { ...IDLE_INPUT, mortar: false },
    firePressed: false,
    mortarPressed: false,
  };
}

function other(id: SeatId): SeatId {
  return id === HUMAN_ID ? SECOND_HUMAN_ID : HUMAN_ID;
}
