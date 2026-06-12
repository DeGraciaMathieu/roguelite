/**
 * Primitives partagées du domaine.
 * Pur, sérialisable, aucune dépendance au rendu.
 */

// --- IDs typés (branded) -----------------------------------------------------
// Empêche de mélanger un RoomId avec un DoorId, etc., au prix d'un cast explicite
// à la création (volontaire : la création d'ID passe par un seul endroit).

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type EntityId = Brand<string, 'EntityId'>;
export type RoomId = Brand<string, 'RoomId'>;
export type DoorId = Brand<string, 'DoorId'>;

// IDs référençant des définitions statiques (data/), pas des instances.
export type WeaponDefId = Brand<string, 'WeaponDefId'>;
export type ItemDefId = Brand<string, 'ItemDefId'>;
export type RelicDefId = Brand<string, 'RelicDefId'>;
export type UnlockId = Brand<string, 'UnlockId'>;

/** Cast contrôlé string -> ID branded. À n'utiliser qu'aux frontières (data, génération). */
export function asId<B extends string>(raw: string): Brand<string, B> {
  return raw as Brand<string, B>;
}

// --- Géométrie ---------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

/** Rectangle aligné sur les axes, en coordonnées monde. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// --- RNG déterministe --------------------------------------------------------
// L'état du RNG est une donnée que l'on fait avancer explicitement (pas de
// global caché). Garantit le déterminisme : même seed -> même séquence.

export interface RngState {
  /** Seed d'origine, conservée pour affichage / rejouabilité. */
  readonly seed: number;
  /** Curseur interne, muté à chaque tirage. */
  cursor: number;
}

export function createRng(seed: number): RngState {
  return { seed, cursor: seed >>> 0 };
}

/** mulberry32 : retourne un flottant [0, 1) et fait avancer l'état en place. */
export function nextFloat(rng: RngState): number {
  rng.cursor = (rng.cursor + 0x6d2b79f5) | 0;
  let t = rng.cursor;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Entier dans [min, max] inclus. */
export function nextInt(rng: RngState, min: number, max: number): number {
  return min + Math.floor(nextFloat(rng) * (max - min + 1));
}

export function pick<T>(rng: RngState, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() sur un tableau vide');
  return items[nextInt(rng, 0, items.length - 1)]!;
}
