'use strict';
// Enemy (biter) unit + simulation tests.
// Run with:  npm test   (or: node --test tests/)
//
// These load the REAL game code via tests/helpers/load-game.js, so they
// exercise the same functions the game runs — no reimplemented logic.

const { test }  = require('node:test');
const assert    = require('node:assert');
const fs        = require('fs');
const path      = require('path');
const { loadGame } = require('./helpers/load-game');

// ── Wave stats scaling ────────────────────────────────────────────────────

test('new game starts with baseline threat and a tiny first wave', () => {
  const g = loadGame();
  const st = g.newGame();
  assert.strictEqual(st.biterThreatPoints, 15 / 3000);
  const stats = g.get('getBiterWaveStats')();
  assert.strictEqual(stats.count, 2);   // round(0.005 * 300)
  assert.strictEqual(stats.hp,    15);  // round(0.005 * 3000)
  assert.strictEqual(stats.armor, 0);   // floor(0.005 * 12)
  assert.strictEqual(stats.dps,   2);   // 0.005 * 400
});

test('wave stats scale linearly with threat points', () => {
  const g = loadGame();
  const st = g.newGame();
  st.biterThreatPoints = 1.0; // linear cap
  const stats = g.get('getBiterWaveStats')();
  // (compare per-field: vm-realm objects fail deepStrictEqual's prototype check)
  assert.strictEqual(stats.count, 300);
  assert.strictEqual(stats.hp,    3000);
  assert.strictEqual(stats.armor, 12);
  assert.strictEqual(stats.dps,   400);
});

// ── Science tier detection ────────────────────────────────────────────────

test('getPlayerScienceTier follows highest science pack produced', () => {
  const g = loadGame();
  const st = g.newGame();
  const tier = g.get('getPlayerScienceTier');

  assert.strictEqual(tier(), 0);
  st.itemsProduced.redScience = 1;    assert.strictEqual(tier(), 1);
  st.itemsProduced.greenScience = 1;  assert.strictEqual(tier(), 2);
  st.itemsProduced.blueScience = 1;   assert.strictEqual(tier(), 3);
  st.itemsProduced.blackScience = 1;  assert.strictEqual(tier(), 3);
  st.itemsProduced.purpleScience = 1; assert.strictEqual(tier(), 4);
  st.itemsProduced.yellowScience = 1; assert.strictEqual(tier(), 5);
  st.itemsProduced.spaceScience = 1;  assert.strictEqual(tier(), 5);
});

test('rainbow science flips the enemy tier to the final tier', () => {
  const g = loadGame();
  const st = g.newGame();
  assert.strictEqual(g.get('hasRainbowScience')(), false);
  st.inventory.rainbowScience = 1;
  assert.strictEqual(g.get('hasRainbowScience')(), true);
  const tiers = g.get('BITER_TIERS');
  assert.strictEqual(g.get('getBiterEnemyTier')().name, tiers[tiers.length - 1].name);
});

// ── Threat point progression ──────────────────────────────────────────────

test('threat points advance per wave by science-tier rate, respecting difficulty mult', () => {
  const g = loadGame();
  const st = g.newGame({ biterDifficultyMult: 2 });
  st.itemsProduced.redScience = 1; // tier 1 → 0.002/wave, ×2 difficulty
  const before = st.biterThreatPoints;
  g.get('fightBiterWave')();
  assert.ok(Math.abs(st.biterThreatPoints - (before + 0.002 * 2)) < 1e-12);
});

test('linear threat is capped at 1.0 before rainbow', () => {
  const g = loadGame();
  const st = g.newGame();
  st.itemsProduced.yellowScience = 1;
  st.biterThreatPoints = 0.9999;
  g.get('fightBiterWave')();
  assert.strictEqual(st.biterThreatPoints, 1.0);
});

test('after rainbow, threat grows exponentially with an increasing base', () => {
  const g = loadGame();
  const st = g.newGame();
  st.inventory.rainbowScience = 1;
  st.biterThreatPoints = 1.0;
  const fight = g.get('fightBiterWave');

  fight(); // wave 1: ×1.05
  // finalize the in-flight wave so the next fight starts clean
  g.get('finalizeWave')(st.activeWave, true);
  assert.ok(Math.abs(st.biterThreatPoints - 1.05) < 1e-9);
  assert.strictEqual(st.biterWavesAfterRainbow, 1);

  fight(); // wave 2: ×(1.05 + 0.0002)
  g.get('finalizeWave')(st.activeWave, true);
  assert.ok(Math.abs(st.biterThreatPoints - 1.05 * 1.0502) < 1e-9);
  assert.strictEqual(st.biterWavesAfterRainbow, 2);
});

// ── Activation & scheduling (full tick() loop) ────────────────────────────

test('biters stay dormant until first red science is produced', () => {
  const g = loadGame();
  const st = g.newGame();
  g.advance(10);
  assert.strictEqual(st.biterActivated, false);

  st.itemsProduced.redScience = 1;
  g.advance(0.5);
  assert.strictEqual(st.biterActivated, true);
  // Timer set so the first wave lands 420s after activation (interval 120)
  assert.ok(st.biterTimer < -295 && st.biterTimer > -301, `timer was ${st.biterTimer}`);
});

test('first wave launches on schedule via the real game loop', () => {
  const g = loadGame();
  const st = g.newGame();
  st.itemsProduced.redScience = 1;
  g.advance(1);                       // activates, timer ≈ -300
  g.advance(421);                     // reach interval (120): wave starts
  assert.ok(st.activeWave, 'expected an active wave');
  assert.strictEqual(st.activeWave.waveNum, 1);
});

// ── Wave combat resolution ────────────────────────────────────────────────

test('walls take no damage during the grace period', () => {
  const g = loadGame();
  const st = g.newGame();
  st.perimeter.walls = 560;                 // no turrets → biters survive
  g.get('fightBiterWave')();
  const w = st.activeWave;
  const initialWallHP = w.wallHP;
  const tick = g.get('tickActiveWave');

  for (let i = 0; i < 15; i++) tick(0.1);   // 1.5s < 2s grace
  assert.strictEqual(w.wallHP, initialWallHP);
  assert.strictEqual(w.phase, 'grace');

  for (let i = 0; i < 10; i++) tick(0.1);   // past grace → combat
  assert.strictEqual(w.phase, 'combat');
  assert.ok(w.wallHP < initialWallHP, 'walls should now be taking damage');
});

test('defended wave is repelled; ammo consumed is capped by inventory', () => {
  const g = loadGame();
  const st = g.newGame();
  st.perimeter.walls = 560;
  st.perimeter.gunTurrets = 500;
  st.inventory.firearmMagazine = 2;         // fewer than the 5 mags "needed"
  g.get('fightBiterWave')();
  g.get('tickActiveWave')(0.1);             // 12.5k DPS kills the tiny wave instantly

  assert.strictEqual(st.activeWave, null, 'wave should be finalized');
  const last = st.lastBiterWave;
  assert.strictEqual(last.result, 'repelled');
  assert.strictEqual(last.buildingsLost, 0);
  assert.strictEqual(last.ammoUsed, 2);     // min(magsNeeded=5, inventory=2)
  assert.strictEqual(st.inventory.firearmMagazine, 0);
  assert.strictEqual(st.biterWaveNumber, 1);
});

test('undefended wave overflows and destroys buildings', () => {
  const g = loadGame();
  const st = g.newGame();
  st.biterThreatPoints = 0.5;               // 150 biters, 30k total DPS
  const buildingsBefore = Object.values(st.buildings).reduce((s, b) => s + b.count, 0);

  g.get('fightBiterWave')();
  const tick = g.get('tickActiveWave');
  // No defenses: wave rides until the 2×interval safety timeout force-finalizes it
  for (let i = 0; i < 2500 && st.activeWave; i++) tick(0.1);

  assert.strictEqual(st.activeWave, null, 'wave should have force-finalized');
  const last = st.lastBiterWave;
  assert.strictEqual(last.result, 'buildings_lost');
  assert.ok(last.buildingsLost >= 1);
  const buildingsAfter = Object.values(st.buildings).reduce((s, b) => s + b.count, 0);
  assert.ok(buildingsAfter < buildingsBefore, 'buildings should have been destroyed');
});

// ── Artillery ─────────────────────────────────────────────────────────────

test('artillery accumulates damage between waves and pre-kills the wave', () => {
  const g = loadGame();
  const st = g.newGame();
  st.biterActivated = true;
  st.perimeter.artillery = 1;
  st.inventory.artilleryShell = 10;

  g.advance(11);                            // 1 shell fired (1 per 10s per turret)
  assert.strictEqual(st.inventory.artilleryShell, 9);
  assert.strictEqual(st.artilleryAccumDamage, 3000);
  assert.strictEqual(st.waveKilledByArtillery, true, 'wave HP (30) < 3000 accumulated');

  st.biterTimer = 119.9;
  g.advance(1);                             // wave fires & finalizes instantly
  const last = st.lastBiterWave;
  assert.strictEqual(last.result, 'art_killed');
  assert.strictEqual(last.artShellsUsed, 1);
  assert.strictEqual(last.buildingsLost, 0);
  assert.strictEqual(st.biterWaveNumber, 1);
});

test('artillery stops firing once the pending wave is already dead (no shell waste)', () => {
  const g = loadGame();
  const st = g.newGame();
  st.biterActivated = true;
  st.perimeter.artillery = 1;
  st.inventory.artilleryShell = 10;
  g.advance(60);                            // would be 6 shells, but wave dies after 1
  assert.strictEqual(st.inventory.artilleryShell, 9);
});

// ── Wave preview simulation ───────────────────────────────────────────────

test('simulateNextWaveOutcome is pure (does not mutate game state)', () => {
  const g = loadGame();
  const st = g.newGame();
  st.biterThreatPoints = 0.5;
  st.perimeter.walls = 100;
  st.perimeter.gunTurrets = 10;
  st.inventory.firearmMagazine = 50;

  const before = JSON.stringify(st);
  const outcome = g.get('simulateNextWaveOutcome')();
  const after = JSON.stringify(st);

  assert.strictEqual(before, after, 'sim must not change state');
  assert.ok(outcome, 'sim returns a result when biters are enabled');
  assert.strictEqual(outcome.survived, false);
  assert.ok(outcome.buildingsAtRisk >= 1);
});

// ── Save migration & regressions ──────────────────────────────────────────

test('regression: post-rainbow saves keep high threat points on load', () => {
  const g = loadGame();
  const raw = g.newGame();
  raw.biterThreatPoints = 200;              // legit post-rainbow value
  raw.research = { done: { rainbowSciencePack: true } };
  g.context.__raw = raw;
  g.run('applyStateFromEnvelope(__raw)');
  assert.strictEqual(g.state.biterThreatPoints, 200, 'must NOT be divided by 500');
});

test('migration: pre-rainbow saves on the old 0–500 scale are rescaled', () => {
  const g = loadGame();
  const raw = g.newGame();
  raw.biterThreatPoints = 200;              // old-scale value, no rainbow
  raw.research = { done: {} };
  g.context.__raw = raw;
  g.run('applyStateFromEnvelope(__raw)');
  assert.strictEqual(g.state.biterThreatPoints, 200 / 500);
});

test('regression: no references to non-existent state.biterWaveCount', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  assert.ok(!src.includes('biterWaveCount'), 'use state.biterWaveNumber instead');
});

// ── Chemical Diffuser / Capsule mechanics ─────────────────────────────────
// Default perimeter: sideLength=14 → tiles=56 → diffThreshold=ceil(56/10)=6
//                                               capThreshold=ceil(56/5)=12

test('slowdown capsules extend grace period by 5s when diffuser+capsule thresholds met', () => {
  const g = loadGame();
  const st = g.newGame();
  st.perimeter.walls = 560;
  st.perimeter.chemicalDiffusers = 6;   // meets diffThreshold (ceil(56/10)=6)
  st.inventory.slowdownCapsule   = 12;  // meets capThreshold  (ceil(56/5)=12)

  g.get('fightBiterWave')();
  const w = st.activeWave;

  assert.strictEqual(w.graceBonus, 5, 'graceBonus should be 5');
  assert.strictEqual(w.slowdownActive, true);
  assert.strictEqual(st.inventory.slowdownCapsule, 0, 'capsules consumed at wave start');

  const tick = g.get('tickActiveWave');

  // 6.9s elapsed: still grace (total grace = 2+5 = 7s)
  for (let i = 0; i < 69; i++) tick(0.1);
  assert.strictEqual(w.phase, 'grace', 'should still be in grace at 6.9s');

  // 0.2s more (7.1s total) → transitions to combat
  tick(0.2);
  assert.strictEqual(w.phase, 'combat', 'should enter combat after 7s grace');
});

test('slowdown capsules are NOT active when diffuser threshold is not met', () => {
  const g = loadGame();
  const st = g.newGame();
  st.perimeter.walls = 560;
  st.perimeter.chemicalDiffusers = 0;   // below diffThreshold
  st.inventory.slowdownCapsule   = 12;  // plenty of capsules, but no coverage

  g.get('fightBiterWave')();
  const w = st.activeWave;

  assert.strictEqual(w.graceBonus, 0, 'no grace bonus without diffuser coverage');
  assert.strictEqual(w.slowdownActive, false);
  assert.strictEqual(st.inventory.slowdownCapsule, 12, 'capsules NOT consumed');

  const tick = g.get('tickActiveWave');

  // Tick past 2s → should be in combat (normal grace, not 7s)
  for (let i = 0; i < 21; i++) tick(0.1);
  assert.strictEqual(w.phase, 'combat', 'should enter combat after normal 2s grace');
});

test('poison capsules are consumed at wave start and deal 16 DPS', () => {
  const g = loadGame();
  const st = g.newGame();
  // Use enough walls to survive, no turrets so only poison reduces biterHP
  st.perimeter.walls             = 560;
  st.perimeter.chemicalDiffusers = 6;
  st.inventory.poisonCapsule     = 12;

  g.get('fightBiterWave')();
  const w = st.activeWave;

  assert.strictEqual(w.poisonActive, true);
  assert.strictEqual(st.inventory.poisonCapsule, 0, 'capsules consumed at wave start');

  const initialHP = w.biterHP;
  const tick = g.get('tickActiveWave');

  // Tick 1s — only poison DPS (no turrets) should reduce biterHP by ~16
  tick(1.0);
  const hpLost = initialHP - w.biterHP;
  assert.ok(Math.abs(hpLost - 16) < 0.01, `expected ~16 HP lost, got ${hpLost}`);
});

test('poison capsules are consumed again at the 20-second mark', () => {
  const g = loadGame();
  const st = g.newGame();
  st.biterThreatPoints           = 1.0;  // large wave so it survives 20s
  st.perimeter.walls             = 100000;
  st.perimeter.chemicalDiffusers = 6;
  st.inventory.poisonCapsule     = 24;   // enough for 2 intervals (12 each)

  g.get('fightBiterWave')();
  assert.strictEqual(st.inventory.poisonCapsule, 12, 'first batch consumed at wave start');

  const tick = g.get('tickActiveWave');
  // Advance past the 20s mark in one big step
  tick(21.0);

  assert.strictEqual(st.inventory.poisonCapsule, 0, 'second batch consumed at 20s interval');
});

test('poison stops when capsules run out at an interval check', () => {
  const g = loadGame();
  const st = g.newGame();
  st.biterThreatPoints           = 1.0;  // large wave so it survives 40s
  st.perimeter.walls             = 100000;
  st.perimeter.chemicalDiffusers = 6;
  st.inventory.poisonCapsule     = 12;   // only enough for the initial batch

  g.get('fightBiterWave')();
  const w = st.activeWave;
  assert.strictEqual(w.poisonActive, true);
  assert.strictEqual(st.inventory.poisonCapsule, 0);

  const tick = g.get('tickActiveWave');
  // Advance past the 20s check — no capsules left, so poisonActive should turn off
  tick(21.0);

  assert.strictEqual(w.poisonActive, false, 'poison deactivated when capsules ran out');
});
