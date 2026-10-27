## Purpose

Lets whoever hosts the game match its arena and menus to their own site's colours and font, without touching the
code. Gameplay colours stay fixed so the game is always readable.

## ADDED Requirements

### Requirement: Themeable settings
The game SHALL have these theme settings, each with a built-in default that reproduces the original look:

| Setting | What it colours | Default |
|---|---|---|
| `backdrop` | The page behind the arena | `#0d100b` |
| `floor` | The arena floor | `#26301f` |
| `grid` | The grid lines on the floor | `#2d3925` |
| `wall` | Obstacles; also menu headings and highlights | `#c9a66b` |
| `wallEdge` | Obstacle edges; also menu borders | `#8a6d3f` |
| `border` | The arena's outer border | `#8a6d3f` |
| `panel` | Menu and overlay panels | `rgba(20, 26, 16, 0.92)` |
| `ink` | Main text | `#f2ecd8` |
| `muted` | Secondary text | `#a9a58f` |
| `accent` | Focus outlines, the Start button, highlights | `#7be36f` |
| `font` | Menu, HUD and banner text | `ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace` |

Every setting except `font` SHALL be a CSS colour. Each setting SHALL be exposed to the page as a CSS custom property
named `--tank-` followed by the setting name in kebab-case (for example `--tank-wall-edge`). The arena and the
menus SHALL both be drawn from these values.

#### Scenario: No theme looks as before
- **WHEN** the game loads with no theme file and no theme variables on the page
- **THEN** the arena and menus use the default colours and font in the table

#### Scenario: Banner text stays readable over the arena
- **WHEN** the round or wave banner appears over an obstacle, in any theme
- **THEN** its text is in the `ink` colour, never the `wall` colour, with a halo in the `backdrop` colour, and it has
  no opaque panel behind it

#### Scenario: Arena and menus follow the theme
- **WHEN** a theme sets `floor` to `#ffffff` and `accent` to `#ff00aa`
- **THEN** the arena floor is drawn white and the focused button's outline is pink

### Requirement: Theme file
The game SHALL look for a theme file named `theme.json` in the same folder as the game's built files. If the page has
a `<meta name="tank-command-theme" content="...">` tag, the game SHALL load the theme file from that URL instead,
resolved against the page's address. The file SHALL be a JSON object whose keys are setting names and whose values
are strings. A missing theme file SHALL silently mean "no theme".

#### Scenario: Theme next to the game
- **WHEN** a `theme.json` setting `wall` to `#334455` is placed beside the built game
- **THEN** obstacles are drawn in `#334455`

#### Scenario: Theme elsewhere
- **WHEN** the page has `<meta name="tank-command-theme" content="/site-themes/tank.json">` and that file sets `floor`
- **THEN** the game loads that file and uses its floor colour, and does not look for `theme.json` beside the game

#### Scenario: No theme file
- **WHEN** there is no theme file
- **THEN** the game starts with the defaults and logs no warning

### Requirement: Page CSS overrides the theme file
Theme settings SHALL apply in this order, each overriding the one before:
1. the built-in defaults;
2. the theme file;
3. `--tank-*` custom properties set on the page's root element by the host page's own CSS.

#### Scenario: The host stylesheet wins
- **WHEN** the theme file sets `floor` to `#111111` and the host page's stylesheet sets `--tank-floor: #222222` on
  `:root`
- **THEN** the floor is drawn `#222222`

#### Scenario: Mixing sources
- **WHEN** the theme file sets only `wall`, and the host page's CSS sets only `--tank-accent`
- **THEN** walls use the theme file's colour, the accent uses the page's, and every other setting keeps its default

### Requirement: A bad theme never stops the game
The game SHALL apply each valid setting from a theme file and skip each invalid one, logging a console warning that
names it. A colour setting is invalid if it isn't a colour the browser accepts. `font` is invalid if it isn't a
non-empty string. Unknown keys SHALL be skipped with a warning. A theme file that can't be read or isn't a JSON
object SHALL be ignored with a warning. In every case the game SHALL still start.

#### Scenario: One bad colour
- **WHEN** a theme file sets `floor` to `not-a-colour` and `wall` to `#334455`
- **THEN** a warning names `floor`, the floor keeps its default, and walls use `#334455`

#### Scenario: Unknown setting
- **WHEN** a theme file contains `tankColour`
- **THEN** a warning says `tankColour` is not a theme setting, and the rest of the file applies

#### Scenario: Broken file
- **WHEN** the theme file is not valid JSON, or is a JSON array
- **THEN** a warning is logged and the game starts with the defaults (and any page CSS variables)

### Requirement: Gameplay colours are not themeable
Tank colours, the "YOU" ring and label (including its font), shells, mortars, explosions, sparks, mud and the aiming
reticle SHALL keep their fixed colours whatever the theme says, so that what players must react to stays
recognisable.

#### Scenario: Tanks keep their colours
- **WHEN** any theme is applied
- **THEN** the human's tank is still drawn in the "you" green and each AI tank in its usual colour

### Requirement: Contrast warning
After the theme is applied, the game SHALL log a console warning, without stopping, if the floor colour is too close
to any tank colour, or to the shell colour, for it to be seen clearly. "Too close" is defined in the design. The
warning SHALL name the colours involved.

#### Scenario: Green floor
- **WHEN** a theme sets `floor` to the same green as the human's tank
- **THEN** a console warning says the floor is hard to tell apart from that tank colour, and the game plays normally

#### Scenario: Default theme is fine
- **WHEN** no theme is applied
- **THEN** no contrast warning is logged

### Requirement: No flash of the default look
The game SHALL wait for the theme file before drawing its first frame or showing its first screen, for up to a short
time limit set in the design. If the file hasn't arrived by then, it SHALL start with what it has and apply the theme
when the file arrives.

#### Scenario: Themed from the first frame
- **WHEN** the theme file loads within the time limit
- **THEN** the first frame and the setup screen already use the theme's colours

#### Scenario: Slow theme
- **WHEN** the theme file takes longer than the time limit to load
- **THEN** the game starts with the defaults, and switches to the theme once it arrives
