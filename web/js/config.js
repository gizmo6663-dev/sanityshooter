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
  MAX_BLUE: 340,           // hard cap on player mobs (Legion raises it)
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
  RED_RATE: 0.8,           // enemies per second at level 1
  RED_RATE_PER_LEVEL: 0.22, // fraction of RED_RATE added per level
  RED_RAMP: 0.01,         // extra rate per second survived (fraction of base rate)
  RED_HOMING: 0.22,        // how strongly enemies steer towards the cannon
  RED_PANIC: 0.8,          // rate multiplier added as base hp goes to 0
  RED_HP_GROWTH: 1.11,     // enemy hp multiplier per level
  ENRAGE_TIME: 70,         // after this many seconds the enemy rate doubles...
  ENRAGE_DOUBLE: 25,       // ...every this many seconds
  BRUTE_FIRST_LEVEL: 3,
  BRUTE_HP: 12,
  BRUTE_INTERVAL: 11,      // seconds between brutes

  // Bases
  BASE_HP: 500,
  BASE_EARLY_GROWTH: 1.5,  // per level for the first BASE_EARLY_LEVELS level-ups...
  BASE_EARLY_LEVELS: 9,
  BASE_HP_GROWTH: 1.17,    // ...and per level after that
  CASTLE_HP: 15,           // player base; each upgrade adds CASTLE_HP_PER_UPG
  CASTLE_HP_PER_UPG: 4,

  // Economy
  COIN_PER_KILL: 0.2,
  BRUTE_COINS: 8,          // kill value of a brute, in regular kills
  WIN_REWARD: 30,
  WIN_REWARD_PER_LEVEL: 6,

  // Enemy variety (first level each type shows up)
  RUNNER_LEVEL: 3,
  SHIELD_LEVEL: 5,
  SHIELD_ARMOR: 4,         // armor soaks damage before hp; grows with level
  BOMBER_LEVEL: 7,         // bombers kill nearby blue mobs when they die
  BOSS_HP: 260,            // boss on every 5th level
  BOSS_HP_GROWTH: 1.9,     // per boss
  BOSS_R: 1.2,
  BOSS_WALL_DMG: 10,
  BOSS_COINS: 60,

  // Catapult on the enemy base, aimed at the cannon
  ROCK_LEVEL: 3,
  ROCK_FIRST: 8,
  ROCK_INTERVAL: 9,
  ROCK_MIN: 4,
  ROCK_FLIGHT: 1.7,
  ROCK_RADIUS: 1.3,

  // Wall items
  TURRET_INTERVAL: 0.7,
  TURRET_RANGE: 26,
  TURRET_DMG: 2,
  FROST_WALL_Z: 9,
  MAX_CLOUDS: 40,

  // Gates
  TRAP_LEVEL: 4,           // red ÷2 gates from this level
  GATE_ZONE_START: 8,
  GATE_ZONE_END: 32,
  GATE_HEIGHT: 2.3,
};
