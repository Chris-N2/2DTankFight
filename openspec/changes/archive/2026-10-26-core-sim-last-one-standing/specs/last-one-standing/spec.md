## Purpose

The rules of the Last One Standing mode: how rounds start and end, who scores, and when the game is won, lost or
drawn. This change covers single-player only, where all AI tanks count together as one opponent.

## ADDED Requirements

### Requirement: Game options
Before a single-player Last One Standing game, the player SHALL choose the number of AI opponents (1 to 4 inclusive)
and the number of rounds (1, 3, 5 or 7). Odd round counts guarantee a majority is possible.

#### Scenario: Valid options accepted
- **WHEN** the player starts a game with 4 AI opponents and 5 rounds
- **THEN** each round is played by the human and 4 AI tanks, for up to 5 rounds

#### Scenario: Out-of-range options rejected
- **WHEN** a game is requested with 0 or 5 AI opponents, or with a round count other than 1, 3, 5 or 7
- **THEN** the game is not started

### Requirement: Round start
At the start of each round every tank SHALL be alive with full hit points at its assigned spawn point, all shells
SHALL be cleared, and a countdown SHALL run during which all tank inputs are ignored. Play begins when the countdown
ends.

#### Scenario: Countdown freezes tanks
- **WHEN** a player presses keys during the round-start countdown
- **THEN** no tank moves or fires until the countdown has finished

### Requirement: Round end and scoring
A round SHALL end as soon as one of the following happens, and be scored as stated:
- the human is the only live tank → the human scores 1 point;
- the human is eliminated while at least one AI tank is still alive → the AI side scores 1 point;
- the human and all remaining AI tanks are eliminated in the same tick → the round is drawn and nobody scores.

The round SHALL end immediately when the human is eliminated, without waiting for the AI tanks to finish each other
off. Every finished round, including a drawn one, SHALL count towards the number of rounds played. Statistics for
individual AI tanks SHALL NOT be tracked.

#### Scenario: Human wins the round
- **WHEN** the last AI tank is eliminated and the human is still alive
- **THEN** the round ends and the human's score increases by 1

#### Scenario: Human eliminated
- **WHEN** the human is eliminated while two AI tanks remain
- **THEN** the round ends immediately and the AI side's score increases by 1

#### Scenario: Mutual destruction
- **WHEN** the human and the last AI tank are eliminated in the same tick
- **THEN** the round ends as a draw, neither score changes, and the round counts as played

#### Scenario: Shells after round end have no effect
- **WHEN** a round has ended and shells are still in flight
- **THEN** those shells cannot change the round's result

### Requirement: Game end
The game SHALL end as soon as one side's score lead is greater than the number of rounds remaining (the result can no
longer change), or when all selected rounds have been played. The side with more points wins; equal points is a draw.

#### Scenario: Majority clinches the game
- **WHEN** in a 5-round game the human reaches 3 points after 4 rounds
- **THEN** the game ends immediately as a human win without playing round 5

#### Scenario: AI clinches the game
- **WHEN** in a 5-round game the AI side reaches 3 points
- **THEN** the game ends immediately as a human loss

#### Scenario: Early end despite draws
- **WHEN** in a 5-round game the score is human 2, AI 0 after 4 rounds (two drawn)
- **THEN** the game ends as a human win, because the AI cannot catch up in the one remaining round

#### Scenario: Drawn game
- **WHEN** in a 3-round game the rounds finish human win, AI win, drawn round
- **THEN** the game ends as a draw at 1–1

### Requirement: Rounds are independent
AI opponents SHALL NOT change difficulty between rounds. Nothing except the score and the round number SHALL carry
over from one round to the next.

#### Scenario: Fresh round
- **WHEN** a new round starts after the human finished the previous round on 1 hit point
- **THEN** the human starts the new round on full hit points and the AI tanks behave with the same difficulty as before
