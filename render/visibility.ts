/**
 * Visibilité à l'échelle de la salle : un halo court tout autour du joueur et
 * un cône étendu dans la direction de visée, plus ligne de vue par entité
 * (pas de shadowcasting). Fonctions pures, côté rendu uniquement — la
 * simulation (IA comprise) ignore totalement cette notion. Les fosses ne
 * coupent pas la vue : l'appelant ne passe que les obstacles pleins.
 */

import type { Rect, Vec2 } from '@/domain';
import { segmentIntersectsRect } from '@/systems/collision';

/** Halo de proximité, dans toutes les directions : on n'est jamais aveugle au contact. */
export const VISION_NEAR_RADIUS = 120;
/** Portée de la vision dans le cône de visée (~lampe), au-delà de l'aggro raptor (260). */
export const VISION_CONE_RADIUS = 340;
/** Demi-angle du cône : 36° de part et d'autre de la visée, soit 72° d'ouverture. */
export const VISION_CONE_HALF_ANGLE = Math.PI / 5;

/** Écart angulaire absolu entre deux angles, replié sur [0, π]. */
function angleDiff(a: number, b: number): number {
  let diff = (a - b) % (2 * Math.PI);
  if (diff > Math.PI) diff -= 2 * Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  return Math.abs(diff);
}

export function isVisible(from: Vec2, aim: number, to: Vec2, obstacles: readonly Rect[]): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distSq = dx * dx + dy * dy;
  const inNearHalo = distSq <= VISION_NEAR_RADIUS * VISION_NEAR_RADIUS;
  const inCone =
    !inNearHalo &&
    distSq <= VISION_CONE_RADIUS * VISION_CONE_RADIUS &&
    angleDiff(Math.atan2(dy, dx), aim) <= VISION_CONE_HALF_ANGLE;
  if (!inNearHalo && !inCone) return false;
  return !obstacles.some((rect) => segmentIntersectsRect(from, to, rect));
}

const FAR_ARC_STEPS = 24;
const NEAR_ARC_STEPS = 32;

/**
 * Contour « trou de serrure » de la zone vue (union halo + cône), prêt à être
 * découpé dans le voile d'obscurité : arc lointain le long du cône, puis
 * retour par l'arc court qui fait le tour du joueur.
 */
export function visionPolygon(from: Vec2, aim: number): Vec2[] {
  const points: Vec2[] = [];
  for (let i = 0; i <= FAR_ARC_STEPS; i += 1) {
    const angle = aim - VISION_CONE_HALF_ANGLE + (2 * VISION_CONE_HALF_ANGLE * i) / FAR_ARC_STEPS;
    points.push({
      x: from.x + Math.cos(angle) * VISION_CONE_RADIUS,
      y: from.y + Math.sin(angle) * VISION_CONE_RADIUS,
    });
  }
  const backSpan = 2 * Math.PI - 2 * VISION_CONE_HALF_ANGLE;
  for (let i = 0; i <= NEAR_ARC_STEPS; i += 1) {
    const angle = aim + VISION_CONE_HALF_ANGLE + (backSpan * i) / NEAR_ARC_STEPS;
    points.push({
      x: from.x + Math.cos(angle) * VISION_NEAR_RADIUS,
      y: from.y + Math.sin(angle) * VISION_NEAR_RADIUS,
    });
  }
  return points;
}
