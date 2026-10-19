// Everything that survives between rounds: level, coins and upgrades.
// Saved to localStorage after every round and every purchase.

import { Cfg } from './config.js';

const SAVE_KEY = 'mobblaster.save.v1';

// "max" is the highest buyable level; cost = cost * growth ^ level.
export const UPGRADES = {
  fire_rate:    { name: 'Skuddtakt',    desc: 'Kanonen skyter raskere',  icon: '⚡', cost: 25,  growth: 1.42, max: 18 },
  unit_hp:      { name: 'Mobstyrke',    desc: '+1 liv per mob',          icon: '💪', cost: 150, growth: 1.75, max: 30 },
  multishot:    { name: 'Ekstra løp',   desc: '+1 mob per skudd',        icon: '🔱', cost: 300, growth: 3.2,  max: 3 },
  giant_hp:     { name: 'Kjempekraft',  desc: 'Sterkere kjemper',        icon: '🦍', cost: 50,  growth: 1.4,  max: 40 },
  giant_charge: { name: 'Kjempelading', desc: 'Kjempen lades raskere',   icon: '🔋', cost: 45,  growth: 1.55, max: 8 },
  castle:       { name: 'Borgmur',      desc: 'Tåler flere fiender',     icon: '🏰', cost: 35,  growth: 1.4,  max: 30 },
  income:       { name: 'Gullinntekt',  desc: '+20 % mynter',            icon: '🪙', cost: 70,  growth: 1.6,  max: 20 },
  gate_bonus:   { name: 'Portmagi',     desc: '+1 på alle ×-porter',     icon: '✨', cost: 500, growth: 3.2,  max: 5 },
};
export const ORDER = Object.keys(UPGRADES);

export class Progress {
  constructor() {
    this.level = 1;
    this.coins = 0;
    this.bestLevel = 1;
    this.upg = {};
    this.autosave = true;
    for (const id of ORDER) this.upg[id] = 0;
  }

  lvl(id) { return this.upg[id] | 0; }
  isMaxed(id) { return this.lvl(id) >= UPGRADES[id].max; }
  cost(id) {
    const d = UPGRADES[id];
    return Math.round(d.cost * Math.pow(d.growth, this.lvl(id)));
  }
  canBuy(id) { return !this.isMaxed(id) && this.coins >= this.cost(id); }

  buy(id) {
    if (!this.canBuy(id)) return false;
    this.coins -= this.cost(id);
    this.upg[id] = this.lvl(id) + 1;
    if (this.autosave) this.save();
    return true;
  }

  // --- Derived stats used by the world ----------------------------------
  fireInterval() {
    return Math.max(Cfg.FIRE_INTERVAL_MIN,
      Cfg.FIRE_INTERVAL * Math.pow(Cfg.FIRE_INTERVAL_MULT, this.lvl('fire_rate')));
  }
  unitHp() { return 1 + this.lvl('unit_hp'); }
  shotsPerVolley() { return 1 + this.lvl('multishot'); }
  giantHp() { return Cfg.GIANT_HP + Cfg.GIANT_HP_PER_UPG * this.lvl('giant_hp'); }
  giantCharge() {
    return Math.max(Cfg.GIANT_CHARGE_MIN,
      Cfg.GIANT_CHARGE - Cfg.GIANT_CHARGE_PER_UPG * this.lvl('giant_charge'));
  }
  castleHp() { return Cfg.CASTLE_HP + Cfg.CASTLE_HP_PER_UPG * this.lvl('castle'); }
  coinMult() { return 1 + 0.2 * this.lvl('income'); }
  gateBonus() { return this.lvl('gate_bonus'); }

  statText(id) {
    switch (id) {
      case 'fire_rate': return `${(1 / this.fireInterval()).toFixed(1)}/s`;
      case 'unit_hp': return `${this.unitHp()} liv`;
      case 'multishot': return `${this.shotsPerVolley()} per skudd`;
      case 'giant_hp': return `${this.giantHp()} liv`;
      case 'giant_charge': return `${this.giantCharge()} skudd`;
      case 'castle': return `${this.castleHp()} liv`;
      case 'income': return `×${this.coinMult().toFixed(1)}`;
      case 'gate_bonus': return `+${this.gateBonus()}`;
    }
    return '';
  }

  // --- Persistence -------------------------------------------------------
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        level: this.level, coins: this.coins, bestLevel: this.bestLevel, upg: this.upg,
      }));
    } catch (e) { /* storage unavailable: progress lives for this session only */ }
  }

  load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { data = null; }
    if (!data) return;
    this.level = Math.max(1, data.level | 0);
    this.coins = Math.max(0, data.coins | 0);
    this.bestLevel = Math.max(this.level, data.bestLevel | 0);
    for (const id of ORDER) {
      this.upg[id] = Math.min(UPGRADES[id].max, Math.max(0, (data.upg && data.upg[id]) | 0));
    }
  }
}
