'use strict';

// Data integrity validator.
// Checks all string cross-references in the data layer at startup.
// Logs errors (broken references that could cause silent bugs) and
// warnings (stale/orphaned references that are probably harmless).
// Does NOT throw — the game still loads even if there are issues.

(function validateGameData() {
  const errors = [];
  const warns  = [];

  const allRecipes    = { ...PLAYER_RECIPES, ...FURNACE_RECIPES };
  const recipeKeys    = new Set(Object.keys(allRecipes));
  const itemKeys      = new Set(Object.keys(ITEMS));
  const techKeys      = new Set(Object.keys(TECHNOLOGIES));
  const buildingKeys  = new Set(Object.keys(BUILDING_DEFS));

  // ── TECHNOLOGIES ────────────────────────────────────────────────

  for (const [id, tech] of Object.entries(TECHNOLOGIES)) {
    for (const key of tech.unlockRecipes) {
      if (!recipeKeys.has(key)) {
        errors.push(`TECHNOLOGIES.${id}.unlockRecipes: '${key}' is not in PLAYER_RECIPES or FURNACE_RECIPES`);
      }
    }

    for (const key of tech.unlockBuildings) {
      if (!buildingKeys.has(key)) {
        errors.push(`TECHNOLOGIES.${id}.unlockBuildings: '${key}' is not in BUILDING_DEFS`);
      }
    }

    for (const key of tech.prereqs) {
      if (!techKeys.has(key)) {
        errors.push(`TECHNOLOGIES.${id}.prereqs: '${key}' is not in TECHNOLOGIES`);
      }
    }

    for (const key of Object.keys(tech.cost)) {
      if (!itemKeys.has(key)) {
        errors.push(`TECHNOLOGIES.${id}.cost: science pack '${key}' is not in ITEMS`);
      }
    }

    if (tech.upgradeBuildings) {
      for (const [from, to] of Object.entries(tech.upgradeBuildings)) {
        if (!buildingKeys.has(from)) {
          errors.push(`TECHNOLOGIES.${id}.upgradeBuildings: from-key '${from}' is not in BUILDING_DEFS`);
        }
        if (!buildingKeys.has(to)) {
          errors.push(`TECHNOLOGIES.${id}.upgradeBuildings: to-key '${to}' is not in BUILDING_DEFS`);
        }
      }
    }
  }

  // ── RECIPES ─────────────────────────────────────────────────────

  for (const [id, recipe] of Object.entries(allRecipes)) {
    for (const key of Object.keys(recipe.inputs ?? {})) {
      if (!itemKeys.has(key)) {
        errors.push(`RECIPE '${id}' input '${key}' is not in ITEMS`);
      }
    }
    for (const key of Object.keys(recipe.outputs ?? {})) {
      if (!itemKeys.has(key)) {
        errors.push(`RECIPE '${id}' output '${key}' is not in ITEMS`);
      }
    }
  }

  // ── CRAFT_SECTIONS ───────────────────────────────────────────────

  for (const section of CRAFT_SECTIONS) {
    for (const key of section.keys) {
      if (!recipeKeys.has(key)) {
        warns.push(`CRAFT_SECTIONS['${section.label}']: '${key}' is not in PLAYER_RECIPES or FURNACE_RECIPES`);
      }
    }
  }

  // ── THEMES ──────────────────────────────────────────────────────

  for (const [themeName, theme] of Object.entries(THEMES)) {
    for (const key of Object.keys(theme.items ?? {})) {
      if (!itemKeys.has(key)) {
        warns.push(`THEMES.${themeName}.items: '${key}' is not in ITEMS`);
      }
    }
    for (const key of Object.keys(theme.techs ?? {})) {
      if (!techKeys.has(key)) {
        warns.push(`THEMES.${themeName}.techs: '${key}' is not in TECHNOLOGIES`);
      }
    }
    for (const key of Object.keys(theme.buildings ?? {})) {
      if (!buildingKeys.has(key)) {
        warns.push(`THEMES.${themeName}.buildings: '${key}' is not in BUILDING_DEFS`);
      }
    }
  }

  // ── Report ───────────────────────────────────────────────────────

  if (errors.length === 0 && warns.length === 0) return;

  console.group(`[DATA VALIDATION] ${errors.length} error(s), ${warns.length} warning(s)`);
  for (const e of errors) console.error('  ❌ ' + e);
  for (const w of warns)  console.warn ('  ⚠️  ' + w);
  console.groupEnd();
}());
