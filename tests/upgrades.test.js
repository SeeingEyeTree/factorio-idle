'use strict';
const { test } = require('node:test');
const assert   = require('node:assert');
const { loadGame } = require('./helpers/load-game');

// ── helpers ──────────────────────────────────────────────────────────────────

// Fresh game with all default buildings removed, infinite materials, and enough
// solar power that electric buildings always run at full speed.
function cleanGame(g) {
  const st = g.newGame({ biters: false });
  st.settings.autoSave = false;
  // Silence DOM rendering — completeResearch calls renderUI which requires real elements.
  g.run('renderUI = () => {}');
  Object.keys(st.buildings).forEach(k => delete st.buildings[k]);
  st.buildings['solarPanel'] = { type: 'solarPanel', count: 10000 }; // 600 MW
  Object.keys(st.inventory).forEach(k => { st.inventory[k] = 1e9; });
  // Pre-seed powerKw so tick 1 has powerRatio=1 for electric buildings.
  // Each tick resets powerKw then rebuilds from sources; solar (600 MW) keeps
  // the ratio at 1 from tick 2 onward regardless.
  st.powerKw = 1e9;
  return st;
}

function addBuilding(st, type, recipe) {
  const key = `${type}:${recipe}`;
  if (st.buildings[key]) st.buildings[key].count += 1;
  else st.buildings[key] = { type, recipe, count: 1 };
}

// ── resolveEffectiveBuildingType ──────────────────────────────────────────────
// Now always returns the type unchanged (tier is derived at runtime from research).

test('resolveEffectiveBuildingType: assembly always returns assembly', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  assert.strictEqual(g.run("resolveEffectiveBuildingType('assembly')"), 'assembly');
});

test('resolveEffectiveBuildingType: assembly still returns assembly after automation2', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  g.state.research.done.automation2 = true;
  assert.strictEqual(g.run("resolveEffectiveBuildingType('assembly')"), 'assembly');
});

test('resolveEffectiveBuildingType: assembly still returns assembly after automation3', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  g.state.research.done.automation2 = true;
  g.state.research.done.automation3 = true;
  assert.strictEqual(g.run("resolveEffectiveBuildingType('assembly')"), 'assembly');
});

test('resolveEffectiveBuildingType: furnace always returns furnace', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  assert.strictEqual(g.run("resolveEffectiveBuildingType('furnace')"), 'furnace');
});

test('resolveEffectiveBuildingType: furnace still returns furnace after advancedMaterialProcessing', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  g.state.research.done.advancedMaterialProcessing = true;
  assert.strictEqual(g.run("resolveEffectiveBuildingType('furnace')"), 'furnace');
});

test('resolveEffectiveBuildingType: furnace still returns furnace after electricFurnaceTech', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  g.state.research.done.advancedMaterialProcessing = true;
  g.state.research.done.electricFurnaceTech = true;
  assert.strictEqual(g.run("resolveEffectiveBuildingType('furnace')"), 'furnace');
});

// ── assemblyTier() ────────────────────────────────────────────────────────────

test('assemblyTier: returns Mk1 stats before any research', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const tier = g.run('assemblyTier()');
  assert.strictEqual(tier.speed, 0.5);
  assert.strictEqual(tier.kw, 75);
  assert.strictEqual(tier.slots, 0);
});

test('assemblyTier: returns Mk2 stats after automation2', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  g.state.research.done.automation2 = true;
  const tier = g.run('assemblyTier()');
  assert.strictEqual(tier.speed, 0.75);
  assert.strictEqual(tier.kw, 150);
  assert.strictEqual(tier.slots, 2);
});

test('assemblyTier: returns Mk3 stats after automation3', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  g.state.research.done.automation2 = true;
  g.state.research.done.automation3 = true;
  const tier = g.run('assemblyTier()');
  assert.strictEqual(tier.speed, 1.25);
  assert.strictEqual(tier.kw, 375);
  assert.strictEqual(tier.slots, 4);
});

// ── furnaceTier() ─────────────────────────────────────────────────────────────

test('furnaceTier: returns stone furnace stats before any research', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const tier = g.run('furnaceTier()');
  assert.strictEqual(tier.speed, 1.0);
  assert.strictEqual(tier.kw, 0);
  assert.strictEqual(tier.isElectric, false);
  assert.strictEqual(tier.coalRate, 0.0225);
});

test('furnaceTier: returns steel furnace stats after advancedMaterialProcessing', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  g.state.research.done.advancedMaterialProcessing = true;
  const tier = g.run('furnaceTier()');
  assert.strictEqual(tier.speed, 2.0);
  assert.strictEqual(tier.kw, 0);
  assert.strictEqual(tier.isElectric, false);
  assert.strictEqual(tier.coalRate, 0.03375);
});

test('furnaceTier: returns electric furnace stats after electricFurnaceTech', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  g.state.research.done.advancedMaterialProcessing = true;
  g.state.research.done.electricFurnaceTech = true;
  const tier = g.run('furnaceTier()');
  assert.strictEqual(tier.speed, 2.0);
  assert.strictEqual(tier.kw, 180);
  assert.strictEqual(tier.isElectric, true);
  assert.strictEqual(tier.coalRate, 0);
});

// ── BUILDING_DEFS constants ───────────────────────────────────────────────────

test('constants: assembly Mk1 speed 0.5 and kW 75', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const defs = g.run('BUILDING_DEFS');
  assert.strictEqual(defs.assembly.speed, 0.5);
  assert.strictEqual(defs.assembly.kw, 75);
});

test('constants: assembly Mk2 speed 0.75 and kW 150', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const defs = g.run('BUILDING_DEFS');
  assert.strictEqual(defs.assembly2.speed, 0.75);
  assert.strictEqual(defs.assembly2.kw, 150);
});

test('constants: assembly Mk3 speed 1.25 and kW 375', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const defs = g.run('BUILDING_DEFS');
  assert.strictEqual(defs.assembly3.speed, 1.25);
  assert.strictEqual(defs.assembly3.kw, 375);
});

test('constants: stone furnace speed 1.0 and no electric kW', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const defs = g.run('BUILDING_DEFS');
  assert.strictEqual(defs.furnace.speed, 1.0);
  assert.strictEqual(defs.furnace.kw, 0);
});

test('constants: steel furnace speed 2.0 and no electric kW', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const defs = g.run('BUILDING_DEFS');
  assert.strictEqual(defs.steelFurnace.speed, 2.0);
  assert.strictEqual(defs.steelFurnace.kw, 0);
});

test('constants: electric furnace speed 2.0 and kW 180', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const defs = g.run('BUILDING_DEFS');
  assert.strictEqual(defs.electricFurnace.speed, 2.0);
  assert.strictEqual(defs.electricFurnace.kw, 180);
});

// ── Assembly Mk1 production and power ────────────────────────────────────────
//
// ironGear recipe: 2 iron plates → 1 iron gear, time 0.5s
// Mk1 rate: ASSEMBLY_SPEED / recipe.time = 0.5 / 0.5 = 1 gear/sec
// In 10 s → exactly 10 gears.

test('assembly Mk1: power demand is 75 kW for 1 building', () => {
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'assembly', 'ironGear');
  g.advance(1);
  assert.strictEqual(st.powerDemandKw, 75);
});

test('assembly Mk1: produces 10 iron gears in 10 seconds', () => {
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'assembly', 'ironGear');
  st.inventory.ironGear = 0;
  g.advance(10);
  assert.strictEqual(st.inventory.ironGear, 10);
});

test('assembly Mk1: consumes 20 iron plates in 10 seconds (speed verification)', () => {
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'assembly', 'ironGear');
  const ironBefore = st.inventory.ironPlate;
  g.advance(10);
  // 10 cycles × 2 iron plates each
  assert.strictEqual(ironBefore - st.inventory.ironPlate, 20);
});

// ── Assembly Mk1 → Mk2: completeResearch upgrades tier at runtime ─────────────

test('assembly upgrade: completeResearch(automation2) does NOT mutate building type (stays assembly)', () => {
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'assembly', 'ironGear');
  assert.strictEqual(st.buildings['assembly:ironGear'].type, 'assembly');

  g.run("completeResearch('automation2')");

  // Type stays 'assembly' — tier is derived from research at runtime
  assert.strictEqual(st.buildings['assembly:ironGear'].type, 'assembly');
});

test('assembly upgrade: power demand rises to 150 kW for upgraded building', () => {
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'assembly', 'ironGear');
  g.run("completeResearch('automation2')");
  g.advance(1);
  assert.strictEqual(st.powerDemandKw, 150);
});

test('assembly upgrade: Mk2 produces 15 gears in 10 seconds after upgrade (speed 0.75)', () => {
  // Mk2 rate: 0.75 / 0.5 = 1.5 gears/sec → 15 gears in 10 s
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'assembly', 'ironGear');
  st.inventory.ironGear = 0;
  g.run("completeResearch('automation2')");
  g.advance(10);
  assert.strictEqual(st.inventory.ironGear, 15);
});

// ── Assembly Mk2 → Mk3: further research upgrades tier ───────────────────────

test('assembly upgrade Mk2→Mk3: power demand rises to 375 kW after automation3', () => {
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'assembly', 'ironGear');
  g.run("completeResearch('automation2')");
  g.run("completeResearch('automation3')");
  g.advance(1);
  assert.strictEqual(st.powerDemandKw, 375);
});

test('assembly upgrade Mk2→Mk3: Mk3 produces 25 gears in 10 seconds (speed 1.25)', () => {
  // Mk3 rate: 1.25 / 0.5 = 2.5 gears/sec → 25 gears in 10 s
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'assembly', 'ironGear');
  st.inventory.ironGear = 0;
  g.run("completeResearch('automation2')");
  g.run("completeResearch('automation3')");
  g.advance(10);
  assert.strictEqual(st.inventory.ironGear, 25);
});

// ── Assembly: no stack before tech, place after ───────────────────────────────

test('assembly: type is still assembly after automation2', () => {
  const g = loadGame();
  const st = cleanGame(g);
  g.run("completeResearch('automation2')");
  // Placing after upgrade still stores as type 'assembly'
  addBuilding(st, 'assembly', 'ironGear');
  assert.strictEqual(st.buildings['assembly:ironGear'].type, 'assembly');
});

test('assembly: building placed after automation2 runs at Mk2 speed', () => {
  const g = loadGame();
  const st = cleanGame(g);
  g.run("completeResearch('automation2')");
  addBuilding(st, 'assembly', 'ironGear');
  st.inventory.ironGear = 0;
  g.advance(10);
  assert.strictEqual(st.inventory.ironGear, 15);
});

// ── Assembly: multiple buildings all run at current tier speed ────────────────

test('assembly: 2 buildings after automation2 each produce at Mk2 speed — 30 gears in 10s', () => {
  // 2 buildings × 1.5 gears/sec = 3/sec × 10s = 30
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'assembly', 'ironGear');
  addBuilding(st, 'assembly', 'ironGear'); // adds to same group (count=2)
  g.run("completeResearch('automation2')");
  st.inventory.ironGear = 0;
  g.advance(10);
  assert.strictEqual(st.inventory.ironGear, 30);
});

// ── Display name changes with tier ───────────────────────────────────────────

test('display: each assembly tier has a distinct name', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const n1 = g.run("buildingDisplay('assembly').name");
  const n2 = g.run("buildingDisplay('assembly2').name");
  const n3 = g.run("buildingDisplay('assembly3').name");
  assert.notStrictEqual(n1, n2, 'Mk1 and Mk2 names should differ');
  assert.notStrictEqual(n2, n3, 'Mk2 and Mk3 names should differ');
  assert.notStrictEqual(n1, n3, 'Mk1 and Mk3 names should differ');
});

test('display: each furnace tier has a distinct name', () => {
  const g = loadGame();
  g.newGame({ biters: false });
  const n1 = g.run("buildingDisplay('furnace').name");
  const n2 = g.run("buildingDisplay('steelFurnace').name");
  const n3 = g.run("buildingDisplay('electricFurnace').name");
  assert.notStrictEqual(n1, n2, 'stone and steel furnace names should differ');
  assert.notStrictEqual(n2, n3, 'steel and electric furnace names should differ');
  assert.notStrictEqual(n1, n3, 'stone and electric furnace names should differ');
});

test('display: buildingDisplay("assembly") shows tier name based on research', () => {
  const g = loadGame();
  const st = cleanGame(g);
  const nameBefore = g.run("buildingDisplay('assembly').name");
  g.run("completeResearch('automation2')");
  const nameAfter = g.run("buildingDisplay('assembly').name");
  // Name changes because buildingDisplay reflects research-derived tier
  assert.notStrictEqual(nameBefore, nameAfter);
  assert.strictEqual(nameAfter, g.run("buildingDisplay('assembly2').name"));
});

test('display: buildingDisplay("furnace") shows tier name based on research', () => {
  const g = loadGame();
  const st = cleanGame(g);
  const nameBefore = g.run("buildingDisplay('furnace').name");
  g.run("completeResearch('advancedMaterialProcessing')");
  const nameAfter = g.run("buildingDisplay('furnace').name");
  assert.notStrictEqual(nameBefore, nameAfter);
  assert.strictEqual(nameAfter, g.run("buildingDisplay('steelFurnace').name"));
});

// ── Stone Furnace baseline ────────────────────────────────────────────────────
//
// ironPlate recipe: 1 iron ore → 1 iron plate, time 3.2 s
// Stone furnace rate: 1 / 3.2 = 0.3125 plates/sec
// In 32 s → exactly 10 plates.
// Coal consumption: COAL_PER_FURNACE = 0.0225 /sec → 0.72 in 32 s → 0 consumed (< 1)
// In 200 s: 0.0225 × 200 = 4.5 → 4 coal consumed.

test('stone furnace: produces 10 iron plates in 32 seconds', () => {
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'furnace', 'ironPlate');
  st.inventory.ironPlate = 0;
  g.advance(32);
  assert.strictEqual(st.inventory.ironPlate, 10);
});

test('stone furnace: consumes coal at 0.0225/sec — 4 coal in 200 seconds', () => {
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'furnace', 'ironPlate');
  const coalBefore = st.inventory.coal;
  g.advance(200);
  assert.strictEqual(coalBefore - st.inventory.coal, 4);
});

// ── Furnace → Steel Furnace: research upgrades tier at runtime ────────────────

test('furnace upgrade: completeResearch(advancedMaterialProcessing) does NOT mutate type (stays furnace)', () => {
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'furnace', 'ironPlate');
  g.run("completeResearch('advancedMaterialProcessing')");
  // Type stays 'furnace' — tier is derived from research at runtime
  assert.strictEqual(st.buildings['furnace:ironPlate'].type, 'furnace');
});

test('furnace upgrade: steel furnace produces 20 iron plates in 32 seconds (2× speed)', () => {
  // Steel furnace rate: STEEL_FURNACE_SPEED / recipe.time = 2.0 / 3.2 = 0.625 plates/sec
  // In 32 s → 20 plates
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'furnace', 'ironPlate');
  st.inventory.ironPlate = 0;
  g.run("completeResearch('advancedMaterialProcessing')");
  g.advance(32);
  assert.strictEqual(st.inventory.ironPlate, 20);
});

test('furnace upgrade: steel furnace consumes more coal than stone — 6 coal in 200 seconds', () => {
  // COAL_PER_STEEL_FURNACE = 0.03375 /sec → 0.03375 × 200 = 6.75 → 6 consumed
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'furnace', 'ironPlate');
  g.run("completeResearch('advancedMaterialProcessing')");
  const coalBefore = st.inventory.coal;
  g.advance(200);
  assert.strictEqual(coalBefore - st.inventory.coal, 6);
});

// ── Steel Furnace → Electric Furnace ─────────────────────────────────────────

test('furnace upgrade: electricFurnaceTech does NOT mutate type (stays furnace)', () => {
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'furnace', 'ironPlate');
  g.run("completeResearch('advancedMaterialProcessing')");
  g.run("completeResearch('electricFurnaceTech')");
  // Type stays 'furnace' — tier is derived from research at runtime
  assert.strictEqual(st.buildings['furnace:ironPlate'].type, 'furnace');
});

test('electric furnace: produces 20 iron plates in 32 seconds (same speed as steel)', () => {
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'furnace', 'ironPlate');
  st.inventory.ironPlate = 0;
  g.run("completeResearch('advancedMaterialProcessing')");
  g.run("completeResearch('electricFurnaceTech')");
  g.advance(32);
  assert.strictEqual(st.inventory.ironPlate, 20);
});

test('electric furnace: consumes no coal', () => {
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'furnace', 'ironPlate');
  g.run("completeResearch('advancedMaterialProcessing')");
  g.run("completeResearch('electricFurnaceTech')");
  const coalBefore = st.inventory.coal;
  g.advance(200);
  assert.strictEqual(coalBefore - st.inventory.coal, 0);
});

test('electric furnace: draws 180 kW of electricity', () => {
  const g = loadGame();
  const st = cleanGame(g);
  addBuilding(st, 'furnace', 'ironPlate');
  g.run("completeResearch('advancedMaterialProcessing')");
  g.run("completeResearch('electricFurnaceTech')");
  g.advance(1);
  assert.strictEqual(st.powerDemandKw, 180);
});
