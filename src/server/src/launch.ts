import { OPEN_ORIGINS_WARNING, readConfig } from './config';
import { startServer, type RunningServer } from './server';

export interface Log {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * Reads the settings and starts the server. A bad setting is reported, naming the variable, and nothing starts: the
 * caller exits. Without `ALLOWED_ORIGINS` the server starts, with a warning.
 */
export async function launch(
  env: Record<string, string | undefined>,
  log: Log,
): Promise<RunningServer | null> {
  const read = readConfig(env);
  if ('error' in read) {
    log.error(`Tank Command server can't start. ${read.error}`);
    return null;
  }
  const { config } = read;
  if (config.allowedOrigins === null) log.warn(OPEN_ORIGINS_WARNING);
  const server = await startServer(config);
  const origins = config.allowedOrigins?.join(', ') ?? 'any';
  log.info(
    `Tank Command server listening on port ${server.port} (rooms: ${config.maxRooms}, grace: ${config.graceSeconds} s, ` +
      `test bot: ${config.testBot ? 'on' : 'off'}, origins: ${origins}).`,
  );
  return server;
}
