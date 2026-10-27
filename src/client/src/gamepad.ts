import type { TankInput } from '@tank/sim';
import { combineInputs } from './input';

/**
 * The parts of the browser's Gamepad the game reads. A real `Gamepad` satisfies it as-is, and tests
 * can build plain objects, so all the mapping logic runs without a browser.
 */
export interface GamepadSnapshot {
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
}

/** Button indices in the browser's "standard" gamepad layout (Xbox-style names). */
export const BUTTON = {
  /** Bottom face button. */
  A: 0,
  /** Right face button. */
  B: 1,
  /** Mortar. */
  LB: 4,
  /** Mortar. */
  RB: 5,
  RT: 7,
  START: 9,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const;

const AXIS_X = 0;
const AXIS_Y = 1;

/** Stick movement inside this radius is ignored, so a drifting stick doesn't creep the tank. */
export const STICK_DEAD_ZONE = 0.2;
/** How far the stick must be pushed up or down to drive forward or reverse. */
export const STICK_THROTTLE_THRESHOLD = 0.5;
/** How far the right trigger must be pulled to fire. */
export const TRIGGER_THRESHOLD = 0.5;

function isPressed(pad: GamepadSnapshot, index: number): boolean {
  return pad.buttons[index]?.pressed ?? false;
}

function axis(pad: GamepadSnapshot, index: number): number {
  const value = pad.axes[index] ?? 0;
  return Number.isFinite(value) ? value : 0;
}

/** The left stick's position, with the dead zone applied. Both are 0 inside the dead zone. */
function stick(pad: GamepadSnapshot): { x: number; y: number } {
  const x = axis(pad, AXIS_X);
  const y = axis(pad, AXIS_Y);
  return Math.hypot(x, y) < STICK_DEAD_ZONE ? { x: 0, y: 0 } : { x, y };
}

/**
 * Maps one gamepad to a tank input. The stick steers in proportion to how far it's pushed sideways,
 * rescaled from the dead zone's edge so steering doesn't jump as it leaves it; driving is forward or
 * reverse once the stick is pushed clearly up or down. The d-pad steers and drives like the keyboard.
 */
export function inputFromGamepad(pad: GamepadSnapshot): TankInput {
  const { x, y } = stick(pad);
  const sideways = Math.max(0, Math.abs(x) - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE);
  const fromStick: TankInput = {
    throttle: y <= -STICK_THROTTLE_THRESHOLD ? 1 : y >= STICK_THROTTLE_THRESHOLD ? -1 : 0,
    turn: Math.sign(x) * Math.min(1, sideways),
    fire: false,
    mortar: false,
  };

  const up = isPressed(pad, BUTTON.UP);
  const down = isPressed(pad, BUTTON.DOWN);
  const left = isPressed(pad, BUTTON.LEFT);
  const right = isPressed(pad, BUTTON.RIGHT);
  const fromDpad: TankInput = {
    throttle: up === down ? 0 : up ? 1 : -1,
    turn: left === right ? 0 : left ? -1 : 1,
    fire: isPressed(pad, BUTTON.A) || (pad.buttons[BUTTON.RT]?.value ?? 0) >= TRIGGER_THRESHOLD,
    mortar: isPressed(pad, BUTTON.LB) || isPressed(pad, BUTTON.RB),
  };

  return combineInputs(fromStick, fromDpad);
}

/** True if anything on the pad is being used: a button pressed or the stick out of its dead zone. */
export function isActive(pad: GamepadSnapshot): boolean {
  const { x, y } = stick(pad);
  return x !== 0 || y !== 0 || pad.buttons.some((b) => b.pressed);
}

export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'start';

const DIRECTIONS: readonly MenuAction[] = ['up', 'down', 'left', 'right'];
const ACTIONS: readonly MenuAction[] = [...DIRECTIONS, 'confirm', 'back', 'start'];

/** A held direction repeats after this long... */
export const REPEAT_DELAY_MS = 400;
/** ...and then this often. */
export const REPEAT_INTERVAL_MS = 120;
/** How far the stick must be pushed to count as a menu direction. */
export const MENU_STICK_THRESHOLD = 0.5;

function heldActions(pad: GamepadSnapshot): Set<MenuAction> {
  const x = axis(pad, AXIS_X);
  const y = axis(pad, AXIS_Y);
  const held = new Set<MenuAction>();
  if (isPressed(pad, BUTTON.UP) || y <= -MENU_STICK_THRESHOLD) held.add('up');
  if (isPressed(pad, BUTTON.DOWN) || y >= MENU_STICK_THRESHOLD) held.add('down');
  if (isPressed(pad, BUTTON.LEFT) || x <= -MENU_STICK_THRESHOLD) held.add('left');
  if (isPressed(pad, BUTTON.RIGHT) || x >= MENU_STICK_THRESHOLD) held.add('right');
  if (isPressed(pad, BUTTON.A)) held.add('confirm');
  if (isPressed(pad, BUTTON.B)) held.add('back');
  if (isPressed(pad, BUTTON.START)) held.add('start');
  return held;
}

/**
 * Turns polled gamepad state into menu actions. Buttons act once per press; directions act on press
 * and then repeat while held. Call `update` every frame, even during play, so presses that began
 * earlier aren't mistaken for new ones later.
 */
export class MenuInput {
  /** For each held action, when it next fires (Infinity for actions that don't repeat). */
  private readonly nextAt = new Map<MenuAction, number>();

  update(pads: readonly GamepadSnapshot[], now: number): MenuAction[] {
    const held = new Set<MenuAction>();
    for (const pad of pads) for (const action of heldActions(pad)) held.add(action);

    const actions: MenuAction[] = [];
    for (const action of ACTIONS) {
      if (!held.has(action)) {
        this.nextAt.delete(action);
        continue;
      }
      const next = this.nextAt.get(action);
      const repeats = DIRECTIONS.includes(action);
      if (next === undefined) {
        actions.push(action);
        this.nextAt.set(action, repeats ? now + REPEAT_DELAY_MS : Infinity);
      } else if (now >= next) {
        actions.push(action);
        this.nextAt.set(action, now + REPEAT_INTERVAL_MS);
      }
    }
    return actions;
  }
}
