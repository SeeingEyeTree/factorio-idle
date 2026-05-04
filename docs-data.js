// docs-data.js — Static data constants for docs.html.
// Contains only the data needed to generate the scripting reference tables.
// Keep in sync with game.js whenever building types or infinite techs change.
'use strict';

const BUILDING_DEFS_DOCS = {
  miner:           { name: 'Burner Mining Drill',    scriptAlias: 'miner'           },
  electricMiner:   { name: 'Electric Mining Drill',  scriptAlias: 'e_drill'         },
  furnace:         { name: 'Stone Furnace',           scriptAlias: 'furnace'         },
  steelFurnace:    { name: 'Steel Furnace',           scriptAlias: 'steel_furnace'   },
  electricFurnace: { name: 'Electric Furnace',        scriptAlias: 'electric_furnace'},
  assembly:        { name: 'Assembling Machine Mk1', scriptAlias: 'am1'             },
  assembly2:       { name: 'Assembling Machine Mk2', scriptAlias: 'am2'             },
  assembly3:       { name: 'Assembling Machine Mk3', scriptAlias: 'am3'             },
  lab:             { name: 'Lab',                     scriptAlias: 'lab'             },
  boiler:          { name: 'Boiler',                  scriptAlias: 'boiler'          },
  steamEngine:     { name: 'Steam Engine',            scriptAlias: 'steam_engine'    },
  offshoreP:       { name: 'Offshore Pump',           scriptAlias: 'pump'            },
  radar:           { name: 'Radar',                   scriptAlias: 'radar'           },
  solarPanel:      { name: 'Solar Panel',             scriptAlias: 'solar'           },
  accumulator:     { name: 'Accumulator',             scriptAlias: 'accumulator'     },
  oilRefinery:     { name: 'Oil Refinery',            scriptAlias: 'refinery'        },
  chemicalPlant:   { name: 'Chemical Plant',          scriptAlias: 'chem'            },
  centrifuge:      { name: 'Centrifuge',              scriptAlias: 'centrifuge'      },
  rocketSilo:      { name: 'Rocket Silo',             scriptAlias: 'silo'            },
  pumpjack:        { name: 'Pumpjack',                scriptAlias: 'pumpjack'        },
  nuclearReactor:  { name: 'Nuclear Reactor',         scriptAlias: 'reactor'         },
};

// Maps building type → its single placeable item key in inventory
const BUILDING_ITEM_KEYS_DOCS = {
  miner:           'burnerMinerItem',
  electricMiner:   'electricMinerItem',
  furnace:         'stoneFurnaceItem',
  steelFurnace:    'steelFurnaceItem',
  electricFurnace: 'electricFurnaceItem',
  assembly:        'assemblyMachine1Item',
  assembly2:       'assemblyMachine2Item',
  assembly3:       'assemblyMachine3Item',
  lab:             'labItem',
  boiler:          'boilerItem',
  steamEngine:     'steamEngineItem',
  offshoreP:       'offshorePumpItem',
  radar:           'radarItem',
  solarPanel:      'solarPanelItem',
  accumulator:     'accumulatorItem',
  oilRefinery:     'oilRefineryItem',
  chemicalPlant:   'chemicalPlantItem',
  electricFurnace: 'electricFurnaceItem',
  centrifuge:      'centrifugeItem',
  rocketSilo:      'rocketSiloItem',
  pumpjack:        'pumpjackItem',
  nuclearReactor:  'nuclearReactorItem',
};

const INFINITE_TECHS_DOCS = {
  'robot:speed':         { displayName: 'Robot Speed'               },
  'robot:cargo':         { displayName: 'Robot Cargo Capacity'      },
  'mining:productivity': { displayName: 'Mining Productivity'       },
  'gun:damage':          { displayName: 'Physical Projectile Damage'},
  'laser:damage':        { displayName: 'Laser Shooting Speed'      },
  'artillery:range':     { displayName: 'Artillery Range'           },
  'artillery:damage':    { displayName: 'Artillery Damage'          },
};
