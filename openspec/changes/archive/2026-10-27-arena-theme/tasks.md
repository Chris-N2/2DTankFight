## 1. Theme core (pure)

- [x] 1.1 Create `src/client/src/theme.ts` with:
      - `ThemeKey`, `Theme` and `THEME_DEFAULTS`, matching the `theme` spec table;
      - `cssVarName(key)`, which turns a key into `--tank-kebab-case`;
      - `validateTheme(json, isColour)`, which returns the valid values and the warnings;
      - `resolveTheme(defaults, file, page)`.

      Verify with unit tests for: "No theme looks as before", "One bad colour", "Unknown setting", "Broken file" (an
      array or non-object), the `font` checks, "The host stylesheet wins" and "Mixing sources".
- [x] 1.2 Add `contrastWarnings(theme, normalise)` using the redmean distance and `CONTRAST_MIN_DISTANCE`, against
      `PALETTE` and the shell colour. Export the shell colour from `renderer.ts` for this. Verify with tests: a floor
      equal to the "you" green warns and names both colours, and the defaults don't warn.

## 2. Theme loading and applying (DOM layer)

- [x] 2.1 In `theme.ts`, add:
      - `themeUrl(doc, scriptUrl)`, for the `<meta>` tag or `../theme.json` next to the script;
      - `loadThemeFile(url, fetchFn)`: a 404 means no theme with no warning; other failures warn; JSON is parsed.
      - `readPageOverrides(root)`, which reads non-empty `--tank-*` values from computed style;
      - `applyTheme(root, theme)`, which writes inline custom properties.

      Pass the document, fetch and style objects in as parameters. Verify with tests using fakes: "Theme next to the
      game", "Theme elsewhere" (URL resolution), "No theme file" (a 404 gives no warning), and a broken file giving a
      warning.
- [x] 2.2 Add `startTheme(...)`. It reads the page overrides first, then races the theme file against `THEME_WAIT_MS`
      and returns the theme to start with. It also calls back with the full theme if the file arrives late. Verify
      with tests using fake timers: "Themed from the first frame" and "Slow theme".

## 3. Renderer and CSS

- [x] 3.1 Remove the arena colour constants from `Renderer`. Add `setTheme(theme)`, and draw the backdrop, floor,
      grid, walls, wall edge and border from it. Gameplay colours stay as constants. Verify that the type-check passes,
      plus a unit test of a small pure `arenaColours(theme)` mapping used by the renderer.
- [x] 3.2 Rewrite `styles.css` to use `var(--tank-*, <default>)` throughout, with no `--tank-*` definitions. Rename
      the old variables, and replace the leftover hard-coded colours with `color-mix()` or theme variables as in
      design §4. Verify by grepping: no hex colours remain except inside `var()` fallbacks, and no old variable names
      remain.

## 4. Hosting

- [x] 4.1 Move the stage markup from `index.html` into `src/client/src/markup.ts` as `STAGE_HTML`, with a `STAGE_IDS`
      list. `main.ts` mounts it into `#tank-command`, creating that element with a warning if it's missing, before
      constructing `Game`. Make `index.html` the minimal host page. Verify with a test that every id in `STAGE_IDS`
      appears in `STAGE_HTML`, that `main.ts` only looks up ids from `STAGE_IDS` (a source scan), and that `index.html`
      contains only the minimal elements.
- [x] 4.2 In `main.ts`, await `startTheme` before mounting and starting. Apply the theme to the document and the
      renderer, log the warnings, log the contrast warnings, and reapply if the theme arrives late. Verify by type-check
      and the manual check in 6.2.
- [x] 4.3 Make the entry file names stable in `vite.config.ts` (`assets/tank-command.js` and
      `assets/tank-command.css`), checking the option name for the installed Vite. Add a build test that builds into a
      temporary folder and checks the stable names, relative references and no root-absolute paths. It covers "Same
      names after a code change", "No absolute paths in the build" and part of "Served from a sub-folder".
- [x] 4.4 Add `src/client/public/theme.example.json` with every key at its default. Verify with a test that it
      validates with no warnings and has exactly the keys of `THEME_DEFAULTS`.

## 5. Docs

- [x] 5.1 Add a README section, "Putting it on your site": the minimal host page (an Umbraco template as the
      example), `theme.json` and the `--tank-*` variables with the key table, the `<meta>` tag, loading fonts, and
      cache-busting with `?v=`. Verify by reading it against the `theme` and `hosting` specs.
- [x] 5.2 Update CLAUDE.md:
      - "Tanks": add the perspective colour rule and drop the host-picks-first selection;
      - roadmap item 4: "Arena theme & hosting (replaces tank selection)";
      - note the blue-reservation question for #6.

      Verify by reading it back against the proposal.

## 6. Wrap-up

- [x] 6.1 Run format check, lint, type-check, build and the full test suite.
- [x] 6.2 Manual check with `npm run dev` (the user runs the server), then on the user's local Umbraco site:
      - defaults look unchanged;
      - a `theme.json` restyles the arena and menus from the first frame;
      - page CSS overrides it;
      - a bad value warns and the game still plays;
      - a green floor warns;
      - the built folder works from a sub-folder with a minimal template.

      Note the results in `playtest-notes.md`, then suggest `/qa` before `/opsx:archive`.
