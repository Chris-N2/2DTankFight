## ADDED Requirements

### Requirement: Respawn at the next wave
In a two-player Waves game, a human destroyed during a wave SHALL stay out for the rest of that wave. If the other
human clears the wave, both humans SHALL start the next wave alive, with full hit points and (with mortars on) a
mortar loaded, like any wave start. The team's waves-cleared count is shared.

#### Scenario: Back for the next wave
- **WHEN** in a two-player game the first human is destroyed and the second human clears the wave
- **THEN** the next wave starts with both humans alive on full hit points

#### Scenario: Sitting it out
- **WHEN** in a two-player game the first human is destroyed while AI tanks remain and the second human is alive
- **THEN** the wave continues, and the first human does not return until the next wave starts

### Requirement: A human leaves
When one human leaves a two-player Waves game (see the `simulation` spec), the game SHALL carry on for the remaining
human, keeping the waves cleared so far. If the human who stays was destroyed during the wave still being played,
no human is left alive and the game SHALL end. If the wave has already been cleared (the pause before the next
wave), the human who stays SHALL respawn for the next wave as usual. Wave sizes SHALL stay those of a two-player game, so a player left on
their own isn't punished with an extra AI tank for their partner's departure.

#### Scenario: Carrying on alone
- **WHEN** in a two-player game one human leaves during wave 3, with 2 waves cleared, while the other human is alive
- **THEN** wave 3 carries on with the remaining human, and the game result later counts those 2 waves

#### Scenario: Nobody left to carry on
- **WHEN** in a two-player game one human is destroyed mid-wave and the other human then leaves
- **THEN** the game ends with the waves cleared so far

#### Scenario: A cleared wave still earns the respawn
- **WHEN** in a two-player game the first human is destroyed, the second human clears the wave and then leaves
  during the pause before the next wave
- **THEN** the game carries on, and the first human starts the next wave alive

#### Scenario: No reinforcements for the AI
- **WHEN** a human leaves a two-player game that started with 3 AI tanks, and the remaining human clears the wave
- **THEN** the next wave still has 3 AI tanks

## MODIFIED Requirements

### Requirement: Waves options
Before a Waves game, the host SHALL choose:
- the number of AI tanks in the first wave, with a default of 1: from 1 to 4 inclusive in single-player, and from 1
  to 3 inclusive with two humans;
- with two humans, whether **friendly fire** is on, which decides whether one human's shells can damage the other
  (see the `simulation` spec); it is off by default, and has no effect in single-player;
- whether mortars are on (see the `mortars` spec);
- the map mode (see the `map-selection` spec).

Waves SHALL NOT offer a number of rounds. A map sequence in Waves repeats from its start for as long as the game lasts.

#### Scenario: Choosing the starting wave size
- **WHEN** the player starts a Waves game with a starting AI count of 2
- **THEN** wave 1 has the human and 2 AI tanks

#### Scenario: Invalid starting count is rejected
- **WHEN** a Waves game is requested with a starting AI count of 0 or 5, or a two-player game with a starting AI count
  of 4
- **THEN** the game is not created and the reason is reported

#### Scenario: A long game outlasts its sequence
- **WHEN** a Waves game with a 7-map sequence reaches wave 8
- **THEN** wave 8 is played on the sequence's first map

#### Scenario: Friendly fire is off unless chosen
- **WHEN** a two-player Waves game is created without choosing friendly fire
- **THEN** friendly fire is off

### Requirement: Wave start
At the start of each wave, every human in the game and that wave's AI tanks SHALL all be alive at shuffled spawn
points. Each human SHALL have full hit points, and each AI tank SHALL have the hit points for that wave's size and
escalation. All shells and mortars in flight SHALL be cleared, and no tank SHALL be slowed. With mortars on, each human
SHALL have one mortar loaded and the AI tanks SHALL have none: in Waves the mortar is the outnumbered humans' tool. A
countdown SHALL run during which all tank inputs are ignored. Play begins when the countdown ends.

#### Scenario: Full armour every wave
- **WHEN** the human finishes a wave with 1 hit point left and the next wave begins
- **THEN** the human starts the new wave with full hit points

#### Scenario: Countdown before each wave
- **WHEN** a wave begins
- **THEN** no tank moves or fires until the countdown has ended

#### Scenario: Mortar refilled each wave
- **WHEN** the human launches their mortar in wave 2 and wave 3 begins, with mortars on
- **THEN** the human has one mortar loaded again

#### Scenario: Only humans have mortars
- **WHEN** a wave begins with mortars on
- **THEN** no AI tank has a mortar, and none launches one at any point during the wave

#### Scenario: Both humans armed
- **WHEN** a two-player wave begins with mortars on
- **THEN** each human has one mortar loaded

### Requirement: Wave size grows
Wave 1 SHALL have the chosen starting number of AI tanks. Each following wave SHALL have one more AI tank than the
one before, until the game has 5 tanks in total: 4 AI tanks in single-player, 3 with two humans. After that every
wave SHALL have that many AI tanks.

#### Scenario: One more tank each wave
- **WHEN** a game starts with 1 AI tank and the human clears waves 1, 2 and 3
- **THEN** waves 2, 3 and 4 have 2, 3 and 4 AI tanks

#### Scenario: Never more than five tanks
- **WHEN** a game starts with 3 AI tanks and the human clears several waves
- **THEN** no wave ever has more than 4 AI tanks

#### Scenario: Two humans, three AI at most
- **WHEN** a two-player game starts with 1 AI tank and the humans clear several waves
- **THEN** waves 2 and 3 have 2 and 3 AI tanks, and no wave ever has more than 3

### Requirement: Escalation
Once a wave has the full number of AI tanks (4 in single-player, 3 with two humans), each wave after the first such
wave SHALL be one escalation step harder than the wave before. The steps SHALL apply in this order, each by the
configured amounts:
1. AI tanks' maximum hit points increase, until they equal the configured normal maximum, and never beyond it.
2. AI shell damage increases, until one AI shell's damage is at least a human's maximum hit points.
3. AI shell speed increases, until it reaches the configured cap of twice the normal shell speed.

When every step has been applied, later waves SHALL stay at that maximum difficulty. Escalation SHALL apply only to AI
tanks. The humans' hit points, damage and shell speed SHALL never change.

#### Scenario: Armour comes first
- **WHEN** the human clears the first wave that had 4 AI tanks
- **THEN** in the next wave every AI tank has more maximum hit points than before, while AI damage and shell speed
  are unchanged

#### Scenario: Armour recovers to normal
- **WHEN** waves continue after the first wave that had 4 AI tanks
- **THEN** AI maximum hit points rise wave by wave until they equal the human's maximum hit points, and never exceed
  it

#### Scenario: Damage rises until one hit is lethal
- **WHEN** waves continue after the armour steps are done
- **THEN** AI shell damage rises wave by wave until a single AI shell destroys a full-health human, and then stops
  rising

#### Scenario: Shell speed is capped
- **WHEN** waves continue after the damage steps are done
- **THEN** AI shells get faster wave by wave, never exceeding twice the normal shell speed

#### Scenario: The human never escalates
- **WHEN** any wave begins
- **THEN** the human's maximum hit points, shell damage and shell speed equal the configured defaults

#### Scenario: Two-player escalation starts at three
- **WHEN** two humans clear the first wave that had 3 AI tanks
- **THEN** in the next wave every AI tank has more maximum hit points than before

### Requirement: Wave end
A wave SHALL be cleared as soon as every AI tank in it is destroyed. The client SHALL then show a short "wave cleared"
result before the next wave's countdown begins automatically. When no human is left alive, the game SHALL end
immediately; with two humans, that means both have been destroyed (or one destroyed and the other gone, see *A human
leaves*). If the last human alive and the last AI tank are destroyed in the same tick, the wave SHALL count as cleared
and the game SHALL then end.

#### Scenario: Clearing a wave
- **WHEN** the last AI tank of a wave is destroyed while the human is alive
- **THEN** the waves-cleared count goes up by one and the next wave begins after a short pause

#### Scenario: Game over
- **WHEN** the human is destroyed while at least one AI tank is alive
- **THEN** the game ends with the number of waves cleared so far

#### Scenario: Going down together
- **WHEN** the human and the last AI tank are destroyed in the same tick
- **THEN** that wave counts as cleared and the game ends

#### Scenario: Hoisted by your own shell
- **WHEN** the human is destroyed by their own bounced shell
- **THEN** the game ends just as for any other destruction

#### Scenario: One down is not game over
- **WHEN** in a two-player game one human is destroyed while the other is alive
- **THEN** the game continues

#### Scenario: Both down is game over
- **WHEN** in a two-player game the second human is destroyed while at least one AI tank is alive
- **THEN** the game ends with the number of waves cleared so far
