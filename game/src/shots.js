// The screenshot scenes behind ?shot=start|play|chase|mission (with &seed=N).
// Each one plays the real game forward from a fresh start, steered by an
// autopilot that follows street waypoints toward the mission marker, so the
// frame is what a short game really looks like — and the same seed always
// gives the same frame. The caller renders a few frames, then sets
// window.__shotReady.
import { STEP } from './config.js';

function runSeconds(game, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) game.stepFixed(STEP);
}

/**
 * Stage the named scene on a fresh game and return the screen to show.
 * start: the title over the sunset city. play: Maya on foot by a car, job one
 * briefed. chase: Maya driving north on the -60 street with three stars and
 * police behind her. mission: the Midnight Run, mid-route to checkpoint two.
 */
export function stageShot(name, game) {
  game.newGame();
  if (name === 'play') {
    // On the 120 street, walking toward the blue sedan parked by the kerb.
    game.teleport(0, 120);
    game.setCameraYaw(Math.PI * 0.85);
    game.autopilot = { mode: 'point', x: 24, z: 122 };
    runSeconds(game, 7);
    game.autopilot = null;
    return { screen: 'play' };
  }
  if (name === 'chase') {
    // In the yellow dock sedan, three stars, racing north on the -180 street
    // with police behind — job one is live, so the objective line matches.
    game.teleport(-150, -205);
    game.forceEnterNearestCar();
    game.setWanted(3);
    game.autopilot = {
      mode: 'route',
      points: [
        { x: -150, z: -180 },
        { x: -180, z: -180 },
        { x: -180, z: -60 },
      ],
      i: 0,
    };
    runSeconds(game, 12);
    game.autopilot = null;
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // The Midnight Run: in the yellow dock sedan, racing the street route
    // toward downtown plaza, the second checkpoint.
    game.startMission(3);
    game.teleport(-150, -205);
    game.forceEnterNearestCar();
    game.autopilot = {
      mode: 'route',
      points: [
        { x: -150, z: -180 },
        { x: -180, z: -180 },
        { x: -180, z: 0 },
        { x: 0, z: 0 },
        { x: 0, z: 60 },
        { x: 205, z: 60 },
      ],
      i: 0,
    };
    runSeconds(game, 9);
    game.autopilot = null;
    return { screen: 'play' };
  }
  // start (and any unknown name): the title screen over a living city.
  game.toTitle();
  runSeconds(game, 5);
  return { screen: 'title' };
}
