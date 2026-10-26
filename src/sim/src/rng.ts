/**
 * Seeded pseudo-random number generator (sfc32). Its whole state is four 32-bit
 * numbers held in a plain object, so it can live inside the serialisable match state.
 */
export interface RngState {
  s: [number, number, number, number];
}

/** Creates a generator from a 32-bit seed, expanding it with splitmix32. */
export function createRng(seed: number): RngState {
  let x = seed >>> 0;
  const next = (): number => {
    x = (x + 0x9e3779b9) >>> 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  const rng: RngState = { s: [next(), next(), next(), next()] };
  // Discard the first few outputs; sfc32 recommends warming up.
  for (let i = 0; i < 12; i++) nextUint32(rng);
  return rng;
}

export function nextUint32(rng: RngState): number {
  let [a, b, c, d] = rng.s;
  const t = (((a + b) >>> 0) + d) >>> 0;
  d = (d + 1) >>> 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) >>> 0;
  c = ((c << 21) | (c >>> 11)) >>> 0;
  c = (c + t) >>> 0;
  rng.s = [a >>> 0, b, c, d];
  return t;
}

/** A float in [0, 1). */
export function nextFloat(rng: RngState): number {
  return nextUint32(rng) / 4294967296;
}

/** A float in [min, max). */
export function nextRange(rng: RngState, min: number, max: number): number {
  return min + (max - min) * nextFloat(rng);
}

/** An integer in [0, maxExclusive). */
export function nextInt(rng: RngState, maxExclusive: number): number {
  return Math.floor(nextFloat(rng) * maxExclusive);
}

/** Shuffles an array in place (Fisher–Yates). */
export function shuffle<T>(rng: RngState, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    const tmp = items[i] as T;
    items[i] = items[j] as T;
    items[j] = tmp;
  }
  return items;
}
