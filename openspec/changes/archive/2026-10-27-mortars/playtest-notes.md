# Mortars: tuning notes

## From simulation runs during apply (2026-10-27)

- **AI lobs are rare in normal play.**
  - Setup: Proving Ground, 4 AI, a human who stays put (and can't be destroyed), 60 s per run.
  - Across 4 seeds, an AI target stayed hidden for longer than `aiMortarPatience` (2 s) only once. The other runs
    peaked at 0.5–1 s hidden.
  - The AI's navigation finds a firing position quickly, so in practice the AI usually lobs only when it genuinely
    can't reach a shot.
  - That's in keeping with "turret first", and it avoids the round-start mud barrage we were worried about.
  - If it feels like the AI never uses its mortar, the knob is `aiMortarPatience`. Try 0.75–1 s.
- **Human mortar numbers are untested by hand so far.** The starting values are: 50% slow for 2.5 s, 60 splash
  radius, range 150–600, 1 s charge and 0.8 s flight. Things to watch in a playtest:
  - whether a slow actually converts into a turret kill;
  - whether a self-mud feels funny rather than unfair.

## Manual playtest

Played by the developer, 2026-10-27, both modes with mortars on and off. Verdict: **no tuning needed**.

- **Tactics and pace:** it adds the hoped-for bit of tactical thought without slowing the game.
- **Bunched AI:** landing a mortar on bunched AI tanks is very satisfying.
- **AI lobbing:** the AI lobs if you stand still too long. It's still easy to manoeuvre out of the way, so it never
  feels like an unfair punishment.
- **Self-mud:** it only happens if you're trying to, or panicking. One mortar per round helps a lot.
- **Visuals:** the reticle, the arc with its shadow, the landing ring, the mud splash and the bogged-down look all
  work as specified.
- **Classic play:** switching mortars off hides the HUD's mortar cell, as expected.
- **Side note:** "Mutual destruction!" was seen in play for the first time.
