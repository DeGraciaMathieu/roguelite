/**
 * Paramètres de génération d'étage. Données, pas de logique.
 */

import type { AmmoType } from '@/domain';

export interface AmmoLootEntry {
  ammo: AmmoType;
  /** Poids relatif du tirage (déterministe, via le RNG d'étage). */
  weight: number;
  amount: { min: number; max: number };
}

export interface FloorGenConfig {
  /** Nombre de salles de l'étage (bornes incluses, tiré au RNG de l'étage). */
  roomCount: { min: number; max: number };
  /** Taille unique des salles : garantit des murs partagés, donc des portes valides. */
  roomSize: { w: number; h: number };
  enemiesPerCombatRoom: { min: number; max: number };
  /** Table pondérée des munitions posées dans les salles loot. */
  ammoLoot: readonly AmmoLootEntry[];
  /** Chance qu'une salle loot contienne un medkit en plus des munitions. */
  medkitLootChance: number;
  /** Medkits posés dans chaque salle rest (sa raison d'être). */
  medkitsPerRestRoom: number;
  /** Zones de vide par salle de combat (bornes incluses). */
  pitsPerCombatRoom: { min: number; max: number };
}

export const DEFAULT_FLOOR_GEN: FloorGenConfig = {
  roomCount: { min: 7, max: 10 },
  roomSize: { w: 800, h: 600 },
  enemiesPerCombatRoom: { min: 1, max: 3 },
  ammoLoot: [
    { ammo: 'handgun', weight: 6, amount: { min: 6, max: 12 } },
    { ammo: 'shotgun', weight: 4, amount: { min: 3, max: 6 } },
  ],
  medkitLootChance: 0.4,
  medkitsPerRestRoom: 1,
  pitsPerCombatRoom: { min: 0, max: 2 },
};
