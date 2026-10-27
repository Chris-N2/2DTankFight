import { defineConfig } from 'vite';

/** The entry files keep these names in every build, so a host page written for one release works with the next. */
export const ENTRY_SCRIPT = 'assets/tank-command.js';
export const ENTRY_STYLES = 'assets/tank-command.css';

export default defineConfig({
  // Relative base so the built site works from any path (e.g. GitHub Pages, or a folder on another site).
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        entryFileNames: ENTRY_SCRIPT,
        assetFileNames: (asset) =>
          asset.names.some((name) => name.endsWith('.css')) ? ENTRY_STYLES : 'assets/[name]-[hash][extname]',
      },
    },
  },
});
