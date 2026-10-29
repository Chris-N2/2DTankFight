import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

/** Where `npm run build:server` puts the server: zip this folder and it's ready to deploy. */
export const SERVER_OUT_DIR = fileURLToPath(new URL('../../dist/server', import.meta.url));

/** All a Node host needs to start the server: no dependencies, since everything is bundled into server.js. */
export const SERVER_PACKAGE_JSON = {
  name: 'tank-command-server',
  private: true,
  type: 'module',
  engines: { node: '>=22' },
  scripts: { start: 'node server.js' },
};

function writePackageJson(): Plugin {
  return {
    name: 'tank-command-server-package-json',
    writeBundle({ dir = SERVER_OUT_DIR }) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'package.json'), JSON.stringify(SERVER_PACKAGE_JSON, null, 2) + '\n');
    },
  };
}

export default defineConfig({
  // Bundle everything, `ws` included, so the output runs without `npm install`.
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: 'src/main.ts',
    target: 'node22',
    outDir: SERVER_OUT_DIR,
    emptyOutDir: true,
    minify: false,
    rolldownOptions: {
      // ws's optional native speed-ups; it falls back to plain JavaScript without them.
      external: ['bufferutil', 'utf-8-validate'],
      output: { entryFileNames: 'server.js', format: 'es' },
    },
  },
  plugins: [writePackageJson()],
});
