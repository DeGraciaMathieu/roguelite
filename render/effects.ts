/**
 * Effets éphémères de combat (étincelles, anneaux de mort, fantômes de dash) :
 * état de rendu pur, aucune dépendance à Pixi ni au domaine. Le renderer les
 * alimente par diff d'état et les dessine ; la simulation n'en sait rien.
 * Pool à capacité fixe : zéro allocation par frame en régime de croisière,
 * un pool plein saute l'effet (cosmétique, jamais bloquant).
 */

/** Interrupteur global du feedback de combat (debug/perf). */
export const EFFECTS_ENABLED = true;

export type EffectKind = 'spark' | 'deathRing' | 'dashGhost' | 'pickup';

export interface Effect {
  active: boolean;
  kind: EffectKind;
  x: number;
  y: number;
  /** Vitesse de dérive en px/s (étincelles ; nul pour le reste). */
  vx: number;
  vy: number;
  radius: number;
  color: number;
  ageMs: number;
  durationMs: number;
}

// Durées calibrées « sobres » : survival-horror, pas twin-stick arcade.
export const SPARK_DURATION_MS = 160;
export const DEATH_RING_DURATION_MS = 150;
export const DASH_GHOST_DURATION_MS = 150;
export const PICKUP_DURATION_MS = 180;
export const ENEMY_FLASH_MS = 80;
export const PLAYER_DAMAGE_FLASH_MS = 180;

const SPARK_SPEED = 90;
const POOL_CAPACITY = 64;

export function createEffectPool(): Effect[] {
  return Array.from({ length: POOL_CAPACITY }, () => ({
    active: false,
    kind: 'spark' as EffectKind,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 0,
    color: 0,
    ageMs: 0,
    durationMs: 0,
  }));
}

export function spawnEffect(pool: Effect[], init: Omit<Effect, 'active' | 'ageMs'>): void {
  const slot = pool.find((effect) => !effect.active);
  if (!slot) return;
  Object.assign(slot, init);
  slot.active = true;
  slot.ageMs = 0;
}

/** Quatre étincelles en croix diagonale : motif fixe, déterministe, lisible. */
export function spawnImpactSparks(pool: Effect[], x: number, y: number, color: number): void {
  const diag = Math.SQRT1_2 * SPARK_SPEED;
  for (const [dx, dy] of [
    [diag, diag],
    [diag, -diag],
    [-diag, diag],
    [-diag, -diag],
  ] as const) {
    spawnEffect(pool, {
      kind: 'spark',
      x,
      y,
      vx: dx,
      vy: dy,
      radius: 2,
      color,
      durationMs: SPARK_DURATION_MS,
    });
  }
}

export function spawnDeathRing(pool: Effect[], x: number, y: number, radius: number, color: number): void {
  spawnEffect(pool, { kind: 'deathRing', x, y, vx: 0, vy: 0, radius, color, durationMs: DEATH_RING_DURATION_MS });
}

export function spawnDashGhost(pool: Effect[], x: number, y: number, radius: number, color: number): void {
  spawnEffect(pool, { kind: 'dashGhost', x, y, vx: 0, vy: 0, radius, color, durationMs: DASH_GHOST_DURATION_MS });
}

/** Anneau d'absorption au point de ramassage : se contracte vers le centre (cf. drawEffects). */
export function spawnPickup(pool: Effect[], x: number, y: number, radius: number, color: number): void {
  spawnEffect(pool, { kind: 'pickup', x, y, vx: 0, vy: 0, radius, color, durationMs: PICKUP_DURATION_MS });
}

/** Vieillit, déplace (étincelles) et désactive les effets expirés. */
export function tickEffects(pool: Effect[], dtMs: number): void {
  const dtSec = dtMs / 1000;
  for (const effect of pool) {
    if (!effect.active) continue;
    effect.ageMs += dtMs;
    if (effect.ageMs >= effect.durationMs) {
      effect.active = false;
      continue;
    }
    effect.x += effect.vx * dtSec;
    effect.y += effect.vy * dtSec;
  }
}

/** Progression 0 → 1 de la vie de l'effet (pilote taille et fondu au dessin). */
export function effectProgress(effect: Effect): number {
  return Math.min(1, effect.ageMs / effect.durationMs);
}
