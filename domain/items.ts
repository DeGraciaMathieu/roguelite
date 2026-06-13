/**
 * Armes, munitions, consommables, reliques et inventaire de run.
 * Les "Def" sont des données statiques (data/). Les "Instance" vivent dans la run.
 */

import type { ItemDefId, RelicDefId, WeaponDefId } from './core';

// --- Munitions ---------------------------------------------------------------

export type AmmoType = 'handgun' | 'shotgun' | 'rifle';

// --- Armes -------------------------------------------------------------------

/** Définition statique d'une arme (catalogue dans data/). */
export interface WeaponDef {
  id: WeaponDefId;
  name: string;
  ammo: AmmoType;
  damage: number;
  magazineSize: number;
  reloadMs: number;
  /** Intervalle minimal entre deux tirs. */
  fireRateMs: number;
  /** Nombre de projectiles par tir (fusil à pompe > 1). */
  pellets: number;
  /** Dispersion en radians (0 = précis). */
  spread: number;
  /** Vitesse des projectiles en px/s ; croisée au TTL global, détermine la portée. */
  projectileSpeed: number;
}

/** Instance possédée pendant la run, avec son état mutable. */
export interface WeaponInstance {
  defId: WeaponDefId;
  ammoInMag: number;
  /** Timestamp run (ms) jusqu'auquel l'arme recharge ; null sinon. */
  reloadingUntilMs: number | null;
  /** Prochain tir autorisé (ms), pour la cadence. */
  nextShotAtMs: number;
}

// --- Consommables ------------------------------------------------------------

export type ConsumableEffect =
  | { kind: 'heal'; amount: number }
  | { kind: 'cure'; status: 'bleed' }
  | { kind: 'ammo'; ammo: AmmoType; amount: number };

export interface ConsumableDef {
  id: ItemDefId;
  name: string;
  effect: ConsumableEffect;
}

export interface ItemStack {
  defId: ItemDefId;
  count: number;
}

// --- Reliques (modificateurs de run, style Isaac) ----------------------------

/** Effets modélisés en données ; ce sont les systèmes qui les interprètent. */
export type RelicEffect =
  | { kind: 'damageMult'; factor: number }
  | { kind: 'moveSpeedMult'; factor: number }
  | { kind: 'maxHealthAdd'; amount: number }
  | { kind: 'reloadSpeedMult'; factor: number }
  | { kind: 'ammoDropMult'; factor: number };

export interface RelicDef {
  id: RelicDefId;
  name: string;
  description: string;
  effects: RelicEffect[];
}

/** Relique acquise pendant la run (référence la def). */
export interface Relic {
  defId: RelicDefId;
}

// --- Inventaire --------------------------------------------------------------

export interface Inventory {
  ammo: Record<AmmoType, number>;
  weapons: WeaponInstance[];
  /** Index dans `weapons` de l'arme équipée. */
  equippedIndex: number;
  consumables: ItemStack[];
  /** Items d'objectif (clés, codes) — ne comptent pas dans la capacité. */
  keyItems: ItemDefId[];
  /** Nombre max de slots de consommables (inventaire limité = tension). */
  capacity: number;
}
