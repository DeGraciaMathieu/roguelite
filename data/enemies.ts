/**
 * Archétypes d'ennemis : données d'équilibrage pures, interprétées par les
 * systèmes (spawn, IA). Les différences de comportement raptor/compy passent
 * par ces stats, pas par du code spécifique.
 */

import type { EnemyKind } from '@/domain';

export interface EnemyArchetype {
  maxHealth: number;
  radius: number;
  /** Vitesse de chasse, en px/s (la patrouille va à mi-vitesse). */
  moveSpeed: number;
  /** Distance de détection du joueur (si ligne de vue dégagée). */
  aggroRadius: number;
  /** Distance d'attaque bord à bord (au-delà du contact des cercles). */
  attackRange: number;
  attackDamage: number;
  attackCooldownMs: number;
  /** Amplitude de la boucle de patrouille autour du point de spawn. */
  patrolRadius: number;
}

/** Coordination de meute des raptors (géométrie pure, pas d'aléa). */
export const RAPTOR_PACK = {
  /** Rayon du cercle d'encerclement autour du joueur. */
  flankRadius: 140,
  /** Écart angulaire entre deux membres sur le cercle (rad). */
  flankAngleStep: 0.9,
} as const;

export const ENEMY_ARCHETYPES: Record<EnemyKind, EnemyArchetype> = {
  /** Légèrement plus rapide que le joueur : fuir ne suffit pas, il faut tirer. */
  raptor: {
    maxHealth: 30,
    radius: 14,
    moveSpeed: 235,
    aggroRadius: 260,
    attackRange: 6,
    attackDamage: 15,
    attackCooldownMs: 900,
    patrolRadius: 120,
  },
  /** Faible et lent, mais nombreux : du harcèlement, pas une menace seule. */
  compy: {
    maxHealth: 10,
    radius: 8,
    moveSpeed: 180,
    aggroRadius: 200,
    attackRange: 4,
    attackDamage: 5,
    attackCooldownMs: 700,
    patrolRadius: 80,
  },
  /**
   * Mini-boss (étage 3+, 1 max par étage) : lent mais tanky, il force le kite
   * autour des obstacles et la gestion de munitions. 120 PV = 12 balles de
   * handgun : tuable en un chargeur, la recharge sert de marge d'erreur.
   */
  theropode: {
    maxHealth: 120,
    radius: 26,
    moveSpeed: 120,
    aggroRadius: 300,
    attackRange: 10,
    attackDamage: 35,
    attackCooldownMs: 1500,
    patrolRadius: 60,
  },
  // Placeholder : jamais spawné pour l'instant, le Record exige toutes les clés.
  boss: {
    maxHealth: 400,
    radius: 36,
    moveSpeed: 140,
    aggroRadius: 10_000,
    attackRange: 12,
    attackDamage: 40,
    attackCooldownMs: 1200,
    patrolRadius: 0,
  },
};
