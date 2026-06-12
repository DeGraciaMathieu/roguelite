/**
 * Usage des consommables stockés (front montant, un appui = un usage).
 * Le soin est plafonné au max, et un appui à pleine vie ne consomme rien :
 * les medkits sont trop rares pour être gâchés par une fausse manip.
 */

import type { RunState } from '@/domain';
import type { PlayerIntent } from '@/input/intent';
import { getConsumableDef } from '@/data/consumables';

export function updateConsumables(state: RunState, intent: PlayerIntent): void {
  if (!intent.useConsumable) return;
  const health = state.player.health;

  for (let i = 0; i < state.inventory.consumables.length; i += 1) {
    const stack = state.inventory.consumables[i];
    if (!stack) continue;
    const effect = getConsumableDef(stack.defId).effect;
    if (effect.kind !== 'heal') continue;

    if (health.current >= health.max) return;
    health.current = Math.min(health.max, health.current + effect.amount);
    stack.count -= 1;
    if (stack.count <= 0) state.inventory.consumables.splice(i, 1);
    return;
  }
}
