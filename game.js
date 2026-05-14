'use strict';

// ── Constants ────────────────────────────────────────────────

const TICK_MS              = 200;  // simulation rate; display runs at 10fps via separate render loop
const MINE_SPEED           = 0.25;   // ore/sec per burner miner
const ELECTRIC_MINER_SPEED = 0.5;   // ore/sec per electric miner
const ELECTRIC_MINER_KW    = 90;    // kW each
const ASSEMBLY_SPEED       = 0.5;   // recipe.time / ASSEMBLY_SPEED = actual seconds
const ASSEMBLY_KW          = 75;    // kW each
const PLACE_TIME           = 2; // seconds to place one building (base)
const ROBOT_BONUS_PER_UNIT   = 0.008;  // placement speed contribution per robot×effectiveness
const WORKER_SPEED_PER_LEVEL = 0.25;   // robot effectiveness gain per speed research level
const PLACE_TIME_MIN         = 0.1;    // minimum raw time before batch mode kicks in
const PLACE_TIME_LOOP        = 0.1;    // effective time used in batch mode
const BITER_INTERVAL       = 120;
const BITER_RAMP           = 1.0;    // multiplier on wave number for scaling
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
const CHEMICAL_PLANT_SPEED = 1.0;
const CHEMICAL_PLANT_KW    = 210;
const CENTRIFUGE_SPEED     = 1.0;
const CENTRIFUGE_KW        = 350;
const ROCKET_SILO_SPEED    = 1.0;
const ROCKET_SILO_KW       = 4000;
const LAB_KW = 60;
const RADAR_KW = 300;
const NUCLEAR_REACTOR_KW    = 488880;  // kW per nuclear reactor complex
const NUCLEAR_FUEL_INTERVAL = 50;      // seconds per uranium fuel cell consumed
const STEAM_ENGINE_KW            = 900;    // kW per steam engine
const STEAM_ENGINE_STEAM_PER_SEC = 30;     // steam consumed per second per engine
const OFFSHORE_PUMP_WATER_PER_SEC = 1200;  // water produced per second per offshore pump
const BOILER_COAL_PER_SEC        = 0.45;   // coal consumed per second per boiler
const BOILER_WATER_PER_SEC       = 6;      // water consumed per second per boiler
const BOILER_STEAM_PER_SEC       = 60;     // steam produced per second per boiler

// ── Performance Profiler ─────────────────────────────────────
const _prof = { enabled: false, samples: {}, WINDOW: 300 };
let _profFilename = '';
let _devPanelKey  = '';
function _p0() { return _prof.enabled ? performance.now() : 0; }
function _p1(s, t) {
  if (!_prof.enabled || !t) return;
  const arr = _prof.samples[s] ?? (_prof.samples[s] = []);
  arr.push(performance.now() - t);
  if (arr.length > _prof.WINDOW) arr.shift();
}

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
  speedModule: { name: 'Speed 1', speedBonus: 0.20, energyBonus: 0.50 },
  speedModule2: { name: 'Speed 2', speedBonus: 0.30, energyBonus: 0.60 },
  speedModule3: { name: 'Speed 3', speedBonus: 0.50, energyBonus: 0.70 },
  productivityModule:  { name: 'Prod 1',  prodBonus: 0.04, speedPenalty: -0.05, energyBonus: 0.40 },
  productivityModule2:  { name: 'Prod 2',  prodBonus: 0.06, speedPenalty: -0.10, energyBonus: 0.60 },
  productivityModule3:  { name: 'Prod 3',  prodBonus: 0.10, speedPenalty: -0.15, energyBonus: 0.80 },
  gamerModule: { name: 'Gamer Module', speedBonus: 0, prodBonus: 0 },
};
// Recipes whose output is a placeable building — productivity modules not allowed.
// Add recipe output item keys here as needed (e.g., 'inserter', 'transportBelt').
const PROD_MODULE_BLACKLIST = new Set([]); //

// ── Chest Reward Definitions ──────────────────────────────────────
function _anyBldg(s, types) {
  return Object.values(s.buildings ?? {}).some(g => types.includes(g.type) && (g.count ?? 0) > 0);
}

const CHEST_REWARDS = {
  common: [
    { id: 'speed_miners',      name: 'Miner Speed',           maxLevel: 25, perLevel: 0.01,
      desc: lvl => `+${lvl}% mining speed`,
      eligible: s => _anyBldg(s, ['miner','electricMiner']) },
    { id: 'speed_furnaces',    name: 'Furnace Speed',          maxLevel: 25, perLevel: 0.01,
      desc: lvl => `+${lvl}% furnace speed`,
      eligible: s => _anyBldg(s, ['furnace','steelFurnace','electricFurnace']) },
    { id: 'speed_assemblers',  name: 'Assembler Speed',        maxLevel: 25, perLevel: 0.01,
      desc: lvl => `+${lvl}% assembler speed`,
      eligible: s => _anyBldg(s, ['assembly','assembly2','assembly3']) },
    { id: 'speed_oilRefinery', name: 'Oil Refinery Speed',     maxLevel: 25, perLevel: 0.01,
      desc: lvl => `+${lvl}% refinery speed`,
      eligible: s => _anyBldg(s, ['oilRefinery']) },
    { id: 'speed_chemPlant',   name: 'Chemical Plant Speed',   maxLevel: 25, perLevel: 0.01,
      desc: lvl => `+${lvl}% chem plant speed`,
      eligible: s => _anyBldg(s, ['chemicalPlant']) },
    { id: 'speed_centrifuge',  name: 'Centrifuge Speed',       maxLevel: 25, perLevel: 0.01,
      desc: lvl => `+${lvl}% centrifuge speed`,
      eligible: s => _anyBldg(s, ['centrifuge']) },
    { id: 'speed_rocketSilo',  name: 'Rocket Silo Speed',      maxLevel: 25, perLevel: 0.01,
      desc: lvl => `+${lvl}% silo speed`,
      eligible: s => _anyBldg(s, ['rocketSilo']) },
    { id: 'speed_pumpjack',    name: 'Pumpjack Speed',         maxLevel: 25, perLevel: 0.01,
      desc: lvl => `+${lvl}% pumpjack speed`,
      eligible: s => _anyBldg(s, ['pumpjack']) },
    { id: 'turretFireRate',    name: 'Turret Fire Rate',       maxLevel: 25, perLevel: 0.01,
      desc: lvl => `+${lvl}% fire rate`,
      eligible: s => !!s.settings?.biters },
  ],
  rare: [
    { id: 'prod_furnaces',    name: 'Furnace Productivity',        maxLevel: 5, perLevel: 0.004,
      desc: lvl => `+${(lvl * 0.4).toFixed(1)}% furnace productivity`,
      eligible: s => _anyBldg(s, ['furnace','steelFurnace','electricFurnace']) },
    { id: 'prod_assemblers',  name: 'Assembler Productivity',      maxLevel: 5, perLevel: 0.004,
      desc: lvl => `+${(lvl * 0.4).toFixed(1)}% assembler productivity`,
      eligible: s => _anyBldg(s, ['assembly','assembly2','assembly3']) },
    { id: 'prod_oilRefinery', name: 'Oil Refinery Productivity',   maxLevel: 5, perLevel: 0.004,
      desc: lvl => `+${(lvl * 0.4).toFixed(1)}% refinery productivity`,
      eligible: s => _anyBldg(s, ['oilRefinery']) },
    { id: 'prod_chemPlant',   name: 'Chem Plant Productivity',     maxLevel: 5, perLevel: 0.004,
      desc: lvl => `+${(lvl * 0.4).toFixed(1)}% chem plant productivity`,
      eligible: s => _anyBldg(s, ['chemicalPlant']) },
    { id: 'prod_centrifuge',  name: 'Centrifuge Productivity',     maxLevel: 5, perLevel: 0.004,
      desc: lvl => `+${(lvl * 0.4).toFixed(1)}% centrifuge productivity`,
      eligible: s => _anyBldg(s, ['centrifuge']) },
    { id: 'prod_rocketSilo',  name: 'Rocket Silo Productivity',    maxLevel: 5, perLevel: 0.004,
      desc: lvl => `+${(lvl * 0.4).toFixed(1)}% silo productivity`,
      eligible: s => _anyBldg(s, ['rocketSilo']) },
    { id: 'turretDamage',     name: 'Turret Damage',               maxLevel: 5, perLevel: 0.01,
      desc: lvl => `+${lvl}% turret damage`,
      eligible: s => !!s.settings?.biters },
    { id: 'turretsPerTile',  name: 'Turret Capacity',             maxLevel: 5, perLevel: 1,
      desc: lvl => `+${lvl} turrets per perimeter tile`,
      eligible: s => !!s.settings?.biters },
  ],
  legendary: [],
};

const WALL_HP              = 350;      // HP per stone wall in perimeter
// Gun turret: shotsPerSec × max(0, dmgPerShot×gMult − armor×armorMult) = effective DPS
const GUN_TURRET_STATS = {
  firearmMagazine:   { shotsPerSec: 5, dmgPerShot: 5, armorMult: 1.0 },
  piercingRoundsMag: { shotsPerSec: 5, dmgPerShot: 8, armorMult: 0.6 },
  uraniumRoundsMag:  { shotsPerSec: 5, dmgPerShot: 24, armorMult: 0.1 },
};
// DPS values for tooltip labels (computed from stats at armor=0)
const GUN_DPS_BASIC        = 60;       // 5×12
const GUN_DPS_PIERCING     = 100;      // 5×20
const GUN_DPS_URANIUM      = 250;      // 5×50
const LASER_SHOTS_PER_SEC  = 1.5;      // shots per second per laser turret
const LASER_DMG_PER_SHOT   = 20;       // base damage per shot (before armor reduction)
const LASER_ARMOR_MULT     = 0.2;      // armor reduction factor for laser (0.2 × armor subtracted)
const LASER_DPS_PER_TURRET = LASER_SHOTS_PER_SEC * LASER_DMG_PER_SHOT; // 30 base DPS
const LASER_KW_PER_TURRET  = LASER_SHOTS_PER_SEC * 800; // 1200 kW (800kJ/shot)
const BUILDING_TOUGHNESS   = 2000;     // overflow damage to destroy 1 building
const WALLS_PER_TILE       = 20;  // max stone walls per perimeter tile  → total = 20 * 4 * sideLength
const TURRETS_PER_TILE     = 5;  // max turrets per perimeter tile
const ARTILLERY_BASE_DAMAGE     = 30000;    // damage per artillery shell
const ARTILLERY_FIRE_RATE       = 10;     // seconds between shots per artillery turret
const ATOMIC_BOMB_DAMAGE        = 1e9;    // damage dealt by one atomic bomb to one section
const ATOMIC_BOMBS_PER_SPIDER   = 5;      // bombs available per spidertron per wave
const IRRADIATION_SCALING_RATE  = 0.001;  // how much each bomb use increases biter threat scaling
const MAGAZINE_SIZE      = 50;  // bullets per magazine, all ammo types
const WAVE_GRACE_PERIOD  =  2;  // seconds biters don't damage walls at wave start

// ── Biter Scaling Constants (0→1 linear scale; >1 = rainbow exponential) ──
const BITER_POINTS_PRE_RED    = 0.001;  // threat points gained per wave before red science
const BITER_POINTS_POST_RED   = 0.002;  // threat points gained per wave after red science
const BITER_POINTS_POST_GREEN = 0.004;  // threat points gained per wave after green science
const BITER_POINTS_POST_BLUE  = 0.008;  // threat points gained per wave after blue science (pre-rainbow)
const BITER_POINTS_POST_PURPLE = 135/3000; // threat points gained per wave after blue science with rainbow scaling
const BITER_POINTS_POST_YELLOW = 190/3000; // threat points gained per wave after yellow/space science
const BITER_POINTS_CAP_LINEAR = 1.0;    // linear phase cap; rainbow exponential kicks in above this
const BITER_POINTS_EXP_BASE_INITIAL = 1.01;  // initial exponential base (per wave) after rainbow
const BITER_POINTS_EXP_BASE_GROWTH  = 0.0001; // how much the base increases per wave after rainbow

// ── Biter Tier Table ──────────────────────────────────────────────────────
const BITER_TIERS = [
  { threshold: 1/3000,   name: 'Death destroyer of worlds',   img: 'data/icon_imgs/Baby_Rabbit.jpeg' },
  { threshold: 5/3000,   name: 'Crouching Mantis Hidden Bug', img: 'data/icon_imgs/Crouching_Mantis_Hidden_Bug.jpeg' },
  { threshold: 25/3000,  name: 'Spoider',                     img: 'data/icon_imgs/Spider.jpeg' },
  { threshold: 80/3000,  name: 'Blue Beetle',                 img: 'data/icon_imgs/Blue_Beetle.jpeg' },
  { threshold: 135/3000, name: 'Invisible Purple Unicorn',    img: 'data/icon_imgs/Invis.jpeg' },
  { threshold: 190/3000, name: 'Angry Bee',                   img: 'data/icon_imgs/Angry_Bee.jpeg' },
  { threshold: 1.0,      name: 'OSHA',                        img: 'data/icon_imgs/OSHA.png' },
];

// ITEMS, ALWAYS_SHOW, FURNACE_RECIPES, PLAYER_RECIPES, CRAFT_SECTIONS loaded from data/recipes.js
// TECHNOLOGIES loaded from data/technologies.js

const SCIENCE_PACKS = [
  'redScience', 'greenScience', 'blueScience',
  'blackScience', 'purpleScience', 'yellowScience',
  'spaceScience', 'rainbowScience'
];

// ── Resource Patches ─────────────────────────────────────────

const PATCHES = {
  ironOre:   { name: 'Iron Ore',   icon: '🪨', base: 150000 },
  copperOre: { name: 'Copper Ore', icon: '🟤', base: 100000 },
  coal:      { name: 'Coal',       icon: '⬛', base:  75000 },
  stone:     { name: 'Stone',      icon: '⬜', base:  50000 },
  crudeOil:  { name: 'Crude Oil',  icon: '🖤', base: 0 },     // discovered by radar
  uraniumOre: { name: 'Uranium Ore', icon: '💚', base: 0 },  // discovered by radar after Nuclear Power
};


// ── Technologies ──────────────────────────────────────────────
// (loaded from data/technologies.js)

// ── Building Definitions (single source of truth) ─────────────
const BUILDING_DEFS = {
  // key: { name, icon, kw, speed, isElectric, hasRecipe, hasResource, scriptAlias, upgradeable }
  miner:           { name: 'Burner Mining Drill',     icon: '⛏️',  kw: 0,                   speed: MINE_SPEED,            isElectric: false, hasRecipe: false, hasResource: true,  scriptAlias: 'miner',         upgradeable: false },
  electricMiner:   { name: 'Electric Mining Drill',   icon: '⚡⛏️', kw: ELECTRIC_MINER_KW,   speed: ELECTRIC_MINER_SPEED,  isElectric: true,  hasRecipe: false, hasResource: true,  scriptAlias: 'e_drill',       upgradeable: true  },
  furnace:         { name: 'Stone Furnace',            icon: '🔥',  kw: 0,                   speed: 1.0,                   isElectric: false, hasRecipe: true,  hasResource: false, scriptAlias: 'furnace',       upgradeable: true  },
  steelFurnace:    { name: 'Steel Furnace',            icon: '🔥',  kw: 0,                   speed: STEEL_FURNACE_SPEED,   isElectric: false, hasRecipe: true,  hasResource: false, scriptAlias: 'steel_furnace', upgradeable: true  },
  electricFurnace: { name: 'Electric Furnace',         icon: '🔥',  kw: ELECTRIC_FURNACE_KW, speed: ELECTRIC_FURNACE_SPEED, isElectric: true, hasRecipe: true,  hasResource: false, scriptAlias: 'electric_furnace', upgradeable: true },
  assembly:        { name: 'Assembling Machine Mk1',  icon: '🏭',  kw: ASSEMBLY_KW,          speed: ASSEMBLY_SPEED,        isElectric: true,  hasRecipe: true,  hasResource: false, scriptAlias: 'am1',           upgradeable: true  },
  assembly2:       { name: 'Assembling Machine Mk2',  icon: '🏭',  kw: ASSEMBLY2_KW,         speed: ASSEMBLY2_SPEED,       isElectric: true,  hasRecipe: true,  hasResource: false, scriptAlias: 'am2',           upgradeable: true  },
  assembly3:       { name: 'Assembling Machine Mk3',  icon: '🏭',  kw: ASSEMBLY3_KW,         speed: ASSEMBLY3_SPEED,       isElectric: true,  hasRecipe: true,  hasResource: false, scriptAlias: 'am3',           upgradeable: true  },
  lab:             { name: 'Unpaid Interns',            icon: '🔬',  kw: LAB_KW,               speed: 1.0,                   isElectric: true,  hasRecipe: false, hasResource: false, scriptAlias: 'lab',           upgradeable: true  },
  boiler:          { name: 'Boiler',                   icon: '🫕',  kw: 0,                   speed: 1.0,                   isElectric: false, hasRecipe: false, hasResource: false, scriptAlias: 'boiler',        upgradeable: true  },
  steamEngine:     { name: 'Steam Engine',             icon: '⚙️',  kw: -STEAM_ENGINE_KW,    speed: 1.0,                   isElectric: false, hasRecipe: false, hasResource: false, scriptAlias: 'steam_engine',  upgradeable: false },
  offshoreP:       { name: 'Offshore Pump',            icon: '💧',  kw: 0,                   speed: 1.0,                   isElectric: false, hasRecipe: false, hasResource: false, scriptAlias: 'pump',          upgradeable: false },
  radar:           { name: 'Radar',                    icon: '📡',  kw: RADAR_KW,             speed: 1.0,                   isElectric: true,  hasRecipe: false, hasResource: false, scriptAlias: 'radar',         upgradeable: false },
  solarPanel:      { name: 'Solar Panel',              icon: '☀️',  kw: -SOLAR_PANEL_KW,     speed: 1.0,                   isElectric: false, hasRecipe: false, hasResource: false, scriptAlias: 'solar',         upgradeable: false },
  accumulator:     { name: 'Accumulator',              icon: '🔋',  kw: 0,                   speed: 1.0,                   isElectric: false, hasRecipe: false, hasResource: false, scriptAlias: 'accumulator',   upgradeable: false },
  oilRefinery:     { name: 'Oil Refinery',             icon: '🛢️',  kw: OIL_REFINERY_KW,    speed: OIL_REFINERY_SPEED,    isElectric: true,  hasRecipe: true,  hasResource: false, scriptAlias: 'refinery',      upgradeable: true  },
  chemicalPlant:   { name: 'Chemical Plant',           icon: '⚗️',  kw: CHEMICAL_PLANT_KW,   speed: CHEMICAL_PLANT_SPEED,  isElectric: true,  hasRecipe: true,  hasResource: false, scriptAlias: 'chem',          upgradeable: true  },
  centrifuge:      { name: 'Centrifuge',               icon: '🌀',  kw: CENTRIFUGE_KW,        speed: CENTRIFUGE_SPEED,      isElectric: true,  hasRecipe: true,  hasResource: false, scriptAlias: 'centrifuge',    upgradeable: true  },
  rocketSilo:      { name: 'Rocket Silo',              icon: '🚀',  kw: ROCKET_SILO_KW,       speed: ROCKET_SILO_SPEED,     isElectric: true,  hasRecipe: true,  hasResource: false, scriptAlias: 'silo',          upgradeable: true  },
  pumpjack:        { name: 'Pumpjack',                 icon: '🛢️',  kw: PUMPJACK_KW,          speed: PUMPJACK_SPEED,        isElectric: true,  hasRecipe: false, hasResource: true,  scriptAlias: 'pumpjack',      upgradeable: true  },
  nuclearReactor:  { name: 'Nuclear Reactor',          icon: '☢️',  kw: -NUCLEAR_REACTOR_KW,  speed: 1.0,                   isElectric: false, hasRecipe: false, hasResource: false, scriptAlias: 'reactor',       upgradeable: false },
};

// Pre-built kW lookup for the power demand loop (electric consumers only, kw > 0)
const BUILDING_KW_TABLE = Object.fromEntries(
  Object.entries(BUILDING_DEFS)
    .filter(([, v]) => v.isElectric && v.kw > 0)
    .map(([k, v]) => [k, v.kw])
);

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

const COST_LABEL = Object.fromEntries(
  Object.entries(BUILDING_COSTS).map(([k, costs]) => [
    k,
    Object.entries(costs)
      .map(([item, n]) => `${n} × ${ITEMS[item]?.name ?? item}`)
      .join(' + ')
  ])
);

// low≈50k  medium≈75k  high≈100k total ore
const DENSITY_MULT = { low: 0.67, medium: 1.0, high: 1.33 };

// Set of item keys that are consumed by BUILDING_COSTS (used for default limit detection)
const BUILDING_ITEM_KEYS = new Set(
  Object.values(BUILDING_COSTS).flatMap(cost => Object.keys(cost))
);

// Maps a building type key to its single inventory item key (the item you craft/hold to place it).
// For buildings that cost multiple items (e.g. nuclearReactor), returns the primary building item.
function getBuildingItemKey(type) {
  const costs = BUILDING_COSTS[type];
  if (!costs) return null;
  // Find the cost entry whose key ends in 'Item' — that's the placeable building item
  const itemEntry = Object.keys(costs).find(k => k.endsWith('Item'));
  return itemEntry ?? null;
}

// ── Meta Progression State ────────────────────────────────────

function defaultMetaState() {
  return {
    totalPoints: 0,
    pendingPoints: 0,
    weightedKills: 0,
    saveBlacklist: [],
    buildingUpgrades: {},
    skillPerks: {},
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

function _applyMetaParsed(parsed) {
  const def = defaultMetaState();
  if (parsed.rawKills != null && parsed.weightedKills == null) parsed.weightedKills = parsed.rawKills;
  metaState = {
    ...def,
    ...parsed,
    perks: { ...def.perks, ...(parsed.perks ?? {}) },
    gamerModule: { ...def.gamerModule, ...(parsed.gamerModule ?? {}) },
    buildingUpgrades: { ...(parsed.buildingUpgrades ?? {}) },
    skillPerks: { ...(parsed.skillPerks ?? {}) },
    saveBlacklist: Array.isArray(parsed.saveBlacklist) ? parsed.saveBlacklist : [],
  };
}

async function loadMetaState() {
  try {
    let raw = null;
    if (window.fileAPI?.loadMeta) {
      raw = await window.fileAPI.loadMeta();
    }
    if (!raw) raw = localStorage.getItem('fi_meta');
    if (raw) _applyMetaParsed(JSON.parse(raw));
  } catch (e) {
    metaState = defaultMetaState();
  }
}

function saveMetaState() {
  const json = JSON.stringify(metaState);
  localStorage.setItem('fi_meta', json);
  if (window.fileAPI?.saveMeta) window.fileAPI.saveMeta(json);
}

// ── Runtime State ─────────────────────────────────────────────

let state           = null;
let gameLoopId      = null;
let _gamePaused     = false;
let _autoSaveTimer  = 0;
let placeQueue      = [];    // pending placements
let _placeHead      = 0;     // index of first live item; O(1) dequeue via head advance
let placing         = false;
let currentPlacing  = null;
let placeStartMs    = null;
let _placeElapsedMs = 0;    // game-time ms spent on current placement item
let placeRafId      = null;
let selectedDensity   = 'medium';
let selectedDifficulty = 'normal';
let mouseHeld       = false;
let biterWaveWarned = false;

const miningCooldowns = {};

// Script engine state (var so script.js can access them)
var scriptOutput    = [];
var scriptAutoRun   = false;
var scriptAutoTimer = 0;
const SCRIPT_AUTO_INTERVAL = 10;
var scriptActiveTab = 'manual'; // 'auto' | 'manual'

// Picker search state (per machine type)
const pickerSearches = {};

// Persists the user-chosen "add count" per building group across render cycles
const buildingAddCounts = {};

// (Legacy delta-tracking variables removed — rates now use itemsProduced/itemsConsumed counters)

// UI state
let graphMode = 'production'; // 'production' | 'consumption' | 'net'
let buildingSearchQuery = '';
let lastTechHash = '';
let lastRobotTechHtml = '';
let lastPerimeterHtml = '';
let lastWavePreviewHash = '';
let lastWavePreviewHtml = '';
const starredMaxCh = {}; // { 'ironOre_count': 6, 'ironOre_rate': 7, ... }
let lastInventoryHtml  = '';
let _groupsCache  = null;
let _groupsDirty  = true;
let _typeCountsCache = null; // { boiler: N, steamEngine: N, ... }
const _cardCache  = {}; // key → { hash, html }
let _lastTickTime  = Date.now();
let _renderLoopId  = null;
let lastStarredBarHtml = '';
let lastMetaHtml = '';
let metaSubTab = 'buildings';
let currentSaveFile = null;
let _pendingScriptRestore = null;
let lastSaveMs = 0;

// ── Tutorial System ───────────────────────────────────────────

let _tutGlowOn = false;
let _tutGlowIntervalId = null;

const TUTORIAL_GOALS = [
  // 0
  {
    text: 'To place buildings you first need to craft them. Go to the Crafting tab and make 1 stone furnace and 1 burner mining drill — you\'ll need to wait for some iron to be produced first.',
    check: s => (s.itemsProduced?.burnerMinerItem ?? 0) >= 1,
    glowCraft: ['stoneFurnaceItem','burnerMinerItem'],
    subGoals: [
      { text: 'Craft 3 iron gears',     check: s => (s.itemsProduced?.ironGear ?? 0) >= 3 },
      { text: 'Craft 2 stone furnaces', check: s => (s.itemsProduced?.stoneFurnaceItem ?? 0) >= 2 },
    ],
  },
  // 1
  {
    text: 'Great! Now go to the Buildings tab and place your miners and furnaces on iron ore so they actually produce resources for you.',
    check: s => {
      const ironMiners   = Object.values(s.buildings).filter(g => g.type==='miner' && g.resource==='ironOre').reduce((n,g)=>n+g.count,0);
      const ironFurnaces = Object.values(s.buildings).filter(g => g.type==='furnace' && g.recipe==='ironPlate').reduce((n,g)=>n+g.count,0);
      return ironMiners >= 2 && ironFurnaces >= 2;
    },
    glowTab: 'buildings',
  },
  // 2
  {
    text: 'Now scale up — place 10 burner miners on iron ore and 8 stone furnaces smelting iron plates. Don\'t forget coal and stone miners too!',
    check: s => {
      const ironMiners   = Object.values(s.buildings).filter(g => (g.type==='miner'||g.type==='electricMiner') && g.resource==='ironOre').reduce((n,g)=>n+g.count,0);
      const ironFurnaces = Object.values(s.buildings).filter(g => (g.type==='furnace'||g.type==='steelFurnace'||g.type==='electricFurnace') && g.recipe==='ironPlate').reduce((n,g)=>n+g.count,0);
      return ironMiners >= 10 && ironFurnaces >= 8;
    },
    progress: s => {
      const ironMiners   = Object.values(s.buildings).filter(g => (g.type==='miner'||g.type==='electricMiner') && g.resource==='ironOre').reduce((n,g)=>n+g.count,0);
      const ironFurnaces = Object.values(s.buildings).filter(g => (g.type==='furnace'||g.type==='steelFurnace'||g.type==='electricFurnace') && g.recipe==='ironPlate').reduce((n,g)=>n+g.count,0);
      return `${Math.min(ironMiners,10)}/10 iron miners · ${Math.min(ironFurnaces,8)}/8 iron furnaces`;
    },
    glowTab: 'buildings',
  },
  // 3
  {
    text: 'Place 5 miners on copper ore and 4 furnaces smelting copper plates.',
    check: s => {
      const copperMiners   = Object.values(s.buildings).filter(g => (g.type==='miner'||g.type==='electricMiner') && g.resource==='copperOre').reduce((n,g)=>n+g.count,0);
      const copperFurnaces = Object.values(s.buildings).filter(g => (g.type==='furnace'||g.type==='steelFurnace'||g.type==='electricFurnace') && g.recipe==='copperPlate').reduce((n,g)=>n+g.count,0);
      return copperMiners >= 5 && copperFurnaces >= 4;
    },
    progress: s => {
      const copperMiners   = Object.values(s.buildings).filter(g => (g.type==='miner'||g.type==='electricMiner') && g.resource==='copperOre').reduce((n,g)=>n+g.count,0);
      const copperFurnaces = Object.values(s.buildings).filter(g => (g.type==='furnace'||g.type==='steelFurnace'||g.type==='electricFurnace') && g.recipe==='copperPlate').reduce((n,g)=>n+g.count,0);
      return `${Math.min(copperMiners,5)}/5 copper miners · ${Math.min(copperFurnaces,4)}/4 copper furnaces`;
    },
    glowTab: 'buildings',
  },
  // 4
  {
    text: 'Build 1 offshore pump, 1 boiler and 2 steam engines for power',
    check: s => {
      const pumps   = s.buildings['offshoreP']?.count ?? 0;
      const boilers = s.buildings['boiler']?.count ?? 0;
      const engines = s.buildings['steamEngine']?.count ?? 0;
      return pumps >= 1 && boilers >= 1 && engines >= 2;
    },
    glowCraft: ['offshorePumpItem','boilerItem','steamEngineItem'],
  },
  // 3
  {
    text: 'Build a unpaid intern and craft a total of 10 red monster',
    check: s => {
      const hasLab = (s.buildings['lab']?.count ?? 0) > 0;
      const packs  = s.itemsProduced?.['redScience'] ?? 0;
      return hasLab && packs >= 10;
    },
    glowCraft: ['labItem','redScience'],
    unlockTab:  'research',
  },
  // 4
  {
    text: 'Research Automation technology',
    check: s => !!s.research.done['automation'],
    glowTab: 'research',
    unlockTab: 'recipes',
  },
  // 5 — research defense techs
  {
    text: 'Research Gun Turret and Stone Wall technologies in the Research tab',
    check: s => !!s.research.done['gunTurret'] && !!s.research.done['stoneWallTech'],
    glowTab: 'research',
  },
  // 6 — build defenses
  {
    text: 'Place 20 stone walls, 10 gun turrets, and have 100 Firearm Magazines in your inventory (Defense tab). Tip: you can upgrade ammo type later for more damage!',
    check: s => (s.perimeter?.walls ?? 0) >= 20 && (s.perimeter?.gunTurrets ?? 0) >= 10 && (s.inventory?.firearmMagazine ?? 0) >= 100,
    progress: s => {
      const w = Math.min(s.perimeter?.walls ?? 0, 20);
      const t = Math.min(s.perimeter?.gunTurrets ?? 0, 10);
      const a = Math.min(Math.floor(s.inventory?.firearmMagazine ?? 0), 100);
      return `${w}/20 walls · ${t}/10 turrets · ${a}/100 magazines`;
    },
    glowTab: 'defense',
  },
  // 7 — radar
  {
    text: 'Place 10 Radars — they discover new ore patches to mine and add to the number of resources you can extract. They will also occasionally find chests with rewards, so it\'s worth building a few of them!',
    check: s => (s.buildings['radar']?.count ?? 0) >= 10,
    progress: s => `${Math.min(s.buildings['radar']?.count ?? 0, 10)}/10 radars`,
    glowCraft: ['radarItem'],
  },
  // 8 — logistics research
  {
    text: 'Research Logistics — reduces building placement time by 0.5 seconds',
    check: s => !!s.research.done['logistics'],
    glowTab: 'research',
  },
  // 9 — green science (was goal 5)
  {
    text: 'Research the Logistic Science Pack (green science)',
    check: s => !!s.research.done['logisticSciencePack'],
    glowTab: 'research',
    unlockTab: 'graph',
  },
  // 10 — concrete + expand
  {
    text: 'Research Concrete, craft 1000 concrete, then expand your perimeter in the Defense tab',
    check: s => (s.itemsProduced?.concrete ?? 0) >= 1000 && (s.perimeter?.sideLength ?? 14) > 14,
    progress: s => {
      const c       = Math.min(Math.floor(s.itemsProduced?.concrete ?? 0), 1000);
      const expanded = (s.perimeter?.sideLength ?? 14) > 14;
      if (!expanded) return `${c}/1000 concrete · then expand in Defense tab`;
      return `✓ 1000 concrete · ✓ perimeter expanded`;
    },
    glowTab: 'research',
  },
  // 11 — military science (was goal 6)
  {
    text: 'Research the Military Science Pack',
    check: s => !!s.research.done['militarySciencePack'],
    glowTab: 'research',
  },
  // 12 — blue science with sub-goals
  {
    text: 'Craft 200 blue science packs (Chemical Science Pack)',
    check: s => (s.itemsProduced?.blueScience ?? 0) >= 200,
    progress: s => `${Math.min(Math.floor(s.itemsProduced?.blueScience ?? 0), 200)}/200 blue science`,
    subGoals: [
      { text: 'Craft engine units',      check: s => (s.itemsProduced?.engineUnit ?? 0) > 0 },
      { text: 'Process sulfur',          check: s => (s.itemsProduced?.sulfur ?? 0) > 0 },
      { text: 'Craft advanced circuits', check: s => (s.itemsProduced?.advancedCircuit ?? 0) > 0 },
    ],
    glowTab: 'research',
  },
  // 13 — laser turrets
  {
    text: 'Research Laser Turrets and place 20 on your perimeter — they draw power but fire a continuous beam with no ammo cost',
    check: s => !!s.research.done['laserTurretTech'] && (s.perimeter?.laserTurrets ?? 0) >= 20,
    progress: s => `${Math.min(s.perimeter?.laserTurrets ?? 0, 20)}/20 laser turrets`,
    glowTab: 'research',
  },
  // 14 — construction robots
  {
    text: 'Craft 100 construction robots — they speed up building placement dramatically',
    check: s => (s.itemsProduced?.constructionRobotItem ?? 0) >= 100,
    progress: s => `${Math.min(Math.floor(s.itemsProduced?.constructionRobotItem ?? 0), 100)}/100 construction robots`,
    glowCraft: ['constructionRobotItem'],
  },
  // 15 — purple science with sub-goals
  {
    text: 'Craft 200 purple science packs (Production Science Pack)',
    check: s => (s.itemsProduced?.purpleScience ?? 0) >= 200,
    progress: s => `${Math.min(Math.floor(s.itemsProduced?.purpleScience ?? 0), 200)}/200 purple science`,
    subGoals: [
      { text: 'Craft productivity modules', check: s => (s.itemsProduced?.productivityModule ?? 0) > 0 },
      { text: 'Craft rails',               check: s => (s.itemsProduced?.rail ?? 0) > 0 },
      { text: 'Craft electric furnaces',   check: s => (s.itemsProduced?.electricFurnaceItem ?? 0) > 0 },
    ],
    glowTab: 'research',
  },
  // 16 — yellow science with sub-goals
  {
    text: 'Craft 200 yellow science packs (Utility Science Pack)',
    check: s => (s.itemsProduced?.yellowScience ?? 0) >= 200,
    progress: s => `${Math.min(Math.floor(s.itemsProduced?.yellowScience ?? 0), 200)}/200 yellow science`,
    subGoals: [
      { text: 'Craft low density structures',       check: s => (s.itemsProduced?.lowDensityStructure ?? 0) > 0 },
      { text: 'Craft flying robot frames',          check: s => (s.itemsProduced?.flyingRobotFrame ?? 0) > 0 },
      { text: 'Craft processing units (blue chips)', check: s => (s.itemsProduced?.processingUnit ?? 0) > 0 },
    ],
    glowTab: 'research',
  },
  // 17 — artillery
  {
    text: 'Research Artillery and add it to your perimeter — it kills the enemy before a waves even starts',
    check: s => !!s.research.done['artillery'] && (s.perimeter?.artillery ?? 0) >= 1,
    glowTab: 'research',
  },
  // 18 — space + rainbow (was goal 10)
  {
    text: 'Research Space Science and Rainbow Science to complete the tech tree',
    check: s => !!s.research.done['spaceSciencePack'] && !!s.research.done['rainbowSciencePack'],
    glowTab: 'research',
  },
  // 19 — endgame weapons
  {
    text: 'Research Spidertrons and Nuclear Weapons for the ultimate offense',
    check: s => !!s.research.done['spidertron'] || !!s.research.done['atomicBombTech'],
    glowTab: 'research',
  },
];

function itemIcon(key) {
  const item = ITEMS[key];
  if (!item) return '❓';
  if (item.img) return `<img class="item-icon" src="${item.img}" alt="${item.name}">`;
  return item.icon ?? '❓';
}


// ── Robot Tech Data ───────────────────────────────────────────


function getRobotSpeedTechData(level) {
  let totalNeeded, packs, timePerPack;
  if      (level === 1) { totalNeeded = 50;                              packs = ['redScience','greenScience','blueScience'];                                               timePerPack = 30; }
  else if (level === 2) { totalNeeded = 100;                             packs = ['redScience','greenScience','blueScience'];                                               timePerPack = 30; }
  else if (level === 3) { totalNeeded = 150;                             packs = ['redScience','greenScience','blueScience','yellowScience'];                               timePerPack = 60; }
  else if (level === 4) { totalNeeded = 250;                             packs = ['redScience','greenScience','blueScience','yellowScience'];                               timePerPack = 60; }
  else if (level === 5) { totalNeeded = 500;                             packs = ['redScience','greenScience','blueScience','purpleScience','yellowScience'];               timePerPack = 60; }
  else                  { totalNeeded = Math.pow(2, level - 6) * 1000;  packs = ['rainbowScience']; timePerPack = 60; }
  return { cost: Object.fromEntries(packs.map(p => [p, 1])), timePerPack, totalNeeded };
}

function getMiningProdData(level) {
  let packs;
  if (level <= 1)      packs = ['redScience','greenScience'];
  else if (level <= 2) packs = ['redScience','greenScience','blueScience'];
  else if (level <= 3) packs = ['redScience','greenScience','blueScience','purpleScience','yellowScience'];
  else                 packs = ['rainbowScience'];
  const totalNeeded = level <= 3 ? level * 250 : 2500 * (level - 3);
  return { cost: Object.fromEntries(packs.map(p => [p, 1])), timePerPack: 60, totalNeeded };
}

function getGunDamageData(level) {
  let packs, t = 60, totalNeeded;
  if (level <= 2)      { packs = ['redScience']; t = 30; totalNeeded = level * 100; }
  else if (level <= 4) { packs = ['redScience','greenScience','blackScience']; totalNeeded = level * 100; }
  else if (level <= 5) { packs = ['redScience','greenScience','blackScience','blueScience']; totalNeeded = 500; }
  else if (level <= 6) { packs = ['redScience','greenScience','blackScience','blueScience','yellowScience']; totalNeeded = 600; }
  else                 { packs = ['rainbowScience']; totalNeeded = Math.pow(2, level - 7) * 1000; }
  return { cost: Object.fromEntries(packs.map(p => [p, 1])), timePerPack: t, totalNeeded };
}

function getLaserDamageData(level) {
  let packs, t = 60, totalNeeded;
  if (level <= 2)      { packs = ['redScience','greenScience','blueScience','blackScience']; t = 30; totalNeeded = level * 100; }
  else if (level <= 4) { packs = ['redScience','greenScience','blueScience','blackScience']; totalNeeded = level * 100; }
  else if (level <= 6) { packs = ['redScience','greenScience','blueScience','blackScience','yellowScience']; totalNeeded = level * 100; }
  else                 { packs = ['rainbowScience']; totalNeeded = Math.pow(2, level - 7) * 1000; }
  return { cost: Object.fromEntries(packs.map(p => [p, 1])), timePerPack: t, totalNeeded };
}

function gunDamageMult(level) {
  const l = level ?? 0;
  const base = hasMetaPerk('perk_gun_baseline') ? 1.10 : 1;
  return base + Math.min(l, 2) * 0.10 + Math.min(Math.max(0, l - 2), 4) * 0.20 + Math.max(0, l - 6) * 0.40;
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
    : ['rainbowScience'];
  return { cost: Object.fromEntries(packs.map(p => [p, 1])), timePerPack: 60, totalNeeded };
}

function getArtilleryDamageTechData(level) {
  const totalNeeded = Math.round(Math.pow(2, level - 1) * 300);
  const packs = level <= 3
    ? ['redScience','greenScience','blueScience','yellowScience']
    : ['rainbowScience'];
  return { cost: Object.fromEntries(packs.map(p => [p, 1])), timePerPack: 60, totalNeeded };
}

function miningProdMult() {
  const baseline = hasMetaPerk('perk_mining_baseline') ? 0.10 : 0;
  return 1 + baseline + (state.research?.miningProdLevel ?? 0) * 0.10;
}

function chestSpeedBonus(buildingType) {
  const u = state?.chestUpgrades ?? {};
  if (['miner','electricMiner'].includes(buildingType))          return (u.speed_miners      ?? 0) * 0.01;
  if (['furnace','steelFurnace','electricFurnace'].includes(buildingType)) return (u.speed_furnaces  ?? 0) * 0.01;
  if (['assembly','assembly2','assembly3'].includes(buildingType)) return (u.speed_assemblers ?? 0) * 0.01;
  if (buildingType === 'oilRefinery')   return (u.speed_oilRefinery ?? 0) * 0.01;
  if (buildingType === 'chemicalPlant') return (u.speed_chemPlant   ?? 0) * 0.01;
  if (buildingType === 'centrifuge')    return (u.speed_centrifuge  ?? 0) * 0.01;
  if (buildingType === 'rocketSilo')    return (u.speed_rocketSilo  ?? 0) * 0.01;
  if (buildingType === 'pumpjack')      return (u.speed_pumpjack    ?? 0) * 0.01;
  return 0;
}

function chestProdBonus(buildingType) {
  const u = state?.chestUpgrades ?? {};
  if (['furnace','steelFurnace','electricFurnace'].includes(buildingType)) return (u.prod_furnaces    ?? 0) * 0.004;
  if (['assembly','assembly2','assembly3'].includes(buildingType)) return (u.prod_assemblers ?? 0) * 0.004;
  if (buildingType === 'oilRefinery')   return (u.prod_oilRefinery ?? 0) * 0.004;
  if (buildingType === 'chemicalPlant') return (u.prod_chemPlant   ?? 0) * 0.004;
  if (buildingType === 'centrifuge')    return (u.prod_centrifuge  ?? 0) * 0.004;
  if (buildingType === 'rocketSilo')    return (u.prod_rocketSilo  ?? 0) * 0.004;
  return 0;
}

// ── Infinite Tech Registry ────────────────────────────────────
// getData references function-declared helpers — safe because function declarations are hoisted.
const INFINITE_TECHS = {
  'robot:speed': new InfiniteTech({
    displayName: 'Robot Speed',
    stateField:  'robotSpeedLevel',
    prereq:      'robotics',
    getData:     (level) => getRobotSpeedTechData(level),
  }),
  'mining:productivity': new InfiniteTech({
    displayName: 'Mining Productivity',
    stateField:  'miningProdLevel',
    prereq:      'electricMiningDrill',
    getData:     (level) => getMiningProdData(level),
  }),
  'gun:damage': new InfiniteTech({
    displayName: 'Physical Projectile Damage',
    stateField:  'gunDamageLevel',
    prereq:      'gunTurret',
    getData:     (level) => getGunDamageData(level),
  }),
  'laser:damage': new InfiniteTech({
    displayName: 'Laser Damage',
    stateField:  'laserDamageLevel',
    prereq:      'laserTurretTech',
    getData:     (level) => getLaserDamageData(level),
  }),
  'artillery:range': new InfiniteTech({
    displayName: 'Artillery Range',
    stateField:  'artilleryRangeLevel',
    prereq:      null,
    getData:     (level) => getArtilleryRangeTechData(level),
  }),
  'artillery:damage': new InfiniteTech({
    displayName: 'Artillery Damage',
    stateField:  'artilleryDamageLevel',
    prereq:      null,
    getData:     (level) => getArtilleryDamageTechData(level),
  }),
};

function currentRobotTechData() {
  const cur = state.research.current;
  const def = INFINITE_TECHS[cur];
  if (!def) return null;
  const level = (state.research[def.stateField] ?? 0) + 1;
  return def.getData(level);
}

function computePlaceTimeSec() {
  const logisticsBonus = (state?.research?.done?.logistics ? 0.5 : 0) + (state?.research?.done?.logistics2 ? 0.5 : 0);
  const placeSpeedBonus = hasMetaPerk('perk_place_speed') ? 0.5 : 0;
  const baseTime = PLACE_TIME - logisticsBonus - placeSpeedBonus;
  const robotCount = Math.floor(state?.inventory?.constructionRobotItem ?? 0);
  if (robotCount === 0) return { time: baseTime, batch: 1 };
  const speedLevel = state.research?.robotSpeedLevel ?? 0;
  const effectiveness = 1 + speedLevel * WORKER_SPEED_PER_LEVEL;
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
  const st = {
    settings: {
      defaultLimitBuilding: 10,
      defaultLimitOther: Infinity,
      biterIntervalSecs:   120,
      biterDifficultyMult: 1,
      metaProgEnabled: false,
      tutorialEnabled: true,
      ...settings,
    },
    placementRecipes: defaultPlacementRecipes(),
    inventory: { ...Object.fromEntries(Object.keys(ITEMS).map(k => [k, 0])), coal: 50 },
    patches:   Object.fromEntries(
      Object.entries(PATCHES).map(([k, v]) => {
        const patchMult = (settings.metaProgEnabled && metaState.skillPerks?.perk_patch_size) ? 1.25 : 1;
        const base = Math.floor(v.base * mult * patchMult);
        /* NODES: const starterNodes = base > 0 ? Math.round((35 + Math.floor(Math.random() * 21)) * mult * patchMult) : 0; */
        return [k, {
          remaining:    base,
          /* NODES: nodes: starterNodes, */
          pendingFinds: [],
        }];
      })
    ),
    buildings: {
      'miner:ironOre':     { type: 'miner',   resource: 'ironOre',  count: 1 },
      'furnace:ironPlate': { type: 'furnace', recipe:   'ironPlate', count: 1 },
      'miner:stone':       { type: 'miner',   resource: 'stone',    count: 1 },
      'miner:coal':        { type: 'miner',   resource: 'coal',     count: 1 },
    },
    biterTimer:      0,
    biterActivated:  false,
    savePlayTime:    0,
    biterSeenTiers:  {},
    biterWaveNumber: 0,
    lastBiterWave:   null,
    perimeter: {
      sideLength: 14,
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
    biterThreatPoints: 15/3000,
    biterWavesAfterRainbow: 0,
    bitersKilled: 0,
    artilleryShellAcc:    0,
    artilleryAccumDamage: 0,
    activeWave:           null,
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
      infiniteAutoStart:    null,
    },
    craftQueue:  [],
    craftActive: null,
    tutorial: { goalIndex: 0 },
    scriptMemory: {},
    starredItems: ['coal', 'ironOre', 'ironPlate'],
    productionHistory: { samples: [], prodSamples: [], consSamples: [], allTimeSamples: [], allTimeInterval: 0 },
    seen: {},
    allPaused: false,
    devMode: false,
    devFreeResearch: false,
    devTickSpeed: 1,
    itemsProduced: {},
    itemsConsumed: {},
    patchConsumed: {},
    baseProduced:  {},
    mapTiles:      {},
    tileBg:        {},
    rateSnapshot: { time: 0, produced: {}, consumed: {} },
    saveCreatedAt: Date.now(),
    _deathHandled: false,
    chests:        { common: 0, rare: 0, legendary: 0 },
    chestUpgrades: {},
    chestHighPriority: [],
  };

  // Apply Quick Start perk if purchased and meta prog is enabled
  if (metaState?.perks?.quickStart && st.settings.metaProgEnabled) {
    const b = st.buildings;
    const add = (key, entry, n = 1) => {
      if (b[key]) b[key].count += n; else b[key] = { ...entry, count: n };
    };
    add('lab',             { type: 'lab' });
    add('boiler',          { type: 'boiler' });
    add('steamEngine',     { type: 'steamEngine' });
    add('miner:coal',      { type: 'miner', resource: 'coal' },      5);
    add('miner:ironOre',   { type: 'miner', resource: 'ironOre' },   5);
    add('furnace:ironPlate',  { type: 'furnace', recipe: 'ironPlate' },  5);
    add('miner:copperOre', { type: 'miner', resource: 'copperOre' }, 5);
    add('furnace:copperPlate', { type: 'furnace', recipe: 'copperPlate' }, 5);
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
    placeQueue: placeQueue.slice(_placeHead),
    scriptContent:     document.getElementById('script-manual-editor')?.value ?? '',
    scriptAutoContent: document.getElementById('script-auto-editor')?.value ?? '',
    scriptAutoRun,
  };
}

function applyStateFromEnvelope(envelope) {
  const isEnvelope = envelope?.version != null;
  const raw = isEnvelope ? envelope.state : envelope;
  state = raw;
  _groupsDirty = true; _groupsCache = null; _typeCountsCache = null;
  for (const k in _cardCache) delete _cardCache[k];

  // Backwards-compat field initialization
  // Migrate old array-of-instances format to count map
  if (Array.isArray(state.buildings)) {
    const map = {};
    for (const b of state.buildings) {
      const k = groupKey(b);
      if (!map[k]) map[k] = { type: b.type, count: 0 };
      if (b.resource != null) map[k].resource = b.resource;
      if (b.recipe   != null) map[k].recipe   = b.recipe;
      map[k].count++;
    }
    state.buildings = map;
  }
  if (!state.buildings) state.buildings = {};

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
  if (!state.perimeter) state.perimeter = { sideLength: 14, walls: 0, gunTurrets: 0, laserTurrets: 0, ammoType: 'firearmMagazine' };
  if (state.perimeter.ammoType          == null) state.perimeter.ammoType          = 'firearmMagazine';
  if (state.perimeter.artillery         == null) state.perimeter.artillery         = 0;
  if (state.perimeter.artilleryRangeLevel  == null) state.perimeter.artilleryRangeLevel  = 0;
  if (state.perimeter.artilleryDamageLevel == null) state.perimeter.artilleryDamageLevel = 0;
  if (state.perimeter.spidertrons       == null) state.perimeter.spidertrons       = 0;
  if (state.perimeter.atomicBombsUsedThisWave == null) state.perimeter.atomicBombsUsedThisWave = 0;
  if (state.perimeter.irradiationLevel  == null) state.perimeter.irradiationLevel  = 0;
  if (state.biterThreatPoints == null) state.biterThreatPoints = 15/3000;
  // Migrate old saves: biterThreatPoints was in 0–500 scale, now 0–1
  if (state.biterThreatPoints > 5) state.biterThreatPoints = state.biterThreatPoints / 500;
  if (state.biterWavesAfterRainbow == null) state.biterWavesAfterRainbow = 0;
  // Biter activation migration
  if (state.biterActivated == null)
    state.biterActivated = (state.biterWaveNumber ?? 0) > 0 || (state.biterTimer ?? 0) > 0;
  if (state.savePlayTime  == null) state.savePlayTime  = 1800; // old saves: treat as already past 30min
  if (!state.biterSeenTiers)       state.biterSeenTiers = {};
  if (state.artilleryShellAcc    == null) state.artilleryShellAcc    = 0;
  if (state.artilleryAccumDamage == null) state.artilleryAccumDamage = 0;
  if (state.activeWave === undefined)     state.activeWave           = null;
  if (state.activeWave !== null)          state.activeWave           = null; // drop mid-wave on reload

  if (!state.inventoryDelta)           state.inventoryDelta   = {};
  if (!state.placementRecipes)         state.placementRecipes = defaultPlacementRecipes();
  if (state.devMode         == null)   state.devMode          = false;
  if (state.devFreeResearch == null)   state.devFreeResearch  = false;
  if (state.devTickSpeed    == null)   state.devTickSpeed     = 1;
  if (state.settings?.radarNotif == null) state.settings.radarNotif = true;
  if (state.settings?.defaultLimitBuilding == null) state.settings.defaultLimitBuilding = 10;
  if (state.settings?.defaultLimitOther    == null) state.settings.defaultLimitOther    = Infinity;
  if (state.settings?.tutorialEnabled == null) state.settings.tutorialEnabled = false; // old saves: off by default
  if (!state.tutorial) state.tutorial = { goalIndex: 0 };
  // Patch compat: ensure pendingFinds exists; nodes compat removed
  for (const [, patch] of Object.entries(state.patches ?? {})) {
    /* NODES: if (patch.nodes == null) patch.nodes = patch.remaining > 0 ? 5 : 0; */
    if (!patch.pendingFinds) patch.pendingFinds = [];
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
  if (state.research.infiniteAutoStart === undefined) state.research.infiniteAutoStart = null;
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
  if (!state.chests)        state.chests        = { common: 0, rare: 0, legendary: 0 };
  if (!state.chestUpgrades) state.chestUpgrades = {};
  if (!Array.isArray(state.chestHighPriority)) state.chestHighPriority = [];
  if (state.settings?.autoOpenCommon == null) state.settings.autoOpenCommon = false;
  if (state.settings?.autoOpenRare   == null) state.settings.autoOpenRare   = false;
  if (!state.chestFinds) {
    state.chestFinds = {
      common:    Array(state.chests?.common    ?? 0).fill(0),
      rare:      Array(state.chests?.rare      ?? 0).fill(0),
      legendary: Array(state.chests?.legendary ?? 0).fill(0),
    };
  }
  if (state.settings?.artilleryPaused      == null) state.settings.artilleryPaused      = false;
  if (state.settings?.autoSendArtilleryKill == null) state.settings.autoSendArtilleryKill = false;
  if (state.settings?.autoSendInstant       == null) state.settings.autoSendInstant       = false;
  if (!state.productionHistory) state.productionHistory = { samples: [], prodSamples: [], consSamples: [] };
  if (!state.productionHistory.prodSamples) state.productionHistory.prodSamples = [];
  if (!state.productionHistory.consSamples) state.productionHistory.consSamples = [];
  // All-time samples used to use Date.now() (wall-clock ms, ~1.7e12). Now uses savePlayTime (seconds, small).
  // Discard old samples so the X-axis is correct after load.
  if (!state.productionHistory.allTimeSamples) state.productionHistory.allTimeSamples = [];
  if (state.productionHistory.allTimeSamples.length > 0 && (state.productionHistory.allTimeSamples[0].t ?? 0) > 1e9)
    state.productionHistory.allTimeSamples = [];
  if (state.settings?.biterIntervalSecs  == null) state.settings.biterIntervalSecs  = 120;
  if (state.settings?.biterDifficultyMult == null) state.settings.biterDifficultyMult = 1;
  if (!state.seen) state.seen = {};
  if (state.bitersKilled == null) state.bitersKilled = 0;
  if (state.settings?.metaProgEnabled == null) {
    if (state.settings) state.settings.metaProgEnabled = false;
  }
  if (!state.itemsProduced) state.itemsProduced = {};
  if (!state.itemsConsumed) state.itemsConsumed = {};
  if (!state.patchConsumed)  state.patchConsumed  = {};
  if (!state.baseProduced)   state.baseProduced   = { ...state.itemsProduced }; // existing production is all base, no bonus
  if (!state.mapTiles)       state.mapTiles       = {};
  if (!state.tileBg)         state.tileBg         = {};
  if (!state.rateSnapshot) state.rateSnapshot = { time: 0, produced: {}, consumed: {} };
  if (!state.saveCreatedAt) state.saveCreatedAt = Date.now();
  if (state._deathHandled == null) state._deathHandled = false;

  // Merge meta state from save envelope
  if (isEnvelope && envelope.meta) {
    const def = defaultMetaState();
    const em  = envelope.meta;
    // Merge saveBlacklist from both envelope.meta and the current in-memory metaState
    // (current metaState was loaded from localStorage in loadMetaState() at startup)
    const mergedBlacklist = Array.from(new Set([
      ...(Array.isArray(em.saveBlacklist) ? em.saveBlacklist : []),
      ...(Array.isArray(metaState.saveBlacklist) ? metaState.saveBlacklist : []),
    ]));
    metaState = {
      ...def,
      ...em,
      perks: { ...def.perks, ...(em.perks ?? {}) },
      gamerModule: { ...def.gamerModule, ...(em.gamerModule ?? {}) },
      buildingUpgrades: { ...(em.buildingUpgrades ?? {}) },
      saveBlacklist: mergedBlacklist,
    };
    saveMetaState();
  }

  // Restore transient placement state
  if (placeRafId) clearTimeout(placeRafId);
  placeRafId = null; placing = false; currentPlacing = null;
  placeQueue = isEnvelope && Array.isArray(envelope.placeQueue) ? [...envelope.placeQueue] : []; _placeHead = 0;
  // Migrate old queue entries that used individual objects (acc/active/progress/displayName) without count
  placeQueue = placeQueue.map(e => {
    if (e.count != null) return e;
    const n = { type: e.type, count: e._batchCount ?? 1 };
    if (e.resource != null) n.resource = e.resource;
    if (e.recipe   != null) n.recipe   = e.recipe;
    if (e.initModuleType)   n.initModuleType = e.initModuleType;
    return n;
  });

  // Script content is restored in showGame() once the DOM is ready
  _pendingScriptRestore = isEnvelope
    ? { content: envelope.scriptContent ?? '', autoContent: envelope.scriptAutoContent ?? '', autoRun: envelope.scriptAutoRun ?? false }
    : null;

  // Blacklist check: if this save's timestamp is blacklisted, refuse to load it
  const _ts = state.saveCreatedAt;
  if (_ts && metaState.saveBlacklist?.includes(_ts)) {
    notify('This save has been permanently ended (world was ended or all buildings were destroyed).', 'warning');
    state = null;
    return false;
  }
  return true;
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
  const ok = applyStateFromEnvelope(envelope);
  if (!ok) return; // blocked by blacklist
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
    const ok = applyStateFromEnvelope(envelope);
    if (!ok) return;
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
      const ok = applyStateFromEnvelope(envelope);
      if (!ok) return;
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
  const ok = applyStateFromEnvelope(saved);
  if (!ok) return; // blocked by blacklist
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

function fmtNum(n) {
  const v = Math.floor(n);
  if (v >= 1_000_000) return v.toExponential(2);
  return v.toLocaleString();
}

// ── Group Helpers ─────────────────────────────────────────────

function groupKey(b) {
  const def = BUILDING_DEFS[b.type];
  if (def?.hasRecipe)   return `${b.type}:${b.recipe ?? ''}`;
  if (def?.hasResource) return `${b.type}:${b.resource ?? ''}`;
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
    state.groupSettings[key] = {
      enabled: true, coalAcc: 0, starved: false, limit: defLimit,
      radarAcc: 0, packAcc: 0, modules: {}, progress: 0,
      prodFrac: {}, active: false, selectedModuleType: 'speedMk1', activeCount: 0, priority: false
    };
    return state.groupSettings[key];
  }
  const gs = state.groupSettings[key];
  // Backward-compat for fields added after initial release (old saves may lack them)
  if (gs.limit       == null) gs.limit       = Infinity;
  if (gs.modules     == null) gs.modules     = {};
  if (gs.progress    == null) gs.progress    = 0;
  if (gs.prodFrac    == null) gs.prodFrac    = {};
  if (gs.activeCount == null) gs.activeCount = 0;
  if (gs.priority    == null) gs.priority    = false;
  if (!gs.selectedModuleType) gs.selectedModuleType = 'speedMk1';
  return gs;
}

function buildGroupMap() {
  if (!_groupsDirty && _groupsCache) return _groupsCache;
  const groups = {};
  const typeCounts = {};
  for (const [k, entry] of Object.entries(state.buildings)) {
    if (entry.count <= 0) continue;
    groups[k] = { key: k, type: entry.type, resource: entry.resource, recipe: entry.recipe, count: entry.count };
    typeCounts[entry.type] = (typeCounts[entry.type] ?? 0) + entry.count;
  }
  _groupsCache = groups;
  _typeCountsCache = typeCounts;
  _groupsDirty = false;
  return groups;
}

function totalBuildingCount() {
  return Object.values(state.buildings).reduce((s, e) => s + e.count, 0);
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

function clampByU235Reserve(recipe, n) {
  const netIn = (recipe.inputs.uranium235 ?? 0) - (recipe.outputs?.uranium235 ?? 0);
  if (netIn <= 0) return n;
  const canUse = Math.max(0, (state.inventory.uranium235 ?? 0) - 50);
  return Math.min(n, Math.floor(canUse / netIn));
}

function effectiveSteamMax() {
  buildGroupMap();
  return STEAM_MAX + (_typeCountsCache?.boiler ?? 0) * 200;
}

function effectiveWaterMax() {
  buildGroupMap();
  return WATER_MAX + (_typeCountsCache?.steamEngine ?? 0) * 200;
}

function metaEnergyMult(type) {
  if (!state?.settings?.metaProgEnabled) return 1;
  const pts = metaState?.buildingUpgrades?.[type] ?? 0;
  return Math.max(0.1, 1 - pts * 0.25);
}

function hasMetaPerk(id) {
  return !!(state?.settings?.metaProgEnabled && metaState.skillPerks?.[id]);
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
  return {
    speedMult: Math.max(0.2, 1 + speedBonus + metaSpeedBonus + chestSpeedBonus(type)),
    prodBonus: prodBonus + chestProdBonus(type),
  };
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
  if (!tech || tech.prereqs.length === 0) return true;
  const done = state.research.done;
  if (!includeQueue) return tech.canResearch(done);
  const queue = state.research.queue ?? [];
  return tech.prereqs.every(p =>
    done[p] || state.research.current === p || queue.includes(p)
  );
}

function pruneResearchQueue() {
  let changed = true;
  while (changed) {
    changed = false;
    state.research.queue = (state.research.queue ?? []).filter(k => {
      if (canResearchTech(k, true)) return true;
      changed = true;
      notify(`Removed from queue (missing prereq): ${TECHNOLOGIES[k]?.name ?? k}`, 'warning');
      return false;
    });
  }
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
    pruneResearchQueue();
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

function flashResearchTab() {
  const btn = document.getElementById('tab-btn-research');
  if (btn && !btn.classList.contains('active')) btn.classList.add('tab-alert');
}

function completeResearch(key) {
  state.research.done[key] = true;
  state.research.current = null;
  state.research.totalConsumed = 0;
  getGS('lab').packAcc = 0;
  notify(`✅ Researched: ${TECHNOLOGIES[key].name}!`, 'info');
  flashResearchTab();
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

  // If queue is now empty and auto-start is configured, start that infinite tech
  if (!state.research.current && state.research.infiniteAutoStart) {
    state.research.current = state.research.infiniteAutoStart;
    state.research.totalConsumed = 0;
    getGS('lab').starved = false;
  }

  renderUI();
}

const INFINITE_TECH_PREREQS = Object.fromEntries(
  Object.entries(INFINITE_TECHS)
    .filter(([, v]) => v.prereq)
    .map(([k, v]) => [k, v.prereq])
);

function startInfiniteTech(type) {
  buildGroupMap();
  if ((_typeCountsCache?.lab ?? 0) === 0) {
    notify('Place a Lab to conduct research.', 'warning'); return;
  }
  const prereq = INFINITE_TECH_PREREQS[type];
  if (prereq && !state.research.done?.[prereq]) {
    notify(`Requires ${TECHNOLOGIES[prereq]?.name ?? prereq} research.`, 'warning'); return;
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
    state.research.totalConsumed = (state.research.savedKey === type ? state.research.savedProgress : 0) ?? 0;
    state.research.savedKey = null;
    state.research.savedProgress = 0;
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

function toggleInfiniteAutoStart(techType) {
  if (!state) return;
  state.research.infiniteAutoStart = state.research.infiniteAutoStart === techType ? null : techType;
  lastRobotTechHtml = '';
  renderResearch();
}

function completeRobotResearch(type) {
  const def = INFINITE_TECHS[type];
  if (!def) return;
  state.research[def.stateField] = (state.research[def.stateField] ?? 0) + 1;
  const level = state.research[def.stateField];
  notify(`✅ ${def.displayName} Level ${level}!`, 'info');
  flashResearchTab();
  // Sync artillery-specific perimeter state
  if (type === 'artillery:range' && state.perimeter) state.perimeter.artilleryRangeLevel = level;
  if (type === 'artillery:damage' && state.perimeter) state.perimeter.artilleryDamageLevel = level;
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
      state.research.current = next;
      state.research.totalConsumed = 0;
      getGS('lab').starved = false;
      notify(`🔬 Auto-started: ${INFINITE_TECHS[next]?.displayName ?? next}`, 'info');
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

  // If queue is now empty and auto-start is configured, start that infinite tech
  if (!state.research.current && state.research.infiniteAutoStart) {
    state.research.current = state.research.infiniteAutoStart;
    state.research.totalConsumed = 0;
    getGS('lab').starved = false;
  }

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
    /* NODES: patch.nodes += nodes; */
  } else {
    patch.pendingFinds.push({ remaining: amount, chunkIndex });
  }
}

function revealChunk() {
  state.chunksRevealed = (state.chunksRevealed ?? 0) + 1;

  // Chest drops: guaranteed common on 10th chunk, random thereafter
  if (!state.chestFinds) state.chestFinds = { common: [], rare: [], legendary: [] };
  const _ci = state.chunksRevealed;
  if (_ci === 10) {
    state.chestFinds.common.push(_ci);
    notify('📦 Found a Common Chest! (guaranteed first chest)', 'info');
  } else {
    const chestRoll = Math.random();
    if      (chestRoll < 1/1000) { state.chestFinds.legendary.push(_ci); notify('🟡 Found a Legendary Chest!', 'success'); }
    else if (chestRoll < 1/500)  { state.chestFinds.rare.push(_ci);      notify('🟣 Found a Rare Chest!', 'info'); }
    else if (chestRoll < 1/100)  { state.chestFinds.common.push(_ci);    notify('📦 Found a Common Chest!', 'info'); }
  }

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
    const techNote = state.research?.done?.uraniumProcessing ? '' : ' (requires Uranium Processing tech to harvest)';
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

// ── Production / Consumption Tracking Helpers ─────────────────

function recordProduced(key, amount) {
  if (!amount || amount <= 0) return;
  state.itemsProduced[key] = (state.itemsProduced[key] ?? 0) + amount;
  state.inventory[key] = (state.inventory[key] ?? 0) + amount;
}

function recordConsumed(key, amount) {
  if (!amount || amount <= 0) return;
  state.itemsConsumed[key] = (state.itemsConsumed[key] ?? 0) + amount;
  state.inventory[key] = Math.max(0, (state.inventory[key] ?? 0) - amount);
}

// Refund items to inventory without counting as production (cancel craft, sell building, etc.)
function refundItem(key, amount) {
  if (!amount || amount <= 0) return;
  state.inventory[key] = (state.inventory[key] ?? 0) + amount;
}

// Rate snapshot state (module-level, not persisted)
let rateTickCount = 0;
const RATE_WINDOW_SECS = 5;

// ── Game Loop ─────────────────────────────────────────────────

function tick() {
  if (_gamePaused) return;
  const _tTick = _p0();
  const dt     = TICK_MS / 1000 * (state?.devTickSpeed ?? 1);

  // Auto-save every 5 minutes of play time
  _autoSaveTimer += dt;
  if (_autoSaveTimer >= 300) { _autoSaveTimer = 0; saveGame(); }
  const _tGrp = _p0(); const groups = buildGroupMap(); _p1('buildGroupMap', _tGrp);

  // ── Compute total power demand (uses last tick's powerKw) ──
  const _tPD = _p0();
  let totalDemand = 0;
  for (const [key, group] of Object.entries(groups)) {
    const baseKw = BUILDING_KW_TABLE[group.type];
    if (!baseKw) continue;
    const gs = getGS(key);
    if (!gs.enabled) continue;
    totalDemand += baseKw * metaEnergyMult(group.type) * group.count;
  }
  if (state.activeWave) totalDemand += (state.perimeter?.laserTurrets ?? 0) * LASER_KW_PER_TURRET;
  if (state.allPaused) totalDemand = 0;
  state.powerDemandKw = totalDemand;
  const powerRatio = totalDemand > 0 ? Math.min(1, state.powerKw / totalDemand) : 1;
  state.powerRatio = powerRatio;
  _p1('powerDemand', _tPD);

  if (!state.allPaused) { // ── Production ──

  // ── Coal for miners, furnaces & steel furnaces ──
  const _tCoal = _p0();
  for (const [key, group] of Object.entries(groups)) {
    if (group.type !== 'miner' && group.type !== 'furnace' && group.type !== 'steelFurnace') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.starved = true; continue; }
    const rate = group.type === 'miner' ? COAL_PER_MINER
               : group.type === 'steelFurnace' ? COAL_PER_STEEL_FURNACE
               : COAL_PER_FURNACE;
    gs.coalAcc = (gs.coalAcc ?? 0) + group.count * rate * dt;
    if (gs.coalAcc >= 1) {
      const needed = Math.floor(gs.coalAcc);
      if (state.inventory.coal >= needed) {
        recordConsumed('coal', needed); gs.coalAcc -= needed; gs.starved = false;
      } else {
        const avail = state.inventory.coal;
        if (avail > 0) recordConsumed('coal', avail);
        else state.inventory.coal = 0;
        gs.coalAcc = 0; gs.starved = true;
      }
    } else { gs.starved = (state.inventory.coal <= 0); }
  }
  _p1('coal', _tCoal);

  // ── Burner Miners ── (group-level, like electric miners)
  const _tBM = _p0();
  for (const [key, group] of Object.entries(groups)) {
    if (group.type !== 'miner') continue;
    const gs = getGS(key);
    if (gs.starved) continue;
    if (!patchInPerimeter(group.resource)) { gs.outsidePerimeter = true; continue; }
    gs.outsidePerimeter = false;
    if ((state.inventory[group.resource] ?? 0) >= gs.limit) continue;
    const patch = state.patches[group.resource];
    if (!patch || patch.remaining <= 0) continue;
    const count = group.count;
    gs.acc = (gs.acc ?? 0) + count * MINE_SPEED * (1 + chestSpeedBonus('miner')) * dt;
    if (gs.acc >= 1) {
      const n = Math.min(Math.floor(gs.acc), patch.remaining);
      const produced = n * miningProdMult();
      recordProduced(group.resource, produced);
      patch.remaining -= n; gs.acc -= n;
      state.patchConsumed[group.resource] = (state.patchConsumed[group.resource] ?? 0) + n;
    }
  }
  _p1('burnerMiners', _tBM);

  // ── Electric Miners ── (aggregated per resource group)
  const _tEM = _p0();
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
    const count = group.count;
    const { speedMult } = calcGroupModifiers('electricMiner', count, gs.modules);
    gs.acc = (gs.acc ?? 0) + count * ELECTRIC_MINER_SPEED * speedMult * dt * powerRatio;
    if (gs.acc >= 1) {
      let n = Math.min(Math.floor(gs.acc), patch.remaining);
      if (group.resource === 'uraniumOre') {
        n = Math.min(n, Math.floor(state.inventory.sulfuricAcid ?? 0));
        if (n <= 0) { gs.acidStarved = true; gs.acc = 0; continue; }
        recordConsumed('sulfuricAcid', n);
        gs.acidStarved = false;
      }
      const prod = group.resource === 'uraniumOre' ? 1 : miningProdMult();
      recordProduced(group.resource, n * prod);
      patch.remaining -= n; gs.acc -= n;
      state.patchConsumed[group.resource] = (state.patchConsumed[group.resource] ?? 0) + n;
    }
  }
  _p1('electricMiners', _tEM);

  // ── Recipe buildings: sorted so high-priority groups consume inputs first ──
  const sortedGroupEntries = Object.entries(groups).sort(([ka], [kb]) =>
    (getGS(ka).priority ? 0 : 1) - (getGS(kb).priority ? 0 : 1)
  );

  // ── Furnaces (stone) — aggregated ──
  const _tSF = _p0();
  for (const [key, group] of sortedGroupEntries) {
    if (group.type !== 'furnace') continue;
    const gs = getGS(key);
    if (gs.starved) { gs.active = false; gs.progress = 0; gs.activeCount = 0; continue; }
    const recipe = FURNACE_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; gs.activeCount = 0; continue; }
    const count = group.count;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('furnace', count, gs.modules);
    const inv = Math.floor(state.inventory[outputKey] ?? 0);
    const atLimit = inv >= gs.limit;
    const activeN = atLimit ? 0 : Math.min(count, howManyCanAfford(recipe.inputs, count));
    gs.activeCount = activeN;
    gs.progress += activeN * speedMult / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      if (atLimit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = clampByU235Reserve(recipe, Math.min(afford, byLimit, cycles));
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) recordConsumed(k, v * actual);
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              if (w > 0) recordProduced(k, w);
            }
            for (const [k, v] of Object.entries(recipe.outputs))
              state.baseProduced[k] = (state.baseProduced[k] ?? 0) + v * actual;
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }
  _p1('stoneFurnaces', _tSF);

  // ── Steel Furnaces — aggregated ──
  const _tStF = _p0();
  for (const [key, group] of sortedGroupEntries) {
    if (group.type !== 'steelFurnace') continue;
    const gs = getGS(key);
    if (gs.starved) { gs.active = false; gs.progress = 0; gs.activeCount = 0; continue; }
    const recipe = FURNACE_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; gs.activeCount = 0; continue; }
    const count = group.count;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('steelFurnace', count, gs.modules);
    const inv = Math.floor(state.inventory[outputKey] ?? 0);
    const atLimit = inv >= gs.limit;
    const activeN = atLimit ? 0 : Math.min(count, howManyCanAfford(recipe.inputs, count));
    gs.activeCount = activeN;
    gs.progress += activeN * speedMult * STEEL_FURNACE_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      if (atLimit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = clampByU235Reserve(recipe, Math.min(afford, byLimit, cycles));
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) recordConsumed(k, v * actual);
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              if (w > 0) recordProduced(k, w);
            }
            for (const [k, v] of Object.entries(recipe.outputs))
              state.baseProduced[k] = (state.baseProduced[k] ?? 0) + v * actual;
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }
  _p1('steelFurnaces', _tStF);

  // ── Assembly Machines Mk1 — aggregated ──
  const _tA1 = _p0();
  for (const [key, group] of sortedGroupEntries) {
    if (group.type !== 'assembly') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.active = false; gs.activeCount = 0; continue; }
    gs.noPower = powerRatio < 1;
    const recipe = PLAYER_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; gs.activeCount = 0; continue; }
    const count = group.count;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('assembly', count, gs.modules);
    const inv = Math.floor(state.inventory[outputKey] ?? 0);
    const atLimit = inv >= gs.limit;
    const activeN = atLimit ? 0 : Math.min(count, howManyCanAfford(recipe.inputs, count));
    gs.activeCount = activeN;
    gs.progress += activeN * speedMult * powerRatio * ASSEMBLY_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      if (atLimit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = clampByU235Reserve(recipe, Math.min(afford, byLimit, cycles));
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) recordConsumed(k, v * actual);
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              if (w > 0) recordProduced(k, w);
            }
            for (const [k, v] of Object.entries(recipe.outputs))
              state.baseProduced[k] = (state.baseProduced[k] ?? 0) + v * actual;
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }
  _p1('assembly1', _tA1);

  // ── Assembly Machines Mk2 — aggregated ──
  const _tA2 = _p0();
  for (const [key, group] of sortedGroupEntries) {
    if (group.type !== 'assembly2') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.active = false; gs.activeCount = 0; continue; }
    gs.noPower = powerRatio < 1;
    const recipe = PLAYER_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; gs.activeCount = 0; continue; }
    const count = group.count;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('assembly2', count, gs.modules);
    const inv = Math.floor(state.inventory[outputKey] ?? 0);
    const atLimit = inv >= gs.limit;
    const activeN = atLimit ? 0 : Math.min(count, howManyCanAfford(recipe.inputs, count));
    gs.activeCount = activeN;
    gs.progress += activeN * speedMult * powerRatio * ASSEMBLY2_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      if (atLimit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = clampByU235Reserve(recipe, Math.min(afford, byLimit, cycles));
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) recordConsumed(k, v * actual);
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              if (w > 0) recordProduced(k, w);
            }
            for (const [k, v] of Object.entries(recipe.outputs))
              state.baseProduced[k] = (state.baseProduced[k] ?? 0) + v * actual;
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }
  _p1('assembly2', _tA2);

  // ── Assembly Machines Mk3 — aggregated ──
  const _tA3 = _p0();
  for (const [key, group] of sortedGroupEntries) {
    if (group.type !== 'assembly3') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.active = false; gs.activeCount = 0; continue; }
    gs.noPower = powerRatio < 1;
    const recipe = PLAYER_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; gs.activeCount = 0; continue; }
    const count = group.count;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('assembly3', count, gs.modules);
    const inv = Math.floor(state.inventory[outputKey] ?? 0);
    const atLimit = inv >= gs.limit;
    const activeN = atLimit ? 0 : Math.min(count, howManyCanAfford(recipe.inputs, count));
    gs.activeCount = activeN;
    gs.progress += activeN * speedMult * powerRatio * ASSEMBLY3_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      if (atLimit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = clampByU235Reserve(recipe, Math.min(afford, byLimit, cycles));
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) recordConsumed(k, v * actual);
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              if (w > 0) recordProduced(k, w);
            }
            for (const [k, v] of Object.entries(recipe.outputs))
              state.baseProduced[k] = (state.baseProduced[k] ?? 0) + v * actual;
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }
  _p1('assembly3', _tA3);

  // ── Electric Furnaces — aggregated ──
  const _tEF = _p0();
  for (const [key, group] of sortedGroupEntries) {
    if (group.type !== 'electricFurnace') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.active = false; gs.activeCount = 0; continue; }
    gs.noPower = powerRatio < 1;
    const recipe = FURNACE_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; gs.activeCount = 0; continue; }
    const count = group.count;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('electricFurnace', count, gs.modules);
    const inv = Math.floor(state.inventory[outputKey] ?? 0);
    const atLimit = inv >= gs.limit;
    const activeN = atLimit ? 0 : Math.min(count, howManyCanAfford(recipe.inputs, count));
    gs.activeCount = activeN;
    gs.progress += activeN * speedMult * powerRatio * ELECTRIC_FURNACE_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      if (atLimit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = clampByU235Reserve(recipe, Math.min(afford, byLimit, cycles));
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) recordConsumed(k, v * actual);
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              if (w > 0) recordProduced(k, w);
            }
            for (const [k, v] of Object.entries(recipe.outputs))
              state.baseProduced[k] = (state.baseProduced[k] ?? 0) + v * actual;
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }
  _p1('electricFurnaces', _tEF);

  // ── Pumpjacks — aggregated per resource group ──
  const _tPJ = _p0();
  for (const [key, group] of Object.entries(groups)) {
    if (group.type !== 'pumpjack') continue;
    const gs = getGS(key);
    if (!gs.enabled) continue;
    gs.noPower = powerRatio < 1;
    const patch = state.patches[group.resource];
    if (!patch || patch.remaining <= 0) { gs.starved = true; continue; }
    gs.starved = false;
    const count = group.count;
    const extracted = Math.min(PUMPJACK_SPEED * miningProdMult() * count * dt * powerRatio, patch.remaining);
    patch.remaining -= extracted;
    recordProduced(group.resource, extracted);
  }
  _p1('pumpjacks', _tPJ);

  // ── Oil Refineries — aggregated ──
  const _tOR = _p0();
  for (const [key, group] of sortedGroupEntries) {
    if (group.type !== 'oilRefinery') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.active = false; gs.activeCount = 0; continue; }
    gs.noPower = powerRatio < 1;
    const recipe = PLAYER_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; gs.activeCount = 0; continue; }
    const count = group.count;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('oilRefinery', count, gs.modules);
    const inv = Math.floor(state.inventory[outputKey] ?? 0);
    const atLimit = inv >= gs.limit;
    const activeN = atLimit ? 0 : Math.min(count, howManyCanAfford(recipe.inputs, count));
    gs.activeCount = activeN;
    gs.progress += activeN * speedMult * powerRatio * OIL_REFINERY_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      if (atLimit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = clampByU235Reserve(recipe, Math.min(afford, byLimit, cycles));
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) recordConsumed(k, v * actual);
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              if (w > 0) recordProduced(k, w);
            }
            for (const [k, v] of Object.entries(recipe.outputs))
              state.baseProduced[k] = (state.baseProduced[k] ?? 0) + v * actual;
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }
  _p1('oilRefineries', _tOR);

  // ── Chemical Plants — aggregated ──
  const _tCP = _p0();
  for (const [key, group] of sortedGroupEntries) {
    if (group.type !== 'chemicalPlant') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.active = false; gs.activeCount = 0; continue; }
    gs.noPower = powerRatio < 1;
    const recipe = PLAYER_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; gs.activeCount = 0; continue; }
    const count = group.count;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('chemicalPlant', count, gs.modules);
    const inv = Math.floor(state.inventory[outputKey] ?? 0);
    const atLimit = inv >= gs.limit;
    const activeN = atLimit ? 0 : Math.min(count, howManyCanAfford(recipe.inputs, count));
    gs.activeCount = activeN;
    gs.progress += activeN * speedMult * powerRatio * CHEMICAL_PLANT_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      if (atLimit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = clampByU235Reserve(recipe, Math.min(afford, byLimit, cycles));
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) recordConsumed(k, v * actual);
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              if (w > 0) recordProduced(k, w);
            }
            for (const [k, v] of Object.entries(recipe.outputs))
              state.baseProduced[k] = (state.baseProduced[k] ?? 0) + v * actual;
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }
  _p1('chemPlants', _tCP);

  // ── Centrifuges — aggregated ──
  const _tCen = _p0();
  for (const [key, group] of sortedGroupEntries) {
    if (group.type !== 'centrifuge') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.active = false; gs.activeCount = 0; continue; }
    gs.noPower = powerRatio < 1;
    const recipe = PLAYER_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; gs.activeCount = 0; continue; }
    const count = group.count;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('centrifuge', count, gs.modules);
    const inv = Math.floor(state.inventory[outputKey] ?? 0);
    const atLimit = inv >= gs.limit;
    const activeN = atLimit ? 0 : Math.min(count, howManyCanAfford(recipe.inputs, count));
    gs.activeCount = activeN;
    gs.progress += activeN * speedMult * powerRatio * CENTRIFUGE_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      if (atLimit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = clampByU235Reserve(recipe, Math.min(afford, byLimit, cycles));
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) recordConsumed(k, v * actual);
            if (group.recipe === 'uraniumProcessing') {
              for (let i = 0; i < actual; i++) {
                state.uraniumProcessingCount = (state.uraniumProcessingCount ?? 0) + 1;
                if (state.uraniumProcessingCount % 143 === 0) {
                  recordProduced('uranium235', 1);
                  state.baseProduced['uranium235'] = (state.baseProduced['uranium235'] ?? 0) + 1;
                } else {
                  recordProduced('uranium238', 1);
                  state.baseProduced['uranium238'] = (state.baseProduced['uranium238'] ?? 0) + 1;
                }
              }
            } else {
              for (const [k, v] of Object.entries(recipe.outputs)) {
                const tot = v * actual * (1 + prodBonus);
                gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
                const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
                if (w > 0) recordProduced(k, w);
              }
              for (const [k, v] of Object.entries(recipe.outputs))
                state.baseProduced[k] = (state.baseProduced[k] ?? 0) + v * actual;
            }
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }
  _p1('centrifuges', _tCen);

  // ── Rocket Silos — aggregated ──
  const _tRS = _p0();
  for (const [key, group] of sortedGroupEntries) {
    if (group.type !== 'rocketSilo') continue;
    const gs = getGS(key);
    if (!gs.enabled) { gs.active = false; gs.activeCount = 0; continue; }
    gs.noPower = powerRatio < 1;
    const recipe = PLAYER_RECIPES[group.recipe];
    if (!recipe) { gs.active = false; gs.activeCount = 0; continue; }
    const count = group.count;
    const outputKey = Object.keys(recipe.outputs)[0];
    const { speedMult, prodBonus } = calcGroupModifiers('rocketSilo', count, gs.modules);
    const inv = Math.floor(state.inventory[outputKey] ?? 0);
    const atLimit = inv >= gs.limit;
    const activeN = atLimit ? 0 : Math.min(count, howManyCanAfford(recipe.inputs, count));
    gs.activeCount = activeN;
    gs.progress += activeN * speedMult * powerRatio * ROCKET_SILO_SPEED / recipe.time * dt;
    gs.progress = Math.min(gs.progress, count * 4);
    const cycles = Math.floor(gs.progress);
    if (cycles > 0) {
      if (atLimit) { gs.progress = 0; gs.active = false; }
      else {
        const afford = howManyCanAfford(recipe.inputs, cycles);
        if (afford === 0) { gs.progress = 0; gs.active = false; }
        else {
          const outAmt = recipe.outputs[outputKey];
          const byLimit = gs.limit === Infinity ? cycles : Math.max(0, Math.floor((gs.limit - inv) / outAmt));
          const actual = clampByU235Reserve(recipe, Math.min(afford, byLimit, cycles));
          if (actual > 0) {
            for (const [k, v] of Object.entries(recipe.inputs)) recordConsumed(k, v * actual);
            for (const [k, v] of Object.entries(recipe.outputs)) {
              const tot = v * actual * (1 + prodBonus);
              gs.prodFrac[k] = (gs.prodFrac[k] ?? 0) + tot;
              const w = Math.floor(gs.prodFrac[k]); gs.prodFrac[k] -= w;
              if (w > 0) recordProduced(k, w);
            }
            for (const [k, v] of Object.entries(recipe.outputs))
              state.baseProduced[k] = (state.baseProduced[k] ?? 0) + v * actual;
            gs.progress -= actual; gs.active = true;
          } else { gs.progress = 0; gs.active = false; }
        }
      }
    }
  }
  _p1('rocketSilos', _tRS);

  // ── Offshore Pumps ──
  const _tOSP = _p0();
  const pumpGroup = groups['offshoreP'];
  if (pumpGroup) {
    const gs = getGS('offshoreP');
    if (gs.enabled) { state.water = Math.min(effectiveWaterMax(), state.water + pumpGroup.count * OFFSHORE_PUMP_WATER_PER_SEC * dt); gs.starved = false; }
    else gs.starved = true;
  }
  _p1('offshorePumps', _tOSP);

  // ── Boilers ──
  const _tBoil = _p0();
  const boilerGroup = groups['boiler'];
  if (boilerGroup) {
    const gs = getGS('boiler');
    const count = boilerGroup.count;
    if (gs.enabled) {
      gs.coalAcc = (gs.coalAcc ?? 0) + count * BOILER_COAL_PER_SEC * dt;
      let coalOk = true;
      if (gs.coalAcc >= 1) {
        const needed = Math.floor(gs.coalAcc);
        if (state.inventory.coal >= needed) { recordConsumed('coal', needed); gs.coalAcc -= needed; }
        else { const coalLeft = state.inventory.coal ?? 0; if (coalLeft > 0) recordConsumed('coal', coalLeft); gs.coalAcc = 0; coalOk = false; }
      }
      const waterNeeded = count * BOILER_WATER_PER_SEC * dt;
      const waterOk = state.water >= waterNeeded;
      if (coalOk && waterOk) {
        state.water -= waterNeeded;
        state.steam = Math.min(effectiveSteamMax(), state.steam + count * BOILER_STEAM_PER_SEC * dt);
        gs.starved = false; gs.noWater = false;
      } else { gs.starved = true; gs.noWater = !waterOk; }
    } else { gs.starved = true; }
  }
  _p1('boilers', _tBoil);

  // ── Power generation: Solar → Nuclear → Steam (fills gap) → Accumulators ──
  const _tPGen = _p0();
  state.powerKw = 0;

  // Solar (unconditional, no fuel cost)
  const solarGroup = groups['solarPanel'];
  if (solarGroup) {
    const gs = getGS('solarPanel');
    if (gs.enabled) state.powerKw += solarGroup.count * SOLAR_PANEL_KW;
  }

  // Nuclear (fuel-gated)
  const nuclearGroup = groups['nuclearReactor'];
  if (nuclearGroup) {
    const gs    = getGS('nuclearReactor');
    const count = nuclearGroup.count;
    if (gs.enabled) {
      gs.fuelAcc = (gs.fuelAcc ?? 0) + count * dt / NUCLEAR_FUEL_INTERVAL;
      let fuelOk = true;
      if (gs.fuelAcc >= 1) {
        const needed = Math.floor(gs.fuelAcc);
        if ((state.inventory.uraniumFuelCell ?? 0) >= needed) {
          recordConsumed('uraniumFuelCell', needed);
          gs.fuelAcc -= needed;
        } else {
          gs.fuelAcc = 0;
          fuelOk = false;
        }
      } else if ((state.inventory.uraniumFuelCell ?? 0) === 0) {
        fuelOk = false;
      }
      if (fuelOk) { state.powerKw += count * NUCLEAR_REACTOR_KW; gs.starved = false; }
      else { gs.starved = true; }
    } else { gs.starved = true; }
  }

  // Steam engines: cover shortfall + 5% buffer so adding buildings doesn't flicker
  const engineGroup = groups['steamEngine'];
  if (engineGroup) {
    const gs        = getGS('steamEngine');
    const count     = engineGroup.count;
    const steamMult = hasMetaPerk('perk_steam_output') ? 1.10 : 1;
    const maxKw     = count * STEAM_ENGINE_KW * steamMult;
    const shortfall = Math.max(0, totalDemand * 1.05 - state.powerKw);
    if (!gs.enabled) {
      gs.starved = false; gs.standby = false;
      state.powerCapacityKw = state.powerKw;
    } else if (shortfall === 0) {
      // Solar/nuclear already covers 105%+ of demand — engines idle, no steam consumed
      gs.starved = false; gs.standby = true;
      state.powerCapacityKw = state.powerKw + maxKw;
    } else if (state.steam <= 0) {
      gs.starved = true; gs.standby = false;
      state.powerCapacityKw = state.powerKw;
    } else {
      gs.standby = false;
      const fraction      = Math.min(1, shortfall / maxKw);
      const steamToUse    = fraction * count * STEAM_ENGINE_STEAM_PER_SEC * dt;
      if (state.steam >= steamToUse) {
        state.steam    -= steamToUse;
        state.powerKw  += fraction * maxKw;
      } else {
        const partFrac  = state.steam / (count * STEAM_ENGINE_STEAM_PER_SEC * dt);
        state.powerKw  += partFrac * maxKw;
        state.steam     = 0;
      }
      gs.starved = false;
      state.powerCapacityKw = state.powerKw + (1 - fraction) * maxKw;
    }
  } else {
    state.powerCapacityKw = state.powerKw;
  }

  // Accumulators: discharge deficit, charge surplus
  const accGroup = groups['accumulator'];
  if (accGroup) {
    const gs = getGS('accumulator');
    const count = accGroup.count;
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
  _p1('powerGen', _tPGen);

  // ── Radar ──
  const _tRdr = _p0();
  const radarGroup = groups['radar'];
  if (radarGroup) {
    const gs = getGS('radar');
    if (gs.enabled) {
      const effectiveRadarTime = hasMetaPerk('perk_radar_speed') ? RADAR_CHUNK_TIME / 1.5 : RADAR_CHUNK_TIME;
      gs.radarAcc = (gs.radarAcc ?? 0) + radarGroup.count * powerRatio * dt;
      while (gs.radarAcc >= effectiveRadarTime) { gs.radarAcc -= effectiveRadarTime; revealChunk(); }
    }
  }
  _p1('radar', _tRdr);

  // ── Labs ──
  const _tLab = _p0();
  const labGroup = groups['lab'];
  if (labGroup && state.research.current) {
    const gs    = getGS('lab');
    const count = labGroup.count;
    const isInfiniteTech = state.research.current.includes(':');
    const techData = isInfiniteTech ? currentRobotTechData() : (() => {
      const t = TECHNOLOGIES[state.research.current];
      return t ? { cost: t.cost, timePerPack: t.timePerPack, totalNeeded: Math.max(...Object.values(t.cost)) } : null;
    })();
    if (gs.enabled && techData) {
      const { speedMult: labSpeedMult } = calcGroupModifiers('lab', count, gs.modules);
      const labPerkMult = hasMetaPerk('perk_lab_speed_1') ? 1.15 : 1;
      gs.packAcc = (gs.packAcc ?? 0) + count * labSpeedMult * labPerkMult * powerRatio * dt / techData.timePerPack;
      while (gs.packAcc >= 1) {
        const free = state.devFreeResearch && state.devMode;
        const hasAllPacks = free || Object.keys(techData.cost).every(pk => (state.inventory[pk] ?? 0) >= 1);
        if (hasAllPacks) {
          if (!free) for (const pk of Object.keys(techData.cost)) recordConsumed(pk, 1);
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
  _p1('labs', _tLab);

  // ── Hand Crafting (unified queue) ──
  if (!state.craftActive && state.craftQueue.length > 0) {
    const { key } = state.craftQueue.shift();
    const recipe = PLAYER_RECIPES[key];
    if (recipe) state.craftActive = { key, progress: 0 };
  }
  if (state.craftActive) {
    const recipe = PLAYER_RECIPES[state.craftActive.key];
    if (recipe) {
      state.craftActive.progress += dt / recipe.time;
      if (state.craftActive.progress >= 1) {
        for (const [item, amt] of Object.entries(recipe.outputs))
          recordProduced(item, amt);
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

  // ── Rate snapshot: derive inventoryDelta from explicit produced/consumed counters ──
  const _tRate = _p0();
  rateTickCount++;
  if (rateTickCount >= RATE_WINDOW_SECS * 10) { // 10 ticks/sec
    rateTickCount = 0;
    const snap = state.rateSnapshot;
    const elapsed = RATE_WINDOW_SECS;

    state.inventoryDelta = {};
    state.productionRates = {};
    state.consumptionRates = {};

    const allKeys = new Set([...Object.keys(state.itemsProduced), ...Object.keys(state.itemsConsumed)]);
    for (const key of allKeys) {
      const prod = (state.itemsProduced[key] ?? 0) - (snap.produced[key] ?? 0);
      const cons = (state.itemsConsumed[key] ?? 0) - (snap.consumed[key] ?? 0);
      const net  = prod - cons;
      if (Math.abs(net) > 0.0001)      state.inventoryDelta[key]    = net  / elapsed;
      if (prod > 0)                     state.productionRates[key]   = prod / elapsed;
      if (cons > 0)                     state.consumptionRates[key]  = cons / elapsed;
    }

    // Update snapshot
    state.rateSnapshot = {
      time: Date.now(),
      produced: { ...state.itemsProduced },
      consumed: { ...state.itemsConsumed },
    };

    // Populate productionHistory samples for graph using new rates
    if (!state.productionHistory) state.productionHistory = { samples: [], prodSamples: [], consSamples: [], allTimeSamples: [], allTimeInterval: 0 };
    if (!state.productionHistory.prodSamples) state.productionHistory.prodSamples = [];
    if (!state.productionHistory.consSamples) state.productionHistory.consSamples = [];
    if (!state.productionHistory.allTimeSamples) state.productionHistory.allTimeSamples = [];

    state.productionHistory.samples.push({ ...state.inventoryDelta });
    state.productionHistory.prodSamples.push({ ...state.productionRates });
    state.productionHistory.consSamples.push({ ...state.consumptionRates });
    if (state.productionHistory.samples.length     > 120) state.productionHistory.samples.shift();
    if (state.productionHistory.prodSamples.length > 120) state.productionHistory.prodSamples.shift();
    if (state.productionHistory.consSamples.length > 120) state.productionHistory.consSamples.shift();

    // All-time snapshot every 60 seconds
    state.productionHistory.allTimeInterval = (state.productionHistory.allTimeInterval ?? 0) + RATE_WINDOW_SECS;
    if (state.productionHistory.allTimeInterval >= 60) {
      state.productionHistory.allTimeInterval = 0;
      state.productionHistory.allTimeSamples.push({ t: state.savePlayTime ?? 0, produced: { ...state.itemsProduced } });
      if (state.productionHistory.allTimeSamples.length > 1440) state.productionHistory.allTimeSamples.shift();
    }
  }
  _p1('rates', _tRate);

  // ── Auto-run script ──
  const _tScr = _p0();
  if (scriptAutoRun) {
    scriptAutoTimer += dt;
    if (scriptAutoTimer >= SCRIPT_AUTO_INTERVAL) {
      scriptAutoTimer = 0;
      runAutoScript();
    }
  }
  _p1('autoScript', _tScr);

  // ── Biters ──
  const _tBit = _p0();
  if (state.settings.biters) {
    state.savePlayTime = (state.savePlayTime ?? 0) + dt;
    if (!state.biterActivated) {
      const redMade = (state.itemsProduced?.redScience ?? 0) > 0;
      if (redMade) { state.biterActivated = true; state.biterTimer = -(420 - biterInterval()); }
    } else {
      // Artillery fires continuously between waves (not during active wave resolution)
      const artCount = state.perimeter?.artillery ?? 0;
      if (artCount > 0 && !state.activeWave) {
        const waveStats = getBiterWaveStats();
        const waveHP    = waveStats.count * waveStats.hp;
        const waveDead  = (state.artilleryAccumDamage ?? 0) >= waveHP;
        if (!waveDead && !state.settings?.artilleryPaused) {
          state.artilleryShellAcc = (state.artilleryShellAcc ?? 0) + artCount * dt / ARTILLERY_FIRE_RATE;
          const shellsFired = Math.floor(state.artilleryShellAcc);
          if (shellsFired > 0) {
            state.artilleryShellAcc -= shellsFired;
            const artDmgPerShell = ARTILLERY_BASE_DAMAGE * artilleryDamageMult(state.perimeter.artilleryDamageLevel ?? 0);
            const shellsAvail = state.inventory.artilleryShell ?? 0;
            const shellsUsed  = Math.min(shellsFired, shellsAvail);
            if (shellsUsed > 0) {
              recordConsumed('artilleryShell', shellsUsed);
              state.artilleryAccumDamage = (state.artilleryAccumDamage ?? 0) + shellsUsed * artDmgPerShell;
            }
          }
        }
        // Detect when accumulated damage first crosses the kill threshold
        if ((state.artilleryAccumDamage ?? 0) >= waveHP && !state.waveKilledByArtillery) {
          state.waveKilledByArtillery = true;
          if (state.settings?.autoSendArtilleryKill) {
            skipToNextBiterWave();
          }
          lastPerimeterHtml = '';
        }
      }

      // Tick any in-progress wave simulation
      if (state.activeWave) tickActiveWave(dt);

      // Refresh wave outcome preview every 20s (pure sim, no side effects)
      _waveSimAge += dt;
      if (_waveSimAge >= 20) {
        _waveSimCache = simulateNextWaveOutcome();
        _waveSimAge   = 0;
        lastPerimeterHtml = '';  // force re-render with new sim result
      }

      state.biterTimer += dt;
      const interval = biterInterval();
      if (state.biterTimer >= interval) {
        state.biterTimer = 0;
        biterWaveWarned = false;
        fightBiterWave();
      } else if (!biterWaveWarned && interval - state.biterTimer <= 30) {
        biterWaveWarned = true;
        const tierName = getBiterEnemyTier()?.name ?? 'Biters';
        notify(`⚠️ ${tierName} wave incoming in ~${Math.ceil(interval - state.biterTimer)}s!`, 'warning');
      }
    }
  }
  _p1('biters', _tBit);

  // ── Death check: if biters are enabled and all buildings are gone ──
  if (state.settings?.biters && totalBuildingCount() === 0 && !state._deathHandled) {
    state._deathHandled = true;
    handleRunEnd('death');
    return; // stop further processing this tick
  }

  // Tutorial goal advancement — advance all at once if player completed multiple goals
  if (state.settings.tutorialEnabled && state.tutorial) {
    while (state.tutorial.goalIndex < TUTORIAL_GOALS.length) {
      const goal = TUTORIAL_GOALS[state.tutorial.goalIndex];
      if (!goal?.check(state)) break;
      state.tutorial.goalIndex++;
      notify(`🎯 Goal complete! Next: ${TUTORIAL_GOALS[state.tutorial.goalIndex]?.text ?? 'All goals done!'}`, 'info');
    }
  }

  // Auto-open chests if setting is on
  tickAutoOpenChests();

  _lastTickTime = Date.now();
  _p1('tick_total', _tTick);
}

// Opens all chests of a tier automatically (silently drains; notifications already fire per-chest)
function tickAutoOpenChests() {
  const s = state.settings;
  if (!s) return;
  const tiers = [];
  if (s.autoOpenCommon && chestAvailCount('common') > 0) tiers.push('common');
  if (s.autoOpenRare   && chestAvailCount('rare')   > 0) tiers.push('rare');
  for (const tier of tiers) {
    while (chestAvailCount(tier) > 0) {
      const eligible = getEligibleRewards(tier);
      if (eligible.length === 0) break;
      const shuffled = eligible.slice().sort(() => Math.random() - 0.5);
      const choices  = shuffled.slice(0, Math.min(3, shuffled.length));
      const highPrio = state.chestHighPriority ?? [];
      const hiMatches = choices.filter(r => highPrio.includes(r.id));
      const pick = hiMatches.length > 0
        ? hiMatches[Math.floor(Math.random() * hiMatches.length)]
        : choices[0];
      const tierLabel = tier === 'rare' ? '🟣 Rare' : '📦 Common';
      notify(`${tierLabel} chest auto-opened: ${pick.name} (Level ${(state.chestUpgrades?.[pick.id] ?? 0) + 1})`, 'info');
      popAvailChest(tier);
      state.chestUpgrades[pick.id] = (state.chestUpgrades[pick.id] ?? 0) + 1;
      _chestSectionHtml = '';
    }
  }
}

// ── Render Loop (decoupled from simulation tick) ──────────────
function startRenderLoop() {
  if (_renderLoopId) clearInterval(_renderLoopId);
  _renderLoopId = setInterval(() => {
    if (!state) return;
    const _tUI = _p0(); renderUI(); _p1('renderUI', _tUI);
  }, 33); // ~30fps display
}

function stopRenderLoop() {
  if (_renderLoopId) { clearInterval(_renderLoopId); _renderLoopId = null; }
}

// Extrapolates a displayed inventory amount using the known delta rate.
// Gives smooth-feeling number changes between simulation ticks.
function displayAmt(key) {
  const base = state.inventory[key] ?? 0;
  const rate = state.inventoryDelta?.[key] ?? 0;
  const elapsed = Math.min((Date.now() - _lastTickTime) / 1000, (TICK_MS / 1000) * 2);
  return Math.max(0, Math.floor(base + rate * elapsed));
}

// ── Placement Queue ───────────────────────────────────────────

function drillCountForResource(resource) {
  const g = buildGroupMap();
  const placed = (state.buildings[`miner:${resource}`]?.count ?? 0)
               + (state.buildings[`electricMiner:${resource}`]?.count ?? 0);
  const queued = placeQueue.slice(_placeHead)
    .filter(e => (e.type === 'miner' || e.type === 'electricMiner') && e.resource === resource)
    .reduce((s, e) => s + e.count, 0);
  return placed + queued;
}

function maxDrillsForResource(/*resource*/) {
  /* NODES: drill slot limit removed
  return state.patches[resource]?.nodes ?? 0;
  */
  return Infinity;
}

function placeBuilding(type, triggerEl, ev) {
  if (!isUnlocked('building', type)) { notify(`Research required to place this building.`, 'warning'); return; }

  const countEl = triggerEl?.closest('.place-row')?.querySelector('.place-count');
  const count = Math.max(1, parseInt(countEl?.value ?? '1') || 1);
  const frontOfQueue = !!(ev?.altKey);

  const pr = state.placementRecipes ?? defaultPlacementRecipes();
  const costs = BUILDING_COSTS[type];

  let resource = null, recipe = null;
  if (type === 'miner')              resource = pr.miner ?? 'ironOre';
  else if (type === 'electricMiner') resource = pr.electricMiner ?? 'ironOre';
  else if (type === 'pumpjack')      resource = 'crudeOil';
  else if (BUILDING_DEFS[type]?.hasRecipe) recipe = pr[type] ?? '';

  let actualCount = 0;
  for (let i = 0; i < count; i++) {
    if (!canAfford(costs)) { if (i === 0) notify(`Need ${COST_LABEL[type]} — craft it first`, 'warning'); break; }
    spend(costs);
    actualCount++;
  }

  if (actualCount > 0) {
    const entry = { type, count: actualCount };
    if (resource != null) entry.resource = resource;
    if (recipe   != null) entry.recipe   = recipe;
    if (frontOfQueue) _placeEnqueueFront(entry);
    else placeQueue.push(entry);
    updatePlacementUI();
    if (!placing) processNextPlacement();
    if (triggerEl) {
      const btn = triggerEl.closest('.btn-place') ?? triggerEl;
      btn.classList.add('btn-active-flash');
      setTimeout(() => btn.classList.remove('btn-active-flash'), 250);
    }
  }
}

function _placeDequeue() {
  if (_placeHead >= placeQueue.length) return undefined;
  const v = placeQueue[_placeHead++];
  if (_placeHead >= 256 && _placeHead * 2 >= placeQueue.length) {
    placeQueue = placeQueue.slice(_placeHead);
    _placeHead = 0;
  }
  return v;
}

function _placeEnqueueFront(entry) {
  const head = placeQueue[_placeHead];
  if (head && groupKey(head) === groupKey(entry)) {
    head.count += entry.count;
  } else if (_placeHead > 0) {
    placeQueue[--_placeHead] = entry;
  } else {
    placeQueue = [entry, ...placeQueue.slice(_placeHead)];
    _placeHead = 0;
  }
}

function processNextPlacement() {
  if (_placeHead >= placeQueue.length) {
    placing = false;
    currentPlacing = null;
    updatePlacementUI();
    return;
  }
  currentPlacing  = placeQueue[_placeHead];
  placing         = true;
  placeStartMs    = performance.now();
  _placeElapsedMs = 0;
  if (placeRafId) clearTimeout(placeRafId);
  tickPlacement();
}

function tickPlacement() {
  const { time: placeTimeSec, batch: placeBatch } = computePlaceTimeSec();
  const now       = performance.now();
  const wallDelta = now - placeStartMs;
  placeStartMs    = now;
  if (!_gamePaused) _placeElapsedMs += wallDelta * (state?.devTickSpeed ?? 1);
  const pct = Math.min(_placeElapsedMs / (placeTimeSec * 1000), 1);
  document.getElementById('place-progress').style.width = (pct * 100) + '%';
  updatePlacementUI(placeBatch);
  if (pct >= 1) {
    const entry = placeQueue[_placeHead];
    if (!entry) { processNextPlacement(); return; }
    const toPlace = Math.min(placeBatch, entry.count);
    const k = groupKey(entry);
    if (!state.buildings[k]) state.buildings[k] = { type: entry.type, count: 0,
      ...(entry.resource != null && { resource: entry.resource }),
      ...(entry.recipe   != null && { recipe:   entry.recipe   }) };
    state.buildings[k].count += toPlace;
    if (entry.initModuleType) fillGroupModules(k, entry.initModuleType);
    entry.count -= toPlace;
    if (entry.count <= 0) _placeDequeue();
    _groupsDirty = true; _typeCountsCache = null;
    processNextPlacement();
  } else {
    placeRafId = setTimeout(tickPlacement, 16);
  }
}

function updatePlacementUI(placeBatch) {
  const label = document.getElementById('placement-label');
  const queueInfo = document.getElementById('place-queue-info');
  if (placing && currentPlacing) {
    const batchStr = currentPlacing.count > 1 ? ` ×${currentPlacing.count.toLocaleString()}` : '';
    const name = BUILDING_DEFS[currentPlacing.type]?.name ?? currentPlacing.type;
    label.textContent = `Placing ${name}${batchStr}…`;
    const otherQueued = placeQueue.slice(_placeHead + 1).reduce((s, e) => s + e.count, 0);
    if (queueInfo) queueInfo.textContent = otherQueued > 0 ? `+${otherQueued} queued` : '';
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
  recordProduced(resource, 1);
  patch.remaining--;
  state.patchConsumed[resource] = (state.patchConsumed[resource] ?? 0) + 1;
  miningCooldowns[resource] = true;
  setTimeout(() => { delete miningCooldowns[resource]; renderMining(); }, 500);
  renderInventory();
}

// ── Crafting Actions ──────────────────────────────────────────

function queueCraft(key, shiftHeld) {
  const n = shiftHeld ? 5 : 1;
  const recipe = PLAYER_RECIPES[key];
  if (!recipe) return;
  let queued = 0;
  for (let i = 0; i < n; i++) {
    if (!canAfford(recipe.inputs)) break;
    for (const [k, v] of Object.entries(recipe.inputs)) recordConsumed(k, v);
    state.craftQueue.push({ key });
    queued++;
  }
  if (queued > 0) renderCrafting();
}

function cancelCraftQueue(key) {
  const recipe = PLAYER_RECIPES[key];
  if (recipe) {
    if (state.craftActive?.key === key) {
      for (const [item, amt] of Object.entries(recipe.inputs)) refundItem(item, amt);
      state.craftActive = null;
    }
    const queued = state.craftQueue.filter(e => e.key === key).length;
    for (let i = 0; i < queued; i++)
      for (const [item, amt] of Object.entries(recipe.inputs)) refundItem(item, amt);
  } else {
    if (state.craftActive?.key === key) state.craftActive = null;
  }
  state.craftQueue = state.craftQueue.filter(e => e.key !== key);
  renderCrafting();
}

// ── Building Actions ──────────────────────────────────────────

function togglePriority(key) {
  const gs = getGS(key);
  gs.priority = !gs.priority;
  renderBuildings();
}

function toggleGroup(key) {
  const gs = getGS(key);
  const enabling = !gs.enabled;
  gs.enabled = enabling;
  gs.coalAcc = 0;
  gs.starved = !enabling;
  if (enabling && state.allPaused) state.allPaused = false;
  renderBuildings();
}

function setBuildingAddCount(key, val) {
  const n = Math.max(1, parseInt(val) || 1);
  buildingAddCounts[key] = n;
}

function removeOneFromGroup(key) {
  const entry = state.buildings[key];
  if (!entry || entry.count <= 0) return;
  const type = entry.type;
  entry.count--;
  if (entry.count <= 0) {
    delete state.buildings[key];
    delete state.groupSettings[key];
  }
  _groupsDirty = true; _typeCountsCache = null;
  const costs = BUILDING_COSTS[type];
  if (costs) for (const [item, amt] of Object.entries(costs)) refundItem(item, amt);
  renderBuildings();
}

function changeGroupRecipe(oldKey, recipe, type) {
  const newKey = `${type}:${recipe}`;
  const entry = state.buildings[oldKey];
  if (!entry) return;
  if (oldKey !== newKey) {
    entry.recipe = recipe;
    if (state.buildings[newKey]) {
      state.buildings[newKey].count += entry.count;
    } else {
      state.buildings[newKey] = entry;
    }
    delete state.buildings[oldKey];
    state.groupSettings[newKey] = state.groupSettings[oldKey] ?? getGS(newKey);
    delete state.groupSettings[oldKey];
  } else {
    entry.recipe = recipe;
  }
  _groupsDirty = true; _typeCountsCache = null;
  renderBuildings();
}

function setGroupLimit(key, rawValue) {
  const s = String(rawValue).trim().toLowerCase();
  const v = (s === '' || s === 'inf' || s === 'infinity' || s === '∞')
    ? Infinity
    : parseFloat(s);
  getGS(key).limit = isNaN(v) ? 50 : Math.max(0, v);
}

// ── AGENT WARNING: Button flicker in re-rendered lists ──────────────────────
// Buttons inside innerHTML-replaced containers flicker on hover and miss clicks.
// Use all three guards: (1) HTML caching — only set innerHTML when content
// changed, (2) event delegation — attach handlers on stable parent elements,
// (3) mouseHeld guard — track mousedown so fast clicks still register.
// Do NOT put onclick= handlers in template literals inside render functions.
// ────────────────────────────────────────────────────────────────────────────

// ── Rendering ─────────────────────────────────────────────────

function generatePerfReport() {
  const rows = Object.entries(_prof.samples).map(([name, samples]) => {
    if (!samples.length) return null;
    const sorted = [...samples].sort((a, b) => a - b);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const p95  = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
    const max  = sorted[sorted.length - 1];
    return { name, n: samples.length, mean, p95, max };
  }).filter(Boolean).sort((a, b) => b.mean - a.mean);

  const pad = (s, w) => String(s).padStart(w);
  const header = `${'Section'.padEnd(22)} |    N  |  Mean ms |  P95 ms  |  Max ms\n` +
                 `${''.padEnd(22, '-')} | ----- | -------- | -------- | --------\n`;
  const fmtRow = r =>
    `${r.name.padEnd(22)} | ${pad(r.n, 5)} | ${pad(r.mean.toFixed(3), 8)} | ${pad(r.p95.toFixed(3), 8)} | ${pad(r.max.toFixed(3), 8)}\n`;

  return `=== Factorio Idle Performance Report ===\nGenerated: ${new Date().toISOString()}\nWindow: ${_prof.WINDOW} samples per section\n\n` + header + rows.map(fmtRow).join('');
}

async function savePerfReport() {
  const report = generatePerfReport();
  if (window.fileAPI?.savePerf) {
    const result = await window.fileAPI.savePerf(report, _profFilename);
    notify(`Perf report saved: ${result.filename}`, 'info');
  } else {
    console.log(report);
    notify('Perf report logged to console (no fileAPI)', 'info');
  }
}

function toggleProfiling(on) {
  _prof.enabled = !!on;
  if (!on) _prof.samples = {};
  renderDevPanel();
}

function renderDevPanel() {
  const el = document.getElementById('dev-panel');
  if (!el) return;
  if (!state.devMode) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');

  // Read filename input before any potential re-render so typed text isn't lost
  const existingInput = el.querySelector('.dev-perf-input');
  if (existingInput) _profFilename = existingInput.value;

  const speed = state.devTickSpeed ?? 1;
  const hasData = Object.values(_prof.samples).some(a => a.length > 0);
  const key = `${_prof.enabled}|${hasData}|${speed}|${!!state.devFreeResearch}`;
  if (key === _devPanelKey) return; // nothing structural changed — preserve input focus
  _devPanelKey = key;

  const speeds = [1, 2, 5, 10, 25];
  el.innerHTML = `<span class="dev-label">DEV MODE</span>` +
    `<label class="dev-toggle-label"><input type="checkbox" onchange="toggleDevFreeResearch(this.checked)" ${state.devFreeResearch ? 'checked' : ''}> Free Research</label>` +
    `<label class="dev-toggle-label"><input type="checkbox" onchange="toggleProfiling(this.checked)" ${_prof.enabled ? 'checked' : ''}> Profile</label>` +
    (_prof.enabled ? `<input type="text" class="dev-perf-input" placeholder="report name (optional)" value="${_profFilename.replace(/"/g, '&quot;')}">` : '') +
    (_prof.enabled && hasData ? `<button class="dev-perf-btn" onclick="savePerfReport()">Save Report</button>` : '') +
    `<span class="dev-speed-label">Speed:</span>` +
    speeds.map(s => `<button class="dev-speed-btn${speed === s ? ' active' : ''}" onclick="setDevTickSpeed(${s})">${s}x</button>`).join('') +
    `<button class="dev-close-btn" onclick="toggleDevMode(false)">✕</button>`;
}

function toggleDevMode(on) {
  state.devMode = on != null ? !!on : !state.devMode;
  _devPanelKey = '';
  renderDevPanel();
}

function toggleDevFreeResearch(checked) {
  state.devFreeResearch = !!checked;
}

function setDevTickSpeed(n) {
  state.devTickSpeed = n;
  renderDevPanel();
}

function updateTabVisibility() {
  const tut = !!state.settings?.tutorialEnabled;
  const idx = state.tutorial?.goalIndex ?? 0;
  const goal = TUTORIAL_GOALS[idx];

  // Helper: show/hide a tab button and redirect if active panel is hidden
  const showTab = (dataTab, visible) => {
    const btn = document.querySelector(`[data-tab="${dataTab}"]`);
    if (!btn) return;
    btn.style.display = visible ? '' : 'none';
    const panel = document.getElementById('tab-' + dataTab);
    if (panel && !visible && !panel.classList.contains('hidden')) {
      panel.classList.add('hidden');
      document.getElementById('tab-mining')?.classList.remove('hidden');
      btn.classList.remove('active');
      document.querySelector('.tab-btn[onclick*="mining"]')?.classList.add('active');
    }
  };

  // Script tab: hidden until scriptingTech is researched OR script_unlock meta perk
  const scriptUnlocked = !!state.research.done?.scriptingTech
    || (!!state?.settings?.metaProgEnabled && !!metaState.skillPerks?.script_unlock);
  showTab('script', scriptUnlocked);

  // Defense tab: hidden when biters are disabled
  showTab('defense', !!state.settings?.biters);

  // Tutorial-gated tabs
  const researchVisible = !tut || idx >= 5 || (state.buildings['lab']?.count ?? 0) > 0;
  const recipesVisible  = !tut || idx >= 7 || !!state.research.done['automation'];
  const graphVisible    = !tut || idx >= 12 || !!state.research.done['logisticSciencePack'];
  showTab('research', researchVisible);
  showTab('recipes',  recipesVisible);
  showTab('graph',    graphVisible);

  // Apply glow to the tab button the current goal wants to highlight (only before Military Science Pack goal)
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tutorial-glow'));
  if (tut && _tutGlowOn && goal?.glowTab && idx < 13) {
    document.querySelector(`[data-tab="${goal.glowTab}"]`)?.classList.add('tutorial-glow');
  }
}

function renderTutorialGoal() {
  const bar   = document.getElementById('tutorial-goal-bar');
  const panel = document.getElementById('tutorial-goal-panel');

  if (!state?.settings?.tutorialEnabled) {
    if (bar)   bar.style.display = 'none';
    if (panel) panel.style.display = 'none';
    return;
  }

  const idx  = state.tutorial?.goalIndex ?? 0;
  const goal = TUTORIAL_GOALS[idx];

  if (bar) {
    bar.style.display = '';
    bar.textContent = goal
      ? `🎯 Goal: ${goal.text}`
      : '🏆 All goals complete!';
  }

  if (!panel) return;
  panel.style.display = '';

  if (!goal) {
    panel.innerHTML = '<div class="goal-complete">🏆 All goals complete!</div>';
    return;
  }

  const progressText = goal.progress ? goal.progress(state) : null;

  const subGoalsHtml = (goal.subGoals ?? []).map(sg => {
    const done = sg.check(state);
    return `<div class="goal-sub${done ? ' done' : ''}">${done ? '✅' : '☐'} ${sg.text}</div>`;
  }).join('');

  const nextGoal = TUTORIAL_GOALS[idx + 1];
  const upcomingHtml = nextGoal
    ? `<div class="goal-upcoming-label">Up next:</div><div class="goal-upcoming-item">${nextGoal.text}</div>`
    : '';

  panel.innerHTML = `
    <div class="goal-panel-header">🎯 Current Goal</div>
    <div class="goal-current-box">
      <div class="goal-current-text">${goal.text}</div>
      ${progressText ? `<div class="goal-progress-text">${progressText}</div>` : ''}
      ${subGoalsHtml}
    </div>
    <div class="goal-upcoming-section">${upcomingHtml}</div>
  `;
}

function renderUI() {
  renderPower();
  renderBiterIndicator();
  renderStarredBar();
  renderDevPanel();
  updatePlaceButtonStates();
  updateTabVisibility();
  renderTutorialGoal();
  const active = document.querySelector('.tab-panel:not(.hidden)');
  if (!active) return;
  if (active.id === 'tab-inventory') { const _t = _p0(); renderInventory(); _p1('render_inventory', _t); }
  if (active.id === 'tab-mining')    { const _t = _p0(); renderMining(); renderChestSection(); _p1('render_mining',    _t); }
  if (active.id === 'tab-crafting')  { const _t = _p0(); renderCrafting();  _p1('render_crafting',  _t); }
  if (active.id === 'tab-buildings') { const _t = _p0(); renderBuildings(); _p1('render_buildings',  _t); }
  if (active.id === 'tab-research')  { const _t = _p0(); renderResearch();  _p1('render_research',   _t); }
  if (active.id === 'tab-recipes')   { const _t = _p0(); renderRecipes();   _p1('render_recipes',    _t); }
  if (active.id === 'tab-script')    { const _t = _p0(); renderScript();    _p1('render_script',     _t); }
  if (active.id === 'tab-settings')  { const _t = _p0(); renderSettings();  _p1('render_settings',   _t); }
  if (active.id === 'tab-defense')   { const _t = _p0(); renderPerimeter(); _p1('render_defense',    _t); }
  if (active.id === 'tab-graph')     { const _t = _p0(); renderGraph(); renderGraphLegend(); _p1('render_graph', _t); }
}

function renderInventory() {
  if (mouseHeld) return;
  const container = document.getElementById('inventory-list');
  if (!container) return;
  const q = (document.getElementById('inventory-search')?.value ?? '').trim().toLowerCase();
  const entries = Object.entries(state.inventory).filter(([k, v]) => {
    if (!ITEMS[k]) return false;
    if (!ALWAYS_SHOW.has(k) && !state.seen?.[k]) return false;
    if (q && !ITEMS[k].name.toLowerCase().includes(q)) return false;
    return true;
  });
  const starred = state.starredItems ?? [];
  const html = entries.map(([k, amt]) => {
    const item = ITEMS[k];
    const isStarred = starred.includes(k);
    const disp = displayAmt(k);
    return `<div class="inv-item ${amt > 0 ? 'has-items' : ''}">
      <button class="star-btn ${isStarred ? 'starred' : ''}" data-star="${k}">★</button>
      <span class="inv-icon">${itemIcon(k)}</span>
      <span class="inv-name">${item.name}</span>
      <span class="inv-count">${fmtNum(disp)}</span>
    </div>`;
  }).join('') || '<p class="empty-msg">No items match your search.</p>';
  if (html === lastInventoryHtml) return;
  lastInventoryHtml = html;
  container.innerHTML = html;
}

function renderPower() {
  const waterPct = (state.water / effectiveWaterMax() * 100).toFixed(1);
  const steamPct = (state.steam / effectiveSteamMax() * 100).toFixed(1);
  const pw      = Math.floor(state.powerKw);
  const demand  = Math.floor(state.powerDemandKw ?? 0);
  const cap     = Math.floor(state.powerCapacityKw ?? pw);
  const pClass  = pw >= demand && pw > 0 ? 'power-on' : demand > 0 && pw < demand ? 'power-warn' : '';
  const capStr  = cap > pw ? ` / ${fmtNum(cap)} kW cap` : '';
  const pwText  = demand > 0
    ? `${fmtNum(pw)} kW gen${capStr} · ${fmtNum(demand)} kW use`
    : `${fmtNum(pw)} kW${capStr}`;

  buildGroupMap();
  const accCount  = _typeCountsCache?.accumulator ?? 0;
  const accMax    = accCount * ACCUMULATOR_CAPACITY;
  const accCharge = state.accumulatorCharge ?? 0;
  const accPct    = accMax > 0 ? (accCharge / accMax * 100).toFixed(1) : '0';
  const accLine   = accCount > 0 ? `
    <div class="fluid-sep">·</div>
    <div class="fluid-cell">
      <span class="fluid-icon">🔋</span>
      <div class="fluid-track"><div class="fluid-fill acc-fill" style="width:${accPct}%"></div></div>
      <span class="fluid-val">${fmtNum(Math.floor(accCharge / 1000))} / ${fmtNum(Math.floor(accMax / 1000))} MJ</span>
    </div>` : '';

  document.getElementById('power-bar').innerHTML = `
    <div class="fluid-cell">
      <span class="fluid-icon">💧</span>
      <div class="fluid-track"><div class="fluid-fill water-fill" style="width:${waterPct}%"></div></div>
      <span class="fluid-val">${Math.floor(state.water).toLocaleString()} / ${(effectiveWaterMax() / 1000).toFixed(0)}k</span>
    </div>
    <div class="fluid-sep">·</div>
    <div class="fluid-cell">
      <span class="fluid-icon">♨️</span>
      <div class="fluid-track"><div class="fluid-fill steam-fill" style="width:${steamPct}%"></div></div>
      <span class="fluid-val">${Math.floor(state.steam).toLocaleString()} / ${(effectiveSteamMax() / 1000).toFixed(0)}k</span>
    </div>
    <div class="fluid-sep">·</div>
    <div class="fluid-cell power-cell">
      <span class="fluid-icon">⚡</span>
      <span class="fluid-val ${pClass}">${pwText}</span>
    </div>${accLine}
    <div class="fluid-sep">·</div>
    <div class="fluid-cell">
      <span class="fluid-icon">🏆</span>
      <span class="fluid-val">${(metaState.pendingPoints ?? 0).toFixed(2)} pts</span>
    </div>`;
}

// ── Chest System ──────────────────────────────────────────────

let _chestChoices          = [];
let _chestTierOpen         = null;
let _chestSectionHtml      = '';
let _chestSectionWired     = false;
let _chestModalWired       = false;

let _waveSimCache    = null;  // cached result of simulateNextWaveOutcome()
let _waveSimAge      = 999;   // seconds since last sim; force immediate run on first tick

function _maxChestChunk() {
  return Math.pow(state.perimeter?.sideLength ?? 14, 2);
}
function chestAvailCount(tier) {
  const max = _maxChestChunk();
  return (state.chestFinds?.[tier] ?? []).filter(ci => ci < max).length;
}
function chestLockedCount(tier) {
  const max = _maxChestChunk();
  return (state.chestFinds?.[tier] ?? []).filter(ci => ci >= max).length;
}
function chestNextUnlockSideLen(tier) {
  const max = _maxChestChunk();
  const locked = (state.chestFinds?.[tier] ?? []).filter(ci => ci >= max);
  if (!locked.length) return null;
  return Math.floor(Math.sqrt(Math.min(...locked))) + 1;
}
function popAvailChest(tier) {
  const max = _maxChestChunk();
  const finds = state.chestFinds?.[tier];
  if (!finds) return false;
  const idx = finds.findIndex(ci => ci < max);
  if (idx === -1) return false;
  finds.splice(idx, 1);
  return true;
}

function getEligibleRewards(tier) {
  const pool = CHEST_REWARDS[tier] ?? [];
  const upgrades = state.chestUpgrades ?? {};
  return pool.filter(r => r.eligible(state) && (upgrades[r.id] ?? 0) < r.maxLevel);
}

function openChest(tier, autoMode = false) {
  if (chestAvailCount(tier) <= 0) return;

  if (tier === 'legendary') {
    popAvailChest('legendary');
    notify("No legendary rewards in the demo :(", 'info');
    _chestSectionHtml = '';
    renderChestSection();
    return;
  }

  const eligible = getEligibleRewards(tier);
  if (eligible.length === 0) {
    notify('All upgrades at max level!', 'info');
    return;
  }

  const shuffled = eligible.slice().sort(() => Math.random() - 0.5);
  _chestChoices  = shuffled.slice(0, Math.min(3, shuffled.length));
  _chestTierOpen = tier;

  if (autoMode) {
    const highPrio  = state.chestHighPriority ?? [];
    const hiMatches = _chestChoices.filter(r => highPrio.includes(r.id));
    const pick      = hiMatches.length > 0
      ? hiMatches[Math.floor(Math.random() * hiMatches.length)]
      : _chestChoices[0];
    const tierLabel = tier === 'rare' ? '🟣 Rare' : '📦 Common';
    notify(`${tierLabel} chest auto-opened: ${pick.name} (Level ${(state.chestUpgrades?.[pick.id] ?? 0) + 1})`, 'info');
    pickChestReward(_chestChoices.indexOf(pick));
    return;
  }

  const modal = document.getElementById('chest-open-modal');
  if (!modal) return;
  modal.querySelector('.chest-modal-tier').textContent =
    tier === 'common' ? '📦 Common Chest' : '🟣 Rare Chest';

  const highPrio = state.chestHighPriority ?? [];
  modal.querySelector('.chest-modal-choices').innerHTML = _chestChoices.map((r, i) => {
    const cur    = state.chestUpgrades?.[r.id] ?? 0;
    const isPrio = highPrio.includes(r.id);
    return `<button class="chest-choice-card" data-action="pick-reward" data-idx="${i}">
      <div class="chest-choice-name">${r.name}${isPrio ? ' ⭐' : ''}</div>
      <div class="chest-choice-level">Level ${cur} → ${cur + 1} / ${r.maxLevel}</div>
      <div class="chest-choice-effect">${r.desc(cur + 1)}</div>
    </button>`;
  }).join('');
  modal.classList.remove('hidden');

  if (!_chestModalWired) {
    _chestModalWired = true;
    modal.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="pick-reward"]');
      if (!btn) return;
      pickChestReward(Number(btn.dataset.idx));
    });
  }
}

function pickChestReward(idx) {
  const reward = _chestChoices[idx];
  if (!reward) return;
  popAvailChest(_chestTierOpen);
  state.chestUpgrades[reward.id] = (state.chestUpgrades[reward.id] ?? 0) + 1;
  _chestChoices  = [];
  _chestTierOpen = null;
  document.getElementById('chest-open-modal')?.classList.add('hidden');
  _chestSectionHtml = '';
  renderChestSection();
}


function renderChestSection() {
  if (mouseHeld) return;
  const el = document.getElementById('chest-section');
  if (!el) return;

  const upgrades = state.chestUpgrades ?? {};
  const highPrio = state.chestHighPriority ?? [];

  const cAvail = chestAvailCount('common');
  const rAvail = chestAvailCount('rare');
  const lAvail = chestAvailCount('legendary');
  const cLocked = chestLockedCount('common');
  const rLocked = chestLockedCount('rare');
  const lLocked = chestLockedCount('legendary');
  const totalChests   = cAvail + rAvail + lAvail + cLocked + rLocked + lLocked;
  const totalUpgrades = Object.values(upgrades).reduce((s, v) => s + v, 0);
  if (totalChests === 0 && totalUpgrades === 0) {
    if (_chestSectionHtml !== '') { _chestSectionHtml = ''; el.innerHTML = ''; }
    return;
  }

  const autoCommon = state.settings?.autoOpenCommon ?? false;
  const autoRare   = state.settings?.autoOpenRare   ?? false;
  const mkLockedNote = (tier, locked) => {
    if (locked <= 0) return '';
    const need = chestNextUnlockSideLen(tier);
    return `<div class="chest-locked-note">${locked} locked — next unlocks at side length ${need}</div>`;
  };
  const chestControls = `
    <div class="chest-controls">
      <div class="chest-tier-row">
        <span class="chest-tier-label">📦 Common</span>
        <span class="chest-count">${cAvail}</span>
        <button class="btn-sm" data-action="open-chest" data-tier="common" ${cAvail <= 0 ? 'disabled' : ''}>Open</button>
        <button class="btn-sm${autoCommon ? ' btn-primary' : ''}" data-action="toggle-auto" data-tier="common">Auto: ${autoCommon ? 'ON' : 'OFF'}</button>
      </div>
      ${mkLockedNote('common', cLocked)}
      <div class="chest-tier-row">
        <span class="chest-tier-label">🟣 Rare</span>
        <span class="chest-count">${rAvail}</span>
        <button class="btn-sm" data-action="open-chest" data-tier="rare" ${rAvail <= 0 ? 'disabled' : ''}>Open</button>
        <button class="btn-sm${autoRare ? ' btn-primary' : ''}" data-action="toggle-auto" data-tier="rare">Auto: ${autoRare ? 'ON' : 'OFF'}</button>
      </div>
      ${mkLockedNote('rare', rLocked)}
      <div class="chest-tier-row">
        <span class="chest-tier-label">🟡 Legendary</span>
        <span class="chest-count">${lAvail}</span>
        <button class="btn-sm" data-action="open-chest" data-tier="legendary" ${lAvail <= 0 ? 'disabled' : ''}>Open</button>
      </div>
      ${mkLockedNote('legendary', lLocked)}
    </div>`;

  const mkRewardTierHtml = (tierRewards, tierClass) => {
    const visible = tierRewards.filter(r => (upgrades[r.id] ?? 0) > 0 || r.eligible(state));
    if (visible.length === 0) return '';
    return visible.map(r => {
      const lvl    = upgrades[r.id] ?? 0;
      const maxed  = lvl >= r.maxLevel;
      const isPrio = highPrio.includes(r.id);
      return `<div class="chest-reward-card ${tierClass}${maxed ? ' maxed' : ''}">
        <div class="chest-reward-name">${r.name}</div>
        <div class="chest-reward-level">${lvl} / ${r.maxLevel}</div>
        <div class="chest-reward-effect">${lvl > 0 ? r.desc(lvl) : '—'}</div>
        ${!maxed ? `<button class="btn-sm${isPrio ? ' btn-primary' : ''}" data-action="toggle-priority" data-id="${r.id}">${isPrio ? '⭐ High Priority' : '☆ Set Priority'}</button>` : ''}
      </div>`;
    }).join('');
  };
  const commonCards = mkRewardTierHtml(CHEST_REWARDS.common, '');
  const rareCards   = mkRewardTierHtml(CHEST_REWARDS.rare,   'rare-tier');
  const rewardCards = (commonCards || rareCards) ? `
    <div class="chest-rewards-header">Upgrades</div>
    ${commonCards ? `<div class="chest-rewards-tier-label">📦 Common</div><div class="chest-rewards-grid">${commonCards}</div>` : ''}
    ${rareCards   ? `<div class="chest-rewards-tier-label rare">🟣 Rare</div><div class="chest-rewards-grid">${rareCards}</div>` : ''}
  ` : '';

  const newHtml = `
    <h3 class="section-label">🎁 Chests</h3>
    ${chestControls}
    ${rewardCards}
  `;

  if (newHtml !== _chestSectionHtml) {
    _chestSectionHtml = newHtml;
    el.innerHTML = newHtml;
  }

  if (!_chestSectionWired) {
    _chestSectionWired = true;
    el.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      const action = btn.dataset.action;
      if (action === 'open-chest') {
        openChest(btn.dataset.tier, !!btn.dataset.auto);
      } else if (action === 'toggle-auto') {
        const tier = btn.dataset.tier;
        if (tier === 'common') state.settings.autoOpenCommon = !state.settings.autoOpenCommon;
        if (tier === 'rare')   state.settings.autoOpenRare   = !state.settings.autoOpenRare;
        _chestSectionHtml = '';
        renderChestSection();
      } else if (action === 'toggle-priority') {
        const id  = btn.dataset.id;
        const arr = state.chestHighPriority ?? [];
        const idx = arr.indexOf(id);
        if (idx >= 0) arr.splice(idx, 1); else arr.push(id);
        state.chestHighPriority = arr;
        _chestSectionHtml = '';
        renderChestSection();
      }
    });
  }
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
    /* NODES: drill count display removed
    const drills    = drillCountForResource(key);
    const maxDrills = patch.nodes;
    */
    const remText   = locked
      ? `Outside perimeter (${fmtNum((patch.pendingFinds ?? []).reduce((s, f) => s + f.remaining, 0))} known)`
      : `${fmtNum(Math.floor(patch.remaining))} remaining`;
    card.querySelector('.patch-remaining').textContent = remText;
    const nodesEl = card.querySelector('.patch-nodes');
    if (nodesEl) nodesEl.textContent = '';
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
        const outIcon  = itemIcon(outKey);
        const outStr   = Object.entries(recipe.outputs).map(([k, v]) => `→ ${v}×${ITEMS[k]?.name ?? k}`).join(' ');

        const statusLine = isActive
          ? `<div class="craft-queue-count">Crafting… <span class="craft-q-num">${queued} queued</span></div>`
          : total > 0
          ? `<div class="craft-queue-count waiting">⏳ Waiting <span class="craft-q-num">${total} queued</span></div>`
          : `<div class="craft-queue-count waiting" style="visibility:hidden">​</div>`;

        const cancelBtn = total > 0
          ? `<button class="btn-craft-cancel" data-cancel="${key}" title="Cancel queue">✕</button>` : '';

        const tutGlowClass = (_tutGlowOn && state.settings.tutorialEnabled &&
          (state.tutorial?.goalIndex ?? 0) < 13 &&
          TUTORIAL_GOALS[state.tutorial?.goalIndex]?.glowCraft?.includes(key))
          ? ' tutorial-glow' : '';
        return `<div class="craft-card ${isActive ? 'craft-active' : ''}${tutGlowClass}">
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
    const ores = Object.keys(PATCHES).filter(k => {
      if (k === 'crudeOil') return false; // fluid, handled by pumpjack
      if (k === 'uraniumOre' && !state.research?.done?.uraniumProcessing) return false;
      return true;
    });
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

function addBuildingFromGroup(key, count, frontOfQueue = false) {
  const groups = buildGroupMap();
  const group = groups[key];
  if (!group) return;
  const type = group.type;
  if (!isUnlocked('building', type)) { notify(`Research required.`, 'warning'); return; }
  const costs = BUILDING_COSTS[type] ?? {};
  let actualCount = 0;
  for (let i = 0; i < count; i++) {
    if (!canAfford(costs)) { if (i === 0) notify(`Need ${COST_LABEL[type] ?? type} — craft it first`, 'warning'); break; }
    spend(costs);
    actualCount++;
  }
  if (actualCount > 0) {
    const entry = { type, count: actualCount };
    if (group.resource != null) entry.resource = group.resource;
    if (group.recipe   != null) entry.recipe   = group.recipe;
    if (frontOfQueue) _placeEnqueueFront(entry);
    else placeQueue.push(entry);
    updatePlacementUI();
    if (!placing) processNextPlacement();
  }
}

// ── Settings ──────────────────────────────────────────────────

function setRadarNotif(val) {
  if (state) state.settings.radarNotif = val;
}

function setTutorialEnabled(val) {
  if (state) state.settings.tutorialEnabled = val;
  renderUI();
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

  const tutEl = document.getElementById('settings-tutorial');
  if (tutEl) tutEl.checked = state.settings.tutorialEnabled === true;
}

function buildingMatchesSearch(group, q) {
  if (!q) return true;
  const type = group.type.toLowerCase();
  if (type.includes(q)) return true;
  const displayName = (BUILDING_DEFS[group.type]?.name ?? '').toLowerCase();
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

function partialRunMsg(recipe, activeN, count) {
  if (!recipe?.inputs || activeN >= count) return '';
  const bottleneck = Object.entries(recipe.inputs)
    .filter(([k, needed]) => (state.inventory[k] ?? 0) < needed * count)
    .map(([k]) => ITEMS[k]?.name ?? k);
  return bottleneck.length ? ` · Need: ${bottleneck.join(', ')}` : '';
}

function recipeRateStr(activeN, count, machineSpeed, speedMult, pRatio, recipe, outputKey, prodBonus) {
  if (!recipe || !outputKey) return '';
  const outAmt = recipe.outputs[outputKey] ?? 1;
  const cyclesPerSec = machineSpeed * speedMult * pRatio / recipe.time;
  const perCycle = outAmt * (1 + prodBonus);
  const actual = activeN * cyclesPerSec * perCycle;
  const max    = count   * cyclesPerSec * perCycle;
  return `${actual.toFixed(2)}/s · max ${max.toFixed(2)}/s`;
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

  let _anyCardMiss = false;
  const _newBuildingsHtml = keys.map(key => {
    const group = groups[key];
    const gs    = getGS(key);
    const count = group.count;
    const type  = group.type;
    // Cache key: hash relevant state; progress quantized to 5% so active groups don't thrash
    const _ch = `${count}|${gs.enabled}|${gs.starved}|${gs.active}|${gs.activeCount ?? 0}|${gs.noPower}|${gs.priority}|${gs.limit}|` +
      `${gs.selectedModuleType}|${JSON.stringify(gs.modules ?? {})}|${gs.outsidePerimeter ?? 0}|` +
      `${gs.acidStarved ?? 0}|${gs.standby ?? 0}|${Math.round((gs.progress ?? 0) * 20)}|` +
      `${(type === 'miner' || type === 'electricMiner') ? placeQueue.slice(_placeHead).filter(e => e.resource === group.resource).reduce((s,e)=>s+e.count,0) : 0}|` +
      `${buildingAddCounts[key] ?? 1}`;
    if (_cardCache[key]?.hash === _ch) return _cardCache[key].html;
    _anyCardMiss = true;
    const _cardHtml = (() => {

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
      /* NODES: drill count display removed
      const drills   = drillCountForResource(group.resource);
      const maxNodes = maxDrillsForResource(group.resource);
      const nodesStr = maxNodes > 0 ? ` · ${drills}/${maxNodes} nodes` : '';
      */
      const statusTxt = !gs.enabled  ? 'Disabled'
                       : outsidePerim ? '🔒 Outside perimeter'
                       : gs.starved   ? '⚡ No Coal'
                       : acidStarved  ? '⚗️ No Sulfuric Acid'
                       : atLimit      ? `⏸ Output limit (${gs.limit})`
                       : !hasPatch    ? 'Patch depleted'
                                      : `${(count * speed * (type === 'electricMiner' ? calcGroupModifiers('electricMiner', count, gs.modules).speedMult : 1) * pRatio).toFixed(2)}/sec${brownStr}`;
      const meta = type === 'miner'
        ? `coal: ${(count * COAL_PER_MINER).toFixed(4)}/sec`
        : `${ELECTRIC_MINER_KW * count} kW`;
      const icon = type === 'miner' ? '⛏️' : '🔌';
      const label = type === 'miner'
        ? `Burner Miner — ${PATCHES[group.resource]?.name}`
        : `Electric Miner — ${PATCHES[group.resource]?.name}`;
      return buildingCard(icon, label, count, meta, statusTxt, isActive, -1, key, '', true, type === 'electricMiner' ? 'electricMiner' : null);
    }

    if (type === 'furnace') {
      const activeN   = gs.activeCount ?? 0;
      const recipe    = FURNACE_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const missingIn = activeN === 0 && recipe ? getMissingInputs(recipe) : null;
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const statusTxt = !gs.enabled ? 'Disabled'
                       : gs.starved  ? '⚡ No Coal'
                       : atLimit     ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Smelting (${activeN}/${count})`
                       : activeN > 0  ? `Smelting (${activeN}/${count})${partialRunMsg(recipe, activeN, count)}`
                                      : waitMsg;
      const { speedMult, prodBonus } = calcGroupModifiers('furnace', count, gs.modules);
      const rateStr = recipeRateStr(activeN, count, 1, speedMult, 1, recipe, outputKey, prodBonus);
      return buildingCard('🔥', 'Stone Furnace', count,
        `coal: ${(count * COAL_PER_FURNACE).toFixed(4)}/sec · ${rateStr}`,
        statusTxt, gs.enabled && !gs.starved && activeN > 0, -1, key,
        buildCurrentRecipeDisplay(group.recipe, FURNACE_RECIPES), true, 'furnace', true);
    }

    if (type === 'steelFurnace') {
      const activeN   = gs.activeCount ?? 0;
      const recipe    = FURNACE_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const missingIn = activeN === 0 && recipe ? getMissingInputs(recipe) : null;
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const statusTxt = !gs.enabled ? 'Disabled'
                       : gs.starved  ? '⚡ No Coal'
                       : atLimit     ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Smelting (${activeN}/${count})`
                       : activeN > 0  ? `Smelting (${activeN}/${count})${partialRunMsg(recipe, activeN, count)}`
                                      : waitMsg;
      const { speedMult, prodBonus } = calcGroupModifiers('steelFurnace', count, gs.modules);
      const rateStr = recipeRateStr(activeN, count, STEEL_FURNACE_SPEED, speedMult, 1, recipe, outputKey, prodBonus);
      return buildingCard('🟧', 'Steel Furnace', count,
        `coal: ${(count * COAL_PER_STEEL_FURNACE).toFixed(4)}/sec · ${rateStr}`,
        statusTxt, gs.enabled && !gs.starved && activeN > 0, -1, key,
        buildCurrentRecipeDisplay(group.recipe, FURNACE_RECIPES), true, 'steelFurnace', true);
    }

    if (type === 'assembly') {
      const activeN   = gs.activeCount ?? 0;
      const recipe    = PLAYER_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const missingIn = activeN === 0 && recipe ? getMissingInputs(recipe) : null;
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round((state.powerRatio ?? 1) * 100)}% power` : '';
      const statusTxt = !gs.enabled ? 'Disabled'
                       : atLimit    ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Crafting (${activeN}/${count})${brownStr}`
                       : activeN > 0  ? `Crafting (${activeN}/${count})${brownStr}${partialRunMsg(recipe, activeN, count)}`
                                      : `${waitMsg}${brownStr}`;
      const { speedMult, prodBonus } = calcGroupModifiers('assembly', count, gs.modules);
      const pRatio = state.powerRatio ?? 1;
      const rateStr = recipeRateStr(activeN, count, ASSEMBLY_SPEED, speedMult, pRatio, recipe, outputKey, prodBonus);
      return buildingCard('🏭', 'Assembly Machine Mk1', count,
        `${ASSEMBLY_KW * count} kW · ${rateStr}`,
        statusTxt, gs.enabled && activeN > 0, -1, key,
        buildCurrentRecipeDisplay(group.recipe, PLAYER_RECIPES), true, 'assembly', true);
    }

    if (type === 'assembly2') {
      const activeN   = gs.activeCount ?? 0;
      const recipe    = PLAYER_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const missingIn = activeN === 0 && recipe ? getMissingInputs(recipe) : null;
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round((state.powerRatio ?? 1) * 100)}% power` : '';
      const statusTxt = !gs.enabled ? 'Disabled'
                       : atLimit    ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Crafting (${activeN}/${count})${brownStr}`
                       : activeN > 0  ? `Crafting (${activeN}/${count})${brownStr}${partialRunMsg(recipe, activeN, count)}`
                                      : `${waitMsg}${brownStr}`;
      const { speedMult: sm2, prodBonus: pb2 } = calcGroupModifiers('assembly2', count, gs.modules);
      const pRatio2 = state.powerRatio ?? 1;
      const rateStr = recipeRateStr(activeN, count, ASSEMBLY2_SPEED, sm2, pRatio2, recipe, outputKey, pb2);
      return buildingCard('🏗️', 'Assembly Machine Mk2', count,
        `${ASSEMBLY2_KW * count} kW · ${rateStr}`,
        statusTxt, gs.enabled && activeN > 0, -1, key,
        buildCurrentRecipeDisplay(group.recipe, PLAYER_RECIPES), true, 'assembly2', true);
    }

    if (type === 'lab') {
      const gs2 = getGS('lab');
      const res = state.research;
      let techName = null, totalNeeded = 0;
      if (res.current?.includes(':')) {
        const rd = currentRobotTechData();
        totalNeeded = rd?.totalNeeded ?? 0;
        const nameMap = Object.fromEntries(
          Object.entries(INFINITE_TECHS).map(([k, v]) => [
            k,
            `${v.displayName} Lvl ${(res[v.stateField] ?? 0) + 1}`
          ])
        );
        techName = nameMap[res.current] ?? res.current;
      } else if (res.current) {
        const tech = TECHNOLOGIES[res.current];
        if (tech) { totalNeeded = Math.max(...Object.values(tech.cost)); techName = tech.name; }
      }
      const progress = totalNeeded > 0 ? res.totalConsumed / totalNeeded : 0;
      const powerRatioPct = state.powerRatio < 0.99 ? ` ⚡ ${(state.powerRatio * 100).toFixed(0)}%` : '';
      const statusTxt = !gs2.enabled ? 'Disabled'
                       : !res.current ? 'No research selected'
                       : gs2.starved  ? '🔴 No Science Packs'
                       : state.powerRatio < 0.05 ? '⚡ No Power'
                                      : `Researching: ${techName ?? '?'} (${res.totalConsumed}/${totalNeeded})${powerRatioPct}`;
      return buildingCard('🔬', 'Unpaid Interns', count, 'we give them monster and they do science, they don\'t get to sleep',
        statusTxt, gs2.enabled && !!res.current && !gs2.starved, progress, key, '', false, 'lab');
    }

    if (type === 'offshoreP') {
      return buildingCard('💧', 'Offshore Pump', count, 'no fuel cost',
        gs.enabled ? `${(count * OFFSHORE_PUMP_WATER_PER_SEC).toLocaleString()} water/sec` : 'Disabled',
        gs.enabled, state.water / effectiveWaterMax(), key);
    }

    if (type === 'boiler') {
      const statusTxt = !gs.enabled ? 'Disabled'
                       : gs.noWater  ? '💧 No Water'
                       : gs.starved  ? '⚡ No Coal'
                                     : `${count * BOILER_STEAM_PER_SEC} steam/sec`;
      return buildingCard('♨️', 'Boiler', count,
        `coal: ${(count * BOILER_COAL_PER_SEC).toFixed(3)}/sec · water: ${count * BOILER_WATER_PER_SEC}/sec`,
        statusTxt, gs.enabled && !gs.starved, state.steam / effectiveSteamMax(), key);
    }

    if (type === 'steamEngine') {
      const pw = Math.floor(state.powerKw).toLocaleString();
      const steamStatus = !gs.enabled ? 'Disabled'
                        : gs.standby  ? '☀️ Standby (solar/nuclear priority)'
                        : gs.starved  ? '♨️ No Steam'
                                      : `${pw} kW`;
      return buildingCard('⚡', 'Steam Engine', count,
        `${count * STEAM_ENGINE_STEAM_PER_SEC} steam/sec → ${count * STEAM_ENGINE_KW} kW max`,
        steamStatus, gs.enabled && !gs.standby && state.steam > 0, state.steam / effectiveSteamMax(), key);
    }

    if (type === 'radar') {
      const effectiveRadarTime = hasMetaPerk('perk_radar_speed') ? RADAR_CHUNK_TIME / 1.5 : RADAR_CHUNK_TIME;
      const progress = Math.min(1, (getGS('radar').radarAcc ?? 0) / effectiveRadarTime);
      const chunks   = state.chunksRevealed ?? 0;
      const radarPowerStr = state.powerRatio < 0.99 ? ` ⚡ ${(state.powerRatio * 100).toFixed(0)}%` : '';
      return buildingCard('📡', 'Radar', count, 'discovers ore patches',
        !gs.enabled ? 'Disabled'
          : state.powerRatio < 0.05 ? '⚡ No Power'
          : `${(count * 60 / effectiveRadarTime * state.powerRatio).toFixed(1)} chunks/min · ${chunks} explored${radarPowerStr}`,
        gs.enabled && state.powerRatio > 0, progress, key);
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
      const activeN   = gs.activeCount ?? 0;
      const recipe    = FURNACE_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const missingIn = activeN === 0 && recipe ? getMissingInputs(recipe) : null;
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round((state.powerRatio ?? 1) * 100)}% power` : '';
      const statusTxt2 = !gs.enabled ? 'Disabled'
                       : atLimit     ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Smelting (${activeN}/${count})${brownStr}`
                       : activeN > 0  ? `Smelting (${activeN}/${count})${brownStr}${partialRunMsg(recipe, activeN, count)}`
                                      : `${waitMsg}${brownStr}`;
      const { speedMult: smEF, prodBonus: pbEF } = calcGroupModifiers('electricFurnace', count, gs.modules);
      const rateStr = recipeRateStr(activeN, count, ELECTRIC_FURNACE_SPEED, smEF, state.powerRatio ?? 1, recipe, outputKey, pbEF);
      return buildingCard('⚡🔥', 'Electric Furnace', count,
        `${ELECTRIC_FURNACE_KW * count} kW · ${rateStr}`,
        statusTxt2, gs.enabled && activeN > 0, -1, key,
        buildCurrentRecipeDisplay(group.recipe, FURNACE_RECIPES), true, 'electricFurnace', true);
    }

    if (type === 'assembly3') {
      const activeN   = gs.activeCount ?? 0;
      const recipe    = PLAYER_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const missingIn = activeN === 0 && recipe ? getMissingInputs(recipe) : null;
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round((state.powerRatio ?? 1) * 100)}% power` : '';
      const statusTxt2 = !gs.enabled ? 'Disabled'
                       : atLimit     ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Crafting (${activeN}/${count})${brownStr}`
                       : activeN > 0  ? `Crafting (${activeN}/${count})${brownStr}${partialRunMsg(recipe, activeN, count)}`
                                      : `${waitMsg}${brownStr}`;
      const { speedMult: sm3, prodBonus: pb3 } = calcGroupModifiers('assembly3', count, gs.modules);
      const rateStr = recipeRateStr(activeN, count, ASSEMBLY3_SPEED, sm3, state.powerRatio ?? 1, recipe, outputKey, pb3);
      return buildingCard('🏭', 'Assembly Machine Mk3', count,
        `${ASSEMBLY3_KW * count} kW · ${rateStr}`,
        statusTxt2, gs.enabled && activeN > 0, -1, key,
        buildCurrentRecipeDisplay(group.recipe, PLAYER_RECIPES), true, 'assembly3', true);
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
        `${PUMPJACK_KW * count} kW · ${fmtNum(remaining)} remaining`,
        statusTxt2, isActive2, hasPatch ? 1 : 0, key, '', false, 'pumpjack');
    }

    if (type === 'oilRefinery') {
      const activeN   = gs.activeCount ?? 0;
      const recipe    = PLAYER_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const missingIn = activeN === 0 && recipe ? getMissingInputs(recipe) : null;
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round((state.powerRatio ?? 1) * 100)}% power` : '';
      const statusTxt2 = !gs.enabled ? 'Disabled'
                       : atLimit     ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Processing (${activeN}/${count})${brownStr}`
                       : activeN > 0  ? `Processing (${activeN}/${count})${brownStr}${partialRunMsg(recipe, activeN, count)}`
                                      : `${waitMsg}${brownStr}`;
      const { speedMult: smOR, prodBonus: pbOR } = calcGroupModifiers('oilRefinery', count, gs.modules);
      const rateStr = recipeRateStr(activeN, count, OIL_REFINERY_SPEED, smOR, state.powerRatio ?? 1, recipe, outputKey, pbOR);
      return buildingCard('🛢️', 'Oil Refinery', count,
        `${OIL_REFINERY_KW * count} kW · ${rateStr}`,
        statusTxt2, gs.enabled && activeN > 0, -1, key,
        buildCurrentRecipeDisplay(group.recipe, PLAYER_RECIPES), true, 'oilRefinery', true);
    }

    if (type === 'chemicalPlant') {
      const activeN   = gs.activeCount ?? 0;
      const recipe    = PLAYER_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const missingIn = activeN === 0 && recipe ? getMissingInputs(recipe) : null;
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round((state.powerRatio ?? 1) * 100)}% power` : '';
      const statusTxt2 = !gs.enabled ? 'Disabled'
                       : atLimit     ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Processing (${activeN}/${count})${brownStr}`
                       : activeN > 0  ? `Processing (${activeN}/${count})${brownStr}${partialRunMsg(recipe, activeN, count)}`
                                      : `${waitMsg}${brownStr}`;
      const { speedMult: smCP, prodBonus: pbCP } = calcGroupModifiers('chemicalPlant', count, gs.modules);
      const rateStr = recipeRateStr(activeN, count, CHEMICAL_PLANT_SPEED, smCP, state.powerRatio ?? 1, recipe, outputKey, pbCP);
      return buildingCard('⚗️', 'Chemical Plant', count,
        `${CHEMICAL_PLANT_KW * count} kW · ${rateStr}`,
        statusTxt2, gs.enabled && activeN > 0, -1, key,
        buildCurrentRecipeDisplay(group.recipe, PLAYER_RECIPES), true, 'chemicalPlant', true);
    }

    if (type === 'centrifuge') {
      const activeN   = gs.activeCount ?? 0;
      const recipe    = PLAYER_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const missingIn = activeN === 0 && recipe ? getMissingInputs(recipe) : null;
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round((state.powerRatio ?? 1) * 100)}% power` : '';
      const statusTxt2 = !gs.enabled ? 'Disabled'
                       : atLimit     ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Processing (${activeN}/${count})${brownStr}`
                       : activeN > 0  ? `Processing (${activeN}/${count})${brownStr}${partialRunMsg(recipe, activeN, count)}`
                                      : `${waitMsg}${brownStr}`;
      const { speedMult: smCen, prodBonus: pbCen } = calcGroupModifiers('centrifuge', count, gs.modules);
      const rateStr = recipeRateStr(activeN, count, CENTRIFUGE_SPEED, smCen, state.powerRatio ?? 1, recipe, outputKey, pbCen);
      return buildingCard('☢️', 'Centrifuge', count,
        `${CENTRIFUGE_KW * count} kW · ${rateStr}`,
        statusTxt2, gs.enabled && activeN > 0, -1, key,
        buildCurrentRecipeDisplay(group.recipe, PLAYER_RECIPES), true, 'centrifuge', true);
    }

    if (type === 'rocketSilo') {
      const activeN   = gs.activeCount ?? 0;
      const recipe    = PLAYER_RECIPES[group.recipe];
      const outputKey = recipe ? Object.keys(recipe.outputs)[0] : null;
      const atLimit   = outputKey && (state.inventory[outputKey] ?? 0) >= gs.limit;
      const missingIn = activeN === 0 && recipe ? getMissingInputs(recipe) : null;
      const waitMsg   = missingIn ? `⏳ Need: ${missingIn.join(', ')}` : 'Waiting for inputs';
      const brownStr  = gs.noPower ? ` · ⚡ ${Math.round((state.powerRatio ?? 1) * 100)}% power` : '';
      const statusTxt2 = !gs.enabled ? 'Disabled'
                       : atLimit     ? `⏸ Output limit (${gs.limit})`
                       : activeN === count ? `Building (${activeN}/${count})${brownStr}`
                       : activeN > 0  ? `Building (${activeN}/${count})${brownStr}${partialRunMsg(recipe, activeN, count)}`
                                      : `${waitMsg}${brownStr}`;
      const { speedMult: smRS, prodBonus: pbRS } = calcGroupModifiers('rocketSilo', count, gs.modules);
      const rateStr = recipeRateStr(activeN, count, ROCKET_SILO_SPEED, smRS, state.powerRatio ?? 1, recipe, outputKey, pbRS);
      return buildingCard('🚀', 'Rocket Silo', count,
        `${ROCKET_SILO_KW * count} kW · ${rateStr}`,
        statusTxt2, gs.enabled && activeN > 0, -1, key,
        buildCurrentRecipeDisplay(group.recipe, PLAYER_RECIPES), true, 'rocketSilo', true);
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
  })();
  _cardCache[key] = { hash: _ch, html: _cardHtml };
  return _cardHtml;
  }).join('');
  if (_anyCardMiss || container.dataset.keyCount !== String(keys.length)) {
    container.innerHTML = _newBuildingsHtml;
    container.dataset.keyCount = String(keys.length);
  }
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
  const totalSlots = slotsPerBuilding * group.count;
  if (!gs.modules) gs.modules = {};
  const usedSlots = Object.values(gs.modules).reduce((s, n) => s + n, 0);
  const current = gs.modules[modType] ?? 0;
  let newVal = current + amount;
  if (amount > 0) {
    const freeSlots = totalSlots - usedSlots;
    const inInv = state.inventory[modType] ?? 0;
    const canAdd = Math.min(freeSlots, inInv);
    newVal = Math.min(newVal, current + canAdd);
    const actualAdded = Math.max(0, newVal - current);
    if (actualAdded === 0) { notify(`No ${MODULE_DATA[modType]?.name ?? modType} in inventory`, 'warning'); return; }
    state.inventory[modType] = inInv - actualAdded;
  } else if (amount < 0) {
    newVal = Math.max(0, newVal);
    const actualRemoved = current - newVal;
    if (actualRemoved > 0) state.inventory[modType] = (state.inventory[modType] ?? 0) + actualRemoved;
  }
  newVal = Math.max(0, newVal);
  gs.modules[modType] = newVal;
  renderBuildings();
}

function fillGroupModules(key, modType) {
  const gs = getGS(key);
  const groups = buildGroupMap();
  const group = groups[key];
  if (!group) return;
  const slotsPerBuilding = MODULE_SLOTS[group.type] ?? 0;
  const totalSlots = slotsPerBuilding * group.count;
  if (!gs.modules) gs.modules = {};
  const current = gs.modules[modType] ?? 0;
  const usedOther = Object.entries(gs.modules).reduce((s, [k, n]) => k === modType ? s : s + n, 0);
  const wanted = Math.max(0, totalSlots - usedOther);
  const toAdd = wanted - current;
  if (toAdd <= 0) return;
  const inInv = state.inventory[modType] ?? 0;
  const actualAdded = Math.min(toAdd, inInv);
  if (actualAdded === 0) { notify(`No ${MODULE_DATA[modType]?.name ?? modType} in inventory`, 'warning'); return; }
  state.inventory[modType] = inInv - actualAdded;
  gs.modules[modType] = current + actualAdded;
  renderBuildings();
}

function clearGroupModules(key) {
  const gs = getGS(key);
  if (!gs.modules) return;
  for (const [mtype, n] of Object.entries(gs.modules)) {
    if (n > 0) state.inventory[mtype] = (state.inventory[mtype] ?? 0) + n;
  }
  gs.modules = {};
  renderBuildings();
}

function buildingCard(icon, name, count, meta, statusTxt, isActive, barFill, key, extra = '', showLimit = false, moduleType = null, showPriority = false) {
  const gs      = getGS(key);
  const stClass = isActive ? 'status-ok' : 'status-warn';
  const fillPct = (Math.min(1, Math.max(0, barFill)) * 100).toFixed(1);
  const limitVal = gs.limit === Infinity ? '∞' : gs.limit;
  const limitRow = showLimit
    ? `<div class="building-limit-row">Stop if output ≥ <input type="text" class="limit-input" data-limit="${key}" value="${limitVal}" placeholder="∞ = no limit"></div>`
    : '';

  let moduleRow = '';
  const _done = state.research?.done ?? {};
  const _anyModuleTech = _done.speedModuleTech1 || _done.speedModuleTech2 || _done.speedModuleTech3 ||
                         _done.productionModuleTech1 || _done.productionModuleTech2 || _done.productionModuleTech3;
  if (moduleType !== null && _anyModuleTech) {
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

  const barHtml = barFill >= 0
    ? `<div class="mini-bar"><div class="mini-fill ${isActive ? 'fill-active' : ''}" style="width:${fillPct}%"></div></div>`
    : '';
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
      ${barHtml}
      <div class="building-add-row">
        <button class="btn-add-building" data-add="${key}" title="Alt+click to place at front of queue">+ Add</button>
        <input type="number" class="add-count-input" data-add-count="${key}" min="1" value="${buildingAddCounts[key] ?? 1}" onchange="setBuildingAddCount('${key}', this.value)">
      </div>
    </div>
    <div class="building-actions">
      ${showPriority ? `<button class="btn-priority ${gs.priority ? 'priority-on' : ''}" data-priority="${key}" title="${gs.priority ? 'Remove priority' : 'Set high priority'}">★</button>` : ''}
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
  const rawTiers = computeTechDepths();
  const tiers = rawTiers.map(tier =>
    tier.filter(k => k !== 'gamerModule' || !!state?.settings?.metaProgEnabled)
  ).filter(t => t.length > 0);

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

      const unlockNames = [
        ...(tech.unlockBuildings ?? []).map(b => BUILDING_DEFS[b]?.name ?? b),
        ...(tech.unlockRecipes ?? []).map(r => PLAYER_RECIPES?.[r]?.name ?? FURNACE_RECIPES?.[r]?.name ?? r),
      ].slice(0, 3);
      const unlocksHtml = unlockNames.length
        ? `<div class="tech-node-unlocks">▶ ${unlockNames.join(', ')}</div>` : '';
      const descHtml = tech.description
        ? `<div class="tech-node-desc">${tech.description.slice(0, 80)}${tech.description.length > 80 ? '…' : ''}</div>` : '';
      const prereqNames = (tech.prereqs ?? []).map(k => TECHNOLOGIES[k]?.name ?? k).join(', ');
      const prereqHtml = prereqNames ? `<div class="tech-node-prereqs">Req: ${prereqNames}</div>` : '';
      html += `<div class="tech-node ${cls}" data-node-key="${key}" ${clickData} title="${tech.description}">
        <div class="tech-node-head">
          <span class="tech-node-icon">${tech.iconHtml()}</span>
          <div>
            <div class="tech-node-name">${tech.name}</div>
            <div class="tech-node-cost">${costStr}</div>
          </div>
        </div>
        ${prereqHtml}${descHtml}${unlocksHtml}${badge}
      </div>`;
    }
    html += '</div>';
  }
  // html += '<svg class="tech-tree-svg" id="tech-tree-svg"></svg>';
  html += '</div>';

  wrap.innerHTML = html;
  // requestAnimationFrame(drawTechLines);
}

function drawTechLines() {
  const svg = document.getElementById('tech-tree-svg');
  const inner = document.getElementById('tech-tree-inner');
  if (!svg || !inner) return;

  const innerRect = inner.getBoundingClientRect();

  // Collect node positions and status
  const pos = {};
  const nodeStatus = {};
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
    if (el.classList.contains('node-done'))    nodeStatus[key] = 'done';
    else if (el.classList.contains('node-current')) nodeStatus[key] = 'current';
    else if (el.classList.contains('node-queued'))  nodeStatus[key] = 'queued';
    else if (el.classList.contains('node-locked'))  nodeStatus[key] = 'locked';
    else nodeStatus[key] = 'available';
  }

  function lineStyle(parentKey, childKey) {
    const ps = nodeStatus[parentKey] ?? 'available';
    const cs = nodeStatus[childKey]  ?? 'available';
    if (ps === 'done' && cs === 'done')      return { stroke: 'rgba(76,175,80,0.35)', width: 1.5 };
    if (ps === 'done' && cs === 'current')   return { stroke: '#f4a83a',             width: 2   };
    if (ps === 'done' && cs === 'queued')    return { stroke: '#a07830',             width: 1.5 };
    if (ps === 'done' && cs === 'available') return { stroke: 'rgba(76,175,80,0.65)', width: 1.5 };
    if (cs === 'locked')                     return { stroke: '#1e1e26',             width: 1   };
    return { stroke: '#3a3a4a', width: 1.4 };
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

      const ls = lineStyle(parent, child);
      paths += `<path d="${d}" fill="none" stroke="${ls.stroke}" stroke-width="${ls.width}" opacity="0.9" stroke-linejoin="round"/>`;
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
  buildGroupMap();
  const labs = _typeCountsCache?.lab ?? 0;
  const gs   = getGS('lab');

  if (!res.current) {
    const savedNote = res.savedKey && TECHNOLOGIES[res.savedKey]
      ? `<span class="research-idle-note">Saved progress: ${TECHNOLOGIES[res.savedKey].name} (${res.savedProgress ?? 0} packs)</span>`
      : '';
    el.innerHTML = `<p class="research-idle">No research in progress. Click a technology node below to start.${savedNote ? '<br>' + savedNote : ''}</p>`;
    return;
  }

  let name, icon, totalNeeded, timePerPack;
  const infDef = INFINITE_TECHS[res.current];
  if (infDef) {
    const rd = currentRobotTechData();
    if (!rd) { el.innerHTML = ''; return; }
    totalNeeded = rd.totalNeeded;
    timePerPack = rd.timePerPack;
    const level = (res[infDef.stateField] ?? 0) + 1;
    icon = '🔬';
    name = `${infDef.displayName} Level ${level}`;
  } else {
    const tech = TECHNOLOGIES[res.current];
    if (!tech) { el.innerHTML = ''; return; }
    totalNeeded  = tech.totalPacks();
    timePerPack  = tech.timePerPack;
    icon = tech.iconHtml();
    name = tech.name;
  }

  const pct  = (res.totalConsumed / totalNeeded * 100).toFixed(1);
  const rate = labs > 0 ? (labs / timePerPack).toFixed(2) : '0';
  const eta  = labs > 0 && !gs.starved
    ? `~${Math.ceil((totalNeeded - res.totalConsumed) / (labs / timePerPack))}s`
    : '—';

  const queue = res.queue ?? [];
  const INF_NAMES = Object.fromEntries(Object.entries(INFINITE_TECHS).map(([k, v]) => [k, v.displayName]));
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
  if (mouseHeld) return;
  const el = document.getElementById('robot-tech-section');
  if (!el) return;

  const cur      = state.research.current;
  buildGroupMap();
  const labCount = _typeCountsCache?.lab ?? 0;
  let html = '';

  // ── Robot Upgrades (gated behind Robotics tech) ──
  if (state.research.done?.robotics) {
    const speedLevel    = state.research.robotSpeedLevel ?? 0;
    const robotCount    = Math.floor(state.inventory?.constructionRobotItem ?? 0);
    const { time: placeTime, batch } = computePlaceTimeSec();
    const effectiveness = 1 + speedLevel * WORKER_SPEED_PER_LEVEL;
    html += `<div class="robot-tech-wrap">
    <h3 class="section-label" style="margin-top:2rem;margin-bottom:.5rem">Robot Upgrades</h3>
    <div class="robot-tech-summary">🤖 ${robotCount.toLocaleString()} construction robots · effectiveness ×${effectiveness.toFixed(2)} · place time ${placeTime.toFixed(3)}s${batch > 1 ? ` (×${batch} per cycle)` : ''}</div>`;

  // ── Worker Robot Speed (infinite) ──
  const nextSpeedLvl = speedLevel + 1;
  const speedData = getRobotSpeedTechData(nextSpeedLvl);
  const speedIsCur = cur === 'robot:speed';
  const canResearchSpeed = !cur && labCount > 0;

  const speedIsQueued = (state.research.queue ?? []).includes('robot:speed');
  const speedAutoOn = state.research.infiniteAutoStart === 'robot:speed';
  const speedAutoBtn = `<button class="btn-sm ${speedAutoOn ? 'btn-primary' : 'btn-secondary'} rcard-btn"
    style="margin-left:auto;font-size:.7rem;padding:.15rem .5rem"
    onclick="toggleInfiniteAutoStart('robot:speed')"
    title="${speedAutoOn ? 'Stop auto-repeating this tech' : 'Automatically restart each level when it completes'}">
    Auto: ${speedAutoOn ? 'ON' : 'OFF'}</button>`;
  html += `<div class="robot-tech-group">
    <div class="robot-tech-header">
      <span>Worker Robot Speed</span>
      <span class="robot-tech-badge">Level ${speedLevel}${speedLevel > 0 ? ` · +${(speedLevel * WORKER_SPEED_PER_LEVEL * 100).toFixed(0)}% robot effectiveness` : ''}</span>
      ${speedAutoBtn}
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
    const autoOn = state.research.infiniteAutoStart === techType;
    const autoBtn = `<button class="btn-sm ${autoOn ? 'btn-primary' : 'btn-secondary'} rcard-btn"
      style="margin-left:auto;font-size:.7rem;padding:.15rem .5rem"
      onclick="toggleInfiniteAutoStart('${techType}')"
      title="${autoOn ? 'Stop auto-repeating this tech' : 'Automatically restart each level when it completes'}">
      Auto: ${autoOn ? 'ON' : 'OFF'}</button>`;
    let out = `<div class="robot-tech-group">
      <div class="robot-tech-header">
        <span>${label}</span>
        <span class="robot-tech-badge">Level ${level}${level > 0 ? ' · ' + bonusLabel(level) : ''}</span>
        ${autoBtn}
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
  return 4 * (state.perimeter?.sideLength ?? 14);
}

function perimeterMaxWalls() {
  return perimeterTiles() * WALLS_PER_TILE;   // 20 * 4 * sideLength
}

function perimeterMaxTurrets() {
  return perimeterTiles() * (TURRETS_PER_TILE + (state?.chestUpgrades?.turretsPerTile ?? 0));
}

function perimeterMaxArtillery() {
  const sl = state.perimeter?.sideLength ?? 14;
  const rangeLevel = state.perimeter?.artilleryRangeLevel ?? 0;
  let total = 0;
  for (let k = 1; k <= rangeLevel + 1; k++) {
    const ring = sl - k;
    if (ring <= 0) break;
    total += 4 * ring;
  }
  return total;
}

// Returns the player's science tier (0–3) based on highest non-rainbow pack crafted/researched.
function getPlayerScienceTier() {
  const nonRainbow = SCIENCE_PACKS.filter(p => p !== 'rainbowScience');
  // SCIENCE_PACKS order: red(0), green(1), blue(2), black(3), purple(4), yellow(5), space(6)
  for (let i = nonRainbow.length - 1; i >= 0; i--) {
    const pk = nonRainbow[i];
    if ((state.inventory[pk] ?? 0) > 0 || (state.itemsProduced?.[pk] ?? 0) > 0) {
      if (i === 0) return 1;  // red science
      if (i === 1) return 2;  // green science
      if (i <= 3)  return 3;  // blue or black science
      if (i === 4) return 4;  // purple science
      return 5;               // yellow or space science
    }
  }
  return 0;
}

// Returns true if the rainbow science pack has ever been crafted or researched.
function hasRainbowScience() {
  const rk = SCIENCE_PACKS[SCIENCE_PACKS.length - 1]; // 'rainbowScience'
  return (state.inventory?.[rk] ?? 0) > 0 || !!state.research?.done?.['rainbowSciencePack'];
}

function getBiterTierData(points) {
  let tier = null;
  for (const t of BITER_TIERS) {
    if (points >= t.threshold) tier = t;
    else break;
  }
  return tier;
}

function getBiterEnemyTier() {
  if (hasRainbowScience()) return BITER_TIERS[BITER_TIERS.length - 1];
  const nonRainbow = SCIENCE_PACKS.filter(p => p !== 'rainbowScience');
  for (let i = nonRainbow.length - 1; i >= 0; i--) {
    if ((state.inventory?.[nonRainbow[i]] ?? 0) > 0 || (state.itemsProduced?.[nonRainbow[i]] ?? 0) > 0)
      return BITER_TIERS[Math.min(i, BITER_TIERS.length - 1)];
  }
  return BITER_TIERS[0];
}

function getBiterWaveStats() {
  const pts = state.biterThreatPoints ?? 0;
  return {
    count: Math.max(1, Math.round(pts * 300)),
    hp:    Math.max(1, Math.round(pts * 3000)),
    armor: Math.floor(pts * 4),
    dps:   pts * 400,
  };
}

function calcDefenseDPS(waveArmor, laserRatio = 1) {
  const p     = state.perimeter;
  const ammoType = p.ammoType ?? 'firearmMagazine';
  const gMult = gunDamageMult(state.research?.gunDamageLevel ?? 0);
  const lMult = laserDamageMult(state.research?.laserDamageLevel ?? 0);

  const fireRateMult = 1 + (state.chestUpgrades?.turretFireRate ?? 0) * 0.01;
  const dmgMult      = 1 + (state.chestUpgrades?.turretDamage   ?? 0) * 0.01;

  const stats = GUN_TURRET_STATS[ammoType] ?? GUN_TURRET_STATS.firearmMagazine;
  const effectiveDmg    = Math.max(0, stats.dmgPerShot * gMult * dmgMult - waveArmor * stats.armorMult);
  const gunDpsPerTurret = stats.shotsPerSec * fireRateMult * effectiveDmg;

  const ammoAvail     = state.inventory[ammoType] ?? 0;
  const effectiveGuns = ammoAvail > 0 ? p.gunTurrets : 0;
  const gunDPS        = effectiveGuns * gunDpsPerTurret;
  const laserEffectiveDmg = Math.max(0, LASER_DMG_PER_SHOT * lMult * dmgMult - waveArmor * LASER_ARMOR_MULT);
  const laserDPS          = p.laserTurrets * LASER_SHOTS_PER_SEC * laserRatio * fireRateMult * laserEffectiveDmg;
  return { gunDPS, laserDPS, totalDPS: gunDPS + laserDPS, gunDpsPerTurret, stats, effectiveDmg, laserEffectiveDmg };
}

// Runs the next-wave scenario as a sim (no resource use, no side effects).
// Returns { buildingsAtRisk, wallDestroyed, survived, killTime, overflow }.
function simulateNextWaveOutcome() {
  if (!state?.settings?.biters) return null;

  const base        = getBiterWaveStats();
  const { totalDPS } = calcDefenseDPS(base.armor, state.powerRatio ?? 1);
  const wallHpMult  = hasMetaPerk('perk_wall_hp') ? 1.5 : 1;
  const totalWallHP = (state.perimeter.walls ?? 0) * WALL_HP * wallHpMult;
  const numSections = perimeterTiles();
  const rainbow     = hasRainbowScience();
  let sectionsAttacked;
  if (rainbow) {
    sectionsAttacked = numSections;
  } else {
    const tier = getPlayerScienceTier();
    const pct  = tier <= 1 ? 0.05 : tier === 2 ? 0.20 : 0.40;
    sectionsAttacked = Math.max(1, Math.round(numSections * pct));
  }

  const totalBiterHP  = base.count * base.hp;
  const biterTotalDPS = base.count * base.dps;
  const wallHP        = numSections > 0 ? (totalWallHP / numSections) * sectionsAttacked : 0;

  // Step the simulation forward in small increments (no resource consumption)
  const DT = 0.1;
  let biterHP   = totalBiterHP;
  let wallHPrem = wallHP;
  let overflow  = 0;
  let time      = 0;
  let phase     = 'grace';
  let graceTimer = 0;
  const maxTime = biterInterval() * 3;

  while (biterHP > 0 && time < maxTime) {
    const hpFrac = totalBiterHP > 0 ? biterHP / totalBiterHP : 0;
    biterHP = Math.max(0, biterHP - totalDPS * DT);
    if (phase === 'grace') {
      graceTimer += DT;
      if (graceTimer >= WAVE_GRACE_PERIOD) phase = 'combat';
    } else if (phase === 'combat') {
      const biterDPS = biterTotalDPS * hpFrac;
      wallHPrem -= biterDPS * DT;
      if (wallHPrem <= 0) { wallHPrem = 0; phase = 'overflow'; }
    } else {
      const biterDPS = biterTotalDPS * hpFrac;
      overflow += biterDPS * DT;
    }
    time += DT;
  }
  // If biters never died (totalDPS=0), compute overflow from remaining biter DPS × time
  if (biterHP > 0 && totalDPS <= 0 && phase === 'combat') {
    overflow += biterTotalDPS * (maxTime - graceTimer - (wallHP / Math.max(1, biterTotalDPS)));
    overflow = Math.max(0, overflow);
  }

  const buildingsAtRisk = overflow > 0 ? Math.max(1, Math.floor(overflow / BUILDING_TOUGHNESS)) : 0;
  return {
    survived: overflow <= 0,
    buildingsAtRisk,
    wallDestroyed: wallHPrem <= 0 && overflow >= 0,
    overflow: Math.round(overflow),
    killTime: biterHP <= 0 ? time.toFixed(1) : null,
  };
}

function fightBiterWave() {
  // Force-finalize any wave still in progress before starting a new one
  if (state.activeWave) finalizeWave(state.activeWave, true);

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
    const dm = state.settings?.biterDifficultyMult ?? 1;
    let pointsPerWave;
    if      (tier === 0) pointsPerWave = BITER_POINTS_PRE_RED     * dm;
    else if (tier === 1) pointsPerWave = BITER_POINTS_POST_RED    * dm;
    else if (tier === 2) pointsPerWave = BITER_POINTS_POST_GREEN  * dm;
    else if (tier === 3) pointsPerWave = BITER_POINTS_POST_BLUE   * dm;
    else if (tier === 4) pointsPerWave = BITER_POINTS_POST_PURPLE * dm;
    else                 pointsPerWave = BITER_POINTS_POST_YELLOW * dm;
    state.biterThreatPoints = Math.min(BITER_POINTS_CAP_LINEAR, (state.biterThreatPoints ?? 0) + pointsPerWave);
  }

  // ── Tier popup ─────────────────────────────────────────────
  const newTierData = getBiterEnemyTier();
  if (newTierData && !(state.biterSeenTiers ?? {})[newTierData.name]) {
    if (!state.biterSeenTiers) state.biterSeenTiers = {};
    state.biterSeenTiers[newTierData.name] = true;
    showBiterPopup(newTierData);
  }

  // ── Snapshot biter stats ───────────────────────────────────
  const base        = getBiterWaveStats();
  const actualCount = base.count;
  const actualHP    = base.hp;
  const actualArmor = base.armor;
  const actualDPS   = base.dps;

  const p           = state.perimeter;
  const wallHpMult  = hasMetaPerk('perk_wall_hp') ? 1.5 : 1;
  const totalWallHP = p.walls * WALL_HP * wallHpMult;
  const ammoType    = p.ammoType ?? 'firearmMagazine';
  const stats       = GUN_TURRET_STATS[ammoType] ?? GUN_TURRET_STATS.firearmMagazine;

  // ── Wall section model ─────────────────────────────────────
  const numSections = perimeterTiles();
  let sectionsAttacked;
  if (rainbow) {
    sectionsAttacked = numSections;
  } else {
    const tier = getPlayerScienceTier();
    const pct  = tier <= 1 ? 0.05 : tier === 2 ? 0.20 : 0.40;
    sectionsAttacked = Math.max(1, Math.round(numSections * pct));
  }

  // ── Apply pre-accumulated artillery damage ─────────────────
  const artPreDamage = state.artilleryAccumDamage ?? 0;
  const artDmgPerShell = ARTILLERY_BASE_DAMAGE * artilleryDamageMult(p.artilleryDamageLevel ?? 0);
  const artShellsUsed  = artPreDamage > 0 && artDmgPerShell > 0
    ? Math.round(artPreDamage / artDmgPerShell) : 0;
  state.artilleryAccumDamage = 0;
  state.artilleryShellAcc    = 0;

  const totalBiterHP      = actualCount * actualHP;
  const remainingBiterHP  = Math.max(0, totalBiterHP - artPreDamage);
  const waveKilledByArtillery = remainingBiterHP <= 0 && (p.artillery ?? 0) > 0;
  state.waveKilledByArtillery = waveKilledByArtillery;

  if (waveKilledByArtillery) {
    // Artillery killed the wave before it reached the walls — instant resolution
    state.biterWaveNumber = waveNum;
    // Meta progression
    if (state.settings?.biters) {
      state.bitersKilled = (state.bitersKilled ?? 0) + actualCount * sectionsAttacked;
      const pts = state.biterThreatPoints ?? 0;
      const pointDelta = Math.floor(pts - 1) / 67;
      if (pointDelta > 0) { metaState.pendingPoints = (metaState.pendingPoints ?? 0) + pointDelta; saveMetaState(); }
    }
    const { gunDPS, laserDPS, totalDPS } = calcDefenseDPS(actualArmor, state.powerRatio ?? 1);
    state.lastBiterWave = {
      waveNum, count: actualCount, hp: actualHP, armor: actualArmor,
      dps: actualDPS.toFixed(1), gunDPS: gunDPS.toFixed(1), laserDPS: laserDPS.toFixed(1),
      totalDPS: totalDPS.toFixed(1), killTime: null, biterDamage: '0',
      totalWallHP, buildingsLost: 0, ammoUsed: 0, ammoType,
      sectionsAttacked, numSections,
      artPreDamage: Math.round(artPreDamage), artShellsUsed, artKilled: true,
      bombsUsed: 0, hadAtomicAssist: false, result: 'art_killed',
    };
    lastPerimeterHtml = ''; lastWavePreviewHash = '';
    notify(`✓ ${getBiterEnemyTier()?.name ?? 'Biters'} wave ${waveNum} destroyed by artillery!`, 'info');
    return;
  }

  // ── Start time-based wave simulation ──────────────────────
  state.activeWave = {
    waveNum,
    biterHP:       remainingBiterHP,
    biterMaxHP:    remainingBiterHP,
    biterTotalDPS: actualCount * actualDPS,
    armor:         actualArmor,
    count:         actualCount,
    sectionsAttacked,
    numSections,
    wallHP:        (totalWallHP / numSections) * sectionsAttacked,
    graceTimer:    0,
    overflow:      0,
    bulletsUsed:   0,
    ammoType,
    stats,
    waveTimer:     0,
    phase:         'grace',
    artPreDamage,
    artShellsUsed,
  };
  lastPerimeterHtml = ''; lastWavePreviewHash = '';
}

function tickActiveWave(dt) {
  const w = state.activeWave;
  if (!w) return;

  w.waveTimer += dt;

  const p            = state.perimeter;
  const fireRateMult = 1 + (state.chestUpgrades?.turretFireRate ?? 0) * 0.01;
  const { totalDPS, stats } = calcDefenseDPS(w.armor, state.powerRatio ?? 1);

  // Biter DPS scales with remaining HP fraction
  const hpFrac          = w.biterMaxHP > 0 ? w.biterHP / w.biterMaxHP : 0;
  const currentBiterDPS = w.biterTotalDPS * hpFrac;

  // Turrets fire at biters every tick
  w.biterHP = Math.max(0, w.biterHP - totalDPS * dt);

  // Gun ammo: shots this tick → bullets accumulated
  w.bulletsUsed += p.gunTurrets * (stats?.shotsPerSec ?? 5) * fireRateMult * dt;

  if (w.phase === 'grace') {
    w.graceTimer += dt;
    if (w.graceTimer >= WAVE_GRACE_PERIOD) w.phase = 'combat';
  } else if (w.phase === 'combat') {
    w.wallHP -= currentBiterDPS * dt;
    if (w.wallHP <= 0) { w.wallHP = 0; w.phase = 'overflow'; }
  } else if (w.phase === 'overflow') {
    w.overflow += currentBiterDPS * dt;
    // Safety timeout: force-finalize if wave drags past two full intervals
    if (w.waveTimer >= biterInterval() * 2) { finalizeWave(w, true); return; }
  }

  if (w.biterHP <= 0) finalizeWave(w, false);
}

function finalizeWave(w, forced) {
  state.activeWave = null;
  if (state.settings?.autoSendInstant) {
    state.biterTimer = biterInterval(); // triggers wave on next tick
  }
  const p = state.perimeter;

  // If forced while biters still alive, estimate overflow from remaining DPS
  if (forced && w.biterHP > 0 && w.phase !== 'grace') {
    const remainingDPS = w.biterTotalDPS * (w.biterHP / Math.max(1, w.biterMaxHP));
    w.overflow += remainingDPS * WAVE_GRACE_PERIOD;
  }

  // Ammo: convert accumulated bullets to magazines
  const magsNeeded     = Math.ceil(w.bulletsUsed / MAGAZINE_SIZE);
  const actualMagsUsed = Math.min(magsNeeded, state.inventory[w.ammoType] ?? 0);
  if (actualMagsUsed > 0) recordConsumed(w.ammoType, actualMagsUsed);

  // Atomic bomb defense
  p.atomicBombsUsedThisWave = 0;
  let bombsUsed = 0;
  const availableBombs = (p.spidertrons ?? 0) * ATOMIC_BOMBS_PER_SPIDER;
  if (w.overflow > 0 && availableBombs > 0) {
    const nukeableSections     = Math.max(1, Math.floor(w.numSections / 20));
    const biterHPperNukeSection = w.biterMaxHP / nukeableSections;
    const bombsPerSection       = Math.ceil(biterHPperNukeSection / ATOMIC_BOMB_DAMAGE);
    const bombsNeeded           = nukeableSections * bombsPerSection;
    bombsUsed = Math.min(bombsNeeded, availableBombs);
    w.overflow = Math.max(0, w.overflow - bombsUsed * ATOMIC_BOMB_DAMAGE);
  }
  p.atomicBombsUsedThisWave = bombsUsed;
  if (bombsUsed > 0) p.irradiationLevel = (p.irradiationLevel ?? 0) + bombsUsed;

  // Buildings destroyed from overflow
  let buildingsLost = 0;
  if (w.overflow > 0) {
    buildingsLost = Math.max(1, Math.floor(w.overflow / BUILDING_TOUGHNESS));
    for (let i = 0; i < buildingsLost; i++) {
      const keys = Object.keys(state.buildings).filter(k => state.buildings[k].count > 0);
      if (keys.length === 0) break;
      const k = keys[Math.floor(Math.random() * keys.length)];
      state.buildings[k].count--;
      if (state.buildings[k].count <= 0) delete state.buildings[k];
    }
    _groupsDirty = true; _typeCountsCache = null;
  }

  // Irradiation threat scaling
  const irradiationBonus = (p.irradiationLevel ?? 0) * IRRADIATION_SCALING_RATE;
  if (irradiationBonus > 0) state.biterThreatPoints = (state.biterThreatPoints ?? 0) + irradiationBonus;

  // Meta progression
  if (state.settings?.biters) {
    state.bitersKilled = (state.bitersKilled ?? 0) + w.count * w.sectionsAttacked;
    const pts = state.biterThreatPoints ?? 0;
    const pointDelta = Math.floor(pts - 1) / 67;
    if (pointDelta > 0) { metaState.pendingPoints = (metaState.pendingPoints ?? 0) + pointDelta; saveMetaState(); }
  }

  state.biterWaveNumber = w.waveNum;
  const { gunDPS, laserDPS, totalDPS } = calcDefenseDPS(w.armor, state.powerRatio ?? 1);
  state.lastBiterWave = {
    waveNum:    w.waveNum,
    count:      w.count,
    hp:         Math.round(w.biterMaxHP / Math.max(1, w.count)),
    armor:      w.armor,
    dps:        (w.biterTotalDPS / Math.max(1, w.count)).toFixed(1),
    gunDPS:     gunDPS.toFixed(1),
    laserDPS:   laserDPS.toFixed(1),
    totalDPS:   totalDPS.toFixed(1),
    killTime:   w.waveTimer.toFixed(1),
    biterDamage: Math.round(w.overflow).toFixed(0),
    totalWallHP: p.walls * WALL_HP * (hasMetaPerk('perk_wall_hp') ? 1.5 : 1),
    buildingsLost,
    ammoUsed:   actualMagsUsed,
    ammoType:   w.ammoType,
    sectionsAttacked: w.sectionsAttacked,
    numSections:      w.numSections,
    artPreDamage:  Math.round(w.artPreDamage ?? 0),
    artShellsUsed: w.artShellsUsed ?? 0,
    artKilled: false,
    bombsUsed,
    hadAtomicAssist: bombsUsed > 0,
    result: buildingsLost > 0 ? 'buildings_lost' : 'repelled',
  };

  lastPerimeterHtml = ''; lastWavePreviewHash = '';
  const tierName = getBiterEnemyTier()?.name ?? 'Biters';
  if (buildingsLost > 0)
    notify(`⚠ ${tierName} wave ${w.waveNum}: ${buildingsLost} building${buildingsLost > 1 ? 's' : ''} destroyed!`, 'warning');
  else
    notify(`✓ ${tierName} wave ${w.waveNum} repelled!`, 'info');
}

function skipToNextBiterWave() {
  if (state.activeWave) finalizeWave(state.activeWave, true);
  state.waveKilledByArtillery = false;
  state.biterTimer = state.settings?.biterIntervalSecs ?? BITER_INTERVAL;
  lastPerimeterHtml = '';
  renderPerimeter();
}

function toggleArtilleryPause() {
  state.settings.artilleryPaused = !state.settings.artilleryPaused;
  lastPerimeterHtml = '';
  renderPerimeter();
}

function toggleAutoSend(mode) {
  if (mode === 'artilleryKill') state.settings.autoSendArtilleryKill = !state.settings.autoSendArtilleryKill;
  if (mode === 'instant')       state.settings.autoSendInstant       = !state.settings.autoSendInstant;
  lastPerimeterHtml = '';
  renderPerimeter();
}

function addPerimeterDefense(type, amount) {
  const p = state.perimeter;
  if (type === 'walls') {
    const max   = perimeterMaxWalls();
    const toAdd = Math.min(amount, max - p.walls, state.inventory.stoneWall ?? 0);
    if (toAdd <= 0) { notify('Not enough Stone Walls or perimeter is full', 'warning'); return; }
    recordConsumed('stoneWall', toAdd);
    p.walls += toAdd;
  } else if (type === 'gunTurrets') {
    const max   = perimeterMaxTurrets();
    const toAdd = Math.min(amount, max - p.gunTurrets - p.laserTurrets, state.inventory.gunTurretItem ?? 0);
    if (toAdd <= 0) { notify('Not enough Gun Turrets or perimeter is full', 'warning'); return; }
    recordConsumed('gunTurretItem', toAdd);
    p.gunTurrets += toAdd;
  } else if (type === 'laserTurrets') {
    const max   = perimeterMaxTurrets();
    const toAdd = Math.min(amount, max - p.gunTurrets - p.laserTurrets, state.inventory.laserTurretItem ?? 0);
    if (toAdd <= 0) { notify('Not enough Laser Turrets or perimeter is full', 'warning'); return; }
    recordConsumed('laserTurretItem', toAdd);
    p.laserTurrets += toAdd;
  } else if (type === 'artillery') {
    const max   = perimeterMaxArtillery();
    const toAdd = Math.min(amount, max - (p.artillery ?? 0), state.inventory.artilleryTurretItem ?? 0);
    if (toAdd <= 0) { notify('Not enough Artillery Turrets or perimeter is full', 'warning'); return; }
    recordConsumed('artilleryTurretItem', toAdd);
    p.artillery = (p.artillery ?? 0) + toAdd;
  } else if (type === 'spidertrons') {
    const toAdd = Math.min(amount, state.inventory.spidertronItem ?? 0);
    if (toAdd <= 0) { notify('Not enough Spidertrons in inventory', 'warning'); return; }
    recordConsumed('spidertronItem', toAdd);
    p.spidertrons = (p.spidertrons ?? 0) + toAdd;
  }
}

function removePerimeterDefense(type, amount) {
  const p = state.perimeter;
  if (type === 'walls') {
    const n = Math.min(amount, p.walls);
    p.walls -= n;
    refundItem('stoneWall', n);
  } else if (type === 'gunTurrets') {
    const n = Math.min(amount, p.gunTurrets);
    p.gunTurrets -= n;
    refundItem('gunTurretItem', n);
  } else if (type === 'laserTurrets') {
    const n = Math.min(amount, p.laserTurrets);
    p.laserTurrets -= n;
    refundItem('laserTurretItem', n);
  } else if (type === 'artillery') {
    const n = Math.min(amount, p.artillery ?? 0);
    p.artillery = (p.artillery ?? 0) - n;
    refundItem('artilleryTurretItem', n);
  } else if (type === 'spidertrons') {
    const n = Math.min(amount, p.spidertrons ?? 0);
    p.spidertrons = (p.spidertrons ?? 0) - n;
    refundItem('spidertronItem', n);
  }
}

function expandPerimeter() {
  const newSideLength = state.perimeter.sideLength + 1;
  const chunksNeeded  = Math.pow(newSideLength, 2);
  const chunks        = state.chunksRevealed ?? 0;
  if (chunks < Math.pow(newSideLength, 2)) {
    notify(`Need ${Math.max(0, Math.pow(newSideLength, 2) - chunks)} more explored chunks`, 'warning');
    return;
  }
  const concreteCost = (2 * state.perimeter.sideLength + 1) * 10;
  if ((state.inventory.concrete ?? 0) < concreteCost) {
    notify(`Expanding requires ${concreteCost} Concrete (you have ${Math.floor(state.inventory.concrete ?? 0)})`, 'warning');
    return;
  }
  recordConsumed('concrete', concreteCost);
  state.perimeter.sideLength = newSideLength;
  // Unlock pending patch finds that are now inside the perimeter
  for (const patch of Object.values(state.patches)) {
    if (!patch.pendingFinds) continue;
    const stillLocked = [];
    for (const find of patch.pendingFinds) {
      if (find.chunkIndex < chunksNeeded) {
        patch.remaining += find.remaining;
        /* NODES: patch.nodes += find.nodes; */
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
  if (mouseHeld) return;
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
  const timeLeft  = !state.biterActivated
    ? `Waiting (${Math.max(0, Math.ceil(1800 - (state.savePlayTime ?? 0)))}s or red science)`
    : `${Math.ceil(interval - (state.biterTimer ?? 0))}s`;
  const ammoType  = p.ammoType ?? 'firearmMagazine';

  // Preview defense DPS with a mid-range armor estimate for next wave
  const { gunDPS, laserDPS, totalDPS, stats: gunStats, effectiveDmg, laserEffectiveDmg } = calcDefenseDPS(base.armor);
  const totalWallHP = p.walls * WALL_HP * (hasMetaPerk('perk_wall_hp') ? 1.5 : 1);
  const nextBiterHP = base.count * base.hp;

  let previewKillTime = totalDPS > 0 ? (nextBiterHP / totalDPS).toFixed(1) : '∞';
  const numSections   = perimeterTiles();
  const rainbowActive = hasRainbowScience();

  // Use cached wave simulation result for outcome prediction (updated every 20s by game tick)
  const sim = _waveSimCache;
  const previewBuildingsAtRisk = sim?.buildingsAtRisk ?? 0;
  const previewDamage          = sim?.overflow ?? 0;
  const previewSurvive         = !sim
    ? '⏳ Calculating…'
    : sim.survived
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
  const artAccumDmg      = state.artilleryAccumDamage ?? 0;
  const timeUntilWave    = Math.max(0, interval - (state.biterTimer ?? 0));
  const artFutureShells  = (p.artillery ?? 0) > 0
    ? Math.min(
        Math.floor(timeUntilWave / ARTILLERY_FIRE_RATE) * (p.artillery ?? 0),
        state.inventory.artilleryShell ?? 0
      )
    : 0;
  const artFutureDmg     = artFutureShells * artDmgPerPiece;
  const artTotalDmg      = artAccumDmg + artFutureDmg;
  const hpAfterArt       = Math.max(0, nextBiterHP - artTotalDmg);
  const artShellsPerTurret = Math.floor(biterInterval() / ARTILLERY_FIRE_RATE);
  const artShellsPerWave   = (p.artillery ?? 0) * artShellsPerTurret;

  // Spidertron computed values
  const availBombs       = (p.spidertrons ?? 0) * ATOMIC_BOMBS_PER_SPIDER;

  // Ammo/power estimates for wave prediction using simulated kill time
  const actualKillTimeSec     = totalDPS > 0 ? nextBiterHP / totalDPS : null;
  const simKillTimeSec        = sim?.killTime != null ? parseFloat(sim.killTime) : actualKillTimeSec;
  const fireRateMult          = 1 + (state.chestUpgrades?.turretFireRate ?? 0) * 0.01;
  const dmgMult               = 1 + (state.chestUpgrades?.turretDamage   ?? 0) * 0.01;
  const previewAmmoEst        = actualKillTimeSec != null ? Math.ceil(p.gunTurrets * (gunStats?.shotsPerSec ?? 5) * fireRateMult * actualKillTimeSec / MAGAZINE_SIZE) : null;
  const laserTotalKj       = p.laserTurrets > 0 && simKillTimeSec != null
    ? p.laserTurrets * LASER_KW_PER_TURRET * simKillTimeSec
    : null;
  const previewGridSurplus = Math.max(0, (state.powerKw ?? 0) - (state.powerDemandKw ?? 0));
  const laserEnergyPerWave = laserTotalKj != null
    ? Math.max(0, Math.round(laserTotalKj - previewGridSurplus * simKillTimeSec))
    : null;

  const concreteCost = (2 * p.sideLength + 1) * 10;
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
      <button class="btn-sm" onclick="addPerimeterDefense('walls',999999)">Max</button>
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
      <span>Shots/sec</span><strong>${(sps * fireRateMult).toFixed(2)}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Dmg/shot</span><strong>${baseDmg.toFixed(1)}${armMult > 0 ? ` − ${base.armor} armor = ${effectiveDmg.toFixed(1)}` : ' (ignores armor)'}</strong>
    </div>
    ${rainbowActive && (state.research?.gunDamageLevel ?? 0) > 6 ? `<div class="perimeter-stat-row"><span>Dmg upgrade bonus</span><strong>+70% per level (rainbow)</strong></div>` : ''}
    <div class="perimeter-stat-row">
      <span>Total DPS</span><strong>${gunDPS.toFixed(1)}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>In inventory</span><strong>${Math.floor(state.inventory.gunTurretItem ?? 0)}</strong>
    </div>
    <div class="perimeter-btn-row">
      <button class="btn-sm" onclick="addPerimeterDefense('gunTurrets',1)">+1</button>
      <button class="btn-sm" onclick="addPerimeterDefense('gunTurrets',5)">+5</button>
      <button class="btn-sm" onclick="addPerimeterDefense('gunTurrets',999999)">Max</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('gunTurrets',1)">−1</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('gunTurrets',5)">−5</button>
    </div>
    <div style="margin-top:.5rem">
      <label class="perimeter-label">Ammo type:</label>
      <select class="perimeter-select" onchange="setPerimeterAmmo(this.value)">
        ${ammoOptions.map(o => `<option value="${o.key}" ${ammoType === o.key ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>
      <div class="perimeter-stat-row" style="margin-top:.25rem">
        <span>Ammo in inv</span><strong>${Math.floor(state.inventory[ammoType] ?? 0)}</strong>
      </div>
    </div>
  </div>

  ${!!state.research?.done?.laserTurretTech ? (() => {
    const laserDamageLevel = state.research?.laserDamageLevel ?? 0;
    return `<div class="perimeter-card">
    <div class="perimeter-card-title">⚡ Laser Turrets</div>
    <div class="perimeter-stat-row">
      <span>Placed</span><strong>${p.laserTurrets} (${maxTurrets - p.gunTurrets - p.laserTurrets} remaining in shared pool)</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Base dmg/shot</span><strong>${(LASER_DMG_PER_SHOT * lMult * dmgMult).toFixed(1)} − ${base.armor}×${LASER_ARMOR_MULT} = ${laserEffectiveDmg.toFixed(1)}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Shots/sec</span><strong>${(LASER_SHOTS_PER_SEC * fireRateMult).toFixed(2)}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>DPS/turret</span><strong>${(laserEffectiveDmg * LASER_SHOTS_PER_SEC * fireRateMult).toFixed(1)}</strong>
    </div>
    ${rainbowActive && laserDamageLevel > 6 ? `<div class="perimeter-stat-row"><span>Dmg upgrade bonus</span><strong>+70% per level (rainbow)</strong></div>` : ''}
    <div class="perimeter-stat-row">
      <span>Total DPS</span><strong>${laserDPS.toFixed(1)} (${Math.round((state.powerRatio ?? 1) * 100)}% power)</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>In inventory</span><strong>${Math.floor(state.inventory.laserTurretItem ?? 0)}</strong>
    </div>
    <div class="perimeter-btn-row">
      <button class="btn-sm" onclick="addPerimeterDefense('laserTurrets',1)">+1</button>
      <button class="btn-sm" onclick="addPerimeterDefense('laserTurrets',5)">+5</button>
      <button class="btn-sm" onclick="addPerimeterDefense('laserTurrets',999999)">Max</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('laserTurrets',1)">−1</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('laserTurrets',5)">−5</button>
    </div>
  </div>`;
  })() : ''}

  ${!!state.research?.done?.artillery ? (() => {
    const artPaused   = state.settings?.artilleryPaused      ?? false;
    const autoArtKill = state.settings?.autoSendArtilleryKill ?? false;
    const autoInstant = state.settings?.autoSendInstant       ?? false;
    return `<div class="perimeter-card">
    <div class="perimeter-card-title">💣 Artillery Turrets</div>
    <div class="perimeter-stat-row">
      <span>Placed / Max</span><strong>${p.artillery ?? 0} / ${maxArtillery}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Dmg per shell</span><strong>${artDmgPerPiece.toLocaleString()}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Fire rate</span><strong>1 shell / ${ARTILLERY_FIRE_RATE}s per turret</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Shells per wave (max)</span><strong>${artShellsPerWave} (${artShellsPerTurret}/turret)</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Art. accumulated</span><strong>${artAccumDmg.toLocaleString()} dmg${artAccumDmg >= nextBiterHP ? ' ✅ wave dead' : ''}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Art. projected add</span><strong>~${artFutureDmg.toLocaleString()} (${artFutureShells} more shells)</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>HP when wave arrives</span><strong>${hpAfterArt.toLocaleString()}${hpAfterArt === 0 ? ' ✅ kills wave' : ` (${Math.round(hpAfterArt / nextBiterHP * 100)}% remaining)`}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Range level</span><strong>${artRangeLevel}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Damage level</span><strong>${artDmgLevel} (+${Math.round((artilleryDamageMult(artDmgLevel) - 1) * 100)}%)</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Shells in inventory</span><strong>${Math.floor(state.inventory.artilleryShell ?? 0)}</strong>
    </div>
    <div class="perimeter-stat-row">
      <span>Turrets in inventory</span><strong>${Math.floor(state.inventory.artilleryTurretItem ?? 0)}</strong>
    </div>
    <div class="perimeter-btn-row">
      <button class="btn-sm" onclick="addPerimeterDefense('artillery',1)">+1</button>
      <button class="btn-sm" onclick="addPerimeterDefense('artillery',5)">+5</button>
      <button class="btn-sm" onclick="addPerimeterDefense('artillery',999999)">Max</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('artillery',1)">−1</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('artillery',5)">−5</button>
      <button class="btn-sm${artPaused ? ' btn-danger-sm' : ''}" onclick="toggleArtilleryPause()">${artPaused ? '⏸ Paused' : '▶ Firing'}</button>
    </div>
    <div class="perimeter-btn-row" style="margin-top:.35rem">
      <button class="btn-sm${autoArtKill ? ' btn-primary' : ''}" onclick="toggleAutoSend('artilleryKill')">Auto: Art. Kill</button>
      <button class="btn-sm${autoInstant ? ' btn-primary' : ''}" onclick="toggleAutoSend('instant')">Auto: After Combat</button>
      ${!state.activeWave && state.biterActivated ? `<button class="btn-sm" style="color:var(--green)" onclick="skipToNextBiterWave()">▶ Send Wave Now</button>` : ''}
    </div>
    <div style="margin-top:.5rem;font-size:.8rem;color:var(--text-muted)">
      Research: Artillery Range Lvl ${artRangeLevel + 1} · Artillery Damage Lvl ${artDmgLevel + 1}
    </div>
  </div>`;
  })() : ''}

  ${!!state.research?.done?.spidertron ? `<div class="perimeter-card">
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
      <button class="btn-sm" onclick="addPerimeterDefense('spidertrons',999999)">Max</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('spidertrons',1)">−1</button>
      <button class="btn-sm btn-danger-sm" onclick="removePerimeterDefense('spidertrons',5)">−5</button>
    </div>
    ${lastWave?.bombsUsed > 0 ? `<div class="perimeter-stat-row" style="margin-top:.5rem"><span>Last wave bombs used</span><strong>${lastWave.bombsUsed}</strong></div>` : ''}
  </div>` : ''}

  ${(function() {
    // Live combat card — no caching, re-renders every frame
    if (state.activeWave) {
      lastWavePreviewHash = '';
      const w = state.activeWave;
      const hpPct      = w.biterMaxHP > 0 ? Math.max(0, w.biterHP / w.biterMaxHP * 100) : 0;
      const wallPct    = w.wallHP > 0 && w.phase !== 'overflow' ? Math.min(100, w.wallHP / (w.biterMaxHP > 0 ? w.wallHP + w.overflow : 1) * 100) : 0;
      const { totalDPS } = calcDefenseDPS(w.armor, state.powerRatio ?? 1);
      const phaseLabel  = w.phase === 'grace'
        ? `⏳ Grace period — ${Math.max(0, WAVE_GRACE_PERIOD - w.graceTimer).toFixed(1)}s remaining`
        : w.phase === 'combat' ? '⚔ Combat'
        : '🔴 BREACH — Overflow';
      return `<div class="perimeter-card perimeter-card-wide" style="border-color:${w.phase === 'overflow' ? 'var(--red)' : w.phase === 'combat' ? 'var(--yellow)' : 'var(--blue)'}">
    <div class="perimeter-card-title">⚔ Wave ${w.waveNum} In Progress — ${phaseLabel}</div>
    <div class="wave-preview-stats">
      <div class="wave-stat-compact"><span>Biter HP</span><strong>${hpPct.toFixed(1)}% (${Math.round(w.biterHP).toLocaleString()} / ${Math.round(w.biterMaxHP).toLocaleString()})</strong></div>
      <div class="wave-stat-compact"><span>Defense DPS</span><strong>${totalDPS.toFixed(1)}</strong></div>
      ${w.phase !== 'grace' && w.phase !== 'overflow' ? `<div class="wave-stat-compact"><span>Wall HP remaining</span><strong>${Math.round(w.wallHP).toLocaleString()}</strong></div>` : ''}
      ${w.phase === 'overflow' ? `<div class="wave-stat-compact" style="color:var(--red)"><span>Overflow damage</span><strong>${Math.round(w.overflow).toLocaleString()}</strong></div>` : ''}
      <div class="wave-stat-compact"><span>Elapsed</span><strong>${w.waveTimer.toFixed(1)}s</strong></div>
      <div class="wave-stat-compact"><span>Bullets fired</span><strong>${Math.round(w.bulletsUsed)} → ~${Math.ceil(w.bulletsUsed / MAGAZINE_SIZE)} mags</strong></div>
    </div>
  </div>`;
    }

    const wph = [
      (state.biterThreatPoints ?? 0).toFixed(1),
      state.biterWaveNumber,
      p.gunTurrets, p.laserTurrets, p.artillery ?? 0,
      p.ammoType ?? 'firearmMagazine',
      p.walls,
      Math.round((state.powerRatio ?? 1) * 20),
      Math.floor(artAccumDmg),
    ].join('|');
    if (wph !== lastWavePreviewHash) {
      lastWavePreviewHash = wph;
      const _previewTierData = getBiterEnemyTier();
      const _previewTierName = _previewTierData?.name ?? 'Biters';
      const _previewTierImg  = _previewTierData?.img ?? '';
      lastWavePreviewHtml = `<div class="perimeter-card perimeter-card-wide">
    <div class="perimeter-card-title">📊 Next Wave — Wave ${nextWave} · ${_previewTierName}</div>
    <div class="wave-preview-layout">
      <div class="wave-preview-stats">
        <div class="perimeter-wave-row">
          <div class="perimeter-wave-col">
            <div class="perimeter-label">Biters</div>
            <div class="perimeter-range">${base.count}</div>
          </div>
          <div class="perimeter-wave-col">
            <div class="perimeter-label">HP / biter</div>
            <div class="perimeter-range">${base.hp}</div>
          </div>
          <div class="perimeter-wave-col">
            <div class="perimeter-label">Armor</div>
            <div class="perimeter-range">${base.armor}</div>
          </div>
          <div class="perimeter-wave-col">
            <div class="perimeter-label">DPS / biter</div>
            <div class="perimeter-range">${base.dps.toFixed(1)}</div>
          </div>
        </div>
        <div class="wave-stat-compact" style="margin-top:.4rem">
          <span>Threat level</span><strong>${(state.biterThreatPoints ?? 0).toFixed(1)} pts${rainbowActive ? ' (exponential)' : ''}</strong>
        </div>
        <div class="wave-stat-compact">
          <span>Biter HP pool</span><strong>~${Math.max(0, nextBiterHP - artAccumDmg).toLocaleString()}${artAccumDmg > 0 ? ` (of ${nextBiterHP.toLocaleString()})` : ''}</strong>
        </div>
        <div class="wave-stat-compact">
          <span>Total DPS</span><strong>${totalDPS.toFixed(1)}</strong>
        </div>
        <div class="wave-stat-compact">
          <span>Est. kill time</span><strong>${sim?.killTime != null ? sim.killTime + 's (sim)' : previewKillTime + 's'}</strong>
        </div>
        <div class="wave-stat-compact">
          <span>Est. biter dmg</span><strong>~${parseFloat(previewDamage).toLocaleString()} · Wall: ${totalWallHP.toLocaleString()}</strong>
        </div>
        ${previewAmmoEst != null ? `<div class="wave-stat-compact"><span>Est. ammo used</span><strong>${previewAmmoEst.toLocaleString()} × ${ITEMS[ammoType]?.name ?? ammoType}</strong></div>` : ''}
        ${laserEnergyPerWave != null ? `<div class="wave-stat-compact"><span>Est. laser energy</span><strong>${(laserEnergyPerWave / 1000).toFixed(1)} MJ</strong></div>` : ''}
        <div class="perimeter-outcome ${sim && !sim.survived && totalDPS <= 0 ? 'perimeter-outcome-danger' : sim && !sim.survived ? 'perimeter-outcome-warn' : 'perimeter-outcome-ok'}">${previewSurvive}</div>
      </div>
      <div class="wave-preview-enemy">
        <div class="wanted-dead-label">Wanted Dead</div>
        ${_previewTierImg ? `<img src="${_previewTierImg}" class="wave-enemy-img" alt="${_previewTierName}">` : `<div class="wave-enemy-img" style="display:flex;align-items:center;justify-content:center;font-size:.7rem;color:var(--dim)">${_previewTierName}</div>`}
      </div>
    </div>
  </div>`;
    }
    return lastWavePreviewHtml;
  })()}

  ${state.waveKilledByArtillery ? `
  <div class="perimeter-card perimeter-card-wide" style="border-color:var(--green)">
    <div class="perimeter-card-title">✅ Wave ${state.biterWaveNumber} Destroyed by Artillery</div>
    <p style="font-size:.85rem;color:var(--text-muted);margin:.25rem 0 .5rem">Next wave arrives in ${Math.ceil(biterInterval() - (state.biterTimer ?? 0))}s — or start it now.</p>
    <button class="btn-sm" style="color:var(--green)" onclick="skipToNextBiterWave()">▶ Start Next Wave Now</button>
  </div>` : ''}

  ${lastWave ? `
  <div class="perimeter-card perimeter-card-wide">
    <div class="perimeter-card-title">⚔ Last Wave — Wave ${lastWave.waveNum} · ${lastWave.result === 'art_killed' ? '✅ Destroyed by Artillery' : lastWave.result === 'repelled' ? '✅ Repelled' : '❌ ' + lastWave.buildingsLost + ' building(s) lost'}</div>
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
    ${(lastWave.artShellsUsed ?? 0) > 0 ? `<div class="perimeter-stat-row"><span>Artillery shells used</span><strong>${lastWave.artShellsUsed} (${Math.round(lastWave.artPreDamage ?? 0).toLocaleString()} dmg${lastWave.artKilled ? ' — killed wave' : ''})</strong></div>` : ''}
    ${(lastWave.bombsUsed ?? 0) > 0 ? `<div class="perimeter-stat-row"><span>Atomic bombs used</span><strong>${lastWave.bombsUsed}</strong></div>` : ''}
  </div>` : ''}


</div>`;
  if (html === lastPerimeterHtml) return;
  lastPerimeterHtml = html;
  el.innerHTML = html;
}

function showBiterPopup(tierData) {
  const el = document.getElementById('biter-encounter-popup');
  if (!el) return;
  el.querySelector('.biter-popup-img').src  = tierData.img;
  el.querySelector('.biter-popup-name').textContent = tierData.name;
  el.classList.remove('hidden', 'biter-popup-fade');
  void el.offsetWidth;
  el.classList.add('biter-popup-show');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => {
    el.classList.add('biter-popup-fade');
    el.addEventListener('transitionend', () => { el.classList.add('hidden'); el.classList.remove('biter-popup-show','biter-popup-fade'); }, { once: true });
  }, 6000);
}

function renderBiterIndicator() {
  const el = document.getElementById('biter-indicator');
  if (!state.settings.biters) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  if (!state.biterActivated) {
    el.textContent = `⏳ Biters: make red science to activate`;
    el.classList.remove('biter-warning');
  } else {
    const secs     = Math.ceil(biterInterval() - (state.biterTimer ?? 0));
    const tierName = getBiterEnemyTier()?.name ?? 'Biters';
    el.textContent = `⚠ ${tierName}: ${secs}s`;
    el.classList.toggle('biter-warning', secs <= 30);
  }
}

function clearAllLimits() {
  for (const gs of Object.values(state.groupSettings ?? {})) gs.limit = Infinity;
  renderBuildings();
}

function toggleGamePaused() {
  _gamePaused = !_gamePaused;
  _lastTickTime = Date.now(); // reset so resume doesn't give a large dt burst
  const btn = document.getElementById('pause-btn');
  if (btn) { btn.textContent = _gamePaused ? '▶ Resume' : '⏸ Pause'; }
}

function toggleAllPaused() {
  const pausing = !state.allPaused;
  state.allPaused = pausing;
  const groups = buildGroupMap();
  for (const key of Object.keys(groups)) {
    const gs = getGS(key);
    gs.enabled = !pausing;
    if (pausing) { gs.coalAcc = 0; gs.starved = true; }
    else gs.starved = false;
  }
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
    const amt     = displayAmt(k);
    const rate    = SMOOTH > 0 ? (smoothedDelta[k] ?? 0) : (state.inventoryDelta[k] ?? 0);
    const cntStr  = fmtNum(amt);
    const rateStr = (rate >= 0 ? '+' : '') + rate.toFixed(1) + '/s';
    const ck = k + '_c', rk = k + '_r';
    starredMaxCh[ck] = Math.max(starredMaxCh[ck] ?? 0, cntStr.length);
    starredMaxCh[rk] = Math.max(starredMaxCh[rk] ?? 0, rateStr.length);
    return `<div class="starred-item" title="${ITEMS[k]?.name ?? k}">
      <span class="starred-icon">${itemIcon(k)}</span>
      <span class="starred-name">${ITEMS[k]?.name ?? k}</span>
      <span class="starred-count" style="min-width:${starredMaxCh[ck]}ch">${cntStr}</span>
      <span class="starred-rate ${rate >= 0 ? 'rate-pos' : 'rate-neg'}" style="min-width:${starredMaxCh[rk]}ch">${rateStr}</span>
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

  const ph = state.productionHistory ?? {};
  const COLORS = ['#f4a83a','#4caf50','#3a8fd6','#e04040','#9c27b0','#00bcd4','#ff7043','#8bc34a','#cddc39','#ff5252','#7e57c2','#26a69a'];

  if (graphMode === 'alltime') {
    const atSamples = ph.allTimeSamples ?? [];
    const last = atSamples[atSamples.length - 1];
    const rows = starred.map((k, ci) => {
      const color = COLORS[ci % COLORS.length];
      const name  = ITEMS[k]?.name ?? k;
      const total = last?.produced[k] ?? state.itemsProduced?.[k] ?? 0;
      const fmt = total >= 1e6 ? (total/1e6).toFixed(2)+'M' : total >= 1000 ? (total/1000).toFixed(1)+'k' : total.toFixed(0);
      return `<div class="graph-legend-row" title="${name}">
        <span class="graph-legend-swatch" style="background:${color}"></span>
        <span class="graph-legend-icon">${itemIcon(k)}</span>
        <span class="graph-legend-name">${name}</span>
        <span class="graph-legend-rate">${fmt} total</span>
      </div>`;
    }).join('');
    host.innerHTML = rows;
    return;
  }

  // Compute "current value" for each starred item from latest sample of selected mode.
  const samples =
      graphMode === 'production'  ? (ph.prodSamples ?? [])
    : graphMode === 'consumption' ? (ph.consSamples ?? [])
    :                                (ph.samples     ?? []);
  const last = samples[samples.length - 1] ?? {};

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

function fmtCount(v) {
  if (v >= 1e9) return (v/1e9).toFixed(2)+'B';
  if (v >= 1e6) return (v/1e6).toFixed(2)+'M';
  if (v >= 1000) return (v/1000).toFixed(1)+'k';
  return v.toFixed(0);
}

function renderGraphAllTime(canvas, ctx, ph, starred) {
  const W = canvas.width  = canvas.offsetWidth  || 800;
  const H = canvas.height = canvas.offsetHeight || 300;
  ctx.clearRect(0, 0, W, H);

  if (starred.length === 0) {
    ctx.fillStyle = '#6b7587'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Star items in the Inventory tab to chart their totals here', W/2, H/2);
    return;
  }
  const samples = ph.allTimeSamples ?? [];
  if (samples.length < 2) {
    ctx.fillStyle = '#6b7587'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Collecting all-time data… (first sample in ~60s)', W/2, H/2);
    return;
  }

  const COLORS = ['#f4a83a','#4caf50','#3a8fd6','#e04040','#9c27b0','#00bcd4','#ff7043','#8bc34a','#cddc39','#ff5252','#7e57c2','#26a69a'];
  const pad = { top: 14, bottom: 22, left: 60, right: 10 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const t0 = samples[0].t;
  const t1 = samples[samples.length - 1].t;
  const tSpan = t1 - t0 || 1;

  let maxVal = 0;
  for (const s of samples)
    for (const k of starred) { const v = s.produced[k] ?? 0; if (v > maxVal) maxVal = v; }
  if (maxVal === 0) maxVal = 1;

  const scaleY = v => pad.top + plotH - (v / maxVal) * plotH;
  const scaleX = s => pad.left + ((s.t - t0) / tSpan) * plotW;

  ctx.strokeStyle = '#2e3847'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (i / 4) * plotH;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    const v = maxVal * (1 - i / 4);
    ctx.fillStyle = '#6b7587'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
    ctx.fillText(fmtCount(v), pad.left - 4, y + 3);
  }

  starred.forEach((k, ci) => {
    ctx.strokeStyle = COLORS[ci % COLORS.length]; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const x = scaleX(samples[i]);
      const y = scaleY(samples[i].produced[k] ?? 0);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

  // X-axis time labels — left=oldest, right=now. tSpan is in play-time seconds.
  const fmtAge = s => s >= 86400 ? (s/86400).toFixed(1)+'d ago'
                    : s >= 3600  ? (s/3600).toFixed(1)+'h ago'
                    : s >= 60    ? Math.round(s/60)+'m ago'
                    :              s+'s ago';
  ctx.fillStyle = '#6b7587'; ctx.font = '10px monospace';
  ctx.textAlign = 'left';  ctx.fillText(fmtAge(Math.round(tSpan)), pad.left, H - 4);
  ctx.textAlign = 'right'; ctx.fillText('now', W - pad.right, H - 4);
  ctx.textAlign = 'center'; ctx.fillText(fmtAge(Math.round(tSpan/2)), W/2, H - 4);
}

function renderGraph() {
  const canvas = document.getElementById('graph-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const ph = state.productionHistory ?? {};
  const starred = state.starredItems ?? [];

  if (graphMode === 'alltime') {
    renderGraphAllTime(canvas, ctx, ph, starred);
    return;
  }

  const samples =
      graphMode === 'production'  ? (ph.prodSamples ?? [])
    : graphMode === 'consumption' ? (ph.consSamples ?? [])
    :                                (ph.samples     ?? []);

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

  // Compute axis range from raw samples (before smoothing) so scale is stable
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

  // Build 10-sample rolling averages for display
  const AVG_WIN = 10;
  const smoothed = samples.map((_, i) => {
    const from = Math.max(0, i - AVG_WIN + 1);
    const obj = {};
    for (const k of starred) {
      let sum = 0;
      for (let j = from; j <= i; j++) sum += samples[j][k] ?? 0;
      obj[k] = sum / (i - from + 1);
    }
    return obj;
  });

  // Data lines
  starred.forEach((k, ci) => {
    ctx.strokeStyle = COLORS[ci % COLORS.length];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < smoothed.length; i++) {
      const x = scaleX(i);
      const y = scaleY(smoothed[i][k] ?? 0);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
}

function handleRunEnd(reason) {
  // 1. Award pending points
  metaState.totalPoints = (metaState.totalPoints ?? 0) + (metaState.pendingPoints ?? 0);
  metaState.pendingPoints = 0;

  // 2. Blacklist this save's timestamp
  const ts = state.saveCreatedAt;
  if (ts && !metaState.saveBlacklist.includes(ts)) {
    metaState.saveBlacklist.push(ts);
    if (metaState.saveBlacklist.length > 1000) metaState.saveBlacklist = metaState.saveBlacklist.slice(-500);
  }

  saveMetaState();

  // 3. Stop the game loop and render loop
  if (gameLoopId) { clearInterval(gameLoopId); gameLoopId = null; }
  stopRenderLoop();

  // 4. Show result modal
  const msg = reason === 'death'
    ? `All buildings were destroyed! You earned ${(metaState.totalPoints).toFixed(2)} total meta points.`
    : `World ended! You earned ${(metaState.totalPoints).toFixed(2)} total meta points.`;

  showRunEndModal(msg);
}

function showRunEndModal(msg) {
  document.getElementById('run-end-msg').textContent = msg;
  document.getElementById('run-end-modal').classList.remove('hidden');
}

function closeRunEndModal() {
  document.getElementById('run-end-modal').classList.add('hidden');
  returnToStartScreen();
}

function returnToStartScreen() {
  stopRenderLoop();
  state = null;
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  refreshSaveList();
}

function confirmEndWorld() {
  if (!confirm('End this world? You will receive all pending meta points and this save will be permanently closed.')) return;
  handleRunEnd('prestige');
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
  const customField = document.getElementById('biter-custom-mult-field');
  if (customField) customField.classList.toggle('hidden', !enabled || selectedDifficulty !== 'custom');
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
  // Show Electric tab on drill combo card when research done
  const elecTab = document.getElementById('drill-tab-electric');
  if (elecTab) elecTab.style.display = state.research?.done?.electricMiningDrill ? '' : 'none';
  // Show Mk2/Mk3 tabs on assembler combo card when research done
  const mk2Tab = document.getElementById('asm-tab-assembly2');
  const mk3Tab = document.getElementById('asm-tab-assembly3');
  if (mk2Tab) mk2Tab.style.display = state.research?.done?.automation2 ? '' : 'none';
  if (mk3Tab) mk3Tab.style.display = state.research?.done?.automation3 ? '' : 'none';
}

// ── Place Tab: collapsible sections, combined drill/assembler cards ──────

const _collapsedSections = {};
let _drillTab    = 'miner';
let _assemblyTab = 'assembly';

function toggleBuildSection(id) {
  _collapsedSections[id] = !_collapsedSections[id];
  const body  = document.getElementById('build-section-' + id);
  const arrow = document.getElementById('build-arrow-' + id);
  if (body)  body.style.display  = _collapsedSections[id] ? 'none' : '';
  if (arrow) arrow.textContent   = _collapsedSections[id] ? '▶' : '▼';
}

function setDrillTab(type) {
  _drillTab = type;
  renderDrillCard();
  document.querySelectorAll('.drill-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
}

function setAssemblyTab(type) {
  _assemblyTab = type;
  renderAssemblyCard();
  document.querySelectorAll('.asm-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
}

function renderDrillCard() {
  const el = document.getElementById('drill-card-content');
  if (!el) return;
  const type = _drillTab;
  const stats = type === 'miner'
    ? `<p>Mines at 0.25/sec · requires coal to operate</p><p class="card-cost">Cost: 1 × Burner Mining Drill</p>`
    : `<p>Mines at 0.5/sec · 90 kW · no coal needed</p><p class="card-cost">Cost: 1 × Electric Mining Drill</p>`;
  const ptype = type === 'miner' ? 'miner' : 'electricMiner';
  el.innerHTML = `${stats}
    <div class="recipe-picker-host" data-ptype="${ptype}"></div>
    <div class="place-row">
      <input type="number" class="place-count" min="1" value="1">
      <button class="btn-place" data-type="${type}" onclick="placeBuilding('${type}',this,event)">Place</button>
    </div>`;
  renderAllPlacementPickers();
  updatePlaceButtonStates();
}

function renderAssemblyCard() {
  const el = document.getElementById('asm-card-content');
  if (!el) return;
  // Fall back to highest unlocked type if current tab not researched
  const done = state.research?.done ?? {};
  if (_assemblyTab === 'assembly3' && !done.automation3) _assemblyTab = done.automation2 ? 'assembly2' : 'assembly';
  if (_assemblyTab === 'assembly2' && !done.automation2) _assemblyTab = 'assembly';
  const type = _assemblyTab;
  const statsMap = {
    assembly:  `<p>Auto-crafts intermediate and building items · 75 kW · speed ×0.5</p><p class="card-cost">Cost: 1 × Assembly Machine Mk1</p>`,
    assembly2: `<p>Auto-crafts items · 150 kW · speed ×0.75</p><p class="card-cost">Cost: 1 × Assembly Machine Mk2</p>`,
    assembly3: `<p>Auto-crafts items · 375 kW · speed ×1.25</p><p class="card-cost">Cost: 1 × Assembly Machine Mk3</p>`,
  };
  el.innerHTML = `${statsMap[type]}
    <input class="picker-search" type="text" placeholder="Search recipes…" oninput="onPickerSearch('${type}', this.value)">
    <div class="recipe-picker-host" data-ptype="${type}"></div>
    <div class="place-row">
      <input type="number" class="place-count" min="1" value="1">
      <button class="btn-place" data-type="${type}" onclick="placeBuilding('${type}',this,event)">Place</button>
    </div>`;
  renderAllPlacementPickers();
  updatePlaceButtonStates();
}

// ── Scripting Engine — see script.js ─────────────────────────

// (tokenize, ScriptParser, ScriptEvaluator, buildScriptContext,
//  scriptPlaceBuilding, runScriptOnce, runAutoScript,
//  switchScriptTab, toggleScriptAuto, renderScript)
// All defined in script.js loaded after this file.

// All scripting code is in script.js (loaded after this file).

// ── Screen / Tab Management ───────────────────────────────────

function openNewGameModal()  { document.getElementById('new-game-modal').classList.remove('hidden'); }
function closeNewGameModal() { document.getElementById('new-game-modal').classList.add('hidden'); }

function startNewGame() {
  const biters = document.getElementById('biters-toggle').checked;
  const biterIntervalSecs = parseInt(document.getElementById('wave-interval-select')?.value ?? '120', 10) || 120;
  let biterDifficultyMult = 0.5;  // normal
  if      (selectedDifficulty === 'easy')   biterDifficultyMult = 0.25;
  else if (selectedDifficulty === 'hard')   biterDifficultyMult = 1.0;
  else if (selectedDifficulty === 'custom') biterDifficultyMult = parseFloat(document.getElementById('biter-custom-mult-input')?.value) || 0.5;
  const metaProgEnabled  = document.getElementById('meta-prog-toggle')?.checked ?? true;
  const tutorialEnabled  = document.getElementById('tutorial-toggle')?.checked ?? true;
  state = createState({ density: 'medium', biters, biterIntervalSecs, biterDifficultyMult, metaProgEnabled, tutorialEnabled });
  placeQueue = []; _placeHead = 0; placing = false; currentPlacing = null; biterWaveWarned = false;
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
  startRenderLoop();
  _lastTickTime = Date.now();
  buildingSearchQuery = '';
  mouseHeld          = false;
  biterWaveWarned    = false;
  lastTechHash       = '';
  lastInventoryHtml  = '';
  lastStarredBarHtml = '';
  lastRobotTechHtml  = '';
  lastPerimeterHtml  = '';
  lastWavePreviewHash = '';
  lastMetaHtml       = '';
  _groupsDirty = true; _groupsCache = null; _typeCountsCache = null;
  for (const k in _cardCache) delete _cardCache[k];
  const searchEl = document.getElementById('buildings-search');
  if (searchEl) searchEl.value = '';
  // Tutorial glow pulse: briefly set _tutGlowOn every 5 seconds
  if (_tutGlowIntervalId) clearInterval(_tutGlowIntervalId);
  _tutGlowIntervalId = setInterval(() => {
    _tutGlowOn = true;
    setTimeout(() => { _tutGlowOn = false; }, 1400);
  }, 5000);
  setupEventDelegation();
  // Restore script content from loaded save
  if (_pendingScriptRestore) {
    const manualEl = document.getElementById('script-manual-editor');
    if (manualEl) manualEl.value = _pendingScriptRestore.content ?? '';
    const autoEl = document.getElementById('script-auto-editor');
    if (autoEl) autoEl.value = _pendingScriptRestore.autoContent ?? '';
    if (typeof syncScriptHighlight === 'function') {
      syncScriptHighlight(manualEl, document.getElementById('script-manual-hl'));
      syncScriptHighlight(autoEl,   document.getElementById('script-auto-hl'));
    }
    scriptAutoRun = _pendingScriptRestore.autoRun;
    _pendingScriptRestore = null;
    // Sync the Auto ON/OFF button visual state to match the restored value
    const autoBtn = document.getElementById('script-auto-btn');
    if (autoBtn) {
      autoBtn.textContent = scriptAutoRun ? 'Auto ON' : 'Auto OFF';
      if (scriptAutoRun) { autoBtn.classList.remove('btn-secondary'); autoBtn.classList.add('btn-primary'); }
      else               { autoBtn.classList.remove('btn-primary');   autoBtn.classList.add('btn-secondary'); }
    }
  }
  switchScriptTab(scriptActiveTab);
  renderAllPlacementPickers();
  updatePlacementUI();
  // Resume placement queue if loaded with pending buildings
  if (_placeHead < placeQueue.length && !placing) processNextPlacement();
  updateSaveFilenameDisplay();
  renderUI();
}

function switchTab(tab, el) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  el.classList.add('active');
  if (tab === 'research') document.getElementById('tab-btn-research')?.classList.remove('tab-alert');
  if (tab === 'mining') { initBaseMap(); startBaseMapLoop(); }
  else stopBaseMapLoop();
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
    const pri = e.target.closest('[data-priority]');
    if (pri) { togglePriority(pri.dataset.priority); return; }
    const tog = e.target.closest('[data-toggle]');
    if (tog) { toggleGroup(tog.dataset.toggle); return; }
    const rem = e.target.closest('[data-remove]');
    if (rem) { removeOneFromGroup(rem.dataset.remove); return; }
    const add = e.target.closest('[data-add]');
    if (add) {
      const countEl = add.closest('.building-add-row')?.querySelector('[data-add-count]');
      const count = Math.max(1, parseInt(countEl?.value ?? String(buildingAddCounts[add.dataset.add] ?? 1)) || 1);
      addBuildingFromGroup(add.dataset.add, count, e.altKey);
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
    if (limitInput) setGroupLimit(limitInput.dataset.limit, limitInput.value);
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

  // Script editors — Tab key inserts 4 spaces instead of losing focus
  function handleScriptEditorTab(e) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const ta = e.target;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const spaces = '    '; // 4 spaces
    ta.value = ta.value.substring(0, start) + spaces + ta.value.substring(end);
    ta.selectionStart = ta.selectionEnd = start + spaces.length;
  }
  const manualEditor = document.getElementById('script-manual-editor');
  const autoEditor   = document.getElementById('script-auto-editor');
  if (manualEditor) manualEditor.addEventListener('keydown', handleScriptEditorTab);
  if (autoEditor)   autoEditor.addEventListener('keydown', handleScriptEditorTab);

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

const META_UPGRADEABLE_TYPES = Object.keys(BUILDING_DEFS).filter(k => BUILDING_DEFS[k].upgradeable);
const META_TYPE_NAMES = Object.fromEntries(
  Object.entries(BUILDING_DEFS).map(([k, v]) => [k, v.name])
);

const META_BUILDING_ITEM_KEY = {
  stoneFurnace: 'stoneFurnaceItem', steelFurnace: 'steelFurnaceItem', electricFurnace: 'electricFurnaceItem',
  assembly: 'assemblyMachine1Item', assembly2: 'assemblyMachine2Item', assembly3: 'assemblyMachine3Item',
  lab: 'labItem', boiler: 'boilerItem', radar: 'radarItem',
  pumpjack: 'pumpjackItem', oilRefinery: 'oilRefineryItem', chemicalPlant: 'chemicalPlantItem',
  centrifuge: 'centrifugeItem', nuclearReactor: 'nuclearReactorItem',
};

const META_SKILL_PERKS = [
  // Quick Start
  { id: 'qs_starter_pack',    tree: 'Quick Start', name: 'Starter Pack',         tier: 1, cost: 1, icon: '🪨', effect: '50 coal + 1 burner miner on each starter resource' },
  { id: 'qs_mining_crew',     tree: 'Quick Start', name: 'Mining Crew',          tier: 2, cost: 2, icon: '👷', effect: '5 burner miners on each starter resource' },
  { id: 'qs_iron_age',        tree: 'Quick Start', name: 'Iron Age',             tier: 3, cost: 2, icon: '🔩', effect: '+3 stone furnaces preset to iron plate' },
  { id: 'qs_bronze_age',      tree: 'Quick Start', name: 'Bronze Age',           tier: 4, cost: 2, icon: '🔶', effect: '+3 stone furnaces preset to copper plate' },
  { id: 'qs_power_basic',     tree: 'Quick Start', name: 'Power: Basic',         tier: 3, cost: 3, icon: '⚡', effect: 'Offshore pump + boiler + 2 steam engines pre-built' },
  { id: 'qs_power_lab',       tree: 'Quick Start', name: 'Power: Lab',           tier: 4, cost: 2, icon: '🔬', effect: '+1 lab pre-built' },
  { id: 'qs_power_solar',     tree: 'Quick Start', name: 'Power: Solar',         tier: 5, cost: 4, icon: '☀️', effect: '+5 solar panels and +2 accumulators pre-built' },
  { id: 'qs_assembler_gear',  tree: 'Quick Start', name: 'Auto: Gears',          tier: 4, cost: 3, icon: '⚙️', effect: '+1 assembler preset to iron gears' },
  { id: 'qs_assembler_cable', tree: 'Quick Start', name: 'Auto: Cables',         tier: 5, cost: 2, icon: '🟡', effect: '+1 assembler preset to copper cables' },
  { id: 'qs_red_running',     tree: 'Quick Start', name: 'Red Science Running',  tier: 6, cost: 4, icon: '🔴', effect: '50 red science in inventory at start' },
  { id: 'qs_perimeter',       tree: 'Quick Start', name: 'Defense: Perimeter',   tier: 2, cost: 2, icon: '🧱', effect: 'Stone walls fully built around starting perimeter' },
  { id: 'qs_turrets',         tree: 'Quick Start', name: 'Defense: Turrets',     tier: 3, cost: 3, icon: '🗼', effect: '+4 gun turrets and +100 firearm magazines' },
  { id: 'qs_armed',           tree: 'Quick Start', name: 'Defense: Piercing',    tier: 4, cost: 2, icon: '🎯', effect: '+50 piercing rounds in inventory' },
  // Perks
  { id: 'perk_place_speed',     tree: 'Perks', name: 'Quick Hands',        tier: 1, cost: 2, icon: '🤲', effect: 'Base place time −0.5s' },
  { id: 'perk_logistics_speed', tree: 'Perks', name: 'Logistics Research', tier: 2, cost: 2, icon: '⏩', effect: 'Logistics techs 25% stronger' },
  { id: 'perk_robot_punch',     tree: 'Perks', name: 'Robot Force',        tier: 2, cost: 3, icon: '🤖', effect: 'Construction robots +25% effectiveness' },
  { id: 'perk_robot_swarm',     tree: 'Perks', name: 'Swarm Tactics',      tier: 3, cost: 4, icon: '🦾', effect: 'Construction robots +60% total effectiveness' },
  { id: 'perk_mining_baseline', tree: 'Perks', name: 'Better Picks',       tier: 1, cost: 2, icon: '⛏️', effect: '+10% baseline mining productivity' },
  { id: 'perk_patch_size',      tree: 'Perks', name: 'Generous Veins',     tier: 1, cost: 1, icon: '💎', effect: 'Starting ore patches +25% larger' },
  { id: 'perk_steam_output',    tree: 'Perks', name: 'Pressurized',        tier: 1, cost: 2, icon: '💨', effect: 'Steam engines produce +10% power' },
  { id: 'perk_accumulator_cap', tree: 'Perks', name: 'Charged Cells',      tier: 2, cost: 2, icon: '🔋', effect: 'Accumulators store +25% energy' },
  { id: 'perk_nuclear_extension', tree: 'Perks', name: 'Spent Fuel Reuse', tier: 3, cost: 3, icon: '☢️', effect: 'Uranium fuel cells last +25% longer' },
  { id: 'perk_wall_hp',         tree: 'Perks', name: 'Reinforced Walls',   tier: 1, cost: 2, icon: '🧱', effect: 'Stone walls +50% HP' },
  { id: 'perk_gun_baseline',    tree: 'Perks', name: 'Sharper Rounds',     tier: 1, cost: 2, icon: '🔫', effect: 'Gun turret damage +10% baseline' },
  { id: 'perk_grace',           tree: 'Perks', name: 'Slow Wakening',      tier: 1, cost: 1, icon: '🕐', effect: 'Biter grace period +60s (stackable ×3)' },
  { id: 'perk_lab_speed_1',     tree: 'Perks', name: 'Faster Labs I',      tier: 1, cost: 2, icon: '🧪', effect: 'Labs research +15% faster' },
  { id: 'perk_lab_speed_2',     tree: 'Perks', name: 'Faster Labs II',     tier: 2, cost: 3, icon: '⚗️', effect: 'Labs research +25% faster total' },
  { id: 'perk_pack_efficiency', tree: 'Perks', name: 'Pack Efficiency',    tier: 2, cost: 3, icon: '📦', effect: 'Science pack crafts +10% productivity' },
  { id: 'perk_radar_speed',     tree: 'Perks', name: 'Sweep Radar',        tier: 1, cost: 1, icon: '📡', effect: 'Radar reveals chunks +50% faster' },
  // Scaling
  { id: 'scl_robot_speed_exp_1', tree: 'Scaling', name: 'Robot Speed Research I',   tier: 1, cost: 5,  icon: '🤖', effect: 'Robot speed cost base 2.0 → 1.95 per level' },
  { id: 'scl_robot_speed_exp_2', tree: 'Scaling', name: 'Robot Speed Research II',  tier: 2, cost: 8,  icon: '🤖', effect: 'Robot speed cost base 1.95 → 1.90' },
  { id: 'scl_robot_speed_mag_1', tree: 'Scaling', name: 'Robot Speed Magnitude I',  tier: 1, cost: 4,  icon: '🏎️', effect: 'Speed bonus per level +5%' },
  { id: 'scl_robot_speed_mag_2', tree: 'Scaling', name: 'Robot Speed Magnitude II', tier: 2, cost: 6,  icon: '🏎️', effect: 'Speed bonus per level +10% cumulative' },
  { id: 'scl_mining_exp_1',      tree: 'Scaling', name: 'Mining Prod Research I',   tier: 1, cost: 5,  icon: '⛏️', effect: 'Mining productivity cost base reduced to 1.95' },
  { id: 'scl_mining_mag_1',      tree: 'Scaling', name: 'Mining Prod Magnitude I',  tier: 1, cost: 4,  icon: '💎', effect: '+12% prod per level instead of +10%' },
  { id: 'scl_gun_exp_1',         tree: 'Scaling', name: 'Gun Damage Research I',    tier: 1, cost: 5,  icon: '🔫', effect: 'Gun damage cost base 2.0 → 1.95' },
  { id: 'scl_gun_mag_1',         tree: 'Scaling', name: 'Gun Damage Magnitude I',   tier: 1, cost: 4,  icon: '💥', effect: '+5% extra damage per level beyond lvl 6' },
  { id: 'scl_laser_exp_1',       tree: 'Scaling', name: 'Laser Damage Research I',  tier: 1, cost: 5,  icon: '⚡', effect: 'Laser damage cost base 2.0 → 1.95' },
  { id: 'scl_laser_mag_1',       tree: 'Scaling', name: 'Laser Damage Magnitude I', tier: 1, cost: 4,  icon: '🌟', effect: '+10 effective damage per level' },
  { id: 'scl_artillery_exp_1',   tree: 'Scaling', name: 'Artillery Research I',     tier: 1, cost: 5,  icon: '💣', effect: 'Artillery cost bases reduced 0.05' },
  { id: 'scl_artillery_mag_1',   tree: 'Scaling', name: 'Artillery Magnitude I',    tier: 1, cost: 4,  icon: '💥', effect: '+5% artillery damage per level' },
  { id: 'scl_universal',         tree: 'Scaling', name: 'Universal Scaling',        tier: 3, cost: 20, icon: '🌐', effect: 'ALL infinite tech bases reduced by extra 0.05' },
  // Scripting
  { id: 'script_unlock',      tree: 'Scripting', name: 'Script Access',      tier: 1, cost: 1,  icon: '📜', effect: 'Unlocks the Script Editor tab' },
  { id: 'script_conditions',  tree: 'Scripting', name: 'Conditions',         tier: 2, cost: 3,  icon: '🔀', effect: 'Enables if/elif/else, ==, !=, <, >, and/or/not' },
  { id: 'script_loops',       tree: 'Scripting', name: 'Loops',              tier: 3, cost: 4,  icon: '🔄', effect: 'Enables while, for, range()' },
  { id: 'script_variables',   tree: 'Scripting', name: 'Variables',          tier: 2, cost: 2,  icon: '📝', effect: 'Enables in-script assignment (x = 5, etc.)' },
  { id: 'script_memory',      tree: 'Scripting', name: 'Persistent Memory',  tier: 3, cost: 4,  icon: '💾', effect: 'MEM_* variables persist across runs' },
  { id: 'script_arithmetic',  tree: 'Scripting', name: 'Arithmetic',         tier: 2, cost: 2,  icon: '➕', effect: 'Enables +, −, *, /, %, **' },
  { id: 'script_math_basic',  tree: 'Scripting', name: 'Math Builtins',      tier: 3, cost: 2,  icon: '🧮', effect: 'Enables floor, ceil, round, min, max, abs' },
  { id: 'script_auto_tab',    tree: 'Scripting', name: 'Auto-Run Tab',       tier: 3, cost: 5,  icon: '⏰', effect: 'Unlocks auto-run tab (script runs every 10s)' },
  { id: 'script_auto_5s',     tree: 'Scripting', name: 'Faster Auto (5s)',   tier: 4, cost: 3,  icon: '⚡', effect: 'Auto-run interval 10s → 5s' },
  { id: 'script_auto_1s',     tree: 'Scripting', name: 'Real-Time Auto',     tier: 5, cost: 5,  icon: '🚀', effect: 'Auto-run interval 5s → 1s' },
  { id: 'script_calculator',  tree: 'Scripting', name: 'Recipe Calculator',  tier: 5, cost: 10, icon: '🧮', effect: 'Unlocks Recipe Calculator tab' },
];

function buySkillPerk(id) {
  const perk = META_SKILL_PERKS.find(p => p.id === id);
  if (!perk) return;
  if ((metaState.totalPoints ?? 0) < perk.cost) return;
  if (metaState.skillPerks?.[id]) return;
  metaState.totalPoints = (metaState.totalPoints ?? 0) - perk.cost;
  if (!metaState.skillPerks) metaState.skillPerks = {};
  metaState.skillPerks[id] = true;
  saveMetaState();
  lastMetaHtml = '';
  renderMetaProgression('meta-screen-content');
}

function showMetaScreen() {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('meta-screen').classList.remove('hidden');
  lastMetaHtml = '';
  renderMetaProgression('meta-screen-content');
}

function showStartScreen() {
  document.getElementById('meta-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
}

function confirmResetMeta() {
  if (!confirm('Reset ALL meta progress? This will clear your points, building upgrades, and skill perks. This cannot be undone.')) return;
  metaState = defaultMetaState();
  saveMetaState();
  lastMetaHtml = '';
  renderMetaProgression('meta-screen-content');
  notify('Meta progress reset.', 'info');
}

function setMetaSubTab(tab, containerId = 'meta-screen-content') {
  metaSubTab = tab;
  lastMetaHtml = '';
  renderMetaProgression(containerId);
}

function metaUpgradeCost(currentLevel) {
  return currentLevel === 0 ? 2 : 5;
}

function buyMetaBuildingUpgrade(type) {
  const level = metaState.buildingUpgrades?.[type] ?? 0;
  if (level >= 2) return;
  const cost = level === 0 ? 2 : 5;
  if ((metaState.totalPoints ?? 0) < cost) { notify('Not enough meta points.', 'warning'); return; }
  metaState.totalPoints -= cost;
  if (!metaState.buildingUpgrades) metaState.buildingUpgrades = {};
  metaState.buildingUpgrades[type] = level + 1;
  saveMetaState();
  lastMetaHtml = '';
  renderMetaProgression('meta-screen-content');
}

function buyMetaPerk(perkKey) {
  if (metaState.perks?.[perkKey]) return;
  const cost = 10;
  if ((metaState.totalPoints ?? 0) < cost) { notify('Not enough meta points.', 'warning'); return; }
  metaState.totalPoints -= cost;
  if (!metaState.perks) metaState.perks = {};
  metaState.perks[perkKey] = true;
  saveMetaState();
  lastMetaHtml = '';
}

function investGamerModule(type) {
  // Accept both 'speed'/'prod' and 'speedPoints'/'prodPoints' for compatibility
  const fieldMap = { speed: 'speedPoints', prod: 'prodPoints', speedPoints: 'speedPoints', prodPoints: 'prodPoints' };
  const costMap  = { speedPoints: 3, prodPoints: 5 };
  const field = fieldMap[type];
  if (!field) return;
  const cost = costMap[field];
  if ((metaState.totalPoints ?? 0) < cost) { notify('Not enough meta points.', 'warning'); return; }
  metaState.totalPoints -= cost;
  if (!metaState.gamerModule) metaState.gamerModule = { speedPoints: 0, prodPoints: 0 };
  metaState.gamerModule[field] = (metaState.gamerModule[field] ?? 0) + 1;
  saveMetaState();
  lastMetaHtml = '';
}

function renderMetaProgression(containerId = 'meta-screen-content') {
  const el = document.getElementById(containerId);
  if (!el) return;

  const spendable = metaState.totalPoints ?? 0;
  const pending   = metaState.pendingPoints ?? 0;
  const inGame    = !!state;

  const tabs = [
    { key: 'buildings', label: '🏭 Buildings' },
    { key: 'skills',    label: '🌟 Perks' },
  ];

  let content = '';

  if (metaSubTab === 'buildings') {
    const rows = META_UPGRADEABLE_TYPES.map(type => {
      const level = metaState.buildingUpgrades?.[type] ?? 0;
      const maxed = level >= 2;
      const cost  = level === 0 ? 2 : 5;
      const canAffordUpg = spendable >= cost && !maxed;
      const name  = META_TYPE_NAMES[type] ?? type;
      const effect = level > 0 ? `+${level * 25}% speed · −${level * 25}% energy` : 'No bonus yet';
      const imgKey = META_BUILDING_ITEM_KEY[type];
      const imgHtml = imgKey ? `<span class="meta-building-img">${itemIcon(imgKey)}</span>` : '';
      return `<div class="meta-building-row">
        ${imgHtml}
        <div class="meta-building-info">
          <strong>${name}</strong>
          <span>${maxed ? '✅ Max' : `Lv ${level}/2 · ${effect}`}</span>
        </div>
        ${!maxed ? `<button class="btn-sm${canAffordUpg ? '' : ' cant-afford'}" onclick="buyMetaBuildingUpgrade('${type}')">${cost} pts</button>` : ''}
      </div>`;
    }).join('');
    content = `<div class="meta-section">
      <div class="meta-section-title">🏭 Building Upgrades</div>
      <p class="meta-bldg-desc">Each building can be upgraded twice. Level 1 costs 2 pts, Level 2 costs 5 pts. Each upgrade adds <strong>+25% speed</strong> and reduces <strong>−25% energy use</strong> for that building type.</p>
      ${rows}
    </div>`;

  } else if (metaSubTab === 'skills') {
    const trees = ['Quick Start', 'Perks', 'Scaling', 'Scripting'];
    const treeHtml = trees.map(treeName => {
      const perks = META_SKILL_PERKS.filter(p => p.tree === treeName);
      const maxTier = Math.max(...perks.map(p => p.tier));
      // render tiers from T1 (top) down to highest tier (bottom)
      const tierRows = [];
      for (let t = 1; t <= maxTier; t++) {
        const tierPerks = perks.filter(p => p.tier === t);
        if (!tierPerks.length) continue;
        const cards = tierPerks.map(perk => {
          const owned = !!metaState.skillPerks?.[perk.id];
          const isDemo = perk.tier > 1;
          const canBuy = !owned && !isDemo && spendable >= perk.cost;
          const tooltip = `${perk.name}\n${perk.effect}\nCost: ${perk.cost} pt${perk.cost !== 1 ? 's' : ''}${owned ? '\n✅ Owned' : isDemo ? '\n🔒 Not available in demo' : canBuy ? '' : `\nNeed ${perk.cost - Math.floor(spendable)} more pts`}`;
          const icon = perk.icon ?? '⭐';
          let cls = 'perk-icon-btn';
          if (owned) cls += ' perk-icon-owned';
          else if (isDemo) cls += ' perk-icon-demo';
          else if (canBuy) cls += ' perk-icon-available';
          else cls += ' perk-icon-locked';
          const clickAttr = canBuy ? `onclick="buySkillPerk('${perk.id}')"` : '';
          return `<div class="${cls}" title="${tooltip.replace(/"/g, '&quot;')}" ${clickAttr}>${icon}</div>`;
        }).join('');
        tierRows.push(`<div class="perk-tier-row"><span class="perk-tier-label">T${t}</span><div class="perk-tier-icons">${cards}</div></div>`);
      }
      return `<div class="perk-tree-section">
        <div class="perk-tree-header">${treeName}</div>
        ${tierRows.join('')}
      </div>`;
    }).join('');
    content = `<div class="perk-trees">${treeHtml}</div>`;
  }

  const html = `
    <div class="meta-points-bar">
      <span>⭐ <strong>${spendable.toFixed(0)}</strong> pts available</span>
      ${inGame ? `<span style="color:var(--dim); font-size:.85rem">· ${pending.toFixed(2)} pending this run</span>` : ''}
    </div>
    <div class="meta-tab-row">
      ${tabs.map(t => `<button class="btn-sm${metaSubTab === t.key ? ' btn-primary' : ''}" onclick="setMetaSubTab('${t.key}')">${t.label}</button>`).join('')}
    </div>
    <div class="meta-content">${content}</div>
  `;

  if (html === lastMetaHtml) return;
  lastMetaHtml = html;
  el.innerHTML = html;

  const ewEl = document.getElementById('end-world-points');
  if (ewEl) ewEl.textContent = pending > 0 ? `+${pending.toFixed(2)} pts on end` : '';
}

// ── Base Map Canvas ───────────────────────────────────────────────────────────

const MAP_GRID      = 15;  // tile columns and rows
const WALL_RING     = 1;   // tile ring index from each edge where walls are drawn
const MAP_INNER_MIN = 3;   // inner zone col/row lower bound (inclusive)
const MAP_INNER_MAX = 11;  // inner zone col/row upper bound (inclusive)
const BUILDING_MAP_MILESTONES = [10, 100, 1000, 10000];

const BUILDING_MAP_CATEGORIES = {
  furnace: {
    label: 'Furnace',
    types: ['furnace', 'steelFurnace', 'electricFurnace'],
    getRecipes: () => Object.entries(FURNACE_RECIPES).map(([k, r]) => ({ key: k, ...r })),
    color: '#7a3a1a',
    slotImgs: [
      'data/icon_imgs/stone_furnace.png',
      'data/icon_imgs/steel_furnace.png',
      'data/icon_imgs/electric_furnace.png',
      'data/icon_imgs/electric_furnace.png',
    ],
    defaults: [{ col: 3, row: 6 }, { col: 3, row: 7 }, { col: 3, row: 8 }, { col: 3, row: 9 }],
  },
  assembly: {
    label: 'Assembler',
    types: ['assembly', 'assembly2', 'assembly3'],
    getRecipes: () => Object.entries(PLAYER_RECIPES).filter(([, r]) => !r.machinery || r.machinery === 'assembly').map(([k, r]) => ({ key: k, ...r })),
    color: '#2a4a6a',
    slotImgs: [
      'data/icon_imgs/assembler_machine_1.png',
      'data/icon_imgs/assembler_machine_2.png',
      'data/icon_imgs/assembler_machine_3.png',
      'data/icon_imgs/assembler_machine_3.png',
    ],
    defaults: [{ col: 4, row: 8 }, { col: 4, row: 9 }, { col: 5, row: 9 }, { col: 5, row: 8 }],
  },
  chemPlant: {
    label: 'Chem Plant',
    types: ['chemicalPlant'],
    getRecipes: () => Object.entries(PLAYER_RECIPES).filter(([, r]) => r.machinery === 'chemical').map(([k, r]) => ({ key: k, ...r })),
    color: '#2a6a3a',
    slotImgs: Array(4).fill('data/icon_imgs/chem_plant.jpg'),
    defaults: [{ col: 8, row: 8 }, { col: 9, row: 8 }, { col: 8, row: 9 }, { col: 9, row: 9 }],
  },
  oilRefinery: {
    label: 'Oil Refinery',
    types: ['oilRefinery'],
    getRecipes: () => Object.entries(PLAYER_RECIPES).filter(([, r]) => r.machinery === 'refinery').map(([k, r]) => ({ key: k, ...r })),
    color: '#5a4a1a',
    slotImgs: Array(4).fill(null),
    defaults: [{ col: 10, row: 7 }, { col: 11, row: 7 }, { col: 10, row: 8 }, { col: 11, row: 8 }],
  },
  centrifuge: {
    label: 'Centrifuge',
    types: ['centrifuge'],
    getRecipes: () => Object.entries(PLAYER_RECIPES).filter(([, r]) => r.machinery === 'centrifuge').map(([k, r]) => ({ key: k, ...r })),
    color: '#1a3a6a',
    slotImgs: Array(4).fill('data/icon_imgs/Centrifuge.jpg'),
    defaults: [{ col: 10, row: 5 }, { col: 11, row: 5 }, { col: 10, row: 6 }, { col: 11, row: 6 }],
  },
  rocketSilo: {
    label: 'Rocket Silo',
    types: ['rocketSilo'],
    getRecipes: () => Object.entries(PLAYER_RECIPES).filter(([, r]) => r.machinery === 'rocket_silo').map(([k, r]) => ({ key: k, ...r })),
    color: '#4a1a6a',
    slotImgs: Array(4).fill('data/icon_imgs/rocket_silo.jpg'),
    defaults: [{ col: 6, row: 11 }, { col: 7, row: 11 }, { col: 8, row: 11 }, { col: 9, row: 11 }],
  },
  hub: {
    label: '🏗️ Construction Hub',
    types: [],
    isHub: true,
    color: '#3a5a3a',
    slotImgs: ['data/icon_imgs/construction_robot.png'],
    defaults: [{ col: 3, row: 4 }],
    getSlotCount: () => (state?.research?.done?.logistics ? 1 : 0),
    getRecipes: () => [],
  },
};

const CONCRETE_TILES = [
  { key: 'gray',   label: 'Gray',   src: 'data/map_imgs/concrete_tile.png' },
  { key: 'red',    label: 'Red',    src: 'data/map_imgs/concrete_tile_red.png' },
  { key: 'green',  label: 'Green',  src: 'data/map_imgs/concrete_tile_green.png' },
  { key: 'black',  label: 'Black',  src: 'data/map_imgs/concrete_tile_black.png' },
  { key: 'white',  label: 'White',  src: 'data/map_imgs/concrete_tile_white.png' },
  { key: 'blue',   label: 'Blue',   src: 'data/map_imgs/concrete_tile_blue.png' },
  { key: 'pink',   label: 'Pink',   src: 'data/map_imgs/concrete_tile_pink.png' },
  { key: 'teal',   label: 'Teal',   src: 'data/map_imgs/concrete_tile_teal.png' },
  { key: 'orange', label: 'Orange', src: 'data/map_imgs/concrete_tile_cropped_orange.png' },
  { key: 'yellow', label: 'Yellow', src: 'data/map_imgs/concrete_tile_cropped_yellow.png' },
  { key: 'purple', label: 'Purple', src: 'data/map_imgs/concrete_tile_cropped_purple.png' },
];

// Tile positions of each ore patch on the 15×15 grid (col, row, 0-indexed)
const ORE_PATCH_TILES = {
  ironOre:    { col: 5,  row: 5  },
  copperOre:  { col: 7,  row: 4  },
  coal:       { col: 6,  row: 7  },
  stone:      { col: 7,  row: 5  },
  crudeOil:   { col: 11, row: 4  },
  uraniumOre: { col: 9,  row: 10 },
};

let _grassImg       = null;
let _wallImgs       = {};
let _turretImgs     = {};
let _mapAnimFrame   = null;
let _dragState      = null;   // null | {slotKey, catKey, slotIdx}
let _mouseCanvasPos = { x: 0, y: 0 };
let _clickTimer     = null;
let _bldImgs           = {};     // preloaded building images keyed by src path
let _bldPopupCat       = null;
let _bldPopupRecipeIdx = 0;
let _concreteImgs      = {};     // preloaded concrete tile images keyed by key
let _tilePicker        = null;   // {col, row, selectedKey} — current picker state

function initBaseMap() {
  const canvas = document.getElementById('base-map');
  if (!canvas) return;
  const size = canvas.offsetWidth;
  if (size === 0) return;
  canvas.width  = size;
  canvas.height = size;
}

function startBaseMapLoop() {
  if (_mapAnimFrame) return;
  function loop(ts) {
    const tab = document.getElementById('tab-mining');
    if (!tab || tab.classList.contains('hidden')) { _mapAnimFrame = null; return; }
    renderBaseMap(ts);
    _mapAnimFrame = requestAnimationFrame(loop);
  }
  _mapAnimFrame = requestAnimationFrame(loop);
}

function stopBaseMapLoop() {
  if (_mapAnimFrame) { cancelAnimationFrame(_mapAnimFrame); _mapAnimFrame = null; }
}

function renderBaseMap(ts) {
  const canvas = document.getElementById('base-map');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  if (S === 0) return;

  _drawBackgroundLayer(ctx, S);
  _drawTileBgLayer(ctx, S);
  _drawBuildingsLayer(ctx, S, ts);
  _drawEffectsLayer(ctx, S, ts);
}

function _drawBackgroundLayer(ctx, S) {
  if (_grassImg?.complete && _grassImg.naturalWidth > 0) {
    ctx.drawImage(_grassImg, 0, 0, S, S);
  } else {
    ctx.fillStyle = '#2d5a1b';
    ctx.fillRect(0, 0, S, S);
  }
}

function _drawTileBgLayer(ctx, S) {
  if (!state?.tileBg) return;
  const tileSize = S / MAP_GRID;
  for (const [key, tileKey] of Object.entries(state.tileBg)) {
    const img = _concreteImgs[tileKey];
    if (!img?.complete || img.naturalWidth === 0) continue;
    const [col, row] = key.split(',').map(Number);
    ctx.drawImage(img, col * tileSize, row * tileSize, tileSize, tileSize);
  }
}

function _drawBuildingsLayer(ctx, S, ts) {
  _drawWalls(ctx, S);
  _drawTurrets(ctx, S);
  _drawOrePatchIndicators(ctx, S);
  _drawBuildingIcons(ctx, S);
}

function _seededRand(seed) {
  let s = seed | 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 | 0;
    return (s >>> 0) / 0x100000000;
  };
}

function _drawAttackOverlay(ctx, S) {
  if (!state?.biterActivated) return;
  const tileSize = S / MAP_GRID;

  const outerTiles = [];
  for (let c = 0; c < MAP_GRID; c++) {
    outerTiles.push({col: c, row: 0});
    outerTiles.push({col: c, row: MAP_GRID - 1});
  }
  for (let r = 1; r < MAP_GRID - 1; r++) {
    outerTiles.push({col: 0, row: r});
    outerTiles.push({col: MAP_GRID - 1, row: r});
  }

  const numSections   = perimeterTiles();
  const rainbowActive = hasRainbowScience();
  const sciTier       = getPlayerScienceTier();
  let sectionsAttacked;
  if (rainbowActive) {
    sectionsAttacked = numSections;
  } else {
    const pct = sciTier <= 1 ? 0.05 : sciTier === 2 ? 0.10 : 0.15;
    sectionsAttacked = Math.max(1, Math.round(numSections * pct));
  }
  const pctAttacked     = sectionsAttacked / numSections;
  const numGridsColored = Math.max(1, Math.floor(56 * pctAttacked));

  const base          = getBiterWaveStats();
  const bitersPerSec  = base.count / Math.max(1, sectionsAttacked);
  const pixelsPerTile = Math.max(1, Math.floor(bitersPerSec / 5));
  const pixSize       = Math.max(1, Math.round(tileSize / 10));

  const attackColor = rainbowActive ? null :
                      sciTier <= 1 ? 'rgba(255,60,60,0.9)' :
                      sciTier === 2 ? 'rgba(60,220,60,0.9)' :
                      sciTier === 3 ? 'rgba(60,120,255,0.9)' :
                      sciTier === 4 ? 'rgba(180,60,220,0.9)' :
                      'rgba(220,180,40,0.9)';  // tier 5: yellow science

  const rng      = _seededRand(state.biterWaveNumber ?? 0);
  const shuffled = [...outerTiles];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const attackedTiles = shuffled.slice(0, numGridsColored);

  ctx.save();
  for (const {col, row} of attackedTiles) {
    const x0 = col * tileSize;
    const y0 = row * tileSize;
    for (let i = 0; i < pixelsPerTile; i++) {
      const px = x0 + rng() * tileSize;
      const py = y0 + rng() * tileSize;
      ctx.fillStyle = rainbowActive
        ? `hsla(${Math.floor(rng() * 360)},100%,60%,0.9)`
        : attackColor;
      ctx.fillRect(px, py, pixSize, pixSize);
    }
  }
  ctx.restore();
}

function _drawEffectsLayer(ctx, S, ts) {
  _drawAttackOverlay(ctx, S);
}

function _drawOrePatchIndicators(ctx, S) {
  // Map image already shows ore locations; no overlay drawn
}

// ── Building icon helpers ─────────────────────────────────────────────────────

function _totalOfCategory(catKey) {
  const cat = BUILDING_MAP_CATEGORIES[catKey];
  if (!cat || !state?.buildings) return 0;
  return Object.values(state.buildings)
    .filter(g => cat.types.includes(g.type))
    .reduce((sum, g) => sum + (g.count ?? 0), 0);
}

function _slotCount(catKey) {
  const cat = BUILDING_MAP_CATEGORIES[catKey];
  if (cat?.getSlotCount) return cat.getSlotCount();
  const n = _totalOfCategory(catKey);
  for (let i = BUILDING_MAP_MILESTONES.length - 1; i >= 0; i--)
    if (n >= BUILDING_MAP_MILESTONES[i]) return i + 1;
  return 0;
}

function _getOrAutoplaceTile(catKey, slotIdx) {
  const stateKey = `${catKey}_${slotIdx}`;
  if (state?.mapTiles?.[stateKey]) return state.mapTiles[stateKey];
  const def = BUILDING_MAP_CATEGORIES[catKey]?.defaults?.[slotIdx];
  if (def && state?.mapTiles) { state.mapTiles[stateKey] = { ...def }; return state.mapTiles[stateKey]; }
  return null;
}

function _isInnerTile(col, row) {
  return col >= MAP_INNER_MIN && col <= MAP_INNER_MAX
      && row >= MAP_INNER_MIN && row <= MAP_INNER_MAX;
}

function _isOreTile(col, row) {
  return Object.values(ORE_PATCH_TILES).some(p => p.col === col && p.row === row);
}

function _getBuildingAtTile(col, row) {
  for (const catKey of Object.keys(BUILDING_MAP_CATEGORIES)) {
    const count = _slotCount(catKey);
    for (let i = 0; i < count; i++) {
      const pos = state?.mapTiles?.[`${catKey}_${i}`];
      if (pos && pos.col === col && pos.row === row) return { catKey, slotIdx: i };
    }
  }
  return null;
}

function _drawBuildingIcons(ctx, S) {
  if (!state) return;
  const tileSize = S / MAP_GRID;
  const dragKey  = _dragState?.slotKey;

  for (const [catKey, cat] of Object.entries(BUILDING_MAP_CATEGORIES)) {
    const count = _slotCount(catKey);
    for (let i = 0; i < count; i++) {
      const slotKey = `${catKey}_${i}`;
      const pos = _getOrAutoplaceTile(catKey, i);
      if (!pos) continue;
      const px = pos.col * tileSize;
      const py = pos.row * tileSize;

      if (slotKey === dragKey) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(px, py, tileSize, tileSize);
      } else {
        _drawBuildingTile(ctx, cat, i, px, py, tileSize);
      }
    }
  }

  if (_dragState) {
    const cat = BUILDING_MAP_CATEGORIES[_dragState.catKey];
    if (cat) _drawBuildingTile(ctx, cat, _dragState.slotIdx, _mouseCanvasPos.x - tileSize / 2, _mouseCanvasPos.y - tileSize / 2, tileSize);
  }
}

function _drawBuildingTile(ctx, cat, slotIdx, px, py, tileSize) {
  const pad = 2;
  ctx.fillStyle = cat.color;
  ctx.beginPath();
  ctx.roundRect(px + pad, py + pad, tileSize - pad * 2, tileSize - pad * 2, tileSize * 0.12);
  ctx.fill();
  const src = cat.slotImgs[slotIdx];
  const img = src ? _bldImgs[src] : null;
  if (img?.complete && img.naturalWidth > 0) {
    const ip = tileSize * 0.08;
    ctx.drawImage(img, px + ip, py + ip, tileSize - ip * 2, tileSize - ip * 2);
  } else if (!src) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `bold ${Math.round(tileSize * 0.2)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cat.label, px + tileSize / 2, py + tileSize / 2);
  }
}

function _mapClickToOre(canvasX, canvasY, S) {
  const tileSize = S / MAP_GRID;
  const hitR = tileSize * 0.7; // click radius in pixels
  for (const [key, pos] of Object.entries(ORE_PATCH_TILES)) {
    const patch = state?.patches?.[key];
    if (!patch) continue;
    const cx = (pos.col + 0.5) * tileSize;
    const cy = (pos.row + 0.5) * tileSize;
    const dx = canvasX - cx, dy = canvasY - cy;
    if (dx * dx + dy * dy <= hitR * hitR) return key;
  }
  return null;
}

function _canvasCoords(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    cx: (e.clientX - rect.left) * (canvas.width  / rect.width),
    cy: (e.clientY - rect.top)  * (canvas.height / rect.height),
  };
}

function _handleMapMouseMove(e) {
  const canvas = document.getElementById('base-map');
  if (!canvas) return;
  const { cx, cy } = _canvasCoords(e, canvas);
  _mouseCanvasPos.x = cx;
  _mouseCanvasPos.y = cy;
  if (_dragState) { canvas.style.cursor = 'grabbing'; return; }
  const tileSize = canvas.width / MAP_GRID;
  const col = Math.floor(cx / tileSize);
  const row = Math.floor(cy / tileSize);
  canvas.style.cursor = _getBuildingAtTile(col, row) ? 'grab' : 'default';
}

function _handleMapDblClick(e) {
  clearTimeout(_clickTimer);
  _clickTimer = null;
  const canvas = document.getElementById('base-map');
  if (!canvas) return;
  const { cx, cy } = _canvasCoords(e, canvas);
  const tileSize = canvas.width / MAP_GRID;
  const col = Math.floor(cx / tileSize);
  const row = Math.floor(cy / tileSize);
  if (!_isInnerTile(col, row) || _isOreTile(col, row)) return;
  const hit = _getBuildingAtTile(col, row);
  if (hit) {
    _dragState = { slotKey: `${hit.catKey}_${hit.slotIdx}`, catKey: hit.catKey, slotIdx: hit.slotIdx };
    e.stopPropagation();
  }
}

function _handleMapClick(e) {
  const canvas = document.getElementById('base-map');
  if (!canvas) return;
  const { cx, cy } = _canvasCoords(e, canvas);

  if (_dragState) {
    const tileSize = canvas.width / MAP_GRID;
    const col = Math.floor(cx / tileSize);
    const row = Math.floor(cy / tileSize);
    if (_isInnerTile(col, row) && !_isOreTile(col, row)) {
      const existing = _getBuildingAtTile(col, row);
      if (existing) {
        const oldPos = { ...state.mapTiles[_dragState.slotKey] };
        state.mapTiles[`${existing.catKey}_${existing.slotIdx}`] = oldPos;
      }
      state.mapTiles[_dragState.slotKey] = { col, row };
    }
    _dragState = null;
    canvas.style.cursor = 'default';
    e.stopPropagation();
    return;
  }

  clearTimeout(_clickTimer);
  _clickTimer = setTimeout(() => {
    _clickTimer = null;
    const tileSize = canvas.width / MAP_GRID;
    const col = Math.floor(cx / tileSize);
    const row = Math.floor(cy / tileSize);
    const oreKey = _mapClickToOre(cx, cy, canvas.width);
    if (oreKey) { openOrePatchPopup(oreKey); return; }
    const hit = _getBuildingAtTile(col, row);
    if (hit) { openBuildingPopup(hit.catKey); return; }
    openTileBgPicker(col, row, cx, cy, canvas);
  }, 220);
}

function openOrePatchPopup(key) {
  const patch   = state?.patches?.[key];
  const info    = PATCHES[key] ?? { name: key, icon: '🪨' };
  const pos     = ORE_PATCH_TILES[key];
  const popup   = document.getElementById('ore-patch-popup');
  if (!popup || !patch) return;

  const consumed   = state.patchConsumed?.[key] ?? 0;
  const produced   = state.itemsProduced?.[key]  ?? 0;
  const manifested = Math.max(0, produced - consumed);
  const cooling    = !!miningCooldowns[key];
  const inPerim    = patchInPerimeter(key);
  const depleted   = patch.remaining <= 0;
  const canMine    = !depleted && !cooling && inPerim;

  popup.dataset.oreKey = key;
  popup.querySelector('.ore-popup-title').textContent = `${info.icon} ${info.name}`;
  popup.querySelector('.ore-popup-remaining').textContent = fmtNum(Math.floor(patch.remaining));
  popup.querySelector('.ore-popup-mined').textContent    = fmtNum(Math.floor(consumed));
  popup.querySelector('.ore-popup-manifest').textContent = fmtNum(Math.round(manifested));

  const btn = popup.querySelector('.ore-popup-mine-btn');
  btn.disabled = !canMine;
  btn.textContent = !inPerim ? 'Outside perimeter' : depleted ? 'Depleted' : cooling ? 'Mining…' : 'Mine';

  // Position relative to the ore tile within the canvas wrapper
  if (pos) {
    const canvas = document.getElementById('base-map');
    const wrap   = document.getElementById('base-map-wrap');
    if (canvas && wrap) {
      const tileSize = canvas.offsetWidth / MAP_GRID;
      let left = (pos.col + 1) * tileSize;  // one tile right of center
      let top  = (pos.row + 0.5) * tileSize - 20;
      // Clamp so popup stays inside the wrapper
      const maxLeft = wrap.offsetWidth - popup.offsetWidth - 4;
      if (left > maxLeft) left = (pos.col - 0.5) * tileSize - (popup.offsetWidth || 220);
      popup.style.left = left + 'px';
      popup.style.top  = Math.max(0, top) + 'px';
    }
  }

  popup.classList.remove('hidden');
}

function closeOrePatchPopup() {
  const popup = document.getElementById('ore-patch-popup');
  if (popup) popup.classList.add('hidden');
}

// ── Building popup ────────────────────────────────────────────────────────────

let _hubViewMode = 'aggregate'; // 'aggregate' | 'full'
let _hubPopupWired = false;

function openBuildingPopup(catKey) {
  _bldPopupCat = catKey;
  _bldPopupRecipeIdx = 0;
  if (BUILDING_MAP_CATEGORIES[catKey]?.isHub) { _refreshHubPopup(); return; }
  _refreshBuildingPopup();
}

function _queueItemLabel(item) {
  const BLDG_NAMES = {
    miner: 'Burner Drill', electricMiner: 'Electric Drill',
    furnace: 'Furnace', steelFurnace: 'Steel Furnace', electricFurnace: 'Electric Furnace',
    assembly: 'Assembler Mk1', assembly2: 'Assembler Mk2', assembly3: 'Assembler Mk3',
    chemicalPlant: 'Chem Plant', oilRefinery: 'Oil Refinery',
    centrifuge: 'Centrifuge', rocketSilo: 'Rocket Silo',
    lab: 'Lab', radar: 'Radar',
    boiler: 'Boiler', steamEngine: 'Steam Engine', offshore: 'Offshore Pump',
    solar: 'Solar Panel', accumulator: 'Accumulator',
    nuclearReactor: 'Nuclear Reactor', heatExchanger: 'Heat Exchanger', steamTurbine: 'Steam Turbine',
  };
  const typeName = BLDG_NAMES[item.type] ?? item.type;
  const recipeObj = item.recipe
    ? (PLAYER_RECIPES?.[item.recipe] ?? FURNACE_RECIPES?.[item.recipe])
    : null;
  const detail = item.recipe   ? (recipeObj?.name ?? ITEMS[item.recipe]?.name ?? item.recipe)
               : item.resource ? (ITEMS[item.resource]?.name ?? item.resource)
               : '';
  return detail ? `${typeName} – ${detail}` : typeName;
}

function _refreshHubPopup() {
  const popup = document.getElementById('building-popup');
  if (!popup) return;

  popup.querySelector('.bld-popup-title').textContent = '🏗️ Construction Hub';
  const nav = popup.querySelector('.bld-popup-nav');
  if (nav) nav.style.display = 'none';

  const { time: hubTime, batch: hubBatch } = computePlaceTimeSec();
  const live = placeQueue.slice(_placeHead);

  let queueHtml;
  if (_hubViewMode === 'aggregate') {
    const groups = {};
    for (const it of live) {
      const k = it.type + ':' + (it.recipe ?? it.resource ?? '');
      if (!groups[k]) groups[k] = { label: _queueItemLabel(it), count: 0 };
      groups[k].count += it.count;
    }
    const rows = Object.values(groups).map(g => `<div class="bld-popup-row"><span>${g.label}</span><strong>×${g.count}</strong></div>`).join('');
    queueHtml = rows || '<div class="bld-popup-row" style="color:var(--dim)">Queue empty</div>';
  } else {
    queueHtml = live.length
      ? live.map(it => `<div class="bld-popup-row"><span>${_queueItemLabel(it)}</span><strong>×${it.count}</strong></div>`).join('')
      : '<div class="bld-popup-row" style="color:var(--dim)">Queue empty</div>';
  }

  const statsEl = popup.querySelector('.bld-popup-stats');
  statsEl.innerHTML = `
    <div class="bld-popup-row"><span>Place time</span><strong>${hubTime.toFixed(2)}s</strong></div>
    <div class="bld-popup-row"><span>Batch size</span><strong>${hubBatch}×</strong></div>
    <div class="bld-popup-row"><span>Queue total</span><strong>${live.reduce((s, it) => s + it.count, 0)} buildings</strong></div>
    <div class="hub-view-toggle">
      <button class="btn-sm${_hubViewMode === 'aggregate' ? ' btn-primary' : ''}" data-hub-view="aggregate">Aggregate</button>
      <button class="btn-sm${_hubViewMode === 'full' ? ' btn-primary' : ''}" data-hub-view="full">Full List</button>
    </div>
    <div class="hub-queue-list">${queueHtml}</div>`;

  if (!_hubPopupWired) {
    _hubPopupWired = true;
    popup.addEventListener('click', e => {
      const btn = e.target.closest('[data-hub-view]');
      if (btn && _bldPopupCat === 'hub') {
        e.stopPropagation(); // prevent document handler from seeing a detached node and closing popup
        _hubViewMode = btn.dataset.hubView;
        _refreshHubPopup();
      }
    });
  }

  // Position popup near hub tile
  const canvas = document.getElementById('base-map');
  const wrap   = document.getElementById('base-map-wrap');
  if (canvas && wrap) {
    const pos = _getOrAutoplaceTile('hub', 0);
    if (pos) {
      const tileSize = canvas.offsetWidth / MAP_GRID;
      let left = (pos.col + 1) * tileSize;
      let top  = (pos.row + 0.5) * tileSize - 20;
      const maxLeft = wrap.offsetWidth - (popup.offsetWidth || 240) - 4;
      if (left > maxLeft) left = pos.col * tileSize - (popup.offsetWidth || 240);
      popup.style.left = left + 'px';
      popup.style.top  = Math.max(0, top) + 'px';
    }
  }
  popup.classList.remove('hidden');
}


function _refreshBuildingPopup() {
  const cat   = BUILDING_MAP_CATEGORIES[_bldPopupCat];
  const popup = document.getElementById('building-popup');
  if (!cat || !popup) return;

  // Restore nav visibility in case hub popup hid it
  const nav = popup.querySelector('.bld-popup-nav');
  if (nav) nav.style.display = '';

  const recipes = cat.getRecipes();
  if (!recipes.length) return;
  _bldPopupRecipeIdx = Math.max(0, Math.min(_bldPopupRecipeIdx, recipes.length - 1));
  const recipe = recipes[_bldPopupRecipeIdx];

  popup.querySelector('.bld-popup-title').textContent  = cat.label;
  popup.querySelector('.bld-popup-recipe').textContent = recipe.name;
  popup.querySelector('.bld-popup-arrow-prev').disabled = _bldPopupRecipeIdx === 0;
  popup.querySelector('.bld-popup-arrow-next').disabled = _bldPopupRecipeIdx === recipes.length - 1;

  const statsEl = popup.querySelector('.bld-popup-stats');
  statsEl.innerHTML = '';
  for (const outKey of Object.keys(recipe.outputs ?? {})) {
    const itemName = ITEMS[outKey]?.name ?? outKey;
    const produced  = Math.floor(state?.itemsProduced?.[outKey] ?? 0);
    const base      = Math.floor(state?.baseProduced?.[outKey]  ?? 0);
    const manifest  = Math.max(0, produced - base);
    statsEl.innerHTML += `
      <div class="bld-popup-row"><span>${itemName} produced</span><strong>${fmtNum(produced)}</strong></div>
      ${manifest > 0 ? `<div class="bld-popup-row"><span>Bonus (productivity)</span><strong>+${fmtNum(manifest)}</strong></div>` : ''}`;
  }

  const canvas = document.getElementById('base-map');
  const wrap   = document.getElementById('base-map-wrap');
  if (canvas && wrap) {
    const pos = _getOrAutoplaceTile(_bldPopupCat, 0);
    if (pos) {
      const tileSize = canvas.offsetWidth / MAP_GRID;
      let left = (pos.col + 1) * tileSize;
      let top  = (pos.row + 0.5) * tileSize - 20;
      const maxLeft = wrap.offsetWidth - (popup.offsetWidth || 220) - 4;
      if (left > maxLeft) left = pos.col * tileSize - (popup.offsetWidth || 220);
      popup.style.left = left + 'px';
      popup.style.top  = Math.max(0, top) + 'px';
    }
  }

  popup.classList.remove('hidden');
}

function closeBuildingPopup() {
  document.getElementById('building-popup')?.classList.add('hidden');
  _bldPopupCat = null;
}

function _bldPopupPrev() { _bldPopupRecipeIdx--; _refreshBuildingPopup(); }
function _bldPopupNext() { _bldPopupRecipeIdx++; _refreshBuildingPopup(); }

// ── Tile background picker ────────────────────────────────────────────────────

function openTileBgPicker(col, row, canvasX, canvasY, canvas) {
  closeTileBgPicker();
  _tilePicker = { col, row, selectedKey: state?.tileBg?.[`${col},${row}`] ?? null };

  const popup = document.getElementById('tile-bg-picker');
  if (!popup) return;

  // Build option grid — grass (clear) first, then concrete variants
  const grid = popup.querySelector('.tile-picker-grid');
  grid.innerHTML = '';
  const allOptions = [{ key: '', label: 'Grass' }, ...CONCRETE_TILES];
  for (const ct of allOptions) {
    const btn = document.createElement('button');
    btn.className = 'tile-picker-option' + (_tilePicker.selectedKey === ct.key ? ' selected' : '');
    btn.title = ct.label;
    btn.dataset.tileKey = ct.key;
    if (ct.key === '') {
      const el = document.createElement('img');
      el.src = 'data/map_imgs/grass_flower.png'; el.alt = 'Grass';
      btn.appendChild(el);
    } else {
      const img = _concreteImgs[ct.key];
      if (img?.complete && img.naturalWidth > 0) {
        const el = document.createElement('img');
        el.src = ct.src; el.alt = ct.label;
        btn.appendChild(el);
      } else {
        btn.textContent = ct.label;
      }
    }
    btn.addEventListener('click', () => _selectTileBgOption(ct.key));
    grid.appendChild(btn);
  }

  // Position popup near clicked tile, clamped inside wrapper
  const wrap = document.getElementById('base-map-wrap');
  if (canvas && wrap) {
    const tileSize = canvas.offsetWidth / MAP_GRID;
    let left = (col + 1) * tileSize;
    let top  = row * tileSize;
    const maxLeft = wrap.offsetWidth - (popup.offsetWidth || 260) - 4;
    if (left > maxLeft) left = col * tileSize - (popup.offsetWidth || 260);
    popup.style.left = left + 'px';
    popup.style.top  = Math.max(0, top) + 'px';
  }

  popup.classList.remove('hidden');
}

function _selectTileBgOption(key) {
  if (!_tilePicker) return;
  _tilePicker.selectedKey = key;
  document.querySelectorAll('.tile-picker-option').forEach(btn =>
    btn.classList.toggle('selected', btn.dataset.tileKey === key)
  );
}

function _applyTileBg(mode) {
  if (!_tilePicker || !state?.tileBg) return;
  const { col, row, selectedKey } = _tilePicker;

  if (mode === 'tile') {
    if (selectedKey) state.tileBg[`${col},${row}`] = selectedKey;
    else delete state.tileBg[`${col},${row}`];
  } else if (mode === 'row') {
    for (let c = 0; c < MAP_GRID; c++) {
      if (selectedKey) state.tileBg[`${c},${row}`] = selectedKey;
      else delete state.tileBg[`${c},${row}`];
    }
  } else if (mode === 'col') {
    for (let r = 0; r < MAP_GRID; r++) {
      if (selectedKey) state.tileBg[`${col},${r}`] = selectedKey;
      else delete state.tileBg[`${col},${r}`];
    }
  }
  closeTileBgPicker();
}

function closeTileBgPicker() {
  document.getElementById('tile-bg-picker')?.classList.add('hidden');
  _tilePicker = null;
}

function _orePopupMine() {
  const popup = document.getElementById('ore-patch-popup');
  if (!popup) return;
  const key = popup.dataset.oreKey;
  if (key) {
    manualMine(key);
    // Refresh displayed numbers
    setTimeout(() => { if (!popup.classList.contains('hidden')) openOrePatchPopup(key); }, 520);
  }
}

function _drawWalls(ctx, S) {
  const p = state?.perimeter;
  if (!p) return;
  const maxWalls = perimeterMaxWalls();
  if (maxWalls <= 0) return;

  const frac = p.walls / maxWalls;
  if (frac < 0.20) return;

  let tier;
  if      (frac < 0.40) tier = 20;
  else if (frac < 0.60) tier = 40;
  else if (frac < 0.80) tier = 60;
  else                  tier = 80;

  const tileSize = S / MAP_GRID;
  const m   = WALL_RING;           // = 1
  const far = MAP_GRID - 1 - m;   // = 13

  function drawTile(key, col, row) {
    const img = _wallImgs[key];
    if (!img?.complete || img.naturalWidth === 0) return;
    ctx.drawImage(img, col * tileSize, row * tileSize, tileSize, tileSize);
  }

  for (let col = m + 1; col < far; col++) {
    drawTile(`top_${tier}`,    col, m);
    drawTile(`bottom_${tier}`, col, far);
  }
  for (let row = m + 1; row < far; row++) {
    drawTile(`left_${tier}`,  m,   row);
    drawTile(`right_${tier}`, far, row);
  }
  drawTile(`tl_${tier}`, m,   m);
  drawTile(`tr_${tier}`, far, m);
  drawTile(`bl_${tier}`, m,   far);
  drawTile(`br_${tier}`, far, far);
}

function _drawTurrets(ctx, S) {
  const p = state?.perimeter;
  if (!p) return;
  const maxTurrets = perimeterMaxTurrets();
  if (maxTurrets <= 0) return;

  const combined = (p.gunTurrets ?? 0) + (p.laserTurrets ?? 0);
  const frac = combined / maxTurrets;
  if (frac < 0.20) return;

  let tier;
  if      (frac < 0.40) tier = 20;
  else if (frac < 0.60) tier = 40;
  else if (frac < 0.80) tier = 60;
  else if (frac < 1.00) tier = 80;
  else                  tier = 100;

  const tileSize = S / MAP_GRID;
  const m   = WALL_RING;
  const far = MAP_GRID - 1 - m;

  function drawTile(key, col, row) {
    const img = _turretImgs[key];
    if (!img?.complete || img.naturalWidth === 0) return;
    ctx.drawImage(img, col * tileSize, row * tileSize, tileSize, tileSize);
  }

  for (let col = m + 1; col < far; col++) {
    drawTile(`top_${tier}`,    col, m);
    drawTile(`bottom_${tier}`, col, far);
  }
  for (let row = m + 1; row < far; row++) {
    drawTile(`left_${tier}`,  m,   row);
    drawTile(`right_${tier}`, far, row);
  }
  drawTile(`tl_${tier}`, m,   m);
  drawTile(`tr_${tier}`, far, m);
  drawTile(`bl_${tier}`, m,   far);
  drawTile(`br_${tier}`, far, far);
}

// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await loadMetaState();
  _grassImg = new Image();
  _grassImg.src = 'data/map_imgs/grass_map_composed.png';
  const _wallSides   = ['top', 'bottom', 'left', 'right'];
  const _wallCorners = ['tl', 'tr', 'bl', 'br'];
  const _wallTiers   = [20, 40, 60, 80];
  for (const side of _wallSides)
    for (const t of _wallTiers) {
      const img = new Image(); img.src = `data/map_imgs/wall_${side}_${t}.png`;
      _wallImgs[`${side}_${t}`] = img;
    }
  for (const corner of _wallCorners)
    for (const t of _wallTiers) {
      const img = new Image(); img.src = `data/map_imgs/wall_corner_${corner}_${t}.png`;
      _wallImgs[`${corner}_${t}`] = img;
    }
  const _turretSides   = ['top', 'bottom', 'left', 'right'];
  const _turretCorners = ['tl', 'tr', 'bl', 'br'];
  const _turretTiers   = [20, 40, 60, 80, 100];
  for (const side of _turretSides)
    for (const t of _turretTiers) {
      const img = new Image(); img.src = `data/map_imgs/turret_${side}_${t}.png`;
      _turretImgs[`${side}_${t}`] = img;
    }
  for (const corner of _turretCorners)
    for (const t of _turretTiers) {
      const img = new Image(); img.src = `data/map_imgs/turret_corner_${corner}_${t}.png`;
      _turretImgs[`${corner}_${t}`] = img;
    }
  // Preload concrete tile images
  _concreteImgs = {};
  for (const ct of CONCRETE_TILES) {
    const img = new Image(); img.src = ct.src; _concreteImgs[ct.key] = img;
  }
  // Preload building images
  _bldImgs = {};
  const _bldSrcs = new Set();
  for (const cat of Object.values(BUILDING_MAP_CATEGORIES))
    cat.slotImgs.forEach(s => { if (s) _bldSrcs.add(s); });
  for (const src of _bldSrcs) {
    const img = new Image(); img.src = src; _bldImgs[src] = img;
  }
  let _resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      if (!document.getElementById('tab-mining')?.classList.contains('hidden')) initBaseMap();
    }, 200);
  });
  document.querySelectorAll('.difficulty-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDifficulty = btn.dataset.diff;
      const customField = document.getElementById('biter-custom-mult-field');
      if (customField) customField.classList.toggle('hidden', selectedDifficulty !== 'custom');
    })
  );
  document.getElementById('biters-toggle').addEventListener('change', e => {
    document.getElementById('biters-status').textContent = e.target.checked ? 'Enabled' : 'Disabled';
  });

  // Base map canvas events
  document.getElementById('base-map')?.addEventListener('click',     _handleMapClick);
  document.getElementById('base-map')?.addEventListener('dblclick',  _handleMapDblClick);
  document.getElementById('base-map')?.addEventListener('mousemove', _handleMapMouseMove);

  // Close popups on outside click or Escape
  document.addEventListener('click', e => {
    const orep = document.getElementById('ore-patch-popup');
    if (orep && !orep.classList.contains('hidden') && !orep.contains(e.target) && e.target.id !== 'base-map')
      closeOrePatchPopup();
    const bldp = document.getElementById('building-popup');
    if (bldp && !bldp.classList.contains('hidden') && !bldp.contains(e.target) && e.target.id !== 'base-map')
      closeBuildingPopup();
    const tilep = document.getElementById('tile-bg-picker');
    if (tilep && !tilep.classList.contains('hidden') && !tilep.contains(e.target) && e.target.id !== 'base-map')
      closeTileBgPicker();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeOrePatchPopup(); closeBuildingPopup(); closeTileBgPicker(); }
  });

  refreshSaveList();
});
