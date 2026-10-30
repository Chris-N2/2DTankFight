## MODIFIED Requirements

### Requirement: Elimination
A tank whose hit points reach zero or less SHALL be eliminated: it is removed from play, no longer collides or can be
hit, and an "eliminated" event SHALL be emitted. Shells already fired by an eliminated tank SHALL continue in flight.
All hits within a single tick SHALL be resolved together, so several tanks can be eliminated in the same tick. In
particular, a tank that fires in a tick SHALL get its shot away even if another tank's shot fired in that same tick
destroys it, and a tank reduced to zero hit points SHALL stay in play until the end of the tick, so it still stops any
other shell that reaches it in that tick.

Besides the eliminated tank and the tank credited with it, the "eliminated" event SHALL report:
- the **tick** on which the tank was eliminated;
- whether the shell credited with it (the last to hit the tank in that tick) had **bounced** before hitting, i.e. a
  bank shot;
- whether the tank was **slowed** by mortar mud at that moment.

These facts SHALL NOT change what happens in the game; they are there so the client can recognise achievements.

#### Scenario: Tank destroyed
- **WHEN** a tank with 1 hit point is hit by a shell dealing 1 damage
- **THEN** the tank is eliminated in that tick and an "eliminated" event is emitted

#### Scenario: Shells outlive their tank
- **WHEN** a tank is eliminated while one of its shells is in flight
- **THEN** that shell keeps travelling and can still hit other tanks

#### Scenario: Simultaneous elimination
- **WHEN** two tanks each with 1 hit point are hit by shells in the same tick
- **THEN** both are eliminated in that same tick

#### Scenario: Point-blank trade
- **WHEN** two tanks with 1 hit point each, close enough that each shot hits as it leaves the barrel, fire in the
  same tick
- **THEN** both shots are fired and both tanks are eliminated, whatever order the tanks are processed in

#### Scenario: Destroyed tank still stops shells that tick
- **WHEN** two shells reach a tank with 1 hit point in the same tick
- **THEN** both shells hit it and are destroyed, and the tank is eliminated at the end of the tick

#### Scenario: Bank-shot kill reported
- **WHEN** a shell bounces off a wall and then destroys a tank
- **THEN** the "eliminated" event reports that the finishing shell had bounced

#### Scenario: Direct kill reported
- **WHEN** a shell that has not bounced destroys a tank
- **THEN** the "eliminated" event reports that the finishing shell had not bounced

#### Scenario: The finishing shell decides
- **WHEN** a direct shell and a bounced shell both hit a tank with 1 hit point in the same tick
- **THEN** the event credits the tank whose shell hit last in that tick, and reports whether that shell had bounced

#### Scenario: Destroyed while bogged down
- **WHEN** a tank still slowed by mortar mud is destroyed
- **THEN** the "eliminated" event reports that it was slowed

#### Scenario: Elimination tick reported
- **WHEN** two tanks are eliminated in the same tick
- **THEN** both "eliminated" events report the same tick, which is the match's tick when that step ran
