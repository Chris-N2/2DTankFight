# Playtest notes — waves-mode

## Headless difficulty measurement (design D9)

Run before the playtest, so it starts from data. Proving Ground, default config, 20 seeds per row, each game capped at
ten minutes (no game hit the cap). This was a scratch measurement and is not a committed test.

Three scripted "humans":

- **idle:** never moves or fires.
- **hider:** faces the nearest AI tank and reverses away while it can see it, and fires when lined up on it.
- **AI proxy:** the human tank driven by the AI's own `think()`, as a rough stand-in for a player of the AI's skill.

| Player | Start AI | Co-op | Mean waves cleared | Median | Best | Mean game length (s) | AI-on-AI hits per game |
|---|---|---|---|---|---|---|---|
| idle | 1 | on | 0.0 | 0 | 0 | 9 | 0.0 |
| idle | 1 | off | 0.0 | 0 | 0 | 9 | 0.0 |
| idle | 2 | on | 0.0 | 0 | 0 | 7 | 0.1 |
| idle | 2 | off | 0.3 | 0 | 1 | 10 | 3.0 |
| idle | 4 | on | 0.0 | 0 | 0 | 6 | 0.0 |
| idle | 4 | off | 0.1 | 0 | 1 | 9 | 5.0 |
| hider | 1 | on | 0.7 | 1 | 1 | 14 | 0.0 |
| hider | 1 | off | 0.9 | 1 | 3 | 16 | 1.4 |
| hider | 2 | on | 0.1 | 0 | 1 | 9 | 0.0 |
| hider | 2 | off | 0.4 | 0 | 2 | 11 | 2.6 |
| hider | 4 | on | 0.0 | 0 | 0 | 6 | 0.0 |
| hider | 4 | off | 0.5 | 0 | 3 | 14 | 7.8 |
| AI proxy | 1 | on | 0.5 | 1 | 1 | 10 | 0.0 |
| AI proxy | 1 | off | 0.6 | 1 | 2 | 11 | 0.3 |
| AI proxy | 2 | on | 0.0 | 0 | 0 | 6 | 0.0 |
| AI proxy | 2 | off | 0.3 | 0 | 1 | 9 | 2.5 |
| AI proxy | 4 | on | 0.0 | 0 | 0 | 6 | 0.0 |
| AI proxy | 4 | off | 0.1 | 0 | 1 | 9 | 4.0 |

### What it says

- **Co-operation works as intended.** AI-on-AI hits drop to almost nothing with co-op on (0–0.1 per game, against
  2.5–7.8 with it off). The odd stray shell still lands, as the spec wants.
- **It removes the human's best tactic.** The Last One Standing playtest found the winning strategy against 3–4 AI was
  to hide while they wiped each other out. With co-op on, that never happens: against 2 or more co-operating AI
  tanks, no scripted player cleared a wave in 60 games.
- **One AI tank is a coin flip for an AI-level player** (AI proxy: about half clear wave 1), and the hider does a little
  better. A practised human should do better than both, since the AI "has no guile and is poor at dodging".
- **Expect escalation to be rare.** From a start of 1, escalation begins at wave 5, which means clearing waves of 2, 3
  and 4 co-operating tanks first. On these numbers few players will see it without practice.
- **Games are short:** 6–16 seconds of play on average for the scripted players. Real humans will last longer, but
  the breather and countdown between waves will be a noticeable share of a game.

### Questions for the playtest

1. Is a wave of 2–3 co-operating AI tanks beatable with practice, and still fun?
2. Should the starting default stay at 1 AI tank? (The data say yes.)
3. If it's too hard, which lever first? Options that need no structural change:
   - `wavesAiCooperate: false` (infighting back: the data show it roughly doubles the hider's waves cleared);
   - a slower ramp, e.g. adding a tank every second wave (this would need a small rule change);
   - a longer AI reaction delay in Waves only.
4. Does the escalation announcement ("AI armour up", "One hit is lethal!") read well in the countdown banner?

### Implementation note for the playtest

When an ally sits still directly in an AI tank's firing lane, the AI waits, then backs off and re-aims (the existing
blocked-barrel recovery, as designed in D5). It never freezes, but against a perfectly still ally it can take several
attempts to find a clear angle. In real games allies keep moving, so this may not matter. Worth watching for an AI
tank "dancing" behind an ally.

## First playtest and the armour revision (tasks 6.1–6.3)

The developer reached wave 4 (4 AI tanks) but found it very difficult: fun, but the wrong side of frustrating. The
hard part was destroying the tanks. The change now gives AI tanks thinner armour while waves grow: 1 AI tank takes
3 hits, 2 take 2 each, and 3 or 4 take 1 each, with escalation then rebuilding armour to 3 before damage and speed
rise as before (design D4). Turning infighting back on was rejected (inconsistent, dull 1v1 endings, too easy in
co-op). A slower AI fire rate in bigger waves is held back as a possible second lever, so each playtest changes one
thing.

The same measurement as above, rerun on the new curve (same seeds and settings, 20 per row). Co-op rows only:

| Player | Start AI | Mean waves cleared: before → after | Best: before → after |
|---|---|---|---|
| hider | 1 | 0.7 → 0.8 | 1 → 2 |
| hider | 2 | 0.1 → 0.2 | 1 → 1 |
| hider | 4 | 0.0 → 0.0 | 0 → 0 |
| AI proxy | 1 | 0.5 → 0.5 | 1 → 1 |
| AI proxy | 2 | 0.0 → 0.2 | 0 → 1 |
| AI proxy | 4 | 0.0 → 0.0 | 0 → 0 |

The idle player is unchanged (it never fires). With co-op off the numbers also rise slightly, as expected.

What it says: a small improvement for the scripted players, whose problem against 3–4 tanks is surviving focused fire
for more than about 6 seconds, not killing tanks. They're poor stand-ins for a human who uses cover, so the playtest
is the real test. If survival rather than killing turns out to be the problem, the deferred fire-rate lever is the
one that targets it.

## Playtest (task 5.4)

Played by the human developer on the Proving Ground board, with the armour revision in place.

- **Challenging, but much less frustrating.** Waves 3–4 are reached consistently, and wave 5 (the first escalation
  wave) a couple of times.
- **A good hook.** It has a strong "I could do this if I was more careful" feel that keeps you wanting another go.
- **Verdict:** it works well now. Challenging but not impossible. The co-operating AI stays, and the deferred
  fire-rate lever isn't needed for now.
- **Play again** keeps the mode and options in both modes (task 4.5).
- A full Waves game was played from setup to "Play again".
