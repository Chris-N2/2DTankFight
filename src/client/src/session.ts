import type { ClientMessage, SeatId, ServerMessage } from '@tank/protocol';
import type { MatchOptions, TankInput } from '@tank/sim';
import { closedText, failureText, refusedText } from './lobby';
import {
  InputSender,
  type ConnectionEvents,
  type ConnectionFailure,
  type SeatStore,
  type StoredSeat,
} from './net';
import { OnlineMirror } from './online';

/** Where an online session is. `ended` is back to the setup screen, with a `notice` saying why if there's a reason. */
export type OnlinePhase = 'connecting' | 'lobby' | 'game' | 'ended';

/** The parts of a connection the session uses (tests pass a fake). */
export interface ConnectionLike {
  connect(): void;
  send(msg: ClientMessage): void;
  close(): void;
}

export interface SessionDeps {
  /** The server's address, kept with the seat so a refresh only rejoins on the same server. */
  server: string;
  /** Makes the connection, which reports back through `events`. */
  connect(events: ConnectionEvents): ConnectionLike;
  store: SeatStore;
  now(): number;
  /** Called whenever something on show may have changed. */
  changed(): void;
  /** Called once a room has been joined, so the page can drop the code from its address. */
  joined?(): void;
}

/** What the session was asked to do when it connected. */
type Intent =
  | { t: 'create'; options: MatchOptions }
  | { t: 'join'; code: string }
  | { t: 'rejoin'; code: string; token: string };

/**
 * One trip into online play: hosting or joining a room, the lobby, the games played there, and getting back in after
 * a drop. It follows what the server says, and the page draws whatever it says is on.
 */
export class OnlineSession {
  phase: OnlinePhase = 'connecting';
  seat: SeatId | null = null;
  code: string | null = null;
  options: MatchOptions | null = null;
  /** Whether the second seat is filled (by a guest or the bot). */
  guest = false;
  /** Whether the server offers the test bot. */
  botOffered = false;
  /**
   * Whether the second seat is (or is about to be) the test bot: from asking for it until the room is back in the
   * lobby, which sends the bot away. Games against it don't earn achievements.
   */
  vsBot = false;
  /** This player's own connection dropped and is trying to get back. */
  reconnecting = false;
  /** The other player dropped: when their grace period ends. */
  othersDeadline: number | null = null;
  /** During the 3-2-1 after a freeze: when play resumes. */
  resumeAt: number | null = null;
  /** The host left while this player was in a game: they see the result, then go. */
  hostLeft = false;
  /** Something the lobby should say: an option the server refused, say. */
  lobbyNote: string | null = null;
  /** Why the session ended, for the setup screen; null when it just ended (the player left). */
  notice: string | null = null;
  /** Goes up each time a new game starts, or the game is picked up again after a drop. */
  gameId = 0;
  readonly mirror: OnlineMirror;

  private readonly conn: ConnectionLike;
  private readonly sender: InputSender;
  private token: string | null = null;
  /** Asked to create, join or rejoin, and not answered yet: a refusal now is about the seat, not an option. */
  private awaitingSeat = false;

  constructor(
    private intent: Intent,
    private readonly deps: SessionDeps,
  ) {
    this.mirror = new OnlineMirror(intent.t === 'create' ? intent.options : ({} as MatchOptions));
    this.conn = deps.connect({
      open: () => this.onOpen(),
      message: (msg) => this.onMessage(msg),
      dropped: () => {
        this.reconnecting = true;
        this.deps.changed();
      },
      failed: (why) => this.onFailed(why),
    });
    this.sender = new InputSender((msg) => this.conn.send(msg));
    this.conn.connect();
  }

  static host(options: MatchOptions, deps: SessionDeps): OnlineSession {
    return new OnlineSession({ t: 'create', options }, deps);
  }

  static join(code: string, deps: SessionDeps): OnlineSession {
    return new OnlineSession({ t: 'join', code }, deps);
  }

  /** Back into the seat this tab held, after a page reload. */
  static rejoin(seat: StoredSeat, deps: SessionDeps): OnlineSession {
    const session = new OnlineSession({ t: 'rejoin', code: seat.code, token: seat.token }, deps);
    // The stored seat remembers whether this was a game against the bot. (The intent goes to the server as it is.)
    session.vsBot = seat.vsBot === true;
    return session;
  }

  get isHost(): boolean {
    return this.seat === 'p1';
  }

  /** The host changes the room's options in the lobby. */
  setOptions(options: MatchOptions): void {
    if (!this.isHost || this.phase !== 'lobby') return;
    this.options = options;
    this.mirror.setOptions(options);
    this.lobbyNote = null;
    this.conn.send({ t: 'options', options });
  }

  start(): void {
    if (this.isHost && this.phase === 'lobby' && this.guest) this.conn.send({ t: 'start' });
  }

  playBot(): void {
    if (this.isHost && this.phase === 'lobby' && !this.guest && this.botOffered) {
      this.setVsBot(true);
      this.conn.send({ t: 'bot' });
    }
  }

  /** Whether the bot is in the second seat, kept with the stored seat so it survives a refresh. */
  private setVsBot(vsBot: boolean): void {
    if (this.vsBot === vsBot) return;
    this.vsBot = vsBot;
    this.saveSeat();
  }

  private saveSeat(): void {
    if (this.seat === null || this.code === null || this.token === null) return;
    const seat: StoredSeat = {
      server: this.deps.server,
      code: this.code,
      seat: this.seat,
      token: this.token,
    };
    this.deps.store.save(this.vsBot ? { ...seat, vsBot: true } : seat);
  }

  playAgain(): void {
    if (this.isHost && this.phase === 'game' && this.guest) this.conn.send({ t: 'playAgain' });
  }

  toLobby(): void {
    if (this.isHost && this.phase === 'game') this.conn.send({ t: 'toLobby' });
  }

  /** Leaves the room on purpose, straight back to the setup screen. */
  leave(): void {
    if (this.phase === 'ended') return;
    this.conn.send({ t: 'leave' });
    this.end(null);
  }

  /** The player's controls, sent while a game is on (when they change, and as a heartbeat). */
  sendInput(input: TankInput, now: number): void {
    if (this.phase === 'game' && !this.hostLeft) this.sender.update(input, now);
  }

  /** Moves time on: the 3-2-1 after a freeze runs out here. */
  tick(now: number): void {
    if (this.resumeAt !== null && now >= this.resumeAt) {
      this.resumeAt = null;
      this.othersDeadline = null;
      this.deps.changed();
    }
  }

  private onOpen(): void {
    this.conn.send({ t: 'hello' });
    // Back after a drop, or after a refresh: the token gets the seat back. Otherwise, do what was asked.
    if (this.code !== null && this.token !== null)
      this.intent = { t: 'rejoin', code: this.code, token: this.token };
    this.conn.send(this.intent);
    this.awaitingSeat = true;
    this.sender.reset();
  }

  private onMessage(msg: ServerMessage): void {
    const now = this.deps.now();
    switch (msg.t) {
      case 'welcome':
        this.botOffered = msg.bot;
        break;
      case 'room': {
        const first = this.seat === null;
        this.seat = msg.seat;
        this.code = msg.code;
        this.token = msg.token;
        this.options = msg.options;
        this.guest = msg.guest;
        this.reconnecting = false;
        this.awaitingSeat = false;
        this.othersDeadline = null;
        this.resumeAt = null;
        this.mirror.setOptions(msg.options);
        this.mirror.reset();
        // A game in progress follows with its board and a snapshot; until then, this is the lobby.
        this.phase = 'lobby';
        this.saveSeat();
        if (first) this.deps.joined?.();
        break;
      }
      case 'refused':
        // In the lobby, a refusal is the server turning down an option (or the bot). But one that answers a create,
        // join or rejoin means there's no seat to be had, wherever the player was: back in after a drop included.
        if (this.phase === 'lobby' && !this.awaitingSeat) {
          this.lobbyNote = refusedText(msg.reason, msg.detail);
          this.setVsBot(false);
        } else if (this.intent.t === 'rejoin' && (msg.reason === 'noSuchGame' || msg.reason === 'invalid')) {
          this.end('The game you were in has ended.');
        } else this.end(refusedText(msg.reason, msg.detail));
        break;
      case 'options':
        this.options = msg.options;
        this.mirror.setOptions(msg.options);
        break;
      case 'board':
        this.mirror.setBoard(msg.board);
        break;
      case 'snap': {
        const latest = this.mirror.latest;
        if (this.phase !== 'game' || (latest !== null && msg.tick < latest.tick)) {
          // A new game, or the one in progress picked up again after a drop.
          this.phase = 'game';
          this.hostLeft = false;
          this.gameId++;
          if (this.options) this.mirror.setOptions(this.options);
        }
        this.mirror.push(msg);
        // The other human left mid-game (on purpose, or out of time): their seat is empty now, so there's nobody to
        // play again with until another player joins.
        if (this.isHost && msg.events.some((e) => e.type === 'left' && e.tankId !== this.seat))
          this.guest = false;
        break;
      }
      case 'frozen':
        this.othersDeadline = now + msg.until;
        this.resumeAt = null;
        break;
      case 'resume':
        this.resumeAt = now + msg.at;
        break;
      case 'lobby':
        this.phase = 'lobby';
        this.guest = msg.guest;
        this.setVsBot(false);
        this.othersDeadline = null;
        this.resumeAt = null;
        break;
      case 'closed':
        if (msg.reason === 'hostLeft' && this.phase === 'game') {
          // The game has just ended; the result is still on its way to the screen.
          this.hostLeft = true;
          this.deps.store.clear();
          this.conn.close();
        } else {
          this.end(closedText(msg.reason));
        }
        break;
    }
    this.deps.changed();
  }

  private onFailed(why: ConnectionFailure): void {
    if (this.phase === 'ended' || this.hostLeft) return;
    this.end(failureText(why));
  }

  private end(notice: string | null): void {
    this.phase = 'ended';
    this.notice = notice;
    this.reconnecting = false;
    this.deps.store.clear();
    this.conn.close();
    this.deps.changed();
  }
}
