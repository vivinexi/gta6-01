// Solmar Heat — every tuning number and colour in one place.
// The city is a grid of blocks separated by roads; the beach and the sea
// sit along the south edge (+z). All units are metres, all speeds m/s.
export const STEP = 1 / 60;

export const CITY = {
  pitch: 74, // block (60) + road (14)
  halfBlocks: 3, // roads at k*pitch for k in -3..3
  block: 60,
  road: 14,
  beachZ: 3 * 74 + 7, // where the sand starts
  seaZ: 3 * 74 + 42, // where the water starts
  bounds: 3 * 74 + 14, // playable edge, all sides
};

export const PLAYER = {
  radius: 0.55,
  walkSpeed: 5.2,
  runSpeed: 9.0,
  accel: 40,
  jumpSpeed: 8.5,
  gravity: 22,
  maxHealth: 100,
};

export const CAR = {
  length: 4.6,
  width: 2.0,
  maxSpeed: 38, // ~137 km/h
  reverseSpeed: 12,
  accel: 16,
  brake: 30,
  steer: 1.9, // rad/s at full lock, scaled down with speed
  maxHealth: 100,
  enterDistance: 4.5,
};

export const TRAFFIC = { count: 14, speedMin: 8, speedMax: 13 };
export const PEDESTRIANS = { count: 26, walkSpeed: 1.4, runSpeed: 5.5 };

export const WANTED = {
  maxStars: 5,
  decayDelay: 18, // seconds without a crime before stars start to fall
  decayInterval: 9, // seconds per star lost while hidden
  hideDistance: 55, // police must be farther than this to count as hidden
  bustedHold: 2.0, // seconds a police car must touch the player on foot
};

export const POLICE = {
  maxSpeed: 41,
  accel: 20,
  ramDamage: 14,
  ramCooldown: 1.2,
};

export const MISSIONS = [
  {
    id: 'hot-wheels',
    title: '1 — Hot Wheels',
    reward: 400,
    briefing:
      'Rico: Joey, listen. The Vultures took my ride. Take ANY car on the street — I do not care whose — and bring it to the docks marker. Make it quick.',
  },
  {
    id: 'the-package',
    title: '2 — The Package',
    reward: 600,
    briefing:
      'Rico: Good. Now walk to the blue crate by the marina and pick up the package. Then drive it to the tower on the north side. No peeking inside.',
  },
  {
    id: 'heat-check',
    title: '3 — Heat Check',
    reward: 800,
    briefing:
      'Rico: The Vultures ratted you out — you have got 2 stars and their boys are coming. Lose the heat. If they shoot, shoot back. Stay alive.',
  },
  {
    id: 'sunset-run',
    title: '4 — Sunset Run',
    reward: 1500,
    briefing:
      'Rico: Last one. The package goes to three drops before the sun is gone — 90 seconds, in a car. Do it and we are square, kid. Solmar is yours.',
  },
];

export const PALETTE = {
  skyTop: 0x2e6fb0,
  skyBottom: 0xffb36b,
  sun: 0xffd9a0,
  fog: 0xf7a56b,
  sea: 0x1d7fa8,
  sand: 0xe8c98a,
  asphalt: 0x2f3338,
  sidewalk: 0x9a9a92,
  line: 0xf2d13c,
  building: [0xcf8f6a, 0x8fa3b8, 0xd9c08a, 0x7fa08a, 0xb87a8a, 0x6a7a9a],
  windowLit: 0xffd27a,
  windowDark: 0x2c3e50,
  palm: 0x2f7a3d,
  trunk: 0x7a5a38,
  playerShirt: 0x2e86de,
  playerPants: 0x22252a,
  playerSkin: 0xd9a066,
  police: 0x1a1d22,
  policeLight: 0x2244ff,
  enemy: 0x8a2f2f,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save is kept between visits (this browser only). */
export const SAVE_KEY = 'solmar-heat.save.v1';
