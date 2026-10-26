# Playtest notes: gamepad-support

The human developer played several full games on an Xbox controller in the browser, including several from setup to
"Play again" on the gamepad alone, with no keyboard.

## Impressions

- **Steering and aiming feel fine and very smooth.** The linear rescale from the dead zone's edge works; no response
  curve is needed for now.
- **Dead zone (0.2):** the tank doesn't move at all with the stick at rest. No creep.
- **Xbox controller mapping:** A, B, Start, RT and the d-pad all behave as expected (the browser's standard layout).
- **Menus:** the repeat speed (400 ms delay, then every 120 ms) is fine, and gamepad menu navigation is "very
  intuitive".
- **Whole games on the gamepad alone:** all fine, from setup to "Play again".
- **Learning curve:** after an hour on the keyboard, the gamepad was briefly harder. Practice, not a design problem.
- **Fairness:** the developer felt rotation-based steering gives a gamepad player less of an edge than expected.
  The tank still turns at most at its fixed rate, so the stick adds precision, not speed. Worth bringing into the
  multiplayer change's fairness discussion.

## Tuning

None needed. Dead zone, throttle threshold, trigger threshold and menu repeat timings stay as designed.

## Seen once, not reproduced

- **Firing felt delayed after pressing A,** possibly just after starting a game with the gamepad. It hasn't
  happened again. The code shows no delay path: the start-of-game fire latch releases on the first tick that A isn't
  held, and isn't re-armed between rounds. The likeliest cause is the 0.5 s reload. A press during the reload is
  dropped rather than queued, so a quick second tap can make the next shot seem late. If it recurs, buffering a press
  made during the reload is a small possible change.

## QA manual checks (human developer)

All nine manual checks from the QA report passed on the Xbox controller. One oddity, not caused by our code:
switching the controller off with its Guide ("power") button doesn't trigger the disconnect pause on this machine.
Battle.net captures the Guide button and opens its game list before the browser sees it. Unplugging the controller
pauses the game as specified.

## QA spec gaps, recorded rather than changed

- With three or more devices pulling different ways at once (two pads plus the keyboard), the combined turn depends
  on the order they're combined in. It doesn't arise in practice with one player.
- While a gamepad is in use, unplugging *any* pad pauses the game, not only the one being used. This is identical
  with one pad. Revisit if local multi-pad play ever becomes a thing.
- Holding fire through a later round's countdown fires on the first tick of play, for keyboard and gamepad alike.
  This predates this change and is arguably fine (poised at "GO!").
