## ADDED Requirements

### Requirement: Mud jams AI turrets
In Waves, an AI tank slowed by a mortar splash SHALL NOT fire its turret while it is slowed. The jam SHALL start
when the slow starts and end when the slow ends, and a second splash that restarts the slow SHALL restart the jam
with it. A fire press while jammed SHALL do nothing: it SHALL NOT fire a shell later, and it SHALL NOT start a
cooldown. Shells already in flight SHALL be unaffected. Human tanks SHALL never be jammed. When the jam ends, the AI
tank SHALL be able to fire again straight away if its cooldown allows.

The jam is the mortar's pay-off in Waves: landing one on the AI pack gives the outnumbered human a few seconds to go
on the attack.

#### Scenario: Jammed for as long as it's slowed
- **WHEN** in Waves a mortar slows an AI tank and the AI presses fire on every possible tick
- **THEN** it fires no shell until the slow has ended, and fires again once it has

#### Scenario: A second splash restarts the jam
- **WHEN** in Waves a jammed AI tank is caught by a second mortar partway through its slow
- **THEN** it cannot fire for a full slow duration from the second landing

#### Scenario: Shells already fired still fly
- **WHEN** in Waves an AI tank fires and a mortar slows it while its shell is in flight
- **THEN** the shell flies on and can still hit

#### Scenario: Humans are never jammed
- **WHEN** in Waves the human is caught in their own mortar's splash and presses fire while slowed
- **THEN** the human fires as normal
