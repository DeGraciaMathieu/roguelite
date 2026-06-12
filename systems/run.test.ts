import { describe, expect, it } from 'vitest';
import { START_AMMO } from '@/data/balance';
import { HANDGUN_ID, RIFLE_ID, SHOTGUN_ID } from '@/data/weapons';
import { createRun } from './run';

describe('createRun — inventaire de départ', () => {
  it('porte toujours les trois armes, dans l’ordre des touches 1-3', () => {
    const state = createRun(1);
    expect(state.inventory.weapons.map((weapon) => weapon.defId)).toEqual([
      HANDGUN_ID,
      SHOTGUN_ID,
      RIFLE_ID,
    ]);
  });

  it('sert la réserve de départ de chaque type de munitions', () => {
    const state = createRun(1);
    expect(state.inventory.ammo).toEqual(START_AMMO);
  });

  it('le loadout choisit l’arme en main au départ', () => {
    expect(createRun(1).inventory.equippedIndex).toBe(0);
    expect(createRun(1, { weaponId: RIFLE_ID }).inventory.equippedIndex).toBe(2);
  });
});
