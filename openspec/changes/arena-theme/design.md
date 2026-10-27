## Context

See proposal.md for why. The current state:
- `styles.css` defines seven generic CSS variables (`--bg`, `--panel`, `--ink`, `--muted`, `--accent`, `--sand`,
  `--edge`) plus `--font`, and still has a few hard-coded colours (button and `kbd` backgrounds, the text colour on the
  Start button, overlay tints).
- `renderer.ts` hard-codes the arena colours (`FLOOR`, `GRID`, `WALL`, `WALL_EDGE`, `BORDER`) and the backdrop
  (`#0d100b` in `beginFrame`).
- All the screens' markup lives in `index.html`, and `main.ts` finds it with `el(id)`.
- `vite.config.ts` already has `base: './'`, so the build uses relative paths. File names are hashed.
- Client tests run in Node with no DOM. Everything testable here therefore has to be a pure function, behind a thin
  DOM layer.

## Goals / Non-Goals

**Goals:**
- One set of theme values drives both the canvas and the CSS.
- Precedence (defaults, then theme file, then page CSS) is decided by our own code, not by stylesheet order, so it
  can be unit-tested and doesn't depend on where a host puts its `<link>` tags.
- A host template that stays the same from release to release.

**Non-Goals:**
- A theme picker for players, light/dark modes, or switching theme while the game is running. A late-arriving theme
  file is the only reapply.
- Theming tank colours, effects or the board layout.
- Embedding the game *inside* a page's content. The game still owns the window; that would be a separate "embed
  mode" change if ever wanted.
- Building the "you're green on your own screen" colour rule. It's recorded in CLAUDE.md now and built with
  multiplayer (see Open Questions).

## Decisions

### 1. Pure core, thin DOM layer (`theme.ts`)
```
  readPageOverrides()  --+                                (DOM: getComputedStyle, at start-up only)
  loadThemeFile()  ------+--> resolveTheme(defaults, file, page) --> Theme   (pure)
                                 |  validateTheme(json, isColour) --> {values, warnings}   (pure)
                                 v
                          applyTheme(theme)                (DOM: inline --tank-* on <html>)
                          contrastWarnings(theme, normalise) (pure, given colour normalising)
```
- `THEME_DEFAULTS` holds the table in the `theme` spec.
- `validateTheme(json, isColour)` checks each key and returns the valid values plus one warning per problem. It takes
  `isColour` as a parameter: in the browser that's `CSS.supports('color', v)`, and in tests a simple stub.
- `resolveTheme` merges defaults, then the file, then the page values.
- `applyTheme` writes every final value as an inline custom property on `document.documentElement`. Inline styles
  beat any stylesheet, and the page's own values are already part of the merge, so the cascade can't reorder things.
- **Reading the page's overrides:** `styles.css` no longer *defines* the `--tank-*` variables; it only *uses* them,
  as `var(--tank-floor)` and so on. So at start-up, any non-empty `--tank-*` value on `:root` must have come from the
  host page. These are read once, **before** `applyTheme` writes anything, and kept for a late reapply.

*Alternative:* let the CSS cascade decide, with defaults under `:where(:root)` and theme-file values in a `<style>`
inserted at the top of `<head>`. Rejected because it only works if hosts put their stylesheet after ours, and it
can't be tested without a DOM.

### 2. Theme file location and loading
- **The default location:** `new URL('../theme.json', import.meta.url)`. In the build the script is
  `assets/tank-command.js`, so this finds the `theme.json` beside `index.html`. In dev it resolves to `/theme.json`,
  which is served from `public/` if present.
- **The `<meta name="tank-command-theme">` tag:** its `content` is resolved against `document.baseURI`. When it's
  present, it replaces the default location.
- **Fetching:** `fetch` with `cache: 'no-cache'`, so an edited theme shows up without a rebuild.
  - A 404 means no theme, with no warning.
  - Any other failure, unparseable JSON or a non-object gives one warning and no theme.
- **Start-up:** `main.ts` awaits the theme for up to **`THEME_WAIT_MS = 1000`**, then mounts the screens and starts
  the game.
  - If the file arrives later, it's resolved and applied then.
  - The renderer re-reads its colours whenever a theme is applied (see §3).
- No sample `theme.json` is shipped, because it would always be loaded. `public/theme.example.json` is copied into
  the build instead, documenting every key with today's defaults.

### 3. The renderer reads colours, it doesn't own them
- `Renderer` gains a `palette` field (`backdrop`, `floor`, `grid`, `wall`, `wallEdge`, `border`) and
  `setTheme(theme)`. `FLOOR`, `GRID` and the other arena constants go.
- The fixed gameplay colours stay as constants: `PALETTE` for tanks, `SHELL`, `OUTLINE`, `MORTAR`, the mud colours,
  and the effects colours.
- The canvas is given raw theme strings. Canvas `fillStyle` accepts any CSS colour, so no conversion is needed.

### 4. CSS
- Rename the variables:
  - `--bg` → `--tank-backdrop`;
  - `--sand` → `--tank-wall`;
  - `--edge` → `--tank-wall-edge`;
  - `--panel`, `--ink`, `--muted`, `--accent`, `--font` → their `--tank-` versions;
  - `--tank-floor`, `--tank-grid` and `--tank-border` are new, and are used by the canvas only.
- The remaining hard-coded colours become `color-mix()` blends of theme colours, so a light theme doesn't leave dark
  islands behind:
  - button background ≈ `color-mix(in srgb, var(--tank-panel), var(--tank-ink) 8%)`;
  - text on the Start and accent buttons ≈ `var(--tank-backdrop)`;
  - overlay dimming stays black at fixed transparency, which works on any theme.
- `:root` in `styles.css` keeps the defaults only as `var()` fallbacks inside the rules, e.g.
  `var(--tank-ink, #f2ecd8)`. The page looks right even before the theme code runs, and the stylesheet defines no
  `--tank-*` values that could be mistaken for page overrides.

### 5. Contrast check
- **Normalising colours:** in the DOM layer, set `ctx.fillStyle = value` on a 1×1 canvas and read it back. Browsers
  return `#rrggbb` or `rgba(...)`.
- **The distance measure:** the "redmean" weighted RGB distance, which is cheap and roughly perceptual.
- **The threshold:** a warning if the floor is closer than **`CONTRAST_MIN_DISTANCE = 80`** to any colour in `PALETTE`
  or to `SHELL`.
- The defaults (floor `#26301f`) are far from all of these. A test checks that the defaults produce no warning, and
  that a floor equal to the "you" green does.
- Only the floor is checked: it's what tanks and shells are seen against. Walls are solid colour blocks, so they're
  never confused with tanks.

### 6. The game builds its own screens (`markup.ts`)
- `index.html`'s `#stage` contents move, unchanged, into `markup.ts` as `STAGE_HTML`.
- `main.ts` finds `#tank-command`, creating it at the end of `<body>` with a warning if missing. It sets the element's
  `innerHTML` to `STAGE_HTML` and then constructs `Game`. The existing `el(id)` lookups work unchanged.
- A test checks that every id `main.ts` looks up is present in `STAGE_HTML`. The ids are kept in one exported list,
  `STAGE_IDS`, and `el()` is typed against it.
- `index.html` becomes the minimal page: meta tags, `<title>`, `<div id="tank-command">` and the script. In dev, Vite
  injects the CSS through `main.ts`'s `import './styles.css'`. In the build, Vite emits the `<link>` itself.

### 7. Stable file names (`vite.config.ts`)
- The entry chunk is `assets/tank-command.js` and the extracted CSS is `assets/tank-command.css`. Any other asset
  keeps its hashed name; there are none today.
- Vite 8 bundles with Rolldown, so the option is `build.rolldownOptions.output`, with `build.rollupOptions` as a
  compatibility alias. Use whichever the installed version documents, and check the result.
- **Testing:** a test runs `vite build` into a temporary folder and checks:
  - both stable files exist;
  - `index.html` refers to them by relative paths;
  - no `src="/` or `href="/` appears in the output.

  This takes a few seconds, which is acceptable.
- **Cache busting:** the README shows the host adding `?v=<version>` to the script and stylesheet URLs, because the
  names no longer change between releases.

### 8. Docs
- **README, "Putting it on your site":**
  1. copy `dist/`;
  2. write a minimal host page, with the Umbraco-style template as the example;
  3. theme it with `theme.json` or `--tank-*` variables in the page's CSS;
  4. use the `<meta>` tag to put the theme file somewhere else;
  5. add a version query string to bust caches.
- **CLAUDE.md:**
  - "Tanks" loses "host chooses first; their design is then unavailable to the joining player".
  - It gains the perspective colour rule: you're green with the YOU ring, the other human is blue, and AI colours are
    fixed and the same on every screen.
  - Roadmap item 4 becomes "Arena theme & hosting (replaces tank selection)".

### 9. Notes from implementation
- `styles.css` reads each `--tank-*` property once, into a local shorthand on `:root` (`--t-ink: var(--tank-ink,
  #f2ecd8)`), and its rules use the shorthands. The stylesheet still never *defines* a `--tank-*` property, so
  reading the page's overrides works as described in §1.
- The fixed gameplay colours (`PALETTE`, `SHELL`) moved to `colours.ts`. Both the renderer and the contrast check use
  them, and this avoids `theme.ts` and `renderer.ts` importing each other.
- The client tests read files (the build test, the markup and sample-theme tests), so `@types/node` was added as a
  dev dependency, with the developer's approval. It's used only by a test-specific `src/client/test/tsconfig.json`,
  so game code still can't use Node APIs. `npm run typecheck` checks it too.

## Risks / Trade-offs

- **[Stable names and browser caching]** After a deploy, visitors might keep running the old script. → The README
  cache-busting step. Hosts control their own caching headers anyway.
- **[A host sets `--tank-*` after start-up]** Only values present at start-up are read as overrides. → This is
  documented: set them in the page's stylesheet, which is how they'd normally be set.
- **[`color-mix()` support]** It's supported in all current browsers. Older ones fall back to the property's initial
  value, which makes buttons plainer but still usable. Acceptable.
- **[Moving markup into TypeScript]** It's a large string, so it's easy to break an id. → The `STAGE_IDS` test, and
  the existing screens tests still cover the text logic.
- **[Fonts]** A theme can name a font, but the host page must load it (for example a Google Fonts `<link>`). → This
  is documented. The fallback chain in the default keeps text readable.

## Migration Plan

- Nothing for players. Existing local storage (Waves bests) is untouched.
- Anyone already serving the old build gets the new file names on their next deploy. The only existing host is local
  development.

## Open Questions

- **For the multiplayer change (#6), not this one:** reserving blue for the other human means AI tanks can't use
  blue. Today the second AI tank is blue. With two humans there are at most 3 AI, which fit red, yellow and purple.
  In single-player with 4 AI, either a fifth tank colour is needed or blue stays allowed for AI when there's no second
  human. Either way it affects only #6's palette and changes nothing built here.
