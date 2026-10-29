## ADDED Requirements

### Requirement: AI colours with two humans
Blue SHALL be reserved for "the other human" on each player's screen. In a match with two humans, no AI tank SHALL be
blue: the AI tanks SHALL be red, yellow and purple, and each AI tank SHALL keep its colour for the whole game, the same
on both players' screens. In a single-player match the AI tanks SHALL keep their existing colours, blue included,
since there is no other human to confuse it with.

#### Scenario: No blue AI in a two-player match
- **WHEN** a two-player match is created with 3 AI tanks
- **THEN** the AI tanks are red, yellow and purple, and none is blue

#### Scenario: Single-player colours unchanged
- **WHEN** a single-player match is created with 4 AI tanks
- **THEN** the AI tanks are red, blue, yellow and purple, as before

#### Scenario: Colours stay put across waves
- **WHEN** a two-player Waves game moves on from a wave with 2 AI tanks to one with 3
- **THEN** the two AI tanks from before keep their colours, and the new one takes the remaining colour
