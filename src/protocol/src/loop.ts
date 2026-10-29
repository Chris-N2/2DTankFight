export interface FrameResult {
  /** Simulation ticks run during this frame. */
  steps: number;
  /** How far between the last tick and the next one we are, in [0, 1), for interpolation. */
  alpha: number;
}

/** Tolerance so floating-point rounding can't make a display at exactly the tick rate skip a tick. */
const EPSILON_MS = 1e-6;

/**
 * Fixed-timestep accumulator. Feed it the current time once per animation frame and it runs
 * `onStep` as many times as real time requires. Time is passed in (rather than read from a
 * clock) so the loop can be tested with a fake clock.
 */
export class FixedStepLoop {
  private accumulator = 0;
  private last: number | null = null;
  private paused = false;

  constructor(
    private readonly stepMs: number,
    private readonly onStep: () => void,
    /** Cap on ticks per frame, so a long stall doesn't trigger a "spiral of death". */
    private readonly maxStepsPerFrame = 5,
  ) {}

  get isPaused(): boolean {
    return this.paused;
  }

  /** While paused no time accumulates, so no simulation time passes. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    this.last = null; // don't count the paused period when we resume
  }

  /** Forgets accumulated time, e.g. when a new game starts. */
  reset(): void {
    this.accumulator = 0;
    this.last = null;
  }

  frame(now: number): FrameResult {
    if (this.paused || this.last === null) {
      this.last = now;
      return { steps: 0, alpha: this.accumulator / this.stepMs };
    }
    this.accumulator += Math.max(0, now - this.last);
    this.last = now;

    let steps = 0;
    while (this.accumulator >= this.stepMs - EPSILON_MS && steps < this.maxStepsPerFrame) {
      this.onStep();
      this.accumulator = Math.max(0, this.accumulator - this.stepMs);
      steps++;
    }
    // If we hit the cap, drop the backlog rather than trying to catch up next frame.
    if (steps === this.maxStepsPerFrame && this.accumulator >= this.stepMs - EPSILON_MS) this.accumulator = 0;
    return { steps, alpha: this.accumulator / this.stepMs };
  }
}
