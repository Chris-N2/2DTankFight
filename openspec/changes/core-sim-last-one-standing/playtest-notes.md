# Playtest notes — core-sim-last-one-standing

Played by the human developer on the Proving Ground board, keyboard controls, 1–4 AI opponents, several full games.

## Impressions

- **Fun, fast and furious.** It looks excellent and feels polished for this stage. 1v1 against a single AI is
  especially good fun.
- **Hard with 2+ AI tanks.** Initially "quite obscenely difficult". After practice, roughly 30–40% of rounds won even
  against 3–4 AI. Beating the AI feels satisfying, but newcomers may find it the wrong side of frustrating.
- **Winning strategy:** hide until only one AI is left, then avoid it, sneak up on it, or draw it in. The AI has no
  guile and is poor at dodging, which balances its accuracy.
- **AI-on-AI fights end very quickly** by human standards. Fine, but some early wins came purely from the AIs
  wiping each other out.
- **Luck plays a part:** spawn positions relative to the AI tanks affect the odds. Acceptable — good games have some
  luck — and more boards (change 5) will add variety.
- **"Hoisted by your own shell!"** got a chuckle.

## Balance change made

- **AI rate of fire.** The AI fired the instant every reload finished (2 shots/s); a human hammering the key manages
  noticeably less. Tanks still share the 0.5 s cooldown, but AI tanks now add a random 0–0.15 s pause after each
  reload (`aiFirePauseMax`), averaging about 87% of the previous rate and no longer metronomic. This was the
  developer's suggestion (0.85–0.9 of the rate, plus randomness).
- **Considered and rejected:** scaling the AI fire rate by the number of AI opponents (1 → 100%, 4 → 85%). Too indirect
  a lever; it would likely feel wrong.

Measured over 200 seeded rounds with 4 AI on Proving Ground: AI-only rounds went from a median of 5.9 s to 6.2 s.
The effect is deliberately small; further tuning can follow more play.

## Ideas for later changes

- **Gamepad support** via the browser Gamepad API. It would likely make the game much easier to control, and the input
  layer already reduces to throttle/turn/fire. A good candidate for a small change of its own.
- **Hold-to-auto-fire for humans** (a spec change from the current edge-triggered firing). Parked for now.
- **Smarter AI** (dodging, flanking) could be part of Waves escalation rather than a baseline change.

## Completable

Full games were played to completion, including a game won against a single AI and rounds won against 3–4 AI.
