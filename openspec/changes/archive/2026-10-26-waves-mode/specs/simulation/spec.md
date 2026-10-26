## MODIFIED Requirements

### Requirement: Firing shells
When a live tank's fire input changes from not held to held, and its fire cooldown has elapsed, the tank SHALL fire one
shell from its muzzle in the direction it faces. The shell SHALL travel at the firing tank's shell speed and deal the
firing tank's shell damage. By default these are the configured shell speed and damage, and the game mode's rules may
set them per tank. Holding fire SHALL NOT fire repeatedly; the player must release and press again. A tank's
ammunition is unlimited.

#### Scenario: Pressing fire launches a shell
- **WHEN** a tank whose cooldown has elapsed presses fire
- **THEN** one shell appears at the tank's muzzle travelling along the tank's heading and a "shot fired" event is emitted

#### Scenario: Holding fire does not auto-fire
- **WHEN** a tank holds fire continuously for longer than several cooldown periods
- **THEN** exactly one shell is fired

#### Scenario: Cooldown limits fire rate
- **WHEN** a tank presses fire, releases, and presses again before its cooldown has elapsed
- **THEN** no second shell is fired

#### Scenario: Shells carry their tank's speed and damage
- **WHEN** a tank whose shell speed is 1.5× the default and whose shell damage is 2 fires, and the shell hits another
  tank
- **THEN** the shell travels at 1.5× the default speed and the target loses 2 hit points

### Requirement: Hit points
Every tank SHALL have a maximum hit points value and SHALL start each round or wave with that many hit points. By
default every tank's maximum is the configured maximum hit points, and the game mode's rules may set it per tank.

#### Scenario: Full health at round start
- **WHEN** a new round begins
- **THEN** every tank's hit points equal its maximum hit points

#### Scenario: Defaults are equal
- **WHEN** a Last One Standing match is created
- **THEN** every tank has the configured maximum hit points, shell damage and shell speed
