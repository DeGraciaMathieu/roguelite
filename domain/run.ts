/**
 * État complet d'une run en cours.
 * Vit en mémoire, perdu à la mort (permadeath). Sérialisable malgré tout
 * (utile pour les tests et le debug : on peut dumper/recharger une run).
 */

import type { EntityId, RngState } from './core';
import type { Enemy, Player, Projectile } from './entities';
import type { Floor } from './floor';
import type { Inventory, Relic } from './items';

export type RunStatus =
  | 'active' // en cours
  | 'dead' // joueur mort -> retour au hub
  | 'extracted'; // sortie atteinte -> run réussie

/** Statistiques agrégées d'une run, base du calcul des récompenses méta. */
export interface RunStats {
  floorsCleared: number;
  kills: number;
  /** Profondeur max atteinte (index d'étage). */
  deepestFloor: number;
  startedAtMs: number;
}

export interface RunState {
  /** Seed maîtresse de la run (affichée, rejouable). */
  readonly seed: number;
  /** RNG threadé explicitement à travers les systèmes. */
  rng: RngState;

  floor: Floor;
  player: Player;
  inventory: Inventory;
  relics: Relic[];

  /** Ennemis actifs de la salle/étage courant, indexés par id. */
  enemies: Record<EntityId, Enemy>;
  projectiles: Projectile[];

  /**
   * Compteur monotone pour générer des EntityId uniques et déterministes
   * (pas de UUID aléatoire : casserait le déterminisme seedé).
   */
  nextEntitySeq: number;

  /** Temps de simulation écoulé depuis le début de la run (ms). */
  elapsedMs: number;
  status: RunStatus;
  stats: RunStats;
}
