## ADDED Requirements

### Requirement: One or two human players
A match SHALL be created with one or two human tanks, as its options say; one is the default. Each human tank SHALL
be controlled only by the input supplied for its own id, so two humans move, fire and launch mortars independently.
Together with the AI tanks there SHALL never be more than 5 tanks in a match. A single-player match SHALL behave
exactly as it did before two-player matches existed: for the same options and seed, the same tanks, spawns, events and
results.

#### Scenario: Two humans, two sets of controls
- **WHEN** a two-player match is in play and only the first human's input holds forward throttle for one tick
- **THEN** the first human's tank moves and the second human's tank does not

#### Scenario: Single-player is unchanged
- **WHEN** a single-player match is created with the same options and seed as before this change, and fed the same
  inputs
- **THEN** it produces the same states, events and result as before

#### Scenario: Too many tanks rejected
- **WHEN** a two-player match is requested with 4 AI opponents, or with a starting wave of 4 AI tanks
- **THEN** the match is not created and the reason is reported

### Requirement: Leaving a match
A human SHALL be able to leave a two-player match at any point before the game is over, whatever the phase (countdown,
play, or the pause between rounds or waves). Their tank SHALL be removed from the match straight away, together with
its shells and any mortar it has in flight, so nothing it fired can still score or slow anyone. A "left" event SHALL be
emitted identifying the human. What leaving does to the game is decided by the game mode (see the `waves` and
`last-one-standing` specs). Leaving a game that is already over SHALL change nothing.

#### Scenario: A clean exit
- **WHEN** a human leaves during play with two of their shells in flight
- **THEN** their tank and both shells are gone from the match and a "left" event is emitted

#### Scenario: Too late to leave
- **WHEN** a human leaves a match whose game is already over
- **THEN** the match's state and result are unchanged

## MODIFIED Requirements

### Requirement: Shell hits and damage
When a shell touches a live tank, the shell SHALL be destroyed, the tank SHALL lose hit points equal to the shell's
damage, and a "hit" event SHALL be emitted identifying the shooter and the target. A shell SHALL NOT hit the tank that
fired it until that shell has bounced; after bouncing, it SHALL be able to hit its own tank.

When friendly fire is off (two-player Waves; see the `waves` spec), a shell fired by one human that touches the other
human SHALL be destroyed without doing any damage, and a "friendly hit" event SHALL be emitted instead of a "hit"
event, so the client can show a harmless ricochet. This SHALL apply whether or not the shell has bounced. Friendly
fire SHALL NOT protect a human from their own shells, and SHALL NOT affect shells fired by AI tanks.

#### Scenario: Hitting an opponent
- **WHEN** a shell touches a tank other than its shooter
- **THEN** the target's hit points drop by the shell damage and the shell is removed

#### Scenario: No self-hit on launch
- **WHEN** a shell is fired and has not yet bounced
- **THEN** it cannot damage the tank that fired it

#### Scenario: Self-hit after a bounce
- **WHEN** a shell bounces off a wall and travels back into the tank that fired it
- **THEN** that tank takes damage, as tradition demands

#### Scenario: Friendly fire off
- **WHEN** friendly fire is off and one human's shell, bounced or not, touches the other human
- **THEN** the shell is removed, the other human's hit points are unchanged, and a "friendly hit" event is emitted

#### Scenario: Friendly fire on
- **WHEN** friendly fire is on and one human's shell touches the other human
- **THEN** the other human takes damage as from any other shell

#### Scenario: Still hoisted by your own shell
- **WHEN** friendly fire is off and a human's own shell bounces back into them
- **THEN** that human takes damage
