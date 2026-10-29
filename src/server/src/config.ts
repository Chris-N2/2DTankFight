/** The server's settings, all from environment variables (see the README's hosting section). */
export interface ServerConfig {
  port: number;
  /** Page origins whose players may connect; null lets every origin in. */
  allowedOrigins: string[] | null;
  maxRooms: number;
  graceSeconds: number;
  lobbyIdleMinutes: number;
  testBot: boolean;
}

export const DEFAULTS: ServerConfig = {
  port: 8080,
  allowedOrigins: null,
  maxRooms: 10,
  graceSeconds: 15,
  lobbyIdleMinutes: 30,
  testBot: false,
};

export const OPEN_ORIGINS_WARNING =
  'ALLOWED_ORIGINS is not set, so pages on any site can connect. Set it to your page origin(s) on a public server.';

/**
 * Reads the settings. Unset or empty variables take their defaults; a value that can't be used is an error naming
 * the variable, so the server stops at start-up rather than running with a setting nobody meant.
 */
export function readConfig(
  env: Record<string, string | undefined>,
): { config: ServerConfig } | { error: string } {
  try {
    return {
      config: {
        port: read(env, 'PORT', DEFAULTS.port, (v) => wholeNumber(v, 0, 65535)),
        allowedOrigins: read(env, 'ALLOWED_ORIGINS', DEFAULTS.allowedOrigins, origins),
        maxRooms: read(env, 'MAX_ROOMS', DEFAULTS.maxRooms, (v) => wholeNumber(v, 1, 10_000)),
        graceSeconds: read(env, 'GRACE_SECONDS', DEFAULTS.graceSeconds, (v) => positive(v, 600)),
        lobbyIdleMinutes: read(env, 'LOBBY_IDLE_MINUTES', DEFAULTS.lobbyIdleMinutes, (v) =>
          positive(v, 24 * 60),
        ),
        testBot: read(env, 'TEST_BOT', DEFAULTS.testBot, onOff),
      },
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

function read<T>(
  env: Record<string, string | undefined>,
  name: string,
  fallback: T,
  parse: (value: string) => T | undefined,
): T {
  const raw = env[name]?.trim();
  if (raw === undefined || raw === '') return fallback;
  const value = parse(raw);
  if (value === undefined) throw new Error(`${name} is invalid: "${raw}". ${HELP[name]}`);
  return value;
}

const HELP: Record<string, string> = {
  PORT: 'It should be a port number, 0 to 65535.',
  ALLOWED_ORIGINS: 'It should be a comma-separated list of page origins, such as https://example.com.',
  MAX_ROOMS: 'It should be a whole number of rooms, 1 or more.',
  GRACE_SECONDS: 'It should be a number of seconds, more than 0 and at most 600.',
  LOBBY_IDLE_MINUTES: 'It should be a number of minutes, more than 0 and at most 1440.',
  TEST_BOT: 'It should be on or off.',
};

function wholeNumber(raw: string, min: number, max: number): number | undefined {
  if (!/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return n >= min && n <= max ? n : undefined;
}

function positive(raw: string, max: number): number | undefined {
  if (!/^\d+(\.\d+)?$/.test(raw)) return undefined;
  const n = Number(raw);
  return n > 0 && n <= max ? n : undefined;
}

function onOff(raw: string): boolean | undefined {
  const value = raw.toLowerCase();
  if (['on', 'true', 'yes', '1'].includes(value)) return true;
  if (['off', 'false', 'no', '0'].includes(value)) return false;
  return undefined;
}

/**
 * Each entry must be an origin and nothing more: a scheme, a host and perhaps a port, without a path. The two easy
 * mistakes (the address of the page the game is on, or a host without `https://`) are named, with the fix.
 */
function origins(raw: string): string[] | undefined {
  const list = raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o !== '');
  const parsed = list.map((o) => {
    let url: URL;
    try {
      url = new URL(o);
    } catch {
      if (/^[\w-]+(\.[\w-]+)+(:\d+)?\/?$/.test(o)) {
        throw new Error(
          `ALLOWED_ORIGINS is invalid: "${o}" needs its scheme, as in https://${o.replace(/\/$/, '')}.`,
        );
      }
      return undefined;
    }
    if (url.origin === 'null') return undefined;
    if (url.origin !== o.replace(/\/$/, '')) {
      throw new Error(
        `ALLOWED_ORIGINS is invalid: "${o}" is a page address. An origin is just the site's root: use ${url.origin}.`,
      );
    }
    return url.origin;
  });
  return list.length > 0 && parsed.every((o) => o !== undefined) ? (parsed as string[]) : undefined;
}
