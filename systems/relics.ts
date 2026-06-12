/**
 * Interprétation des reliques : agrégateurs purs consommés par les autres
 * systèmes (combat, mouvement, loot). Les facteurs se cumulent
 * multiplicativement ; sans relique tout vaut 1, la run se comporte
 * exactement comme si le système n'existait pas.
 */

import type { RelicDefId, RelicEffect, RunState } from '@/domain';
import { getRelicDef } from '@/data/relics';

type MultEffectKind = Extract<RelicEffect, { factor: number }>['kind'];

function multiplier(state: RunState, kind: MultEffectKind): number {
  let factor = 1;
  for (const relic of state.relics) {
    for (const effect of getRelicDef(relic.defId).effects) {
      if (effect.kind === kind) factor *= effect.factor;
    }
  }
  return factor;
}

export function damageMultiplier(state: RunState): number {
  return multiplier(state, 'damageMult');
}

export function moveSpeedMultiplier(state: RunState): number {
  return multiplier(state, 'moveSpeedMult');
}

/** Multiplie la durée de recharge : 0.7 = 30 % plus rapide. */
export function reloadDurationMultiplier(state: RunState): number {
  return multiplier(state, 'reloadSpeedMult');
}

export function ammoDropMultiplier(state: RunState): number {
  return multiplier(state, 'ammoDropMult');
}

/** Somme des bonus de PV max apportés par les reliques portées. */
export function maxHealthBonus(state: RunState): number {
  let total = 0;
  for (const relic of state.relics) {
    for (const effect of getRelicDef(relic.defId).effects) {
      if (effect.kind === 'maxHealthAdd') total += effect.amount;
    }
  }
  return total;
}

/**
 * Acquisition : ajoute la relique à la run et applique les effets
 * instantanés — maxHealthAdd augmente le plafond et soigne du delta.
 */
export function acquireRelic(state: RunState, defId: RelicDefId): void {
  state.relics.push({ defId });
  for (const effect of getRelicDef(defId).effects) {
    if (effect.kind === 'maxHealthAdd') {
      state.player.health.max += effect.amount;
      state.player.health.current += effect.amount;
    }
  }
}
