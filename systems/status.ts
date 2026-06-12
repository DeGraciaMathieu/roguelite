/**
 * Effets de statut du joueur (saignement façon Dino Crisis). Pur : mutation
 * contrôlée du RunState, aucune dépendance au rendu. Le stun, modélisé dans
 * le domaine, viendra avec le boss — seul le bleed est interprété ici.
 */

import { isDead } from '@/domain';
import type { Player, RunState } from '@/domain';

/** Réapplication = rafraîchissement de la durée, jamais de cumul de dps. */
export function applyBleed(player: Player, durationMs: number, dps: number): void {
  for (const status of player.status) {
    if (status.kind === 'bleed') {
      status.remainingMs = Math.max(status.remainingMs, durationMs);
      return;
    }
  }
  player.status.push({ kind: 'bleed', remainingMs: durationMs, dps });
}

export function isBleeding(player: Player): boolean {
  return player.status.some((status) => status.kind === 'bleed');
}

export function cureBleed(player: Player): void {
  player.status = player.status.filter((status) => status.kind !== 'bleed');
}

export function updateStatus(state: RunState, dtMs: number): void {
  const player = state.player;
  if (player.status.length === 0) return;

  for (const status of player.status) {
    if (status.kind !== 'bleed') continue;
    // Borné au temps restant : le drain total vaut exactement dps × durée.
    const tickMs = Math.min(dtMs, status.remainingMs);
    player.health.current = Math.max(0, player.health.current - (status.dps * tickMs) / 1000);
    status.remainingMs -= dtMs;
  }
  player.status = player.status.filter((status) => status.remainingMs > 0);

  // Le saignement peut tuer : game over normal.
  if (isDead(player.health)) state.status = 'dead';
}
