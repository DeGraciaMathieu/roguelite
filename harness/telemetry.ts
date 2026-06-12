/**
 * Télémétrie d'une run headless : un observateur en lecture seule s'intercale
 * devant l'agent et dérive ses compteurs par différence d'inventaire entre
 * deux ticks — aucun système de jeu n'est instrumenté, le gameplay reste
 * strictement intact.
 */

import type { AmmoType, RunState } from '@/domain';
import { BANDAGE_ID, MEDKIT_ID } from '@/data/consumables';
import { getWeaponDef } from '@/data/weapons';
import type { HeadlessAgent, HeadlessOutcomeStatus, RunOutcome } from './pilot';

/** Mesures d'une run, à plat : sérialisables telles quelles (JSON/CSV). */
export interface RunRecord {
  seed: number;
  policy: string;
  status: HeadlessOutcomeStatus;
  ticks: number;
  /** Temps simulé (elapsedMs) — jamais d'horloge murale, pour rester déterministe. */
  durationMs: number;
  deepestFloor: number;
  floorsCleared: number;
  kills: number;
  /** Étage de la mort, null si la run ne s'est pas terminée par une mort. */
  deathFloor: number | null;
  ammoPickedUp: Record<AmmoType, number>;
  ammoSpent: Record<AmmoType, number>;
  medkitsPickedUp: number;
  medkitsUsed: number;
  bandagesPickedUp: number;
  bandagesUsed: number;
  finalHealth: number;
}

/** Munitions totales par type (réserve + chargeurs) et stocks de soins. */
interface InventorySnapshot {
  ammo: Record<AmmoType, number>;
  medkits: number;
  bandages: number;
}

function snapshot(state: RunState): InventorySnapshot {
  const ammo: Record<AmmoType, number> = { ...state.inventory.ammo };
  for (const weapon of state.inventory.weapons) {
    ammo[getWeaponDef(weapon.defId).ammo] += weapon.ammoInMag;
  }
  let medkits = 0;
  let bandages = 0;
  for (const stack of state.inventory.consumables) {
    if (stack.defId === MEDKIT_ID) medkits += stack.count;
    if (stack.defId === BANDAGE_ID) bandages += stack.count;
  }
  return { ammo, medkits, bandages };
}

export interface RunObserver {
  /** À passer au pilote à la place de l'agent observé. */
  agent: HeadlessAgent;
  /** À appeler une fois la run terminée pour matérialiser les mesures. */
  finalize(outcome: RunOutcome, policy: string): RunRecord;
}

const AMMO_TYPES: readonly AmmoType[] = ['handgun', 'shotgun', 'rifle'];

export function observeRun(inner: HeadlessAgent): RunObserver {
  const ammoPickedUp: Record<AmmoType, number> = { handgun: 0, shotgun: 0, rifle: 0 };
  const ammoSpent: Record<AmmoType, number> = { handgun: 0, shotgun: 0, rifle: 0 };
  let medkitsPickedUp = 0;
  let medkitsUsed = 0;
  let bandagesPickedUp = 0;
  let bandagesUsed = 0;
  let prev: InventorySnapshot | null = null;

  // Diff entre deux observations. Limite assumée : un ramassage et une
  // dépense du même type dans le même tick se compensent (cas marginal).
  function absorb(state: RunState): void {
    const current = snapshot(state);
    if (prev) {
      for (const type of AMMO_TYPES) {
        const delta = current.ammo[type] - prev.ammo[type];
        if (delta > 0) ammoPickedUp[type] += delta;
        else ammoSpent[type] -= delta;
      }
      const medkitDelta = current.medkits - prev.medkits;
      if (medkitDelta > 0) medkitsPickedUp += medkitDelta;
      else medkitsUsed -= medkitDelta;
      const bandageDelta = current.bandages - prev.bandages;
      if (bandageDelta > 0) bandagesPickedUp += bandageDelta;
      else bandagesUsed -= bandageDelta;
    }
    prev = current;
  }

  return {
    agent(state, tick) {
      absorb(state);
      return inner(state, tick);
    },

    finalize(outcome: RunOutcome, policy: string): RunRecord {
      // Dernière observation : les effets du dernier tick (tir final, soin
      // in extremis) sont postérieurs au dernier appel de l'agent.
      absorb(outcome.finalState);
      return {
        seed: outcome.seed,
        policy,
        status: outcome.status,
        ticks: outcome.ticks,
        durationMs: outcome.elapsedMs,
        deepestFloor: outcome.stats.deepestFloor,
        floorsCleared: outcome.stats.floorsCleared,
        kills: outcome.stats.kills,
        deathFloor: outcome.status === 'dead' ? outcome.finalState.floor.index : null,
        ammoPickedUp,
        ammoSpent,
        medkitsPickedUp,
        medkitsUsed,
        bandagesPickedUp,
        bandagesUsed,
        finalHealth: outcome.finalState.player.health.current,
      };
    },
  };
}
