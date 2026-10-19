// All tuning numbers in one place. Start here when something feels off.
// World units: x runs across the lane, z runs from the cannon (0) towards
// the enemy base. The renderer maps z to -Z in three.js.

export const Cfg = {
  // Lane
  LANE_HALF: 4.6,          // lane is x in [-LANE_HALF, LANE_HALF]
  LANE_LEN: 44,            // z of the enemy base front
  CANNON_Z: 1.2,

  // Units
  UNIT_R: 0.27,
  UNIT_SPEED: 9.5,
  GIANT_R: 0.8,
  GIANT_SPEED: 4.2,
  MAX_BLUE: 420,           // past this, clones pour hp into their parent
  MAX_RED: 300,

  // Cannon
  CANNON_SPEED: 24,        // how fast the cannon follows the finger, x/s
  FIRE_INTERVAL: 0.24,     // seconds between volleys at upgrade 0
  FIRE_INTERVAL_MULT: 0.9, // per fire-rate upgrade
  FIRE_INTERVAL_MIN: 0.07,
  MULTISHOT_SPREAD: 0.55,

  // Giant
  GIANT_CHARGE: 45,        // volleys needed at upgrade 0
  GIANT_CHARGE_PER_UPG: 4,
  GIANT_CHARGE_MIN: 12,
  GIANT_HP: 20,
  GIANT_HP_PER_UPG: 12,
  GIANT_GATE_SPAWN: 3,     // small units per gate multiplier step

  // Enemies
  RED_SPEED: 3.4,
  RED_SPEED_PER_LEVEL: 0.05,
  RED_RATE: 1.3,           // enemies per second at level 1
  RED_RATE_PER_LEVEL: 0.55,
  RED_RAMP: 0.012,         // extra rate per second survived (fraction of base rate)
  RED_PANIC: 0.8,          // rate multiplier added as base hp goes to 0
  RED_HP_EVERY: 4,         // every N levels, regular enemies gain +1 hp
  BRUTE_FIRST_LEVEL: 3,
  BRUTE_HP: 10,
  BRUTE_HP_PER_LEVEL: 3,
  BRUTE_INTERVAL: 11,      // seconds between brutes

  // Bases
  BASE_HP: 110,
  BASE_HP_GROWTH: 1.36,
  CASTLE_HP: 10,           // player base; each upgrade adds CASTLE_HP_PER_UPG
  CASTLE_HP_PER_UPG: 5,

  // Economy
  COIN_PER_KILL: 0.5,
  BRUTE_COINS: 8,          // kill value of a brute, in regular kills
  WIN_REWARD: 40,
  WIN_REWARD_PER_LEVEL: 18,
  LOSS_FRACTION: 0.5,      // share of the win reward paid on a loss, scaled by base damage

  // Gates
  GATE_ZONE_START: 8,
  GATE_ZONE_END: 32,
  GATE_HEIGHT: 2.3,
};
