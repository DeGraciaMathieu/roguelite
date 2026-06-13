/**
 * Géométrie de collision pure : cercles (entités) contre rectangles pleins
 * (murs, obstacles). Fonctions pures sur les types du domaine uniquement.
 */

import type { Rect, Vec2 } from '@/domain';
import { WALL_THICKNESS } from '@/data/balance';

export function pointInRect(point: Vec2, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

export function circleIntersectsRect(center: Vec2, radius: number, rect: Rect): boolean {
  // Distance du centre au point du rect le plus proche : couvre faces et coins.
  const nearestX = Math.min(Math.max(center.x, rect.x), rect.x + rect.w);
  const nearestY = Math.min(Math.max(center.y, rect.y), rect.y + rect.h);
  const dx = center.x - nearestX;
  const dy = center.y - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

/** Les quatre murs pleins d'une salle, sous forme de rects en coordonnées monde. */
export function wallRects(bounds: Rect): Rect[] {
  const { x, y, w, h } = bounds;
  const t = WALL_THICKNESS;
  return [
    { x, y, w, h: t },
    { x, y: y + h - t, w, h: t },
    { x, y, w: t, h },
    { x: x + w - t, y, w: t, h },
  ];
}

/**
 * Le segment [a, b] traverse-t-il le rect ? Méthode des slabs (intersection
 * des intervalles paramétriques sur chaque axe). Sert au raycast de ligne
 * de vue de l'IA.
 */
export function segmentIntersectsRect(a: Vec2, b: Vec2, rect: Rect): boolean {
  const deltas = [
    { origin: a.x, delta: b.x - a.x, lo: rect.x, hi: rect.x + rect.w },
    { origin: a.y, delta: b.y - a.y, lo: rect.y, hi: rect.y + rect.h },
  ];
  let tMin = 0;
  let tMax = 1;
  for (const { origin, delta, lo, hi } of deltas) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < lo || origin > hi) return false;
      continue;
    }
    const t1 = (lo - origin) / delta;
    const t2 = (hi - origin) / delta;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return false;
  }
  return true;
}

/**
 * Premier contact du segment [a, b] avec le cercle (center, radius). Renvoie le
 * t ∈ [0, 1] du point d'entrée le long du segment, ou null si le segment ne
 * s'approche jamais à `radius` du centre. Si a est déjà dans le cercle, renvoie 0.
 *
 * Borne inclusive (distance <= radius) pour rester cohérent avec le test ponctuel
 * d'impact ennemi (dx²+dy² <= r²) : un contact tangent compte comme une touche.
 * Sert à la collision balayée des projectiles, où le t départage plusieurs
 * contacts le long d'un même tick.
 */
export function segmentIntersectsCircle(
  a: Vec2,
  b: Vec2,
  center: Vec2,
  radius: number,
): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - center.x;
  const fy = a.y - center.y;

  // a déjà dans le cercle : contact immédiat au début du segment.
  if (fx * fx + fy * fy <= radius * radius) return 0;

  // |f + t·d|² = r² → A t² + B t + C = 0.
  const A = dx * dx + dy * dy;
  if (A < 1e-12) return null; // segment dégénéré : a hors du cercle (déjà testé).
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - radius * radius;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;

  const t = (-B - Math.sqrt(disc)) / (2 * A);
  if (t < 0 || t > 1) return null;
  return t;
}

/**
 * Déplace un cercle en résolvant chaque axe séparément : si l'axe X mène dans
 * un solide, seul X est annulé — l'entité glisse le long des parois au lieu
 * de s'arrêter net sur un contact diagonal.
 */
export function moveCircle(
  pos: Vec2,
  radius: number,
  delta: Vec2,
  solids: readonly Rect[],
): Vec2 {
  const next: Vec2 = { x: pos.x, y: pos.y };

  next.x += delta.x;
  if (solids.some((solid) => circleIntersectsRect(next, radius, solid))) {
    next.x = pos.x;
  }
  next.y += delta.y;
  if (solids.some((solid) => circleIntersectsRect(next, radius, solid))) {
    next.y = pos.y;
  }
  return next;
}
