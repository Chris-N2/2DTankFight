# QA Report: mortar-silences-ai

**Verdict:** PASS
**Date:** 2026-10-29

This is a re-run. The first run failed only because task 5.2 (the playtest) was unticked. Since then 5.2 has been
ticked with a note from the developer's playtest. A test for holding fire through the jam has also been added
(previously a minor point). The simulation source is unchanged since the first run: the only changes are in
`tasks.md` and `src/sim/test/waves.test.ts`.

## Build & tests

| Command | Result |
|---|---|
| `npm install` | OK, 0 vulnerabilities (first run; dependencies unchanged since) |
| `npm run typecheck` (sim, client, client tests) | OK, no errors |
| `npm run lint` | OK, no warnings |
| `npm test` (`vitest run`) | OK: 22 files, 395 tests passed (one more than the first run: the new held-fire test) |
| `npm run build` | OK |
| `npm run format:check` | OK |
| `npx openspec validate mortar-silences-ai --strict` | "Change 'mortar-silences-ai' is valid" |

Extra check on the golden recordings (first run, still valid because the sim source hasn't changed): the comment in
`golden.test.ts` says the Last One Standing fingerprint changed only because every tank gained a field. I re-ran the
Last One Standing replay in a scratch test outside the repo with `mudJamsTurret` taken out of the fingerprint. It
gives the old value `c9aa4c74`, so Last One Standing plays exactly as before.

## Tasks

All tasks are ticked, including 5.2 (the playtest, 2026-10-29, by the developer).

## Scenario coverage

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| mortars: Splash slows tanks | Bogged down | Verified (unchanged) | `world.ts:92-93`, `mortar.ts:56` | `mortars.test.ts:257` |
| mortars: Splash slows tanks | No damage | Verified (unchanged) | `mortar.ts` | `mortars.test.ts:281` |
| mortars: Splash slows tanks | Turning and firing unaffected (non-jamming mode) | Verified | `world.ts:64` (jam needs `mudJamsTurret`, default `false` at `tank.ts:24`) | `mortars.test.ts:290` (Last One Standing) |
| mortars: Splash slows tanks | Caught in your own splash | Verified (unchanged) | `mortar.ts` | `mortars.test.ts:307` |
| mortars: Splash slows tanks | Walls don't shield | Verified (unchanged) | `mortar.ts` | `mortars.test.ts:317` |
| mortars: Splash slows tanks | Out of range | Verified (unchanged) | `mortar.ts` | `mortars.test.ts:325` |
| mortars: Splash slows tanks | A second splash restarts the slow | Verified (unchanged) | `mortar.ts:56` | `mortars.test.ts:335` |
| mortars: Splash slows tanks | Fresh start each round | Verified (unchanged) | `match.ts:149` | `mortars.test.ts:435` |
| mortars: Splash slows tanks | Last One Standing keeps every turret | Verified | `tank.ts:38-41`, `world.ts:64` | `mortars.test.ts:350` |
| waves: Mud jams AI turrets | Jammed for as long as it's slowed | Verified | `rules/waves.ts:107`, `tank.ts:38-41`, `world.ts:63-64` | `waves.test.ts:436` (fresh press every tick, no cooldown on lost presses, count equals `SLOW`); `waves.test.ts:445` (fire held through the jam: no shot when it ends, a fresh press fires) |
| waves: Mud jams AI turrets | A second splash restarts the jam | Verified | shared `slowTicks` (`mortar.ts:56`) | `waves.test.ts:458` |
| waves: Mud jams AI turrets | Shells already fired still fly | Verified | jam only gates new shots (`world.ts:64`) | `waves.test.ts:468` |
| waves: Mud jams AI turrets | Humans are never jammed | Verified | humans keep `mudJamsTurret = false` (`rules/waves.ts:90-94`) | `waves.test.ts:480`, plus `waves.test.ts:491` (every AI in every wave is flagged, the human never is) |
| ai-opponents: Waiting out a jammed turret | Holds its aim through the jam | Verified | `ai/think.ts:184-186` (`ready` false while jammed), `ai/think.ts:109-110` (watchdog paused) | `ai.test.ts:521` |
| ai-opponents: Decisive movement | Steady at a corner | Verified (unchanged) | `ai/think.ts` | `ai.test.ts:485` |
| ai-opponents: Decisive movement | Always making progress (now excepting a jammed turret) | Verified | `ai/think.ts:106-115` | jam exemption: `ai.test.ts:521`; the recovery half (unchanged) is covered indirectly by `ai.test.ts:513` and `aiSteadiness.test.ts:126` |
| ai-opponents: Decisive movement | Corner dance stays rare | Verified (unchanged) | `ai/think.ts` | `aiSteadiness.test.ts:123-133` (mortars off) |

Totals: 17 scenarios, 17 Verified, 0 Implemented-untested, 0 Missing/wrong.

The new test at `waves.test.ts:445` holds fire from the landing tick, through the jam, and for one more tick after it
ends. It expects no `shotFired`, then a release and a fresh press, which fires. This pins down the requirement's "a
press while jammed SHALL NOT fire a shell later" clause.

## Architecture

- The simulation stays pure. The change adds a boolean field and a pure helper. There are no timers, no DOM and
  nothing from the renderer.
- Mode rules stay out of `world.ts`: the Waves rules set the flag in `setUp`, and `world.ts` only asks
  `turretJammed(tank)`.
- The jam and the slow share `slowTicks`, so they can't drift apart. The existing mud drawing
  (`renderer.ts:373`) marks exactly the jammed ticks.
- The firing order is as designed. A mortar landing on tick *t* jams ticks *t* to *t+S−1*, and the tank can fire
  again on tick *t+S*. Firing still needs a fresh press each time.

## Findings

### Implementation bugs (spec was right, code wasn't)

None.

### Spec gaps (spec wrong or incomplete)

None.

### Minor / suggestions (do not block)

1. **The AI fires one tick (1/60 s) after the jam ends**, because it decides before the tick runs. The spec allows
   this. Left alone on purpose.
2. **"Corner dance stays rare" wording** mentions only the lob as an exception, not the jam. That's harmless while
   that test runs with mortars off. Left alone on purpose.
3. **"Always making progress" recovery half** is tested only indirectly. It is unchanged by this change. Left alone
   on purpose.
4. **The 5.2 note adds to the developer's words.** The note in `tasks.md` says the jam is "expected to matter more in
   two-player co-op Waves". As relayed, the developer didn't say that: it's a reasonable guess, but not a playtest
   finding. Consider rewording it as a hypothesis, so a future reader doesn't take it as observed. The playtest
   itself ("works fine", "doesn't give the human much of an advantage right now") matches the proposal's non-goal of
   leaving balance for later.
5. **Balance follow-up.** The playtest suggests the jam is a modest edge single-player, partly because moving AI
   tanks are hard to mortar. The design already names the levers (`mortarSlowDuration`, splash radius) if a later
   balancing pass wants more pay-off.

## Manual checks for the human

- Done: the developer playtested a Waves game on 2026-10-29 (task 5.2): "it works fine, although it doesn't give the
  human much of an advantage right now".
- Optional, if not already looked at: check that the menu hint ("In Waves, the mud jams the enemy's guns too.") reads
  well and fits the menu layout.
