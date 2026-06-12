/**
 * Pas de simulation : un tick complet de la run, sans rendu ni DOM.
 * Source de vérité unique sur l'ordre des systèmes, partagée entre la boucle
 * de jeu (main.ts) et le harnais headless — ne jamais dupliquer ce pipeline.
 */

import type { RunState } from '@/domain';
import type { PlayerIntent } from '@/input/intent';
import { updateAi } from './ai';
import { updateCombat, updateProjectiles } from './combat';
import { updateConsumables } from './consumables';
import { updateDoorTransition } from './doors';
import { updateLootPickup } from './loot';
import { updateMovement } from './movement';
import { updateStairs } from './stairs';
import { updateStatus } from './status';

export function stepRun(state: RunState, intent: PlayerIntent, dtMs: number): void {
  updateMovement(state, intent, dtMs);
  updateDoorTransition(state);
  updateStairs(state);
  updateLootPickup(state);
  updateConsumables(state, intent);
  updateAi(state, dtMs);
  updateStatus(state, dtMs);
  updateCombat(state, intent);
  updateProjectiles(state, dtMs);
  state.elapsedMs += dtMs;
}
