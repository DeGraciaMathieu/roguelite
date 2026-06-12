import { describe, expect, it } from 'vitest';
import { FIXED_DT_MS } from '@/core/loop';
import type { PlayerIntent } from '@/input/intent';
import { applyBleed } from '@/systems/status';
import type { HeadlessAgent } from './pilot';
import { runHeadless } from './pilot';

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

const idleAgent: HeadlessAgent = () => idleIntent();

/** Agent scripté déterministe : déplacement tournant + tir périodique. */
const scriptedAgent: HeadlessAgent = (state, tick) => {
  const angle = tick * 0.01;
  return {
    ...idleIntent(),
    move: { x: Math.cos(angle), y: Math.sin(angle) },
    aimWorld: { x: state.player.pos.x + 100, y: state.player.pos.y },
    fire: tick % 3 === 0,
    dash: tick % 120 === 0,
  };
};

describe('runHeadless', () => {
  it('s’arrête au plafond de ticks avec le statut tick-cap', () => {
    const outcome = runHeadless(42, idleAgent, { maxTicks: 50 });

    expect(outcome.status).toBe('tick-cap');
    expect(outcome.ticks).toBe(50);
    expect(outcome.elapsedMs).toBeCloseTo(50 * FIXED_DT_MS, 5);
    expect(outcome.seed).toBe(42);
  });

  it('s’arrête dès que la run n’est plus active (mort)', () => {
    // Saignement létal au tick 0 : updateStatus doit basculer le statut et
    // le pilote doit sortir sans consommer le plafond.
    const dyingAgent: HeadlessAgent = (state, tick) => {
      if (tick === 0) applyBleed(state.player, 1000, 1_000_000);
      return idleIntent();
    };

    const outcome = runHeadless(42, dyingAgent, { maxTicks: 50 });

    expect(outcome.status).toBe('dead');
    expect(outcome.ticks).toBe(1);
  });

  it('est déterministe : même seed + même agent → même résultat au tick près', () => {
    const a = runHeadless(1337, scriptedAgent, { maxTicks: 600 });
    const b = runHeadless(1337, scriptedAgent, { maxTicks: 600 });

    // `startedAtMs` vient de Date.now() : on le neutralise avant comparaison.
    a.finalState.stats.startedAtMs = 0;
    b.finalState.stats.startedAtMs = 0;

    expect(a.ticks).toBe(b.ticks);
    expect(a.status).toBe(b.status);
    expect(a.finalState).toEqual(b.finalState);
  });
});
