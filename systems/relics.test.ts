import { describe, expect, it } from 'vitest';
import { asId } from '@/domain';
import type { RelicDefId, RunState } from '@/domain';
import { createDebugRun } from '@/data/debugRoom';
import {
  acquireRelic,
  ammoDropMultiplier,
  damageMultiplier,
  maxHealthBonus,
  moveSpeedMultiplier,
  reloadDurationMultiplier,
} from './relics';

const CROCS_SERTIS = asId<'RelicDefId'>('crocs-sertis'); // damageMult 1.25
const SANG_FROID = asId<'RelicDefId'>('sang-froid'); // maxHealthAdd +25
const PREDATEUR = asId<'RelicDefId'>('predateur'); // damageMult 1.15 + moveSpeedMult 1.05

function stateWithRelics(...defIds: RelicDefId[]): RunState {
  const state = createDebugRun(1);
  state.relics = defIds.map((defId) => ({ defId }));
  return state;
}

describe('agrégateurs de reliques', () => {
  it('sans relique, tous les multiplicateurs sont neutres', () => {
    const state = stateWithRelics();
    expect(damageMultiplier(state)).toBe(1);
    expect(moveSpeedMultiplier(state)).toBe(1);
    expect(reloadDurationMultiplier(state)).toBe(1);
    expect(ammoDropMultiplier(state)).toBe(1);
    expect(maxHealthBonus(state)).toBe(0);
  });

  it('maxHealthBonus additionne les bonus de PV max', () => {
    const state = stateWithRelics(SANG_FROID, SANG_FROID);
    expect(maxHealthBonus(state)).toBe(50);
  });

  it('les effets se cumulent multiplicativement', () => {
    const state = stateWithRelics(CROCS_SERTIS, CROCS_SERTIS);
    expect(damageMultiplier(state)).toBeCloseTo(1.5625);
  });

  it('une relique combo contribue à chacun de ses effets', () => {
    const state = stateWithRelics(CROCS_SERTIS, PREDATEUR);
    expect(damageMultiplier(state)).toBeCloseTo(1.25 * 1.15);
    expect(moveSpeedMultiplier(state)).toBeCloseTo(1.05);
    expect(reloadDurationMultiplier(state)).toBe(1);
  });
});

describe('acquireRelic', () => {
  it('ajoute la relique à la run', () => {
    const state = stateWithRelics();
    acquireRelic(state, CROCS_SERTIS);
    expect(state.relics).toEqual([{ defId: CROCS_SERTIS }]);
  });

  it('maxHealthAdd relève le plafond et soigne du delta', () => {
    const state = stateWithRelics();
    const before = { ...state.player.health };

    acquireRelic(state, SANG_FROID);

    expect(state.player.health.max).toBe(before.max + 25);
    expect(state.player.health.current).toBe(before.current + 25);
  });
});
