// Gameplay colours are fixed, whatever the theme, so what players react to stays recognisable.

/**
 * Tank colours by colorIndex, as the simulation hands them out: the host (and the only human in single-player) is
 * index 0, green; a second human is index 2, blue. AI tanks never get blue when there are two humans.
 */
export const PALETTE: readonly string[] = ['#7be36f', '#ff6b5e', '#5eaaff', '#ffd35e', '#d78bff'];

/** You are always green... */
export const YOU_INDEX = 0;
/** ...and the other human is always blue. */
export const OTHER_HUMAN_INDEX = 2;

/**
 * The palette index to draw a tank in, on the screen of the player in seat `viewer`. The simulation's indices are the
 * host's view; the guest sees the two humans swapped, so each player is green on their own screen. AI colours are the
 * same for both.
 */
export function viewerColourIndex(colorIndex: number, viewer: string): number {
  if (viewer !== 'p2') return colorIndex;
  if (colorIndex === YOU_INDEX) return OTHER_HUMAN_INDEX;
  if (colorIndex === OTHER_HUMAN_INDEX) return YOU_INDEX;
  return colorIndex;
}

export const SHELL = '#fff8dc';
