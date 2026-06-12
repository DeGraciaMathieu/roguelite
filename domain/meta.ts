/**
 * État méta persistant entre les runs.
 * Sérialisé dans localStorage sous forme versionnée. Toute lecture passe par
 * `migrateMeta`, qui valide et migre — on ne fait jamais confiance au blob brut.
 */

import type { UnlockId, WeaponDefId } from './core';

/** À incrémenter à chaque changement de forme de MetaState (+ ajouter une migration). */
export const META_VERSION = 1 as const;

export interface MetaRecords {
  totalRuns: number;
  totalKills: number;
  /** Meilleure profondeur atteinte, tous runs confondus. */
  bestFloor: number;
}

/** Loadout de départ choisi par le joueur parmi ce qu'il a débloqué. */
export interface StartingLoadout {
  weaponId: WeaponDefId;
}

export interface MetaState {
  /** Monnaie persistante gagnée en run, dépensée au hub. */
  currency: number;
  /** Déblocages permanents acquis (armes, bonus, entrées de pool…). */
  unlocks: UnlockId[];
  loadout: StartingLoadout;
  records: MetaRecords;
}

/** Enveloppe stockée sur disque. */
export interface PersistedMeta {
  version: number;
  data: MetaState;
}

/** État méta par défaut, pour une première partie ou un reset. */
export function defaultMeta(starterWeapon: WeaponDefId): MetaState {
  return {
    currency: 0,
    unlocks: [],
    loadout: { weaponId: starterWeapon },
    records: { totalRuns: 0, totalKills: 0, bestFloor: 0 },
  };
}

/**
 * Valide et migre un blob inconnu vers la version courante.
 * Stratégie : version inconnue ou données invalides -> on repart d'un défaut
 * (jamais de crash au boot). À étoffer avec les migrations réelles quand
 * META_VERSION augmentera.
 */
export function migrateMeta(raw: unknown, starterWeapon: WeaponDefId): MetaState {
  if (!isPersistedMeta(raw)) {
    return defaultMeta(starterWeapon);
  }
  switch (raw.version) {
    case META_VERSION:
      return raw.data;
    // case 1: { ... migrer v1 -> v2 ... }
    default:
      return defaultMeta(starterWeapon);
  }
}

export function serializeMeta(data: MetaState): string {
  const payload: PersistedMeta = { version: META_VERSION, data };
  return JSON.stringify(payload);
}

// --- Garde de type minimal (à durcir au besoin) ------------------------------

function isPersistedMeta(value: unknown): value is PersistedMeta {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    typeof (value as { version: unknown }).version === 'number' &&
    'data' in value &&
    typeof (value as { data: unknown }).data === 'object' &&
    (value as { data: unknown }).data !== null
  );
}
