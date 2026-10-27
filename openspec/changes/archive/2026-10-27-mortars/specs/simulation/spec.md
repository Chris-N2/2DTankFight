## MODIFIED Requirements

### Requirement: Tank input model
Each tank SHALL be controlled each tick by an input consisting of: throttle (forward, reverse or none), turn (a
number from −1, full left, to 1, full right, where 0 is no turn and values in between turn part-way), fire (held or
not held) and mortar (held or not held; see the `mortars` spec). A turn value outside −1 to 1 SHALL be clamped into
that range, and a turn value that is not a finite number SHALL be treated as 0. The turret SHALL be fixed to the hull
and always point in the direction the tank faces. Inputs for eliminated tanks SHALL be ignored.

#### Scenario: Missing input means idle
- **WHEN** no input is supplied for a live tank on a tick
- **THEN** the tank behaves as if throttle, turn, fire and mortar were all inactive

#### Scenario: Out-of-range turn is clamped
- **WHEN** a tank is given a turn value of 2.5 for one tick
- **THEN** it turns exactly as it would with a turn value of 1

#### Scenario: Invalid turn is ignored
- **WHEN** a tank is given a turn value that is not a finite number (for example NaN) for one tick
- **THEN** it does not turn, and the simulation stays deterministic

### Requirement: Tank movement
A tank SHALL rotate at its fixed turn rate multiplied by the size of its turn input, so a full turn input turns at
the full rate and a partial one turns proportionally slower. It SHALL move forward along its heading at a fixed speed
when throttle is forward, and move backward at a reduced fixed speed when throttle is reverse. While a tank is slowed
by a mortar (see the `mortars` spec), both driving speeds SHALL be multiplied by the slow factor; its turn rate SHALL
be unchanged. Turning and moving SHALL be able to happen in the same tick.

#### Scenario: Driving forward
- **WHEN** a tank facing east with no obstruction holds forward throttle for one tick
- **THEN** its position moves east by the forward speed multiplied by the tick duration and its heading is unchanged

#### Scenario: Reversing is slower
- **WHEN** a tank holds reverse throttle for one tick with no obstruction
- **THEN** it moves opposite to its heading by a distance smaller than one tick of forward movement

#### Scenario: Turning on the spot
- **WHEN** a tank holds turn left with no throttle for one tick
- **THEN** its heading changes anticlockwise by the turn rate multiplied by the tick duration and its position is unchanged

#### Scenario: Partial turn
- **WHEN** a tank holds a turn value of 0.5 with no throttle for one tick
- **THEN** its heading changes clockwise by half the turn rate multiplied by the tick duration

#### Scenario: Slowed driving
- **WHEN** a slowed tank facing east with no obstruction holds forward throttle for one tick
- **THEN** its position moves east by the forward speed multiplied by the slow factor and the tick duration
