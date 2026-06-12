/**
 * Méta-progression : conversion des stats de run en gains persistants et
 * achats au hub. Fonctions pures : MetaState entrant, nouveau MetaState
 * sortant (ou null si l'opération est refusée), jamais de mutation.
 */

import type { MetaState, RunStats, RunStatus } from '@/domain';
import {
  CURRENCY_FLOOR_DEPTH_BONUS,
  CURRENCY_PER_FLOOR,
  CURRENCY_PER_KILL,
  EXTRACTION_BONUS_MULTIPLIER,
} from '@/data/balance';
import type { UnlockDef } from '@/data/unlocks';

/**
 * Le n-ième étage descendu (0-based) rapporte base + n × bonus : somme
 * arithmétique, l'étage 5 paie plus que l'étage 1.
 */
function floorsClearedReward(floorsCleared: number): number {
  const depthBonus = (CURRENCY_FLOOR_DEPTH_BONUS * floorsCleared * (floorsCleared - 1)) / 2;
  return floorsCleared * CURRENCY_PER_FLOOR + depthBonus;
}

export function runCurrencyReward(stats: RunStats, status: RunStatus): number {
  const base = stats.kills * CURRENCY_PER_KILL + floorsClearedReward(stats.floorsCleared);
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

