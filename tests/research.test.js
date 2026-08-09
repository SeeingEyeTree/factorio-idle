'use strict';
// Research progress persistence tests.
// Verifies that switching between techs preserves partial progress for all
// interrupted techs, not just the most recently cancelled one.
//
// Run with:  npm test   (or: node --test tests/)

const { test } = require('node:test');
const assert   = require('node:assert');
const { loadGame } = require('./helpers/load-game');

function researchGame(g) {
  const st = g.newGame({ biters: false });
  // Silence all rendering / notification side-effects.
  g.run('renderUI = () => {}');
  g.run('renderResearch = () => {}');
  g.run('notify = () => {}');
  g.run('flashResearchTab = () => {}');
  g.run('updatePlaceButtonStates = () => {}');
  g.run('renderAllPlacementPickers = () => {}');
  // A lab is required by startInfiniteTech's guard.
  st.buildings['lab'] = { type: 'lab', count: 1 };
  g.run('_groupsDirty = true');
  // Infinite science packs so inventory is never the bottleneck.
  Object.keys(st.inventory).forEach(k => { st.inventory[k] = 1e9; });
  return st;
}

// Shortcuts for the functions under test.
function startReg(g, key)  { g.get('startResearch')(key); }
function startInf(g, type) { g.get('startInfiniteTech')(type); }
function cancel(g)         { g.get('cancelResearch')(); }
function completeReg(g, key)  { g.get('completeResearch')(key); }
function completeInf(g, type) { g.get('completeRobotResearch')(type); }

// ── inf → regular ─────────────────────────────────────────────────────────────

// Start with an infinite tech at 10 %, switch to a regular tech and reach 20 %,
// then switch back — the infinite tech must still be at 10 %.
test('research: inf→regular: switching back restores inf progress', () => {
  const g = loadGame();
  const st = researchGame(g);

  // artillery:range has no prereqs and totalNeeded=1000 at level 1.
  startInf(g, 'artillery:range');
  assert.strictEqual(st.research.current, 'artillery:range');
  st.research.totalConsumed = 100; // 10 % of 1000

  // Switch to automation (regular, no prereqs, totalNeeded=10).
  cancel(g);
  startReg(g, 'automation');
  assert.strictEqual(st.research.current, 'automation');
  st.research.totalConsumed = 2; // 20 % of 10

  // Switch back.
  cancel(g);
  startInf(g, 'artillery:range');
  assert.strictEqual(st.research.current, 'artillery:range');
  assert.strictEqual(
    st.research.totalConsumed, 100,
    'inf tech progress must be restored to 100 packs after switching back from a regular tech',
  );
});

// Continuing the scenario above: complete the inf tech, then start the regular
// tech — its 20 % progress must still be there.
test('research: inf→regular: completing inf preserves regular progress', () => {
  const g = loadGame();
  const st = researchGame(g);

  startInf(g, 'artillery:range');
  st.research.totalConsumed = 100;
  cancel(g);

  startReg(g, 'automation');
  st.research.totalConsumed = 2;
  cancel(g);

  // Restore artillery:range and complete it.
  startInf(g, 'artillery:range');
  completeInf(g, 'artillery:range');
  assert.strictEqual(st.research.artilleryRangeLevel, 1, 'level should increment on completion');
  assert.strictEqual(st.research.current, null, 'nothing should be current after completion');

  // Now start automation — 20 % progress must survive.
  startReg(g, 'automation');
  assert.strictEqual(st.research.current, 'automation');
  assert.strictEqual(
    st.research.totalConsumed, 2,
    'regular tech progress must be restored to 2 packs after the inf tech completes',
  );
});

// ── regular → inf ─────────────────────────────────────────────────────────────

// Start with a regular tech at 10 %, switch to an inf tech and reach 20 %,
// then switch back — the regular tech must still be at 10 %.
test('research: regular→inf: switching back restores regular progress', () => {
  const g = loadGame();
  const st = researchGame(g);

  // automation: no prereqs, totalNeeded=10.
  startReg(g, 'automation');
  assert.strictEqual(st.research.current, 'automation');
  st.research.totalConsumed = 1; // 10 % of 10

  // Switch to artillery:range (inf, no prereqs, totalNeeded=1000).
  cancel(g);
  startInf(g, 'artillery:range');
  assert.strictEqual(st.research.current, 'artillery:range');
  st.research.totalConsumed = 200; // 20 % of 1000

  // Switch back.
  cancel(g);
  startReg(g, 'automation');
  assert.strictEqual(st.research.current, 'automation');
  assert.strictEqual(
    st.research.totalConsumed, 1,
    'regular tech progress must be restored to 1 pack after switching back from an inf tech',
  );
});

// Continuing the scenario above: complete the regular tech, then start the inf
// tech — its 20 % progress must still be there.
test('research: regular→inf: completing regular preserves inf progress', () => {
  const g = loadGame();
  const st = researchGame(g);

  startReg(g, 'automation');
  st.research.totalConsumed = 1;
  cancel(g);

  startInf(g, 'artillery:range');
  st.research.totalConsumed = 200;
  cancel(g);

  // Restore automation and complete it.
  startReg(g, 'automation');
  completeReg(g, 'automation');
  assert.ok(st.research.done['automation'], 'automation should be marked done');
  assert.strictEqual(st.research.current, null, 'nothing should be current after completion');

  // Now start artillery:range — 20 % progress must survive.
  startInf(g, 'artillery:range');
  assert.strictEqual(st.research.current, 'artillery:range');
  assert.strictEqual(
    st.research.totalConsumed, 200,
    'inf tech progress must be restored to 200 packs after the regular tech completes',
  );
});
