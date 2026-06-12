import { describe, expect, it } from 'vitest';
import type { RunState } from '@/domain';
import type { PlayerIntent } from '@/input/intent';
import { createRun } from './run';
import { stepRun } from './step';

const DT = 1000 / 60;

function idleIntent(): PlayerIntent {
  return {
    move: { x: 0, y: 0 },
    aimWorld: { x: 0, y: 0 },
    fire: false,
    reload: false,
    useConsumable: false,
    dash: false,
    weaponSlot: null,
  };
}

/** Intention scriptée, fonction pure du tick : déplacement tournant + tir périodique. */
function scriptedIntent(state: RunState, tick: number): PlayerIntent {
  const angle = tick * 0.01;
  return {
    ...idleIntent(),
    move: { x: Math.cos(angle), y: Math.sin(angle) },
    aimWorld: { x: state.player.pos.x + 100, y: state.player.pos.y },
    fire: tick % 3 === 0,
    dash: tick % 120 === 0,
  };
}

/** `startedAtMs` vient de Date.now() : on le neutralise pour comparer deux runs. */
function normalizedRun(seed: number): RunState {
  const state = createRun(seed);
  state.stats.startedAtMs = 0;
  return state;
}

describe('stepRun', () => {
  it('fait avancer elapsedMs du delta', () => {
    const state = normalizedRun(42);

    stepRun(state, idleIntent(), DT);
    stepRun(state, idleIntent(), DT);

    expect(state.elapsedMs).toBeCloseTo(2 * DT, 5);
  });

  it('câble le pipeline complet : un tir produit un projectile', () => {
    const state = normalizedRun(42);

    stepRun(state, { ...idleIntent(), fire: true }, DT);

    expect(state.projectiles.length).toBeGreaterThan(0);
  });

  it('est déterministe : même seed + mêmes intentions → états identiques au tick près', () => {
    const a = normalizedRun(1337);
    const b = normalizedRun(1337);

    for (let tick = 0; tick < 600; tick += 1) {
      stepRun(a, scriptedIntent(a, tick), DT);
      stepRun(b, scriptedIntent(b, tick), DT);
    }

    expect(a).toEqual(b);
  });
});
