import { describe, expect, test } from 'vitest';
import {
  BUTTON,
  inputFromGamepad,
  isActive,
  MENU_STICK_THRESHOLD,
  MenuInput,
  REPEAT_DELAY_MS,
  REPEAT_INTERVAL_MS,
  STICK_DEAD_ZONE,
  TRIGGER_THRESHOLD,
  type GamepadSnapshot,
} from '../src/gamepad';

/** A standard-layout pad with the given stick position and buttons (index → analogue value, or pressed). */
function pad(
  opts: { x?: number; y?: number; buttons?: Record<number, number | boolean> } = {},
): GamepadSnapshot {
  const buttons = Array.from({ length: 17 }, (_, i) => {
    const b = opts.buttons?.[i];
    const value = typeof b === 'number' ? b : b ? 1 : 0;
    return { pressed: typeof b === 'boolean' ? b : value >= 0.5, value };
  });
  return { axes: [opts.x ?? 0, opts.y ?? 0, 0, 0], buttons };
}

describe('gamepad controls', () => {
  test('Analogue steering', () => {
    const half = inputFromGamepad(pad({ x: 0.6 }));
    const full = inputFromGamepad(pad({ x: 1 }));
    expect(full.turn).toBe(1);
    expect(half.turn).toBeGreaterThan(0);
    expect(half.turn).toBeLessThan(full.turn);
    expect(half.throttle).toBe(0);
    // Rescaled from the dead zone's edge, so steering starts from zero rather than jumping.
    expect(inputFromGamepad(pad({ x: STICK_DEAD_ZONE + 0.01 })).turn).toBeCloseTo(0.0125, 3);
    expect(inputFromGamepad(pad({ x: -1 })).turn).toBe(-1);
  });

  test('Stick dead zone', () => {
    for (const [x, y] of [
      [0.1, 0.1],
      [-0.15, 0],
      [0, 0.19],
    ] as const) {
      expect(inputFromGamepad(pad({ x, y }))).toEqual({ throttle: 0, turn: 0, fire: false });
    }
  });

  test('pushing the stick up or down drives once it is clearly pushed', () => {
    expect(inputFromGamepad(pad({ y: -1 })).throttle).toBe(1);
    expect(inputFromGamepad(pad({ y: 1 })).throttle).toBe(-1);
    expect(inputFromGamepad(pad({ y: -0.4 })).throttle).toBe(0);
    // Driving forward with a small sideways wobble doesn't steer.
    expect(inputFromGamepad(pad({ x: 0.15, y: -0.9 })).turn).toBe(0);
  });

  test('Fire with A or the trigger', () => {
    expect(inputFromGamepad(pad({ buttons: { [BUTTON.A]: true } })).fire).toBe(true);
    expect(inputFromGamepad(pad({ buttons: { [BUTTON.RT]: TRIGGER_THRESHOLD } })).fire).toBe(true);
    expect(inputFromGamepad(pad({ buttons: { [BUTTON.RT]: 0.3 } })).fire).toBe(false);
    expect(inputFromGamepad(pad()).fire).toBe(false);
  });

  test('the d-pad steers and drives like the keyboard', () => {
    expect(inputFromGamepad(pad({ buttons: { [BUTTON.UP]: true, [BUTTON.LEFT]: true } }))).toEqual({
      throttle: 1,
      turn: -1,
      fire: false,
    });
    expect(inputFromGamepad(pad({ buttons: { [BUTTON.DOWN]: true, [BUTTON.RIGHT]: true } }))).toEqual({
      throttle: -1,
      turn: 1,
      fire: false,
    });
    // The stronger of stick and d-pad wins.
    expect(inputFromGamepad(pad({ x: 0.5, buttons: { [BUTTON.RIGHT]: true } })).turn).toBe(1);
  });

  test('LB and RB do nothing yet', () => {
    expect(inputFromGamepad(pad({ buttons: { [BUTTON.LB]: true, [BUTTON.RB]: true } }))).toEqual({
      throttle: 0,
      turn: 0,
      fire: false,
    });
  });

  test('missing or broken axes and buttons are treated as idle', () => {
    expect(inputFromGamepad({ axes: [], buttons: [] })).toEqual({ throttle: 0, turn: 0, fire: false });
    expect(inputFromGamepad({ axes: [NaN, NaN], buttons: [] })).toEqual({
      throttle: 0,
      turn: 0,
      fire: false,
    });
  });

  test('activity means a button pressed or the stick out of its dead zone', () => {
    expect(isActive(pad())).toBe(false);
    expect(isActive(pad({ x: 0.1 }))).toBe(false);
    expect(isActive(pad({ x: 0.5 }))).toBe(true);
    expect(isActive(pad({ buttons: { [BUTTON.START]: true } }))).toBe(true);
  });
});

describe('gamepad menu input', () => {
  test('buttons act once per press', () => {
    const menu = new MenuInput();
    const a = pad({ buttons: { [BUTTON.A]: true } });
    expect(menu.update([a], 0)).toEqual(['confirm']);
    expect(menu.update([a], 16)).toEqual([]);
    expect(menu.update([a], 5000)).toEqual([]); // buttons never repeat
    expect(menu.update([pad()], 5016)).toEqual([]);
    expect(menu.update([a], 5032)).toEqual(['confirm']);
    expect(menu.update([pad({ buttons: { [BUTTON.B]: true, [BUTTON.START]: true } })], 6000)).toEqual([
      'back',
      'start',
    ]);
  });

  test('held directions repeat after a delay', () => {
    const menu = new MenuInput();
    const down = pad({ buttons: { [BUTTON.DOWN]: true } });
    expect(menu.update([down], 1000)).toEqual(['down']);
    expect(menu.update([down], 1000 + REPEAT_DELAY_MS - 1)).toEqual([]);
    expect(menu.update([down], 1000 + REPEAT_DELAY_MS)).toEqual(['down']);
    expect(menu.update([down], 1000 + REPEAT_DELAY_MS + REPEAT_INTERVAL_MS - 1)).toEqual([]);
    expect(menu.update([down], 1000 + REPEAT_DELAY_MS + REPEAT_INTERVAL_MS)).toEqual(['down']);
    // Releasing and pressing again acts straight away.
    expect(menu.update([pad()], 2000)).toEqual([]);
    expect(menu.update([down], 2001)).toEqual(['down']);
  });

  test('the stick counts as a direction once pushed past the threshold', () => {
    const menu = new MenuInput();
    expect(menu.update([pad({ x: MENU_STICK_THRESHOLD - 0.1 })], 0)).toEqual([]);
    expect(menu.update([pad({ x: MENU_STICK_THRESHOLD })], 16)).toEqual(['right']);
    expect(menu.update([pad({ y: -1 })], 32)).toEqual(['up']);
  });

  test('presses from any connected pad count, and a press held on two pads acts once', () => {
    const menu = new MenuInput();
    const a = pad({ buttons: { [BUTTON.A]: true } });
    expect(menu.update([pad(), a], 0)).toEqual(['confirm']);
    expect(menu.update([a, a], 16)).toEqual([]);
  });
});
