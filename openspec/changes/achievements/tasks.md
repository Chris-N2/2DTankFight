## 1. Simulation: richer `eliminated` events

- [x] 1.1 Add `tick`, `bankShot` and `slowed` to the `eliminated` event in `src/sim/src/types.ts` and fill them in
  `world.ts`: record whether the credited shell had bounced next to `lastHitBy`, and read `slowTicks > 0` before
  elimination. Verify with `npm run build` (the compiler finds every place the event is built)
- [x] 1.2 Add simulation tests for the new scenarios in the `simulation` delta (bank-shot kill, direct kill, the
  finishing shell decides, destroyed while bogged down, elimination tick), and verify they pass
- [x] 1.3 Re-record the golden fingerprint in `golden.test.ts` with a comment like the two-player-sim one. Check that
  the recorded spawns are unchanged (gameplay hasn't moved), and that the whole sim and server test suites pass

## 2. Achievement list, tracker and store (pure module)

- [x] 2.1 Create `src/client/src/achievements.ts` with the `Achievement` type and the 20 entries from the spec, in
  table order, with stable kebab-case ids and player-facing names and descriptions. Verify with a test that there are
  20 unique ids in the spec's order, each with a non-empty name and description
- [x] 2.2 Implement the store (`loadAchievements` / `saveAchievements` over `StorageLike`, key
  `tank-command.achievements`, versioned JSON, unknown ids kept, invalid JSON → empty, `null` storage → unsaved).
  Verify with tests for remembered, blocked storage, damaged storage and unknown ids kept
- [x] 2.3 Implement `AchievementTracker` (round and game facts, moments, `where` / `eligible` / `needsCompleteRound`
  / already-earned filtering, the `complete` rule from design 5). Verify with tests for: each player earns their own,
  partner left still counts as two-player, test bot earns nothing, earned only once, and back from a drop
- [x] 2.4 Implement the checks for Taunted, Last One Standing, Surfer, MADness and Mudslinger, with a test per spec
  scenario (hand-built event sequences plus minimal `MatchState`s), and verify they pass
- [x] 2.5 Implement the checks for Banked, Perfection, Pacifist, Stop Hitting Yourself, and the three
  "play to the end" achievements, with a test per spec scenario, and verify they pass
- [x] 2.6 Implement the Waves milestones, Completionist (stored progress, every `BUILT_IN_BOARDS` id in both modes,
  "n of 14" progress), Why Are You So Obsessed with Me?, You Can Take That to the Bank, Unfair Advantage and Close
  Shave, with a test per spec scenario, and verify they pass
- [x] 2.7 Add integration tests that drive real matches through `step` (for example a scripted bank-shot kill on a
  test board, and a wave cleared in single-player), feed the events to the tracker, and verify the expected
  achievements come out. This shows the sim's events and the tracker agree

## 3. Client wiring

- [x] 3.1 Record `vsBot` in `OnlineSession` when the host's bot game starts. Verify with a session test
- [x] 3.2 In `main.ts`, build a tracker for every new local game and every new online `gameId`, and feed it from
  `playEvent`. Save unlocks at once and queue them for display. Verify with a test or by playing a local Waves game
  through wave 1 and checking local storage has Surfer
- [x] 3.3 Add the unlock panel (`#unlocks`, below the banner, `aria-live="polite"`) shown only during `roundOver`
  and cleared at the next round start, and the result-screen list (`#go-unlocks`). Add markup and styles using
  `--tank-*` variables. Verify with screen tests: earned mid-round shows only at round end, the last round's unlocks
  appear on the result screen, and several are all shown
- [x] 3.4 Add the Achievements screen (`#achievements` overlay) and the setup screen's `Achievements n / 20` button:
  earned and greyed-locked rows, Completionist progress, "Needs online play" on two-player rows when there's no
  server, the storage note (and "can't be saved in this browser" when storage is unavailable), and Back. Verify with
  screen tests for every Achievements screen scenario
- [x] 3.5 Wire the Achievements screen into keyboard and gamepad menu navigation (open from setup, Back with
  Escape / B, focus returns to the button). Verify with a gamepad navigation test like the join overlay's

## 4. Docs and checks

- [x] 4.1 Add an Achievements section to the README: what they are, that they're stored per browser and per site
  (an embedding host's site gets its own set), and that clearing site data loses them. Also note that the server must
  be redeployed for online bank-shot, mud and MADness achievements. Verify the README renders
- [x] 4.2 Run the full build, lint and test suites and verify they all pass
- [ ] 4.3 Ask the developer to playtest locally with `npm run dev`: earn Surfer and Taunted, check the unlock panel
  between waves and on the result screen, and open the Achievements screen with the mouse, the keyboard and a gamepad.
  Then suggest `/qa` before `/opsx:archive`
