import { describe, expect, it } from 'vitest';
import { createDebugRun } from '@/data/debugRoom';
import { applyBleed, cureBleed, isBleeding, updateStatus } from './status';

const TICK_MS = 1000 / 60;

describe('saignement', () => {
  it('draine exactement dps × durée puis s’arrête seul', () => {
    const state = createDebugRun(1);
    const before = state.player.health.current;
    applyBleed(state.player, 8000, 2);

    for (let elapsed = 0; elapsed < 10_000; elapsed += TICK_MS) {
      updateStatus(state, TICK_MS);
    }

    expect(state.player.health.current).toBeCloseTo(before - 16, 6);
    expect(isBleeding(state.player)).toBe(false);

    // Expiré : plus aucun drain.
    updateStatus(state, TICK_MS);
    expect(state.player.health.current).toBeCloseTo(before - 16, 6);
  });

  it('réapplication : rafraîchit la durée sans cumuler le dps', () => {
    const state = createDebugRun(1);
    applyBleed(state.player, 8000, 2);
    updateStatus(state, 4000); // -8 PV, reste 4 s

    applyBleed(state.player, 8000, 2);

    expect(state.player.status).toHaveLength(1);
    const bleed = state.player.status[0]!;
    expect(bleed.kind).toBe('bleed');
    expect(bleed.remainingMs).toBe(8000);
    if (bleed.kind === 'bleed') expect(bleed.dps).toBe(2);
  });

  it('un rafraîchissement ne raccourcit jamais la durée restante', () => {
    const state = createDebugRun(1);
    applyBleed(state.player, 8000, 2);
    applyBleed(state.player, 3000, 2);
    expect(state.player.status[0]?.remainingMs).toBe(8000);
  });

  it('le saignement peut tuer : game over normal', () => {
    const state = createDebugRun(1);
    state.player.health.current = 3;
    applyBleed(state.player, 8000, 2);

    for (let elapsed = 0; elapsed < 2000 && state.status === 'active'; elapsed += TICK_MS) {
      updateStatus(state, TICK_MS);
    }

    expect(state.player.health.current).toBe(0);
    expect(state.status).toBe('dead');
  });

  it('cureBleed purge le statut immédiatement', () => {
    const state = createDebugRun(1);
    applyBleed(state.player, 8000, 2);
    const health = state.player.health.current;

    cureBleed(state.player);
    updateStatus(state, 1000);

    expect(isBleeding(state.player)).toBe(false);
    expect(state.player.health.current).toBe(health);
  });
});
