/**
 * Ramassage du loot au sol. Room.lootSpawns EST l'état du sol : ramasser =
 * créditer l'inventaire et retirer l'entrée (pas d'entité à matérialiser, un
 * objet au sol ne bouge pas). Ramassage sélectif : seules les munitions d'une
 * arme portée sont prises — le reste demeure visible au sol.
 */

import type { Inventory, RunState } from '@/domain';
import { LOOT_PICKUP_RADIUS } from '@/data/balance';
import { getWeaponDef } from '@/data/weapons';
import { currentRoom } from './movement';

/** Total porté : `capacity` borne le nombre de consommables, pas de types. */
export function consumableCount(inventory: Inventory): number {
  return inventory.consumables.reduce((sum, stack) => sum + stack.count, 0);
}

export function updateLootPickup(state: RunState): void {
  const room = currentRoom(state);
  if (room.lootSpawns.length === 0) return;

  const carriedAmmoTypes = new Set(
    state.inventory.weapons.map((weapon) => getWeaponDef(weapon.defId).ammo),
  );
  const player = state.player;
  const reach = player.radius + LOOT_PICKUP_RADIUS;

  room.lootSpawns = room.lootSpawns.filter((spawn) => {
    const dx = spawn.at.x - player.pos.x;
    const dy = spawn.at.y - player.pos.y;
    if (dx * dx + dy * dy > reach * reach) return true;

    switch (spawn.kind) {
      case 'ammo': {
        // Sélectif : on ne ramasse que les munitions d'une arme portée.
        if (!carriedAmmoTypes.has(spawn.ammo)) return true;
        state.inventory.ammo[spawn.ammo] += spawn.amount;
        return false;
      }
      case 'consumable': {
        // Inventaire plein : l'objet reste au sol, on reviendra le chercher.
        if (consumableCount(state.inventory) >= state.inventory.capacity) return true;
        const stack = state.inventory.consumables.find((s) => s.defId === spawn.defId);
        if (stack) {
          stack.count += 1;
        } else {
          state.inventory.consumables.push({ defId: spawn.defId, count: 1 });
        }
        return false;
      }
      // Reliques, armes, clés : leurs systèmes n'existent pas encore.
      default:
        return true;
    }
  });
}
