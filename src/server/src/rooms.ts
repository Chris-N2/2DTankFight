import { normalizeCode, randomCode, type RefusedReason, type SeatId } from '@tank/protocol';
import type { MatchOptions } from '@tank/sim';
import { Room, type Outgoing, type RoomDeps, type RoomSettings } from './room';

export interface RegistrySettings extends RoomSettings {
  /** The most rooms open at once. */
  maxRooms: number;
}

export interface RegistryDeps extends RoomDeps {
  /** A float in [0, 1), like `Math.random`, for room codes. */
  random(): number;
}

/** A player now sitting in a room, and the messages that brought them there. */
export interface Seated {
  room: Room;
  seat: SeatId;
  out: Outgoing[];
}

export type Refused = { refused: RefusedReason; detail?: string };

/** Every open room, by code. Creating, finding, joining and rejoining rooms all start here. */
export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly settings: RegistrySettings,
    private readonly deps: RegistryDeps,
  ) {}

  get size(): number {
    return this.rooms.size;
  }

  /** Every open room. */
  all(): Room[] {
    return [...this.rooms.values()];
  }

  /** The open room with this code, in any letter case. */
  find(code: string): Room | undefined {
    const room = this.rooms.get(normalizeCode(code));
    return room && !room.closed ? room : undefined;
  }

  /** A host asks for a room. Invalid options are refused with the reason, and so is a room past the cap. */
  create(options: MatchOptions, now: number): Seated | Refused {
    const problem = Room.problemWith(options);
    if (problem) return { refused: 'invalid', detail: problem };
    this.sweep();
    if (this.rooms.size >= this.settings.maxRooms) return { refused: 'busy' };
    let code: string;
    do code = randomCode(this.deps.random);
    while (this.rooms.has(code));
    const room = new Room(code, Room.twoPlayer(options), this.settings, this.deps, now);
    this.rooms.set(code, room);
    return { room, seat: 'p1', out: room.flush() };
  }

  join(code: string): Seated | Refused {
    const room = this.find(code);
    if (!room) return { refused: 'noSuchGame' };
    const joined = room.join();
    return 'refused' in joined ? joined : { room, ...joined };
  }

  /** A token for a room the player has left reports `gone`, so they can be told the game went on without them. */
  rejoin(code: string, token: string, now: number): Seated | Refused | { gone: true } {
    const room = this.find(code);
    if (!room) return { refused: 'noSuchGame' };
    const back = room.rejoin(token, now);
    return 'seat' in back ? { room, ...back } : back;
  }

  /** Moves every room's time on, and forgets rooms that have closed. */
  tick(now: number): { room: Room; out: Outgoing[] }[] {
    const sent = this.all().map((room) => ({ room, out: room.tick(now) }));
    this.sweep();
    return sent;
  }

  /** Forgets rooms that have closed, freeing their codes. */
  sweep(): void {
    for (const [code, room] of this.rooms) if (room.closed) this.rooms.delete(code);
  }
}
