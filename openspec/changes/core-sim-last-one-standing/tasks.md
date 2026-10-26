## 1. Project scaffold

- [x] 1.1 Create root `package.json` with npm workspaces (`src/*`), `tsconfig.base.json` (strict), and root scripts `dev`, `build`, `typecheck`, `lint`, `test`, `format`; verify `npm install` succeeds
- [x] 1.2 Create `src/sim` package (`@tank/sim`) with a tsconfig using `lib: ["ES2022"]` and no DOM; verify that referencing `window` in a sim file fails `npm run typecheck`, then remove the probe
- [x] 1.3 Create `src/client` package (`@tank/client`) as a Vite TypeScript app that depends on `@tank/sim`; verify `npm run dev` serves a blank page and `npm run build` produces `dist/`
- [x] 1.4 Configure ESLint (flat config, typescript-eslint) and Prettier, including sim-only bans on `Date`, `performance`, `setTimeout`, `setInterval` and `Math.random`; verify `npm run lint` passes and a probe use of `Math.random` in sim is reported
- [x] 1.5 Configure Vitest for both packages; verify `npm test` runs a placeholder test in each package

## 2. Simulation foundations

- [x] 2.1 Define plain-data state types (`MatchState`, tank, shell, input, events) and `DEFAULT_CONFIG` with the D9 values; verify by typecheck and a test that a JSON round trip of the state deep-equals the state (proving it is plain data; `structuredClone` is not in the no-DOM lib)
- [x] 2.2 Implement the seeded sfc32 RNG with state stored as numbers; verify by tests that the same seed gives the same sequence and different seeds differ
- [x] 2.3 Implement geometry helpers (circle vs rectangle overlap, swept segment vs rectangle with contact normal, segment vs circle, line of sight); verify with unit tests including the thin-obstacle tunnelling case
- [x] 2.4 Implement `createMatch` and the fixed-tick `step` skeleton (tick counter, events array, ignore inputs for eliminated tanks, missing input = idle); verify the "Ticks advance by a fixed step" and "Missing input means idle" scenario tests

## 3. Arena

- [x] 3.1 Define the board data format and the "Proving Ground" board in `src/sim/boards/`; verify by typecheck and a test that it loads into `createMatch`
- [x] 3.2 Implement the navigation grid (obstacles inflated by tank radius) and the board validator (min obstacles, spawn clearance, spawn spacing, connectivity via flood fill); verify the "Built-in board passes validation", "Sealed spawn is rejected" and "Too few obstacles is rejected" scenario tests
- [x] 3.3 Implement seeded spawn assignment per round; verify the "Distinct spawns" and "Spawns vary between rounds" scenario tests

## 4. Tanks and shells

- [x] 4.1 Implement tank turning and forward/reverse movement; verify the "Driving forward", "Reversing is slower" and "Turning on the spot" scenario tests
- [x] 4.2 Implement per-axis tank collision against obstacles, the boundary and other tanks; verify the "Blocked by an obstacle", "Sliding along a wall" and "Tanks block each other" scenario tests
- [x] 4.3 Implement edge-triggered firing with cooldown and the muzzle-in-wall handling from D6; verify the "Pressing fire launches a shell", "Holding fire does not auto-fire" and "Cooldown limits fire rate" scenario tests
- [x] 4.4 Implement shell flight, single bounce, second-contact removal and lifetime expiry; verify the "Bounce off a wall", "Second contact destroys the shell", "No tunnelling" and "Shells do not collide with each other" scenario tests
- [x] 4.5 Implement shell–tank hits, damage, the self-hit-after-bounce rule and simultaneous elimination; verify the "Hitting an opponent", "No self-hit on launch", "Self-hit after a bounce", "Tank destroyed", "Shells outlive their tank", "Simultaneous elimination" and "Full health at round start" scenario tests

## 5. Last One Standing rules

- [x] 5.1 Implement game option validation (1–4 AI, rounds 1/3/5/7); verify the "Valid options accepted" and "Out-of-range options rejected" scenario tests
- [x] 5.2 Implement the phase machine (countdown → playing → roundOver → countdown/gameOver) with tick-based timers and a frozen world outside `playing`; verify the "Countdown freezes tanks" and "Shells after round end have no effect" scenario tests
- [x] 5.3 Implement round-end evaluation and scoring; verify the "Human wins the round", "Human eliminated" and "Mutual destruction" scenario tests
- [x] 5.4 Implement game-end evaluation (`lead > roundsRemaining`, final comparison); verify the "Majority clinches the game", "AI clinches the game", "Early end despite draws" and "Drawn game" scenario tests
- [x] 5.5 Implement round reset (full hit points, re-spawn, clear shells, AI memory reset); verify the "Fresh round" scenario test
- [x] 5.6 Add the determinism test: two matches with the same seed and input script over 600+ ticks produce deep-equal states and events; verify it passes (this also covers "Runs headless in Node" and "Randomness is seeded")

## 6. AI opponents

- [x] 6.1 Implement A* pathfinding on the navigation grid; verify with unit tests on small boards (a path is found around an obstacle; no path exists into a sealed area)
- [x] 6.2 Implement target selection (prefer line of sight, then distance; retarget on elimination; include other AI tanks); verify the "Retarget after elimination" and "AI tanks fight each other" scenario tests
- [x] 6.3 Implement navigation and steering towards a line-of-sight position, plus stuck recovery; verify the "Hunting a hidden target" and "Recovering from being stuck" scenario tests
- [x] 6.4 Implement aiming and firing with reaction delay and seeded aim error; verify the "Fires when lined up", "Holds fire behind cover" and "Reaction delay" scenario tests
- [x] 6.5 Wire AI `think` into the match loop before `step`, using only `TankInput`; verify the "Same rules for everyone" and "Reproducible behaviour" scenario tests
- [x] 6.6 Add a headless soak test: 50 seeded AI-only rounds on Proving Ground all finish within a time limit with no tank overlapping an obstacle at any tick; verify it passes

## 7. Browser client

- [x] 7.1 Implement the fixed-step accumulator loop (max 5 steps per frame) with an injectable clock and interpolation alpha; verify with unit tests using a fake clock
- [x] 7.2 Implement keyboard input (arrows and WASD, Space, `preventDefault` only during play, clear keys on blur); verify the "Both key sets work" and "Keys do not scroll the page" scenarios with unit tests on the key-to-input mapping
- [x] 7.3 Implement the Canvas renderer (DPR-aware, letterboxed 3:2 scaling, obstacles, procedurally drawn coloured tanks with heading, "YOU" marker, shells, interpolated motion); verify manually in `npm run dev` ("Identify your tank", "Window resize")
- [x] 7.4 Implement event-driven effects (muzzle flash, bounce spark, hit flash, explosion on elimination); verify manually ("Elimination is visible")
- [x] 7.5 Implement the HUD (hit points, round X of N, score); verify manually ("Damage shown")
- [x] 7.6 Implement the setup screen with defaults (3 AI, 5 rounds) and a controls summary; verify the "Starting a game" and "Defaults allow an immediate start" scenarios manually
- [x] 7.7 Implement the countdown, round result and game result overlays with "Play again" and "Change settings"; verify the "Next round starts automatically" and "Play again" scenarios manually
- [x] 7.8 Implement pause (Escape toggle, auto-pause on blur/visibility change, no simulation time while paused, paused overlay); verify the "Escape pauses" and "Switching tabs pauses" scenarios with a unit test on the loop plus a manual check

## 8. Wrap-up

- [x] 8.1 Add a `README.md` with what the game is, how to run (`npm install`, `npm run dev`), controls, and project layout; verify the steps work from a clean clone
- [x] 8.2 Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` from the root; verify all pass with no warnings
- [x] 8.3 Play a full 5-round game against 4 AI and note balance impressions in the change folder (`playtest-notes.md`); verify the game is completable start to finish

## 9. QA fixes

- [x] 9.1 Fix the AI freezing with its target in view (QA B1): re-aim or reposition when the barrel line is blocked, run stuck detection while advancing, route round cover when the advance lane is too narrow; verify the "Lined up but blocked by cover" scenario test, a wedged-while-advancing test, and a soak with an idle human that includes the seeds QA found
- [x] 9.2 Name the right spawn when spawn 0 is the sealed one (QA B2); verify the "Sealed spawn is rejected" test seals spawn 0 as well as spawn 2
- [x] 9.3 Fire every shot in a tick before any new shell does damage (QA B3); verify the "Point-blank trade" scenario test with both tank orders and the "Destroyed tank still stops shells that tick" scenario test
- [x] 9.4 Stop a player who is still hammering keys from skipping the result screen (QA suggestion); verify manually
