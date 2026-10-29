/**
 * The characters a room code is made of: capital letters and digits, without the ones that are easily confused when
 * read out or typed (0/O and 1/I/L).
 */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

/** A code as typed: surrounding spaces trimmed and letters made capitals, so `ktxw` finds room `KTXW`. */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Whether `code` (already normalised) is the shape of a room code. */
export function isRoomCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));
}

/** A random room code. `random` returns a float in [0, 1), like `Math.random`. */
export function randomCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}
