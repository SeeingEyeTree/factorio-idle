'use strict';

// ── New Technologies (from wiki, Machines + Crafting, no space age) ───────────
// These entries are ready to merge into TECHNOLOGIES in technologies.js.
// All prereq keys reference existing keys in that file, with two noted exceptions.

const TECHNOLOGIES_NEW = {

  // ── Machines ─────────────────────────────────────────────────
  fastInserter: {
    name: 'Fast Inserter', icon: '⚡',
    cost: { redScience: 30 }, timePerPack: 15,
    prereqs: ['automation'],
    description: 'Unlocks Fast Inserter for rapid item transfer',
    unlockRecipes: ['fastInserterItem'], unlockBuildings: [],
  },
  bulkInserter: {
    name: 'Bulk Inserter', icon: '📦',
    cost: { redScience: 150, greenScience: 150 }, timePerPack: 30,
    prereqs: ['advancedCircuit', 'fastInserter', 'logistics2'],
    description: 'Unlocks Bulk Inserter for high-throughput item transfer',
    unlockRecipes: ['bulkInserterItem'], unlockBuildings: [],
  },
  electricEnergyAccumulators: {
    name: 'Electric Energy Accumulators', icon: '🔋',
    // NOTE: accumulator is also unlocked by electricDistribution1 in the existing codebase
    cost: { redScience: 150, greenScience: 150 }, timePerPack: 30,
    prereqs: ['batteryTech', 'electricDistribution1'],
    description: 'Researches accumulator technology for energy storage',
    unlockRecipes: [], unlockBuildings: [],
  },
  electricDistribution2: {
    name: 'Electric Energy Distribution 2', icon: '⚡',
    cost: { redScience: 100, greenScience: 100, blueScience: 100 }, timePerPack: 45,
    prereqs: ['chemicalSciencePack', 'electricDistribution1'],
    description: 'Unlocks Substation for wide-area power distribution',
    unlockRecipes: ['substationItem'], unlockBuildings: ['substation'],
  },
  logistics3: {
    name: 'Logistics 3', icon: '⏩',
    cost: { redScience: 300, greenScience: 300, blueScience: 300, purpleScience: 300 }, timePerPack: 15,
    prereqs: ['lubricantTech', 'productionSciencePack'],
    description: 'Unlocks Express transport belt, splitter, and underground belt',
    unlockRecipes: ['expressTransportBelt', 'expressSplitter', 'expressUndergroundBelt'], unlockBuildings: [],
  },
  uraniumMining: {
    name: 'Uranium Mining', icon: '☢️',
    cost: { redScience: 100, greenScience: 100, blueScience: 100 }, timePerPack: 30,
    prereqs: ['chemicalSciencePack', 'concrete'],
    description: 'Enables mining of uranium ore with electric mining drills',
    unlockRecipes: [], unlockBuildings: [],
  },

  // ── Crafting ─────────────────────────────────────────────────
  circuitNetwork: {
    name: 'Circuit Network', icon: '🔗',
    cost: { redScience: 100, greenScience: 100 }, timePerPack: 15,
    prereqs: ['logisticSciencePack'],
    description: 'Unlocks combinators, power switch and programmable speaker for circuit automation',
    unlockRecipes: ['arithmeticCombinator', 'deciderCombinator', 'constantCombinator', 'powerSwitch', 'programmableSpeaker'], unlockBuildings: [],
  },

  explosivesTech: {
    name: 'Explosives', icon: '💥',
    cost: { redScience: 100, greenScience: 100 }, timePerPack: 15,
    prereqs: ['sulfurProcessing'],
    description: 'Unlocks Explosives crafting',
    unlockRecipes: ['explosives'], unlockBuildings: [],
  },
  cliffExplosives: {
    name: 'Cliff Explosives', icon: '🧨',
    cost: { redScience: 200, greenScience: 200 }, timePerPack: 15,
    prereqs: ['explosivesTech', 'military2'],
    description: 'Unlocks Cliff Explosives for terrain modification',
    unlockRecipes: ['cliffExplosivesItem'], unlockBuildings: [],
  },
  coalLiquefaction: {
    name: 'Coal Liquefaction', icon: '🪨',
    cost: { redScience: 200, greenScience: 200, blueScience: 200, purpleScience: 200 }, timePerPack: 30,
    prereqs: ['advancedOilProcessing', 'productionSciencePack'],
    description: 'Unlocks Coal Liquefaction — convert coal into heavy oil',
    unlockRecipes: ['coalLiquefaction'], unlockBuildings: [],
  },

  lampTech: {
    name: 'Lamp', icon: '💡',
    cost: { redScience: 10 }, timePerPack: 15,
    prereqs: ['automation'],
    description: 'Unlocks Lamp for lighting and circuit network signalling',
    unlockRecipes: ['lampItem'], unlockBuildings: [],
  },


  advancedCombinators: {
    name: 'Advanced Combinators', icon: '🔗',
    cost: { redScience: 50, greenScience: 50, blueScience: 50 }, timePerPack: 30,
    prereqs: ['chemicalSciencePack', 'circuitNetwork'],
    description: 'Unlocks Selector Combinator for advanced circuit logic',
    unlockRecipes: ['selectorCombinator'], unlockBuildings: [],
  },
  logisticSystem: {
    name: 'Logistic System', icon: '📬',
    cost: { redScience: 500, greenScience: 500, blueScience: 500, yellowScience: 500 }, timePerPack: 30,
    // NOTE: wiki prereq is "Logistic robotics" (not in existing codebase); mapped to constructionRobotics
    prereqs: ['constructionRobotics', 'utilitySciencePack'],
    description: 'Unlocks Active Provider Chest, Buffer Chest, and Requester Chest for smart logistics',
    unlockRecipes: ['activeProviderChest', 'bufferChest', 'requesterChest'], unlockBuildings: [],
  },

  


    rocketControlUnitTech: {
    name: 'Rocket Control Unit', icon: '🎮',
    cost: { redScience: 300, greenScience: 300, blueScience: 300 }, timePerPack: 30,
    prereqs: ['processingUnitTech', 'productionSciencePack'],
    description: 'Unlocks Rocket Control Unit — high-tech component for rockets',
    unlockRecipes: ['rocketControlUnit'], unlockBuildings: [],
  },

};
