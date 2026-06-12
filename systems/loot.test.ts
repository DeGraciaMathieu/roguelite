import { describe, expect, it } from 'vitest';
import { asId } from '@/domain';
import type { LootSpawn, Room, RunState } from '@/domain';
import { MEDKIT_ID } from '@/data/consumables';
import { createDebugRun } from '@/data/debugRoom';
import { SHOTGUN_ID, createWeaponInstance } from '@/data/weapons';
import { updateLootPickup } from './loot';

/** Salle de debug avec du loot posé ; joueur au centre (400, 300). */
function runWithLoot(...spawns: LootSpawn[]): { state: RunState; room: Room } {
  const state = createDebugRun(1);
  const room = state.floor.rooms[state.floor.currentRoomId];
  if (!room) throw new Error('Salle de debug manquante');
  room.lootSpawns = spawns;
  return { state, room };
}

const AT_PLAYER = { x: 400, y: 300 };

describe('updateLootPickup', () => {
  it('crédite les munitions au contact et retire l’objet du sol', () => {
    const { state, room } = runWithLoot({ kind: 'ammo', at: AT_PLAYER, ammo: 'handgun', amount: 8 });
    const before = state.inventory.ammo.handgun;

    updateLootPickup(state);

    expect(state.inventory.ammo.handgun).toBe(before + 8);
    expect(room.lootSpawns).toHaveLength(0);
  });

  it('ignore le loot hors de portée', () => {
    const { state, room } = runWithLoot({
      kind: 'ammo',
      at: { x: 400, y: 360 }, // 60 px > rayon joueur + rayon de ramassage
      ammo: 'handgun',
      amount: 8,
    });

    updateLootPickup(state);

    expect(room.lootSpawns).toHaveLength(1);
  });

  it('laisse au sol les munitions d’une arme non portée', () => {
    const { state, room } = runWithLoot({ kind: 'ammo', at: AT_PLAYER, ammo: 'shotgun', amount: 4 });

    updateLootPickup(state);

    expect(state.inventory.ammo.shotgun).toBe(0);
    expect(room.lootSpawns).toHaveLength(1);
  });

  it('ramasse les munitions shotgun quand le shotgun est porté', () => {
    const { state, room } = runWithLoot({ kind: 'ammo', at: AT_PLAYER, ammo: 'shotgun', amount: 4 });
    state.inventory.weapons = [createWeaponInstance(SHOTGUN_ID)];

    updateLootPickup(state);

    expect(state.inventory.ammo.shotgun).toBe(4);
    expect(room.lootSpawns).toHaveLength(0);
  });

  it('ramasse un medkit dans l’inventaire de consommables', () => {
    const { state, room } = runWithLoot({ kind: 'consumable', at: AT_PLAYER, defId: MEDKIT_ID });

    updateLootPickup(state);

    expect(state.inventory.consumables).toEqual([{ defId: MEDKIT_ID, count: 1 }]);
    expect(room.lootSpawns).toHaveLength(0);
  });

  it('inventaire de consommables plein : le medkit reste au sol', () => {
    const { state, room } = runWithLoot({ kind: 'consumable', at: AT_PLAYER, defId: MEDKIT_ID });
    state.inventory.consumables = [{ defId: MEDKIT_ID, count: state.inventory.capacity }];

    updateLootPickup(state);

    expect(state.inventory.consumables[0]?.count).toBe(state.inventory.capacity);
    expect(room.lootSpawns).toHaveLength(1);
  });

  it('laisse au sol les kinds non gérés', () => {
    const { state, room } = runWithLoot({
      kind: 'key',
      at: AT_PLAYER,
      defId: asId<'ItemDefId'>('test-key'),
    });

    updateLootPickup(state);

    expect(room.lootSpawns).toHaveLength(1);
  });

  it('ramasse une relique : ajoutée à la run, retirée du sol, hors capacité', () => {
    const { state, room } = runWithLoot({
      kind: 'relic',
      at: AT_PLAYER,
      defId: asId<'RelicDefId'>('crocs-sertis'),
    });
    // Inventaire de consommables plein : les reliques n'y comptent pas.
    state.inventory.consumables = [{ defId: MEDKIT_ID, count: state.inventory.capacity }];

    updateLootPickup(state);

    expect(state.relics).toEqual([{ defId: asId<'RelicDefId'>('crocs-sertis') }]);
    expect(room.lootSpawns).toHaveLength(0);
  });

  it('ammoDropMult multiplie les munitions ramassées', () => {
    const { state, room } = runWithLoot({ kind: 'ammo', at: AT_PLAYER, ammo: 'handgun', amount: 8 });
    state.relics = [{ defId: asId<'RelicDefId'>('pillard') }]; // ammoDropMult 1.5
    const before = state.inventory.ammo.handgun;

    updateLootPickup(state);

    expect(state.inventory.ammo.handgun).toBe(before + 12);
    expect(room.lootSpawns).toHaveLength(0);
  });

  it('ne ramasse que les objets à portée parmi plusieurs', () => {
    const { state, room } = runWithLoot(
      { kind: 'ammo', at: AT_PLAYER, ammo: 'handgun', amount: 6 },
      { kind: 'ammo', at: { x: 600, y: 300 }, ammo: 'handgun', amount: 6 },
    );
    const before = state.inventory.ammo.handgun;

    updateLootPickup(state);

    expect(state.inventory.ammo.handgun).toBe(before + 6);
    expect(room.lootSpawns).toHaveLength(1);
  });
});
