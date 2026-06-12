import { describe, expect, it } from 'vitest';
import type { RunState } from '@/domain';
import type { PlayerIntent } from '@/input/intent';
import { createDebugRun } from '@/data/debugRoom';
import { MEDKIT_ID } from '@/data/consumables';
import { stepRun } from '@/systems/step';
import type { RunOutcome } from './pilot';
import { observeRun } from './telemetry';

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

const DT = 1000 / 60;

/** Joue `ticks` pas sur un état contrôlé et matérialise la mesure. */
function measure(
  state: RunState,
  ticks: number,
  intentAt: (tick: number) => PlayerIntent,
): ReturnType<ReturnType<typeof observeRun>['finalize']> {
  const observer = observeRun((s, tick) => intentAt(tick));
  for (let tick = 0; tick < ticks; tick += 1) {
    stepRun(state, observer.agent(state, tick), DT);
  }
  const outcome: RunOutcome = {
    seed: state.seed,
    status: state.status === 'active' ? 'tick-cap' : state.status,
    ticks,
    elapsedMs: state.elapsedMs,
    stats: state.stats,
    finalState: state,
  };
  return observer.finalize(outcome, 'test');
}

describe('observeRun', () => {
  it('compte les munitions tirées par différence d’inventaire (la recharge ne compte pas)', () => {
    const state = createDebugRun(42);
    // Tir continu vers la droite : vide une partie du chargeur, recharge incluse.
    const record = measure(state, 120, () => ({
      ...idleIntent(),
      aimWorld: { x: state.player.pos.x + 100, y: state.player.pos.y },
      fire: true,
    }));

    expect(record.ammoSpent.handgun).toBeGreaterThan(0);
    expect(record.ammoPickedUp.handgun).toBe(0);
    // Conservation : tout ce qui a quitté l'inventaire a été tiré.
    const weapon = state.inventory.weapons[0];
    if (!weapon) throw new Error('Handgun manquant');
    const finalTotal = state.inventory.ammo.handgun + weapon.ammoInMag;
    expect(record.ammoSpent.handgun).toBe(24 + 12 - finalTotal); // START_AMMO + chargeur plein
    expect(record.ammoSpent.shotgun).toBe(0);
    expect(record.ammoSpent.rifle).toBe(0);
  });

  it('compte les medkits utilisés, pas les stocks immobiles', () => {
    const state = createDebugRun(42);
    state.player.health.current = 40;
    state.inventory.consumables.push({ defId: MEDKIT_ID, count: 2 });

    const record = measure(state, 3, (tick) => ({
      ...idleIntent(),
      useConsumable: tick === 1,
    }));

    expect(record.medkitsUsed).toBe(1);
    expect(record.medkitsPickedUp).toBe(0);
    expect(record.bandagesUsed).toBe(0);
  });

  it('reporte la durée simulée et un deathFloor null hors mort', () => {
    const state = createDebugRun(42);
    const record = measure(state, 10, idleIntent);

    expect(record.status).toBe('tick-cap');
    expect(record.durationMs).toBeCloseTo(10 * DT, 5);
    expect(record.deathFloor).toBeNull();
    expect(record.policy).toBe('test');
  });
});
