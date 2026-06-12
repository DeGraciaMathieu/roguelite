import { describe, expect, it } from 'vitest';
import type { RunState } from '@/domain';
import type { PlayerIntent } from '@/input/intent';
import { createDebugRun } from '@/data/debugRoom';
import { BANDAGE_ID, CONSUMABLE_DEFS, MEDKIT_ID } from '@/data/consumables';
import { updateConsumables } from './consumables';
import { applyBleed, isBleeding } from './status';

const MEDKIT_DEF = CONSUMABLE_DEFS[MEDKIT_ID];
if (!MEDKIT_DEF || MEDKIT_DEF.effect.kind !== 'heal') throw new Error('Def medkit invalide');
const HEAL_AMOUNT = MEDKIT_DEF.effect.amount;

function useIntent(useConsumable = true): PlayerIntent {
  return {
    move: { x: 0, y: 0 },
    aimWorld: { x: 0, y: 0 },
    fire: false,
    reload: false,
    useConsumable,
    dash: false,
    weaponSlot: null,
  };
}

function runWithMedkits(count: number, health: number): RunState {
  const state = createDebugRun(1);
  state.player.health.current = health;
  if (count > 0) state.inventory.consumables = [{ defId: MEDKIT_ID, count }];
  return state;
}

describe('updateConsumables', () => {
  it('soigne et consomme un medkit', () => {
    const state = runWithMedkits(2, 40);

    updateConsumables(state, useIntent());

    expect(state.player.health.current).toBe(40 + HEAL_AMOUNT);
    expect(state.inventory.consumables[0]?.count).toBe(1);
  });

  it('plafonne le soin au maximum de vie', () => {
    const state = runWithMedkits(1, 80);

    updateConsumables(state, useIntent());

    expect(state.player.health.current).toBe(state.player.health.max);
  });

  it('retire le stack épuisé de l’inventaire', () => {
    const state = runWithMedkits(1, 40);

    updateConsumables(state, useIntent());

    expect(state.inventory.consumables).toHaveLength(0);
  });

  it('à pleine vie, ne consomme rien', () => {
    const state = runWithMedkits(1, 100);

    updateConsumables(state, useIntent());

    expect(state.inventory.consumables[0]?.count).toBe(1);
  });

  it('sans intention, ne fait rien', () => {
    const state = runWithMedkits(1, 40);

    updateConsumables(state, useIntent(false));

    expect(state.player.health.current).toBe(40);
    expect(state.inventory.consumables[0]?.count).toBe(1);
  });

  it('sans medkit, ne fait rien', () => {
    const state = runWithMedkits(0, 40);

    updateConsumables(state, useIntent());

    expect(state.player.health.current).toBe(40);
  });
});

describe('updateConsumables — bandage', () => {
  it('purge le saignement et consomme le bandage', () => {
    const state = runWithMedkits(0, 40);
    state.inventory.consumables = [{ defId: BANDAGE_ID, count: 2 }];
    applyBleed(state.player, 8000, 2);

    updateConsumables(state, useIntent());

    expect(isBleeding(state.player)).toBe(false);
    expect(state.inventory.consumables[0]?.count).toBe(1);
    expect(state.player.health.current).toBe(40); // un bandage ne soigne pas
  });

  it('en saignant avec bandage et medkit, le bandage passe en premier', () => {
    const state = runWithMedkits(1, 40);
    state.inventory.consumables.push({ defId: BANDAGE_ID, count: 1 });
    applyBleed(state.player, 8000, 2);

    updateConsumables(state, useIntent());

    expect(isBleeding(state.player)).toBe(false);
    expect(state.player.health.current).toBe(40); // le medkit n'a pas servi
    expect(state.inventory.consumables).toEqual([{ defId: MEDKIT_ID, count: 1 }]);
  });

  it('sans saignement, le bandage n’est pas consommé — le soin prend la main', () => {
    const state = runWithMedkits(1, 40);
    state.inventory.consumables.unshift({ defId: BANDAGE_ID, count: 1 });

    updateConsumables(state, useIntent());

    expect(state.player.health.current).toBe(40 + HEAL_AMOUNT);
    expect(state.inventory.consumables[0]).toEqual({ defId: BANDAGE_ID, count: 1 });
  });

  it('un medkit ne purge pas le saignement', () => {
    const state = runWithMedkits(1, 40);
    applyBleed(state.player, 8000, 2);

    updateConsumables(state, useIntent());

    expect(state.player.health.current).toBe(40 + HEAL_AMOUNT);
    expect(isBleeding(state.player)).toBe(true);
  });
});
