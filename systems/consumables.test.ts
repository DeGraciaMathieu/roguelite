import { describe, expect, it } from 'vitest';
import type { RunState } from '@/domain';
import type { PlayerIntent } from '@/input/intent';
import { createDebugRun } from '@/data/debugRoom';
import { CONSUMABLE_DEFS, MEDKIT_ID } from '@/data/consumables';
import { updateConsumables } from './consumables';

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
