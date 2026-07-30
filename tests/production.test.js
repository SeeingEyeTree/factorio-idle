'use strict';
// Production tracking + graph data tests.
// These exercise the rate-window computation, productionHistory samples,
// the all-time snapshot, and the recordProduced/recordConsumed helpers.
//
// Run with:  npm test   (or: node --test tests/)

const { test } = require('node:test');
const assert   = require('node:assert');
const { loadGame } = require('./helpers/load-game');

// Each rate window fires every RATE_WINDOW_SECS (5) seconds.
const WINDOW = 5;

// Start a game with no buildings and biters off so tests that manually set
// itemsProduced get clean, predictable deltas with no background noise.
// (biters must be off to avoid the "all buildings gone → death" check.)
function emptyGame(g) {
  const st = g.newGame({ biters: false, tutorialEnabled: false });
  for (const key of Object.keys(st.buildings)) delete st.buildings[key];
  return st;
}

// ── Rate computation ──────────────────────────────────────────────────────────

test('productionRates are computed correctly after one rate window', () => {
  const g = loadGame();
  const st = emptyGame(g);
  st.itemsProduced.ironOre = 100;   // pretend 100 iron ore was produced
  g.advance(WINDOW);
  // delta = 100 - 0 (snapshot starts empty), rate = 100 / 5s = 20/s
  assert.ok(Math.abs(st.productionRates.ironOre - 20) < 1e-10,
    `expected 20/s, got ${st.productionRates.ironOre}`);
});

test('consumptionRates are computed from itemsConsumed delta', () => {
  const g = loadGame();
  const st = g.newGame();
  st.itemsConsumed.coal = 50;
  g.advance(WINDOW);
  assert.ok(Math.abs(st.consumptionRates.coal - 10) < 1e-10,
    `expected 10/s, got ${st.consumptionRates.coal}`);
});

test('inventoryDelta is (production - consumption) / elapsed', () => {
  const g = loadGame();
  const st = emptyGame(g);
  st.itemsProduced.ironOre = 100;
  st.itemsConsumed.ironOre = 60;
  g.advance(WINDOW);
  // net = (100 - 60) / 5 = 8/s
  assert.ok(Math.abs(st.inventoryDelta.ironOre - 8) < 1e-10,
    `expected 8/s, got ${st.inventoryDelta.ironOre}`);
});

test('items with zero net rate are omitted from inventoryDelta', () => {
  const g = loadGame();
  const st = emptyGame(g);
  st.itemsProduced.ironOre = 100;
  st.itemsConsumed.ironOre = 100;   // perfectly balanced
  g.advance(WINDOW);
  assert.ok(!('ironOre' in st.inventoryDelta),
    'zero-net item should not appear in inventoryDelta');
});

test('consumption-only items appear in consumptionRates but not productionRates', () => {
  const g = loadGame();
  const st = emptyGame(g);
  st.itemsConsumed.coal = 40;       // consumed but never produced
  g.advance(WINDOW);
  assert.ok('coal' in st.consumptionRates, 'should have a consumptionRate for coal');
  assert.ok(!('coal' in st.productionRates), 'coal should NOT appear in productionRates');
});

test('second rate window uses the first-window snapshot as its baseline', () => {
  const g = loadGame();
  const st = g.newGame();
  st.itemsProduced.ironOre = 100;
  g.advance(WINDOW);                // window 1: snapshot saved at 100

  st.itemsProduced.ironOre = 160;   // 60 more produced in window 2
  g.advance(WINDOW);                // window 2: delta = 160-100 = 60, rate = 12/s
  assert.ok(Math.abs(st.productionRates.ironOre - 12) < 1e-10,
    `expected 12/s, got ${st.productionRates.ironOre}`);
});

test('items that appear in window 2 but not window 1 are computed correctly', () => {
  const g = loadGame();
  const st = g.newGame();
  g.advance(WINDOW);                // window 1: nothing produced
  st.itemsProduced.copperOre = 50;  // new production starts after window 1
  g.advance(WINDOW);                // window 2: delta = 50-0 = 50, rate = 10/s
  assert.ok(Math.abs(st.productionRates.copperOre - 10) < 1e-10,
    `expected 10/s, got ${st.productionRates.copperOre}`);
});

// ── History samples ───────────────────────────────────────────────────────────

test('one sample is pushed to all three history arrays per rate window', () => {
  const g = loadGame();
  const st = g.newGame();
  g.advance(WINDOW);
  assert.strictEqual(st.productionHistory.samples.length,     1, 'net samples');
  assert.strictEqual(st.productionHistory.prodSamples.length, 1, 'production samples');
  assert.strictEqual(st.productionHistory.consSamples.length, 1, 'consumption samples');
});

test('prodSample content matches the computed rate for that window', () => {
  const g = loadGame();
  const st = emptyGame(g);
  st.itemsProduced.ironOre = 100;
  g.advance(WINDOW);
  const latest = st.productionHistory.prodSamples[0];
  assert.ok(Math.abs(latest.ironOre - 20) < 1e-10,
    `expected 20/s in prodSample, got ${latest.ironOre}`);
});

test('consSample content matches the computed consumption rate', () => {
  const g = loadGame();
  const st = g.newGame();
  st.itemsConsumed.coal = 50;
  g.advance(WINDOW);
  const latest = st.productionHistory.consSamples[0];
  assert.ok(Math.abs(latest.coal - 10) < 1e-10,
    `expected 10/s in consSample, got ${latest.coal}`);
});

test('history arrays accumulate one entry per rate window', () => {
  const g = loadGame();
  const st = g.newGame();
  for (let i = 0; i < 5; i++) g.advance(WINDOW);
  assert.strictEqual(st.productionHistory.samples.length,     5);
  assert.strictEqual(st.productionHistory.prodSamples.length, 5);
  assert.strictEqual(st.productionHistory.consSamples.length, 5);
});

test('history arrays cap at 120 entries and discard the oldest', () => {
  const g = loadGame();
  const st = g.newGame();
  for (let i = 0; i < 125; i++) g.advance(WINDOW);   // 125 windows
  assert.strictEqual(st.productionHistory.samples.length,     120, 'net capped at 120');
  assert.strictEqual(st.productionHistory.prodSamples.length, 120, 'prod capped at 120');
  assert.strictEqual(st.productionHistory.consSamples.length, 120, 'cons capped at 120');
});

// ── All-time snapshots ────────────────────────────────────────────────────────

test('all-time snapshot fires once every 60 seconds', () => {
  const g = loadGame();
  const st = g.newGame();
  g.advance(60);   // 12 rate windows × 5s = 60s → triggers one snapshot
  assert.strictEqual(st.productionHistory.allTimeSamples.length, 1);
  g.advance(60);
  assert.strictEqual(st.productionHistory.allTimeSamples.length, 2);
});

test('all-time snapshot does not fire before the 60-second mark', () => {
  const g = loadGame();
  const st = g.newGame();
  g.advance(55);   // 11 rate windows, not yet 60s
  assert.strictEqual(st.productionHistory.allTimeSamples.length, 0);
});

test('all-time snapshot records cumulative itemsProduced at that moment', () => {
  const g = loadGame();
  const st = g.newGame();
  st.itemsProduced.ironOre = 999;
  g.advance(60);
  const snap = st.productionHistory.allTimeSamples[0];
  // The snapshot is taken after the rate window fires, so produced >= 999
  assert.ok(snap.produced.ironOre >= 999,
    `expected >=999 in snapshot, got ${snap.produced.ironOre}`);
});

test('all-time samples cap at 1440 entries', () => {
  const g = loadGame();
  const st = g.newGame();
  // Pre-fill to the cap
  const ph = st.productionHistory;
  for (let i = 0; i < 1440; i++) ph.allTimeSamples.push({ t: i, produced: {} });
  g.advance(60);   // triggers one more snapshot
  assert.strictEqual(ph.allTimeSamples.length, 1440,
    'should shift the oldest and stay at 1440');
});

// ── recordProduced / recordConsumed helpers ───────────────────────────────────

test('recordProduced adds to both itemsProduced and inventory', () => {
  const g = loadGame();
  const st = g.newGame();
  g.get('recordProduced')('ironOre', 50);
  assert.strictEqual(st.itemsProduced.ironOre, 50);
  assert.strictEqual(st.inventory.ironOre,     50);
});

test('recordConsumed adds to itemsConsumed and reduces inventory', () => {
  const g = loadGame();
  const st = g.newGame();
  st.inventory.coal = 100;
  g.get('recordConsumed')('coal', 30);
  assert.strictEqual(st.itemsConsumed.coal, 30);
  assert.strictEqual(st.inventory.coal,     70);
});

test('recordConsumed clamps inventory to zero, never goes negative', () => {
  const g = loadGame();
  const st = g.newGame();
  st.inventory.coal = 10;
  g.get('recordConsumed')('coal', 50);   // more than available
  assert.strictEqual(st.inventory.coal, 0);
});

test('recordProduced with zero or negative amount is a no-op', () => {
  const g = loadGame();
  const st = g.newGame();
  g.get('recordProduced')('ironOre', 0);
  g.get('recordProduced')('ironOre', -5);
  assert.ok(!('ironOre' in st.itemsProduced),
    'zero/negative production should not appear in itemsProduced');
});

test('recordConsumed with zero or negative amount is a no-op', () => {
  const g = loadGame();
  const st = g.newGame();
  st.inventory.coal = 50;
  g.get('recordConsumed')('coal', 0);
  g.get('recordConsumed')('coal', -5);
  assert.ok(!('coal' in st.itemsConsumed));
  assert.strictEqual(st.inventory.coal, 50);   // inventory unchanged
});
