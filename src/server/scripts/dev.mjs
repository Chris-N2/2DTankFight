// `npm run dev:server`: builds the server in watch mode, and restarts it after every rebuild. Settings come from the
// environment as usual; the test bot is on unless TEST_BOT says otherwise, since a local server is for testing.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = fileURLToPath(new URL('../../../dist/server-dev', import.meta.url));
const env = { TEST_BOT: 'on', ...process.env };

let server = null;

function restart() {
  if (server) {
    server.removeAllListeners('exit');
    server.kill();
  }
  server = spawn(process.execPath, ['server.js'], { cwd: outDir, env, stdio: 'inherit' });
  server.on('exit', (code) => {
    if (code)
      console.log(`[dev:server] the server stopped (exit code ${code}); waiting for a change to restart it.`);
  });
}

const watcher = await build({
  root,
  configFile: `${root}/vite.config.ts`,
  logLevel: 'warn',
  build: { outDir, emptyOutDir: true, watch: {} },
});

watcher.on('event', (event) => {
  if (event.code === 'BUNDLE_END') event.result?.close?.();
  if (event.code === 'END') {
    console.log(`[dev:server] built; ${server ? 'restarting' : 'starting'} the server.`);
    restart();
  }
  if (event.code === 'ERROR')
    console.error('[dev:server] build failed:', event.error?.message ?? event.error);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    server?.kill();
    await watcher.close();
    process.exit(0);
  });
}
