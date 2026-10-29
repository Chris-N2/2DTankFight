import type { MatchState, SimEvent } from '@tank/sim';

/** The fields of a match that change while it's played: everything needed to draw the arena and the HUD. */
export const SNAPSHOT_FIELDS = [
  'tick',
  'phase',
  'phaseTicks',
  'round',
  'roundsPlayed',
  'scores',
  'lastRoundOutcome',
  'lastRoundScorers',
  'result',
  'winnerId',
  'forfeit',
  'waves',
  'tanks',
  'shells',
  'mortarShells',
] as const satisfies readonly (keyof MatchState)[];

export type SnapshotField = (typeof SNAPSHOT_FIELDS)[number];

/**
 * A match cut down to its dynamic state, plus every event since the previous snapshot, in order. The board, the
 * navigation grid, the random number generators and the AI's memory stay on the server: the board is sent on its own
 * when it changes, and the rest is nobody's business but the simulation's.
 */
export type Snapshot = Pick<MatchState, SnapshotField> & { events: SimEvent[] };

/** Cuts a snapshot from `state`. It copies, so later steps of the match can't change a snapshot already taken. */
export function snapshotOf(state: MatchState, events: readonly SimEvent[]): Snapshot {
  const picked: Partial<Record<SnapshotField, unknown>> = {};
  for (const field of SNAPSHOT_FIELDS) picked[field] = state[field];
  return JSON.parse(JSON.stringify({ ...picked, events })) as Snapshot;
}
