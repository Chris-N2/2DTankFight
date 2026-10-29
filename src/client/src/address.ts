/** The `<meta>` tag a host page uses to name its multiplayer server (see the README's hosting section). */
export const SERVER_META = 'tank-command-server';

/** The port `npm run dev:server` listens on. */
export const DEV_SERVER_PORT = 8080;

/** The parts of the page the address comes from (tests pass a small fake). */
export interface AddressSource {
  /** The content of the server tag, or null if the page has none. */
  serverTag: string | null;
  /** The page's own host name, for the development default. */
  hostname: string;
  /** Whether this is the Vite development server rather than a built game. */
  dev: boolean;
}

/**
 * The multiplayer server's WebSocket address, or null for none: the game is then single-player only, and makes no
 * connection at all. A page names one with the server tag. The development server, with no tag, uses a locally run
 * `npm run dev:server` on the same host, so playing across a LAN works from `npm run dev` too.
 */
export function serverAddress({ serverTag, hostname, dev }: AddressSource): string | null {
  const tag = serverTag?.trim();
  if (tag) return tag;
  return dev ? `ws://${hostname}:${DEV_SERVER_PORT}` : null;
}

/** Reads the server tag from the page. */
export function readServerTag(doc: Pick<Document, 'querySelector'>): string | null {
  return doc.querySelector<HTMLMetaElement>(`meta[name="${SERVER_META}"]`)?.content ?? null;
}
