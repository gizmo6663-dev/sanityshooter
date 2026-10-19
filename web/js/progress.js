// Everything that survives between rounds.
//  - Meta: gems and permanent workshop upgrades, kept forever.
//  - Run:  the current run (level, coins, items, castle hp), lost when the
//          castle falls.
// Saved to localStorage after every round and every purchase.

import { Cfg } from './config.js';
import { ITEMS, ITEM_IDS } from './items.js';

const SAVE_KEY = 'mobblaster.save.v2';

// Permanent upgrades bought with gems. cost = cost * growth ^ level.
export const UPGRADES = {
  fire_rate:    { name: 'Skuddtakt',    desc: 'Kanonen skyter raskere',       icon: '⚡', cost: 4,  growth: 1.5, max: 10 },
  unit_hp:      { name: 'Mobstyrke',    desc: '+1 liv per mob',               icon: '💪', cost: 14, growth: 2.2, max: 4 },
  multishot:    { name: 'Ekstra løp',   desc: '+1 mob per salve',             icon: '🔱', cost: 30, growth: 3,   max: 2 },
  giant_hp:     { name: 'Kjempekraft',  desc: 'Sterkere kjemper',             icon: '🦍', cost: 4,  growth: 1.5, max: 10 },
  giant_charge: { name: 'Kjempelading', desc: 'Kjempen lades raskere',        icon: '🔋', cost: 5,  growth: 1.6, max: 6 },
  castle:       { name: 'Borgmur',      desc: '+4 liv til borgen',            icon: '🏰', cost: 5,  growth: 1.5, max: 10 },
  income:       { name: 'Gullinntekt',  desc: '+15 % mynter',                 icon: '🪙', cost: 6,  growth: 1.6, max: 8 },
  gate_bonus:   { name: 'Portmagi',     desc: '+1 på alle ×-porter',          icon: '✨', cost: 45, growth: 3,   max: 2 },
  choices:      { name: 'Flere valg',   desc: '+1 gjenstand å velge mellom',  icon: '🃏', cost: 25, growth: 3,   max: 1 },
  start_item:   { name: 'Startgave',    desc: 'Start hver runde med en gjenstand', icon: '🎁', cost: 18, growth: 2.5, max: 2 },
};
export const ORDER = Object.keys(UPGRADES);

export class Progress {
  constructor() {
    this.gems = 0;
    this.bestLevel = 0;
    this.runs = 0;
    this.upg = {};
    this.autosave = true;
    for (const id of ORDER) this.upg[id] = 0;
    this.run = null;
  }

  // --- Workshop -----------------------------------------------------------
  lvl(id) { return this.upg[id] | 0; }
  isMaxed(id) { return this.lvl(id) >= UPGRADES[id].max; }
  cost(id) {
    const d = UPGRADES[id];
    return Math.round(d.cost * Math.pow(d.growth, this.lvl(id)));
  }
  canBuy(id) { return !this.isMaxed(id) && this.gems >= this.cost(id); }
  buy(id) {
    if (!this.canBuy(id)) return false;
    this.gems -= this.cost(id);
    this.upg[id] = this.lvl(id) + 1;
    this.save();
    return true;
  }

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
  coinMult() { return 1 + 0.15 * this.lvl('income'); }
  gateBonus() { return this.lvl('gate_bonus'); }
  choiceCount() { return 3 + this.lvl('choices'); }

  statText(id) {
    switch (id) {
      case 'fire_rate': return `${(1 / this.fireInterval()).toFixed(1)}/s`;
      case 'unit_hp': return `${this.unitHp()} liv`;
      case 'multishot': return `${this.shotsPerVolley()} per salve`;
      case 'giant_hp': return `${this.giantHp()} liv`;
      case 'giant_charge': return `${this.giantCharge()} salver`;
      case 'castle': return `${this.castleHp()} liv`;
      case 'income': return `×${this.coinMult().toFixed(2)}`;
      case 'gate_bonus': return `+${this.gateBonus()}`;
      case 'choices': return `${this.choiceCount()} valg`;
      case 'start_item': return `${this.lvl('start_item')} gjenstand(er)`;
    }
    return '';
  }

  // --- Runs ---------------------------------------------------------------
  startRun(rand = Math.random) {
    this.runs++;
    this.run = {
      level: 1, coins: 0, items: [], castleHp: this.castleHp(),
      kills: 0, bosses: 0, rerolls: 0, stock: null, choices: null,
    };
    for (let i = 0; i < this.lvl('start_item'); i++) {
      const pool = ITEM_IDS.filter((id) => ITEMS[id].rarity === 1 && !this.run.items.includes(id));
      this.run.items.push(pool[Math.floor(rand() * pool.length)]);
    }
    this.save();
  }

  /** Gems paid out when a run ends. */
  runGems(run = this.run) {
    const cleared = run.level - 1;
    return cleared * 2 + run.bosses * 6 + Math.min(15, Math.floor(run.kills / 400));
  }

  endRun() {
    const g = this.runGems();
    this.gems += g;
    this.bestLevel = Math.max(this.bestLevel, this.run.level);
    this.run = null;
    this.save();
    return g;
  }

  // --- Persistence -------------------------------------------------------
  save() {
    if (!this.autosave) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        gems: this.gems, bestLevel: this.bestLevel, runs: this.runs, upg: this.upg, run: this.run,
      }));
    } catch (e) { /* storage unavailable: progress lives for this session only */ }
  }

  load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { data = null; }
    if (!data) return;
    this.gems = Math.max(0, data.gems | 0);
    this.bestLevel = Math.max(0, data.bestLevel | 0);
    this.runs = data.runs | 0;
    for (const id of ORDER) {
      this.upg[id] = Math.min(UPGRADES[id].max, Math.max(0, (data.upg && data.upg[id]) | 0));
    }
    const r = data.run;
    if (r && r.level >= 1 && Array.isArray(r.items)) {
      r.items = r.items.filter((id) => ITEMS[id]);
      this.run = r;
    }
  }
}
