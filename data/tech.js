'use strict';

class Technology {
  constructor({ name, icon, iconImg, cost, timePerPack, prereqs, description, unlockRecipes, unlockBuildings, upgradeBuildings }) {
    this.name             = name;
    this.icon             = icon ?? '⚙️';
    this.iconImg          = iconImg ?? null;
    this.cost             = cost ?? {};
    this.timePerPack      = timePerPack ?? 10;
    this.prereqs          = prereqs ?? [];
    this.description      = description ?? '';
    this.unlockRecipes    = unlockRecipes ?? [];
    this.unlockBuildings  = unlockBuildings ?? [];
    this.upgradeBuildings = upgradeBuildings ?? null;
  }

  // Max packs needed across all science pack requirements
  totalPacks() {
    const vals = Object.values(this.cost);
    return vals.length ? Math.max(...vals) : 0;
  }

  // True if all prereqs appear in the done map
  canResearch(done) {
    return this.prereqs.every(p => done[p]);
  }

  // Icon HTML — image if iconImg present, otherwise emoji span
  iconHtml() {
    if (this.iconImg) return `<img class="item-icon tech-icon-img" src="${this.iconImg}" alt="${this.name}">`;
    return `<span>${this.icon}</span>`;
  }
}

class InfiniteTech extends Technology {
  constructor({ displayName, stateField, prereq, getData, icon }) {
    super({
      name:            displayName,
      icon:            icon ?? '♾️',
      prereqs:         prereq ? [prereq] : [],
      cost:            {},
      timePerPack:     0,
      description:     '',
      unlockRecipes:   [],
      unlockBuildings: [],
    });
    this.displayName = displayName;
    this.stateField  = stateField;
    this.prereq      = prereq ?? null;
    this.getData     = getData;
  }

  // Current researched level from researchState
  getLevel(researchState) {
    return researchState[this.stateField] ?? 0;
  }

  // Cost/time data for the next level to be researched
  getNextData(researchState) {
    return this.getData(this.getLevel(researchState) + 1);
  }

  // Prereq check: single string rather than array
  canResearch(done) {
    return !this.prereq || !!done[this.prereq];
  }
}
