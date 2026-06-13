/**
 * Constantes d'équilibrage. Données statiques, pas de logique.
 */

import type { AmmoType } from '@/domain';

/** Vitesse de déplacement du joueur, en pixels monde par seconde. */
export const PLAYER_MOVE_SPEED = 220;

/** Dash : poussée brève à direction figée, puis temps mort. */
export const DASH_SPEED = 620;
export const DASH_DURATION_MS = 150;
export const DASH_COOLDOWN_MS = 800;

export const PLAYER_RADIUS = 12;

export const PLAYER_MAX_HEALTH = 100;

/** Réserve de départ par type de munitions (seule celle de l'arme équipée est servie). */
export const START_AMMO: Record<AmmoType, number> = { handgun: 24, shotgun: 12, rifle: 10 };

/** Épaisseur des murs pleins entourant une salle. */
export const WALL_THICKNESS = 16;

/** Durée de vie max d'un projectile avant disparition. */
export const PROJECTILE_TTL_MS = 1500;

/** Rayon de rendu des projectiles (la collision, elle, est ponctuelle). */
export const PROJECTILE_RADIUS = 3;

/** Distance de ramassage du loot, au-delà du rayon du joueur. */
export const LOOT_PICKUP_RADIUS = 12;

/** Côté des dalles de la salle exit (escalier, extraction). */
export const STAIR_ZONE_SIZE = 64;

/**
 * Décalage horizontal des dalles par rapport au centre de la salle exit.
 * Borne à respecter : offset + taille/2 ≤ 80 (la clairance que la procgen
 * garantit autour du centre), sinon une dalle peut chevaucher un obstacle.
 */
export const EXIT_ZONE_OFFSET = 48;

/** Étage (index 0-based) à partir duquel la dalle d'extraction apparaît. */
export const EXTRACTION_MIN_FLOOR = 1;

// --- Saignement -----------------------------------------------------------------

/** 8 s à 2 PV/s = 16 PV : ~une morsure de raptor en plus si on ne se soigne pas. */
export const BLEED_DURATION_MS = 8000;
export const BLEED_DPS = 2;

// --- Récompenses méta ---------------------------------------------------------

export const CURRENCY_PER_KILL = 5;
export const CURRENCY_PER_FLOOR = 25;
/** Chaque étage descendu rapporte ça de plus que le précédent : le risque de la profondeur paie. */
export const CURRENCY_FLOOR_DEPTH_BONUS = 10;
/** S'extraire vivant rapporte plus que mourir au même point de la descente. */
export const EXTRACTION_BONUS_MULTIPLIER = 1.5;
