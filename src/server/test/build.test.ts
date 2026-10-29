import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode, parseServerMessage } from '@tank/protocol';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { WebSocket } from 'ws';
import { SERVER_PACKAGE_JSON } from '../vite.config';

const serverRoot = fileURLToPath(new URL('..', import.meta.url));
let outDir = '';
const children: ChildProcess[] = [];

/** Starts the built server as `npm start` would, from a folder with no node_modules anywhere above it. */
function run(env: Record<string, string>): {
  child: ChildProcess;
  output: () => string;
  exit: Promise<number>;
} {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: outDir,
    env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '', ...env },
  });
  children.push(child);
  let output = '';
  child.stdout.on('data', (d) => (output += String(d)));
  child.stderr.on('data', (d) => (output += String(d)));
  const exit = new Promise<number>((resolve) => child.on('exit', (code) => resolve(code ?? -1)));
  return { child, output: () => output, exit };
}

async function until<T>(get: () => T | undefined, timeoutMs: number): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = get();
    if (value !== undefined) return value;
    if (Date.now() > end) throw new Error('Timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('hosting: the server build', () => {
  beforeAll(async () => {
    outDir = mkdtempSync(join(tmpdir(), 'tank-command-server-'));
    await build({
      root: serverRoot,
      configFile: join(serverRoot, 'vite.config.ts'),
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true },
    });
  }, 120_000);

  afterAll(() => {
    for (const child of children) child.kill();
    if (outDir) rmSync(outDir, { recursive: true, force: true });
  });

  test('one bundled server.js, plus a package.json whose start script runs it', () => {
    expect(readdirSync(outDir).sort()).toEqual(['package.json', 'server.js']);
    const pkg = JSON.parse(readFileSync(join(outDir, 'package.json'), 'utf8'));
    expect(pkg).toEqual(SERVER_PACKAGE_JSON);
    expect(pkg.scripts.start).toBe('node server.js');
    expect(pkg).not.toHaveProperty('dependencies');
  });

  test('Nothing else to install', async () => {
    const server = run({ PORT: '0' });
    const port = await until(() => /listening on port (\d+)/.exec(server.output())?.[1], 15_000);

    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', rooms: 0 });

    // And the bundled WebSocket server works too.
    const ws = new WebSocket(`ws://localhost:${port}`);
    const welcome = new Promise((resolve) => ws.on('message', (d) => resolve(parseServerMessage(String(d)))));
    await new Promise((resolve) => ws.on('open', resolve));
    ws.send(encode({ t: 'hello' }));
    expect(await welcome).toEqual({ t: 'welcome', bot: false, version: 1 });
    ws.close();
    server.child.kill();
  }, 30_000);

  test('Bad setting: it exits at once, naming the variable', async () => {
    const server = run({ MAX_ROOMS: 'lots' });
    expect(await server.exit).not.toBe(0);
    expect(server.output()).toContain('MAX_ROOMS is invalid');
  }, 30_000);
});
