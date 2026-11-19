// The story: four jobs from Otto "Ledger" Kline, each a chain of steps.
// A step completes when Maya (on foot or in a car) reaches its marker, steals
// the marked car, or her wanted level hits the step's number. Finishing a job
// pays out, autosaves, and briefs the next one; the timed run can be retried.
import { MISSIONS, STORY_COMPLETE } from './config.js';

export function createMissions(hooks) {
  const state = {
    index: 0,
    stepIndex: 0,
    timer: 0,
    done: false,
    started: false,
  };

  function current() {
    return MISSIONS[state.index] || null;
  }

  function currentStep() {
    const mission = current();
    return mission ? mission.steps[state.stepIndex] : null;
  }

  function showStep() {
    const mission = current();
    const step = currentStep();
    if (!mission || !step) return;
    hooks.setMarker(step.target ? step.target[0] : 0, step.target ? step.target[1] : 0, !!step.target);
    hooks.setObjective(`${mission.name} — ${step.label}`);
    if (mission.timeLimit) hooks.setTimer(state.timer);
  }

  function start(index) {
    state.index = Math.min(index, MISSIONS.length - 1);
    state.stepIndex = 0;
    state.done = false;
    state.started = true;
    const mission = current();
    state.timer = mission.timeLimit || 0;
    hooks.toast(`New job: ${mission.name} — $${mission.payout}`);
    hooks.toast(mission.briefing, 7);
    if (state.index === 1) hooks.spawnRivals(2, 205, 60);
    if (state.index === 2) {
      const pos = hooks.playerPos();
      hooks.spawnRivals(3, pos.x + 12, pos.z + 8);
    }
    showStep();
  }

  function advanceStep() {
    const mission = current();
    state.stepIndex += 1;
    if (state.stepIndex >= mission.steps.length) {
      hooks.addCash(mission.payout);
      hooks.sfx('cash');
      hooks.toast(`Job complete: ${mission.name} — +$${mission.payout}`);
      hooks.setMarker(0, 0, false);
      hooks.setObjective('');
      hooks.setTimer(0);
      hooks.save();
      if (state.index + 1 >= MISSIONS.length) {
        state.done = true;
        hooks.toast(STORY_COMPLETE, 10);
        hooks.onStoryComplete();
        return { completed: true, mission };
      }
      start(state.index + 1);
      return { completed: true, mission };
    }
    hooks.sfx('pickup');
    showStep();
    return { stepped: true };
  }

  function update(dt) {
    if (!state.started || state.done) return {};
    const mission = current();
    const step = currentStep();
    if (!step) return {};

    if (mission.timeLimit) {
      state.timer -= dt;
      hooks.setTimer(Math.max(0, state.timer));
      if (state.timer <= 0) {
        hooks.toast('Too slow — the run failed. Try again.', 5);
        start(state.index);
        return { failed: true };
      }
    }

    const pos = hooks.playerPos();
    const driving = hooks.isDriving();
    switch (step.kind) {
      case 'reach': {
        if (Math.hypot(pos.x - step.target[0], pos.z - step.target[1]) < 8) return advanceStep();
        break;
      }
      case 'enterCar': {
        if (driving) return advanceStep();
        break;
      }
      case 'driveTo': {
        const radius = driving ? 12 : 10;
        if (Math.hypot(pos.x - step.target[0], pos.z - step.target[1]) < radius) return advanceStep();
        break;
      }
      case 'wanted': {
        if (hooks.getWanted() >= step.wanted) return advanceStep();
        break;
      }
      case 'clearWanted': {
        if (hooks.getWanted() <= 0) return advanceStep();
        break;
      }
      default:
        break;
    }
    return {};
  }

  return {
    state,
    current,
    currentStep,
    start,
    update,
    /** The label the HUD shows right now. */
    objectiveLabel() {
      const mission = current();
      const step = currentStep();
      if (!mission || !step || state.done) return state.done ? 'Story complete — Port Vela is yours.' : '';
      return `${mission.name} — ${step.label}`;
    },
  };
}
