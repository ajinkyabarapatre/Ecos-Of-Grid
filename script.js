/* ============================================================
   Echoes of the Grid — Game Engine
   ------------------------------------------------------------
   A cyber-archaeology memory puzzle. The grid lights up a few
   tiles in order, then the player has to click them back in
   the same order. Each correct click scores points; each
   wrong click costs a life. Three lives per run.

   This file is written to be easy to read: each section is
   short, the data flow is linear, and every function does
   one thing.
   ============================================================ */


/* ---------- 1. CONSTANTS ----------
   These are the rules of the game. Change them here if you
   want to tune difficulty.
*/

const MAX_LIVES = 3;                       // how many mistakes per run
const POINTS_PER_TILE = 100;               // base points per correct click
const CLEAN_RUN_BONUS = 0.5;               // extra 50% if no mistakes
const SPEED_BONUS_PER_SECOND = 8;          // points per second left on timer

// Three stages: each level falls into exactly one stage.
// stage 1: easy (3x3 grid, 4 tiles)
// stage 2: medium (4x4 grid, 6 tiles)
// stage 3: hard (5x5 grid, 8 tiles)
const STAGES = [
  { minLevel: 1, maxLevel: 3,  gridSize: 3, sequenceLength: 4, tileOnMs: 600, gapMs: 200, recallMs: 12000 },
  { minLevel: 4, maxLevel: 7,  gridSize: 4, sequenceLength: 6, tileOnMs: 500, gapMs: 150, recallMs: 15000 },
  { minLevel: 8, maxLevel: 99, gridSize: 5, sequenceLength: 8, tileOnMs: 400, gapMs: 120, recallMs: 18000 },
];

// Roman numerals for the stage indicator (I, II, III).
function roman(n) {
  return ['I', 'II', 'III', 'IV'][n - 1] || String(n);
}

// Pick the stage object for a given level number.
function getStage(level) {
  return STAGES.find(s => level >= s.minLevel && level <= s.maxLevel) || STAGES[0];
}


/* ---------- 2. GAME STATE ----------
   These variables change as the game runs.
*/

let phase = 'idle';        // one of: idle, watch, recall, complete, gameover
let level = 1;
let score = 0;
let lives = MAX_LIVES;

let gridSize = 3;          // current grid width (= height)
let sequence = [];         // the correct sequence for this level (array of tile indexes)
let playerStep = 0;         // how many correct clicks the player has made
let mistake = false;       // did the player make any wrong click yet?
let recallStartTime = 0;   // timestamp (ms) when the recall phase began

let cursor = 0;            // keyboard cursor position (tile index)


/* ---------- 3. DOM HELPERS ----------
   Shortcuts for finding elements on the page.
*/

const $ = id => document.getElementById(id);

// Get one tile by its index number (0, 1, 2, …).
function tile(index) {
  return document.querySelector('.tile[data-index="' + index + '"]');
}


/* ---------- 4. HUD ----------
   Updates the score / level / lives / stage displays.
*/

function updateHud() {
  $('hud-level').textContent = level;
  $('hud-score').textContent = score;
  $('hud-stage').textContent = roman(STAGES.indexOf(getStage(level)) + 1);

  // Render three hearts, dim the ones we've lost.
  let html = '';
  for (let i = 0; i < MAX_LIVES; i++) {
    html += '<span class="heart' + (i < lives ? '' : ' lost') + '">♥</span>';
  }
  $('hud-lives').innerHTML = html;
}


/* ---------- 5. GRID ----------
   Creates the buttons that make up the playing field.
*/

function buildGrid(size) {
  const grid = $('grid');
  grid.innerHTML = '';                                             // wipe any old tiles
  grid.style.gridTemplateColumns = 'repeat(' + size + ', var(--cell-size))';

  // Create one button per tile and wire up its click handler.
  for (let i = 0; i < size * size; i++) {
    const button = document.createElement('button');
    button.className = 'tile';
    button.dataset.index = i;
    button.textContent = '';                                        // tiles are blank
    button.addEventListener('click', () => onTileClicked(i));
    grid.appendChild(button);
  }

  // Place the keyboard cursor in the middle of the grid.
  cursor = Math.floor((size * size) / 2);
  highlightCursor();
}

// Adds/removes the purple outline showing where the keyboard cursor is.
function highlightCursor() {
  document.querySelectorAll('.tile.cursor').forEach(t => t.classList.remove('cursor'));
  const t = tile(cursor);
  if (t) t.classList.add('cursor');
}

// Strip any "watch" / "correct" / "wrong" classes from every tile.
function clearTileStates() {
  document.querySelectorAll('.tile').forEach(t => {
    t.classList.remove('watch', 'correct', 'wrong');
  });
}


/* ---------- 6. SEQUENCE ----------
   Generate a random list of tile indexes. We avoid putting the
   same tile twice in a row so the sequence feels meaningful.
*/

function makeSequence() {
  const stage = getStage(level);
  const total = stage.gridSize * stage.gridSize;
  const list = [];
  let last = -1;

  while (list.length < stage.sequenceLength) {
    const next = Math.floor(Math.random() * total);
    if (next === last) continue;          // skip duplicates
    list.push(next);
    last = next;
  }
  return list;
}


/* ---------- 7. PHASES ----------
   The game has five phases. We use a single string `phase` to
   track which one we're in, and we update the on-screen message
   whenever it changes.
*/

function setPhase(name, message) {
  phase = name;
  $('phase-pill').textContent = name.toUpperCase();
  $('phase-pill').dataset.phase = name;
  $('phase-message').textContent = message;
}


/* ---------- 8. WATCH PHASE ----------
   Light up each tile in the sequence, one at a time. The
   player can only watch — clicks are ignored.
*/

function playWatchPhase() {
  setPhase('watch', 'Memorize the order of the glowing tiles…');
  $('btn-start').disabled = true;

  const stage = getStage(level);

  // Schedule each tile flash individually.
  sequence.forEach((tileIdx, i) => {
    const onAt = 500 + i * (stage.tileOnMs + stage.gapMs);
    setTimeout(() => flashTile(tileIdx), onAt);
  });

  // Total time before we move to the recall phase.
  const totalMs = 500 + sequence.length * (stage.tileOnMs + stage.gapMs) + 300;
  setTimeout(startRecallPhase, totalMs);

  // Fill the progress bar from 0% to 100% across the whole watch.
  animateBar(0, 100, totalMs, /* reverse */ false);
}

// Light one tile for `tileOnMs` then turn it off.
function flashTile(tileIdx) {
  const t = tile(tileIdx);
  if (!t) return;
  t.classList.add('watch');
  setTimeout(() => t.classList.remove('watch'), getStage(level).tileOnMs);
}


/* ---------- 9. RECALL PHASE ----------
   The player now clicks the tiles in the same order. A correct
   click flashes the tile green and adds points; a wrong click
   costs a life. There's a countdown bar to keep things tense.
*/

function startRecallPhase() {
  setPhase('recall', 'Click the tiles in the same order.');
  playerStep = 0;
  mistake = false;
  recallStartTime = performance.now();

  const stage = getStage(level);

  // Time limit: if the player takes too long, they lose a life.
  setTimeout(() => {
    if (phase === 'recall') onWrongClick('time ran out');
  }, stage.recallMs);

  // Drain the progress bar from 100% to 0% during the recall.
  animateBar(100, 0, stage.recallMs, /* reverse */ false, () => {
    if (phase === 'recall') { /* the timeout above will fire */ }
  });
}

// Smoothly animate the bar between two values across a duration.
function animateBar(fromPct, toPct, durationMs, _reverse, onDone) {
  const start = performance.now();
  function tick() {
    const elapsed = performance.now() - start;
    const t = Math.min(1, elapsed / durationMs);
    const pct = fromPct + (toPct - fromPct) * t;
    $('progress-fill').style.width = pct + '%';
    if (t < 1) requestAnimationFrame(tick);
    else if (onDone) onDone();
  }
  requestAnimationFrame(tick);
}

// Player clicked a tile (mouse or keyboard). Decide if it's right.
function onTileClicked(tileIdx) {
  if (phase !== 'recall') return;
  if (tileIdx === sequence[playerStep]) onCorrectClick(tileIdx);
  else onWrongClick('wrong tile');
}

// Right tile — flash green, add points, move on.
function onCorrectClick(tileIdx) {
  const t = tile(tileIdx);
  t.classList.add('correct');
  setTimeout(() => t.classList.remove('correct'), 300);

  score += POINTS_PER_TILE * level;
  updateHud();

  playerStep++;
  if (playerStep >= sequence.length) {
    finishLevel();
  } else {
    // Move the keyboard cursor to the next expected tile.
    cursor = sequence[playerStep];
    highlightCursor();
  }
}

// Wrong tile — lose a life and either restart the level or end the run.
function onWrongClick(reason) {
  if (phase !== 'recall') return;
  mistake = true;
  lives--;
  updateHud();
  setPhase('recall', 'Trap fired: ' + reason + '. Restarting level…');

  // Brief pause so the player sees the message, then restart.
  setTimeout(() => {
    if (lives <= 0) gameOver();
    else startLevel(level);
  }, 700);
}


/* ---------- 10. LEVEL COMPLETE ----------
   Award speed bonus + clean-run bonus, then unlock the
   "Next Level" button so the player can advance.
*/

function finishLevel() {
  setPhase('complete', 'Level complete!');
  const stage = getStage(level);

  // Speed bonus: more points for finishing quickly.
  const elapsedSec = (performance.now() - recallStartTime) / 1000;
  const timeLeftSec = Math.max(0, (stage.recallMs / 1000) - elapsedSec);
  score += Math.floor(timeLeftSec * SPEED_BONUS_PER_SECOND);

  // Clean-run bonus: extra 50% of the base points earned this level.
  if (!mistake) {
    const baseEarned = POINTS_PER_TILE * level * sequence.length;
    score += Math.floor(baseEarned * CLEAN_RUN_BONUS);
  }
  updateHud();

  // Unlock the Start button so they can advance.
  $('btn-start').disabled = false;
  $('btn-start').textContent = 'Next level (' + (level + 1) + ')  ▶';
}

function gameOver() {
  setPhase('gameover', 'Game over — final score: ' + score);
  $('btn-start').disabled = false;
  $('btn-start').textContent = 'Start over  ▶';
}


/* ---------- 11. LEVEL LIFECYCLE ----------
   Sets up a fresh level (or fresh run) and starts the watch phase.
*/

function startLevel(newLevel) {
  level = newLevel;
  const stage = getStage(level);

  gridSize = stage.gridSize;
  sequence = makeSequence();
  playerStep = 0;
  mistake = false;

  clearTileStates();
  buildGrid(gridSize);
  updateHud();

  $('btn-start').disabled = true;
  $('btn-start').textContent = 'Watching…';

  playWatchPhase();
}

function startNewRun() {
  score = 0;
  lives = MAX_LIVES;
  $('overlay-welcome').dataset.open = 'false';
  startLevel(1);
}


/* ---------- 12. KEYBOARD INPUT ----------
   Arrow keys / WASD move the cursor. Space / Enter activates
   the highlighted tile (same as a mouse click).
*/

document.addEventListener('keydown', e => {
  if (phase !== 'recall') return;
  const size = gridSize;
  const row  = Math.floor(cursor / size);
  const col  = cursor % size;

  if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W') {
    if (row > 0) cursor = cursor - size;
  } else if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') {
    if (row < size - 1) cursor = cursor + size;
  } else if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') {
    if (col > 0) cursor = cursor - 1;
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    if (col < size - 1) cursor = cursor + 1;
  } else if (e.key === ' ' || e.key === 'Enter') {
    onTileClicked(cursor);
    return;                       // don't preventDefault on space (avoid page scroll)
  } else {
    return;                       // other key — don't move cursor or prevent default
  }

  highlightCursor();
  e.preventDefault();
});


/* ---------- 13. BUTTONS ----------
   Hook up the on-screen buttons to their handlers.
*/

$('btn-start').addEventListener('click', () => {
  if (phase === 'complete') startLevel(level + 1);
  else if (phase === 'gameover') startNewRun();
  else if (phase === 'idle') startNewRun();
});

$('btn-help').addEventListener('click', () => {
  $('overlay-help').dataset.open = 'true';
});

$('btn-close-help').addEventListener('click', () => {
  $('overlay-help').dataset.open = 'false';
});

$('btn-begin').addEventListener('click', startNewRun);


/* ---------- 14. BOOT ----------
   When the page loads, show the welcome overlay and set up
   the initial HUD. The actual game starts when the user
   clicks BEGIN PROTOCOL.
*/

buildGrid(3);
updateHud();
setPhase('idle', 'Press BEGIN PROTOCOL to start.');
$('btn-start').disabled = true;
$('btn-start').textContent = '▶ START';