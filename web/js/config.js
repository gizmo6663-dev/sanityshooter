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
  ROOMS_BASE: 11,          // rooms per floor = ROOMS_BASE + ROOMS_PER_FLOOR * floor
  ROOMS_PER_FLOOR: 2,
  TRANSITION: 0.28,        // seconds the camera spends panning between rooms

  // Player
  PLAYER_R: 0.32,
  PLAYER_SPEED: 5.4,
  PLAYER_ACCEL: 26,        // how fast you reach full speed (higher = snappier)
  PLAYER_HP: 6,            // half hearts (3 full hearts)
  MAX_HP_CAP: 24,
  DAMAGE: 3.5,
  FIRE_RATE: 2.8,          // shots per second
  RANGE: 6.5,              // shot travel distance
  SHOT_SPEED: 11,
  SHOT_R: 0.14,
  IFRAMES: 0.9,
  DASH_SPEED: 16,
  DASH_TIME: 0.15,
  DASH_COOLDOWN: 0.9,
  MAGNET: 1.6,             // coin pickup radius

  // Enemies scale with the floor
  ENEMY_HP_PER_FLOOR: 0.3,    // +30 % hp per floor
  ROOM_BUDGET: 5,             // enemy "points" per room on floor 1
  ROOM_BUDGET_PER_FLOOR: 2.5,
  SPAWN_DELAY: 0.5,           // enemies appear this long after you enter
  CONTACT_DMG: 1,             // half hearts
  ENEMY_PACE: 1.25,            // enemies (movement, attacks, shots) run this much faster than their base numbers

  // Drops
  HEART_DROP: 0.26,        // chance a cleared room drops a heart
  COIN_DROP: 0.45,         // chance a cleared room drops coins
  ENEMY_COIN: 0.06,        // chance per kill

  // Shop
  ITEM_PRICE: 15,
  HEART_PRICE: 3,
};
