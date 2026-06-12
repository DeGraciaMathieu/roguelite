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

/** Espèces du mix standard des salles de combat (le théropode a sa propre règle). */
export interface EnemyMixEntry {
  kind: 'raptor' | 'compy';
  /** Poids relatif du tirage (déterministe, via le RNG d'étage). */
  weight: number;
}

export interface EnemyMixTier {
  /** Premier étage (0-based) où ce mix s'applique ; le palier le plus profond atteint gagne. */
  minFloor: number;
  mix: readonly EnemyMixEntry[];
}

export interface TheropodeSpawnConfig {
  /** Premier étage (0-based) où le théropode peut apparaître. */
  minFloor: number;
  /** Chance par salle de combat d'en contenir un. */
  chancePerCombatRoom: number;
  /** Plafond par étage. */
  maxPerFloor: number;
}

export interface FloorGenConfig {
  /** Nombre de salles de l'étage (bornes incluses, tiré au RNG de l'étage). */
  roomCount: { min: number; max: number };
  /** Taille unique des salles : garantit des murs partagés, donc des portes valides. */
  roomSize: { w: number; h: number };
  /** Densité de base (étage 0) ; croît avec la profondeur, voir les deux champs suivants. */
  enemiesPerCombatRoom: { min: number; max: number };
  /** +1 ennemi (min et max) tous les N étages descendus. */
  extraEnemyEveryNFloors: number;
  /** Plafond dur : au-delà, une salle de 800×600 devient illisible. */
  maxEnemiesPerCombatRoom: number;
  /** Mix d'espèces par tranche de profondeur, trié par minFloor croissant. */
  enemyMixByDepth: readonly EnemyMixTier[];
  /** Théropode mini-boss : apparition en sus du mix standard. */
  theropode: TheropodeSpawnConfig;
  /** Table pondérée des munitions posées dans les salles loot. */
  ammoLoot: readonly AmmoLootEntry[];
  /** Chance qu'une salle loot contienne un medkit en plus des munitions. */
  medkitLootChance: number;
  /** Chance qu'une salle loot contienne un bandage (soigne le saignement). */
  bandageLootChance: number;
  /** Chance que la salle loot contienne une relique (au plus une par étage). */
  relicLootChance: number;
  /** Medkits posés dans chaque salle rest (sa raison d'être). */
  medkitsPerRestRoom: number;
  /** Zones de vide par salle de combat (bornes incluses). */
  pitsPerCombatRoom: { min: number; max: number };
  /** Porte verrouillée : au plus une par étage, repli « aucune » sur les graphes sans pont. */
  lockedDoor: { minFloor: number; chance: number };
}

export const DEFAULT_FLOOR_GEN: FloorGenConfig = {
  roomCount: { min: 7, max: 10 },
  roomSize: { w: 800, h: 600 },
  enemiesPerCombatRoom: { min: 1, max: 3 },
  extraEnemyEveryNFloors: 2,
  maxEnemiesPerCombatRoom: 8,
  enemyMixByDepth: [
    {
      minFloor: 0,
      mix: [
        { kind: 'compy', weight: 7 },
        { kind: 'raptor', weight: 3 },
      ],
    },
    {
      minFloor: 2,
      mix: [
        { kind: 'raptor', weight: 7 },
        { kind: 'compy', weight: 3 },
      ],
    },
  ],
  theropode: { minFloor: 3, chancePerCombatRoom: 0.25, maxPerFloor: 1 },
  ammoLoot: [
    { ammo: 'handgun', weight: 6, amount: { min: 6, max: 12 } },
    { ammo: 'shotgun', weight: 4, amount: { min: 3, max: 6 } },
    // Rare et parcimonieux : cohérent avec la puissance du rifle.
    { ammo: 'rifle', weight: 2, amount: { min: 4, max: 8 } },
  ],
  medkitLootChance: 0.4,
  bandageLootChance: 0.35,
  relicLootChance: 0.5,
  medkitsPerRestRoom: 1,
  pitsPerCombatRoom: { min: 0, max: 2 },
  lockedDoor: { minFloor: 1, chance: 0.6 },
};
