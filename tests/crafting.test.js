'use strict';
// Tests for the auto-craft-to-place system: _craftPlan, computeAutoCraftsForPlace,
// and the end-to-end integration with placeBuilding + tick().
//
// Run with: npm test  (or: node --test tests/)
//
// Key recipes used in these tests:
//   ironGear:          { ironPlate:2 }        → { ironGear:1 }        time:0.5
//   copperCable:       { copperPlate:1 }       → { copperCable:2 }     time:0.5
//   electronicCircuit: { ironPlate:1, copperCable:3 } → { electronicCircuit:1 } time:0.5
//   stoneFurnaceItem:  { stone:5 }             → { stoneFurnaceItem:1 } time:0.5
//   assemblyMachine1Item: { ironPlate:9, ironGear:5, electronicCircuit:3 }
//                                              → { assemblyMachine1Item:1 } time:0.5

const { test } = require('node:test');
const assert   = require('node:assert');
const { loadGame } = require('./helpers/load-game');

// Clear default buildings so ticking doesn't produce/consume unexpected resources.
function emptyGame(g) {
  const st = g.newGame({ biters: false, tutorialEnabled: false });
  for (const key of Object.keys(st.buildings)) delete st.buildings[key];
  return st;
}

// Like emptyGame but also stubs out UI update functions that call DOM APIs.
// (document.getElementById returns null in the test harness, so any function
//  that does getElementById(...).textContent = ... will throw without this.)
function silentGame(g) {
  const st = emptyGame(g);
  g.run('updatePlacementUI = function() {}');
  g.run('processNextPlacement = function() {}');
  g.run('notify = function() {}');
  return st;
}

// ── _craftPlan unit tests ─────────────────────────────────────────────────────

test('_craftPlan: returns empty plan when inventory already has enough', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const craftPlan = g.get('_craftPlan');
  const result = craftPlan('ironGear', 3, { ironGear: 5 }, 0);
  assert.ok(result !== null);
  assert.strictEqual(result.plan.length, 0);
  assert.strictEqual(result.inv.ironGear, 2); // 5 - 3 = 2 leftover
});

test('_craftPlan: returns null for item with no recipe and not in inventory', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const craftPlan = g.get('_craftPlan');
  // ironPlate is smelted, not hand-craftable — no recipe exists
  const result = craftPlan('ironPlate', 5, {}, 0);
  assert.strictEqual(result, null);
});

test('_craftPlan: does not mutate the passed inventory object', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const craftPlan = g.get('_craftPlan');
  const inv = { ironPlate: 10 };
  craftPlan('ironGear', 2, inv, 0); // would consume 4 ironPlate internally
  assert.strictEqual(inv.ironPlate, 10, 'original inv must not be mutated');
});

test('_craftPlan: single-level recipe plans the right number of batches', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const craftPlan = g.get('_craftPlan');
  // ironGear: { ironPlate:2 } → { ironGear:1 }, need 3 gears
  const result = craftPlan('ironGear', 3, { ironPlate: 10 }, 0);
  assert.ok(result !== null);
  const step = result.plan.find(s => s.key === 'ironGear');
  assert.ok(step, 'plan must include an ironGear step');
  assert.strictEqual(step.count, 3);
  assert.strictEqual(result.inv.ironPlate, 4); // 10 - 6 = 4
});

test('_craftPlan: returns null when raw materials are insufficient', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const craftPlan = g.get('_craftPlan');
  // ironGear needs 2 ironPlate per gear; 1 is not enough for even 1
  const result = craftPlan('ironGear', 1, { ironPlate: 1 }, 0);
  assert.strictEqual(result, null);
});

test('_craftPlan: handles recipes that yield more than 1 per batch (copperCable → 2)', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const craftPlan = g.get('_craftPlan');
  // copperCable: { copperPlate:1 } → { copperCable:2 }
  // Need 5 copperCable → ceil(5/2) = 3 batches → 6 produced, 1 leftover
  const result = craftPlan('copperCable', 5, { copperPlate: 10 }, 0);
  assert.ok(result !== null);
  const step = result.plan.find(s => s.key === 'copperCable');
  assert.strictEqual(step.count, 3);
  assert.strictEqual(result.inv.copperCable ?? 0, 1, '1 copperCable leftover from ceil');
  assert.strictEqual(result.inv.copperPlate, 7);  // 10 - 3 batches = 7
});

test('_craftPlan: multi-level — prerequisite craft appears before dependent craft', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const craftPlan = g.get('_craftPlan');
  // electronicCircuit needs copperCable; copperCable must appear first in plan
  const result = craftPlan('electronicCircuit', 1, { ironPlate: 5, copperPlate: 5 }, 0);
  assert.ok(result !== null);
  const keys = result.plan.map(s => s.key);
  const cableIdx   = keys.indexOf('copperCable');
  const circuitIdx = keys.indexOf('electronicCircuit');
  assert.ok(cableIdx !== -1,   'copperCable step must be in the plan');
  assert.ok(circuitIdx !== -1, 'electronicCircuit step must be in the plan');
  assert.ok(cableIdx < circuitIdx, 'copperCable must come before electronicCircuit');
  // 2 copperCable batches (need 3, ceil(3/2)=2) → 4 produced, 3 consumed → 1 leftover
  assert.strictEqual(result.inv.copperCable ?? 0, 1);
});

// ── computeAutoCraftsForPlace unit tests ──────────────────────────────────────

test('computeAutoCraftsForPlace: returns null when nothing can be crafted', () => {
  const g = loadGame();
  const st = emptyGame(g);
  st.inventory = {};  // empty — no raw materials
  const fn = g.get('computeAutoCraftsForPlace');
  assert.strictEqual(fn({ assemblyMachine1Item: 1 }, 1), null);
});

test('computeAutoCraftsForPlace: single-level plan for stone furnace', () => {
  const g = loadGame();
  const st = emptyGame(g);
  st.inventory = { stone: 10 };
  const fn = g.get('computeAutoCraftsForPlace');
  // stoneFurnaceItem: { stone:5 } → { stoneFurnaceItem:1 }, time:0.5
  const result = fn({ stoneFurnaceItem: 1 }, 1);
  assert.ok(result !== null);
  assert.strictEqual(result.feasibleCount, 1);
  const step = result.crafts.find(s => s.key === 'stoneFurnaceItem');
  assert.ok(step, 'crafts should include stoneFurnaceItem');
  assert.ok(Math.abs(result.craftTime - 0.5) < 0.001,
    `expected 0.5s craftTime, got ${result.craftTime}`);
});

test('computeAutoCraftsForPlace: craftTime is sum of all steps', () => {
  const g = loadGame();
  const st = emptyGame(g);
  // assemblyMachine1Item plan: 5 ironGear (2.5s) + 5 copperCable (2.5s) +
  //   3 electronicCircuit (1.5s) + 1 assemblyMachine1Item (0.5s) = 7.0s
  st.inventory = { ironPlate: 30, copperPlate: 10 };
  const fn = g.get('computeAutoCraftsForPlace');
  const result = fn({ assemblyMachine1Item: 1 }, 1);
  assert.ok(result !== null);
  assert.ok(Math.abs(result.craftTime - 7.0) < 0.001,
    `expected 7.0s total craftTime, got ${result.craftTime}`);
});

test('computeAutoCraftsForPlace: partial feasibility — only enough for 1 of 2', () => {
  const g = loadGame();
  const st = emptyGame(g);
  st.inventory = { stone: 7 }; // enough for 1 furnace (needs 5), not 2
  const fn = g.get('computeAutoCraftsForPlace');
  const result = fn({ stoneFurnaceItem: 1 }, 2);
  assert.ok(result !== null);
  assert.strictEqual(result.feasibleCount, 1, 'only 1 furnace can be crafted');
});

// ── Integration tests: placeBuilding + tick ───────────────────────────────────
// These tests advance the real game tick loop. Placement completes asynchronously
// via RAF, so we check pendingPlacements.length === 0 (placement triggered and
// building item consumed) rather than state.buildings directly.

test('auto-craft: single-level chain triggers placement after craft completes', () => {
  const g = loadGame();
  const st = silentGame(g);
  st.inventory.stone = 10;
  // furnace is always unlocked (not behind any tech gate)
  g.get('placeBuilding')('furnace', null, null);
  assert.strictEqual(st.pendingPlacements.length, 1,
    'pending placement should be registered');
  // stoneFurnaceItem takes 0.5s; advance 4s to be safe
  g.advance(4);
  assert.strictEqual(st.pendingPlacements.length, 0,
    'pending placement should be resolved after craft completes');
  // Stone consumed: 5 for the craft
  assert.strictEqual(st.inventory.stone, 5);
  // No furnace item leftover (it was spent)
  assert.strictEqual(st.inventory.stoneFurnaceItem ?? 0, 0);
});

test('auto-craft: multi-level chain — intermediate items not given for free', () => {
  // BUG (before fix): recordConsumed at queue-time clamps intermediate inputs to 0
  // because they don't exist yet, so ironGear/copperCable/electronicCircuit are
  // produced but never consumed — the player gets them for free.
  // AFTER FIX: deferred crafts deduct inputs at start time, so all intermediates
  // are correctly consumed.
  const g = loadGame();
  const st = silentGame(g);
  // Provide exactly enough raw materials for 1 assembly machine:
  //   ironPlate: 9 (direct) + 10 (for 5 gears) + 3 (for 3 circuits) = 22
  //   copperPlate: 5 (for ceil(9/2)=5 copperCable batches)
  st.inventory.ironPlate  = 22;
  st.inventory.copperPlate = 5;
  st.research.done.automation = true; // assembly requires automation tech
  g.get('placeBuilding')('assembly', null, null);
  // Advance enough time for all crafts (7s of crafting + buffer)
  g.advance(20);
  assert.strictEqual(st.inventory.ironGear ?? 0, 0,
    'ironGear should be consumed, not left over');
  assert.strictEqual(st.inventory.electronicCircuit ?? 0, 0,
    'electronicCircuit should be consumed, not left over');
  // 1 copperCable leftover is correct: 5 batches×2=10 produced, 9 consumed = 1
  assert.ok((st.inventory.copperCable ?? 0) <= 1,
    `copperCable should be at most 1 (batch rounding), got ${st.inventory.copperCable}`);
});

test('auto-craft: multi-level chain — raw materials correctly consumed', () => {
  // With excess materials, verify the exact amounts consumed.
  const g = loadGame();
  const st = silentGame(g);
  st.inventory.ironPlate   = 100;
  st.inventory.copperPlate = 50;
  st.research.done.automation = true;
  g.get('placeBuilding')('assembly', null, null);
  g.advance(20);
  // ironPlate: 9 (direct) + 10 (gears) + 3 (circuits) = 22 consumed → 78 left
  assert.strictEqual(st.inventory.ironPlate ?? 0, 78,
    `expected 78 ironPlate remaining, got ${st.inventory.ironPlate}`);
  // copperPlate: 5 (for 5 copperCable batches) consumed → 45 left
  assert.strictEqual(st.inventory.copperPlate ?? 0, 45,
    `expected 45 copperPlate remaining, got ${st.inventory.copperPlate}`);
});

test('auto-craft: building item is spent from inventory after placement triggers', () => {
  const g = loadGame();
  const st = silentGame(g);
  st.inventory.ironPlate   = 30;
  st.inventory.copperPlate = 10;
  st.research.done.automation = true;
  g.get('placeBuilding')('assembly', null, null);
  g.advance(20);
  // assemblyMachine1Item produced by craft must be consumed by _tryProcessPendingPlacements
  assert.strictEqual(st.inventory.assemblyMachine1Item ?? 0, 0,
    'assemblyMachine1Item must be spent on placement, not left in inventory');
  assert.strictEqual(st.pendingPlacements.length, 0,
    'pending placements list must be empty after placement triggers');
});

// ── Reservation / double-queue tests ────────────────────────────────────────
// With enough materials for only N buildings, placing N+1 times should NOT
// queue N+1 crafts. The second call must see reserved materials and fail
// gracefully so no deferred craft gets permanently stuck.

test('reservation: second placeBuilding blocked when stone is fully reserved', () => {
  // 5 stone = exactly 1 stoneFurnaceItem. Placing twice should only queue 1 craft.
  const g = loadGame();
  const st = silentGame(g);
  st.inventory.stone = 5;
  g.get('placeBuilding')('furnace', null, null);
  g.get('placeBuilding')('furnace', null, null); // should be rejected
  g.advance(10);
  assert.strictEqual(st.craftQueue.length, 0,
    'no stuck deferred crafts — second placement must have been rejected');
  assert.strictEqual(st.pendingPlacements.length, 0,
    'no stuck pending placements');
  assert.strictEqual(st.inventory.stone ?? 0, 0,
    'stone fully consumed by the single craft that ran');
  assert.strictEqual(st.inventory.stoneFurnaceItem ?? 0, 0,
    'furnace item consumed by placement trigger');
});

test('reservation: two placements succeed when there is enough stone for both', () => {
  // 10 stone = 2 stoneFurnaceItems. Both placements should complete cleanly.
  const g = loadGame();
  const st = silentGame(g);
  st.inventory.stone = 10;
  g.get('placeBuilding')('furnace', null, null);
  g.get('placeBuilding')('furnace', null, null);
  g.advance(10);
  assert.strictEqual(st.craftQueue.length, 0, 'both crafts must complete');
  assert.strictEqual(st.pendingPlacements.length, 0, 'both placements must trigger');
  assert.strictEqual(st.inventory.stone ?? 0, 0, 'all stone consumed');
  assert.strictEqual(st.inventory.stoneFurnaceItem ?? 0, 0, 'both items consumed');
});

test('reservation: excess stone left over after second placement is blocked', () => {
  // 7 stone: first furnace reserves 5, leaving 2 available — not enough for a second.
  const g = loadGame();
  const st = silentGame(g);
  st.inventory.stone = 7;
  g.get('placeBuilding')('furnace', null, null);
  g.get('placeBuilding')('furnace', null, null); // needs 5, only 2 available → rejected
  g.advance(10);
  assert.strictEqual(st.craftQueue.length, 0, 'no stuck crafts');
  assert.strictEqual(st.pendingPlacements.length, 0, 'no stuck placements');
  assert.strictEqual(st.inventory.stone ?? 0, 2, '2 stone left over (7 − 5)');
});

test('reservation: multi-level chain — second assembly blocked when materials are reserved', () => {
  // Exactly enough raw materials for 1 assembly machine. Placing twice should queue only 1.
  const g = loadGame();
  const st = silentGame(g);
  st.inventory.ironPlate   = 22;
  st.inventory.copperPlate = 5;
  st.research.done.automation = true;
  g.get('placeBuilding')('assembly', null, null);
  g.get('placeBuilding')('assembly', null, null); // should be rejected
  g.advance(20);
  assert.strictEqual(st.craftQueue.length, 0, 'no stuck deferred crafts');
  assert.strictEqual(st.pendingPlacements.length, 0, 'no stuck pending placements');
  assert.strictEqual(st.inventory.ironPlate ?? 0, 0, 'all ironPlate consumed');
});

// ── Pause interaction tests ──────────────────────────────────────────────────

test('pause: allPaused does not block hand crafting', () => {
  // allPaused should freeze building output, not the hand-craft queue.
  const g = loadGame();
  const st = silentGame(g);
  st.inventory.ironPlate = 10;
  st.allPaused = true;
  // queueCraft pre-deducts inputs and pushes a non-deferred entry
  g.get('queueCraft')('ironGear', false);
  g.advance(2); // ironGear takes 0.5s
  assert.ok((st.inventory.ironGear ?? 0) >= 1,
    'hand craft must complete even when building production is paused');
});

test('pause: allPaused deferred auto-craft still completes', () => {
  // Even when allPaused is on, the deferred crafts that feed a pending placement
  // must still run so the placement can eventually resolve.
  const g = loadGame();
  const st = silentGame(g);
  st.inventory.stone = 5;
  st.allPaused = true;
  g.get('placeBuilding')('furnace', null, null);
  g.advance(4);
  assert.strictEqual(st.craftQueue.length, 0, 'deferred craft must finish during allPaused');
  assert.strictEqual(st.pendingPlacements.length, 0,
    'placement must trigger after craft completes during allPaused');
});
