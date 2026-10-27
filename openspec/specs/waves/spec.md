# waves Specification

## Purpose

The rules of the Waves mode: the human survives successive waves of co-operating AI tanks that grow in number (with
thinner armour while their numbers grow) and then in toughness, and scores the number of waves cleared. With mortars on, the human (never the AI) has one
mortar per wave. Single-player only so far: co-op with a second human, respawning and the friendly-fire option arrive
with the changes they depend on.

## Requirements

### Requirement: Waves options
Before a Waves game, the player SHALL choose the number of AI tanks in the first wave, from 1 to 4 inclusive, with a
default of 1, and whether mortars are on (see the `mortars` spec). Waves SHALL NOT offer a number of rounds.

#### Scenario: Choosing the starting wave size
- **WHEN** the player starts a Waves game with a starting AI count of 2
- **THEN** wave 1 has the human and 2 AI tanks

#### Scenario: Invalid starting count is rejected
- **WHEN** a Waves game is requested with a starting AI count of 0 or 5
- **THEN** the game is not created and the reason is reported

### Requirement: Wave start
At the start of each wave, the human and that wave's AI tanks SHALL all be alive at shuffled spawn points. The human
SHALL have full hit points, and each AI tank SHALL have the hit points for that wave's size and escalation. All
shells and mortars in flight SHALL be cleared, and no tank SHALL be slowed. With mortars on, the human SHALL have one
mortar loaded and the AI tanks SHALL have none: in Waves the mortar is the outnumbered human's tool. A countdown SHALL
run during which all tank inputs are ignored. Play begins when the countdown ends.

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

### Requirement: Wave size grows
Wave 1 SHALL have the chosen starting number of AI tanks. Each following wave SHALL have one more AI tank than the
one before, until there are 4 AI tanks (5 tanks in total). After that every wave SHALL have 4 AI tanks.

#### Scenario: One more tank each wave
- **WHEN** a game starts with 1 AI tank and the human clears waves 1, 2 and 3
- **THEN** waves 2, 3 and 4 have 2, 3 and 4 AI tanks

#### Scenario: Never more than five tanks
- **WHEN** a game starts with 3 AI tanks and the human clears several waves
- **THEN** no wave ever has more than 4 AI tanks

### Requirement: AI armour follows wave size
Until escalation begins, an AI tank's maximum hit points SHALL depend on the number of AI tanks in its wave, as
configured. By default: 1 AI tank has 3 hit points (the normal maximum), each of 2 AI tanks has 2, and each of 3 or 4
AI tanks has 1. The rule SHALL follow the number of AI tanks, not the wave number, so a game started with more AI
tanks starts with thinner armour.

#### Scenario: Bigger waves, thinner armour
- **WHEN** a wave has 2 AI tanks, or 3 or 4 AI tanks, before any escalation
- **THEN** each AI tank has 2 hit points, or 1 hit point, respectively

#### Scenario: A big start is a thin start
- **WHEN** a game starts with 4 AI tanks
- **THEN** each AI tank in wave 1 has 1 hit point

### Requirement: Escalation
Once a wave has 4 AI tanks, each wave after the first such wave SHALL be one escalation step harder than the wave
before. The steps SHALL apply in this order, each by the configured amounts:
1. AI tanks' maximum hit points increase, until they equal the configured normal maximum, and never beyond it.
2. AI shell damage increases, until one AI shell's damage is at least the human's maximum hit points.
3. AI shell speed increases, until it reaches the configured cap of twice the normal shell speed.

When every step has been applied, later waves SHALL stay at that maximum difficulty. Escalation SHALL apply only to AI
tanks. The human's hit points, damage and shell speed SHALL never change.

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

### Requirement: AI tanks are allies
In Waves, every AI tank SHALL treat only humans as targets. An AI tank SHALL NOT fire while an ally is in its firing
lane before its target. Shells SHALL still damage any tank they hit, whoever fired them, so a stray or bounced AI
shell can still destroy an ally.

#### Scenario: AI tanks don't fight each other
- **WHEN** two AI tanks have a clear line of sight to each other and the human is hidden
- **THEN** neither targets or fires at the other

#### Scenario: Holding fire for an ally
- **WHEN** an AI tank is lined up on the human with another AI tank directly between them
- **THEN** it does not fire until its lane is clear

#### Scenario: Accidents still happen
- **WHEN** an AI tank's shell hits an allied AI tank (for example, after a bounce)
- **THEN** the ally takes damage as from any other shell

### Requirement: Wave end
A wave SHALL be cleared as soon as every AI tank in it is destroyed. The client SHALL then show a short "wave cleared"
result before the next wave's countdown begins automatically. If the human is destroyed, the game SHALL end
immediately. If the human and the last AI tank are destroyed in the same tick, the wave SHALL count as cleared and the
game SHALL then end.

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

### Requirement: Waves score
The score of a Waves game SHALL be the number of waves cleared. The game result SHALL report it.

#### Scenario: Score at game over
- **WHEN** the human is destroyed during wave 5
- **THEN** the game result reports 4 waves cleared
