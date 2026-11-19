// Neon Harbor — every tuning number, colour and story beat in one place.
// Port Vela is a sunset port city: a street grid downtown, docks to the north,
// a beach and the sea to the east, a marina and a lighthouse to the south.

export const GAME_TITLE = 'Neon Harbor';
export const CITY_NAME = 'Port Vela';
export const SAVE_KEY = 'neon-harbor.save.v1';

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Half the playable square, in metres. Streets run on a 60 m grid inside it. */
export const CITY_HALF = 240;
export const STREET_SPACING = 60;
export const ROAD_WIDTH = 14;
/** Street centrelines, west to east and north to south. */
export const STREETS = [-180, -120, -60, 0, 60, 120, 180];

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  jumpSpeed: 8.5,
  gravity: 24,
  radius: 0.6,
  height: 1.8,
  health: 100,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 10,
  maxSpeed: 42,
  maxReverse: 12,
  steer: 0.55,
  grip: 6,
  radius: 1.6,
  health: 100,
};

export const WANTED = {
  max: 5,
  /** Seconds with no police line of sight before one star fades. */
  decayAfter: 12,
  decayEvery: 8,
  /** How many police cars each star level fields. */
  carsForStars: [0, 1, 2, 3, 4, 5],
};

export const POLICE = {
  speed: 34,
  ramDamage: 4,
  /** Seconds a police car must stay touching the player on foot to bust them. */
  bustTime: 2.5,
  bustFine: 100,
};

export const COMBAT = {
  pistolDamage: 34,
  pistolRange: 70,
  pistolCooldown: 0.28,
  punchDamage: 20,
  punchRange: 2.2,
  punchCooldown: 0.45,
  rivalHealth: 70,
  rivalShotDamage: 7,
  rivalShotCooldown: 1.4,
  rivalRange: 45,
};

export const MISSIONS = [
  {
    id: 0,
    name: 'Hot Wheels',
    payout: 400,
    briefing:
      'Otto: "Maya, the docks. A canary-yellow sedan, keys in it, owner in a meeting. Bring it to my garage — and try not to wake the whole harbour."',
    steps: [
      { kind: 'reach', label: 'Reach the yellow sedan at the docks', target: [-150, -205] },
      { kind: 'enterCar', label: 'Steal the sedan (press E)', target: [-150, -205] },
      { kind: 'driveTo', label: 'Deliver the sedan to Otto’s garage', target: [60, 175] },
    ],
  },
  {
    id: 1,
    name: 'Harbour Lights',
    payout: 600,
    briefing:
      'Otto: "A package is waiting on the marina pier. Pick it up, drop it at the lighthouse. The Breakers are sniffing around the marina — keep your pistol handy."',
    steps: [
      { kind: 'reach', label: 'Pick up the package at the marina pier', target: [205, 60] },
      { kind: 'driveTo', label: 'Deliver the package to the lighthouse', target: [0, 222] },
    ],
  },
  {
    id: 2,
    name: 'Heat Wave',
    payout: 800,
    briefing:
      'Otto: "Rook’s Breakers are coming for you. Make some noise — two stars at least — then vanish. Lose every star and the heat is off."',
    steps: [
      { kind: 'wanted', label: 'Raise your wanted level to 2 stars', wanted: 2 },
      { kind: 'clearWanted', label: 'Lose all wanted stars — stay out of sight', wanted: 0 },
    ],
  },
  {
    id: 3,
    name: 'Midnight Run',
    payout: 1500,
    briefing:
      'Otto: "One last job. Five checkpoints, ninety seconds, the whole of Port Vela. Rook is betting you can’t do it. Prove him wrong."',
    timeLimit: 90,
    steps: [
      { kind: 'driveTo', label: 'Checkpoint 1/5 — the docks gate', target: [-150, -180] },
      { kind: 'driveTo', label: 'Checkpoint 2/5 — downtown plaza', target: [0, 0] },
      { kind: 'driveTo', label: 'Checkpoint 3/5 — the marina', target: [205, 60] },
      { kind: 'driveTo', label: 'Checkpoint 4/5 — the beach road', target: [215, -120] },
      { kind: 'driveTo', label: 'Checkpoint 5/5 — Otto’s garage', target: [60, 175] },
    ],
  },
];

export const STORY_COMPLETE = 'Port Vela is yours, Maya. Rook is gone, Otto is paid, and the harbour lights are all yours.';

export const PALETTE = {
  sky: 0xff8f5e,
  skyTop: 0x2b2a55,
  fog: 0xe8805a,
  ground: 0x3a3f4a,
  road: 0x23262e,
  roadLine: 0xd8c25a,
  sidewalk: 0x6d6a63,
  sand: 0xd9b380,
  sea: 0x1d5f7a,
  seaDeep: 0x14455e,
  building: ['#7a5a6e', '#5e6b7a', '#8a6a4e', '#4e5e6b', '#96684f', '#6b4e6e'],
  windowLit: '#ffd98a',
  windowDark: '#232838',
  car: ['#e8c832', '#c23b2e', '#2e6fc2', '#3aa655', '#e8e8e8', '#222831', '#c26a2e', '#7a3aa6'],
  police: '#1d3fae',
  player: '#e8632e',
  ped: ['#c2a878', '#7a9e7a', '#9e7a8a', '#7a8aa6', '#b5b5b5'],
  rival: '#20242e',
  marker: 0xffe14d,
  beacon: 0xffe14d,
  sun: 0xffd27a,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Named places the HUD, minimap and missions share. */
export const PLACES = {
  garage: { x: 60, z: 175, label: 'Otto’s Garage' },
  docksCar: { x: -150, z: -205, label: 'Docks' },
  marina: { x: 205, z: 60, label: 'Marina' },
  lighthouse: { x: 0, z: 222, label: 'Lighthouse' },
  plaza: { x: 0, z: 0, label: 'Downtown Plaza' },
  beachRoad: { x: 215, z: -120, label: 'Beach Road' },
};
