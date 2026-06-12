/**
 * Méta-progression : conversion des stats de run en gains persistants et
 * achats au hub. Fonctions pures : MetaState entrant, nouveau MetaState
 * sortant (ou null si l'opération est refusée), jamais de mutation.
 */

import type { MetaState, RunStats, RunStatus, WeaponDefId } from '@/domain';
import {
  CURRENCY_PER_FLOOR,
  CURRENCY_PER_KILL,
  EXTRACTION_BONUS_MULTIPLIER,
} from '@/data/balance';
import { UNLOCK_DEFS } from '@/data/unlocks';
import type { UnlockDef } from '@/data/unlocks';
import { HANDGUN_ID } from '@/data/weapons';

export function runCurrencyReward(stats: RunStats, status: RunStatus): number {
  const base = stats.kills * CURRENCY_PER_KILL + stats.floorsCleared * CURRENCY_PER_FLOOR;
  return Math.floor(status === 'extracted' ? base * EXTRACTION_BONUS_MULTIPLIER : base);
}

export function applyRunRewards(meta: MetaState, stats: RunStats, status: RunStatus): MetaState {
  return {
    ...meta,
    currency: meta.currency + runCurrencyReward(stats, status),
    records: {
      totalRuns: meta.records.totalRuns + 1,
      totalKills: meta.records.totalKills + stats.kills,
      bestFloor: Math.max(meta.records.bestFloor, stats.deepestFloor),
    },
  };
}

/** Achat refusé (déjà possédé ou solde insuffisant) → null. */
export function purchaseUnlock(meta: MetaState, def: UnlockDef): MetaState | null {
  if (meta.unlocks.includes(def.id)) return null;
  if (meta.currency < def.cost) return null;
  return {
    ...meta,
    currency: meta.currency - def.cost,
    unlocks: [...meta.unlocks, def.id],
  };
}

/** Armes disponibles au loadout : l'arme de base + celles débloquées. */
export function unlockedWeapons(meta: MetaState): WeaponDefId[] {
  const ids: WeaponDefId[] = [HANDGUN_ID];
  for (const def of UNLOCK_DEFS) {
    if (meta.unlocks.includes(def.id)) ids.push(def.weaponId);
  }
  return ids;
}

/** Sélection refusée si l'arme n'est pas débloquée → null. */
export function selectLoadoutWeapon(meta: MetaState, weaponId: WeaponDefId): MetaState | null {
  if (!unlockedWeapons(meta).includes(weaponId)) return null;
  return { ...meta, loadout: { weaponId } };
}
