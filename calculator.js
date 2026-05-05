'use strict';

// ── Recipe Calculator ─────────────────────────────────────────
// Generates fscript files from a target item + rate.
// Reads PLAYER_RECIPES, FURNACE_RECIPES, ELECTRIC_MINER_SPEED, PUMPJACK_SPEED,
// ASSEMBLY_SPEED, ASSEMBLY2_SPEED, ASSEMBLY3_SPEED, CHEMICAL_PLANT_SPEED,
// OIL_REFINERY_SPEED, CENTRIFUGE_SPEED, ROCKET_SILO_SPEED from game.js globals.
// Reads state.research.miningProductivity for current mining bonus.

const CALC_RAW_ORES = new Set(['ironOre', 'copperOre', 'coal', 'stone', 'uraniumOre']);
const CALC_RESOURCE_SCRIPT_NAME = {
  ironOre: 'iron', copperOre: 'copper', coal: 'coal',
  stone: 'stone', uraniumOre: 'uranium', crudeOil: 'oil',
};

const CALC_MACHINERY_INFO = {
  assembly:     { speed: () => ASSEMBLY_SPEED,       placeArg: 'assembly',   invConst: 'ASSEMBLY_ITEM',      enoughVar: 'enough_am1'       },
  assembly2:    { speed: () => ASSEMBLY2_SPEED,      placeArg: 'am2',        invConst: 'ASSEMBLY2_ITEM',     enoughVar: 'enough_am2'       },
  assembly3:    { speed: () => ASSEMBLY3_SPEED,      placeArg: 'am3',        invConst: 'ASSEMBLY3_ITEM',     enoughVar: 'enough_am3'       },
  chemical:     { speed: () => CHEMICAL_PLANT_SPEED, placeArg: 'chem',       invConst: 'CHEM_PLANT_ITEM',    enoughVar: 'enough_chem'      },
  refinery:     { speed: () => OIL_REFINERY_SPEED,   placeArg: 'refinery',   invConst: 'OIL_REFINERY_ITEM',  enoughVar: 'enough_refinery'  },
  centrifuge:   { speed: () => CENTRIFUGE_SPEED,     placeArg: 'centrifuge', invConst: 'CENTRIFUGE_ITEM',    enoughVar: 'enough_centrifuge'},
  rocket_silo:  { speed: () => ROCKET_SILO_SPEED,    placeArg: 'silo',       invConst: 'ROCKET_SILO_ITEM',   enoughVar: 'enough_silo'      },
  furnace:      { speed: () => 1.0,                  placeArg: 'furnace',         invConst: 'STONE_FURNACE',      enoughVar: 'enough_furnace'        },
  steelFurnace: { speed: () => STEEL_FURNACE_SPEED,  placeArg: 'steel_furnace',   invConst: 'STEEL_FURNACE_INV',  enoughVar: 'enough_steel_furnace'  },
  electricFurnace:{ speed: () => ELECTRIC_FURNACE_SPEED, placeArg: 'electric_furnace', invConst: 'ELEC_FURNACE', enoughVar: 'enough_elec_furnace'   },
  electricMiner:{ speed: () => {
    const prod = (typeof state !== 'undefined' && state?.research?.miningProductivity) ?? 0;
    return ELECTRIC_MINER_SPEED * (1 + prod * 0.1);
  },             placeArg: 'e_drill',    invConst: 'ELECTRIC_MINER',     enoughVar: 'enough_drill'     },
  pumpjack:     { speed: () => PUMPJACK_SPEED,       placeArg: 'pumpjack',   invConst: 'PUMPJACK_ITEM',      enoughVar: 'enough_pumpjack'  },
};

// Order in which building types appear in the generated script
const CALC_BUILDING_ORDER = [
  'assembly', 'assembly2', 'assembly3', 'chemical', 'refinery', 'centrifuge', 'rocket_silo',
  'furnace', 'steelFurnace', 'electricFurnace', 'electricMiner', 'pumpjack',
];

function calcFindRecipe(itemKey) {
  if (PLAYER_RECIPES[itemKey]) return { recipe: PLAYER_RECIPES[itemKey], isFurnace: false };
  if (FURNACE_RECIPES[itemKey]) return { recipe: FURNACE_RECIPES[itemKey], isFurnace: true };
  return null;
}

function calcMachineryKey(recipe, isFurnace, assemblyTier, furnaceTier) {
  if (isFurnace) return furnaceTier;
  const m = recipe.machinery;
  if (!m || m === 'assembly') return assemblyTier;
  return m;
}

// Accumulate total production rates (units/sec) for every item in the tree.
function calcAccumulateRates(targetItem, targetRatePerSec) {
  const itemRates = {};

  function accumulate(itemKey, ratePerSec, stack) {
    itemRates[itemKey] = (itemRates[itemKey] ?? 0) + ratePerSec;
    if (stack.has(itemKey)) return;
    if (itemKey === 'water') return;
    const found = calcFindRecipe(itemKey);
    if (!found) return;
    const { recipe } = found;
    const outputQty = recipe.outputs[itemKey] ?? 1;
    const execs = ratePerSec / outputQty;
    const next = new Set(stack);
    next.add(itemKey);
    for (const [inp, qty] of Object.entries(recipe.inputs))
      accumulate(inp, execs * qty, next);
  }

  accumulate(targetItem, targetRatePerSec, new Set());
  return itemRates;
}

// Convert item rates map → list of { machineryKey, itemKey, recipeScriptName, count }
function calcBuildingCounts(itemRates, assemblyTier, furnaceTier) {
  const placements = [];

  for (const [itemKey, ratePerSec] of Object.entries(itemRates)) {
    if (itemKey === 'water') continue;

    if (CALC_RAW_ORES.has(itemKey)) {
      const speed = CALC_MACHINERY_INFO.electricMiner.speed();
      const count = Math.ceil(ratePerSec / speed);
      if (count > 0)
        placements.push({ machineryKey: 'electricMiner', itemKey, recipeScriptName: CALC_RESOURCE_SCRIPT_NAME[itemKey], count });
      continue;
    }

    if (itemKey === 'crudeOil') {
      const speed = CALC_MACHINERY_INFO.pumpjack.speed();
      const count = Math.ceil(ratePerSec / speed);
      if (count > 0)
        placements.push({ machineryKey: 'pumpjack', itemKey, recipeScriptName: CALC_RESOURCE_SCRIPT_NAME[itemKey], count });
      continue;
    }

    const found = calcFindRecipe(itemKey);
    if (!found) continue;
    const { recipe, isFurnace } = found;
    const machKey = calcMachineryKey(recipe, isFurnace, assemblyTier, furnaceTier);
    const info = CALC_MACHINERY_INFO[machKey];
    if (!info) continue;
    const outputQty = recipe.outputs[itemKey] ?? 1;
    const execs = ratePerSec / outputQty;
    const count = Math.ceil(execs * recipe.time / info.speed());
    if (count > 0)
      placements.push({ machineryKey: machKey, itemKey, recipeScriptName: camelToSnake(itemKey), count });
  }

  // Sort by building order, then by count descending within each group
  placements.sort((a, b) => {
    const oa = CALC_BUILDING_ORDER.indexOf(a.machineryKey);
    const ob = CALC_BUILDING_ORDER.indexOf(b.machineryKey);
    if (oa !== ob) return oa - ob;
    return b.count - a.count;
  });

  return placements;
}

function calcGenerateScript(targetItem, targetRatePerMin, assemblyTier = 'assembly', furnaceTier = 'furnace') {
  const ratePerSec = targetRatePerMin / 60;
  const itemRates = calcAccumulateRates(targetItem, ratePerSec);
  const placements = calcBuildingCounts(itemRates, assemblyTier, furnaceTier);

  if (placements.length === 0) return '# No machines needed (raw resource or unknown item)';

  // Group counts by machinery type for enough_ checks
  const byMachinery = {};
  for (const p of placements) {
    if (!byMachinery[p.machineryKey]) byMachinery[p.machineryKey] = [];
    byMachinery[p.machineryKey].push(p.count);
  }

  const targetName = camelToSnake(targetItem);
  const rateDisplay = targetRatePerMin % 1 === 0 ? targetRatePerMin : targetRatePerMin.toFixed(2);
  const lines = [`# ${targetName} ${rateDisplay} per min`, 'scale = 1'];

  const enoughVars = [];
  for (const machKey of CALC_BUILDING_ORDER) {
    if (!byMachinery[machKey]) continue;
    const info = CALC_MACHINERY_INFO[machKey];
    const counts = byMachinery[machKey];
    const countExpr = counts.length === 1 ? `${counts[0]}` : `(${counts.join(' + ')})`;
    lines.push(`${info.enoughVar} = ${info.invConst} > ${countExpr} * scale`);
    enoughVars.push(info.enoughVar);
  }

  lines.push(`enough_total = ${enoughVars.join(' and ')}`);
  lines.push('if enough_total:');
  lines.push('    for i in range(scale):');

  for (const p of placements) {
    const info = CALC_MACHINERY_INFO[p.machineryKey];
    lines.push(`        place(${info.placeArg}, ${p.recipeScriptName}, ${p.count})`);
  }

  lines.push('else:');
  lines.push('    print("Not enough buildings")');

  return lines.join('\n');
}

// ── UI helpers ────────────────────────────────────────────────

function calcPopulateDropdown() {
  const sel = document.getElementById('calc-item');
  if (!sel) return;
  const allRecipes = { ...FURNACE_RECIPES, ...PLAYER_RECIPES };
  const entries = Object.entries(allRecipes)
    .map(([key, r]) => ({ key, name: r.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  sel.innerHTML = entries.map(e => `<option value="${e.key}">${e.name}</option>`).join('');
}

function runCalculator() {
  const itemKey     = document.getElementById('calc-item')?.value;
  const rate        = parseFloat(document.getElementById('calc-rate')?.value ?? '60');
  const unit        = document.getElementById('calc-unit')?.value ?? 'min';
  const assemblyTier = document.getElementById('calc-asm-tier')?.value ?? 'assembly';
  const furnaceTier  = document.getElementById('calc-furnace-tier')?.value ?? 'furnace';
  if (!itemKey || isNaN(rate) || rate <= 0) return;
  const ratePerMin = unit === 'sec' ? rate * 60 : rate;
  const script = calcGenerateScript(itemKey, ratePerMin, assemblyTier, furnaceTier);
  const out = document.getElementById('calc-output');
  if (out) out.value = script;
}

function loadCalcToEditor() {
  const src = document.getElementById('calc-output')?.value ?? '';
  if (!src.trim()) return;
  // Load into whichever script tab is currently active
  const manualActive = document.getElementById('script-tab-manual')?.classList.contains('script-tab-active');
  const editorId = manualActive ? 'script-manual-editor' : 'script-auto-editor';
  const ta = document.getElementById(editorId);
  if (ta) ta.value = src;
}

// Populate the dropdown once the DOM is ready
document.addEventListener('DOMContentLoaded', calcPopulateDropdown);
