## MODIFIED Requirements

### Requirement: AI acts only through player inputs
An AI tank SHALL be controlled solely by producing the same per-tick input (throttle, turn, fire, mortar) that a
human player produces. AI tanks SHALL have no abilities, speed, damage, hit points or cooldowns different from a
human's tank, with two exceptions: the Waves rules (see the `waves` spec) set AI hit points by wave size, escalation
changes AI hit points, shell damage and shell speed, and AI tanks have no mortar in Waves. An AI MAY read the current
game state to make decisions.

#### Scenario: Same rules for everyone
- **WHEN** an AI tank and a human tank are given identical inputs from identical positions in Last One Standing
- **THEN** they move, fire, launch mortars, take damage and are slowed identically

## ADDED Requirements

### Requirement: Mortar use
In Last One Standing with mortars on, an AI tank with a loaded mortar SHALL lob it at a target that has been hidden
from its turret behind cover for at least the configured AI mortar patience, and is within mortar range. To lob, the
AI SHALL stop, turn to face the target, hold the mortar button until the charged range matches the distance to the
target, and release. Its aim and range SHALL include a small seeded random error, so it is beatable. Once it has
committed to a lob, it SHALL complete it. An AI SHALL NOT lob at a target it has a clear turret shot at, and SHALL
NOT lob at a target so close that it would be caught in its own splash.

#### Scenario: Flushing out a hider
- **WHEN** in Last One Standing with mortars on, an AI tank's target stays hidden behind an obstacle within mortar
  range for longer than the AI mortar patience
- **THEN** within a bounded time the AI launches its mortar, and it lands close enough to slow the target if the
  target does not move

#### Scenario: Turret first
- **WHEN** an AI tank has a clear turret shot at its target
- **THEN** it does not launch its mortar at that target

#### Scenario: Patience
- **WHEN** an AI tank's target has only just moved behind cover
- **THEN** the AI does not launch its mortar until the target has stayed hidden for the AI mortar patience

#### Scenario: No mortars, no lobbing
- **WHEN** the game is Waves, or mortars are off
- **THEN** no AI tank ever holds the mortar button

#### Scenario: Reproducible lobs
- **WHEN** the same round is simulated twice with the same seed, mortars on and the same human inputs
- **THEN** every AI tank launches its mortar on the same tick, to the same landing point, both times
