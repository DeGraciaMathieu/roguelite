/**
 * Usage des consommables stockés (front montant, un appui = un usage).
 * La touche sert le premier stack *pertinent* : bandage si on saigne, sinon
 * soin. Le soin est plafonné au max, et un appui à pleine vie ne consomme
 * rien : les medkits sont trop rares pour être gâchés par une fausse manip.
 */

import type { RunState } from '@/domain';
import type { PlayerIntent } from '@/input/intent';
import { getConsumableDef } from '@/data/consumables';
import { cureBleed, isBleeding } from './status';

function consumeStackAt(state: RunState, index: number): void {
  const stack = state.inventory.consumables[index];
  if (!stack) return;
  stack.count -= 1;
  if (stack.count <= 0) state.inventory.consumables.splice(index, 1);
}

export function updateConsumables(state: RunState, intent: PlayerIntent): void {
  if (!intent.useConsumable) return;
  const player = state.player;

  // Priorité au bandage quand on saigne ; jamais consommé sinon.
  if (isBleeding(player)) {
    for (let i = 0; i < state.inventory.consumables.length; i += 1) {
      const stack = state.inventory.consumables[i];
      if (!stack) continue;
      const effect = getConsumableDef(stack.defId).effect;
      if (effect.kind !== 'cure' || effect.status !== 'bleed') continue;
      cureBleed(player);
      consumeStackAt(state, i);
      return;
    }
  }

  const health = player.health;
  for (let i = 0; i < state.inventory.consumables.length; i += 1) {
    const stack = state.inventory.consumables[i];
    if (!stack) continue;
    const effect = getConsumableDef(stack.defId).effect;
    if (effect.kind !== 'heal') continue;

    if (health.current >= health.max) return;
    health.current = Math.min(health.max, health.current + effect.amount);
    consumeStackAt(state, i);
    return;
  }
}
