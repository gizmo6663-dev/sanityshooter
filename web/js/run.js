// What happens between rounds of a run: the item pick, the shop and the
// bookkeeping after a win. Shared by the game (main.js) and the balance bot.

import { ITEMS, ITEM_IDS } from './items.js';
import { buildMods } from './items.js';

const RARITY_WEIGHT = { 1: 60, 2: 30, 3: 7 };
const RARITY_PRICE = { 1: 55, 2: 110, 3: 200 };

export function rollItems(run, count, rand = Math.random, minRarity = 1, exclude = []) {
  const pool = ITEM_IDS.filter((id) => !run.items.includes(id) && !exclude.includes(id) && ITEMS[id].rarity >= minRarity);
  const out = [];
  while (out.length < count && pool.length) {
    let total = 0;
    for (const id of pool) total += RARITY_WEIGHT[ITEMS[id].rarity];
    let r = rand() * total;
    let k = 0;
    for (; k < pool.length - 1; k++) {
      r -= RARITY_WEIGHT[ITEMS[pool[k]].rarity];
      if (r <= 0) break;
    }
    out.push(pool[k]);
    pool.splice(k, 1);
  }
  return out;
}

export function itemPrice(id, level) {
  return Math.round(RARITY_PRICE[ITEMS[id].rarity] * (1 + 0.1 * (level - 1)));
}

export function rerollPrice(run) { return 10 + 6 * run.rerolls; }
export function healPrice(run) { return 20 + 3 * run.level; }
export const HEAL_AMOUNT = 4;

/** Updates the run after a won round and prepares the next pick + shop. */
export function afterWin(meta, run, world, rand = Math.random) {
  const mods = buildMods(meta, run.items);
  run.coins += world.reward;
  const interest = Math.min(60, Math.floor(run.coins * mods.interest));
  run.coins += interest;
  run.kills += world.kills;
  if (world.boss) run.bosses++;
  run.castleHp = Math.min(meta.castleHp(), world.castleHp + 2);
  run.level++;
  run.rerolls = 0;
  run.choices = rollItems(run, meta.choiceCount(), rand, world.boss ? 2 : 1);
  run.stock = rollItems(run, 3, rand, 1, run.choices);
  meta.save();
  return { interest };
}

export function pickItem(meta, run, id) {
  if (!run.choices || !run.choices.includes(id)) return false;
  run.items.push(id);
  run.choices = null;
  run.stock = (run.stock || []).filter((s) => s !== id);
  meta.save();
  return true;
}

export function buyItem(meta, run, id) {
  const price = itemPrice(id, run.level);
  if (!run.stock || !run.stock.includes(id) || run.coins < price) return false;
  run.coins -= price;
  run.items.push(id);
  run.stock = run.stock.filter((s) => s !== id);
  meta.save();
  return true;
}

export function reroll(meta, run, rand = Math.random) {
  const price = rerollPrice(run);
  if (run.coins < price) return false;
  run.coins -= price;
  run.rerolls++;
  run.stock = rollItems(run, 3, rand);
  meta.save();
  return true;
}

export function heal(meta, run) {
  const price = healPrice(run);
  if (run.coins < price || run.castleHp >= meta.castleHp()) return false;
  run.coins -= price;
  run.castleHp = Math.min(meta.castleHp(), run.castleHp + HEAL_AMOUNT);
  meta.save();
  return true;
}
