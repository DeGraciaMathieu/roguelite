/**
 * Entités vivantes de la run et leur état.
 * Pur, sérialisable.
 */

import type { EntityId, Vec2 } from './core';
import type { WeaponInstance, AmmoType } from './items';

// --- Santé -------------------------------------------------------------------

export type HealthState = 'fine' | 'caution' | 'danger';

export interface Health {
  current: number;
  max: number;
}

/** État dérivé (jamais stocké) : seuils Fine / Caution / Danger. */
export function healthState(h: Health): HealthState {
  const ratio = h.current / h.max;
  if (ratio > 0.6) return 'fine';
  if (ratio > 0.25) return 'caution';
  return 'danger';
}

export function isDead(h: Health): boolean {
  return h.current <= 0;
}

// --- Joueur ------------------------------------------------------------------

export interface DashState {
  /** Durée restante du dash en cours (0 = au sol). */
  remainingMs: number;
  /** Direction figée au déclenchement. */
  dir: Vec2;
  /** Temps avant le prochain dash possible. */
  cooldownMs: number;
}

export interface Player {
  pos: Vec2;
  vel: Vec2;
  /** Angle de visée en radians (suit la souris). */
  aim: number;
  radius: number;
  health: Health;
  dash: DashState;
  /** Statut altéré éventuel (poison à la Dino Crisis, saignement…). */
  status: StatusEffect[];
}

export type StatusEffect =
  | { kind: 'bleed'; remainingMs: number; dps: number }
  | { kind: 'stun'; remainingMs: number };

// --- Ennemis -----------------------------------------------------------------

export type AiPhase = 'idle' | 'patrol' | 'chase' | 'attack';

export interface AiState {
  phase: AiPhase;
  /** Cible courante (en général le joueur), si repérée. */
  targetId?: EntityId;
  /** Dernière position connue de la cible (pour la perte de vue). */
  lastKnownTarget?: Vec2;
  /** Cooldown avant la prochaine attaque possible. */
  attackCooldownMs: number;
  /** Index sur le chemin de patrouille, si applicable. */
  patrolIndex: number;
}

interface EnemyBase {
  id: EntityId;
  pos: Vec2;
  vel: Vec2;
  facing: number;
  radius: number;
  health: Health;
  ai: AiState;
  /** Chemin de patrouille fixé au spawn (boucle), indexé par ai.patrolIndex. */
  patrolPath: Vec2[];
}

/** Rapide, chasse en meute, tente de flanquer. */
export interface Raptor extends EnemyBase {
  kind: 'raptor';
  /** Identifiant de meute, pour la coordination de flanc. */
  packId: number | null;
}

/** Faible mais en essaim, harcèlement. */
export interface Compy extends EnemyBase {
  kind: 'compy';
}

/** Lent, tanky, gros dégâts — mini-boss d'étage. */
export interface Theropode extends EnemyBase {
  kind: 'theropode';
}

/** Boss d'étage majeur, pattern dédié. */
export interface Boss extends EnemyBase {
  kind: 'boss';
  pattern: BossPattern;
  /** Phase courante du combat (enrage, etc.). */
  phaseIndex: number;
}

export type BossPattern = 'charge' | 'sweep' | 'roar-summon';

/** Union discriminée sur `kind` : exhaustivité vérifiée par le compilateur. */
export type Enemy = Raptor | Compy | Theropode | Boss;

export type EnemyKind = Enemy['kind'];

// --- Projectiles -------------------------------------------------------------

export interface Projectile {
  id: EntityId;
  pos: Vec2;
  vel: Vec2;
  damage: number;
  ammo: AmmoType;
  /** Émetteur, pour ignorer les collisions avec soi-même. */
  ownerId: EntityId | 'player';
  /** Durée de vie restante avant disparition. */
  ttlMs: number;
}

/** Forme minimale d'un tir : à enrichir par le système de combat. */
export type FireIntent = {
  weapon: WeaponInstance;
  origin: Vec2;
  angle: number;
};
