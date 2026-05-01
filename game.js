'use strict';

// ── Constants ────────────────────────────────────────────────

const TICK_MS              = 100;
const MINE_SPEED           = 0.25;   // ore/sec per burner miner
const ELECTRIC_MINER_SPEED = 0.5;   // ore/sec per electric miner
const ELECTRIC_MINER_KW    = 90;    // kW each
const ASSEMBLY_SPEED       = 0.5;   // recipe.time / ASSEMBLY_SPEED = actual seconds
const ASSEMBLY_KW          = 75;    // kW each
const PLACE_TIME           = 2; // seconds to place one building (base)
const ROBOT_BONUS_PER_UNIT   = 0.008;  // placement speed contribution per robot×effectiveness
const WORKER_SPEED_PER_LEVEL = 0.25;   // robot effectiveness gain per speed research level
const WORKER_CARGO_PER_LEVEL = 0.25;   // robot effectiveness gain per cargo size level
const PLACE_TIME_MIN         = 0.01;   // minimum raw time before batch mode kicks in
const PLACE_TIME_LOOP        = 0.02;   // effective time used in batch mode
const BITER_INTERVAL       = 120;
const BITER_RAMP           = 1.0;    // multiplier on wave number for scaling
const BITER_HP_CAP         = 3000;   // max hp per biter
const BITER_DPS_CAP        = 90;     // max dps per biter
const BITER_COUNT_CAP      = 200;    // max biters per wave
const BITER_ARMOR_CAP      = 5;      // max armor per biter
const COAL_PER_MINER       = 0.0375;
const COAL_PER_FURNACE     = 0.0225;
const WATER_MAX            = 25000;
const STEAM_MAX            = 25000;
const RADAR_CHUNK_TIME     = 60;
const CHUNK_ORE_CHANCE     = 0.80;
const ASSEMBLY2_SPEED      = 0.75;
const ASSEMBLY2_KW         = 150;
const ASSEMBLY3_SPEED      = 1.25;
const ASSEMBLY3_KW         = 375;
const STEEL_FURNACE_SPEED  = 2.0;
const COAL_PER_STEEL_FURNACE = 0.03375;
const ELECTRIC_FURNACE_SPEED = 2.0;
const ELECTRIC_FURNACE_KW  = 180;
const SOLAR_PANEL_KW       = 60;
const ACCUMULATOR_CAPACITY = 5000; // kJ per accumulator
const PUMPJACK_SPEED       = 1.0;  // crude oil units/sec per pumpjack
const PUMPJACK_KW          = 90;
const OIL_REFINERY_SPEED   = 1.0;
const OIL_REFINERY_KW      = 420;
const CHEMICAL_PLANT_SPEED = 1.25;
const CHEMICAL_PLANT_KW    = 210;
const CENTRIFUGE_SPEED     = 0.75;
const CENTRIFUGE_KW        = 350;
const ROCKET_SILO_SPEED    = 1.0;
const ROCKET_SILO_KW       = 4000;
const LAB_KW = 60;
const RADAR_KW = 300;
const NUCLEAR_REACTOR_KW    = 488880;  // kW per nuclear reactor complex
const NUCLEAR_FUEL_INTERVAL = 50;      // seconds per uranium fuel cell consumed

// ── Module System ─────────────────────────────────────────────
const MODULE_SLOTS = {
  electricMiner: 3,
  assembly: 0, assembly2: 2, assembly3: 4,
  chemicalPlant: 3, oilRefinery: 3,
  rocketSilo: 4,
  electricFurnace: 2,
  lab: 2,
  pumpjack: 2,
  centrifuge: 2,
};
const MODULE_DATA = {
  speedMk1: { name: 'Speed 1', speedBonus: 0.20, energyBonus: 0.50 },
  speedMk2: { name: 'Speed 2', speedBonus: 0.30, energyBonus: 0.60 },
  speedMk3: { name: 'Speed 3', speedBonus: 0.50, energyBonus: 0.70 },
  prodMk1:  { name: 'Prod 1',  prodBonus: 0.04, speedPenalty: -0.05, energyBonus: 0.40 },
  prodMk2:  { name: 'Prod 2',  prodBonus: 0.06, speedPenalty: -0.10, energyBonus: 0.60 },
  prodMk3:  { name: 'Prod 3',  prodBonus: 0.10, speedPenalty: -0.15, energyBonus: 0.80 },
  gamerModule: { name: 'Gamer Module', speedBonus: 0, prodBonus: 0 },
};
// Recipes whose output is a placeable building — productivity modules not allowed.
// Add recipe output item keys here as needed (e.g., 'inserter', 'transportBelt').
const PROD_MODULE_BLACKLIST = new Set([]);

const WALL_HP              = 350;      // HP per stone wall in perimeter
// Gun turret: shotsPerSec × max(0, dmgPerShot×gMult − armor×armorMult) = effective DPS
const GUN_TURRET_STATS = {
  firearmMagazine:   { shotsPerSec: 5, dmgPerShot: 12, armorMult: 1.0, ammoCostPerSec: 0.25 },
  piercingRoundsMag: { shotsPerSec: 5, dmgPerShot: 20, armorMult: 0.5, ammoCostPerSec: 0.25 },
  uraniumRoundsMag:  { shotsPerSec: 5, dmgPerShot: 50, armorMult: 0.0, ammoCostPerSec: 0.25 },
};
// DPS values for tooltip labels (computed from stats at armor=0)
const GUN_DPS_BASIC        = 60;       // 5×12
const GUN_DPS_PIERCING     = 100;      // 5×20
const GUN_DPS_URANIUM      = 250;      // 5×50
const LASER_SHOTS_PER_SEC  = 1.5;      // shots per second per laser turret
const LASER_DMG_PER_SHOT   = 20;       // damage per shot (ignores armor)
const LASER_DPS_PER_TURRET = LASER_SHOTS_PER_SEC * LASER_DMG_PER_SHOT; // 30 DPS
const LASER_KW_PER_TURRET  = LASER_SHOTS_PER_SEC * 800; // 1200 kW (800kJ/shot)
const BUILDING_TOUGHNESS   = 2000;     // overflow damage to destroy 1 building
const WALLS_PER_TILE       = 20;  // max stone walls per perimeter tile  → total = 20 * 4 * sideLength
const TURRETS_PER_TILE     = 5;   // max turrets per perimeter tile       → total = 5 * 4 * sideLength
const ARTILLERY_BASE_DAMAGE     = 500;    // base damage per artillery piece per wave
const ATOMIC_BOMB_DAMAGE        = 1e9;    // damage dealt by one atomic bomb to one section
const ATOMIC_BOMBS_PER_SPIDER   = 5;      // bombs available per spidertron per wave
const IRRADIATION_SCALING_RATE  = 0.001;  // how much each bomb use increases biter threat scaling

// ── Biter Scaling Constants (tweak for balance) ────────────────
const BITER_POINTS_PRE_RED    = 0.5;   // threat points gained per wave before red science
const BITER_POINTS_POST_RED   = 1.0;   // threat points gained per wave after red science
const BITER_POINTS_POST_GREEN = 2.0;   // threat points gained per wave after green science
const BITER_POINTS_POST_BLUE  = 4.0;   // threat points gained per wave after blue science (and above, pre-rainbow)
const BITER_POINTS_CAP_LINEAR = 500.0; // max threat points in linear phase
const BITER_POINTS_EXP_BASE_INITIAL = 1.01;  // initial exponential base (per wave) after rainbow
const BITER_POINTS_EXP_BASE_GROWTH  = 0.0001; // how much the base increases per wave after rainbow

// ITEMS, ALWAYS_SHOW, FURNACE_RECIPES, PLAYER_RECIPES, CRAFT_SECTIONS loaded from data/recipes.js
// TECHNOLOGIES loaded from data/technologies.js

// ── Resource Patches ─────────────────────────────────────────

const PATCHES = {
  ironOre:   { name: 'Iron Ore',   icon: '🪨', base: 30000 },
  copperOre: { name: 'Copper Ore', icon: '🟤', base: 20000 },
  coal:      { name: 'Coal',       icon: '⬛', base: 15000 },
  stone:     { name: 'Stone',      icon: '⬜', base: 10000 },
  crudeOil:  { name: 'Crude Oil',  icon: '🖤', base: 0 },     // discovered by radar
  uraniumOre: { name: 'Uranium Ore', icon: '💚', base: 0 },  // discovered by radar after Nuclear Power
};


// ── Technologies ──────────────────────────────────────────────
// (loaded from data/technologies.js)

const BUILDING_COSTS = {
  miner:         { burnerMinerItem: 1 },
  furnace:       { stoneFurnaceItem: 1 },
  offshoreP:     { offshorePumpItem: 1 },
  boiler:        { boilerItem: 1 },
  steamEngine:   { steamEngineItem: 1 },
  assembly:      { assemblyMachine1Item: 1 },
  radar:         { radarItem: 1 },
  lab:           { labItem: 1 },
  electricMiner: { electricMinerItem: 1 },
  steelFurnace:  { steelFurnaceItem: 1 },
  assembly2:     { assemblyMachine2Item: 1 },
  solarPanel:    { solarPanelItem: 1 },
  accumulator:   { accumulatorItem: 1 },
  pumpjack:      { pumpjackItem: 1 },
  oilRefinery:   { oilRefineryItem: 1 },
  chemicalPlant: { chemicalPlantItem: 1 },
  electricFurnace: { electricFurnaceItem: 1 },
  assembly3:     { assemblyMachine3Item: 1 },
  centrifuge:    { centrifugeItem: 1 },
  rocketSilo:    { rocketSiloItem: 1 },
  nuclearReactor: { nuclearReactorItem: 4, offshorePumpItem: 4, pipe: 180, heatPipeItem: 68, heatExchangerItem: 48, steamTurbineItem: 84 },
};

const COST_LABEL = {
  miner:         '1 × Burner Mining Drill',
  furnace:       '1 × Stone Furnace',
  offshoreP:     '1 × Offshore Pump',
  boiler:        '1 × Boiler',
  steamEngine:   '1 × Steam Engine',
  assembly:      '1 × Assembly Machine Mk1',
  radar:         '1 × Radar',
  lab:           '1 × Lab',
  electricMiner: '1 × Electric Mining Drill',
  steelFurnace:  '1 × Steel Furnace',
  assembly2:     '1 × Assembly Machine Mk2',
  solarPanel:    '1 × Solar Panel',
  accumulator:   '1 × Accumulator',
  pumpjack:      '1 × Pumpjack',
  oilRefinery:   '1 × Oil Refinery',
  chemicalPlant: '1 × Chemical Plant',
  electricFurnace: '1 × Electric Furnace',
  assembly3:     '1 × Assembly Machine Mk3',
  centrifuge:    '1 × Centrifuge',
  rocketSilo:    '1 × Rocket Silo',
  nuclearReactor: '4 × Nuclear Reactor + 4 × Offshore Pump + 180 × Pipe + 68 × Heat Pipe + 48 × Heat Exchanger + 84 × Steam Turbine',
};

// low≈50k  medium≈75k  high≈100k total ore
const DENSITY_MULT = { low: 0.67, medium: 1.0, high: 1.33 };

// Set of item keys that are consumed by BUILDING_COSTS (used for default limit detection)
const BUILDING_ITEM_KEYS = new Set(
  Object.values(BUILDING_COSTS).flatMap(cost => Object.keys(cost))
);

// ── Meta Progression State ────────────────────────────────────

function defaultMetaState() {
  return {
    totalPoints: 0,
    rawKills: 0,
    buildingUpgrades: {},
    perks: {
      quickStart: false,
    },
    gamerModule: {
      speedPoints: 0,
      prodPoints: 0,
    },
  };
}

let metaState = defaultMetaState();

function loadMetaState() {
  try {
    const saved = localStorage.getItem('fi_meta');
    if (saved) {
      const parsed = JSON.parse(saved);
      const def = defaultMetaState();
      metaState = {
        ...def,
        ...parsed,
        perks: { ...def.perks, ...(parsed.perks ?? {}) },
        gamerModule: { ...def.gamerModule, ...(parsed.gamerModule ?? {}) },
        buildingUpgrades: { ...(parsed.buildingUpgrades ?? {}) },
      };
    }
  } catch (e) {
    metaState = defaultMetaState();
  }
}

function saveMetaState() {
  localStorage.setItem('fi_meta', JSON.stringify(metaState));
}

// ── Runtime State ─────────────────────────────────────────────

let state           = null;
let gameLoopId      = null;
let placeQueue      = [];    // pending placements
let placing         = false;
let currentPlacing  = null;
let placeStartMs    = null;
let placeRafId      = null;
let selectedDensity = 'medium';
let mouseHeld       = false;

const miningCooldowns = {};

// Script engine state (var so script.js can access them)
var scriptOutput    = [];
var scriptAutoRun   = false;
var scriptAutoTimer = 0;
const SCRIPT_AUTO_INTERVAL = 10;
var scriptActiveTab = 'manual'; // 'auto' | 'manual'

// Picker search state (per machine type)
const pickerSearches = {};

// Delta tracking
let inventorySnapshot = null;
let snapshotTimer     = 0;
let prodAccum = {};      // gross items produced this snapshot window
let consAccum = {};      // gross items consumed this snapshot window
let tickPrevInv = null;  // inventory snapshot at start of each tick (for prod/cons split)

// UI state
let graphMode = 'production'; // 'production' | 'consumption' | 'net'
let buildingSearchQuery = '';
let lastTechHash = '';
let lastRobotTechHtml = '';
let lastPerimeterHtml = '';
let lastInventoryHtml  = '';
let lastStarredBarHtml = '';
let lastMetaHtml = '';
let metaSubTab = 'buildings';
let currentSaveFile = null;
let _pendingScriptRestore = null;
let lastSaveMs = 0;

function itemIcon(key) {
  const item = ITEMS[key];
  if (!item) return '❓';
  if (item.img) return `<img class="item-icon" src="${item.img}" alt="${item.name}">`;
  return item.icon ?? '❓';
}

// ── Robot Tech Data ───────────────────────────────────────────

const ROBOT_CARGO_TECH_DATA = [
  null,
  { cost: { redScience:1, greenScience:1, blueScience:1 },                                           timePerPack: 30, totalNeeded: 200 },
  { cost: { redScience:1, greenScience:1, blueScience:1, purpleScience:1 },                           timePerPack: 60, totalNeeded: 300 },
  { cost: { redScience:1, greenScience:1, blueScience:1, purpleScience:1, yellowScience:1 },          timePerPack: 60, totalNeeded: 450 },
];

function getRobotSpeedTechData(level) {
  let totalNeeded, packs, timePerPack;
  if      (level === 1) { totalNeeded = 50;                              packs = ['redScience','greenScience','blueScience'];                                               timePerPack = 30; }
  else if (level === 2) { totalNeeded = 100;                             packs = ['redScience','greenScience','blueScience'];                                               timePerPack = 30; }
  else if (level === 3) { totalNeeded = 150;                             packs = ['redScience','greenScience','blueScience','yellowScience'];                               timePerPack = 60; }
  else if (level === 4) { totalNeeded = 250;                             packs = ['redScience','greenScience','blueScience','yellowScience'];                               timePerPack = 60; }
  else if (level === 5) { totalNeeded = 500;                             packs = ['redScience','greenScience','blueScience','purpleScience','yellowScience'];               timePerPack = 60; }
  else                  { totalNeeded = Math.pow(2, level - 6) * 1000;  packs = ['redScience','greenScience','blueScience','purpleScience','yellowScience','spaceScience','rainbowScience']; timePerPack = 60; }
  return { cost: Object.fromEntries(packs.map(p => [p, 1])), timePerPack, totalNeeded };
}

function getMiningProdData(level) {
  let packs;
  if (level <= 1)      packs = ['redScience','greenScience'];
  else if (level <= 2) packs = ['redScience','greenScience','blueScience'];
  else if (level <= 3) packs = ['redScience','greenScience','blueScience','purpleScience','yellowScience'];
  else                 packs = ['redScience','greenScience','blueScience','purpleScience','yellowScience','spaceScience','rainbowScience'];
  const totalNeeded = level <= 3 ? level * 250 : 2500 * (level - 3);
  return { cost: Object.fromEntries(packs.map(p => [p, 1])), timePerPack: 60, totalNeeded };
}

function getGunDamageData(level) {
  let packs, t = 60, totalNeeded;
  if (level <= 2)      { packs = ['redScience']; t = 30; totalNeeded = level * 100; }
  else if (level <= 4) { packs = ['redScience','greenScience','blackScience']; totalNeeded = level * 100; }
  else if (level <= 5) { packs = ['redScience','greenScience','blackScience','blueScience']; totalNeeded = 500; }
  else if (level <= 6) { packs = ['redScience','greenScience','blackScience','blueScience','yellowScience']; totalNeeded = 600; }
  else                 { packs = ['redScience','greenScience','blackScience','blueScience','yellowScience','spaceScience','rainbowScience']; totalNeeded = Math.pow(2, level - 7) * 1000; }
  return { cost: Object.fromEntries(packs.map(p => [p, 1])), timePerPack: t, totalNeeded };
}

function getLaserDamageData(level) {
  let packs, t = 60, totalNeeded;
  if (level <= 2)      { packs = ['redScience','greenScience','blueScience','blackScience']; t = 30; totalNeeded = level * 100; }
  else if (level <= 4) { packs = ['redScience','greenScience','blueScience','blackScience']; totalNeeded = level * 100; }
  else if (level <= 6) { packs = ['redScience','greenScience','blueScience','blackScience','yellowScience']; totalNeeded = level * 100; }
  else                 { packs = ['redScience','greenScience','blueScience','blackScience','yellowScience','spaceScience','rainbowScience']; totalNeeded = Math.pow(2, level - 7) * 1000; }
  return { cost: Object.fromEntries(packs.map(p => [p, 1])), timePerPack: t, totalNeeded };
}

function gunDamageMult(level) {
  const l = level ?? 0;
  return 1 + Math.min(l, 2) * 0.10 + Math.min(Math.max(0, l - 2), 4) * 0.20 + Math.max(0, l - 6) * 0.40;
}

function laserDamageMult(level) {
  const l = level ?? 0;
  return 1 + Math.min(l, 6) * 0.20 + Math.max(0, l - 6) * 0.70;
}

function artilleryDamageMult(level) {
  return 1 + (level ?? 0) * 0.25;
}

function getArtilleryRangeTechData(level) {
  const totalNeeded = Math.round(Math.pow(2, level - 1) * 200);
  const packs = level <= 3
    ? ['redScience','greenScience','blueScience','yellowScience']
    : ['redScience','greenScience','blueScience','yellowScience','spaceScience','rainbowScience'];
  return { cost: Object.fromEntries(packs.map(p => [p, 1])), timePerPack: 60, totalNeeded };
}

function getArtilleryDamageTechData(level) {
  const totalNeeded = Math.round(Math.pow(2, level - 1) * 300);
  const packs = level <= 3
    ? ['redScience','greenScience','blueScience','yellowScience']
    : ['redScience','greenScience','blueScience','yellowScience','spaceScience','rainbowScience'];
  return { cost: Object.fromEntries(packs.map(p => [p, 1])), timePerPack: 60, totalNeeded };
}

function miningProdMult() {
  return 1 + (state.research?.miningProdLevel ?? 0) * 0.10;
}

function currentRobotTechData() {
  const cur = state.research.current;
  if (cur === 'robot:speed')         return getRobotSpeedTechData((state.research.robotSpeedLevel ?? 0) + 1);
  if (cur === 'robot:cargo')         return ROBOT_CARGO_TECH_DATA[(state.research.robotCargoLevel ?? 0) + 1] ?? null;
  if (cur === 'mining:productivity') return getMiningProdData((state.research.miningProdLevel ?? 0) + 1);
  if (cur === 'gun:damage')          return getGunDamageData((state.research.gunDamageLevel ?? 0) + 1);
  if (cur === 'laser:damage')        return getLaserDamageData((state.research.laserDamageLevel ?? 0) + 1);
  if (cur === 'artillery:range')     return getArtilleryRangeTechData((state.research.artilleryRangeLevel ?? 0) + 1);
  if (cur === 'artillery:damage')    return getArtilleryDamageTechData((state.research.artilleryDamageLevel ?? 0) + 1);
  return null;
}

function computePlaceTimeSec() {
  const logisticsBonus = (state?.research?.done?.logistics ? 0.5 : 0) + (state?.research?.done?.logistics2 ? 0.5 : 0);
  const baseTime = PLACE_TIME - logisticsBonus;
  const robotCount = Math.floor(state?.inventory?.constructionRobotItem ?? 0);
  if (robotCount === 0) return { time: baseTime, batch: 1 };
  const speedLevel = state.research?.robotSpeedLevel ?? 0;
  const cargoLevel = state.research?.robotCargoLevel ?? 0;
  const effectiveness = 1 + speedLevel * WORKER_SPEED_PER_LEVEL + cargoLevel * WORKER_CARGO_PER_LEVEL;
  const robotBonus = robotCount * effectiveness * ROBOT_BONUS_PER_UNIT;
  let rawTime = baseTime / (1 + robotBonus);
  let batch = 1;
  if (rawTime < PLACE_TIME_MIN) {
    batch = Math.max(1, Math.floor(PLACE_TIME_LOOP / rawTime));
    rawTime = PLACE_TIME_LOOP;
  }
  return { time: rawTime, batch };
}

function defaultPlacementRecipes() {
  return {
    miner: 'ironOre', electricMiner: 'ironOre',
    furnace: 'ironPlate', steelFurnace: 'ironPlate', electricFurnace: 'ironPlate',
    assembly: 'ironGear', assembly2: 'ironGear', assembly3: 'ironGear',
    oilRefinery: 'basicOilProcessing',
    chemicalPlant: 'plasticBar',
    centrifuge: 'uraniumProcessing',
    rocketSilo: 'rocketPart',
  };
}

function createState(settings) {
  const mult = DENSITY_MULT[settings.density] ?? 1.0;
  const gracePeriod = settings.biterGracePeriod ?? 420;
  const st = {
    settings: {
      defaultLimitBuilding: 10,
      defaultLimitOther: Infinity,
      biterGracePeriod:    420,
      biterIntervalSecs:   120,
      metaProgEnabled: false,
      ...settings,
    },
    placementRecipes: defaultPlacementRecipes(),
    inventory: { ...Object.fromEntries(Object.keys(ITEMS).map(k => [k, 0])), coal: 50 },
    patches:   Object.fromEntries(
      Object.entries(PATCHES).map(([k, v]) => {
        const base = Math.floor(v.base * mult);
        const starterNodes = base > 0 ? Math.round((35 + Math.floor(Math.random() * 21)) * mult) : 0;
        return [k, {
          remaining:    base,
          nodes:        starterNodes,
          pendingFinds: [],
        }];
      })
    ),
    buildings: [
      { id: 1, type: 'miner',   resource: 'ironOre',  acc: 0 },
      { id: 2, type: 'furnace', recipe:   'ironPlate', active: false, progress: 0 },
      { id: 3, type: 'miner',   resource: 'stone',    acc: 0 },
      { id: 4, type: 'miner',   resource: 'coal',     acc: 0 },
    ],
    nextId:         5,
    biterTimer:     settings.biters ? -gracePeriod : 0,
    biterWaveNumber: 0,
    lastBiterWave:  null,
    perimeter: {
      sideLength: 10,
      walls: 0,
      gunTurrets: 0,
      laserTurrets: 0,
      ammoType: 'firearmMagazine',
      artillery: 0,
      artilleryRangeLevel: 0,
      artilleryDamageLevel: 0,
      spidertrons: 0,
      atomicBombsUsedThisWave: 0,
      irradiationLevel: 0,
    },
    biterThreatPoints: 0,
    biterWavesAfterRainbow: 0,
    bitersKilled: 0,
    groupSettings:  {},
    water:          0,
    steam:          0,
    powerKw:        0,
    powerDemandKw:  0,
    powerRatio:     1,
    chunksRevealed: 0,
    uraniumProcessingCount: 0,
    inventoryDelta: {},
    accumulatorCharge: 0,
    research: {
      done:              {},
      current:           null,
      totalConsumed:     0,
      queue:             [],
      savedKey:          null,
      savedProgress:     0,
      robotSpeedLevel:      0,
      robotCargoLevel:      0,
      miningProdLevel:      0,
      gunDamageLevel:       0,
      laserDamageLevel:     0,
      artilleryRangeLevel:  0,
      artilleryDamageLevel: 0,
    },
    craftQueue:  [],
    craftActive: null,
    scriptMemory: {},
    starredItems: [],
    productionHistory: { samples: [], prodSamples: [], consSamples: [] },
    seen: {},
    allPaused: false,
    devMode: false,
    devFreeResearch: false,
    devTickSpeed: 1,
  };

  // Apply Quick Start perk if purchased and meta prog is enabled
  if (metaState?.perks?.quickStart && st.settings.metaProgEnabled) {
    let nid = st.nextId;
    // 1 extra lab
    st.buildings.push({ id: nid++, type: 'lab', acc: 0, active: false, progress: 0 });
    // 1 boiler
    st.buildings.push({ id: nid++, type: 'boiler', acc: 0, active: false, progress: 0 });
    // 1 steam engine
    st.buildings.push({ id: nid++, type: 'steamEngine', acc: 0, active: false, progress: 0 });
    // 5 coal miners
    for (let i = 0; i < 5; i++) st.buildings.push({ id: nid++, type: 'miner', resource: 'coal', acc: 0 });
    // 5 iron miners
    for (let i = 0; i < 5; i++) st.buildings.push({ id: nid++, type: 'miner', resource: 'ironOre', acc: 0 });
    // 5 iron furnaces
    for (let i = 0; i < 5; i++) st.buildings.push({ id: nid++, type: 'furnace', recipe: 'ironPlate', active: false, progress: 0 });
    // 5 copper miners
    for (let i = 0; i < 5; i++) st.buildings.push({ id: nid++, type: 'miner', resource: 'copperOre', acc: 0 });
    // 5 copper furnaces
    for (let i = 0; i < 5; i++) st.buildings.push({ id: nid++, type: 'furnace', recipe: 'copperPlate', active: false, progress: 0 });
    st.nextId = nid;
  }

  return st;
}

// ── Save / Load ───────────────────────────────────────────────

function buildSaveEnvelope() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    state,
    meta: metaState,
    placeQueue: [...placeQueue],
    scriptContent:     document.getElementById('script-manual-editor')?.value ?? '',
    scriptAutoContent: document.getElementById('script-auto-editor')?.value ?? '',
    scriptAutoRun,
  };
}

function applyStateFromEnvelope(envelope) {
  const isEnvelope = envelope?.version != null;
  const raw = isEnvelope ? envelope.state : envelope;
  state = raw;

  // Backwards-compat field initialization
  if (!state.groupSettings)            state.groupSettings    = {};
  if (state.water    == null)          state.water            = 0;
  if (state.steam    == null)          state.steam            = 0;
  if (state.powerKw  == null)          state.powerKw          = 0;
  if (state.powerDemandKw == null)     state.powerDemandKw    = 0;
  if (state.powerRatio == null)        state.powerRatio       = 1;
  if (state.chunksRevealed == null)    state.chunksRevealed   = 0;
  if (state.uraniumProcessingCount == null) state.uraniumProcessingCount = 0;
  if (state.accumulatorCharge == null) state.accumulatorCharge = 0;
  if (state.biterWaveNumber == null) state.biterWaveNumber = 0;
  if (state.lastBiterWave  == null) state.lastBiterWave  = null;
  if (!state.perimeter) state.perimeter = { sideLength: 10, walls: 0, gunTurrets: 0, laserTurrets: 0, ammoType: 'firearmMagazine' };
  if (state.perimeter.ammoType          == null) state.perimeter.ammoType          = 'firearmMagazine';
  if (state.perimeter.artillery         == null) state.perimeter.artillery         = 0;
  if (state.perimeter.artilleryRangeLevel  == null) state.perimeter.artilleryRangeLevel  = 0;
  if (state.perimeter.artilleryDamageLevel == null) state.perimeter.artilleryDamageLevel = 0;
  if (state.perimeter.spidertrons       == null) state.perimeter.spidertrons       = 0;
  if (state.perimeter.atomicBombsUsedThisWave == null) state.perimeter.atomicBombsUsedThisWave = 0;
  if (state.perimeter.irradiationLevel  == null) state.perimeter.irradiationLevel  = 0;
  if (state.biterThreatPoints == null) state.biterThreatPoints = 0;
  if (state.biterWavesAfterRainbow == null) state.biterWavesAfterRainbow = 0;
  if (!state.inventoryDelta)           state.inventoryDelta   = {};
  if (!state.placementRecipes)         state.placementRecipes = defaultPlacementRecipes();
  if (state.devMode         == null)   state.devMode          = false;
  if (state.devFreeResearch == null)   state.devFreeResearch  = false;
  if (state.devTickSpeed    == null)   state.devTickSpeed     = 1;
  if (state.settings?.radarNotif == null) state.settings.radarNotif = true;
  if (state.settings?.defaultLimitBuilding == null) state.settings.defaultLimitBuilding = 10;
  if (state.settings?.defaultLimitOther    == null) state.settings.defaultLimitOther    = Infinity;
  // Patch compat: add nodes/pendingFinds to existing patches
  for (const [, patch] of Object.entries(state.patches ?? {})) {
    if (patch.nodes        == null) patch.nodes        = patch.remaining > 0 ? 5 : 0;
    if (!patch.pendingFinds)        patch.pendingFinds = [];
  }
  if (!state.research) state.research = { done: {}, current: null, totalConsumed: 0 };
  if (state.research.totalConsumed == null)    state.research.totalConsumed    = 0;
  if (!state.research.queue)                   state.research.queue            = [];
  if (state.research.savedKey      == null)    state.research.savedKey         = null;
  if (state.research.savedProgress == null)    state.research.savedProgress    = 0;
  if (state.research.robotSpeedLevel  == null) state.research.robotSpeedLevel  = 0;
  if (state.research.robotCargoLevel  == null) state.research.robotCargoLevel  = 0;
  if (state.research.miningProdLevel  == null) state.research.miningProdLevel  = 0;
  if (state.research.gunDamageLevel      == null) state.research.gunDamageLevel      = 0;
  if (state.research.laserDamageLevel   == null) state.research.laserDamageLevel   = 0;
  if (state.research.artilleryRangeLevel  == null) state.research.artilleryRangeLevel  = 0;
  if (state.research.artilleryDamageLevel == null) state.research.artilleryDamageLevel = 0;
  // Migrate old per-recipe craftJobs to unified craftQueue
  if (state.craftJobs && !state.craftQueue) {
    state.craftQueue  = [];
    state.craftActive = null;
    for (const [key, job] of Object.entries(state.craftJobs)) {
      if (job.crafting) state.craftActive = { key, progress: job.progress ?? 0 };
      for (let i = 0; i < (job.queued ?? 0); i++) state.craftQueue.push({ key });
    }
    delete state.craftJobs;
  }
  if (!state.craftQueue)  state.craftQueue  = [];
  if (state.craftActive === undefined) state.craftActive = null;
  if (!state.scriptMemory) state.scriptMemory = {};
  if (!state.starredItems) state.starredItems = [];
  if (state.allPaused == null) state.allPaused = false;
  if (!state.productionHistory) state.productionHistory = { samples: [], prodSamples: [], consSamples: [] };
  if (!state.productionHistory.prodSamples) state.productionHistory.prodSamples = [];
  if (!state.productionHistory.consSamples) state.productionHistory.consSamples = [];
  if (state.settings?.biterGracePeriod  == null) state.settings.biterGracePeriod  = 420;
  if (state.settings?.biterIntervalSecs == null) state.settings.biterIntervalSecs = 120;
  if (!state.seen) state.seen = {};
  if (state.bitersKilled == null) state.bitersKilled = 0;
  if (state.settings?.metaProgEnabled == null) {
    if (state.settings) state.settings.metaProgEnabled = false;
  }

  // Merge meta state from save envelope
  if (isEnvelope && envelope.meta) {
    const def = defaultMetaState();
    const em  = envelope.meta;
    metaState = {
      ...def,
      ...em,
      perks: { ...def.perks, ...(em.perks ?? {}) },
      gamerModule: { ...def.gamerModule, ...(em.gamerModule ?? {}) },
      buildingUpgrades: { ...(em.buildingUpgrades ?? {}) },
    };
    saveMetaState();
  }

  // Restore transient placement state
  if (placeRafId) cancelAnimationFrame(placeRafId);
  placeRafId = null; placing = false; currentPlacing = null;
  placeQueue = isEnvelope && Array.isArray(envelope.placeQueue) ? [...envelope.placeQueue] : [];

  // Script content is restored in showGame() once the DOM is ready
  _pendingScriptRestore = isEnvelope
    ? { content: envelope.scriptContent ?? '', autoContent: envelope.scriptAutoContent ?? '', autoRun: envelope.scriptAutoRun ?? false }
    : null;
}

async function saveGame() {
  if (!state) return;
  if (!window.fileAPI) {
    localStorage.setItem('fi_save', JSON.stringify(buildSaveEnvelope()));
    lastSaveMs = Date.now();
    notify('Game saved!', 'info');
    return;
  }
  if (!currentSaveFile) { await saveGameAs(); return; }
  await window.fileAPI.saveGame(currentSaveFile, JSON.stringify(buildSaveEnvelope(), null, 2));
  lastSaveMs = Date.now();
  notify('Game saved!', 'info');
}

async function saveGameAs() {
  if (!state) return;
  if (!window.fileAPI) { await saveGame(); return; }
  const filename = await window.fileAPI.showSaveDialog(currentSaveFile ?? 'save1.json');
  if (!filename) return;
  currentSaveFile = filename;
  await window.fileAPI.saveGame(filename, JSON.stringify(buildSaveEnvelope(), null, 2));
  lastSaveMs = Date.now();
  updateSaveFilenameDisplay();
  notify('Game saved!', 'info');
}

async function loadGameFromFile(filename) {
  const json = await window.fileAPI.loadGame(filename);
  if (!json) { notify('Save file not found.', 'warning'); return; }
  let envelope;
  try { envelope = JSON.parse(json); } catch { notify('Invalid save file.', 'warning'); return; }
  applyStateFromEnvelope(envelope);
  currentSaveFile = filename;
  showGame();
}

async function deleteSaveSlot(filename) {
  if (!confirm(`Delete save "${filename.replace(/\.json$/, '')}"?`)) return;
  await window.fileAPI.deleteSave(filename);
  refreshSaveList();
}

async function importSaveFromFile() {
  if (window.fileAPI) {
    const json = await window.fileAPI.showOpenDialog();
    if (!json) return;
    let envelope;
    try { envelope = JSON.parse(json); } catch { notify('Invalid save file.', 'warning'); return; }
    applyStateFromEnvelope(envelope);
    currentSaveFile = null;
    showGame();
  } else {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      let envelope;
      try { envelope = JSON.parse(await file.text()); } catch { notify('Invalid save file.', 'warning'); return; }
      applyStateFromEnvelope(envelope);
      currentSaveFile = null;
      showGame();
    };
    input.click();
  }
}

function tryLoadFromLocalStorage() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem('fi_save')); } catch { saved = null; }
  if (!saved) { notify('No browser save found.', 'warning'); return; }
  applyStateFromEnvelope(saved);
  currentSaveFile = null;
  showGame();
}

async function refreshSaveList() {
  const el = document.getElementById('save-list');
  if (!el) return;

  if (!window.fileAPI) {
    const raw = localStorage.getItem('fi_save');
    el.innerHTML = raw
      ? `<div class="save-slot">
           <div class="save-slot-info"><div class="save-slot-name">Browser Save</div><div class="save-slot-date">Local storage</div></div>
           <div class="save-slot-actions"><button class="btn-sm" onclick="tryLoadFromLocalStorage()">Load</button></div>
         </div>`
      : `<div class="save-empty">No saves found</div>`;
    return;
  }

  const saves = await window.fileAPI.listSaves();
  if (!saves.length) {
    el.innerHTML = `<div class="save-empty">No saves found</div>`;
    return;
  }
  el.innerHTML = saves.map(s => {
    const displayName = escapeHtml(s.name.replace(/\.json$/, ''));
    const date = new Date(s.savedAt).toLocaleString();
    const safeName = s.name.replace(/'/g, "\\'");
    return `<div class="save-slot">
      <div class="save-slot-info">
        <div class="save-slot-name">${displayName}</div>
        <div class="save-slot-date">${date}</div>
      </div>
      <div class="save-slot-actions">
        <button class="btn-sm" onclick="loadGameFromFile('${safeName}')">Load</button>
        <button class="btn-delete-save" title="Delete" onclick="deleteSaveSlot('${safeName}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function activeScriptEditorId() {
  return scriptActiveTab === 'auto' ? 'script-auto-editor' : 'script-manual-editor';
}

async function saveScript() {
  const content = document.getElementById(activeScriptEditorId())?.value ?? '';
  if (window.fileAPI) {
    await window.fileAPI.saveScript(content);
  } else {
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'script.fscript'; a.click();
  }
}

async function importScript() {
  const edId = activeScriptEditorId();
  if (window.fileAPI) {
    const content = await window.fileAPI.importScript();
    if (content != null) {
      const el = document.getElementById(edId);
      if (el) el.value = content;
    }
  } else {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.fscript,.txt';
    input.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      const el = document.getElementById(edId);
      if (el) el.value = await file.text();
    };
    input.click();
  }
}

function updateSaveFilenameDisplay() {
  const el = document.getElementById('save-filename');
  if (el) el.textContent = currentSaveFile ? currentSaveFile.replace(/\.json$/, '') : '';
}

// ── Group Helpers ─────────────────────────────────────────────

function groupKey(b) {
  if (b.type === 'miner')           return `miner:${b.resource}`;
  if (b.type === 'electricMiner')   return `electricMiner:${b.resource}`;
  if (b.type === 'furnace')         return `furnace:${b.recipe}`;
  if (b.type === 'steelFurnace')    return `steelFurnace:${b.recipe}`;
  if (b.type === 'electricFurnace') return `electricFurnace:${b.recipe}`;
  if (b.type === 'assembly')        return `assembly:${b.recipe}`;
  if (b.type === 'assembly2')       return `assembly2:${b.recipe}`;
  if (b.type === 'assembly3')       return `assembly3:${b.recipe}`;
  if (b.type === 'oilRefinery')     return `oilRefinery:${b.recipe}`;
  if (b.type === 'chemicalPlant')   return `chemicalPlant:${b.recipe}`;
  if (b.type === 'centrifuge')      return `centrifuge:${b.recipe}`;
  if (b.type === 'rocketSilo')      return `rocketSilo:${b.recipe}`;
  if (b.type === 'pumpjack')        return `pumpjack:${b.resource}`;
  return b.type;
}

function keyOutputsBuilding(key) {
  const parts = key.split(':');
  if (parts.length < 2) return false;
  const recipeKey = parts.slice(1).join(':');
  const recipe = (typeof PLAYER_RECIPES !== 'undefined' && PLAYER_RECIPES[recipeKey])
              ?? (typeof FURNACE_RECIPES !== 'undefined' && FURNACE_RECIPES[recipeKey]);
  if (!recipe) return false;
  return Object.keys(recipe.outputs).some(k => BUILDING_ITEM_KEYS.has(k));
}

function getGS(key) {
  if (!state.groupSettings[key]) {
    const isBuilding = keyOutputsBuilding(key);
    const defLimit = isBuilding
      ? (state.settings?.defaultLimitBuilding ?? 10)
      : (state.settings?.defaultLimitOther    ?? Infinity);
    state.groupSettings[key] = { enabled: true, coalAcc: 0, starved: false, limit: defLimit, radarAcc: 0, packAcc: 0 };
  }
  const gs = state.groupSettings[key];
  if (gs.limit    == null) gs.limit    = Infinity;
  if (gs.radarAcc == null) gs.radarAcc = 0;
  if (gs.packAcc  == null) gs.packAcc  = 0;
  if (gs.modules  == null) gs.modules  = {};
  if (gs.progress == null) gs.progress = 0;
  if (gs.prodFrac == null) gs.prodFrac = {};
  if (gs.active   == null) gs.active   = false;
  if (!gs.selectedModuleType) gs.selectedModuleType = 'speedMk1';
  return gs;
}

function buildGroupMap() {
  const groups = {};
  for (const b of state.buildings) {
    const k = groupKey(b);
    if (!groups[k]) groups[k] = { key: k, type: b.type, resource: b.resource, recipe: b.recipe, buildings: [] };
    groups[k].buildings.push(b);
  }
  return groups;
}

// ── Inventory Helpers ─────────────────────────────────────────

function canAfford(inputs) {
  return Object.entries(inputs).every(([k, v]) => (state.inventory[k] ?? 0) >= v);
}

function spend(inputs) {
  for (const [k, v] of Object.entries(inputs)) state.inventory[k] -= v;
}

function howManyCanAfford(inputs, maxCycles) {
  let n = maxCycles;
  for (const [item, amt] of Object.entries(inputs)) {
    if (amt <= 0) continue;
    n = Math.min(n, Math.floor((state.inventory[item] ?? 0) / amt));
  }
  return Math.max(0, n);
}

function metaEnergyMult(type) {
  if (!state?.settings?.metaProgEnabled) return 1;
  const pts = metaState?.buildingUpgrades?.[type] ?? 0;
  return Math.max(0.1, 1 - pts * 0.25);
}

function getGamerModuleSpeedBonus() {
  const pts = metaState?.gamerModule?.speedPoints ?? 0;
  return pts * 0.05;
}

function getGamerModuleProdBonus() {
  const pts = metaState?.gamerModule?.prodPoints ?? 0;
  return pts * 0.02;
}

function calcGroupModifiers(type, buildingCount, modules) {
  const slotsPerBuilding = MODULE_SLOTS[type] ?? 0;
  if (buildingCount === 0) return { speedMult: 1, prodBonus: 0 };
  const totalSlots = buildingCount * slotsPerBuilding;
  let speedBonus = 0, prodBonus = 0, usedSlots = 0;
  if (slotsPerBuilding > 0) {
    for (const [mtype, cnt] of Object.entries(modules ?? {})) {
      if (!cnt || cnt <= 0) continue;
      if (mtype === 'gamerModule') continue; // handled separately below
      const mod = MODULE_DATA[mtype];
      if (!mod) continue;
      const actual = Math.min(cnt, totalSlots - usedSlots);
      usedSlots += actual;
      const perBuilding = actual / buildingCount;
      speedBonus += perBuilding * ((mod.speedBonus ?? 0) + (mod.speedPenalty ?? 0));
      prodBonus  += perBuilding * (mod.prodBonus ?? 0);
    }
    // Gamer module bonus
    const gamerCount = modules?.gamerModule ?? 0;
    if (gamerCount > 0) {
      const gamerSpeedPerSlot = getGamerModuleSpeedBonus() / Math.max(1, slotsPerBuilding);
      const gamerProdPerSlot  = getGamerModuleProdBonus()  / Math.max(1, slotsPerBuilding);
      const actual = Math.min(gamerCount, totalSlots - usedSlots);
      speedBonus += (actual / buildingCount) * gamerSpeedPerSlot;
      prodBonus  += (actual / buildingCount) * gamerProdPerSlot;
    }
  }
  // Meta building upgrade speed bonus
  const metaUpgrade = (metaState?.buildingUpgrades?.[type] ?? 0);
  const metaSpeedBonus = state?.settings?.metaProgEnabled ? metaUpgrade * 0.25 : 0;
  return { speedMult: Math.max(0.2, 1 + speedBonus + metaSpeedBonus), prodBonus };
}

// ── Tech Helpers ──────────────────────────────────────────────

function isUnlocked(type, key) {
  for (const [, tech] of Object.entries(TECHNOLOGIES)) {
    const list = type === 'recipe' ? tech.unlockRecipes : tech.unlockBuildings;
    if (list.includes(key)) {
      return Object.entries(TECHNOLOGIES).some(([tk, t]) =>
        (t.unlockRecipes.includes(key) || t.unlockBuildings.includes(key)) &&
        state.research.done[tk]
      );
    }
  }
  return true;
}

// ── Research Actions ──────────────────────────────────────────

function canResearchTech(key, includeQueue = false) {
  const tech = TECHNOLOGIES[key];
  if (!tech || !tech.prereqs || tech.prereqs.length === 0) return true;
  const queue = state.research.queue ?? [];
  return tech.prereqs.every(p =>
    state.research.done[p] ||
    (includeQueue && (state.research.current === p || queue.includes(p)))
  );
}

function startResearch(key) {
  if (state.research.done[key]) return;
  const queue = state.research.queue ?? (state.research.queue = []);

  // Already queued or currently active — dequeue it (toggle off)
  if (state.research.current === key) {
    cancelResearch();
    return;
  }
  if (queue.includes(key)) {
    state.research.queue = queue.filter(k => k !== key);
    renderResearch();
    return;
  }

  if (!canResearchTech(key, true)) {
    const tech = TECHNOLOGIES[key];
    const missing = (tech?.prereqs ?? [])
      .filter(p => !state.research.done[p] && state.research.current !== p && !queue.includes(p))
      .map(p => TECHNOLOGIES[p]?.name ?? p)
      .join(', ');
    notify(`Prerequisites required: ${missing}`, 'warning');
    return;
  }

  // If nothing is active, start immediately (resume saved progress if same tech)
  if (!state.research.current) {
    state.research.current = key;
    if (state.research.savedKey === key) {
      state.research.totalConsumed = state.research.savedProgress ?? 0;
    } else {
      state.research.totalConsumed = 0;
    }
    const gs = getGS('lab');
    gs.packAcc = 0;
    gs.starved = false;
    renderResearch();
    return;
  }

  // Something is active — add to queue
  queue.push(key);
  renderResearch();
}

function cancelResearch() {
  if (state.research.current) {
    state.research.savedKey      = state.research.current;
    state.research.savedProgress = state.research.totalConsumed;
  }
  state.research.current      = null;
  state.research.totalConsumed = 0;
  state.research.queue        = [];
  getGS('lab').packAcc = 0;
  renderResearch();
}

function completeResearch(key) {
  state.research.done[key] = true;
  state.research.current = null;
  state.research.totalConsumed = 0;
  getGS('lab').packAcc = 0;
  notify(`✅ Researched: ${TECHNOLOGIES[key].name}!`, 'info');
  updatePlaceButtonStates();
  renderAllPlacementPickers();
  lastTechHash = '';

  // Auto-start next item in queue (skip any that were completed as prereqs of this tech)
  const queue = state.research.queue ?? [];
  while (queue.length > 0) {
    const next = queue.shift();
    if (!state.research.done[next]) {
      state.research.current = next;
      if (state.research.savedKey === next) {
        state.research.totalConsumed = state.research.savedProgress ?? 0;
      } else {
        state.research.totalConsumed = 0;
      }
      getGS('lab').starved = false;
      notify(`🔬 Auto-started: ${TECHNOLOGIES[next]?.name ?? next}`, 'info');
      break;
    }
  }
  state.research.queue = queue;
  renderUI();
}

const INFINITE_TECH_PREREQS = {
  'robot:speed':         'robotics',
  'robot:cargo':         'robotics',
  'mining:productivity': 'electricMiningDrill',
  'gun:damage':          'gunTurret',
  'laser:damage':        'laserTurretTech',
};

function startInfiniteTech(type) {
  if (state.buildings.filter(b => b.type === 'lab').length === 0) {
    notify('Place a Lab to conduct research.', 'warning'); return;
  }
  const prereq = INFINITE_TECH_PREREQS[type];
  if (prereq && !state.research.done?.[prereq]) {
    notify(`Requires ${TECHNOLOGIES[prereq]?.name ?? prereq} research.`, 'warning'); return;
  }
  if (type === 'robot:cargo' && (state.research.robotCargoLevel ?? 0) >= 3) {
    notify('Worker Robot Cargo Size is already maxed out.', 'warning'); return;
  }
  const queue = state.research.queue ?? (state.research.queue = []);
  // Toggle off if already active
  if (state.research.current === type) { cancelResearch(); return; }
  // Toggle off if already in queue
  if (queue.includes(type)) {
    state.research.queue = queue.filter(k => k !== type);
    lastRobotTechHtml = '';
    renderResearch();
    return;
  }
  // Start immediately if nothing active, else queue
  if (!state.research.current) {
    state.research.current = type;
    state.research.totalConsumed = 0;
    const gs = getGS('lab');
    gs.packAcc = 0;
    gs.starved = false;
  } else {
    queue.push(type);
  }
  lastRobotTechHtml = '';
  renderResearch();
}

function startRobotResearch(type) { startInfiniteTech(type); }

function completeRobotResearch(type) {
  if (type === 'robot:speed') {
    state.research.robotSpeedLevel = (state.research.robotSpeedLevel ?? 0) + 1;
    notify(`✅ Worker Robot Speed Level ${state.research.robotSpeedLevel}!`, 'info');
  } else if (type === 'robot:cargo') {
    state.research.robotCargoLevel = (state.research.robotCargoLevel ?? 0) + 1;
    notify(`✅ Worker Robot Cargo Size Level ${state.research.robotCargoLevel}!`, 'info');
  } else if (type === 'mining:productivity') {
    state.research.miningProdLevel = (state.research.miningProdLevel ?? 0) + 1;
    notify(`✅ Mining Productivity Level ${state.research.miningProdLevel}! (+${(state.research.miningProdLevel * 10)}% ore yield)`, 'info');
  } else if (type === 'gun:damage') {
    state.research.gunDamageLevel = (state.research.gunDamageLevel ?? 0) + 1;
    notify(`✅ Physical Projectile Damage Level ${state.research.gunDamageLevel}! (${((gunDamageMult(state.research.gunDamageLevel) - 1) * 100).toFixed(0)}% total bonus)`, 'info');
  } else if (type === 'laser:damage') {
    state.research.laserDamageLevel = (state.research.laserDamageLevel ?? 0) + 1;
    notify(`✅ Laser Weapons Damage Level ${state.research.laserDamageLevel}! (${((laserDamageMult(state.research.laserDamageLevel) - 1) * 100).toFixed(0)}% total bonus)`, 'info');
  } else if (type === 'artillery:range') {
    state.research.artilleryRangeLevel = (state.research.artilleryRangeLevel ?? 0) + 1;
    // Sync perimeter range level with research level
    if (state.perimeter) state.perimeter.artilleryRangeLevel = state.research.artilleryRangeLevel;
    notify(`✅ Artillery Range Level ${state.research.artilleryRangeLevel}!`, 'info');
  } else if (type === 'artillery:damage') {
    state.research.artilleryDamageLevel = (state.research.artilleryDamageLevel ?? 0) + 1;
    // Sync perimeter damage level with research level
    if (state.perimeter) state.perimeter.artilleryDamageLevel = state.research.artilleryDamageLevel;
    notify(`✅ Artillery Damage Level ${state.research.artilleryDamageLevel}! (+${Math.round((artilleryDamageMult(state.research.artilleryDamageLevel) - 1) * 100)}% damage)`, 'info');
  }
  state.research.current = null;
  state.research.totalConsumed = 0;
  getGS('lab').packAcc = 0;
  lastTechHash = '';
  lastRobotTechHtml = '';

  // Auto-start next queued item (regular or infinite tech)
  const queue = state.research.queue ?? [];
  while (queue.length > 0) {
    const next = queue.shift();
    if (next.includes(':')) {
      // Infinite tech — start directly
      state.research.current = next;
      state.research.totalConsumed = 0;
      getGS('lab').starved = false;
      notify(`🔬 Auto-started: ${next}`, 'info');
      break;
    } else if (!state.research.done[next]) {
      state.research.current = next;
      if (state.research.savedKey === next) {
        state.research.totalConsumed = state.research.savedProgress ?? 0;
      } else {
        state.research.totalConsumed = 0;
      }
      getGS('lab').starved = false;
      notify(`🔬 Auto-started: ${TECHNOLOGIES[next]?.name ?? next}`, 'info');
      break;
    }
  }
  state.research.queue = queue;
  renderUI();
}

// ── Chunk Discovery ───────────────────────────────────────────

function addPatchFind(resource, amount, nodes) {
  const chunkIndex = state.chunksRevealed;
  const maxChunk   = Math.pow(state.perimeter.sideLength, 2);
  const patch      = state.patches[resource];
  if (!patch) return;
  if (!patch.pendingFinds) patch.pendingFinds = [];
  if (!state.settings.biters || chunkIndex < maxChunk) {
    patch.remaining += amount;
    patch.nodes     += nodes;
  } else {
    patch.pendingFinds.push({ remaining: amount, nodes, chunkIndex });
  }
}

function revealChunk() {
  state.chunksRevealed = (state.chunksRevealed ?? 0) + 1;
  const mult = DENSITY_MULT[state.settings.density] ?? 1.0;
  // ~15% chance to find crude oil (harvestable only with Oil Gathering tech)
  if (Math.random() < 0.15) {
    const amount = Math.floor((1000 + state.chunksRevealed * 20) * mult);
    const nodes  = Math.round((40 + Math.floor(Math.random() * 21)) * mult);
    if (!state.patches.crudeOil) state.patches.crudeOil = { remaining: 0, nodes: 0, pendingFinds: [] };
    addPatchFind('crudeOil', amount, nodes);
    const inPerim = state.chunksRevealed < Math.pow(state.perimeter.sideLength, 2);
    const techNote = state.research?.done?.oilGathering ? '' : ' (requires Oil Gathering tech to harvest)';
    notify(`🖤 Found Crude Oil field! +${amount.toLocaleString()}${inPerim ? '' : ' (outside perimeter)'}${techNote}`, 'info', { radar: true });
    return;
  }
  // ~8% chance to find uranium ore (harvestable only with Centrifuge tech)
  if (Math.random() < 0.08) {
    const amount = Math.floor((800 + state.chunksRevealed * 15) * mult);
    const nodes  = Math.round((30 + Math.floor(Math.random() * 21)) * mult);
    if (!state.patches.uraniumOre) state.patches.uraniumOre = { remaining: 0, nodes: 0, pendingFinds: [] };
    addPatchFind('uraniumOre', amount, nodes);
    const inPerim = state.chunksRevealed < Math.pow(state.perimeter.sideLength, 2);
    const techNote = state.research?.done?.centrifugeTech ? '' : ' (requires Nuclear Power tech to harvest)';
    notify(`💚 Found Uranium Ore deposit! +${amount.toLocaleString()}${inPerim ? '' : ' (outside perimeter)'}${techNote}`, 'info', { radar: true });
    return;
  }
  if (Math.random() > CHUNK_ORE_CHANCE) return;
  const roll = Math.random();
  let resource;
  if      (roll < 0.40) resource = 'ironOre';
  else if (roll < 0.70) resource = 'copperOre';
  else if (roll < 0.90) resource = 'coal';
  else                  resource = 'stone';
  const amount = Math.floor((5000 + state.chunksRevealed * 20) * mult);
  const nodes  = Math.round((55 + Math.floor(Math.random() * 36)) * mult);
  addPatchFind(resource, amount, nodes);
  const inPerim = state.chunksRevealed < Math.pow(state.perimeter.sideLength, 2);
  notify(`🗺️ Found ${PATCHES[resource].name} patch! +${amount.toLocaleString()}${inPerim ? '' : ' (outside perimeter)'}`, 'info', { radar: true });
}

function patchInPerimeter(resource) {
  const patch = state.patches[resource];
  if (!patch) return false;
  if (!state.settings.biters) {
    const total = patch.remaining + (patch.pendingFinds ?? []).reduce((s, f) => s + f.remaining, 0);
    return total > 0 || patch.nodes > 0;
  }
  return (patch.remaining > 0 || patch.nodes > 0);
}

// ── Game Loop ─────────────────────────────────────────────────

function tick() {
  const dt     = TICK_MS / 1000 * (state?.devTickSpeed ?? 1);
  const groups = buildGroupMap();

  // Snapshot inventory at start of tick — used to split deltas into gross
  // production/consumption for the production graph.
  tickPrevInv = { ...state.inventory };

  // ── Compute total power demand (uses last tick's powerKw) ──
  let totalDemand = 0;
  for (const b of state.buildings) {
    const gs = getGS(groupKey(b));
    if (!gs.enabled) continue;
    if (b.type === 'assembly')        totalDemand += ASSEMBLY_KW        * metaEnergyMult('assembly');
    if (b.type === 'assembly2')       totalDemand += ASSEMBLY2_KW       * metaEnergyMult('assembly2');
    if (b.type === 'assembly3')       totalDemand += ASSEMBLY3_KW       * metaEnergyMult('assembly3');
    if (b.type === 'electricMiner')   totalDemand += ELECTRIC_MINER_KW  * metaEnergyMult('electricMiner');
    if (b.type === 'electricFurnace') totalDemand += ELECTRIC_FURNACE_KW* metaEnergyMult('electricFurnace');
    if (b.type === 'pumpjack')        totalDemand += PUMPJACK_KW        * metaEnergyMult('pumpjack');
    if (b.type === 'oilRefinery')     totalDemand += OIL_REFINERY_KW    * metaEnergyMult('oilRefinery');
    if (b.type === 'chemicalPlant')   totalDemand += CHEMICAL_PLANT_KW  * metaEnergyMult('chemicalPlant');
    if (b.type === 'centrifuge')      totalDemand += CENTRIFUGE_KW      * metaEnergyMult('centrifuge');
    if (b.type === 'rocketSilo')      totalDemand += ROCKET_SILO_KW     * metaEnergyMult('rocketSilo');
    if (b.type === 'lab')             totalDemand += LAB_KW             * metaEnergyMult('lab');
    if (b.type === 'radar')           totalDemand += RADAR_KW;
  }
  totalDemand += (state.perimeter?.laserTurrets ?? 0) * LASER_KW_PER_TURRET;
  if (state.allPaused) totalDemand = 0;
  state.powerDemandKw = totalDemand;
  const powerRatio = totalDemand > 0 ? Math.min(1, state.powerKw / totalDemand) : 1;
  state.powerRatio = powerRatio;

  if (!state.allPaused) { // ── Production ──

  // ── Coal for miners, furnaces & steel furnaces ──
  for (const [key, group] of Object.entries(groups)) {
    if (group.type !== 'miner' && group.type !== 'furnace' && group.type !== 'steelFurnace') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.starved = true; continue; }
    const rate = group.type === 'miner' ? COAL_PER_MINER
               : group.type === 'steelFurnace' ? COAL_PER_STEEL_FURNACE
               : COAL_PER_FURNACE;
    gs.coalAcc = (gs.coalAcc ?? 0) + group.buildings.length * rate * dt;
    if (gs.coalAcc >= 1) {
      const needed = Math.floor(gs.coalAcc);
      if (state.inventory.coal >= needed) {
        state.inventory.coal -= needed; gs.coalAcc -= needed; gs.starved = false;
      } else {
        state.inventory.coal = 0; gs.coalAcc = 0; gs.starved = true;
      }
    } else { gs.starved = (state.inventory.coal <= 0); }
  }

  // ── Burner Miners ──
  for (const b of state.buildings) {
    if (b.type !== 'miner') continue;
    const gs = getGS(groupKey(b));
    if (gs.starved) continue;
    if (!patchInPerimeter(b.resource)) { gs.outsidePerimeter = true; continue; }
    gs.outsidePerimeter = false;
    if ((state.inventory[b.resource] ?? 0) >= gs.limit) continue;
    const patch = state.patches[b.resource];
    if (!patch || patch.remaining <= 0) continue;
    b.acc = (b.acc ?? 0) + MINE_SPEED * dt;
    if (b.acc >= 1) {
      const n = Math.min(Math.floor(b.acc), patch.remaining);
      state.inventory[b.resource] = (state.inventory[b.resource] ?? 0) + n * miningProdMult();
      patch.remaining -= n; b.acc -= n;
    }
  }

  // ── Electric Miners ── (aggregated per resource group)
  for (const [key, group] of Object.entries(groups)) {
    if (group.type !== 'electricMiner') continue;
    const gs = getGS(key);
    if (!gs.enabled) continue;
    gs.noPower = powerRatio < 1;
    if (!patchInPerimeter(group.resource)) { gs.outsidePerimeter = true; continue; }
    gs.outsidePerimeter = false;
    if ((state.inventory[group.resource] ?? 0) >= gs.limit) continue;
    const patch = state.patches[group.resource];
    if (!patch || patch.remaining <= 0) continue;
    const count = group.buildings.length;
    const { speedMult } = calcGroupModifiers('electricMiner', count, gs.modules);
    gs.acc = (gs.acc ?? 0) + count * ELECTRIC_MINER_SPEED * speedMult * dt * powerRatio;
    if (gs.acc >= 1) {
      let n = Math.min(Math.floor(gs.acc), patch.remaining);
      if (group.resource === 'uraniumOre') {
        n = Math.min(n, Math.floor(state.inventory.sulfuricAcid ?? 0));
        if (n <= 0) { gs.acidStarved = true; gs.acc = 0; continue; }
        state.inventory.sulfuricAcid -= n;
        gs.acidStarved = false;
      }
      const prod = group.resource === 'uraniumOre' ? 1 : miningProdMult();
      state.inventory[group.resource] = (state.inventory[group.resource] ?? 0) + n * prod;
      patch.remaining -= n; gs.acc -= n;
    }
  }

  // ── Furnaces (stone) — aggregated ──
  for (const [key, group] of Object.entries(groups)) {
    if (group.type !== 'furnace') continue;
    const gs = getGS(key);
    if (gs.starved) { gs.active = false; gs.progress = 0; continue; }
    const recipe = FURNACE_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; continue; }
    const count = group.buildings.length;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('furnace', count, gs.modules);
    gs.progress += count * speedMult / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      const inv = Math.floor(state.inventory[outputKey] ?? 0);
      if (inv >= gs.limit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = Math.min(afford, byLimit, cycles);
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) state.inventory[k] = (state.inventory[k] ?? 0) - v * actual;
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              state.inventory[k] = (state.inventory[k] ?? 0) + w;
            }
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }

  // ── Steel Furnaces — aggregated ──
  for (const [key, group] of Object.entries(groups)) {
    if (group.type !== 'steelFurnace') continue;
    const gs = getGS(key);
    if (gs.starved) { gs.active = false; gs.progress = 0; continue; }
    const recipe = FURNACE_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; continue; }
    const count = group.buildings.length;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('steelFurnace', count, gs.modules);
    gs.progress += count * speedMult * STEEL_FURNACE_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      const inv = Math.floor(state.inventory[outputKey] ?? 0);
      if (inv >= gs.limit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = Math.min(afford, byLimit, cycles);
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) state.inventory[k] = (state.inventory[k] ?? 0) - v * actual;
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              state.inventory[k] = (state.inventory[k] ?? 0) + w;
            }
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }

  // ── Assembly Machines Mk1 — aggregated ──
  for (const [key, group] of Object.entries(groups)) {
    if (group.type !== 'assembly') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.active = false; continue; }
    gs.noPower = powerRatio < 1;
    const recipe = PLAYER_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; continue; }
    const count = group.buildings.length;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('assembly', count, gs.modules);
    gs.progress += count * speedMult * powerRatio * ASSEMBLY_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      const inv = Math.floor(state.inventory[outputKey] ?? 0);
      if (inv >= gs.limit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = Math.min(afford, byLimit, cycles);
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) state.inventory[k] = (state.inventory[k] ?? 0) - v * actual;
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              state.inventory[k] = (state.inventory[k] ?? 0) + w;
            }
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }

  // ── Assembly Machines Mk2 — aggregated ──
  for (const [key, group] of Object.entries(groups)) {
    if (group.type !== 'assembly2') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.active = false; continue; }
    gs.noPower = powerRatio < 1;
    const recipe = PLAYER_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; continue; }
    const count = group.buildings.length;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('assembly2', count, gs.modules);
    gs.progress += count * speedMult * powerRatio * ASSEMBLY2_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      const inv = Math.floor(state.inventory[outputKey] ?? 0);
      if (inv >= gs.limit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = Math.min(afford, byLimit, cycles);
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) state.inventory[k] = (state.inventory[k] ?? 0) - v * actual;
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              state.inventory[k] = (state.inventory[k] ?? 0) + w;
            }
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }

  // ── Assembly Machines Mk3 — aggregated ──
  for (const [key, group] of Object.entries(groups)) {
    if (group.type !== 'assembly3') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.active = false; continue; }
    gs.noPower = powerRatio < 1;
    const recipe = PLAYER_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; continue; }
    const count = group.buildings.length;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('assembly3', count, gs.modules);
    gs.progress += count * speedMult * powerRatio * ASSEMBLY3_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      const inv = Math.floor(state.inventory[outputKey] ?? 0);
      if (inv >= gs.limit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = Math.min(afford, byLimit, cycles);
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) state.inventory[k] = (state.inventory[k] ?? 0) - v * actual;
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              state.inventory[k] = (state.inventory[k] ?? 0) + w;
            }
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }

  // ── Electric Furnaces — aggregated ──
  for (const [key, group] of Object.entries(groups)) {
    if (group.type !== 'electricFurnace') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.active = false; continue; }
    gs.noPower = powerRatio < 1;
    const recipe = FURNACE_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; continue; }
    const count = group.buildings.length;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('electricFurnace', count, gs.modules);
    gs.progress += count * speedMult * powerRatio * ELECTRIC_FURNACE_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      const inv = Math.floor(state.inventory[outputKey] ?? 0);
      if (inv >= gs.limit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = Math.min(afford, byLimit, cycles);
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) state.inventory[k] = (state.inventory[k] ?? 0) - v * actual;
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              state.inventory[k] = (state.inventory[k] ?? 0) + w;
            }
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }

  // ── Pumpjacks ──
  for (const b of state.buildings) {
    if (b.type !== 'pumpjack') continue;
    const gs = getGS(groupKey(b));
    if (!gs.enabled) continue;
    gs.noPower = powerRatio < 1;
    const patch = state.patches[b.resource];
    if (!patch || patch.remaining <= 0) { gs.starved = true; continue; }
    gs.starved = false;
    const extracted = Math.min(PUMPJACK_SPEED * dt * powerRatio, patch.remaining);
    patch.remaining -= extracted;
    state.inventory[b.resource] = (state.inventory[b.resource] ?? 0) + extracted;
  }

  // ── Oil Refineries — aggregated ──
  for (const [key, group] of Object.entries(groups)) {
    if (group.type !== 'oilRefinery') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.active = false; continue; }
    gs.noPower = powerRatio < 1;
    const recipe = PLAYER_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; continue; }
    const count = group.buildings.length;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('oilRefinery', count, gs.modules);
    gs.progress += count * speedMult * powerRatio * OIL_REFINERY_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      const inv = Math.floor(state.inventory[outputKey] ?? 0);
      if (inv >= gs.limit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = Math.min(afford, byLimit, cycles);
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) state.inventory[k] = (state.inventory[k] ?? 0) - v * actual;
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              state.inventory[k] = (state.inventory[k] ?? 0) + w;
            }
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }

  // ── Chemical Plants — aggregated ──
  for (const [key, group] of Object.entries(groups)) {
    if (group.type !== 'chemicalPlant') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.active = false; continue; }
    gs.noPower = powerRatio < 1;
    const recipe = PLAYER_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; continue; }
    const count = group.buildings.length;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('chemicalPlant', count, gs.modules);
    gs.progress += count * speedMult * powerRatio * CHEMICAL_PLANT_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      const inv = Math.floor(state.inventory[outputKey] ?? 0);
      if (inv >= gs.limit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = Math.min(afford, byLimit, cycles);
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) state.inventory[k] = (state.inventory[k] ?? 0) - v * actual;
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              state.inventory[k] = (state.inventory[k] ?? 0) + w;
            }
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }

  // ── Centrifuges — aggregated ──
  for (const [key, group] of Object.entries(groups)) {
    if (group.type !== 'centrifuge') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.active = false; continue; }
    gs.noPower = powerRatio < 1;
    const recipe = PLAYER_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; continue; }
    const count = group.buildings.length;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('centrifuge', count, gs.modules);
    gs.progress += count * speedMult * powerRatio * CENTRIFUGE_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      const inv = Math.floor(state.inventory[outputKey] ?? 0);
      if (inv >= gs.limit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = Math.min(afford, byLimit, cycles);
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) state.inventory[k] = (state.inventory[k] ?? 0) - v * actual;
            if (group.recipe === 'uraniumProcessing') {
              for (let i = 0; i < actual; i++) {
                state.uraniumProcessingCount = (state.uraniumProcessingCount ?? 0) + 1;
                if (state.uraniumProcessingCount % 143 === 0) state.inventory.uranium235 = (state.inventory.uranium235 ?? 0) + 1;
                else state.inventory.uranium238 = (state.inventory.uranium238 ?? 0) + 1;
              }
            } else {
              for (const [k, v] of Object.entries(recipe.outputs)) {
                const tot = v * actual * (1 + prodBonus);
                gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
                const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
                state.inventory[k] = (state.inventory[k] ?? 0) + w;
              }
            }
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }

  // ── Rocket Silos — aggregated ──
  for (const [key, group] of Object.entries(groups)) {
    if (group.type !== 'rocketSilo') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.active = false; continue; }
    gs.noPower = powerRatio < 1;
    const recipe = PLAYER_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; continue; }
    const count = group.buildings.length;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('rocketSilo', count, gs.modules);
    gs.progress += count * speedMult * powerRatio * ROCKET_SILO_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      const inv = Math.floor(state.inventory[outputKey] ?? 0);
      if (inv >= gs.limit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = Math.min(afford, byLimit, cycles);
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) state.inventory[k] = (state.inventory[k] ?? 0) - v * actual;
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              state.inventory[k] = (state.inventory[k] ?? 0) + w;
            }
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }

  // ── Offshore Pumps ──
  const pumpGroup = groups['offshoreP'];
  if (pumpGroup) {
    const gs = getGS('offshoreP');
    if (gs.enabled) { state.water = Math.min(WATER_MAX, state.water + pumpGroup.buildings.length * 1200 * dt); gs.starved = false; }
    else gs.starved = true;
  }

  // ── Boilers ──
  const boilerGroup = groups['boiler'];
  if (boilerGroup) {
    const gs = getGS('boiler');
    const count = boilerGroup.buildings.length;
    if (gs.enabled) {
      gs.coalAcc = (gs.coalAcc ?? 0) + count * 0.45 * dt;
      let coalOk = true;
      if (gs.coalAcc >= 1) {
        const needed = Math.floor(gs.coalAcc);
        if (state.inventory.coal >= needed) { state.inventory.coal -= needed; gs.coalAcc -= needed; }
        else { state.inventory.coal = 0; gs.coalAcc = 0; coalOk = false; }
      }
      const waterNeeded = count * 6 * dt;
      const waterOk = state.water >= waterNeeded;
      if (coalOk && waterOk) {
        state.water -= waterNeeded;
        state.steam = Math.min(STEAM_MAX, state.steam + count * 60 * dt);
        gs.starved = false; gs.noWater = false;
      } else { gs.starved = true; gs.noWater = !waterOk; }
    } else { gs.starved = true; }
  }

  // ── Power generation: Solar → Nuclear → Steam (fills gap) → Accumulators ──
  state.powerKw = 0;

  // Solar (unconditional, no fuel cost)
  const solarGroup = groups['solarPanel'];
  if (solarGroup) {
    const gs = getGS('solarPanel');
    if (gs.enabled) state.powerKw += solarGroup.buildings.length * SOLAR_PANEL_KW;
  }

  // Nuclear (fuel-gated)
  const nuclearGroup = groups['nuclearReactor'];
  if (nuclearGroup) {
    const gs    = getGS('nuclearReactor');
    const count = nuclearGroup.buildings.length;
    if (gs.enabled) {
      gs.fuelAcc = (gs.fuelAcc ?? 0) + count * dt / NUCLEAR_FUEL_INTERVAL;
      let fuelOk = true;
      if (gs.fuelAcc >= 1) {
        const needed = Math.floor(gs.fuelAcc);
        if ((state.inventory.uraniumFuelCell ?? 0) >= needed) {
          state.inventory.uraniumFuelCell -= needed;
          gs.fuelAcc -= needed;
        } else {
          gs.fuelAcc = 0;
          fuelOk = false;
        }
      }
      if (fuelOk) { state.powerKw += count * NUCLEAR_REACTOR_KW; gs.starved = false; }
      else { gs.starved = true; }
    } else { gs.starved = true; }
  }

  // Steam engines: only produce what solar+nuclear didn't already cover
  const engineGroup = groups['steamEngine'];
  if (engineGroup) {
    const gs        = getGS('steamEngine');
    const count     = engineGroup.buildings.length;
    const maxKw     = count * 900;
    const shortfall = Math.max(0, totalDemand - state.powerKw);
    if (!gs.enabled) {
      gs.starved = false; gs.standby = false;
    } else if (shortfall === 0) {
      // Solar/nuclear already meets all demand — engines idle, no steam consumed
      gs.starved = false; gs.standby = true;
    } else if (state.steam <= 0) {
      gs.starved = true; gs.standby = false;
    } else {
      gs.standby = false;
      const fraction      = Math.min(1, shortfall / maxKw);
      const steamToUse    = fraction * count * 30 * dt;
      if (state.steam >= steamToUse) {
        state.steam    -= steamToUse;
        state.powerKw  += fraction * maxKw;
      } else {
        const partFrac  = state.steam / (count * 30 * dt);
        state.powerKw  += partFrac * maxKw;
        state.steam     = 0;
      }
      gs.starved = false;
    }
  } else {
    // No steam engines — powerKw stays as solar+nuclear
  }

  // Accumulators: discharge deficit, charge surplus
  const accGroup = groups['accumulator'];
  if (accGroup) {
    const gs = getGS('accumulator');
    const count = accGroup.buildings.length;
    const maxCharge = count * ACCUMULATOR_CAPACITY;
    if (gs.enabled) {
      const excess = state.powerKw - totalDemand;
      if (excess > 0 && (state.accumulatorCharge ?? 0) < maxCharge) {
        state.accumulatorCharge = Math.min(maxCharge, (state.accumulatorCharge ?? 0) + excess * dt);
      } else if (excess < 0 && (state.accumulatorCharge ?? 0) > 0) {
        const discharge = Math.min(-excess * dt, state.accumulatorCharge ?? 0);
        state.accumulatorCharge -= discharge;
        state.powerKw += discharge / dt;
      }
    }
  }

  // ── Radar ──
  const radarGroup = groups['radar'];
  if (radarGroup) {
    const gs = getGS('radar');
    if (gs.enabled) {
      gs.radarAcc = (gs.radarAcc ?? 0) + radarGroup.buildings.length * dt;
      while (gs.radarAcc >= RADAR_CHUNK_TIME) { gs.radarAcc -= RADAR_CHUNK_TIME; revealChunk(); }
    }
  }

  // ── Labs ──
  const labGroup = groups['lab'];
  if (labGroup && state.research.current) {
    const gs    = getGS('lab');
    const count = labGroup.buildings.length;
    const isInfiniteTech = state.research.current.includes(':');
    const techData = isInfiniteTech ? currentRobotTechData() : (() => {
      const t = TECHNOLOGIES[state.research.current];
      return t ? { cost: t.cost, timePerPack: t.timePerPack, totalNeeded: Math.max(...Object.values(t.cost)) } : null;
    })();
    if (gs.enabled && techData) {
      const { speedMult: labSpeedMult } = calcGroupModifiers('lab', count, gs.modules);
      gs.packAcc = (gs.packAcc ?? 0) + count * labSpeedMult * dt / techData.timePerPack;
      while (gs.packAcc >= 1) {
        const free = state.devFreeResearch && state.devMode;
        const hasAllPacks = free || Object.keys(techData.cost).every(pk => (state.inventory[pk] ?? 0) >= 1);
        if (hasAllPacks) {
          if (!free) for (const pk of Object.keys(techData.cost)) state.inventory[pk]--;
          state.research.totalConsumed++;
          gs.packAcc--;
          gs.starved = false;
          if (state.research.totalConsumed >= techData.totalNeeded) {
            if (isInfiniteTech) completeRobotResearch(state.research.current);
            else completeResearch(state.research.current);
            break;
          }
        } else { gs.packAcc = 0; gs.starved = true; break; }
      }
    }
  }

  // ── Hand Crafting (unified queue) ──
  if (!state.craftActive && state.craftQueue.length > 0) {
    const { key } = state.craftQueue[0];
    const recipe = PLAYER_RECIPES[key];
    if (recipe && canAfford(recipe.inputs)) {
      spend(recipe.inputs);
      state.craftActive = { key, progress: 0 };
      state.craftQueue.shift();
    }
  }
  if (state.craftActive) {
    const recipe = PLAYER_RECIPES[state.craftActive.key];
    if (recipe) {
      state.craftActive.progress += dt / recipe.time;
      if (state.craftActive.progress >= 1) {
        for (const [item, amt] of Object.entries(recipe.outputs))
          state.inventory[item] = (state.inventory[item] ?? 0) + amt;
        state.craftActive = null;
      }
    } else {
      state.craftActive = null;
    }
  }

  } // end if (!state.allPaused)

  // ── Mark seen items ──
  for (const [k, v] of Object.entries(state.inventory)) {
    if (v > 0) state.seen[k] = true;
  }

  // ── Per-tick gross production / consumption tracking ──
  // Compare current inventory to the snapshot taken at start of tick.
  // Positive deltas accumulate as gross production, negative as consumption.
  if (tickPrevInv) {
    const allKeys = new Set([...Object.keys(state.inventory), ...Object.keys(tickPrevInv)]);
    for (const k of allKeys) {
      const d = (state.inventory[k] ?? 0) - (tickPrevInv[k] ?? 0);
      if (d > 0) prodAccum[k] = (prodAccum[k] ?? 0) + d;
      else if (d < 0) consAccum[k] = (consAccum[k] ?? 0) + (-d);
    }
  }

  // ── Inventory delta tracking ──
  snapshotTimer += dt;
  if (snapshotTimer >= 1.0) {
    const snap = { ...state.inventory };
    if (inventorySnapshot) {
      state.inventoryDelta = {};
      for (const k of Object.keys(state.inventory))
        state.inventoryDelta[k] = ((snap[k] ?? 0) - (inventorySnapshot[k] ?? 0)) / snapshotTimer;
      // Collect production history samples (net + gross production + gross consumption)
      if (!state.productionHistory) state.productionHistory = { samples: [], prodSamples: [], consSamples: [] };
      if (!state.productionHistory.prodSamples) state.productionHistory.prodSamples = [];
      if (!state.productionHistory.consSamples) state.productionHistory.consSamples = [];

      const netSample  = { ...state.inventoryDelta };
      const prodSample = {};
      const consSample = {};
      for (const k of Object.keys(prodAccum)) prodSample[k] = prodAccum[k] / snapshotTimer;
      for (const k of Object.keys(consAccum)) consSample[k] = consAccum[k] / snapshotTimer;

      state.productionHistory.samples.push(netSample);
      state.productionHistory.prodSamples.push(prodSample);
      state.productionHistory.consSamples.push(consSample);
      if (state.productionHistory.samples.length     > 120) state.productionHistory.samples.shift();
      if (state.productionHistory.prodSamples.length > 120) state.productionHistory.prodSamples.shift();
      if (state.productionHistory.consSamples.length > 120) state.productionHistory.consSamples.shift();

      // Reset gross accumulators for the next window
      prodAccum = {};
      consAccum = {};
    }
    inventorySnapshot = snap;
    snapshotTimer = 0;
  }

  // ── Auto-run script ──
  if (scriptAutoRun) {
    scriptAutoTimer += dt;
    if (scriptAutoTimer >= SCRIPT_AUTO_INTERVAL) {
      scriptAutoTimer = 0;
      runAutoScript();
    }
  }

  // ── Biters ──
  if (state.settings.biters) {
    state.biterTimer += dt;
    if (state.biterTimer >= biterInterval()) {
      state.biterTimer = 0;
      fightBiterWave();
    }
  }

  renderUI();
}

// ── Placement Queue ───────────────────────────────────────────

function drillCountForResource(resource) {
  const placed = state.buildings.filter(b =>
    (b.type === 'miner' || b.type === 'electricMiner') && b.resource === resource
  ).length;
  const queued = placeQueue.filter(b =>
    (b.type === 'miner' || b.type === 'electricMiner') && b.resource === resource
  ).length;
  return placed + queued;
}

function maxDrillsForResource(resource) {
  return state.patches[resource]?.nodes ?? 0;
}

function placeBuilding(type, triggerEl) {
  if (!isUnlocked('building', type)) { notify(`Research required to place this building.`, 'warning'); return; }

  const countEl = triggerEl?.closest('.place-row')?.querySelector('.place-count');
  const count = Math.max(1, parseInt(countEl?.value ?? '1') || 1);

  const names = {
    miner: 'Burner Miner', furnace: 'Stone Furnace', offshoreP: 'Offshore Pump',
    boiler: 'Boiler', steamEngine: 'Steam Engine', assembly: 'Assembly Machine',
    radar: 'Radar', lab: 'Lab', electricMiner: 'Electric Mining Drill',
    steelFurnace: 'Steel Furnace', assembly2: 'Assembly Machine Mk2',
    solarPanel: 'Solar Panel', accumulator: 'Accumulator',
    pumpjack: 'Pumpjack', oilRefinery: 'Oil Refinery', chemicalPlant: 'Chemical Plant',
    electricFurnace: 'Electric Furnace', assembly3: 'Assembly Machine Mk3',
    centrifuge: 'Centrifuge', rocketSilo: 'Rocket Silo', nuclearReactor: 'Nuclear Reactor',
  };

  const pr = state.placementRecipes ?? defaultPlacementRecipes();
  const costs = BUILDING_COSTS[type];
  let placed = 0;

  for (let i = 0; i < count; i++) {
    if (!canAfford(costs)) {
      if (i === 0) notify(`Need ${COST_LABEL[type]} — craft it first`, 'warning');
      break;
    }

    let target;
    if (type === 'miner') {
      const resource = pr.miner ?? 'ironOre';
      const maxNodes = maxDrillsForResource(resource);
      if (drillCountForResource(resource) >= maxNodes) {
        if (i === 0) notify(`Patch has ${maxNodes} nodes — max drills reached for ${PATCHES[resource]?.name ?? resource}`, 'warning');
        break;
      }
      spend(costs);
      target = { type, resource, acc: 0 };
    } else if (type === 'electricMiner') {
      const resource = pr.electricMiner ?? 'ironOre';
      const maxNodes = maxDrillsForResource(resource);
      if (drillCountForResource(resource) >= maxNodes) {
        if (i === 0) notify(`Patch has ${maxNodes} nodes — max drills reached for ${PATCHES[resource]?.name ?? resource}`, 'warning');
        break;
      }
      spend(costs);
      target = { type, resource, acc: 0 };
    } else if (type === 'pumpjack') {
      spend(costs);
      target = { type, resource: 'crudeOil', acc: 0 };
    } else if (['furnace','steelFurnace','electricFurnace','assembly','assembly2','assembly3',
                'oilRefinery','chemicalPlant','centrifuge','rocketSilo'].includes(type)) {
      spend(costs);
      target = { type, recipe: pr[type] ?? '', active: false, progress: 0 };
    } else {
      spend(costs);
      target = { type };
    }
    target.displayName = names[type] ?? type;
    placeQueue.push(target);
    placed++;
  }

  if (placed > 0) {
    updatePlacementUI();
    if (!placing) processNextPlacement();
  }
}

function processNextPlacement() {
  if (placeQueue.length === 0) {
    placing = false;
    currentPlacing = null;
    updatePlacementUI();
    return;
  }
  currentPlacing = placeQueue[0];
  placing = true;
  placeStartMs = performance.now();
  if (placeRafId) cancelAnimationFrame(placeRafId);
  tickPlacement();
}

function tickPlacement() {
  const { time: placeTimeSec, batch: placeBatch } = computePlaceTimeSec();
  const pct = Math.min((performance.now() - placeStartMs) / (placeTimeSec * 1000), 1);
  document.getElementById('place-progress').style.width = (pct * 100) + '%';
  updatePlacementUI(placeBatch);
  if (pct >= 1) {
    const toPlace = Math.min(placeBatch, placeQueue.length);
    for (let i = 0; i < toPlace; i++) {
      state.buildings.push({ ...placeQueue[0], id: state.nextId++ });
      placeQueue.shift();
    }
    processNextPlacement();
  } else {
    placeRafId = requestAnimationFrame(tickPlacement);
  }
}

function updatePlacementUI(placeBatch) {
  const label = document.getElementById('placement-label');
  const queueInfo = document.getElementById('place-queue-info');
  if (placing && currentPlacing) {
    const batch = placeBatch ?? computePlaceTimeSec().batch;
    const batchStr = batch > 1 ? ` ×${batch}` : '';
    label.textContent = `Placing ${currentPlacing.displayName}${batchStr}…`;
    if (queueInfo) queueInfo.textContent = placeQueue.length > 1 ? `+${placeQueue.length - 1} queued` : '';
  } else {
    label.textContent = 'Build Queue';
    document.getElementById('place-progress').style.width = '0%';
    if (queueInfo) queueInfo.textContent = 'empty';
  }
}

// ── Manual Mining ─────────────────────────────────────────────

function manualMine(resource) {
  if (miningCooldowns[resource]) return;
  if (!patchInPerimeter(resource)) { notify('Resource patch is outside your perimeter.', 'warning'); return; }
  const patch = state.patches[resource];
  if (!patch || patch.remaining <= 0) return;
  state.inventory[resource]++;
  patch.remaining--;
  miningCooldowns[resource] = true;
  setTimeout(() => { delete miningCooldowns[resource]; renderMining(); }, 500);
  renderInventory();
}

// ── Crafting Actions ──────────────────────────────────────────

function queueCraft(key, shiftHeld) {
  const n = shiftHeld ? 5 : 1;
  for (let i = 0; i < n; i++) state.craftQueue.push({ key });
  renderCrafting();
}

function cancelCraftQueue(key) {
  if (state.craftActive?.key === key) {
    const recipe = PLAYER_RECIPES[key];
    if (recipe) {
      for (const [item, amt] of Object.entries(recipe.inputs))
        state.inventory[item] = (state.inventory[item] ?? 0) + amt;
    }
    state.craftActive = null;
  }
  state.craftQueue = state.craftQueue.filter(e => e.key !== key);
  renderCrafting();
}

// ── Building Actions ──────────────────────────────────────────

function toggleGroup(key) {
  const gs = getGS(key);
  gs.enabled = !gs.enabled; gs.coalAcc = 0; gs.starved = !gs.enabled;
  renderBuildings();
}

function removeOneFromGroup(key) {
  const groups = buildGroupMap();
  const group  = groups[key];
  if (!group || group.buildings.length === 0) return;
  state.buildings = state.buildings.filter(b => b.id !== group.buildings[group.buildings.length - 1].id);
  if (!state.buildings.some(b => groupKey(b) === key)) delete state.groupSettings[key];
  renderBuildings();
}

function changeGroupRecipe(oldKey, recipe, type) {
  const newKey = `${type}:${recipe}`;
  for (const b of state.buildings) {
    if (groupKey(b) === oldKey) { b.recipe = recipe; b.active = false; b.progress = 0; }
  }
  if (oldKey !== newKey) {
    state.groupSettings[newKey] = state.groupSettings[oldKey]
      ?? { enabled: true, coalAcc: 0, starved: false, limit: 50, radarAcc: 0, packAcc: 0 };
    delete state.groupSettings[oldKey];
  }
  renderBuildings();
}

function setGroupLimit(key, rawValue) {
  const s = String(rawValue).trim().toLowerCase();
  const v = (s === '' || s === 'inf' || s === 'infinity' || s === '∞')
    ? Infinity
    : parseFloat(s);
  getGS(key).limit = isNaN(v) ? 50 : Math.max(0, v);
}

// ── Rendering ─────────────────────────────────────────────────

function renderDevPanel() {
  const el = document.getElementById('dev-panel');
  if (!el) return;
  if (!state.devMode) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const speed = state.devTickSpeed ?? 1;
  const speeds = [1, 2, 5, 10, 25];
  el.innerHTML = `<span class="dev-label">DEV MODE</span>` +
    `<label class="dev-toggle-label"><input type="checkbox" onchange="toggleDevFreeResearch(this.checked)" ${state.devFreeResearch ? 'checked' : ''}> Free Research</label>` +
    `<span class="dev-speed-label">Speed:</span>` +
    speeds.map(s => `<button class="dev-speed-btn${speed === s ? ' active' : ''}" onclick="setDevTickSpeed(${s})">${s}x</button>`).join('') +
    `<button class="dev-close-btn" onclick="toggleDevMode(false)">✕</button>`;
}

function toggleDevMode(on) {
  state.devMode = on != null ? !!on : !state.devMode;
  renderDevPanel();
}

function toggleDevFreeResearch(checked) {
  state.devFreeResearch = !!checked;
}

function setDevTickSpeed(n) {
  state.devTickSpeed = n;
  renderDevPanel();
}

function renderUI() {
  renderPower();
  renderBiterIndicator();
  renderStarredBar();
  renderDevPanel();
  updatePlaceButtonStates();
  const active = document.querySelector('.tab-panel:not(.hidden)');
  if (!active) return;
  if (active.id === 'tab-inventory') renderInventory();
  if (active.id === 'tab-mining')    renderMining();
  if (active.id === 'tab-crafting')  renderCrafting();
  if (active.id === 'tab-buildings') renderBuildings();
  if (active.id === 'tab-research')  renderResearch();
  if (active.id === 'tab-recipes')   renderRecipes();
  if (active.id === 'tab-script')    renderScript();
  if (active.id === 'tab-settings')  renderSettings();
  if (active.id === 'tab-defense')   renderPerimeter();
  if (active.id === 'tab-meta')      renderMetaProgression();
  if (active.id === 'tab-graph')     { renderGraph(); renderGraphLegend(); }
}

function renderInventory() {
  if (mouseHeld) return;
  const container = document.getElementById('inventory-list');
  if (!container) return;
  const q = (document.getElementById('inventory-search')?.value ?? '').trim().toLowerCase();
  const entries = Object.entries(state.inventory).filter(([k, v]) => {
    if (!ALWAYS_SHOW.has(k) && !state.seen?.[k]) return false;
    if (q && !(ITEMS[k]?.name ?? k).toLowerCase().includes(q)) return false;
    return true;
  });
  const starred = state.starredItems ?? [];
  const html = entries.map(([k, amt]) => {
    const item = ITEMS[k];
    const isStarred = starred.includes(k);
    return `<div class="inv-item ${amt > 0 ? 'has-items' : ''}">
      <button class="star-btn ${isStarred ? 'starred' : ''}" data-star="${k}">★</button>
      <span class="inv-icon">${itemIcon(k)}</span>
      <span class="inv-name">${item.name}</span>
      <span class="inv-count">${Math.floor(amt)}</span>
    </div>`;
  }).join('') || '<p class="empty-msg">No items match your search.</p>';
  if (html === lastInventoryHtml) return;
  lastInventoryHtml = html;
  container.innerHTML = html;
}

function renderPower() {
  const waterPct = (state.water / WATER_MAX * 100).toFixed(1);
  const steamPct = (state.steam / STEAM_MAX * 100).toFixed(1);
  const pw     = Math.floor(state.powerKw);
  const demand = Math.floor(state.powerDemandKw ?? 0);
  const pClass = pw >= demand && pw > 0 ? 'power-on' : demand > 0 && pw < demand ? 'power-warn' : '';
  const pwText = demand > 0
    ? `${pw.toLocaleString()} kW gen · ${demand.toLocaleString()} kW use`
    : `${pw.toLocaleString()} kW`;

  const accCount  = state.buildings.filter(b => b.type === 'accumulator').length;
  const accMax    = accCount * ACCUMULATOR_CAPACITY;
  const accCharge = state.accumulatorCharge ?? 0;
  const accPct    = accMax > 0 ? (accCharge / accMax * 100).toFixed(1) : '0';
  const accLine   = accCount > 0 ? `
    <div class="fluid-sep">·</div>
    <div class="fluid-cell">
      <span class="fluid-icon">🔋</span>
      <div class="fluid-track"><div class="fluid-fill acc-fill" style="width:${accPct}%"></div></div>
      <span class="fluid-val">${Math.floor(accCharge / 1000).toLocaleString()} / ${(accMax / 1000).toLocaleString()} MJ</span>
    </div>` : '';

  document.getElementById('power-bar').innerHTML = `
    <div class="fluid-cell">
      <span class="fluid-icon">💧</span>
      <div class="fluid-track"><div class="fluid-fill water-fill" style="width:${waterPct}%"></div></div>
      <span class="fluid-val">${Math.floor(state.water).toLocaleString()} / 25k</span>
    </div>
    <div class="fluid-sep">·</div>
    <div class="fluid-cell">
      <span class="fluid-icon">♨️</span>
      <div class="fluid-track"><div class="fluid-fill steam-fill" style="width:${steamPct}%"></div></div>
      <span class="fluid-val">${Math.floor(state.steam).toLocaleString()} / 25k</span>
    </div>
    <div class="fluid-sep">·</div>
    <div class="fluid-cell power-cell">
      <span class="fluid-icon">⚡</span>
      <span class="fluid-val ${pClass}">${pwText}</span>
    </div>${accLine}`;
}

function renderMining() {
  if (mouseHeld) return;
  const chunks  = state.chunksRevealed ?? 0;
  const sl      = state.perimeter?.sideLength ?? 3;
  const chunkEl = document.getElementById('chunk-info');
  if (chunkEl) {
    chunkEl.textContent = chunks > 0
      ? `🗺️ ${chunks} chunks explored — radars discover new ore patches`
      : '';
    chunkEl.className = chunks > 0 ? 'chunk-info-line' : '';
  }

  const container = document.getElementById('resource-patches');

  // Rebuild cards if patch set changed (new patches discovered)
  const patchKeys = Object.keys(state.patches).filter(k => {
    const p = state.patches[k];
    return p.remaining > 0 || p.nodes > 0 || (p.pendingFinds?.length > 0);
  });
  const existingKeys = [...container.querySelectorAll('[data-patch]')].map(el => el.dataset.patch);
  if (JSON.stringify(patchKeys) !== JSON.stringify(existingKeys)) {
    container.innerHTML = patchKeys.map(key => {
      const info = PATCHES[key] ?? { name: key, icon: '🪨' };
      return `<div class="patch-card" data-patch="${key}">
        <span class="patch-icon">${info.icon}</span>
        <div class="patch-info">
          <div class="patch-name">${info.name}</div>
          <div class="patch-remaining"></div>
          <div class="patch-nodes"></div>
        </div>
        <button class="btn-mine" data-mine="${key}"></button>
      </div>`;
    }).join('');
  }

  // Targeted update — no element replacement, hover states survive
  for (const key of patchKeys) {
    const patch = state.patches[key];
    const card  = container.querySelector(`[data-patch="${key}"]`);
    if (!card) continue;
    const inPerim  = patchInPerimeter(key);
    const depleted = patch.remaining <= 0;
    const cooling  = !!miningCooldowns[key];
    const locked   = !inPerim && (patch.pendingFinds?.length > 0);
    card.classList.toggle('depleted', depleted && !locked);
    card.classList.toggle('patch-locked', locked);
    const drills    = drillCountForResource(key);
    const maxDrills = patch.nodes;
    const remText   = locked
      ? `Outside perimeter (${(patch.pendingFinds ?? []).reduce((s, f) => s + f.remaining, 0).toLocaleString()} known)`
      : `${Math.floor(patch.remaining).toLocaleString()} remaining`;
    card.querySelector('.patch-remaining').textContent = remText;
    const nodesEl = card.querySelector('.patch-nodes');
    if (nodesEl) {
      nodesEl.textContent = inPerim && maxDrills > 0 ? `${drills}/${maxDrills} drills` : '';
    }
    const btn = card.querySelector('.btn-mine');
    btn.disabled = depleted || cooling || locked;
    btn.className = `btn-mine${(depleted || cooling || locked) ? ' disabled' : ''}`;
    btn.textContent = locked ? 'Locked' : depleted ? 'Depleted' : cooling ? 'Mining…' : 'Mine';
  }
}

function renderCrafting() {
  if (mouseHeld) return;
  const container = document.getElementById('craft-recipes');
  if (!container) return;

  container.innerHTML = CRAFT_SECTIONS.map(section => {
    const cards = section.keys
      .filter(key => isUnlocked('recipe', key))
      .map(key => {
        const recipe   = PLAYER_RECIPES[key];
        if (!recipe) return '';
        const isActive = state.craftActive?.key === key;
        const queued   = state.craftQueue.filter(e => e.key === key).length;
        const total    = queued + (isActive ? 1 : 0);
        const progress = isActive ? state.craftActive.progress : 0;
        const canStart = canAfford(recipe.inputs);
        const inputStr = Object.entries(recipe.inputs).map(([k, v]) => `${v}×${ITEMS[k]?.name ?? k}`).join(' + ');
        const outKey   = Object.keys(recipe.outputs)[0];
        const outIcon  = ITEMS[outKey]?.icon ?? '';
        const outStr   = Object.entries(recipe.outputs).map(([k, v]) => `→ ${v}×${ITEMS[k]?.name ?? k}`).join(' ');

        const statusLine = isActive
          ? `<div class="craft-queue-count">Crafting… <span class="craft-q-num">${queued} queued</span></div>`
          : total > 0
          ? `<div class="craft-queue-count waiting">⏳ Waiting <span class="craft-q-num">${total} queued</span></div>`
          : `<div class="craft-queue-count waiting" style="visibility:hidden">​</div>`;

        const cancelBtn = total > 0
          ? `<button class="btn-craft-cancel" data-cancel="${key}" title="Cancel queue">✕</button>` : '';

        return `<div class="craft-card ${isActive ? 'craft-active' : ''}">
          <div class="craft-header"><span class="craft-icon">${outIcon}</span><span class="craft-name">${recipe.name}</span></div>
          <div class="craft-recipe-line">${inputStr} ${outStr} · ${recipe.time}s</div>
          ${statusLine}
          <div class="mini-bar craft-bar"><div class="mini-fill ${isActive ? 'fill-active' : ''}" style="width:${(progress * 100).toFixed(1)}%"></div></div>
          <div class="craft-actions">
            <button class="btn-craft ${!canStart ? 'cant-afford' : ''}" data-craft="${key}">
              Craft <span class="craft-shift-hint">shift:×5</span>
            </button>
            ${cancelBtn}
          </div>
        </div>`;
      }).join('');

    if (!cards.trim()) return '';
    return `<div class="craft-section-label">${section.label}</div><div class="craft-grid">${cards}</div>`;
  }).join('');
}

// ── Recipe Reference Tab ──────────────────────────────────────

function renderRecipes() {
  const container = document.getElementById('recipe-list');
  if (!container) return;
  const query = (document.getElementById('recipe-search')?.value ?? '').toLowerCase().trim();

  const MACH_LABEL = {
    assembly:    'Hand / Assembly',
    chemical:    'Chemical Plant',
    refinery:    'Oil Refinery',
    centrifuge:  'Centrifuge',
    rocket_silo: 'Rocket Silo',
  };

  // Collect all recipes into groups by machinery
  const groups = {};

  // Furnace recipes
  for (const [key, r] of Object.entries(FURNACE_RECIPES)) {
    const label = 'Furnace';
    if (!groups[label]) groups[label] = [];
    groups[label].push({ key, r, src: 'furnace' });
  }

  // Player / assembly recipes
  for (const [key, r] of Object.entries(PLAYER_RECIPES)) {
    const mach = r.machinery ?? 'assembly';
    const label = MACH_LABEL[mach] ?? 'Hand / Assembly';
    if (!groups[label]) groups[label] = [];
    groups[label].push({ key, r, src: 'player' });
  }

  const ORDER = ['Furnace', 'Hand / Assembly', 'Chemical Plant', 'Oil Refinery', 'Centrifuge', 'Rocket Silo'];

  const renderIngredient = (itemKey, amt) => {
    const icon = itemIcon(itemKey);
    const name = ITEMS[itemKey]?.name ?? itemKey;
    return `<span class="recipe-ingredient" title="${name}"><span class="recipe-ingredient-amt">${amt}×</span>${icon}</span>`;
  };

  let html = '';
  for (const label of ORDER) {
    const entries = groups[label];
    if (!entries) continue;

    const rows = entries
      .filter(({ r }) => !query || r.name.toLowerCase().includes(query))
      .map(({ key, r }) => {
        const inputs  = Object.entries(r.inputs).map(([k, v]) => renderIngredient(k, v)).join('');
        const outputs = Object.entries(r.outputs).map(([k, v]) => renderIngredient(k, v)).join('');
        const outKey  = Object.keys(r.outputs)[0];
        return `<div class="recipe-row">
          <div class="recipe-row-name">
            <span>${itemIcon(outKey)}</span>
            <span>${r.name}</span>
            <span class="recipe-time">${r.time}s</span>
          </div>
          <div class="recipe-row-io">
            <div class="recipe-io-group">${inputs}</div>
            <span class="recipe-arrow">→</span>
            <div class="recipe-io-group">${outputs}</div>
          </div>
        </div>`;
      });

    if (!rows.length) continue;
    html += `<div class="recipe-group">
      <div class="recipe-group-header">${label}</div>
      ${rows.join('')}
    </div>`;
  }

  container.innerHTML = html || '<div class="empty-msg">No recipes match your search.</div>';
}

// ── Recipe Picker Helpers ─────────────────────────────────────

function recipeOutputIcon(key, set) {
  const r = set[key];
  if (!r) return '❓';
  return itemIcon(Object.keys(r.outputs)[0]);
}

function buildCurrentRecipeDisplay(currentRecipe, recipeSet) {
  const r = recipeSet[currentRecipe];
  if (!r) return '';
  const outKey = Object.keys(r.outputs)[0];
  return `<div class="recipe-current-display"><span class="recipe-current-icon" title="${r.name}">${itemIcon(outKey)}</span><span class="recipe-current-name">${r.name}</span></div>`;
}

function renderOnePlacementPicker(ptype, host) {
  if (!host) return;
  if (!state.placementRecipes) state.placementRecipes = defaultPlacementRecipes();
  const pr = state.placementRecipes;

  let entries = [];
  if (ptype === 'miner' || ptype === 'electricMiner') {
    const ores = ['ironOre','copperOre','coal','stone'];
    entries = ores.map(k => [k, null, ITEMS[k]?.name ?? k, itemIcon(k)]);
  } else if (ptype === 'furnace' || ptype === 'steelFurnace' || ptype === 'electricFurnace') {
    entries = Object.entries(FURNACE_RECIPES)
      .filter(([k]) => isUnlocked('recipe', k))
      .map(([k, r]) => { const outKey = Object.keys(r.outputs)[0]; return [k, r, r.name, itemIcon(outKey)]; });
  } else {
    const machMap = { oilRefinery: 'refinery', chemicalPlant: 'chemical', centrifuge: 'centrifuge', rocketSilo: 'rocket_silo' };
    const machinery = machMap[ptype] ?? null;
    entries = Object.entries(PLAYER_RECIPES)
      .filter(([k, r]) => {
        if (machinery) return r.machinery === machinery;
        return !r.machinery || r.machinery === 'assembly';
      })
      .filter(([k]) => isUnlocked('recipe', k))
      .map(([k, r]) => { const outKey = Object.keys(r.outputs)[0]; return [k, r, r.name, itemIcon(outKey)]; });
  }

  // Filter by search for assembly machines
  const isAssembly = ['assembly','assembly2','assembly3'].includes(ptype);
  const search = isAssembly ? (pickerSearches[ptype] ?? '').toLowerCase() : '';
  if (search) entries = entries.filter(([, , name]) => name.toLowerCase().includes(search));

  if (!entries.length) { host.innerHTML = `<span style="font-size:.75rem;color:var(--dim)">No recipes match</span>`; return; }

  const selected = pr[ptype] ?? entries[0][0];
  if (!entries.find(([k]) => k === selected)) pr[ptype] = entries[0][0];
  const current = pr[ptype];

  const btns = entries.map(([k,,name,icon]) =>
    `<button class="recipe-icon-btn${k === current ? ' selected' : ''}" data-recipe="${k}" title="${name}">${icon}</button>`
  ).join('');
  host.innerHTML = `<div class="recipe-picker">${btns}</div>`;
}

function onPickerSearch(ptype, value) {
  pickerSearches[ptype] = value.toLowerCase();
  const host = document.querySelector(`.recipe-picker-host[data-ptype="${ptype}"]`);
  renderOnePlacementPicker(ptype, host);
}

function renderAllPlacementPickers() {
  document.querySelectorAll('.recipe-picker-host[data-ptype]').forEach(host => {
    renderOnePlacementPicker(host.dataset.ptype, host);
  });
}

// ── Building Copy ─────────────────────────────────────────────

function addBuildingFromGroup(key, count) {
  const groups = buildGroupMap();
  const group = groups[key];
  if (!group) return;
  const type = group.type;
  if (!isUnlocked('building', type)) { notify(`Research required.`, 'warning'); return; }
  const costs = BUILDING_COSTS[type] ?? {};
  let placed = 0;
  for (let i = 0; i < count; i++) {
    if (!canAfford(costs)) {
      if (i === 0) notify(`Need ${COST_LABEL[type] ?? type} — craft it first`, 'warning');
      break;
    }
    const proto = group.buildings[0];
    // Drill node cap check for miners
    if (type === 'miner' || type === 'electricMiner') {
      const resource = proto.resource;
      const maxNodes = maxDrillsForResource(resource);
      if (drillCountForResource(resource) >= maxNodes) {
        if (i === 0) notify(`Patch has ${maxNodes} nodes — max drills reached for ${PATCHES[resource]?.name ?? resource}`, 'warning');
        break;
      }
    }
    spend(costs);
    let target;
    if (proto.recipe !== undefined) {
      target = { type, recipe: proto.recipe, active: false, progress: 0 };
    } else if (proto.resource !== undefined) {
      target = { type, resource: proto.resource, acc: 0 };
    } else {
      target = { type };
    }
    target.displayName = proto.displayName ?? type;
    placeQueue.push(target);
    placed++;
  }
  if (placed > 0) { updatePlacementUI(); if (!placing) processNextPlacement(); }
}

// ── Settings ──────────────────────────────────────────────────

function setRadarNotif(val) {
  if (state) state.settings.radarNotif = val;
}

function setDefaultLimit(which, val, isInf) {
  if (!state) return;
  const limit = isInf ? Infinity : Math.max(1, parseInt(val) || 1);
  state.settings[which] = limit;
  renderSettings();
}

function renderSettings() {
  const radarEl = document.getElementById('settings-radar-notif');
  if (radarEl) radarEl.checked = state.settings.radarNotif !== false;

  const dlb = state.settings.defaultLimitBuilding ?? 10;
  const dlo = state.settings.defaultLimitOther    ?? Infinity;

  const dlbInfEl  = document.getElementById('settings-dlb-inf');
  const dlbNumEl  = document.getElementById('settings-dlb-num');
  const dloInfEl  = document.getElementById('settings-dlo-inf');
  const dloNumEl  = document.getElementById('settings-dlo-num');

  if (dlbInfEl)  dlbInfEl.checked  = dlb === Infinity;
  if (dlbNumEl) { dlbNumEl.value = dlb === Infinity ? '' : dlb; dlbNumEl.disabled = dlb === Infinity; }
  if (dloInfEl)  dloInfEl.checked  = dlo === Infinity;
  if (dloNumEl) { dloNumEl.value = dlo === Infinity ? '' : dlo; dloNumEl.disabled = dlo === Infinity; }
}

function buildingMatchesSearch(group, q) {
  if (!q) return true;
  const type = group.type.toLowerCase();
  if (type.includes(q)) return true;
  const displayName = (group.buildings[0]?.displayName ?? '').toLowerCase();
  if (displayName.includes(q)) return true;
  if (group.recipe) {
    const r = PLAYER_RECIPES[group.recipe] ?? FURNACE_RECIPES[group.recipe];
    if (r) {
      if (r.name.toLowerCase().includes(q)) return true;
      const outKey = Object.keys(r.outputs)[0];
      if ((ITEMS[outKey]?.name ?? '').toLowerCase().includes(q)) return true;
    }
  }
  if (group.resource) {
    if ((ITEMS[group.resource]?.name ?? '').toLowerCase().includes(q)) return true;
  }
  return false;
}

function getMissingInputs(recipe) {
  if (!recipe?.inputs) return null;
  const missing = Object.entries(recipe.inputs)
    .filter(([k, needed]) => (state.inventory[k] ?? 0) < needed)
    .map(([k]) => ITEMS[k]?.name ?? k);
  return missing.length ? missing : null;
}

function renderBuildings() {
  if (mouseHeld) return;
  const pauseBtn = document.getElementById('pause-all-btn');
  if (pauseBtn) {
    pauseBtn.textContent = state.allPaused ? '▶ Resume All' : '⏸ Pause All';
    pauseBtn.classList.toggle('btn-danger-sm', state.allPaused);
    pauseBtn.classList.toggle('btn-sm', true);
  }
  const focused = document.activeElement;
  if (focused && focused.closest('#active-buildings') &&
      (focused.classList.contains('limit-input') || focused.classList.contains('add-count-input') ||
       focused.classList.contains('module-type-sel'))) return;

  const container = document.getElementById('active-buildings');
  const groups    = buildGroupMap();
  const q = buildingSearchQuery.trim().toLowerCase();
  const keys = Object.keys(groups).filter(k => buildingMatchesSearch(groups[k], q));

  if (Object.keys(groups).length === 0) {
    container.innerHTML = '<p class="empty-msg">No buildings placed yet.</p>';
    return;
  }
  if (keys.length === 0) {
    container.innerHTML = '<p class="empty-msg">No buildings match your search.</p>';
    return;
  }

  container.innerHTML = keys.map(key => {
    const group = groups[key];
    const gs    = getGS(key);
    const count = group.buildings.length;
    const type  = group.type;

    if (type === 'miner' || type === 'electricMiner') {
      const speed   = type === 'miner' ? MINE_SPEED : ELECTRIC_MINER_SPEED;
      const patch   = state.patches[group.resource];
      const hasPatch = patch && patch.remaining > 0;
      const atLimit = (state.inventory[group.resource] ?? 0) >= gs.limit;
      const noPower    = type === 'electricMiner' && gs.noPower;
      const acidStarved = type === 'electricMiner' && group.resource === 'uraniumOre' && gs.acidStarved;
      const outsidePerim = gs.outsidePerimeter;
      const avgAcc  = (gs.acc ?? 0) % 1;
      const isActive = gs.enabled && !gs.starved && !acidStarved && hasPatch && !atLimit && !outsidePerim;
      const pRatio   = state.powerRatio ?? 1;
      const brownStr = noPower ? ` · ⚡ ${Math.round(pRatio * 100)}% power` : '';
      const drills   = drillCountForResource(group.resource);
      const maxNodes = maxDrillsForResource(group.resource);
      const nodesStr = maxNodes > 0 ? ` · ${drills}/${maxNodes} nodes` : '';
      const statusTxt = !gs.enabled  ? 'Disabled'
                       : outsidePerim ? '🔒 Outside perimeter'
                       : gs.starved   ? '⚡ No Coal'
                       : acidStarved  ? '⚗️ No Sulfuric Acid'
                       : atLimit      ? `⏸ Output limit (${gs.limit})`
                       : !hasPatch    ? 'Patch depleted'
                                      : `${(count * speed * pRatio).toFixed(2)}/sec${brownStr}${nodesStr}`;
      const meta = type === 'miner'
        ? `coal: ${(count * COAL_PER_MINER).toFixed(4)}/sec`
        : `${ELECTRIC_MINER_KW * count} kW`;
      const icon = type === 'miner' ? '⛏️' : '🔌';
      const label = type === 'miner'
        ? `Burner Miner — ${PATCHES[group.resource]?.name}`
        : `Electric Miner — ${PATCHES[group.resource]?.name}`;
      return buildingCard(icon, label, count, meta, statusTxt, isActive, avgAcc, key, '', true, type === 'electricMiner' ? 'electricMiner' : null);
    }

    if (type === 'furnace') {
      const activeN   = gs.active ? count : 0;
      const recipe    = FURNACE_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const avgProg   = (gs.progress ?? 0) % 1;
      const missingIn = getMissingInputs(recipe);
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const statusTxt = !gs.enabled ? 'Disabled'
                       : gs.starved  ? '⚡ No Coal'
                       : atLimit     ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Smelting (${activeN}/${count})`
                       : activeN > 0  ? `Smelting (${activeN}/${count}) · ${waitMsg}`
                                      : waitMsg;
      return buildingCard('🔥', 'Stone Furnace', count,
        `coal: ${(count * COAL_PER_FURNACE).toFixed(4)}/sec`,
        statusTxt, gs.enabled && !gs.starved && activeN > 0, avgProg, key,
        buildCurrentRecipeDisplay(group.recipe, FURNACE_RECIPES), true, 'furnace');
    }

    if (type === 'steelFurnace') {
      const activeN   = gs.active ? count : 0;
      const recipe    = FURNACE_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const avgProg   = (gs.progress ?? 0) % 1;
      const missingIn = getMissingInputs(recipe);
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const statusTxt = !gs.enabled ? 'Disabled'
                       : gs.starved  ? '⚡ No Coal'
                       : atLimit     ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Smelting (${activeN}/${count})`
                       : activeN > 0  ? `Smelting (${activeN}/${count}) · ${waitMsg}`
                                      : waitMsg;
      return buildingCard('🟧', 'Steel Furnace', count,
        `coal: ${(count * COAL_PER_STEEL_FURNACE).toFixed(4)}/sec · 2× speed`,
        statusTxt, gs.enabled && !gs.starved && activeN > 0, avgProg, key,
        buildCurrentRecipeDisplay(group.recipe, FURNACE_RECIPES), true, 'steelFurnace');
    }

    if (type === 'assembly') {
      const activeN   = gs.active ? count : 0;
      const recipe    = PLAYER_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const avgProg   = (gs.progress ?? 0) % 1;
      const missingIn = getMissingInputs(recipe);
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round((state.powerRatio ?? 1) * 100)}% power` : '';
      const statusTxt = !gs.enabled ? 'Disabled'
                       : atLimit    ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Crafting (${activeN}/${count})${brownStr}`
                       : activeN > 0  ? `Crafting (${activeN}/${count}) · ${waitMsg}${brownStr}`
                                      : `${waitMsg}${brownStr}`;
      return buildingCard('🏭', 'Assembly Machine Mk1', count,
        `${ASSEMBLY_KW * count} kW · speed ×${ASSEMBLY_SPEED}`,
        statusTxt, gs.enabled && activeN > 0, avgProg, key,
        buildCurrentRecipeDisplay(group.recipe, PLAYER_RECIPES), true, 'assembly');
    }

    if (type === 'assembly2') {
      const activeN   = gs.active ? count : 0;
      const recipe    = PLAYER_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const avgProg   = (gs.progress ?? 0) % 1;
      const missingIn = getMissingInputs(recipe);
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round((state.powerRatio ?? 1) * 100)}% power` : '';
      const statusTxt = !gs.enabled ? 'Disabled'
                       : atLimit    ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Crafting (${activeN}/${count})${brownStr}`
                       : activeN > 0  ? `Crafting (${activeN}/${count}) · ${waitMsg}${brownStr}`
                                      : `${waitMsg}${brownStr}`;
      return buildingCard('🏗️', 'Assembly Machine Mk2', count,
        `${ASSEMBLY2_KW * count} kW · speed ×${ASSEMBLY2_SPEED}`,
        statusTxt, gs.enabled && activeN > 0, avgProg, key,
        buildCurrentRecipeDisplay(group.recipe, PLAYER_RECIPES), true, 'assembly2');
    }

    if (type === 'lab') {
      const gs2 = getGS('lab');
      const res = state.research;
      let techName = null, totalNeeded = 0;
      if (res.current?.includes(':')) {
        const rd = currentRobotTechData();
        totalNeeded = rd?.totalNeeded ?? 0;
        const nameMap = {
          'robot:speed':         `Robot Speed Lvl ${(res.robotSpeedLevel ?? 0) + 1}`,
          'robot:cargo':         `Robot Cargo Lvl ${(res.robotCargoLevel ?? 0) + 1}`,
          'mining:productivity': `Mining Prod Lvl ${(res.miningProdLevel ?? 0) + 1}`,
          'gun:damage':          `Gun Damage Lvl ${(res.gunDamageLevel ?? 0) + 1}`,
          'laser:damage':        `Laser Damage Lvl ${(res.laserDamageLevel ?? 0) + 1}`,
          'artillery:range':     `Artillery Range Lvl ${(res.artilleryRangeLevel ?? 0) + 1}`,
          'artillery:damage':    `Artillery Damage Lvl ${(res.artilleryDamageLevel ?? 0) + 1}`,
        };
        techName = nameMap[res.current] ?? res.current;
      } else if (res.current) {
        const tech = TECHNOLOGIES[res.current];
        if (tech) { totalNeeded = Math.max(...Object.values(tech.cost)); techName = tech.name; }
      }
      const progress = totalNeeded > 0 ? res.totalConsumed / totalNeeded : 0;
      const statusTxt = !gs2.enabled ? 'Disabled'
                       : !res.current ? 'No research selected'
                       : gs2.starved  ? '🔴 No Science Packs'
                                      : `Researching: ${techName ?? '?'} (${res.totalConsumed}/${totalNeeded})`;
      return buildingCard('🔬', 'Lab', count, 'processes science packs',
        statusTxt, gs2.enabled && !!res.current && !gs2.starved, progress, key, '', false, 'lab');
    }

    if (type === 'offshoreP') {
      return buildingCard('💧', 'Offshore Pump', count, 'no fuel cost',
        gs.enabled ? `${(count * 1200).toLocaleString()} water/sec` : 'Disabled',
        gs.enabled, state.water / WATER_MAX, key);
    }

    if (type === 'boiler') {
      const statusTxt = !gs.enabled ? 'Disabled'
                       : gs.noWater  ? '💧 No Water'
                       : gs.starved  ? '⚡ No Coal'
                                     : `${count * 60} steam/sec`;
      return buildingCard('♨️', 'Boiler', count,
        `coal: ${(count * 0.45).toFixed(3)}/sec · water: ${count * 6}/sec`,
        statusTxt, gs.enabled && !gs.starved, state.steam / STEAM_MAX, key);
    }

    if (type === 'steamEngine') {
      const pw = Math.floor(state.powerKw).toLocaleString();
      const steamStatus = !gs.enabled ? 'Disabled'
                        : gs.standby  ? '☀️ Standby (solar/nuclear priority)'
                        : gs.starved  ? '♨️ No Steam'
                                      : `${pw} kW`;
      return buildingCard('⚡', 'Steam Engine', count,
        `${count * 30} steam/sec → ${count * 900} kW max`,
        steamStatus, gs.enabled && !gs.standby && state.steam > 0, state.steam / STEAM_MAX, key);
    }

    if (type === 'radar') {
      const progress = Math.min(1, (getGS('radar').radarAcc ?? 0) / RADAR_CHUNK_TIME);
      const chunks   = state.chunksRevealed ?? 0;
      return buildingCard('📡', 'Radar', count, 'discovers ore patches',
        !gs.enabled ? 'Disabled' : `${(count * 60 / RADAR_CHUNK_TIME).toFixed(1)} chunks/min · ${chunks} explored`,
        gs.enabled, progress, key);
    }

    if (type === 'solarPanel') {
      const solarKw = count * SOLAR_PANEL_KW;
      return buildingCard('☀️', 'Solar Panel', count, `${solarKw} kW · no fuel needed`,
        gs.enabled ? `${solarKw.toLocaleString()} kW` : 'Disabled',
        gs.enabled, 1, key);
    }

    if (type === 'accumulator') {
      const maxCharge = count * ACCUMULATOR_CAPACITY;
      const charge    = state.accumulatorCharge ?? 0;
      const pct       = maxCharge > 0 ? charge / maxCharge : 0;
      const kj        = Math.floor(charge).toLocaleString();
      const maxKj     = maxCharge.toLocaleString();
      return buildingCard('🔋', 'Accumulator', count, `${maxCharge.toLocaleString()} kJ capacity`,
        gs.enabled ? `${kj} / ${maxKj} kJ stored` : 'Disabled',
        gs.enabled, pct, key);
    }

    if (type === 'electricFurnace') {
      const activeN   = gs.active ? count : 0;
      const recipe    = FURNACE_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const avgProg   = (gs.progress ?? 0) % 1;
      const missingIn = getMissingInputs(recipe);
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round((state.powerRatio ?? 1) * 100)}% power` : '';
      const statusTxt2 = !gs.enabled ? 'Disabled'
                       : atLimit     ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Smelting (${activeN}/${count})${brownStr}`
                       : activeN > 0  ? `Smelting (${activeN}/${count}) · ${waitMsg}${brownStr}`
                                      : `${waitMsg}${brownStr}`;
      return buildingCard('⚡🔥', 'Electric Furnace', count,
        `${ELECTRIC_FURNACE_KW * count} kW · 2× speed`,
        statusTxt2, gs.enabled && activeN > 0, avgProg, key,
        buildCurrentRecipeDisplay(group.recipe, FURNACE_RECIPES), true, 'electricFurnace');
    }

    if (type === 'assembly3') {
      const activeN   = gs.active ? count : 0;
      const recipe    = PLAYER_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const avgProg   = (gs.progress ?? 0) % 1;
      const missingIn = getMissingInputs(recipe);
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round((state.powerRatio ?? 1) * 100)}% power` : '';
      const statusTxt2 = !gs.enabled ? 'Disabled'
                       : atLimit     ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Crafting (${activeN}/${count})${brownStr}`
                       : activeN > 0  ? `Crafting (${activeN}/${count}) · ${waitMsg}${brownStr}`
                                      : `${waitMsg}${brownStr}`;
      return buildingCard('🏭', 'Assembly Machine Mk3', count,
        `${ASSEMBLY3_KW * count} kW · speed ×${ASSEMBLY3_SPEED}`,
        statusTxt2, gs.enabled && activeN > 0, avgProg, key,
        buildCurrentRecipeDisplay(group.recipe, PLAYER_RECIPES), true, 'assembly3');
    }

    if (type === 'pumpjack') {
      const patch     = state.patches[group.resource] ?? state.patches['crudeOil'];
      const hasPatch  = patch && patch.remaining > 0;
      const pRatio    = state.powerRatio ?? 1;
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round(pRatio * 100)}% power` : '';
      const isActive2 = gs.enabled && hasPatch;
      const remaining = patch ? Math.floor(patch.remaining) : 0;
      const statusTxt2 = !gs.enabled ? 'Disabled'
                        : !hasPatch  ? 'Oil field depleted'
                                     : `${(count * PUMPJACK_SPEED * pRatio).toFixed(1)}/sec${brownStr}`;
      return buildingCard('🛢️', 'Pumpjack', count,
        `${PUMPJACK_KW * count} kW · ${remaining.toLocaleString()} remaining`,
        statusTxt2, isActive2, hasPatch ? 1 : 0, key, '', false, 'pumpjack');
    }

    if (type === 'oilRefinery') {
      const activeN   = gs.active ? count : 0;
      const recipe    = PLAYER_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const avgProg   = (gs.progress ?? 0) % 1;
      const missingIn = getMissingInputs(recipe);
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round((state.powerRatio ?? 1) * 100)}% power` : '';
      const statusTxt2 = !gs.enabled ? 'Disabled'
                       : atLimit     ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Processing (${activeN}/${count})${brownStr}`
                       : activeN > 0  ? `Processing (${activeN}/${count}) · ${waitMsg}${brownStr}`
                                      : `${waitMsg}${brownStr}`;
      return buildingCard('🛢️', 'Oil Refinery', count,
        `${OIL_REFINERY_KW * count} kW`,
        statusTxt2, gs.enabled && activeN > 0, avgProg, key,
        buildCurrentRecipeDisplay(group.recipe, PLAYER_RECIPES), true, 'oilRefinery');
    }

    if (type === 'chemicalPlant') {
      const activeN   = gs.active ? count : 0;
      const recipe    = PLAYER_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const avgProg   = (gs.progress ?? 0) % 1;
      const missingIn = getMissingInputs(recipe);
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round((state.powerRatio ?? 1) * 100)}% power` : '';
      const statusTxt2 = !gs.enabled ? 'Disabled'
                       : atLimit     ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Processing (${activeN}/${count})${brownStr}`
                       : activeN > 0  ? `Processing (${activeN}/${count}) · ${waitMsg}${brownStr}`
                                      : `${waitMsg}${brownStr}`;
      return buildingCard('⚗️', 'Chemical Plant', count,
        `${CHEMICAL_PLANT_KW * count} kW · speed ×${CHEMICAL_PLANT_SPEED}`,
        statusTxt2, gs.enabled && activeN > 0, avgProg, key,
        buildCurrentRecipeDisplay(group.recipe, PLAYER_RECIPES), true, 'chemicalPlant');
    }

    if (type === 'centrifuge') {
      const activeN   = gs.active ? count : 0;
      const recipe    = PLAYER_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const avgProg   = (gs.progress ?? 0) % 1;
      const missingIn = getMissingInputs(recipe);
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round((state.powerRatio ?? 1) * 100)}% power` : '';
      const statusTxt2 = !gs.enabled ? 'Disabled'
                       : atLimit     ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Processing (${activeN}/${count})${brownStr}`
                       : activeN > 0  ? `Processing (${activeN}/${count}) · ${waitMsg}${brownStr}`
                                      : `${waitMsg}${brownStr}`;
      return buildingCard('☢️', 'Centrifuge', count,
        `${CENTRIFUGE_KW * count} kW · speed ×${CENTRIFUGE_SPEED}`,
        statusTxt2, gs.enabled && activeN > 0, avgProg, key,
        buildCurrentRecipeDisplay(group.recipe, PLAYER_RECIPES), true, 'centrifuge');
    }

    if (type === 'rocketSilo') {
      const activeN   = gs.active ? count : 0;
      const recipe    = PLAYER_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const avgProg   = (gs.progress ?? 0) % 1;
      const missingIn = getMissingInputs(recipe);
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round((state.powerRatio ?? 1) * 100)}% power` : '';
      const statusTxt2 = !gs.enabled ? 'Disabled'
                       : atLimit     ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Building (${activeN}/${count})${brownStr}`
                       : activeN > 0  ? `Building (${activeN}/${count}) · ${waitMsg}${brownStr}`
                                      : `${waitMsg}${brownStr}`;
      return buildingCard('🚀', 'Rocket Silo', count,
        `${ROCKET_SILO_KW * count} kW`,
        statusTxt2, gs.enabled && activeN > 0, avgProg, key,
        buildCurrentRecipeDisplay(group.recipe, PLAYER_RECIPES), true, 'rocketSilo');
    }

    if (type === 'nuclearReactor') {
      const gs2       = getGS('nuclearReactor');
      const totalKw   = count * NUCLEAR_REACTOR_KW;
      const fuelRate  = (count / NUCLEAR_FUEL_INTERVAL).toFixed(3);
      const fuelProg  = (gs2.fuelAcc ?? 0) % 1;
      const statusTxt2 = !gs2.enabled ? 'Disabled'
                        : gs2.starved  ? '☢️ No Uranium Fuel Cells'
                                       : `${(totalKw / 1000).toFixed(2)} MW`;
      return buildingCard('⚛️', 'Nuclear Reactor', count,
        `${(totalKw / 1000).toFixed(2)} MW · ${fuelRate} fuel cells/sec`,
        statusTxt2, gs2.enabled && !gs2.starved, fuelProg, key);
    }

    return '';
  }).join('');
}

function buildModSummary(mods) {
  const parts = [];
  for (const [mtype, n] of Object.entries(mods)) {
    if (n > 0 && MODULE_DATA[mtype]) parts.push(`${MODULE_DATA[mtype].name}×${n}`);
  }
  return parts.length ? parts.join(', ') : '';
}

function adjustGroupModules(key, modType, amount) {
  const gs = getGS(key);
  const groups = buildGroupMap();
  const group = groups[key];
  if (!group) return;
  const slotsPerBuilding = MODULE_SLOTS[group.type] ?? 0;
  const totalSlots = slotsPerBuilding * group.buildings.length;
  if (!gs.modules) gs.modules = {};
  const usedSlots = Object.values(gs.modules).reduce((s, n) => s + n, 0);
  const current = gs.modules[modType] ?? 0;
  let newVal = current + amount;
  if (amount > 0) {
    const freeSlots = totalSlots - usedSlots;
    newVal = Math.min(newVal, current + freeSlots);
  }
  newVal = Math.max(0, newVal);
  gs.modules[modType] = newVal;
  saveState();
  renderBuildings();
}

function fillGroupModules(key, modType) {
  const gs = getGS(key);
  const groups = buildGroupMap();
  const group = groups[key];
  if (!group) return;
  const slotsPerBuilding = MODULE_SLOTS[group.type] ?? 0;
  const totalSlots = slotsPerBuilding * group.buildings.length;
  if (!gs.modules) gs.modules = {};
  const usedOther = Object.entries(gs.modules).reduce((s, [k, n]) => k === modType ? s : s + n, 0);
  gs.modules[modType] = Math.max(0, totalSlots - usedOther);
  saveState();
  renderBuildings();
}

function clearGroupModules(key) {
  const gs = getGS(key);
  gs.modules = {};
  saveState();
  renderBuildings();
}

function buildingCard(icon, name, count, meta, statusTxt, isActive, barFill, key, extra = '', showLimit = false, moduleType = null) {
  const gs      = getGS(key);
  const stClass = isActive ? 'status-ok' : 'status-warn';
  const fillPct = (Math.min(1, Math.max(0, barFill)) * 100).toFixed(1);
  const limitVal = gs.limit === Infinity ? '∞' : gs.limit;
  const limitRow = showLimit
    ? `<div class="building-limit-row">Stop if output ≥ <input type="text" class="limit-input" data-limit="${key}" value="${limitVal}" placeholder="∞ = no limit"></div>`
    : '';

  let moduleRow = '';
  if (moduleType !== null) {
    const slotsPerBuilding = MODULE_SLOTS[moduleType] ?? 0;
    const totalSlots = slotsPerBuilding * count;
    if (totalSlots > 0) {
      const mods = gs.modules ?? {};
      const selectedType = gs.selectedModuleType ?? 'speedMk1';
      const usedSlots = Object.values(mods).reduce((s, n) => s + n, 0);
      const summary = buildModSummary(mods);
      const isProdAllowed = !PROD_MODULE_BLACKLIST.has(key.split(':')[1] ?? '');
      const options = Object.entries(MODULE_DATA)
        .filter(([k]) => k.startsWith('speed') || isProdAllowed)
        .map(([k, d]) => `<option value="${k}"${k === selectedType ? ' selected' : ''}>${d.name}</option>`)
        .join('');
      moduleRow = `<div class="module-row">
        <span class="module-slots-info">${usedSlots}/${totalSlots} slots</span>
        <select class="module-type-sel" data-mod-sel="${key}">${options}</select>
        <button class="mod-btn mod-add" data-mod-add="${key}" title="+1 module">+1</button>
        <button class="mod-btn mod-add10" data-mod-add10="${key}" title="+10 modules">+10</button>
        <button class="mod-btn mod-fill" data-mod-fill="${key}" title="Fill all slots">Fill</button>
        <button class="mod-btn mod-rem" data-mod-rem="${key}" title="-1 module">−1</button>
        <button class="mod-btn mod-clear" data-mod-clear="${key}" title="Remove all modules">Clear</button>
        ${summary ? `<span class="mod-summary">${summary}</span>` : '<span class="mod-summary mod-summary-empty">no modules</span>'}
      </div>`;
    }
  }

  return `<div class="building-card">
    <span class="building-icon">${icon}</span>
    <div class="building-info">
      <div class="building-row">
        <span class="building-name">${name}</span>
        <span class="building-count">×${count}</span>
      </div>
      ${extra}${limitRow}${moduleRow}
      <div class="building-meta">${meta}</div>
      <div class="building-status ${stClass}">${statusTxt}</div>
      <div class="mini-bar"><div class="mini-fill ${isActive ? 'fill-active' : ''}" style="width:${fillPct}%"></div></div>
      <div class="building-add-row">
        <button class="btn-add-building" data-add="${key}">+ Add</button>
        <input type="number" class="add-count-input" data-add-count="${key}" min="1" value="1">
      </div>
    </div>
    <div class="building-actions">
      <button class="btn-toggle ${gs.enabled ? 'tog-on' : 'tog-off'}" data-toggle="${key}"
        title="${gs.enabled ? 'Pause' : 'Resume'}">${gs.enabled ? '⏸' : '▶'}</button>
      <button class="btn-removesmall" data-remove="${key}" title="Remove one">−1</button>
    </div>
  </div>`;
}

function renderResearch() {
  renderResearchStatus();
  const hash = JSON.stringify(state.research.done) + '|' + (state.research.current ?? '') + '|' + (state.research.queue ?? []).join(',');
  if (hash !== lastTechHash) {
    lastTechHash = hash;
    renderResearchTree();
  } else {
    updateTreeProgress();
  }
  renderRobotTechs();
}

function computeTechDepths() {
  const allKeys = Object.keys(TECHNOLOGIES);
  const depths = {};
  const children = {};
  for (const k of allKeys) {
    for (const p of TECHNOLOGIES[k].prereqs) {
      if (!children[p]) children[p] = [];
      children[p].push(k);
    }
  }
  const queue = [];
  for (const k of allKeys) {
    if (!TECHNOLOGIES[k].prereqs.length) { depths[k] = 0; queue.push(k); }
  }
  let head = 0;
  while (head < queue.length) {
    const k = queue[head++];
    for (const child of (children[k] ?? [])) {
      const nd = (depths[k] ?? 0) + 1;
      if (depths[child] === undefined || depths[child] < nd) {
        depths[child] = nd;
        queue.push(child);
      }
    }
  }
  for (const k of allKeys) if (depths[k] === undefined) depths[k] = 0;
  const maxDepth = Math.max(...Object.values(depths));
  const tiers = Array.from({ length: maxDepth + 1 }, () => []);
  for (const k of allKeys) tiers[depths[k]].push(k);
  return tiers;
}

function renderResearchTree() {
  const wrap = document.getElementById('tech-tree-wrap');
  if (!wrap) return;
  const tiers = computeTechDepths();

  let html = '<div class="tech-tree-inner" id="tech-tree-inner">';
  for (const tier of tiers) {
    html += '<div class="tech-tier">';
    for (const key of tier) {
      const tech = TECHNOLOGIES[key];
      const done = !!state.research.done[key];
      const isCurrent = state.research.current === key;
      const queue = state.research.queue ?? [];
      const queuePos = queue.indexOf(key);
      const isQueued = queuePos >= 0;
      const meetsPrereqs = canResearchTech(key);
      const meetsWithQueue = canResearchTech(key, true);

      let cls = '';
      if (done) cls = 'node-done';
      else if (isCurrent) cls = 'node-current';
      else if (isQueued) cls = 'node-queued';
      else if (!meetsWithQueue) cls = 'node-locked';

      const costStr = Object.entries(tech.cost).map(([pk, n]) => `${n}×${itemIcon(pk)}`).join(' ');

      let badge = '';
      if (done) {
        badge = `<div class="tech-node-badge">✓ Done</div>`;
      } else if (isCurrent) {
        const totalNeeded = Math.max(...Object.values(tech.cost));
        const pct = (state.research.totalConsumed / totalNeeded * 100).toFixed(1);
        badge = `<div class="mini-bar" style="margin-top:.2rem;height:5px"><div class="mini-fill fill-active" data-tree-progress="${key}" style="width:${pct}%"></div></div>`;
      } else if (isQueued) {
        badge = `<div class="tech-node-badge" style="color:var(--accent-muted)">Queue #${queuePos + 1}</div>`;
      } else if (meetsWithQueue) {
        badge = `<div class="tech-node-badge" style="color:var(--accent)">Available</div>`;
      }

      let clickData = '';
      if (!done && !isCurrent && meetsWithQueue) clickData = `data-research="${key}"`;
      else if (isCurrent) clickData = `data-cancel-research="1"`;

      html += `<div class="tech-node ${cls}" data-node-key="${key}" ${clickData} title="${tech.description}">
        <div class="tech-node-head">
          <span class="tech-node-icon">${tech.icon}</span>
          <div>
            <div class="tech-node-name">${tech.name}</div>
            <div class="tech-node-cost">${costStr}</div>
          </div>
        </div>
        ${badge}
      </div>`;
    }
    html += '</div>';
  }
  html += '<svg class="tech-tree-svg" id="tech-tree-svg"></svg>';
  html += '</div>';

  wrap.innerHTML = html;
  requestAnimationFrame(drawTechLines);
}

function drawTechLines() {
  const svg = document.getElementById('tech-tree-svg');
  const inner = document.getElementById('tech-tree-inner');
  if (!svg || !inner) return;

  const innerRect = inner.getBoundingClientRect();

  // Collect node positions
  const pos = {};
  for (const key of Object.keys(TECHNOLOGIES)) {
    const el = inner.querySelector(`[data-node-key="${key}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    pos[key] = {
      left:   r.left   - innerRect.left,
      right:  r.right  - innerRect.left,
      top:    r.top    - innerRect.top,
      bottom: r.bottom - innerRect.top,
      cy:     (r.top + r.bottom) / 2 - innerRect.top,
    };
  }

  // Build incoming/outgoing edge lists, sorted by the other endpoint's vertical position
  const incoming = {}; // child -> [parents]  (sorted by parent cy)
  const outgoing = {}; // parent -> [children] (sorted by child cy)
  for (const [child, tech] of Object.entries(TECHNOLOGIES)) {
    if (!pos[child]) continue;
    const parents = (tech.prereqs ?? []).filter(p => pos[p]);
    parents.sort((a, b) => pos[a].cy - pos[b].cy);
    incoming[child] = parents;
    for (const p of parents) {
      (outgoing[p] = outgoing[p] ?? []).push(child);
    }
  }
  for (const p of Object.keys(outgoing)) outgoing[p].sort((a, b) => pos[a].cy - pos[b].cy);

  // Allocate vertical channels per gap (rounded x-bucket of midpoint)
  // so lines passing through the same vertical zone don't share an x.
  const channelsByBucket = {}; // bucketKey -> next slot index
  function takeChannel(bucketKey) {
    const i = channelsByBucket[bucketKey] ?? 0;
    channelsByBucket[bucketKey] = i + 1;
    return i;
  }

  let paths = '';
  for (const [child, parents] of Object.entries(incoming)) {
    const c  = pos[child];
    const inN = parents.length;
    parents.forEach((parent, ci) => {
      const p  = pos[parent];
      const out = outgoing[parent];
      const oi  = out.indexOf(child);
      const oN  = out.length;

      // Stagger entry/exit ports along each node's vertical edge so multiple
      // lines from one node don't overlap right at its border.
      const py = p.top + ((oi + 1) / (oN + 1)) * (p.bottom - p.top);
      const cy = c.top + ((ci + 1) / (inN + 1)) * (c.bottom - c.top);
      const px = p.right;
      const cx = c.left;
      const gap = Math.max(8, cx - px);

      // Pick a vertical channel x in the gap; bucket nearby midpoints together
      // so we can spread them out into distinct lanes.
      const bucketX = Math.round((px + gap / 2) / 24);
      const slot = takeChannel(bucketX);
      const lanes = 7;
      const laneIdx = ((slot % lanes) - Math.floor(lanes / 2));
      const laneSpacing = Math.min(10, gap / (lanes + 1));
      const mx = px + gap / 2 + laneIdx * laneSpacing;

      // Orthogonal path with rounded corners: (px,py) → (mx,py) → (mx,cy) → (cx,cy)
      const dy = cy - py;
      const sgn = dy >= 0 ? 1 : -1;
      const r = Math.min(7, Math.abs(mx - px) / 2, Math.abs(cx - mx) / 2, Math.max(1, Math.abs(dy) / 2));

      let d;
      if (Math.abs(dy) < 1.5) {
        d = `M ${px} ${py} L ${cx} ${cy}`;
      } else {
        d = `M ${px} ${py}` +
            ` L ${mx - r} ${py}` +
            ` Q ${mx} ${py} ${mx} ${py + sgn * r}` +
            ` L ${mx} ${cy - sgn * r}` +
            ` Q ${mx} ${cy} ${mx + r} ${cy}` +
            ` L ${cx} ${cy}`;
      }

      paths += `<path d="${d}" fill="none" stroke="#3a3a3a" stroke-width="1.4" opacity="0.85" stroke-linejoin="round"/>`;
    });
  }

  svg.setAttribute('width', inner.scrollWidth);
  svg.setAttribute('height', inner.scrollHeight);
  svg.innerHTML = paths;
}

function updateTreeProgress() {
  if (!state.research.current) return;
  const tech = TECHNOLOGIES[state.research.current];
  if (!tech) return;
  const totalNeeded = Math.max(...Object.values(tech.cost));
  const pct = (state.research.totalConsumed / totalNeeded * 100).toFixed(1);
  const fill = document.querySelector(`[data-tree-progress="${state.research.current}"]`);
  if (fill) fill.style.width = pct + '%';
}

function renderResearchStatus() {
  const el = document.getElementById('research-status');
  if (!el) return;
  const res  = state.research;
  const labs = state.buildings.filter(b => b.type === 'lab').length;
  const gs   = getGS('lab');

  if (!res.current) {
    const savedNote = res.savedKey && TECHNOLOGIES[res.savedKey]
      ? `<span class="research-idle-note">Saved progress: ${TECHNOLOGIES[res.savedKey].name} (${res.savedProgress ?? 0} packs)</span>`
      : '';
    el.innerHTML = `<p class="research-idle">No research in progress. Click a technology node below to start.${savedNote ? '<br>' + savedNote : ''}</p>`;
    return;
  }

  let name, icon, totalNeeded, timePerPack;
  if (res.current.startsWith('robot:')) {
    const rd = currentRobotTechData();
    if (!rd) { el.innerHTML = ''; return; }
    totalNeeded  = rd.totalNeeded;
    timePerPack  = rd.timePerPack;
    icon = '🤖';
    name = res.current === 'robot:speed'
      ? `Worker Robot Speed Level ${(res.robotSpeedLevel ?? 0) + 1}`
      : `Worker Robot Cargo Size Level ${(res.robotCargoLevel ?? 0) + 1}`;
  } else {
    const tech = TECHNOLOGIES[res.current];
    if (!tech) { el.innerHTML = ''; return; }
    totalNeeded  = Math.max(...Object.values(tech.cost));
    timePerPack  = tech.timePerPack;
    icon = tech.icon;
    name = tech.name;
  }

  const pct  = (res.totalConsumed / totalNeeded * 100).toFixed(1);
  const rate = labs > 0 ? (labs / timePerPack).toFixed(2) : '0';
  const eta  = labs > 0 && !gs.starved
    ? `~${Math.ceil((totalNeeded - res.totalConsumed) / (labs / timePerPack))}s`
    : '—';

  const queue = res.queue ?? [];
  const INF_NAMES = { 'robot:speed': 'Robot Speed', 'robot:cargo': 'Robot Cargo', 'mining:productivity': 'Mining Prod', 'gun:damage': 'Gun Dmg', 'laser:damage': 'Laser Dmg' };
  const queueStr = queue.length
    ? `<div class="research-queue-line">Queue: ${queue.map(k => TECHNOLOGIES[k]?.name ?? INF_NAMES[k] ?? k).join(' → ')}</div>`
    : '';
  el.innerHTML = `<div class="research-active">
    <div class="research-name">${icon} ${name}</div>
    <div class="research-progress-line">${res.totalConsumed} / ${totalNeeded} packs · ${rate}/s · ETA ${eta}${gs.starved ? ' · <span class="status-warn">⚠ No packs</span>' : ''}</div>
    <div class="mini-bar research-bar"><div class="mini-fill fill-active" style="width:${pct}%"></div></div>
    ${queueStr}
  </div>`;
}

function renderRobotTechs() {
  const el = document.getElementById('robot-tech-section');
  if (!el) return;

  const cur      = state.research.current;
  const labCount = state.buildings.filter(b => b.type === 'lab').length;
  let html = '';

  // ── Robot Upgrades (gated behind Robotics tech) ──
  if (state.research.done?.robotics) {
    const speedLevel    = state.research.robotSpeedLevel ?? 0;
    const cargoLevel    = state.research.robotCargoLevel ?? 0;
    const robotCount    = Math.floor(state.inventory?.constructionRobotItem ?? 0);
    const { time: placeTime, batch } = computePlaceTimeSec();
    const effectiveness = 1 + speedLevel * WORKER_SPEED_PER_LEVEL + cargoLevel * WORKER_CARGO_PER_LEVEL;
    html += `<div class="robot-tech-wrap">
    <h3 class="section-label" style="margin-top:2rem;margin-bottom:.5rem">Robot Upgrades</h3>
    <div class="robot-tech-summary">🤖 ${robotCount.toLocaleString()} construction robots · effectiveness ×${effectiveness.toFixed(2)} · place time ${placeTime.toFixed(3)}s${batch > 1 ? ` (×${batch} per cycle)` : ''}</div>`;

  // ── Worker Robot Speed (infinite) ──
  const nextSpeedLvl = speedLevel + 1;
  const speedData = getRobotSpeedTechData(nextSpeedLvl);
  const speedIsCur = cur === 'robot:speed';
  const canResearchSpeed = !cur && labCount > 0;

  const speedIsQueued = (state.research.queue ?? []).includes('robot:speed');
  html += `<div class="robot-tech-group">
    <div class="robot-tech-header">
      <span>Worker Robot Speed</span>
      <span class="robot-tech-badge">Level ${speedLevel}${speedLevel > 0 ? ` · +${(speedLevel * WORKER_SPEED_PER_LEVEL * 100).toFixed(0)}% robot effectiveness` : ''}</span>
    </div>
    <div class="robot-tech-card ${speedIsCur ? 'rcard-current' : speedIsQueued ? 'rcard-queued' : ''}">
      <div class="rcard-name">Level ${nextSpeedLvl}</div>
      <div class="rcard-cost">${Object.keys(speedData.cost).map(pk => itemIcon(pk)).join('')} × ${speedData.totalNeeded.toLocaleString()} · ${speedData.timePerPack}s/pack</div>`;

  if (speedIsCur) {
    const pct = (state.research.totalConsumed / speedData.totalNeeded * 100).toFixed(1);
    html += `<div class="mini-bar" style="margin:.35rem 0"><div class="mini-fill fill-active" style="width:${pct}%"></div></div>
      <div class="rcard-progress">${state.research.totalConsumed.toLocaleString()} / ${speedData.totalNeeded.toLocaleString()} packs</div>
      <button class="btn-secondary rcard-btn" onclick="startRobotResearch('robot:speed')">Cancel</button>`;
  } else if (speedIsQueued) {
    html += `<div class="rcard-hint">Queued</div><button class="btn-secondary rcard-btn" onclick="startRobotResearch('robot:speed')">Dequeue</button>`;
  } else {
    const speedBtnLabel = cur ? 'Queue' : 'Research';
    html += `<button class="btn-primary rcard-btn${labCount ? '' : ' cant-afford'}" ${labCount ? '' : 'disabled'} onclick="startRobotResearch('robot:speed')">${speedBtnLabel}</button>`;
    if (!labCount) html += `<div class="rcard-hint">Requires a Lab</div>`;
  }
  html += `</div></div>`;

  // ── Worker Robot Cargo Size (3 levels) ──
  html += `<div class="robot-tech-group">
    <div class="robot-tech-header">
      <span>Worker Robot Cargo Size</span>
      <span class="robot-tech-badge">Level ${cargoLevel}/3${cargoLevel > 0 ? ` · +${(cargoLevel * WORKER_CARGO_PER_LEVEL * 100).toFixed(0)}% robot effectiveness` : ''}</span>
    </div>`;

  const cargoIsQueued = (state.research.queue ?? []).includes('robot:cargo');
  for (let lvl = 1; lvl <= 3; lvl++) {
    const cd = ROBOT_CARGO_TECH_DATA[lvl];
    const done   = cargoLevel >= lvl;
    const isNext = cargoLevel === lvl - 1;
    const isCur  = cur === 'robot:cargo' && isNext;
    const isQ    = cargoIsQueued && isNext;

    html += `<div class="robot-tech-card ${done ? 'rcard-done' : isCur ? 'rcard-current' : isQ ? 'rcard-queued' : ''}">
      <div class="rcard-name">Level ${lvl}</div>
      <div class="rcard-cost">${Object.keys(cd.cost).map(pk => itemIcon(pk)).join('')} × ${cd.totalNeeded} · ${cd.timePerPack}s/pack</div>`;

    if (done) {
      html += `<div class="rcard-done-badge">✓ Done</div>`;
    } else if (isCur) {
      const pct = (state.research.totalConsumed / cd.totalNeeded * 100).toFixed(1);
      html += `<div class="mini-bar" style="margin:.35rem 0"><div class="mini-fill fill-active" style="width:${pct}%"></div></div>
        <div class="rcard-progress">${state.research.totalConsumed} / ${cd.totalNeeded} packs</div>
        <button class="btn-secondary rcard-btn" onclick="startRobotResearch('robot:cargo')">Cancel</button>`;
    } else if (isQ) {
      html += `<div class="rcard-hint">Queued</div><button class="btn-secondary rcard-btn" onclick="startRobotResearch('robot:cargo')">Dequeue</button>`;
    } else if (isNext) {
      const cargoBtnLabel = cur ? 'Queue' : 'Research';
      html += `<button class="btn-primary rcard-btn${labCount ? '' : ' cant-afford'}" ${labCount ? '' : 'disabled'} onclick="startRobotResearch('robot:cargo')">${cargoBtnLabel}</button>`;
      if (!labCount) html += `<div class="rcard-hint">Requires a Lab</div>`;
    } else if (!done) {
      html += `<button class="btn-secondary rcard-btn" disabled>Locked</button>`;
    }
    html += `</div>`;
  }
  html += '</div>';  // close cargo robot-tech-group
  html += '</div>';  // close robot-tech-wrap
  } // end if robotics done

  // ── Infinite Tech Chains ──

  function infiniteTechGroup(techType, label, prereqKey, levelKey, getDataFn, bonusLabel) {
    if (!state.research.done?.[prereqKey]) return '';
    const level   = state.research[levelKey] ?? 0;
    const nextLvl = level + 1;
    const data    = getDataFn(nextLvl);
    const isCur   = cur === techType;
    const isQueued = (state.research.queue ?? []).includes(techType);
    let out = `<div class="robot-tech-group">
      <div class="robot-tech-header">
        <span>${label}</span>
        <span class="robot-tech-badge">Level ${level}${level > 0 ? ' · ' + bonusLabel(level) : ''}</span>
      </div>
      <div class="robot-tech-card ${isCur ? 'rcard-current' : isQueued ? 'rcard-queued' : ''}">
        <div class="rcard-name">Level ${nextLvl}</div>
        <div class="rcard-cost">${Object.keys(data.cost).map(pk => itemIcon(pk)).join('')} × ${data.totalNeeded.toLocaleString()} · ${data.timePerPack}s/pack</div>`;
    if (isCur) {
      const pct = (state.research.totalConsumed / data.totalNeeded * 100).toFixed(1);
      out += `<div class="mini-bar" style="margin:.35rem 0"><div class="mini-fill fill-active" style="width:${pct}%"></div></div>
        <div class="rcard-progress">${state.research.totalConsumed.toLocaleString()} / ${data.totalNeeded.toLocaleString()} packs</div>
        <button class="btn-secondary rcard-btn" onclick="startInfiniteTech('${techType}')">Cancel</button>`;
    } else if (isQueued) {
      out += `<div class="rcard-hint">Queued</div>
        <button class="btn-secondary rcard-btn" onclick="startInfiniteTech('${techType}')">Dequeue</button>`;
    } else {
      const btnLabel = cur ? 'Queue' : 'Research';
      out += `<button class="btn-primary rcard-btn${labCount ? '' : ' cant-afford'}" ${labCount ? '' : 'disabled'} onclick="startInfiniteTech('${techType}')">${btnLabel}</button>`;
      if (!labCount) out += `<div class="rcard-hint">Requires a Lab</div>`;
    }
    out += `</div></div>`;
    return out;
  }

  html += infiniteTechGroup(
    'mining:productivity', 'Mining Productivity', 'electricMiningDrill', 'miningProdLevel',
    getMiningProdData,
    lvl => `+${(lvl * 10).toFixed(0)}% ore yield`,
  );
  html += infiniteTechGroup(
    'gun:damage', 'Physical Projectile Damage', 'gunTurret', 'gunDamageLevel',
    getGunDamageData,
    lvl => `+${((gunDamageMult(lvl) - 1) * 100).toFixed(0)}% gun DPS`,
  );
  html += infiniteTechGroup(
    'laser:damage', 'Laser Weapons Damage', 'laserTurretTech', 'laserDamageLevel',
    getLaserDamageData,
    lvl => `+${((laserDamageMult(lvl) - 1) * 100).toFixed(0)}% laser DPS`,
  );

  if (html === lastRobotTechHtml) return;
  lastRobotTechHtml = html;
  el.innerHTML = html;
}

// ── Perimeter Defense ─────────────────────────────────────────

function biterInterval() {
  return state.settings?.biterIntervalSecs ?? BITER_INTERVAL;
}

function perimeterTiles() {
  return 4 * (state.perimeter?.sideLength ?? 10);
}

function perimeterMaxWalls() {
  return perimeterTiles() * WALLS_PER_TILE;   // 20 * 4 * sideLength
}

function perimeterMaxTurrets() {
  return perimeterTiles() * TURRETS_PER_TILE; // 5 * 4 * sideLength
}

function perimeterMaxArtillery() {
  const sl = state.perimeter?.sideLength ?? 10;
  const rangeLevel = state.perimeter?.artilleryRangeLevel ?? 0;
  let total = 0;
  for (let k = 1; k <= rangeLevel + 1; k++) {
    const ring = sl - k;
    if (ring <= 0) break;
    total += 4 * ring;
  }
  return total;
}

// Returns the player's science tier (0–4+) based on highest science pack crafted/researched.
function getPlayerScienceTier() {
  const inv  = state.inventory ?? {};
  const done = state.research?.done ?? {};
  const has  = key => (inv[key] ?? 0) > 0 || !!done[key];
  if (has('blueScience'))  return 3;
  if (has('greenScience')) return 2;
  if (has('redScience'))   return 1;
  return 0;
}

// Returns true if the rainbow science pack has ever been crafted or researched.
function hasRainbowScience() {
  return (state.inventory?.rainbowScience ?? 0) > 0 || !!state.research?.done?.['rainbowSciencePack'];
}

function getBiterWaveStats() {
  const pts = state.biterThreatPoints ?? 0;
  const count = Math.min(BITER_COUNT_CAP, Math.round(5 + pts * 0.5));
  const hp    = Math.min(BITER_HP_CAP,   Math.round(15 + pts * 8));
  const armor = Math.min(BITER_ARMOR_CAP, Math.floor(pts * 0.01));
  const dps   = Math.min(BITER_DPS_CAP,  2 + pts * 0.18);
  return { count, hp, armor, dps };
}

function calcDefenseDPS(waveArmor) {
  const p          = state.perimeter;
  const ammoType   = p.ammoType ?? 'firearmMagazine';
  const powerRatio = state.powerRatio ?? 1;
  const gMult      = gunDamageMult(state.research?.gunDamageLevel ?? 0);
  const lMult      = laserDamageMult(state.research?.laserDamageLevel ?? 0);

  const stats = GUN_TURRET_STATS[ammoType] ?? GUN_TURRET_STATS.firearmMagazine;
  const effectiveDmg  = Math.max(0, stats.dmgPerShot * gMult - waveArmor * stats.armorMult);
  const gunDpsPerTurret = stats.shotsPerSec * effectiveDmg;

  const ammoAvail     = state.inventory[ammoType] ?? 0;
  const effectiveGuns = ammoAvail > 0 ? p.gunTurrets : 0;
  const gunDPS        = effectiveGuns * gunDpsPerTurret;
  const laserDPS      = p.laserTurrets * LASER_DPS_PER_TURRET * powerRatio * lMult;
  return { gunDPS, laserDPS, totalDPS: gunDPS + laserDPS, gunDpsPerTurret, stats, effectiveDmg };
}

function fightBiterWave() {
  const waveNum = (state.biterWaveNumber ?? 0) + 1;

  // ── Advance threat points ──────────────────────────────────
  const rainbow = hasRainbowScience();
  if (rainbow) {
    const wavesAfterRainbow = state.biterWavesAfterRainbow ?? 0;
    const expBase = BITER_POINTS_EXP_BASE_INITIAL + wavesAfterRainbow * BITER_POINTS_EXP_BASE_GROWTH;
    state.biterThreatPoints = (state.biterThreatPoints ?? 0) * expBase;
    state.biterWavesAfterRainbow = wavesAfterRainbow + 1;
  } else {
    const tier = getPlayerScienceTier();
    let pointsPerWave;
    if      (tier <= 1) pointsPerWave = state.settings?.biterPointsPreRed  ?? BITER_POINTS_PRE_RED;
    else if (tier === 2) pointsPerWave = BITER_POINTS_POST_RED;
    else if (tier === 3) pointsPerWave = BITER_POINTS_POST_GREEN;
    else                 pointsPerWave = state.settings?.biterPointsPostBlue ?? BITER_POINTS_POST_BLUE;
    const cap = state.settings?.biterPointsCap ?? BITER_POINTS_CAP_LINEAR;
    state.biterThreatPoints = Math.min(cap, (state.biterThreatPoints ?? 0) + pointsPerWave);
  }

  const base    = getBiterWaveStats();

  const actualCount = Math.max(1, base.count + Math.floor((Math.random() - 0.5) * 4));
  const actualHP    = Math.max(5, base.hp    + Math.floor((Math.random() - 0.5) * 10));
  const actualArmor = Math.max(0, base.armor + Math.floor((Math.random() - 0.5) * 2));
  const actualDPS   = Math.max(1, base.dps   + (Math.random() - 0.5) * 3);

  const p            = state.perimeter;
  const totalBiterHP = actualCount * actualHP;
  const totalBiterDPS= actualCount * actualDPS;
  const totalWallHP  = p.walls * WALL_HP;

  const { gunDPS, laserDPS, totalDPS } = calcDefenseDPS(actualArmor);

  // ── Wall section model ─────────────────────────────────────
  const numSections = perimeterTiles();
  let sectionsAttacked;
  if (rainbow) {
    sectionsAttacked = numSections;
  } else {
    const tier = getPlayerScienceTier();
    const pct  = tier <= 1 ? 0.05 : tier === 2 ? 0.10 : 0.15;
    sectionsAttacked = Math.max(1, Math.round(numSections * pct));
  }

  const sectionWallHP  = totalWallHP  / numSections;
  const sectionDefDPS  = totalDPS     / numSections;
  const sectionBiterHP = totalBiterHP / sectionsAttacked;
  const sectionBiterDPS= totalBiterDPS / sectionsAttacked;

  // Fight each attacked section and accumulate overflow
  let totalOverflow = 0;
  let killTime = null;
  let ammoUsed = 0;
  const ammoStats = GUN_TURRET_STATS[p.ammoType ?? 'firearmMagazine'] ?? GUN_TURRET_STATS.firearmMagazine;

  for (let s = 0; s < sectionsAttacked; s++) {
    if (sectionDefDPS > 0) {
      const kt = sectionBiterHP / sectionDefDPS;
      if (killTime === null) killTime = kt; // use first section as representative
      const dmg = sectionBiterDPS * kt;
      ammoUsed += p.gunTurrets * ammoStats.ammoCostPerSec * kt / sectionsAttacked;
      if (dmg > sectionWallHP) totalOverflow += dmg - sectionWallHP;
    } else {
      // No DPS: biters attack for full interval duration
      const dmg = sectionBiterDPS * biterInterval();
      if (dmg > sectionWallHP) totalOverflow += dmg - sectionWallHP;
    }
  }
  ammoUsed = Math.ceil(ammoUsed);

  // Representative damage for display: sum across sections
  const biterDamageDealt = sectionDefDPS > 0
    ? sectionBiterDPS * (sectionBiterHP / (sectionDefDPS || 1)) * sectionsAttacked
    : sectionBiterDPS * biterInterval() * sectionsAttacked;

  // Consume ammo
  const ammoType      = p.ammoType ?? 'firearmMagazine';
  const ammoAvail     = state.inventory[ammoType] ?? 0;
  const actualAmmoUsed= Math.min(ammoUsed, ammoAvail);
  if (actualAmmoUsed > 0) state.inventory[ammoType] -= actualAmmoUsed;

  // ── Artillery fire ────────────────────────────────────────────
  const artilleryDmgPerPiece = ARTILLERY_BASE_DAMAGE * artilleryDamageMult(p.artilleryDamageLevel ?? 0);
  const totalArtilleryDmg    = (p.artillery ?? 0) * artilleryDmgPerPiece;
  if (totalArtilleryDmg > 0) {
    totalOverflow = Math.max(0, totalOverflow - totalArtilleryDmg);
  }

  // ── Atomic bomb defense ───────────────────────────────────────
  p.atomicBombsUsedThisWave = 0;
  let bombsUsed = 0;
  const availableBombs = (p.spidertrons ?? 0) * ATOMIC_BOMBS_PER_SPIDER;
  if (totalOverflow > 0 && availableBombs > 0) {
    const bombsNeeded = Math.ceil(totalOverflow / ATOMIC_BOMB_DAMAGE);
    bombsUsed = Math.min(bombsNeeded, availableBombs);
    totalOverflow = Math.max(0, totalOverflow - bombsUsed * ATOMIC_BOMB_DAMAGE);
  }
  p.atomicBombsUsedThisWave = bombsUsed;
  if (bombsUsed > 0) {
    p.irradiationLevel = (p.irradiationLevel ?? 0) + bombsUsed;
  }

  // Apply overflow damage to buildings
  let buildingsLost = 0;
  if (totalOverflow > 0) {
    buildingsLost = Math.floor(totalOverflow / BUILDING_TOUGHNESS);
    for (let i = 0; i < buildingsLost && state.buildings.length > 0; i++) {
      state.buildings.pop();
    }
  }

  // Apply irradiation to threat scaling (add extra threat points)
  const irradiationBonus = (p.irradiationLevel ?? 0) * IRRADIATION_SCALING_RATE;
  if (irradiationBonus > 0) {
    state.biterThreatPoints = (state.biterThreatPoints ?? 0) + irradiationBonus;
  }

  // ── Meta progression: track kills and award points ───────────
  if (state.settings?.biters) {
    const killMult = (bombsUsed > 0) ? 0.01 : 1;
    const weightedKills = actualCount * killMult;
    state.bitersKilled = (state.bitersKilled ?? 0) + actualCount;
    metaState.rawKills = (metaState.rawKills ?? 0) + weightedKills;
    metaState.totalPoints = Math.log10(1 + metaState.rawKills * 1e-4) * 10;
    saveMetaState();
  }

  state.biterWaveNumber = waveNum;
  state.lastBiterWave = {
    waveNum,
    count: actualCount,
    hp: actualHP,
    armor: actualArmor,
    dps: actualDPS.toFixed(1),
    gunDPS: gunDPS.toFixed(1),
    laserDPS: laserDPS.toFixed(1),
    totalDPS: totalDPS.toFixed(1),
    killTime: killTime != null ? killTime.toFixed(1) : null,
    biterDamage: biterDamageDealt.toFixed(0),
    totalWallHP,
    buildingsLost,
    ammoUsed: actualAmmoUsed,
    ammoType,
    sectionsAttacked,
    numSections,
    artilleryDmg: Math.round(totalArtilleryDmg),
    bombsUsed,
    hadAtomicAssist: bombsUsed > 0,
    result: buildingsLost > 0 ? 'buildings_lost' : 'repelled',
  };

  lastPerimeterHtml = '';
  if (buildingsLost > 0)
    notify(`⚠ Biter wave ${waveNum}: ${buildingsLost} building${buildingsLost > 1 ? 's' : ''} destroyed!`, 'warning');
  else
    notify(`✓ Biter wave ${waveNum} repelled!`, 'info');
}

function addPerimeterDefense(type, amount) {
  const p = state.perimeter;
  if (type === 'walls') {
    const max   = perimeterMaxWalls();
    const toAdd = Math.min(amount, max - p.walls, state.inventory.stoneWall ?? 0);
    if (toAdd <= 0) { notify('Not enough Stone Walls or perimeter is full', 'warning'); return; }
    state.inventory.stoneWall -= toAdd;
    p.walls += toAdd;
  } else if (type === 'gunTurrets') {
    const max   = perimeterMaxTurrets();
    const toAdd = Math.min(amount, max - p.gunTurrets - p.laserTurrets, state.inventory.gunTurretItem ?? 0);
    if (toAdd <= 0) { notify('Not enough Gun Turrets or perimeter is full', 'warning'); return; }
    state.inventory.gunTurretItem -= toAdd;
    p.gunTurrets += toAdd;
  } else if (type === 'laserTurrets') {
    const max   = perimeterMaxTurrets();
    const toAdd = Math.min(amount, max - p.gunTurrets - p.laserTurrets, state.inventory.laserTurretItem ?? 0);
    if (toAdd <= 0) { notify('Not enough Laser Turrets or perimeter is full', 'warning'); return; }
    state.inventory.laserTurretItem -= toAdd;
    p.laserTurrets += toAdd;
  } else if (type === 'artillery') {
    const max   = perimeterMaxArtillery();
    const toAdd = Math.min(amount, max - (p.artillery ?? 0), state.inventory.artilleryTurretItem ?? 0);
    if (toAdd <= 0) { notify('Not enough Artillery Turrets or perimeter is full', 'warning'); return; }
    state.inventory.artilleryTurretItem -= toAdd;
    p.artillery = (p.artillery ?? 0) + toAdd;
  } else if (type === 'spidertrons') {
    const toAdd = Math.min(amount, state.inventory.spidertronItem ?? 0);
    if (toAdd <= 0) { notify('Not enough Spidertrons in inventory', 'warning'); return; }
    state.inventory.spidertronItem -= toAdd;
    p.spidertrons = (p.spidertrons ?? 0) + toAdd;
  }
}

function removePerimeterDefense(type, amount) {
  const p = state.perimeter;
  if (type === 'walls') {
    const n = Math.min(amount, p.walls);
    p.walls -= n;
    state.inventory.stoneWall = (state.inventory.stoneWall ?? 0) + n;
  } else if (type === 'gunTurrets') {
    const n = Math.min(amount, p.gunTurrets);
    p.gunTurrets -= n;
    state.inventory.gunTurretItem = (state.inventory.gunTurretItem ?? 0) + n;
  } else if (type === 'laserTurrets') {
    const n = Math.min(amount, p.laserTurrets);
    p.laserTurrets -= n;
    state.inventory.laserTurretItem = (state.inventory.laserTurretItem ?? 0) + n;
  } else if (type === 'artillery') {
    const n = Math.min(amount, p.artillery ?? 0);
    p.artillery = (p.artillery ?? 0) - n;
    state.inventory.artilleryTurretItem = (state.inventory.artilleryTurretItem ?? 0) + n;
  } else if (type === 'spidertrons') {
    const n = Math.min(amount, p.spidertrons ?? 0);
    p.spidertrons = (p.spidertrons ?? 0) - n;
    state.inventory.spidertronItem = (state.inventory.spidertronItem ?? 0) + n;
  }
}

function expandPerimeter() {
  const newSideLength = state.perimeter.sideLength + 1;
  const chunksNeeded  = Math.pow(newSideLength, 2);
  const chunks        = state.chunksRevealed ?? 0;
  if (Math.sqrt(chunks) <= newSideLength) {
    notify(`Need more explored chunks to expand — need √${chunks} > ${newSideLength} (explore ${Math.max(0, chunksNeeded - chunks)} more)`, 'warning');
    return;
  }
  const concreteCost = state.perimeter.sideLength * 10;
  if ((state.inventory.concrete ?? 0) < concreteCost) {
    notify(`Expanding requires ${concreteCost} Concrete (you have ${Math.floor(state.inventory.concrete ?? 0)})`, 'warning');
    return;
  }
  state.inventory.concrete -= concreteCost;
  state.perimeter.sideLength = newSideLength;
  // Unlock pending patch finds that are now inside the perimeter
  for (const patch of Object.values(state.patches)) {
    if (!patch.pendingFinds) continue;
    const stillLocked = [];
    for (const find of patch.pendingFinds) {
      if (find.chunkIndex < chunksNeeded) {
        patch.remaining += find.remaining;
        patch.nodes     += find.nodes;
      } else {
        stillLocked.push(find);
      }
    }
    patch.pendingFinds = stillLocked;
  }
  const tiles = perimeterTiles();
  notify(`Perimeter expanded to ${newSideLength}×${newSideLength} (${tiles} tiles)`, 'info');
}

function setPerimeterAmmo(ammoType) {
  state.perimeter.ammoType = ammoType;
}

function renderPerimeter() {
  const el = document.getElementById('perimeter-content');
  if (!el) return;
  // Don't re-render while user is interacting with the ammo dropdown
  const focused = document.activeElement;
  if (focused && focused.closest('#perimeter-content') && focused.classList.contains('perimeter-select')) return;

  if (!state.settings.biters) {
    el.innerHTML = '<p class="empty-msg">Biters are disabled. Enable them in New Game settings.</p>';
    return;
  }

  const p         = state.perimeter;
  const tiles     = perimeterTiles();
  const maxWalls  = perimeterMaxWalls();
  const maxTurrets= perimeterMaxTurrets();
  const nextWave  = state.biterWaveNumber + 1;
  const base      = getBiterWaveStats();
  const interval  = biterInterval();
  const timeLeft  = state.biterTimer < 0
    ? `Grace: ${Math.ceil(-state.biterTimer)}s`
    : `${Math.ceil(interval - (state.biterTimer ?? 0))}s`;
  const ammoType  = p.ammoType ?? 'firearmMagazine';

  // Preview defense DPS with a mid-range armor estimate for next wave
  const { gunDPS, laserDPS, totalDPS, stats: gunStats, effectiveDmg } = calcDefenseDPS(base.armor);
  const totalWallHP = p.walls * WALL_HP;
  const nextBiterHP = base.count * base.hp;
  const nextBiterDPS= base.count * base.dps;

  // Section-based preview
  const numSections = perimeterTiles();
  const rainbowActive = hasRainbowScience();
  let previewSectionsAttacked;
  if (rainbowActive) {
    previewSectionsAttacked = numSections;
  } else {
    const tier = getPlayerScienceTier();
    const pct  = tier <= 1 ? 0.05 : tier === 2 ? 0.10 : 0.15;
    previewSectionsAttacked = Math.max(1, Math.round(numSections * pct));
  }
  const previewSectionWallHP  = numSections > 0 ? totalWallHP  / numSections : 0;
  const previewSectionDefDPS  = numSections > 0 ? totalDPS     / numSections : 0;
  const previewSectionBiterHP = nextBiterHP / previewSectionsAttacked;
  const previewSectionBiterDPS= nextBiterDPS / previewSectionsAttacked;

  let previewKillTime  = previewSectionDefDPS > 0 ? (previewSectionBiterHP / previewSectionDefDPS).toFixed(1) : '∞';
  let previewDamage    = previewSectionDefDPS > 0
    ? (previewSectionBiterDPS * (previewSectionBiterHP / previewSectionDefDPS) * previewSectionsAttacked).toFixed(0)
    : (previewSectionBiterDPS * interval * previewSectionsAttacked).toFixed(0);

  // Compute total overflow for outcome
  let previewOverflow = 0;
  for (let s = 0; s < previewSectionsAttacked; s++) {
    const dmg = previewSectionDefDPS > 0
      ? previewSectionBiterDPS * (previewSectionBiterHP / previewSectionDefDPS)
      : previewSectionBiterDPS * interval;
    if (dmg > previewSectionWallHP) previewOverflow += dmg - previewSectionWallHP;
  }
  const previewBuildingsAtRisk = Math.floor(previewOverflow / BUILDING_TOUGHNESS);
  const previewSurvive = previewOverflow <= 0
    ? '✅ Walls hold'
    : (totalDPS <= 0
      ? `❌ ${previewBuildingsAtRisk} building(s) at risk`
      : `⚠ ${previewBuildingsAtRisk} building(s) at risk`);

  const ammoOptions = [
    { key: 'firearmMagazine',   label: 'Firearm Magazine',          dps: GUN_DPS_BASIC    },
    { key: 'piercingRoundsMag', label: 'Piercing Rounds Magazine',  dps: GUN_DPS_PIERCING },
    { key: 'uraniumRoundsMag',  label: 'Uranium Rounds Magazine',   dps: GUN_DPS_URANIUM  },
  ];
  const gMult   = gunDamageMult(state.research?.gunDamageLevel ?? 0);
  const lMult   = laserDamageMult(state.research?.laserDamageLevel ?? 0);
  const baseDmg = (gunStats?.dmgPerShot ?? 12) * gMult;
  const sps     = gunStats?.shotsPerSec ?? 5;
  const armMult = gunStats?.armorMult ?? 1.0;

  const lastWave = state.lastBiterWave;

  // Artillery computed values
  const maxArtillery     = perimeterMaxArtillery();
  const artRangeLevel    = p.artilleryRangeLevel ?? 0;
  const artDmgLevel      = p.artilleryDamageLevel ?? 0;
  const artDmgPerPiece   = ARTILLERY_BASE_DAMAGE * artilleryDamageMult(artDmgLevel);
  const artTotalDmg      = (p.artillery ?? 0) * artDmgPerPiece;

  // Spidertron computed values
  const availBombs       = (p.spidertrons ?? 0) * ATOMIC_BOMBS_PER_SPIDER;

  const concreteCost = p.sideLength * 10;
  const newSL   = p.sideLength + 1;
  const chunks  = state.chunksRevealed ?? 0;
  const canExpand = Math.sqrt(chunks) > newSL && (state.inventory.concrete ?? 0) >= concreteCost;
  const chunkNeed = Math.pow(newSL, 2);
  const expandHint = Math.sqrt(chunks) <= newSL
    ? `Need ${Math.max(0, chunkNeed - chunks)} more chunks` : `${concreteCost} 🧱 Concrete`;
  const html = `
<div class="perimeter-grid">

  <div class="perimeter-card">
    <div class="perimeter-card-title">🛡️ Perimeter</div>
    <div class="perimeter-stat-row">
      <span>Side length</span><strong>${p.sideLength} tiles</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Perimeter</span><strong>${tiles} tiles</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Chunks explored</span><strong>${chunks}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Next wave</span><strong>Wave ${nextWave} · ${timeLeft}</strong>
    </div>
    <button class="btn-sm${canExpand ? '' : ' cant-afford'}" style="margin-top:.5rem" onclick="expandPerimeter()">Expand (+1 side) · ${expandHint}</button>
  </div>

  <div class="perimeter-card">
    <div class="perimeter-card-title">🧱 Stone Walls</div>
    <div class="perimeter-stat-row">
      <span>Placed</span><strong>${p.walls} / ${maxWalls}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Total HP</span><strong>${(totalWallHP).toLocaleString()}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>In inventory</span><strong>${Math.floor(state.inventory.stoneWall ?? 0)}</strong>
    </div>
    <div class="perimeter-btn-row">
      <button class="btn-sm" onclick="addPerimeterDefense('walls',1)">+1</button>
      <button class="btn-sm" onclick="addPerimeterDefense('walls',10)">+10</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('walls',1)">−1</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('walls',10)">−10</button>
    </div>
  </div>

  <div class="perimeter-card">
    <div class="perimeter-card-title">🗼 Gun Turrets</div>
    <div class="perimeter-stat-row">
      <span>Placed</span><strong>${p.gunTurrets} (${maxTurrets - p.gunTurrets - p.laserTurrets} remaining in shared pool)</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Shots/sec</span><strong>${sps}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Dmg/shot</span><strong>${baseDmg.toFixed(1)}${armMult > 0 ? ` − ${base.armor} armor = ${effectiveDmg.toFixed(1)}` : ' (ignores armor)'}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Total DPS</span><strong>${gunDPS.toFixed(1)}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>In inventory</span><strong>${Math.floor(state.inventory.gunTurretItem ?? 0)}</strong>
    </div>
    <div class="perimeter-btn-row">
      <button class="btn-sm" onclick="addPerimeterDefense('gunTurrets',1)">+1</button>
      <button class="btn-sm" onclick="addPerimeterDefense('gunTurrets',5)">+5</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('gunTurrets',1)">−1</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('gunTurrets',5)">−5</button>
    </div>
    <div style="margin-top:.5rem">
      <label class="perimeter-label">Ammo type:</label>
      <select class="perimeter-select" onchange="setPerimeterAmmo(this.value)">
        ${ammoOptions.map(o => `<option value="${o.key}" ${ammoType === o.key ? 'selected' : ''}>${o.label} (${o.dps} base dps)</option>`).join('')}
      </select>
      <div class="perimeter-stat-row" style="margin-top:.25rem">
        <span>Ammo in inv</span><strong>${Math.floor(state.inventory[ammoType] ?? 0)}</strong>
      </div>
    </div>
  </div>

  <div class="perimeter-card">
    <div class="perimeter-card-title">⚡ Laser Turrets</div>
    <div class="perimeter-stat-row">
      <span>Placed</span><strong>${p.laserTurrets} (${maxTurrets - p.gunTurrets - p.laserTurrets} remaining in shared pool)</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Damage type</span><strong>Continuous beam (ignores armor)</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Total DPS</span><strong>${laserDPS.toFixed(1)} (${Math.round((state.powerRatio ?? 1) * 100)}% power)</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>In inventory</span><strong>${Math.floor(state.inventory.laserTurretItem ?? 0)}</strong>
    </div>
    <div class="perimeter-btn-row">
      <button class="btn-sm" onclick="addPerimeterDefense('laserTurrets',1)">+1</button>
      <button class="btn-sm" onclick="addPerimeterDefense('laserTurrets',5)">+5</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('laserTurrets',1)">−1</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('laserTurrets',5)">−5</button>
    </div>
  </div>

  <div class="perimeter-card">
    <div class="perimeter-card-title">💣 Artillery Turrets</div>
    <div class="perimeter-stat-row">
      <span>Placed / Max</span><strong>${p.artillery ?? 0} / ${maxArtillery}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Dmg per piece</span><strong>${artDmgPerPiece.toLocaleString()}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Total artillery dmg</span><strong>${artTotalDmg.toLocaleString()}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Range level</span><strong>${artRangeLevel}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Damage level</span><strong>${artDmgLevel} (+${Math.round((artilleryDamageMult(artDmgLevel) - 1) * 100)}%)</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>In inventory</span><strong>${Math.floor(state.inventory.artilleryTurretItem ?? 0)}</strong>
    </div>
    <div class="perimeter-btn-row">
      <button class="btn-sm" onclick="addPerimeterDefense('artillery',1)">+1</button>
      <button class="btn-sm" onclick="addPerimeterDefense('artillery',5)">+5</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('artillery',1)">−1</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('artillery',5)">−5</button>
    </div>
    <div style="margin-top:.5rem;font-size:.8rem;color:var(--text-muted)">
      Research: Artillery Range Lvl ${artRangeLevel + 1} · Artillery Damage Lvl ${artDmgLevel + 1}
    </div>
  </div>

  <div class="perimeter-card">
    <div class="perimeter-card-title">🕷️ Spidertrons</div>
    <div class="perimeter-stat-row">
      <span>Deployed</span><strong>${p.spidertrons ?? 0}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Bombs available</span><strong>${availBombs} (${ATOMIC_BOMBS_PER_SPIDER}/spidertron)</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Bomb damage each</span><strong>${ATOMIC_BOMB_DAMAGE.toExponential(0)}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Irradiation level</span><strong>${p.irradiationLevel ?? 0} (+${((p.irradiationLevel ?? 0) * IRRADIATION_SCALING_RATE).toFixed(3)} threat/wave)</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>In inventory</span><strong>${Math.floor(state.inventory.spidertronItem ?? 0)}</strong>
    </div>
    <div class="perimeter-btn-row">
      <button class="btn-sm" onclick="addPerimeterDefense('spidertrons',1)">+1</button>
      <button class="btn-sm" onclick="addPerimeterDefense('spidertrons',5)">+5</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('spidertrons',1)">−1</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('spidertrons',5)">−5</button>
    </div>
    ${lastWave?.bombsUsed > 0 ? `<div class="perimeter-stat-row" style="margin-top:.5rem"><span>Last wave bombs used</span><strong>${lastWave.bombsUsed}</strong></div>` : ''}
  </div>

  <div class="perimeter-card perimeter-card-wide">
    <div class="perimeter-card-title">📊 Next Wave Prediction — Wave ${nextWave}</div>
    <div class="perimeter-wave-row">
      <div class="perimeter-wave-col">
        <div class="perimeter-label">Biters</div>
        <div class="perimeter-range">${Math.floor(base.count * 0.8)}–${Math.floor(base.count * 1.2)}</div>
      </div>
      <div class="perimeter-wave-col">
        <div class="perimeter-label">HP per biter</div>
        <div class="perimeter-range">${Math.floor(base.hp * 0.8)}–${Math.floor(base.hp * 1.2)}</div>
      </div>
      <div class="perimeter-wave-col">
        <div class="perimeter-label">Armor</div>
        <div class="perimeter-range">${Math.max(0, base.armor - 1)}–${base.armor + 1}</div>
      </div>
      <div class="perimeter-wave-col">
        <div class="perimeter-label">DPS per biter</div>
        <div class="perimeter-range">${(base.dps * 0.8).toFixed(1)}–${(base.dps * 1.2).toFixed(1)}</div>
      </div>
    </div>
    <div class="perimeter-stat-row" style="margin-top:.5rem">
      <span>Threat level</span><strong>${(state.biterThreatPoints ?? 0).toFixed(1)} pts${rainbowActive ? ' (exponential — rainbow active)' : ''}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Sections attacked</span><strong>${previewSectionsAttacked} / ${numSections} wall sections${rainbowActive ? ' (all — rainbow)' : ''}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>HP per attacked section</span><strong>~${Math.round(previewSectionBiterHP).toLocaleString()}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Defense DPS per section</span><strong>${previewSectionDefDPS.toFixed(1)}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Est. biter HP pool</span><strong>~${nextBiterHP.toLocaleString()}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Est. kill time (per section)</span><strong>${previewKillTime}s</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Est. total biter damage</span><strong>~${parseFloat(previewDamage).toLocaleString()} · Wall HP: ${totalWallHP.toLocaleString()}</strong>
    </div>
    <div class="perimeter-outcome ${previewOverflow > 0 && totalDPS <= 0 ? 'perimeter-outcome-danger' : previewOverflow > 0 ? 'perimeter-outcome-warn' : 'perimeter-outcome-ok'}">${previewSurvive}</div>
  </div>

  ${lastWave ? `
  <div class="perimeter-card perimeter-card-wide">
    <div class="perimeter-card-title">⚔ Last Wave — Wave ${lastWave.waveNum} · ${lastWave.result === 'repelled' ? '✅ Repelled' : '❌ ' + lastWave.buildingsLost + ' building(s) lost'}</div>
    <div class="perimeter-wave-row">
      <div class="perimeter-wave-col">
        <div class="perimeter-label">Count</div><div class="perimeter-range">${lastWave.count}</div>
      </div>
      <div class="perimeter-wave-col">
        <div class="perimeter-label">HP each</div><div class="perimeter-range">${lastWave.hp}</div>
      </div>
      <div class="perimeter-wave-col">
        <div class="perimeter-label">Armor</div><div class="perimeter-range">${lastWave.armor}</div>
      </div>
      <div class="perimeter-wave-col">
        <div class="perimeter-label">DPS each</div><div class="perimeter-range">${lastWave.dps}</div>
      </div>
    </div>
    <div class="perimeter-stat-row" style="margin-top:.5rem">
      <span>Defense DPS</span><strong>${lastWave.totalDPS} (gun: ${lastWave.gunDPS} · laser: ${lastWave.laserDPS})</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Kill time</span><strong>${lastWave.killTime != null ? lastWave.killTime + 's' : '∞ (not killed)'}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Biter damage dealt</span><strong>${parseFloat(lastWave.biterDamage).toLocaleString()} · vs ${lastWave.totalWallHP.toLocaleString()} wall HP</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Ammo consumed</span><strong>${lastWave.ammoUsed} × ${ITEMS[lastWave.ammoType]?.name ?? lastWave.ammoType}</strong>
    </div>
    ${(lastWave.artilleryDmg ?? 0) > 0 ? `<div class="perimeter-stat-row"><span>Artillery damage</span><strong>${lastWave.artilleryDmg.toLocaleString()}</strong></div>` : ''}
    ${(lastWave.bombsUsed ?? 0) > 0 ? `<div class="perimeter-stat-row"><span>Atomic bombs used</span><strong>${lastWave.bombsUsed}</strong></div>` : ''}
  </div>` : ''}

</div>`;
  if (html === lastPerimeterHtml) return;
  lastPerimeterHtml = html;
  el.innerHTML = html;
}

function renderBiterIndicator() {
  const el = document.getElementById('biter-indicator');
  if (!state.settings.biters) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  if (state.biterTimer < 0) {
    el.textContent = `⏳ Grace: ${Math.ceil(-state.biterTimer)}s`;
    el.classList.remove('biter-warning');
  } else {
    const secs = Math.ceil(biterInterval() - state.biterTimer);
    el.textContent = `⚠ Biters: ${secs}s`;
    el.classList.toggle('biter-warning', secs <= 30);
  }
}

function toggleAllPaused() {
  state.allPaused = !state.allPaused;
  renderUI();
}

function toggleStarItem(key) {
  if (!state.starredItems) state.starredItems = [];
  const idx = state.starredItems.indexOf(key);
  if (idx >= 0) state.starredItems.splice(idx, 1);
  else state.starredItems.push(key);
  renderStarredBar();
  renderInventory();
}

function renderStarredBar() {
  const el = document.getElementById('starred-bar');
  if (!el) return;
  const starred = state.starredItems ?? [];
  if (starred.length === 0) {
    if (!el.classList.contains('hidden')) el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  const samples = state.productionHistory?.samples ?? [];
  const SMOOTH = Math.min(10, samples.length);
  const smoothedDelta = {};
  if (SMOOTH > 0) {
    for (const k of (state.starredItems ?? [])) {
      let sum = 0;
      for (let i = samples.length - SMOOTH; i < samples.length; i++) sum += samples[i][k] ?? 0;
      smoothedDelta[k] = sum / SMOOTH;
    }
  }
  const html = starred.map(k => {
    const amt  = Math.floor(state.inventory[k] ?? 0);
    const rate = SMOOTH > 0 ? (smoothedDelta[k] ?? 0) : (state.inventoryDelta[k] ?? 0);
    const rateStr = (rate >= 0 ? '+' : '') + rate.toFixed(1) + '/s';
    return `<div class="starred-item" title="${ITEMS[k]?.name ?? k}">
      <span class="starred-icon">${itemIcon(k)}</span>
      <span class="starred-name">${ITEMS[k]?.name ?? k}</span>
      <span class="starred-count">${amt.toLocaleString()}</span>
      <span class="starred-rate ${rate >= 0 ? 'rate-pos' : 'rate-neg'}">${rateStr}</span>
    </div>`;
  }).join('');
  if (html === lastStarredBarHtml) return;
  lastStarredBarHtml = html;
  el.innerHTML = html;
}

function setGraphMode(mode) {
  graphMode = mode;
  document.querySelectorAll('.graph-tab').forEach(t => {
    t.classList.toggle('graph-tab-active', t.dataset.gmode === mode);
  });
  renderGraph();
  renderGraphLegend();
}

function renderGraphLegend() {
  const host = document.getElementById('graph-legend');
  if (!host) return;
  const starred = state.starredItems ?? [];
  if (starred.length === 0) { host.innerHTML = ''; return; }

  // Compute "current value" for each starred item from latest sample of selected mode.
  const ph = state.productionHistory ?? {};
  const samples =
      graphMode === 'production'  ? (ph.prodSamples ?? [])
    : graphMode === 'consumption' ? (ph.consSamples ?? [])
    :                                (ph.samples     ?? []);
  const last = samples[samples.length - 1] ?? {};

  const COLORS = ['#f4a83a','#4caf50','#3a8fd6','#e04040','#9c27b0','#00bcd4','#ff7043','#8bc34a','#cddc39','#ff5252','#7e57c2','#26a69a'];
  const rows = starred.map((k, ci) => {
    const color = COLORS[ci % COLORS.length];
    const name  = ITEMS[k]?.name ?? k;
    const rate  = last[k] ?? 0;
    const sign  = graphMode === 'net' ? (rate >= 0 ? '+' : '') : '';
    return `<div class="graph-legend-row" title="${name}">
      <span class="graph-legend-swatch" style="background:${color}"></span>
      <span class="graph-legend-icon">${itemIcon(k)}</span>
      <span class="graph-legend-name">${name}</span>
      <span class="graph-legend-rate">${sign}${rate.toFixed(2)}/s</span>
    </div>`;
  }).join('');
  host.innerHTML = rows;
}

function renderGraph() {
  const canvas = document.getElementById('graph-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const ph = state.productionHistory ?? {};
  const samples =
      graphMode === 'production'  ? (ph.prodSamples ?? [])
    : graphMode === 'consumption' ? (ph.consSamples ?? [])
    :                                (ph.samples     ?? []);
  const starred = state.starredItems ?? [];

  const W = canvas.width  = canvas.offsetWidth  || 800;
  const H = canvas.height = canvas.offsetHeight || 300;
  ctx.clearRect(0, 0, W, H);

  if (starred.length === 0) {
    ctx.fillStyle = '#6b7587';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Star items in the Inventory tab to chart their rates here', W / 2, H / 2);
    return;
  }
  if (samples.length < 2) {
    ctx.fillStyle = '#6b7587';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Collecting data…', W / 2, H / 2);
    return;
  }

  const COLORS = ['#f4a83a','#4caf50','#3a8fd6','#e04040','#9c27b0','#00bcd4','#ff7043','#8bc34a','#cddc39','#ff5252','#7e57c2','#26a69a'];
  const pad = { top: 14, bottom: 22, left: 54, right: 10 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  let minVal = 0, maxVal = 0;
  for (const s of samples) {
    for (const k of starred) {
      const v = s[k] ?? 0;
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }
  // Production / consumption are non-negative; pin baseline at 0.
  if (graphMode === 'production' || graphMode === 'consumption') minVal = 0;
  if (maxVal === minVal) maxVal = minVal + 1;

  const scaleY = v => pad.top + plotH - ((v - minVal) / (maxVal - minVal)) * plotH;
  const scaleX = i => pad.left + (i / Math.max(1, samples.length - 1)) * plotW;

  // Grid
  ctx.strokeStyle = '#2e3847';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (i / 4) * plotH;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    const v = maxVal - (i / 4) * (maxVal - minVal);
    ctx.fillStyle = '#6b7587';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(v.toFixed(1), pad.left - 4, y + 3);
  }

  // Zero line
  if (minVal < 0 && maxVal > 0) {
    const y = scaleY(0);
    ctx.strokeStyle = '#3a4557'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
  }

  // Data lines
  starred.forEach((k, ci) => {
    ctx.strokeStyle = COLORS[ci % COLORS.length];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const x = scaleX(i);
      const y = scaleY(samples[i][k] ?? 0);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
}

function returnToMainMenu() {
  const unsaved = lastSaveMs === 0 || (Date.now() - lastSaveMs > 30000);
  if (unsaved && !confirm('You have unsaved progress. Return to main menu anyway?')) return;
  if (gameLoopId) { clearInterval(gameLoopId); gameLoopId = null; }
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  refreshSaveList();
}

function toggleBitersField(enabled) {
  document.querySelectorAll('.biters-option-field').forEach(el => {
    el.classList.toggle('hidden', !enabled);
  });
}

function updatePlaceButtonStates() {
  document.querySelectorAll('.btn-place[data-type]').forEach(btn => {
    const type = btn.dataset.type;
    btn.classList.toggle('cant-afford', !canAfford(BUILDING_COSTS[type] ?? {}));
  });
  // Hide/show locked building cards
  document.querySelectorAll('.buildable-card[data-requires-tech]').forEach(card => {
    const tech = card.dataset.requiresTech;
    card.classList.toggle('hidden', !(state.research.done[tech] ?? false));
  });
}

// ── Scripting Engine — see script.js ─────────────────────────

// (tokenize, ScriptParser, ScriptEvaluator, buildScriptContext,
//  scriptPlaceBuilding, runScriptOnce, runAutoScript,
//  switchScriptTab, toggleScriptAuto, renderScript)
// All defined in script.js loaded after this file.

/* ── block removed — all scripting code is in script.js ── */
function _scriptEngineStub() { // never called; exists only to close the block below
  void 0;
  const KEYWORDS = {
    if:'IF', elif:'ELIF', else:'ELSE', while:'WHILE', for:'FOR',
    in:'IN', and:'AND', or:'OR', not:'NOT',
    pass:'PASS', break:'BREAK', continue:'CONTINUE',
    True:'TRUE', False:'FALSE', None:'NONE',
  };
  const tokens = [];
  const lines = src.replace(/\t/g, '    ').split('\n');
  const stack = [0];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.trimStart().startsWith('#')) continue;

    let indent = 0;
    while (indent < line.length && line[indent] === ' ') indent++;

    if (indent > stack[stack.length - 1]) {
      stack.push(indent);
      tokens.push({ type: 'INDENT' });
    } else {
      while (indent < stack[stack.length - 1]) { stack.pop(); tokens.push({ type: 'DEDENT' }); }
    }

    let pos = indent;
    while (pos < line.length) {
      if (line[pos] === ' ') { pos++; continue; }
      if (line[pos] === '#') break;

      if (line[pos] === '"' || line[pos] === "'") {
        const q = line[pos++]; let s = '';
        while (pos < line.length && line[pos] !== q) s += line[pos++];
        if (pos < line.length) pos++;
        tokens.push({ type: 'STRING', value: s }); continue;
      }

      if (/\d/.test(line[pos])) {
        let s = '';
        while (pos < line.length && /[\d.]/.test(line[pos])) s += line[pos++];
        tokens.push({ type: 'NUMBER', value: parseFloat(s) }); continue;
      }

      if (/[a-zA-Z_]/.test(line[pos])) {
        let s = '';
        while (pos < line.length && /[a-zA-Z0-9_]/.test(line[pos])) s += line[pos++];
        const kw = KEYWORDS[s];
        tokens.push(kw ? { type: kw } : { type: 'NAME', value: s }); continue;
      }

      const two = line.slice(pos, pos + 2);
      if (['<=', '>=', '==', '!=', '**'].includes(two)) {
        tokens.push({ type: 'OP', value: two }); pos += 2; continue;
      }
      tokens.push({ type: 'OP', value: line[pos++] });
    }
    tokens.push({ type: 'NEWLINE' });
  }

  while (stack.length > 1) { stack.pop(); tokens.push({ type: 'DEDENT' }); }
  tokens.push({ type: 'EOF' });
  return tokens;
}

// ── Screen / Tab Management ───────────────────────────────────

function openNewGameModal()  { document.getElementById('new-game-modal').classList.remove('hidden'); }
function closeNewGameModal() { document.getElementById('new-game-modal').classList.add('hidden'); }

function startNewGame() {
  const biters = document.getElementById('biters-toggle').checked;
  const graceMins = parseFloat(document.getElementById('grace-period-input')?.value ?? '7') || 0;
  const biterGracePeriod = Math.round(Math.max(0, graceMins) * 60);
  const biterIntervalSecs = parseInt(document.getElementById('wave-interval-select')?.value ?? '120', 10) || 120;
  const biterPointsPreRed  = parseFloat(document.getElementById('biter-points-pre-red-input')?.value  ?? String(BITER_POINTS_PRE_RED))  || BITER_POINTS_PRE_RED;
  const biterPointsPostBlue= parseFloat(document.getElementById('biter-points-post-blue-input')?.value ?? String(BITER_POINTS_POST_BLUE)) || BITER_POINTS_POST_BLUE;
  const biterPointsCap     = parseFloat(document.getElementById('biter-points-cap-input')?.value      ?? String(BITER_POINTS_CAP_LINEAR)) || BITER_POINTS_CAP_LINEAR;
  const metaProgEnabled    = document.getElementById('meta-prog-toggle')?.checked ?? false;
  state = createState({ density: selectedDensity, biters, biterGracePeriod, biterIntervalSecs, biterPointsPreRed, biterPointsPostBlue, biterPointsCap, metaProgEnabled });
  placeQueue = []; placing = false; currentPlacing = null;
  currentSaveFile = null;
  _pendingScriptRestore = null;
  closeNewGameModal();
  showGame();
}

function showGame() {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  if (gameLoopId) clearInterval(gameLoopId);
  gameLoopId = setInterval(tick, TICK_MS);
  buildingSearchQuery = '';
  mouseHeld          = false;
  lastTechHash       = '';
  lastInventoryHtml  = '';
  lastStarredBarHtml = '';
  lastRobotTechHtml  = '';
  lastPerimeterHtml  = '';
  lastMetaHtml       = '';
  const searchEl = document.getElementById('buildings-search');
  if (searchEl) searchEl.value = '';
  setupEventDelegation();
  // Restore script content from loaded save
  if (_pendingScriptRestore) {
    const manualEl = document.getElementById('script-manual-editor');
    if (manualEl) manualEl.value = _pendingScriptRestore.content ?? '';
    const autoEl = document.getElementById('script-auto-editor');
    if (autoEl) autoEl.value = _pendingScriptRestore.autoContent ?? '';
    scriptAutoRun = _pendingScriptRestore.autoRun;
    _pendingScriptRestore = null;
  }
  switchScriptTab(scriptActiveTab);
  renderAllPlacementPickers();
  updatePlacementUI();
  // Resume placement queue if loaded with pending buildings
  if (placeQueue.length > 0 && !placing) processNextPlacement();
  updateSaveFilenameDisplay();
  renderUI();
}

function switchTab(tab, el) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  el.classList.add('active');
  renderUI();
}

// ── Event Delegation ──────────────────────────────────────────

let delegationSetUp = false;
function setupEventDelegation() {
  if (delegationSetUp) return;
  delegationSetUp = true;

  // Block re-render during mouse interactions (fixes click registration)
  let mouseHeldTimer = null;
  document.addEventListener('mousedown', () => {
    mouseHeld = true;
    clearTimeout(mouseHeldTimer);
    mouseHeldTimer = setTimeout(() => { mouseHeld = false; }, 500);
  }, true);
  document.addEventListener('mouseup', () => {
    mouseHeld = false;
    clearTimeout(mouseHeldTimer);
  }, true);

  document.getElementById('resource-patches').addEventListener('click', e => {
    const btn = e.target.closest('[data-mine]');
    if (btn && !btn.disabled) manualMine(btn.dataset.mine);
  });

  document.getElementById('inventory-list').addEventListener('click', e => {
    const starBtn = e.target.closest('[data-star]');
    if (starBtn) { toggleStarItem(starBtn.dataset.star); return; }
  });

  document.getElementById('craft-recipes').addEventListener('click', e => {
    const craftBtn = e.target.closest('[data-craft]');
    if (craftBtn && !craftBtn.classList.contains('cant-afford')) {
      queueCraft(craftBtn.dataset.craft, e.shiftKey); return;
    }
    const cancelBtn = e.target.closest('[data-cancel]');
    if (cancelBtn) cancelCraftQueue(cancelBtn.dataset.cancel);
  });

  document.getElementById('active-buildings').addEventListener('click', e => {
    const tog = e.target.closest('[data-toggle]');
    if (tog) { toggleGroup(tog.dataset.toggle); return; }
    const rem = e.target.closest('[data-remove]');
    if (rem) { removeOneFromGroup(rem.dataset.remove); return; }
    const add = e.target.closest('[data-add]');
    if (add) {
      const countEl = add.closest('.building-add-row')?.querySelector('[data-add-count]');
      const count = Math.max(1, parseInt(countEl?.value ?? '1') || 1);
      addBuildingFromGroup(add.dataset.add, count);
      return;
    }
    const recipeBtn = e.target.closest('[data-group-recipe]');
    if (recipeBtn) {
      changeGroupRecipe(recipeBtn.dataset.groupRecipe, recipeBtn.dataset.recipe, recipeBtn.dataset.btype);
      return;
    }
    const modAdd = e.target.closest('[data-mod-add]');
    if (modAdd) {
      const k = modAdd.dataset.modAdd;
      const sel = modAdd.closest('.module-row')?.querySelector('[data-mod-sel]');
      adjustGroupModules(k, getGS(k).selectedModuleType ?? 'speedMk1', 1);
      return;
    }
    const modAdd10 = e.target.closest('[data-mod-add10]');
    if (modAdd10) {
      const k = modAdd10.dataset.modAdd10;
      adjustGroupModules(k, getGS(k).selectedModuleType ?? 'speedMk1', 10);
      return;
    }
    const modFill = e.target.closest('[data-mod-fill]');
    if (modFill) {
      const k = modFill.dataset.modFill;
      fillGroupModules(k, getGS(k).selectedModuleType ?? 'speedMk1');
      return;
    }
    const modRem = e.target.closest('[data-mod-rem]');
    if (modRem) {
      const k = modRem.dataset.modRem;
      adjustGroupModules(k, getGS(k).selectedModuleType ?? 'speedMk1', -1);
      return;
    }
    const modClear = e.target.closest('[data-mod-clear]');
    if (modClear) {
      clearGroupModules(modClear.dataset.modClear);
      return;
    }
  });

  document.getElementById('active-buildings').addEventListener('change', e => {
    const limitInput = e.target.closest('[data-limit]');
    if (limitInput) setGroupLimit(limitInput.dataset.limit, parseInt(limitInput.value) || 0);
    const modSel = e.target.closest('[data-mod-sel]');
    if (modSel) {
      const gs = getGS(modSel.dataset.modSel);
      gs.selectedModuleType = modSel.value;
    }
  });

  const searchEl = document.getElementById('buildings-search');
  if (searchEl) {
    searchEl.addEventListener('input', e => {
      buildingSearchQuery = e.target.value;
      renderBuildings();
    });
  }

  document.querySelector('.placement-col')?.addEventListener('click', e => {
    const btn = e.target.closest('.recipe-icon-btn[data-recipe]');
    if (!btn) return;
    const host = btn.closest('.recipe-picker-host');
    if (!host) return;
    const ptype = host.dataset.ptype;
    if (!state.placementRecipes) state.placementRecipes = defaultPlacementRecipes();
    state.placementRecipes[ptype] = btn.dataset.recipe;
    renderOnePlacementPicker(ptype, host);
  });

  // Script editors — values read on demand, no listeners needed

  document.getElementById('tech-tree-wrap').addEventListener('click', e => {
    const resBtn = e.target.closest('[data-research]');
    if (resBtn && !resBtn.disabled) { startResearch(resBtn.dataset.research); return; }
    const cancelBtn = e.target.closest('[data-cancel-research]');
    if (cancelBtn) cancelResearch();
  });
}

// ── Notifications ─────────────────────────────────────────────

function notify(msg, type = 'info', opts = {}) {
  if (opts.radar && state?.settings?.radarNotif === false) return;
  const el = document.createElement('div');
  el.className = `notif notif-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 2800);
}

// ── Init ──────────────────────────────────────────────────────

// ── Meta Progression Tab ──────────────────────────────────────

const META_UPGRADEABLE_TYPES = [
  'electricMiner', 'lab', 'furnace', 'steelFurnace', 'electricFurnace',
  'assembly', 'assembly2', 'assembly3',
  'boiler', 'pumpjack', 'oilRefinery', 'chemicalPlant',
  'centrifuge', 'rocketSilo',
];

const META_TYPE_NAMES = {
  electricMiner: 'Electric Miner',
  lab: 'Lab',
  furnace: 'Stone Furnace',
  steelFurnace: 'Steel Furnace',
  electricFurnace: 'Electric Furnace',
  assembly: 'Assembly Mk1',
  assembly2: 'Assembly Mk2',
  assembly3: 'Assembly Mk3',
  boiler: 'Boiler',
  pumpjack: 'Pumpjack',
  oilRefinery: 'Oil Refinery',
  chemicalPlant: 'Chemical Plant',
  centrifuge: 'Centrifuge',
  rocketSilo: 'Rocket Silo',
};

function setMetaSubTab(tab) {
  metaSubTab = tab;
  lastMetaHtml = '';
  renderMetaProgression();
}

function metaUpgradeCost(currentLevel) {
  return currentLevel === 0 ? 2 : 5;
}

function buyMetaBuildingUpgrade(type) {
  const current = metaState.buildingUpgrades[type] ?? 0;
  if (current >= 2) return;
  const cost = metaUpgradeCost(current);
  if (metaState.totalPoints < cost) { notify('Not enough meta points.', 'warning'); return; }
  metaState.totalPoints -= cost;
  metaState.buildingUpgrades[type] = current + 1;
  saveMetaState();
  lastMetaHtml = '';
}

function buyMetaPerk(perkKey) {
  if (perkKey === 'quickStart') {
    if (metaState.perks.quickStart) return;
    const cost = 10;
    if (metaState.totalPoints < cost) { notify('Not enough meta points.', 'warning'); return; }
    metaState.totalPoints -= cost;
    metaState.perks.quickStart = true;
    saveMetaState();
    lastMetaHtml = '';
  }
}

function investGamerModule(type) {
  const costMap = { speedPoints: 3, prodPoints: 5 };
  const cost = costMap[type];
  if (!cost) return;
  if (metaState.totalPoints < cost) { notify('Not enough meta points.', 'warning'); return; }
  metaState.totalPoints -= cost;
  metaState.gamerModule[type] = (metaState.gamerModule[type] ?? 0) + 1;
  saveMetaState();
  lastMetaHtml = '';
}

function renderMetaProgression() {
  const el = document.getElementById('meta-content');
  if (!el) return;

  const pts = metaState.totalPoints.toFixed(2);
  const rawKills = Math.floor(metaState.rawKills).toLocaleString();
  const metaEnabled = state?.settings?.metaProgEnabled ?? false;
  const tabs = ['buildings', 'perks', 'gamerModule'];
  const tabLabels = { buildings: 'Building Upgrades', perks: 'Skill Tree', gamerModule: 'Gamer Module' };

  const subTabNav = tabs.map(t =>
    `<button class="tab-btn${metaSubTab === t ? ' active' : ''}" onclick="setMetaSubTab('${t}')" style="margin:0 2px 6px">${tabLabels[t]}</button>`
  ).join('');

  let body = '';

  if (metaSubTab === 'buildings') {
    const rows = META_UPGRADEABLE_TYPES.map(type => {
      const level = metaState.buildingUpgrades[type] ?? 0;
      const cost  = metaUpgradeCost(level);
      const maxed = level >= 2;
      const canAffordUpg = metaState.totalPoints >= cost;
      const btnDisabled  = maxed || !canAffordUpg;
      const speedPct = (level * 25);
      const energyPct = (level * 25);
      return `<div class="stat-row">
        <span class="stat-label">${META_TYPE_NAMES[type] ?? type}</span>
        <span class="stat-value">Lv ${level}/2 (+${speedPct}% speed, -${energyPct}% energy)</span>
        <button class="btn-sm" onclick="buyMetaBuildingUpgrade('${type}')" ${btnDisabled ? 'disabled' : ''}>
          ${maxed ? 'Maxed' : `Upgrade (${cost} pts)`}
        </button>
      </div>`;
    }).join('');
    body = rows;
  } else if (metaSubTab === 'perks') {
    const purchased = metaState.perks.quickStart;
    const cost = 10;
    const canAff = metaState.totalPoints >= cost;
    body = `<div class="stat-row">
      <span class="stat-label">Quick Start</span>
      <span class="stat-value">${purchased ? '✓ Purchased' : `Cost: ${cost} pts`}</span>
    </div>
    <div style="margin:0 0 8px;color:var(--text-muted);font-size:0.85em">
      Start new games with: 1 extra lab, 1 boiler, 1 steam engine, 5 coal miners,
      5 iron miners + furnaces, 5 copper miners + furnaces. Requires Meta Progression enabled on new game.
    </div>
    <button class="btn-sm" onclick="buyMetaPerk('quickStart')" ${purchased || !canAff ? 'disabled' : ''}>
      ${purchased ? 'Purchased' : `Buy (${cost} pts)`}
    </button>`;
  } else if (metaSubTab === 'gamerModule') {
    const spd = metaState.gamerModule.speedPoints ?? 0;
    const prd = metaState.gamerModule.prodPoints ?? 0;
    const spdPct = (getGamerModuleSpeedBonus() * 100).toFixed(0);
    const prdPct = (getGamerModuleProdBonus()  * 100).toFixed(0);
    body = `
      <div class="stat-row"><span class="stat-label">Speed Points</span><span class="stat-value">${spd} (+${spdPct}% speed per slot)</span></div>
      <div class="stat-row"><span class="stat-label">Prod Points</span><span class="stat-value">${prd} (+${prdPct}% prod per slot)</span></div>
      <div style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-sm" onclick="investGamerModule('speedPoints')" ${metaState.totalPoints < 3 ? 'disabled' : ''}>
          +1 Speed Point (3 pts)
        </button>
        <button class="btn-sm" onclick="investGamerModule('prodPoints')" ${metaState.totalPoints < 5 ? 'disabled' : ''}>
          +1 Prod Point (5 pts)
        </button>
      </div>
      <p style="font-size:0.82em;color:var(--text-muted)">
        Gamer Modules are craftable items that can be slotted into buildings. Each slot adds the above bonuses per slot invested.
      </p>`;
  }

  const metaNote = metaEnabled
    ? ''
    : '<p style="color:var(--warn-text,#f59e0b);font-size:0.85em;margin-top:8px">⚠ Meta Progression is not enabled on the current save. Enable it when starting a new game to apply bonuses.</p>';

  const html = `
    <div class="card" style="margin-bottom:8px">
      <div class="stat-row"><span class="stat-label">Meta Points</span><span class="stat-value" style="font-weight:700;color:var(--accent)">${pts}</span></div>
      <div class="stat-row"><span class="stat-label">Lifetime Biters Killed</span><span class="stat-value">${rawKills}</span></div>
      ${metaNote}
    </div>
    <div style="margin-bottom:8px">${subTabNav}</div>
    <div class="card">${body}</div>
  `;

  if (html === lastMetaHtml) return;
  lastMetaHtml = html;
  el.innerHTML = html;
}

// ── Start-screen meta panel ───────────────────────────────────

function toggleStartMetaPanel() {
  const panel = document.getElementById('start-meta-panel');
  if (!panel) return;
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) renderStartMetaPanel();
}

function renderStartMetaPanel() {
  const panel = document.getElementById('start-meta-panel');
  if (!panel) return;
  const pts = metaState.totalPoints.toFixed(2);
  const rawKills = Math.floor(metaState.rawKills).toLocaleString();
  const upgrades = META_UPGRADEABLE_TYPES
    .filter(t => (metaState.buildingUpgrades[t] ?? 0) > 0)
    .map(t => `${META_TYPE_NAMES[t] ?? t} Lv${metaState.buildingUpgrades[t]}`)
    .join(', ') || 'None';
  panel.innerHTML = `
    <div class="card" style="max-width:480px;margin:0 auto">
      <h3 style="margin:0 0 8px">Meta Progression</h3>
      <div class="stat-row"><span class="stat-label">Meta Points</span><span class="stat-value">${pts}</span></div>
      <div class="stat-row"><span class="stat-label">Lifetime Kills</span><span class="stat-value">${rawKills}</span></div>
      <div class="stat-row"><span class="stat-label">Quick Start</span><span class="stat-value">${metaState.perks.quickStart ? '✓ Purchased' : 'Not purchased'}</span></div>
      <div class="stat-row"><span class="stat-label">Building Upgrades</span><span class="stat-value">${upgrades}</span></div>
      <div class="stat-row"><span class="stat-label">Gamer Spd Pts</span><span class="stat-value">${metaState.gamerModule.speedPoints}</span></div>
      <div class="stat-row"><span class="stat-label">Gamer Prod Pts</span><span class="stat-value">${metaState.gamerModule.prodPoints}</span></div>
      <p style="font-size:0.82em;color:var(--text-muted);margin-top:8px">
        Points are earned by defeating biter waves. Open the in-game Meta tab to spend points.
      </p>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  loadMetaState();
  document.querySelectorAll('.density-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.density-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDensity = btn.dataset.density;
    })
  );
  document.getElementById('biters-toggle').addEventListener('change', e => {
    document.getElementById('biters-status').textContent = e.target.checked ? 'Enabled' : 'Disabled';
  });
  refreshSaveList();
});
