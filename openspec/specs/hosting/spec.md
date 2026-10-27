# hosting Specification

## Purpose

What it takes to put the built game on a web page: any folder, file names that don't change between releases, and a
host page that needs only a few lines, so a site template can stay the same from release to release.

## Requirements

### Requirement: Works from any folder
The built game SHALL refer to its own files only by relative URLs, so that the build folder works wherever it is
served from, including a sub-folder of another site.

#### Scenario: Served from a sub-folder
- **WHEN** the built game is served from `/games/tank-command/` on a site
- **THEN** the game loads its script, stylesheet and theme file from that folder and plays normally

#### Scenario: No absolute paths in the build
- **WHEN** the game is built
- **THEN** the built page refers to no file with a path starting with `/`

### Requirement: Stable entry file names
The build SHALL name its entry script `assets/tank-command.js` and its stylesheet `assets/tank-command.css`, whatever
the code contains. That way a host page written for one release still works with the next.

#### Scenario: Same names after a code change
- **WHEN** the game is built, its code is changed, and it is built again
- **THEN** both builds have `assets/tank-command.js` and `assets/tank-command.css`

### Requirement: Minimal host page
The game SHALL create all of its screens and overlays (the arena canvas, HUD, banner, setup, pause and result screens)
itself, inside a mount element with the id `tank-command`. A page that contains only the stylesheet, that mount
element, the entry script and, optionally, the theme `<meta>` tag SHALL run the complete game. The game SHALL
continue to own the whole window while it runs, as before. The built `index.html` SHALL be such a minimal page.

#### Scenario: A host template
- **WHEN** a page contains only `<link rel="stylesheet" href=".../assets/tank-command.css">`,
  `<div id="tank-command"></div>` and `<script type="module" src=".../assets/tank-command.js"></script>`
- **THEN** the setup screen appears and a full game can be played

#### Scenario: Missing mount element
- **WHEN** the script runs on a page without a `tank-command` element
- **THEN** the game creates one at the end of the page body and starts, logging a warning that the page should
  provide it
