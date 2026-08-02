// Theme display overrides — factorio vs caffactory branding.
// Each resolver (itemDisplay, buildingDisplay, spriteSrc in game.js) merges the
// base ITEMS / BUILDING_DEFS entry with the active theme's overrides, so only
// entries that differ from the base need to appear here.
//
// caffactory is the default theme. It overrides most item/building names and images.
// factorio only needs to override what's been renamed to caffactory in ITEMS/BUILDING_DEFS.

const THEMES = {


    caffactory: {
    items: {

      // Science packs → Caff-Infinite branded energy drink cans
      redScience:      { name: 'Caff-Infinite Original',       img: 'data/icon_imgs/caffactory/caffactory_can_red.png' },
      greenScience:    { name: 'Caff-Infinite Shipped',         img: 'data/icon_imgs/caffactory/caffactory_can_green.png' },
      blueScience:     { name: 'Caff-Infinite BLUE 40',         img: 'data/icon_imgs/caffactory/caffactory_can_blue.png' },
      blackScience:    { name: 'Caff-Infinite Tactical',        img: 'data/icon_imgs/caffactory/caffactory_can_black.png' },
      purpleScience:   { name: 'Caff-Infinite Overtime',        img: 'data/icon_imgs/caffactory/caffactory_can_purple.png' },
      yellowScience:   { name: 'Caff-Infinite Happiness',       img: 'data/icon_imgs/caffactory/caffactory_can_yellow.png' },
      spaceScience:    { name: 'Caff-Infinite Zero-G',          img: 'data/icon_imgs/caffactory/caffactory_can_white.png' },
      rainbowScience:  { name: 'Caff-Infinite Rainbow', img: 'data/icon_imgs/caffactory/caffactory_can_rainbow.png' },

      // Resources → office/recycling metaphors
      ironOre:         { name: 'Crushed Cans',        img: 'data/icon_imgs/caffactory/crushed_cans.png' },
      copperOre:       { name: 'E-Waste',              img: 'data/icon_imgs/caffactory/e_waste.png' },
      stone:           { name: 'Drywall Chunks',       img: 'data/icon_imgs/caffactory/drywall_chunks.png' },
      coal:            { name: 'Used Coffee Grounds',  img: 'data/icon_imgs/caffactory/coffee_grounds.png' },
      uraniumOre:      { name: 'Banned Energy Powder', img: 'data/icon_imgs/caffactory/banned_powder.png' },

      // Plates / base components
      ironPlate:       { name: 'Aluminum Sheet',      img: 'data/icon_imgs/caffactory/aluminum_sheet.png' },
      copperPlate:     { name: 'Wire Spool',           img: 'data/icon_imgs/caffactory/wire_spool.png' },
      steel:           { name: 'Reinforced Tray',      img: 'data/icon_imgs/caffactory/reinforced_tray.png' },
      ironGear:        { name: 'Cog In the Machine',           img: 'data/icon_imgs/caffactory/iron_gear.png' },
      ironStick:       { name: 'Stylus',               img: 'data/icon_imgs/caffactory/stylus.png' },
      copperCable:     { name: 'Phone Cables',         img: 'data/icon_imgs/caffactory/phone_cables.png' },
      stoneBrick:      { name: 'Cubicle Panel',        img: 'data/icon_imgs/caffactory/cubicle_panel.png' },
      concrete:        { name: 'Concrete',             img: 'data/icon_imgs/caffactory/concrete.png' },

      // Circuits → UM chip family
      electronicCircuit: { name: 'UM 100', img: 'data/icon_imgs/caffactory/um_100.png' },
      advancedCircuit:   { name: 'UM 200', img: 'data/icon_imgs/caffactory/um_200.png' },
      processingUnit:    { name: 'UM 300', img: 'data/icon_imgs/caffactory/um_300.png' },

      // Oil chain → syrup / beverage production chain
      crudeOil:        { name: 'Drink Syrup Concentrate', img: 'data/icon_imgs/caffactory/syrup_concentrate.png' },
      heavyOil:        { name: 'Heavy Concentrate',       img: 'data/icon_imgs/caffactory/concentrate_heavy.png' },
      lightOil:        { name: 'Light Concentrate',       img: 'data/icon_imgs/caffactory/concentrate_light.png' },
      petroleumGas:    { name: 'Carbonation',             img: 'data/icon_imgs/caffactory/carbonation.png' },
      sulfur:          { name: 'Sulfur',             img: 'data/icon_imgs/caffactory/sulfur.png' },
      sulfuricAcid:    { name: 'Sulfuric Acid',      img: 'data/icon_imgs/caffactory/sulfuric_acid.png' },
      plasticBar:      { name: 'Plastic Bags',            img: 'data/icon_imgs/caffactory/plastic_bar.png' },
      battery:         { name: 'AA Battery Pack',         img: 'data/icon_imgs/caffactory/battery.png' },
      solidFuel:       { name: 'Caffeine Brick',          img: 'data/icon_imgs/caffactory/solid_fuel.png' },

      // Engine / robot components
      engineUnit:         { name: 'Coffee Maker Motor',   img: 'data/icon_imgs/caffactory/coffee_motor.png' },
      electricEngineUnit: { name: 'Espresso Pump Motor',  img: 'data/icon_imgs/caffactory/espresso_motor.png' },
      flyingRobotFrame:   { name: 'Scamazon Drone Frame', img: 'data/icon_imgs/caffactory/drone_frame.png' },
      constructionRobotItem: { name: 'Drone Swarm' },

      // Logistics
      inserter:        { name: 'Temp Worker Arm', img: 'data/icon_imgs/caffactory/temp_arm.png' },

      // Military / ammo → office supplies
      firearmMagazine:   { name: 'Stapler Cartridge',       img: 'data/icon_imgs/caffactory/stapler_ammo.png' },
      piercingRoundsMag: { name: 'Heavy-Duty Stapler Pack', img: 'data/icon_imgs/caffactory/piercing_rounds.png' },
      uraniumRoundsMag:  { name: 'Radioactive Stapler Pack', img: 'data/icon_imgs/caffactory/stapler_uranium.png' },
      artilleryShell:    { name: 'Marketing Missile',        img: 'data/icon_imgs/caffactory/marketing_missile.png' },
      atomicBomb:        { name: 'Limited Edition Drop',     img: 'data/icon_imgs/caffactory/atomic_drink.png' },
      explosives:        { name: 'Discontinued Energy Drink', img: 'data/icon_imgs/caffactory/discontinued_drink.png' },

      // Defense structures
      gunTurretItem:      { name: 'Auto-Stapler Sentry', img: 'data/icon_imgs/caffactory/gun_turret.png' },
      laserTurretItem:    { name: 'Briefing Beam',       img: 'data/icon_imgs/caffactory/briefing_beam.png' },
      artilleryTurretItem:{ name: 'PR Howitzer',         img: 'data/icon_imgs/caffactory/pr_howitzer.png' },
      stoneWall:          { name: 'Cubicle Wall',        img: 'data/icon_imgs/caffactory/cubicle_wall.png' },

      // Rocket / endgame
      rocketFuel:           { name: 'Rocket Fuel',                img: 'data/icon_imgs/caffactory/rocket_fuel_drink.png' },
      lowDensityStructure:  { name: 'Carbon Composite',           img: 'data/icon_imgs/caffactory/lds.png' },
      satellite:            { name: 'Ad Network Satellite',       img: 'data/icon_imgs/caffactory/ad_satellite.png' },
      uranium235:           { name: 'Pure Caffeine Crystal',      img: 'data/icon_imgs/caffactory/caffeine_crystal_pure.png' },
      uranium238:           { name: 'Caffeine Crystal',           img: 'data/icon_imgs/caffactory/caffeine_crystal.png' },
      uraniumFuelCell:      { name: 'Caffeine Capsule',           img: 'data/icon_imgs/caffactory/caffeine_capsule.png' },

      // Modules → espresso shots / performance reviews
      speedModule:        { name: 'Signal Shot',       img: 'data/icon_imgs/caffactory/triple_shot_1.png' },
      speedModule2:       { name: 'Double Shot',       img: 'data/icon_imgs/caffactory/triple_shot_2.png' },
      speedModule3:       { name: 'Nuclear Espresso',  img: 'data/icon_imgs/caffactory/triple_shot_3.png' },
      productivityModule: { name: 'Performance Review',  img: 'data/icon_imgs/caffactory/perf_review_1.png' },
      productivityModule2:{ name: 'Quarterly Review',    img: 'data/icon_imgs/caffactory/perf_review_2.png' },
      productivityModule3:{ name: 'Annual Review',       img: 'data/icon_imgs/caffactory/perf_review_3.png' },

      // Building items → Caff-Infinite corporate machinery
      labItem:             { name: 'Unpaid Intern',              img: 'data/icon_imgs/caffactory/unpaid_intern.png' },
      stoneFurnaceItem:    { name: 'Blast Furnace',                  img: 'data/icon_imgs/caffactory/stone_furnace.png' },
      steelFurnaceItem:    { name: 'Pressure Forge',       img: 'data/icon_imgs/caffactory/steel_furnace.png' },
      electricFurnaceItem: { name: 'Vacume Furnace', img: 'data/icon_imgs/caffactory/electric_furnace.png' },
      assemblyMachine1Item:{ name: 'Junior Intern Pod',          img: 'data/icon_imgs/caffactory/intern_pod_1.png' },
      assemblyMachine2Item:{ name: 'Mid-Level Intern Pod',       img: 'data/icon_imgs/caffactory/intern_pod_2.png' },
      assemblyMachine3Item:{ name: 'Senior Intern Pod',          img: 'data/icon_imgs/caffactory/amk3.png' },
      burnerMinerItem:     { name: 'The MINES',           img: 'data/icon_imgs/caffactory/burner_mining_drill.png' },
      electricMinerItem:   { name: 'No Safety Mining',          img: 'data/icon_imgs/caffactory/electric_mining_drill.png' },
      boilerItem:          { name: 'Coffee Boiler',              img: 'data/icon_imgs/caffactory/coffee_boiler.png' },
      steamEngineItem:     { name: 'Coffee Generator',            img: 'data/icon_imgs/caffactory/steam_engine.png' },
      solarPanelItem:      { name: 'Open-Plan Skylight',         img: 'data/icon_imgs/caffactory/skylight.png' },
      accumulatorItem:     { name: 'Power Bank',                 img: 'data/icon_imgs/caffactory/power_bank.png' },
      offshorePumpItem:    { name: 'Water Cooler',               img: 'data/icon_imgs/caffactory/water_cooler.png' },
      radarItem:           { name: 'Surveillance Tower',         img: 'data/icon_imgs/caffactory/surveillance_tower.png' },
      pumpjackItem:        { name: 'Syrup Extractor',            img: 'data/icon_imgs/caffactory/syrup_extractor.png' },
      oilRefineryItem:     { name: 'Beverage Plant',             img: 'data/icon_imgs/caffactory/beverage_plant.png' },
      chemicalPlantItem:   { name: 'Flavor Lab',                 img: 'data/icon_imgs/caffactory/flavor_lab.png' },
      centrifugeItem:      { name: 'Spinner',                 img: 'data/icon_imgs/caffactory/qa_spinner.png' },
      rocketSiloItem:      { name: 'Marketing Launchpad',        img: 'data/icon_imgs/caffactory/marketing_silo.png' },
      nuclearReactorItem:  { name: 'Inverse Data Center',                img: 'data/icon_imgs/caffactory/data_center.png' },
    },

    techs: {
      automation                 : { name: 'Intern Onboarding'          , description: 'Unlocks the Junior Intern Pod production line.'                                                         , iconImg: 'data/icon_imgs/caffactory/intern_pod_1.png' },
      military                   : { name: 'HR Department'              , description: 'Unlocks damage upgrades for Auto-Stapler Sentries.'                                                      },
      logistics                  : { name: 'Process Optimization'       , description: 'Cuts building placement time by 0.5 seconds. Every second counts.' },
      landfill                   : { name: 'Cubicle Demolition'         , description: 'Convert water tiles to floorspace.'                                                                     , iconImg: 'data/icon_imgs/caffactory/cubicle_panel.png' },
      radarTech                  : { name: 'Corporate Surveillance'     , description: 'Unlocks the Surveillance Tower for maxium productivity.'                                                     , iconImg: 'data/icon_imgs/caffactory/surveillance_tower.png' },
      electricMiningDrill        : { name: 'No Safety Mining'       , description: 'Mining is faster if you disregard safety protocols.'                             , iconImg: 'data/icon_imgs/caffactory/electric_mining_drill.png' },
      steelProcessing            : { name: 'Reinforced Trays'           , description: 'Enables smelting Reinforced Trays from Aluminum Sheets.'                                               , iconImg: 'data/icon_imgs/caffactory/reinforced_tray.png' },
      logisticSciencePack        : { name: 'Distribution Department'    , description: 'Unlocks the Caff-Infinite Shipped recipe.'                                                              , iconImg: 'data/icon_imgs/caffactory/caffactory_can_green.png' },
      gunTurret                  : { name: 'Office Supplies, Weaponized', description: 'Unlocks the Auto-Stapler Sentry and Stapler Cartridges for basic defense.'                             , iconImg: 'data/icon_imgs/caffactory/gun_turret.png' },
      military2                  : { name: 'HR Department 2'            , description: 'Grenades go boom. Heavy-Duty Stapler Packs go pew.'                                                     , iconImg: 'data/icon_imgs/caffactory/triple_shot_2.png' },
      automation2                : { name: 'Intern Onboarding 2'        , description: 'Unlocks the Mid-Level Intern Pod.'                                                                      , iconImg: 'data/icon_imgs/caffactory/intern_pod_2.png' },
      advancedMaterialProcessing : { name: 'Industrial Reheating'       , description: 'Unlocks the Pressure Forge (larger, faster heating).'                                             , iconImg: 'data/icon_imgs/caffactory/steel_furnace.png' },
      engineTech                 : { name: 'Coffee Maker Engineering'   , description: 'Unlocks the Coffee Maker Motor — the heart of every Caff-Infinite appliance.'                          , iconImg: 'data/icon_imgs/caffactory/coffee_motor.png' },
      accumulators               : { name: 'Power Banks'          , description: 'Unlocks Power Banks for energy storage.'                                                                , iconImg: 'data/icon_imgs/caffactory/power_bank.png' },
      solarEnergy                : { name: 'Open-Plan Architecture'     , description: 'Unlocks Open-Plan Skylights. Daylight, finally.'                                                       , iconImg: 'data/icon_imgs/caffactory/skylight.png' },
      logistics2                 : { name: 'Process Optimization 2'     , description: 'Another 0.25 seconds shaved off placement time.' },
      scriptingTech              : { name: 'Bring Your Own Laptop'      , description: 'Authorizes interns to write their own automation scripts. They will keep their jobs ;)'                                              , iconImg: 'data/icon_imgs/caffactory/stylus.png' },
      concrete                   : { name: 'Cubicle Foundations'        , description: 'Unlocks Concrete for real base status.'                                                              , iconImg: 'data/icon_imgs/caffactory/concrete.png' },
      oilGathering               : { name: 'Syrup Sourcing'             , description: 'Locates Drink Syrup Concentrate deposits. Unlocks the Syrup Extractor.'                                , iconImg: 'data/icon_imgs/caffactory/syrup_extractor.png' },
      plastics                   : { name: 'Disposable Packaging'       , description: 'Unlocks Plastic Bag production. The turtles will be fine, probably.'                                   , iconImg: 'data/icon_imgs/caffactory/plastic_bar.png' },
      batteryTech                : { name: 'Disposable Power'           , description: 'Unlocks AA Battery Pack production.'                                                                    , iconImg: 'data/icon_imgs/caffactory/battery.png' },
      sulfurProcessing           : { name: 'Sulfur Processing'          , description: 'Extracts Sulfur from the soda.'                                        , iconImg: 'data/icon_imgs/caffactory/sour_powder.png' },
      advancedCircuit            : { name: 'UM 200 Architecture'        , description: 'Unlocks the UM 200 chip — second generation of Caff-Infinite silicon.'                                , iconImg: 'data/icon_imgs/caffactory/um_200.png' },
      chemicalSciencePack        : { name: 'BLUE 40 Formulation'        , description: 'Unlocks the Caff-Infinite BLUE 40 recipe. FDA still reviewing.'                                       , iconImg: 'data/icon_imgs/caffactory/caffactory_can_blue.png' },
      advancedOilProcessing      : { name: 'Advanced Beverage R&D'      , description: 'Cracks crude syrup into Heavy Concentrate, Light Concentrate, and Carbonation streams.'                , iconImg: 'data/icon_imgs/caffactory/concentrate_heavy.png' },
      lubricantTech              : { name: 'Industrial Hand Cream'      , description: "Unlocks Lubricant. Don't ask what it's for." },
      electricEngine             : { name: 'Espresso Pump Motor'        , description: 'Unlocks the Espresso Pump Motor — high-pressure, high-stakes.'                                         , iconImg: 'data/icon_imgs/caffactory/espresso_motor.png' },
      robotics                   : { name: 'Scamazon Logistics'         , description: 'Unlocks the Scamazon Drone Frame.'                                                                      , iconImg: 'data/icon_imgs/caffactory/drone_frame.png' },
      constructionRobotics       : { name: 'Drone Swarm Deployment'     , description: 'Unlocks Drone Swarms for faster building placement.'                                                    , iconImg: 'data/icon_imgs/caffactory/janitor_bot.png' },
      railTech                   : { name: 'Interoffice Mail System'    , description: 'Unlocks Railways and Mail Carts.' },
      spidertron                 : { name: 'Executive Hover Chair'      , description: 'For C-suite use only. They need self defense these days. - Not in demo'                                                                         , iconImg: 'data/icon_imgs/caffactory/marketing_missile.png' },
      military3                  : { name: 'HR Department 3'            , description: 'Sterner performance reviews. Bigger guns.'                                                              , iconImg: 'data/icon_imgs/caffactory/triple_shot_3.png' },
      military4                  : { name: 'HR Department 4'            , description: 'Termination paperwork now self-collating.' },
      artillery                  : { name: 'Press Release Department'   , description: 'Unlocks the PR Howitzer for long-range brand awareness.'                                               , iconImg: 'data/icon_imgs/caffactory/pr_howitzer.png' },
      flammables                 : { name: 'Hazardous Materials Cert'   , description: 'OSHA-mandated training for handling flammable beverages.'                                               , iconImg: 'data/icon_imgs/caffactory/rocket_fuel_drink.png' },
      electricFurnaceTech        : { name: 'Vacuum Furnace'        , description: 'Unlocks the Vacuum Furnace.'                                                               , iconImg: 'data/icon_imgs/caffactory/electric_furnace.png' },
      militarySciencePack        : { name: 'Tactical Recipe Approval'   , description: 'Unlocks the Caff-Infinite Tactical recipe. Military-grade caffeine.'                                   , iconImg: 'data/icon_imgs/caffactory/caffactory_can_black.png' },
      stoneWallTech              : { name: 'Cubicle Construction'       , description: 'Unlocks the Cubicle Wall for perimeter defense.'                                                        , iconImg: 'data/icon_imgs/caffactory/cubicle_wall.png' },
      productionModuleTech1      : { name: 'Performance Review Mk1'     , description: 'Unlocks Performance Review modules. Output up, energy up, speed down. Standard.'                       , iconImg: 'data/icon_imgs/caffactory/perf_review_1.png' },
      productionModuleTech2      : { name: 'Quarterly Review Mk2'       , description: 'Bigger output bonus, bigger penalty.'                                                                   , iconImg: 'data/icon_imgs/caffactory/perf_review_2.png' },
      productionModuleTech3      : { name: 'Annual Review Mk3'          , description: 'Top-tier productivity pressure.'                                                                        , iconImg: 'data/icon_imgs/caffactory/perf_review_3.png' },
      speedModuleTech1           : { name: 'Espresso Shot Mk1'          , description: 'Unlocks Signal Shot modules. Faster output, higher energy draw.'                                        , iconImg: 'data/icon_imgs/caffactory/triple_shot_1.png' },
      speedModuleTech2           : { name: 'Double Shot Mk2'            , description: 'More speed, more burnout.'                                                                              , iconImg: 'data/icon_imgs/caffactory/triple_shot_2.png' },
      speedModuleTech3           : { name: 'Nuclear Espresso Mk3'       , description: 'Pure adrenaline in a shot. Absolutely no side effects.'                                                                             , iconImg: 'data/icon_imgs/caffactory/triple_shot_3.png' },
      beaconTech                 : { name: 'Office Aroma Diffuser'      , description: 'Unlocks the Aroma Diffuser — pumps module-scented mist that boosts nearby workstations.' },
      productionSciencePack      : { name: 'Overtime Approval'          , description: 'Unlocks the Caff-Infinite Overtime recipe. Overtime. Overtime now mandatory'                                                             , iconImg: 'data/icon_imgs/caffactory/caffactory_can_purple.png' },
      processingUnitTech         : { name: 'UM 300 Architecture'        , description: 'Unlocks the UM 300 — flagship Caff-Infinite chip, named after Urban Müller.'                            , iconImg: 'data/icon_imgs/caffactory/um_300.png' },
      automation3                : { name: 'Intern Onboarding 3'        , description: 'Unlocks the Senior Intern Pod. Hope still an illusion.'                                      , iconImg: 'data/icon_imgs/caffactory/intern_pod_3.png' },
      uraniumProcessing          : { name: 'Banned Substance Handling'  , description: 'OSHA-restricted ingredients now technically legal in three jurisdictions.'                                          , iconImg: 'data/icon_imgs/caffactory/banned_powder.png' },
      kovarexEnrichmentTech      : { name: 'Caffeine Concentration'     , description: 'Enriches Caffeine Crystals into Pure Caffeine Crystals.'                                               , iconImg: 'data/icon_imgs/caffactory/caffeine_crystal_pure.png' },
      atomicBombTech             : { name: 'Limited Edition Drop'       , description: 'Marketing event of the decade. Casualties expected. - Not in demo'                                                    , iconImg: 'data/icon_imgs/caffactory/atomic_drink.png' },
      flamethrowerTech           : { name: 'Industrial Coffee Roaster'  , description: 'Unlocks the Flamethrower Turret. Roasts beans AND OSHA inspectors.' },
      landMineTech               : { name: 'HR-Approved Bear Traps'     , description: 'Unlocks Land Mines for passive perimeter defense.' },
      uraniumAmmoTech            : { name: 'Radioactive Staplers'       , description: 'Unlocks the Radioactive Stapler Pack. Slightly glowing.'                                                , iconImg: 'data/icon_imgs/caffactory/stapler_uranium.png' },
      nuclearPowerTech           : { name: 'Inverse Data Center Operations'     , description: 'Unlocks the Inverse Data Center. Coming to a town near you!'                                                         , iconImg: 'data/icon_imgs/caffactory/data_center.png' },
      oilProcessingTech          : { name: 'Basic Beverage R&D'         , description: 'Refines Drink Syrup Concentrate into Carbonation.'                                                      , iconImg: 'data/icon_imgs/caffactory/beverage_plant.png' },
      lowDensityStructureTech    : { name: 'Carbon Composite Production', description: 'Unlocks Carbon Composite — corrugated cardboard panels (trees are carbon, you know) for rocket assembly.', iconImg: 'data/icon_imgs/caffactory/lds.png' },
      rocketFuelTech             : { name: 'Rocket Fuel Recipe'         , description: 'Unlocks the Rocket Fuel energy drink. For marketing department use only.'                              , iconImg: 'data/icon_imgs/caffactory/rocket_fuel_drink.png' },
      satelliteTech              : { name: 'Ad Network Satellite'       , description: 'Unlocks orbital ad placement.'                                                                          , iconImg: 'data/icon_imgs/caffactory/ad_satellite.png' },
      rainbowSciencePack         : { name: 'Rainbow Edition'        , description: "Unlocks the Caff-Infinite Rainbow recipe. We suport pride."            , iconImg: 'data/icon_imgs/caffactory/caffactory_can_rainbow.png' },
      utilitySciencePack         : { name: 'Happiness Recipe'           , description: 'Unlocks the Caff-Infinite Happiness recipe. Happiness now for only $4.99! daily'                                                            , iconImg: 'data/icon_imgs/caffactory/caffactory_can_yellow.png' },
      rocketSiloTech             : { name: 'Marketing Launchpad'        , description: 'Unlocks the Marketing Launchpad for orbital brand deployment.'                                         , iconImg: 'data/icon_imgs/caffactory/marketing_silo.png' },
      laserTech                  : { name: 'Presentation Tech'          , description: 'Unlocks Laser-based equipment and the Briefing Beam research line.'                                    , iconImg: 'data/icon_imgs/caffactory/briefing_beam.png' },
      laserTurretTech            : { name: 'Briefing Beam Turret'       , description: 'Unlocks the Briefing Beam — a laser pointer that means business.'                                      , iconImg: 'data/icon_imgs/caffactory/briefing_beam.png' },
      explosivesTech             : { name: 'Discontinued Drink Formulation', description: 'Unlocks Explosives. Side effect of a failed energy drink prototype.'                               , iconImg: 'data/icon_imgs/caffactory/discontinued_drink.png' },
      gamerModule                : { name: 'RGB Mechanical Keyboard'    , description: 'Unlocks the Gamer Module. Statistically significant performance boost.'                                , iconImg: 'data/icon_imgs/caffactory/qa_spinner.png' },
    },

    buildings: {
      // Building type → display name (and optional iconImg) in Caff-Infinite theme.
      // Upgraded buildings have no item cost so getBuildingItemKey returns null;
      // iconImg here is the fallback used by buildingCard and placement pickers.
      miner:          { name: 'The MINES' },
      electricMiner:  { name: 'MINES (safety optional)' },
      furnace:        { name: 'Blast Furnace' },
      steelFurnace:   { name: 'Pressure Forge',      iconImg: 'data/icon_imgs/caffactory/steel_furnace.png' },
      electricFurnace:{ name: 'Vacuum Furnace',      iconImg: 'data/icon_imgs/caffactory/electric_furnace.png' },
      assembly:       { name: 'Junior Intern Pod' },
      assembly2:      { name: 'Mid-Level Intern Pod', iconImg: 'data/icon_imgs/caffactory/intern_pod_2.png' },
      assembly3:      { name: 'Senior Intern Pod',   iconImg: 'data/icon_imgs/caffactory/intern_pod_3.png' },
      lab:           { name: 'Unpaid Intern' },
      boiler:        { name: 'Coffee Boiler' },
      steamEngine:   { name: 'Coffee Generator' },
      offshoreP:     { name: 'Water Cooler' },
      radar:         { name: 'Surveillance Tower' },
      solarPanel:    { name: 'Open-Plan Skylight' },
      accumulator:   { name: 'Power Bank' },
      oilRefinery:   { name: 'Beverage Plant' },
      chemicalPlant: { name: 'Flavor Lab' },
      centrifuge:    { name: 'QA Spinner' },
      rocketSilo:    { name: 'Marketing Launchpad' },
      pumpjack:      { name: 'Syrup Extractor' },
      nuclearReactor:{ name: 'Inverse Data Center' },
    },

    sprites: {},

  },
  // ── Factorio theme ────────────────────────────────────────────
  // Only entries that differ from what ITEMS / BUILDING_DEFS already has.

  classic: {
    items: {
      labItem: { name: 'Lab', icon: '🔬', img: null },
    },
    buildings: {
      lab: { name: 'Lab', icon: '🔬' },
    },
    techs: {
      // Override name, description, icon (emoji), and/or iconImg (image path) per tech:
      // automation: { name: 'Automation', description: 'Unlocks assembling machines.', iconImg: 'data/icon_imgs/factorio/assembler_machine_1.png' },
    },
    sprites: {},
  },

  // ── Caff-Infinite (caffactory) theme ─────────────────────────

};
