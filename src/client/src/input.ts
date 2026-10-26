import type { TankInput } from '@tank/sim';
import type { MenuAction } from './gamepad';

/** Keys the game uses while a round is in progress (KeyboardEvent.code, so layout-independent). */
export const GAME_KEYS: ReadonlySet<string> = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'Space',
]);

/** Maps the set of currently pressed keys to a tank input. Opposing keys cancel out. */
export function inputFromKeys(pressed: ReadonlySet<string>): TankInput {
  const forward = pressed.has('ArrowUp') || pressed.has('KeyW');
  const back = pressed.has('ArrowDown') || pressed.has('KeyS');
  const left = pressed.has('ArrowLeft') || pressed.has('KeyA');
  const right = pressed.has('ArrowRight') || pressed.has('KeyD');
  return {
    throttle: forward === back ? 0 : forward ? 1 : -1,
    turn: left === right ? 0 : left ? -1 : 1,
    fire: pressed.has('Space'),
  };
}

const MENU_KEYS: Readonly<Record<string, MenuAction>> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

/**
 * The menu move a key makes on the setup and result screens, or null. The driving keys move round the menus
 * just as the d-pad does; Enter and Space are left to the focused button.
 */
export function menuActionForKey(code: string): MenuAction | null {
  return MENU_KEYS[code] ?? null;
}

/** The parts of a KeyboardEvent we use, so the handler can be tested without a DOM. */
export interface KeyEventLike {
  code: string;
  preventDefault(): void;
}

/** Tracks pressed game keys and samples them into a TankInput once per tick. */
export class KeyboardState {
  private readonly pressed = new Set<string>();
  /** While a game is active, game keys are captured so they don't scroll or otherwise affect the page. */
  active = false;

  onKeyDown(e: KeyEventLike): void {
    if (!GAME_KEYS.has(e.code)) return;
    if (this.active) e.preventDefault();
    this.pressed.add(e.code);
  }

  onKeyUp(e: KeyEventLike): void {
    if (!GAME_KEYS.has(e.code)) return;
    if (this.active) e.preventDefault();
    this.pressed.delete(e.code);
  }

  /** Releases everything — used when the window loses focus, so keys can't get stuck down. */
  clear(): void {
    this.pressed.clear();
  }

  sample(): TankInput {
    return inputFromKeys(this.pressed);
  }
}

/** Picks the stronger of two values; equally strong opposites cancel out, like opposing keys. */
function stronger<T extends number>(a: T, b: T): T | 0 {
  if (Math.abs(a) > Math.abs(b)) return a;
  if (Math.abs(b) > Math.abs(a)) return b;
  return a === b ? a : 0;
}

/**
 * Combines inputs from several devices (keyboard and any gamepads) into one: the stronger turn and
 * throttle win, and fire is held if any device holds it.
 */
export function combineInputs(...inputs: TankInput[]): TankInput {
  let combined: TankInput = { throttle: 0, turn: 0, fire: false };
  for (const input of inputs) {
    combined = {
      throttle: stronger(combined.throttle, input.throttle),
      turn: stronger(combined.turn, input.turn),
      fire: combined.fire || input.fire,
    };
  }
  return combined;
}

/**
 * Stops a fire button that's still held from the menus firing the moment play begins. Arm it when a
 * game starts; fire then reads as released until the player actually lets go.
 */
export class FireLatch {
  private armed = false;

  arm(): void {
    this.armed = true;
  }

  apply(input: TankInput): TankInput {
    if (!this.armed) return input;
    if (!input.fire) this.armed = false;
    return { ...input, fire: false };
  }
}
