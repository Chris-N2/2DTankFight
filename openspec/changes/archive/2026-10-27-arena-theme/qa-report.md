# QA Report: arena-theme

**Verdict:** PASS
**Date:** 2026-10-27

This is a re-run after the fixes for the first QA report, which failed. All three blockers are fixed and each now has a
test. The approved spec wording change is in place, and two of the non-blocking suggestions were taken up as well. Nice
work: the game now ships in its original olive and sand unless a host says otherwise.

## Build & tests

All commands were run from the repo root.

| Command | Result |
|---|---|
| `npm run format:check` | OK: "All matched files use Prettier code style!" |
| `npm run lint` | OK, no output |
| `npm run typecheck` (sim, client, client/test) | OK, exit 0 |
| `npm test` (vitest run) | OK: 18 files, **296 tests passed** |
| `npm run build` | OK. Output is `index.html`, `theme.example.json`, `assets/tank-command.css` and `assets/tank-command.js`. **No `theme.json`.** |
| `openspec validate arena-theme --strict` (PowerShell) | "Change 'arena-theme' is valid" |

`src/client/public/theme.json` no longer exists. It is ignored by `.gitignore:29`.

All tasks in `tasks.md` are ticked, and task 6.1 now holds.

## Scenario coverage

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| theme: Themeable settings | No theme looks as before | Verified | `src/client/src/theme.ts:26-38`, `styles.css:6-17` | `test/theme.test.ts:36-47`; `test/build.test.ts:46-50` (build ships no `theme.json`) |
| theme: Themeable settings | Banner text stays readable over the arena | Verified | `styles.css:78-108` | `test/theme.test.ts` "Banner text stays readable over the arena" |
| theme: Themeable settings | Arena and menus follow the theme | Verified (arena + custom properties). CSS → focus-outline link checked by inspection (`styles.css:183-186`) | `theme.ts:201-203`, `renderer.ts` `drawArena` | `test/theme.test.ts:55-68` |
| theme: Theme file | Theme next to the game | Verified | `theme.ts:159-163, 168-188` | `test/theme.test.ts:158-160, 170-177`; `test/build.test.ts:52-56` |
| theme: Theme file | Theme elsewhere | Verified | `theme.ts:160-162` | `test/theme.test.ts:162-168` |
| theme: Theme file | No theme file | Verified | `theme.ts:176` | `test/theme.test.ts:179-184` |
| theme: Page CSS overrides | The host stylesheet wins | Verified | `theme.ts:94-96, 191-198`; `main.ts` `boot()` reads overrides first | `test/theme.test.ts:72-86` |
| theme: Page CSS overrides | Mixing sources | Verified | `theme.ts:94-96` | `test/theme.test.ts:77-80` |
| theme: Bad theme never stops the game | One bad colour | Verified | `theme.ts:70-91` | `test/theme.test.ts:90-95` |
| theme: Bad theme never stops the game | Unknown setting | Verified | `theme.ts:77-80` | `test/theme.test.ts:97-102` |
| theme: Bad theme never stops the game | Broken file | Verified | `theme.ts:71-73, 174-186` | `test/theme.test.ts:104-110, 186-196` |
| theme: Gameplay colours not themeable | Tanks keep their colours | Verified | `colours.ts:4`, `renderer.ts` `colorOf` | `test/theme.test.ts:235-244` |
| theme: Contrast warning | Green floor | Verified | `theme.ts:122-138`; `main.ts:499-503` | `test/theme.test.ts:124-133` |
| theme: Contrast warning | Default theme is fine | Verified | `theme.ts:122-138` | `test/theme.test.ts:135-137` |
| theme: No flash of default look | Themed from the first frame | Verified (logic), plus a manual visual check | `theme.ts:209-228`; `main.ts:508-514` | `test/theme.test.ts:204-211` |
| theme: No flash of default look | Slow theme | Verified | `theme.ts:223-227`; `main.ts:508-511` | `test/theme.test.ts:213-230` |
| hosting: Works from any folder | Served from a sub-folder | Verified (relative refs, script-relative theme URL) plus the developer's Umbraco check | `vite.config.ts:9`, `theme.ts:162` | `test/build.test.ts`; `playtest-notes.md` |
| hosting: Works from any folder | No absolute paths in the build | Verified | `vite.config.ts` | `test/build.test.ts` "No absolute paths…" |
| hosting: Stable entry file names | Same names after a code change | Verified (names come from config, not hashes) | `vite.config.ts:4-5, 13-18` | `test/build.test.ts` "Same names after a code change…" |
| hosting: Minimal host page | A host template | Verified, plus the Umbraco check | `index.html`; `markup.ts:45-54` | `test/markup.test.ts:22-29, 47-54` |
| hosting: Minimal host page | Missing mount element | Verified | `markup.ts:45-54`; `main.ts:513` | `test/markup.test.ts:56-64` |
| game-client: Arena rendering | Identify your tank | Unchanged by this change; visual (manual) | `renderer.ts` ring/label | n/a |
| game-client: Arena rendering | You are green | Verified | `sim/src/match.ts:49` (human `colorIndex 0`), `colours.ts:4`, `renderer.ts` `colorOf` | `test/theme.test.ts:235-244` |
| game-client: Arena rendering | Themed arena | Verified (mapping), plus visual | `renderer.ts` `arenaColours`, `setTheme`, `drawArena` | `test/theme.test.ts:36-47, 55-58` |
| game-client: Arena rendering | Window resize | Unchanged; visual (manual) | `renderer.ts` `resize()` | n/a |
| game-client: Arena rendering | Elimination is visible | Unchanged; visual (manual) | effects/renderer | n/a |
| game-client: Arena rendering | Aiming the mortar | Unchanged; visual (manual) | renderer | n/a |
| game-client: Arena rendering | Mortar in flight | Unchanged; visual (manual) | renderer | n/a |
| game-client: Arena rendering | Slowed tanks are obvious | Unchanged; visual (manual) | renderer | n/a |

Counts:
- 23 Verified;
- 0 Implemented, untested;
- 0 Missing / wrong;
- 6 unchanged visual rendering scenarios left for manual checks.

## Findings

### Implementation bugs (spec was right, code wasn't)

None. Previous blockers, now resolved:
1. **Playtest `theme.json` shipped with the build.** It's deleted and git-ignored, a build test guards against it, and
   the README warns about it.
2. **"Missing mount element" was untested.** `mountStage(doc, warn)` moved to `markup.ts`, with tests for both paths.
3. **"You are green" / "Tanks keep their colours" were untested.** A `colorOf` test now covers the human and every
   tank against `PALETTE`.

### Spec gaps (spec wrong or incomplete)

None. The `font` wording ("Menu, HUD and banner text") and the "YOU ring and label (including its font)" clause now
match the implementation, with the developer's approval.

### Minor / suggestions (do not block)

- Left alone deliberately, and reasonable as decided:
  - host `--tank-*` values aren't validated;
  - the contrast check ignores alpha;
  - every CSS asset maps to the one stable stylesheet name.

  If a second stylesheet ever appears, a build-test check for exactly one `.css` file would catch the clash.
- The contrast de-duplication in `boot()` compares raw floor strings. So `#fff` and `white` would be checked twice.
  That's harmless.
- The edited line in the `theme` delta spec ("Tank colours, the "YOU" ring and label (including its font), …") runs
  past the hand-wrapped line width used elsewhere. This is cosmetic only.

## Manual checks for the human

Most of these were already done on the dev build and on Umbraco (see `playtest-notes.md`). Worth a quick look before
archiving:

1. **Default look:** with no `theme.json` in `public/`, `npm run dev` and a fresh build show the original look.
2. **Themed from the first frame:** with a `theme.json` beside the build, a hard reload shows no flash of the default
   colours.
3. **Slow theme:** throttle the network so the theme takes more than 1 s. The game should start in the defaults, then
   switch to the theme, with arena and menus both changing and no repeated contrast warnings.
4. **Missing mount element:** a page without `<div id="tank-command">` still runs and logs the warning.
5. **Focus outline uses `accent`:** with `accent: "#ff00aa"`, a keyboard-focused button has a pink outline.
6. **Unchanged rendering scenarios still look right under a non-default theme:**
   - Identify your tank;
   - Window resize;
   - Elimination is visible;
   - Aiming the mortar;
   - Mortar in flight;
   - Slowed tanks are obvious.
