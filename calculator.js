'use strict';

// ── Recipe Calculator ─────────────────────────────────────────
// Generates fscript files from a target item + rate.
// Reads PLAYER_RECIPES, FURNACE_RECIPES, ELECTRIC_MINER_SPEED, PUMPJACK_SPEED,
// ASSEMBLY_SPEED, ASSEMBLY2_SPEED, ASSEMBLY3_SPEED, CHEMICAL_PLANT_SPEED,
// OIL_REFINERY_SPEED, CENTRIFUGE_SPEED, ROCKET_SILO_SPEED from game.js globals.
// Reads state.research for current productivity bonuses and tech unlocks.

const CALC_RAW_ORES = new Set(['ironOre', 'copperOre', 'coal', 'stone', 'uraniumOre']);
const CALC_RESOURCE_SCRIPT_NAME = {
  ironOre: 'iron', copperOre: 'copper', coal: 'coal',
  stone: 'stone', uraniumOre: 'uranium', crudeOil: 'oil',
};

// Module slot counts per machinery key (mirrors MODULE_SLOTS in game.js)
const CALC_MODULE_SLOTS = {
  assembly: 0, assembly2: 2, assembly3: 4,
  chemical: 3, refinery: 3,
  centrifuge: 2,
  rocket_silo: 4,
  electricFurnace: 2,
  electricMiner: 3,
  pumpjack: 2,
  furnace: 0, steelFurnace: 0,
};

// Script-side module name → MODULE_DATA key (used for generated place() args)
const CALC_MODULE_SCRIPT_NAME = {
  speedModule:         'speed_module',
  speedModule2:        'speed_module_2',
  speedModule3:        'speed_module_3',
  productivityModule:  'productivity_module',
  productivityModule2: 'productivity_module_2',
  productivityModule3: 'productivity_module_3',
  gamerModule:         'gamer_module',
};

// MODULE_DATA key → script inventory variable name (for enough checks)
const CALC_MODULE_INV_CONST = {
  speedModule:         'SPEED_MODULE',
  speedModule2:        'SPEED_MODULE_2',
  speedModule3:        'SPEED_MODULE_3',
  productivityModule:  'PROD_MODULE',
  productivityModule2: 'PROD_MODULE_2',
  productivityModule3: 'PROD_MODULE_3',
  gamerModule:         'GAMER_MODULE',
};

const CALC_MACHINERY_INFO = {
  assembly:     { speed: () => ASSEMBLY_SPEED,       placeArg: 'assembly',         invConst: 'ASSEMBLY_ITEM',      enoughVar: 'enough_am1'           },
  assembly2:    { speed: () => ASSEMBLY2_SPEED,      placeArg: 'am2',              invConst: 'ASSEMBLY2_ITEM',     enoughVar: 'enough_am2'           },
  assembly3:    { speed: () => ASSEMBLY3_SPEED,      placeArg: 'am3',              invConst: 'ASSEMBLY3_ITEM',     enoughVar: 'enough_am3'           },
  chemical:     { speed: () => CHEMICAL_PLANT_SPEED, placeArg: 'chem',             invConst: 'CHEM_PLANT_ITEM',    enoughVar: 'enough_chem'          },
  refinery:     { speed: () => OIL_REFINERY_SPEED,   placeArg: 'refinery',         invConst: 'OIL_REFINERY_ITEM',  enoughVar: 'enough_refinery'      },
  centrifuge:   { speed: () => CENTRIFUGE_SPEED,     placeArg: 'centrifuge',       invConst: 'CENTRIFUGE_ITEM',    enoughVar: 'enough_centrifuge'    },
  rocket_silo:  { speed: () => ROCKET_SILO_SPEED,    placeArg: 'silo',             invConst: 'ROCKET_SILO_ITEM',   enoughVar: 'enough_silo'          },
  furnace:      { speed: () => 1.0,                  placeArg: 'furnace',          invConst: 'STONE_FURNACE',      enoughVar: 'enough_furnace'       },
  steelFurnace: { speed: () => STEEL_FURNACE_SPEED,  placeArg: 'steel_furnace',    invConst: 'STEEL_FURNACE_INV',  enoughVar: 'enough_steel_furnace' },
  electricFurnace: { speed: () => ELECTRIC_FURNACE_SPEED, placeArg: 'electric_furnace', invConst: 'ELEC_FURNACE', enoughVar: 'enough_elec_furnace'  },
  electricMiner:{ speed: () => {
    const prod = (typeof state !== 'undefined' && state?.research?.miningProdLevel) ?? 0;
    return ELECTRIC_MINER_SPEED * (1 + prod * 0.1);
  },             placeArg: 'e_drill',          invConst: 'ELECTRIC_MINER',     enoughVar: 'enough_drill'         },
  pumpjack:     { speed: () => {
    const prod = (typeof state !== 'undefined' && state?.research?.miningProdLevel) ?? 0;
    return PUMPJACK_SPEED * (1 + prod * 0.1);
  },             placeArg: 'pumpjack',         invConst: 'PUMPJACK_ITEM',      enoughVar: 'enough_pumpjack'      },
};

// Order in which building types appear in the generated script
const CALC_BUILDING_ORDER = [
  'assembly', 'assembly2', 'assembly3', 'chemical', 'refinery', 'centrifuge', 'rocket_silo',
  'furnace', 'steelFurnace', 'electricFurnace', 'electricMiner', 'pumpjack',
];

// ── Module helpers ────────────────────────────────────────────

function calcModMults(slots, moduleType) {
  if (slots === 0 || !moduleType) return { speedMult: 1, outputMult: 1 };
  const mod = (typeof MODULE_DATA !== 'undefined') ? MODULE_DATA[moduleType] : null;
  if (!mod) return { speedMult: 1, outputMult: 1 };
  const speedBonus = mod.speedBonus ?? mod.speedPenalty ?? 0;
  const prodBonus  = mod.prodBonus ?? 0;
  const speedMult  = Math.max(0.2, 1 + slots * speedBonus);
  const outputMult = 1 + slots * prodBonus;
  return { speedMult, outputMult };
}

// ── Recipe lookup ─────────────────────────────────────────────

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

// ── Rate accumulation ─────────────────────────────────────────

// Accumulate total production rates (units/sec) for every item in the tree.
// moduleType affects outputMult for each recipe, reducing upstream input demand.
function calcAccumulateRates(targetItem, targetRatePerSec, assemblyTier, furnaceTier, moduleType) {
  const itemRates = {};

  function accumulate(itemKey, ratePerSec, stack) {
    itemRates[itemKey] = (itemRates[itemKey] ?? 0) + ratePerSec;
    if (stack.has(itemKey)) return;
    if (itemKey === 'water') return;
    const found = calcFindRecipe(itemKey);
    if (!found) return;
    const { recipe, isFurnace } = found;
    const machKey    = calcMachineryKey(recipe, isFurnace, assemblyTier, furnaceTier);
    const slots      = CALC_MODULE_SLOTS[machKey] ?? 0;
    const { outputMult } = calcModMults(slots, moduleType);
    const outputQty  = recipe.outputs[itemKey] ?? 1;
    const execs      = ratePerSec / (outputQty * outputMult);
    const next = new Set(stack);
    next.add(itemKey);
    for (const [inp, qty] of Object.entries(recipe.inputs))
      accumulate(inp, execs * qty, next);
  }

  accumulate(targetItem, targetRatePerSec, new Set());
  return itemRates;
}

// ── Oil chain ─────────────────────────────────────────────────

// Resolve oil product demands (petroleumGas, lightOil, heavyOil) using
// oil processing + cracking, then add refinery/cracker/pumpjack placements.
function calcOilChain(itemRates, placements, moduleType) {
  const needHeavy = itemRates.heavyOil      ?? 0;
  const needLight = itemRates.lightOil      ?? 0;
  const needPetro = itemRates.petroleumGas  ?? 0;
  if (needHeavy <= 0 && needLight <= 0 && needPetro <= 0) return;

  const advancedResearched = typeof state !== 'undefined'
    && (state?.research?.done?.['advancedOilProcessing'] ?? false);

  const refSlots  = CALC_MODULE_SLOTS.refinery  ?? 0;
  const chemSlots = CALC_MODULE_SLOTS.chemical   ?? 0;
  const { speedMult: refSpeed  } = calcModMults(refSlots,  moduleType);
  const { speedMult: chemSpeed } = calcModMults(chemSlots, moduleType);

  if (!advancedResearched) {
    // Basic: 100 crude → 45 petro, time=5s, refinery
    const execsPerRef = OIL_REFINERY_SPEED * refSpeed / 5;
    const petroPerRef = 45 * execsPerRef;
    const R = Math.ceil(needPetro / petroPerRef) || 0;
    if (R > 0) {
      placements.push({ machineryKey: 'refinery', itemKey: 'petroleumGas', recipeScriptName: 'basic_oil_processing', count: R });
      const pumpCount = Math.ceil(R * execsPerRef * 100 / CALC_MACHINERY_INFO.pumpjack.speed());
      if (pumpCount > 0)
        placements.push({ machineryKey: 'pumpjack', itemKey: 'crudeOil', recipeScriptName: 'oil', count: pumpCount });
    }
    return;
  }

  // Advanced oil processing: 100 crude → 25 heavy + 45 light + 55 petro, time=5s
  const EXEC_RATE = OIL_REFINERY_SPEED * refSpeed / 5; // execs per physical refinery per sec
  const H_PER    = 25, L_PER = 45, P_PER = 55; // per exec
  // Heavy cracker: 40 heavy → 30 light, time=2s, chemical
  const CHEM_EXEC = CHEMICAL_PLANT_SPEED * chemSpeed / 2;
  const HC_IN  = 40 * CHEM_EXEC; // heavy consumed per plant/s
  const HC_OUT = 30 * CHEM_EXEC; // light produced per plant/s
  // Light cracker: 30 light → 20 petro, time=2s, chemical
  const LC_IN  = 30 * CHEM_EXEC;
  const LC_OUT = 20 * CHEM_EXEC;

  function canSatisfy(R) {
    const rawH = R * EXEC_RATE * H_PER;
    if (rawH < needHeavy) return false;
    const Hcplants = (rawH - needHeavy) / HC_IN;
    const totalL   = R * EXEC_RATE * L_PER + Hcplants * HC_OUT;
    if (totalL < needLight) return false;
    const Lcplants = (totalL - needLight) / LC_IN;
    const totalP   = R * EXEC_RATE * P_PER + Lcplants * LC_OUT;
    return totalP >= needPetro;
  }

  // Upper bound: needs without cracking
  const upperR = Math.max(
    needHeavy > 0 ? needHeavy / (EXEC_RATE * H_PER) : 0,
    needLight > 0 ? needLight / (EXEC_RATE * L_PER) : 0,
    needPetro > 0 ? needPetro / (EXEC_RATE * P_PER) : 0,
    1
  );

  let lo = 0, hi = upperR * 2;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    if (canSatisfy(mid)) hi = mid; else lo = mid;
  }

  const R = Math.ceil(hi);
  if (R <= 0) return;

  const rawH   = R * EXEC_RATE * H_PER;
  const surpH  = Math.max(0, rawH - needHeavy);
  const Hc     = Math.ceil(surpH / HC_IN);
  const extraL = Hc * HC_OUT;
  const totalL = R * EXEC_RATE * L_PER + extraL;
  const surpL  = Math.max(0, totalL - needLight);
  const Lc     = Math.ceil(surpL / LC_IN);

  const crudePerSec = R * EXEC_RATE * 100;
  const pumpCount   = Math.ceil(crudePerSec / CALC_MACHINERY_INFO.pumpjack.speed());

  placements.push({ machineryKey: 'refinery', itemKey: 'petroleumGas', recipeScriptName: 'advanced_oil_processing', count: R });
  if (Hc > 0) placements.push({ machineryKey: 'chemical', itemKey: 'heavyOil',     recipeScriptName: 'heavy_oil_cracking', count: Hc });
  if (Lc > 0) placements.push({ machineryKey: 'chemical', itemKey: 'lightOil',     recipeScriptName: 'light_oil_cracking', count: Lc });
  if (pumpCount > 0) placements.push({ machineryKey: 'pumpjack', itemKey: 'crudeOil', recipeScriptName: 'oil', count: pumpCount });
}

// ── Kovarex / U235 ────────────────────────────────────────────

// Handle U235 demand via Kovarex enrichment. Modifies itemRates to add
// the uranium ore demand from net U238 consumption. Returns centrifuge count.
function calcKovarex(itemRates, moduleType) {
  const needU235 = itemRates.uranium235 ?? 0;
  if (needU235 <= 0) return 0;
  const kovarexResearched = typeof state !== 'undefined'
    && (state?.research?.done?.['kovarexEnrichment'] ?? false);
  if (!kovarexResearched) return 0;

  const slots = CALC_MODULE_SLOTS.centrifuge ?? 0;
  const { speedMult } = calcModMults(slots, moduleType);
  // Kovarex: 40 U235 + 5 U238 → 41 U235 + 2 U238, time=60s
  // Net per exec: +1 U235, -3 U238
  const execsPerCentrifuge = CENTRIFUGE_SPEED * speedMult / 60;
  const netU235PerCentrifuge = execsPerCentrifuge; // 1 U235 net/exec
  const netU238PerCentrifuge = execsPerCentrifuge * 3; // 3 U238 consumed net/exec

  const centrifuges = Math.ceil(needU235 / netU235PerCentrifuge);
  const needU238    = centrifuges * netU238PerCentrifuge;

  // U238 comes from uranium processing (~10 ore per exec, ~1 U238 per exec)
  itemRates.uraniumOre = (itemRates.uraniumOre ?? 0) + needU238 * 10;

  return centrifuges;
}

// ── Building counts ───────────────────────────────────────────

// Convert item rates map → list of { machineryKey, itemKey, recipeScriptName, count }
function calcBuildingCounts(itemRates, assemblyTier, furnaceTier, moduleType) {
  const placements = [];

  for (const [itemKey, ratePerSec] of Object.entries(itemRates)) {
    if (itemKey === 'water') continue;
    if (itemKey === 'crudeOil') continue; // handled by oil chain
    if (itemKey === 'petroleumGas' || itemKey === 'lightOil' || itemKey === 'heavyOil') continue;
    if (itemKey === 'uranium235') continue; // handled by calcKovarex

    if (CALC_RAW_ORES.has(itemKey)) {
      const speed = CALC_MACHINERY_INFO.electricMiner.speed();
      const slots = CALC_MODULE_SLOTS.electricMiner ?? 0;
      const { speedMult } = calcModMults(slots, moduleType);
      const count = Math.ceil(ratePerSec / (speed * speedMult));
      if (count > 0)
        placements.push({ machineryKey: 'electricMiner', itemKey, recipeScriptName: CALC_RESOURCE_SCRIPT_NAME[itemKey], count });
      continue;
    }

    const found = calcFindRecipe(itemKey);
    if (!found) continue;
    const { recipe, isFurnace } = found;
    const machKey = calcMachineryKey(recipe, isFurnace, assemblyTier, furnaceTier);
    const info    = CALC_MACHINERY_INFO[machKey];
    if (!info) continue;
    const slots      = CALC_MODULE_SLOTS[machKey] ?? 0;
    const { speedMult, outputMult } = calcModMults(slots, moduleType);
    const outputQty  = recipe.outputs[itemKey] ?? 1;
    const execs      = ratePerSec / (outputQty * outputMult);
    const count      = Math.ceil(execs * recipe.time / (info.speed() * speedMult));
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

// ── Script generation ─────────────────────────────────────────

function calcGenerateScript(targetItem, targetRatePerMin, assemblyTier = 'assembly', furnaceTier = 'furnace', moduleType = null) {
  const ratePerSec = targetRatePerMin / 60;

  // Phase 1: accumulate rates
  const itemRates = calcAccumulateRates(targetItem, ratePerSec, assemblyTier, furnaceTier, moduleType);

  // Phase 2: handle Kovarex U235 (adds uranium ore demand)
  let kovarexCentrifuges = 0;
  if ((itemRates.uranium235 ?? 0) > 0) {
    kovarexCentrifuges = calcKovarex(itemRates, moduleType);
  }

  // Phase 3: sulfuric acid for uranium miners
  if ((itemRates.uraniumOre ?? 0) > 0) {
    const sulfRates = calcAccumulateRates('sulfuricAcid', itemRates.uraniumOre * 0.1, assemblyTier, furnaceTier, moduleType);
    for (const [k, v] of Object.entries(sulfRates))
      itemRates[k] = (itemRates[k] ?? 0) + v;
  }

  // Phase 4: compute placements (generic recipe buildings)
  const placements = calcBuildingCounts(itemRates, assemblyTier, furnaceTier, moduleType);

  // Phase 5: add Kovarex centrifuge placement
  if (kovarexCentrifuges > 0) {
    const modArg = moduleType ? `, ${CALC_MODULE_SCRIPT_NAME[moduleType] ?? moduleType}` : '';
    placements.push({ machineryKey: 'centrifuge', itemKey: 'uranium235', recipeScriptName: 'kovarex_enrichment', count: kovarexCentrifuges, moduleArg: modArg });
  }

  // Phase 6: oil chain (adds refinery/cracker/pumpjack placements)
  const OIL_PRODUCTS = ['petroleumGas', 'lightOil', 'heavyOil'];
  if (OIL_PRODUCTS.some(k => (itemRates[k] ?? 0) > 0)) {
    calcOilChain(itemRates, placements, moduleType);
  }

  // Re-sort all placements (oil chain + kovarex were appended)
  placements.sort((a, b) => {
    const oa = CALC_BUILDING_ORDER.indexOf(a.machineryKey);
    const ob = CALC_BUILDING_ORDER.indexOf(b.machineryKey);
    if (oa !== ob) return oa - ob;
    return b.count - a.count;
  });

  if (placements.length === 0) return '# No machines needed (raw resource or unknown item)';

  // Group counts by machinery type for enough_ checks
  const byMachinery = {};
  for (const p of placements) {
    if (!byMachinery[p.machineryKey]) byMachinery[p.machineryKey] = [];
    byMachinery[p.machineryKey].push(p.count);
  }

  const targetName  = camelToSnake(targetItem);
  const rateDisplay = targetRatePerMin % 1 === 0 ? targetRatePerMin : targetRatePerMin.toFixed(2);
  const moduleLabel = moduleType ? ` [${MODULE_DATA?.[moduleType]?.name ?? moduleType}]` : '';
  const lines = [`# ${targetName} ${rateDisplay} per min${moduleLabel}`, 'scale = 1', `print("${targetName} ${rateDisplay}/min${moduleLabel}")`];

  const enoughVars = [];
  for (const machKey of CALC_BUILDING_ORDER) {
    if (!byMachinery[machKey]) continue;
    const info     = CALC_MACHINERY_INFO[machKey];
    const counts   = byMachinery[machKey];
    const countExpr = counts.length === 1 ? `${counts[0]}` : `(${counts.join(' + ')})`;
    lines.push(`${info.enoughVar} = ${info.invConst} >= ${countExpr} * scale`);
    enoughVars.push({ enoughVar: info.enoughVar, invConst: info.invConst, countExpr });
  }

  // Module enough check: total modules needed = sum(count × slots) across all placements
  let modEnoughVar = null;
  if (moduleType && CALC_MODULE_INV_CONST[moduleType]) {
    let totalMods = 0;
    for (const p of placements) {
      const slots = CALC_MODULE_SLOTS[p.machineryKey] ?? 0;
      if (slots > 0) totalMods += p.count * slots;
    }
    if (totalMods > 0) {
      const invConst  = CALC_MODULE_INV_CONST[moduleType];
      const scriptName = CALC_MODULE_SCRIPT_NAME[moduleType] ?? moduleType;
      modEnoughVar = { enoughVar: `enough_${scriptName}`, invConst, countExpr: `${totalMods}`, label: scriptName };
      lines.push(`${modEnoughVar.enoughVar} = ${invConst} >= ${totalMods} * scale`);
      enoughVars.push(modEnoughVar);
    }
  }

  lines.push(`enough_total = ${enoughVars.map(e => e.enoughVar).join(' and ')}`);
  lines.push('if enough_total:');
  lines.push('    for i in range(scale):');

  const modScriptArg = moduleType && CALC_MODULE_SCRIPT_NAME[moduleType]
    ? `, ${CALC_MODULE_SCRIPT_NAME[moduleType]}` : '';

  for (const p of placements) {
    const info   = CALC_MACHINERY_INFO[p.machineryKey];
    const slots  = CALC_MODULE_SLOTS[p.machineryKey] ?? 0;
    const usesMod = moduleType && slots > 0;
    const mod    = usesMod ? modScriptArg : '';
    lines.push(`        place(${info.placeArg}, ${p.recipeScriptName}, ${p.count}${mod})`);
  }

  lines.push('else:');
  for (const { enoughVar, invConst, countExpr, label } of enoughVars) {
    lines.push(`    if not ${enoughVar}:`);
    const displayLabel = label ?? enoughVar.replace('enough_', '');
    lines.push(`        print("Need " + (${countExpr} * scale - ${invConst}) + " ${displayLabel}")`);
  }

  return lines.join('\n');
}

// ── UI helpers ────────────────────────────────────────────────

let calcSelectedItem = null;

function renderCalcPicker() {
  const host = document.getElementById('calc-item-host');
  if (!host) return;
  const allRecipes = { ...FURNACE_RECIPES, ...PLAYER_RECIPES };
  const search = (document.getElementById('calc-item-search')?.value ?? '').toLowerCase().trim();
  let entries = Object.entries(allRecipes)
    .map(([key, r]) => {
      const outKey = Object.keys(r.outputs)[0];
      return [key, r.name, itemIcon(outKey)];
    })
    .sort((a, b) => a[1].localeCompare(b[1]));
  if (search) entries = entries.filter(([, name]) => name.toLowerCase().includes(search));
  if (!entries.length) {
    host.innerHTML = `<div class="recipe-picker"><span style="font-size:.75rem;color:var(--dim)">No recipes match</span></div>`;
    return;
  }
  if (!calcSelectedItem || !entries.find(([k]) => k === calcSelectedItem))
    calcSelectedItem = entries[0][0];
  const btns = entries.map(([key, name, icon]) =>
    `<button class="recipe-icon-btn${key === calcSelectedItem ? ' selected' : ''}" data-key="${key}" title="${name}">${icon}</button>`
  ).join('');
  host.innerHTML = `<div class="recipe-picker">${btns}</div>`;
}

function runCalculator() {
  const itemKey      = calcSelectedItem;
  const rate         = parseFloat(document.getElementById('calc-rate')?.value ?? '60');
  const unit         = document.getElementById('calc-unit')?.value ?? 'min';
  const assemblyTier = document.getElementById('calc-asm-tier')?.value ?? 'assembly';
  const furnaceTier  = document.getElementById('calc-furnace-tier')?.value ?? 'furnace';
  const moduleType   = document.getElementById('calc-module')?.value || null;
  if (!itemKey || isNaN(rate) || rate <= 0) return;
  const ratePerMin = unit === 'sec' ? rate * 60 : rate;
  const script = calcGenerateScript(itemKey, ratePerMin, assemblyTier, furnaceTier, moduleType);
  const out = document.getElementById('calc-output');
  if (out) out.value = script;
}

function loadCalcToEditor() {
  const src = document.getElementById('calc-output')?.value ?? '';
  if (!src.trim()) return;
  const manualActive = document.getElementById('script-tab-manual')?.classList.contains('script-tab-active');
  const editorId = manualActive ? 'script-manual-editor' : 'script-auto-editor';
  const hlId     = manualActive ? 'script-manual-hl'     : 'script-auto-hl';
  const ta = document.getElementById(editorId);
  if (ta) {
    ta.value = src;
    if (typeof syncScriptHighlight === 'function')
      syncScriptHighlight(ta, document.getElementById(hlId));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderCalcPicker();
  document.getElementById('calc-item-host')?.addEventListener('click', e => {
    const btn = e.target.closest('.recipe-icon-btn[data-key]');
    if (!btn) return;
    calcSelectedItem = btn.dataset.key;
    renderCalcPicker();
  });
});
