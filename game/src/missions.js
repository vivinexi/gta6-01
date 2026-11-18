// The story: four jobs from Rico Vane, the fixer. Each mission has stages
// with a waypoint beacon, an objective line and a cash reward. Finishing all
// four ends the story.
import { MISSIONS } from './config.js';

const DOCKS = { x: 222, z: 222 };
const MARINA = { x: -222, z: 222 };
const NORTH_TOWER = { x: 0, z: -222 };
const DROPS = [
  { x: -222, z: -222 },
  { x: 222, z: -222 },
  { x: 222, z: 222 },
];

export function createMissions() {
  let index = 0;
  let stage = 0;
  let timer = 0;
  let objective = '';
  let active = false;
  let complete = false;
  let messageTimer = 0;

  function setObjective(text) {
    objective = text;
  }

  function start(G, i) {
    index = i;
    stage = 0;
    timer = 0;
    active = true;
    const m = MISSIONS[i];
    G.hud.showPhone(`RICO VANE — ${m.title}\n${m.briefing}`);
    if (i === 0) {
      setObjective('Steal a car — press E near one');
      G.world.setBeacon(0, 0, false);
    } else if (i === 1) {
      setObjective('Walk to the blue crate at the marina');
      G.world.setBeacon(MARINA.x, MARINA.z, true);
    } else if (i === 2) {
      G.wanted.setStars(2, G.time);
      setObjective('Lose the 2-star heat — and watch for Vultures');
      G.world.setBeacon(0, 0, false);
      // Three Vultures come for the player.
      const px = G.player.x;
      const pz = G.player.z;
      G.combat.spawnEnemy(px + 12, pz + 6, 'Vulture');
      G.combat.spawnEnemy(px - 10, pz + 12, 'Vulture');
      G.combat.spawnEnemy(px + 4, pz - 14, 'Vulture');
    } else if (i === 3) {
      setObjective('Get in a car — the clock starts then');
      G.world.setBeacon(0, 0, false);
    }
  }

  function finish(G) {
    const m = MISSIONS[index];
    G.cash += m.reward;
    G.audio.missionDone();
    G.hud.showPhone(`JOB DONE — ${m.title}\n+$${m.reward}. Rico: Beautiful work, kid.`);
    G.world.setBeacon(0, 0, false);
    active = false;
    messageTimer = 2.2;
    if (index >= MISSIONS.length - 1) {
      complete = true;
      G.state = 'complete';
      G.hud.showScreen('complete');
      G.save.save(G);
      return;
    }
    index += 1;
    G.save.save(G);
  }

  function at(G, point, radius) {
    const px = G.playerCar ? G.playerCar.x : G.player.x;
    const pz = G.playerCar ? G.playerCar.z : G.player.z;
    return Math.hypot(px - point.x, pz - point.z) < radius;
  }

  return {
    get index() {
      return index;
    },
    get objective() {
      return objective;
    },
    get active() {
      return active;
    },
    get complete() {
      return complete;
    },
    get timer() {
      return timer;
    },
    start,
    finish,
    reset(G) {
      index = 0;
      stage = 0;
      timer = 0;
      active = false;
      complete = false;
      messageTimer = 0;
      start(G, 0);
    },
    update(dt, G) {
      if (messageTimer > 0) {
        messageTimer -= dt;
        if (messageTimer <= 0 && !complete) start(G, index);
        return;
      }
      if (!active || complete) return;
      if (index === 0) {
        if (stage === 0) {
          if (G.playerCar) {
            stage = 1;
            setObjective('Drive the car to the docks marker');
            G.world.setBeacon(DOCKS.x, DOCKS.z, true);
          }
        } else if (at(G, DOCKS, 9)) {
          finish(G);
        }
      } else if (index === 1) {
        if (stage === 0) {
          if (at(G, MARINA, 4) && !G.playerCar) {
            stage = 1;
            G.hasPackage = true;
            G.audio.pickup();
            setObjective('Package picked up — deliver it to the north tower');
            G.world.setBeacon(NORTH_TOWER.x, NORTH_TOWER.z, true);
          }
        } else if (at(G, NORTH_TOWER, 9)) {
          G.hasPackage = false;
          finish(G);
        }
      } else if (index === 2) {
        if (G.wanted.stars === 0) finish(G);
      } else if (index === 3) {
        if (stage === 0) {
          if (G.playerCar) {
            stage = 1;
            timer = 90;
            setObjective('Sunset Run — hit all 3 drops in 90 seconds');
            G.world.setBeacon(DROPS[0].x, DROPS[0].z, true);
          }
        } else {
          timer -= dt;
          const drop = DROPS[stage - 1];
          if (at(G, drop, 9)) {
            G.audio.pickup();
            if (stage >= DROPS.length) {
              finish(G);
            } else {
              stage += 1;
              setObjective(`Sunset Run — drop ${stage} of 3 (${Math.ceil(timer)}s left)`);
              G.world.setBeacon(DROPS[stage - 1].x, DROPS[stage - 1].z, true);
            }
          } else if (timer <= 0) {
            // Out of time: restart the run, keep the story going.
            stage = 0;
            timer = 0;
            G.hud.showPhone('RICO VANE\nToo slow, kid. Get back in a car and try the run again.');
            setObjective('Get in a car — the clock starts then');
            G.world.setBeacon(0, 0, false);
          } else {
            setObjective(`Sunset Run — drop ${stage} of 3 (${Math.ceil(timer)}s left)`);
          }
        }
      }
    },
  };
}
