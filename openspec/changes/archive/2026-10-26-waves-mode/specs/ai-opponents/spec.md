## MODIFIED Requirements

### Requirement: AI acts only through player inputs
An AI tank SHALL be controlled solely by producing the same per-tick input (throttle, turn, fire) that a human player
produces. AI tanks SHALL have no abilities, speed, damage, hit points or cooldowns different from a human's tank,
except where the Waves rules (see the `waves` spec) set AI hit points by wave size and escalation changes AI hit
points, shell damage and shell speed. An AI MAY read the current game state to make decisions.

#### Scenario: Same rules for everyone
- **WHEN** an AI tank and a human tank are given identical inputs from identical positions in Last One Standing
- **THEN** they move, fire and take damage identically

### Requirement: Every tank for itself
In Last One Standing, an AI tank SHALL treat every other live tank, human or AI, as a potential target. In Waves, AI
tanks are allies and SHALL treat only humans as targets (see the `waves` spec).

#### Scenario: AI tanks fight each other
- **WHEN** in Last One Standing two AI tanks have a clear line of sight to each other and no human is visible to either
- **THEN** they engage each other

### Requirement: Target selection
An AI tank SHALL choose a target from the live tanks it may target in the current mode, preferring tanks it has a
clear line of sight to, and then nearer tanks. When its target is eliminated it SHALL choose a new target.

#### Scenario: Retarget after elimination
- **WHEN** an AI tank's current target is eliminated
- **THEN** within a short time the AI selects another live tank it may target, if there is one

### Requirement: Aiming and firing
An AI tank SHALL fire only when its target is within line of sight and the tank is facing the target within an aim
tolerance. An AI SHALL NOT knowingly fire at a target when an obstacle blocks the direct path, and in Waves it SHALL
NOT fire while an ally is in its firing lane before the target. If an AI tank is lined up on its target but cover
blocks its barrel's actual line (for example, because of its aim error), it SHALL re-aim or reposition, so that it
never stays silent and motionless indefinitely.

#### Scenario: Fires when lined up
- **WHEN** an AI tank has line of sight to its target and is facing it within the aim tolerance
- **THEN** it fires once its cooldown allows

#### Scenario: Lined up but blocked by cover
- **WHEN** an AI tank has line of sight to its target and is facing it within the aim tolerance, but its aim error puts
  the barrel's line into a nearby corner
- **THEN** within a bounded time it re-aims or moves, and goes on to fire

#### Scenario: Holds fire behind cover
- **WHEN** an obstacle lies directly between an AI tank and its target
- **THEN** the AI does not fire at that target

#### Scenario: An ally in the way doesn't freeze the AI
- **WHEN** in Waves an ally stays in an AI tank's firing lane
- **THEN** within a bounded time the AI moves or re-aims rather than waiting indefinitely
