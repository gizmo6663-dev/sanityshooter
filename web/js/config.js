// All tuning numbers in one place. Start here when something feels off.
// World units: x runs left-right, z runs "up" the screen (north). The
// renderer draws z upwards on screen. Rooms are taller than wide so they fit
// a phone held upright.

export const Cfg = {
  // Rooms (interior size in tiles of 1x1 units)
  ROOM_W: 9,
  ROOM_D: 13,
  ROOM_STRIDE_X: 11,       // distance between room centres on the floor grid
  ROOM_STRIDE_Z: 15,
  DOOR_HALF: 0.75,         // half width of a doorway
  GRID: 9,                 // floor map is GRID x GRID cells
  FLOORS: 4,               // beating the 4th floor's boss wins the run
  ROOMS_BASE: 9,           // rooms per floor = ROOMS_BASE + ROOMS_PER_FLOOR * floor
  ROOMS_PER_FLOOR: 2,
  TRANSITION: 0.4,         // seconds the camera spends panning between rooms

  // Player
  PLAYER_R: 0.32,
  PLAYER_SPEED: 4.0,
  PLAYER_HP: 6,            // half hearts (3 full hearts)
  MAX_HP_CAP: 24,
  DAMAGE: 3.5,
  FIRE_RATE: 2.4,          // shots per second
  RANGE: 6.5,              // shot travel distance
  SHOT_SPEED: 8.5,
  SHOT_R: 0.14,
  IFRAMES: 1.0,
  DASH_SPEED: 13,
  DASH_TIME: 0.17,
  DASH_COOLDOWN: 1.1,
  MAGNET: 1.6,             // xp/coin pickup radius

  // Experience (Survivors-style level ups)
  XP_FIRST: 6,
  XP_GROWTH: 1.35,

  // Enemies scale with the floor
  ENEMY_HP_PER_FLOOR: 0.35,   // +35 % hp per floor
  ROOM_BUDGET: 5,             // enemy "points" per room on floor 1
  ROOM_BUDGET_PER_FLOOR: 2.5,
  SPAWN_DELAY: 0.7,           // enemies appear this long after you enter
  CONTACT_DMG: 1,             // half hearts

  // Drops
  HEART_DROP: 0.26,        // chance a cleared room drops a heart
  COIN_DROP: 0.45,         // chance a cleared room drops coins
  ENEMY_COIN: 0.06,        // chance per kill

  // Shop
  ITEM_PRICE: 15,
  HEART_PRICE: 3,
};
