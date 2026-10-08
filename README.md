# Echoes of the Grid

Echoes of the Grid is a browser-based memory puzzle with a cyber-archaeology theme. The player watches a sequence of glowing tiles, remembers the route, and then retraces it before the timer expires.

## How the Game Works

1. Start the protocol from the welcome screen.
2. During the **WATCH** phase, the grid lights tiles one at a time.
3. During the **RECALL** phase, select the same tiles in the same order.
4. Correct selections earn points and turn amber.
5. An incorrect selection or an expired timer costs one life.
6. Complete the sequence to advance to the next level.
7. Lose all three lives and the run resets.

The game generates a new sequence for every level. Consecutive duplicate tiles are avoided so each route remains readable and challenging.

## Controls

- Click tiles with the mouse or touch screen.
- Use **WASD** or the **Arrow keys** to move the keyboard cursor.
- Press **Enter** or **Space** to select the highlighted tile.
- Use **How to Play** in the game to review the rules.

## Difficulty Progression

- Levels 1-3: 3x3 grid, 4-step sequences
- Levels 4-7: 4x4 grid, 6-step sequences
- Level 8 onward: 5x5 grid, 8-step sequences with faster timing

Each level has a recall timer. Higher levels increase the grid size, sequence length, and pace.

## Scoring

Each correct tile is worth `Level x 100` points. A mistake-free run receives a 1.5x clean-run bonus, and finishing recall with time remaining can add a speed bonus.

## What It Is Based On

The core idea is based on classic sequence-memory games such as **Simon**, where players repeat a pattern after observing it. Echoes of the Grid adapts that familiar mechanic into a tile-grid puzzle with ordered navigation, limited lives, countdown pressure, and level-based progression.

Its visual direction is inspired by cyberpunk interfaces, retro-futurist computer terminals, and the idea of exploring the preserved memory of an abandoned digital civilization. The theme and presentation are original to this project; the game does not depend on any external story or franchise.

## Technology

This is a lightweight static web game built with:

- HTML for the interface and overlays
- CSS for the responsive neon HUD, grid, states, and animations
- Vanilla JavaScript for game state, sequence generation, keyboard input, scoring, timers, and progression

No build step or dependencies are required. Open `index.html` in a modern browser to play.
# Ecos-Of-Grid
