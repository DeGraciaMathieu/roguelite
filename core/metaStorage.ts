/**
 * Adaptateur de persistance méta : seul endroit qui parle au stockage.
 * Toute lecture passe par migrateMeta (jamais de confiance au blob brut) ;
 * le Storage est injecté pour rester testable sans navigateur.
 */

import { migrateMeta, serializeMeta } from '@/domain';
import type { MetaState, WeaponDefId } from '@/domain';

const STORAGE_KEY = 'dinocrisis.meta';

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface MetaStorage {
  load(): MetaState;
  save(meta: MetaState): void;
}

export function createMetaStorage(storage: KeyValueStorage, starterWeapon: WeaponDefId): MetaStorage {
  return {
    load(): MetaState {
      const raw = storage.getItem(STORAGE_KEY);
      let parsed: unknown = null;
      if (raw !== null) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          // Blob illisible : migrateMeta repartira des défauts.
          parsed = null;
        }
      }
      return migrateMeta(parsed, starterWeapon);
    },
    save(meta: MetaState): void {
      storage.setItem(STORAGE_KEY, serializeMeta(meta));
    },
  };
}
