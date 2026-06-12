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
export const VISION_CONE_RADIUS = 480;
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

/** Échantillonnage radial uniforme du tour complet. */
const RAY_SAMPLES = 96;
/** Décalage angulaire des rayons doublés (coins, bords de cône) : ~0.05 px à 480 px. */
const RAY_EPSILON = 1e-4;

/**
 * Premier point d'entrée d'un rayon (direction unitaire) dans un rect, en
 * pixels depuis l'origine ; Infinity si le rayon ne le traverse pas avant maxT.
 */
function rayRectEntry(from: Vec2, dirX: number, dirY: number, rect: Rect, maxT: number): number {
  let tMin = 0;
  let tMax = maxT;
  const axes = [
    { origin: from.x, delta: dirX, lo: rect.x, hi: rect.x + rect.w },
    { origin: from.y, delta: dirY, lo: rect.y, hi: rect.y + rect.h },
  ];
  for (const { origin, delta, lo, hi } of axes) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < lo || origin > hi) return Infinity;
      continue;
    }
    const t1 = (lo - origin) / delta;
    const t2 = (hi - origin) / delta;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return Infinity;
  }
  return tMin;
}

/**
 * Contour de la zone réellement vue : trou de serrure (halo + cône) dont
 * chaque rayon est borné par le premier obstacle rencontré — les piliers
 * portent une ombre. Polygone « en étoile » autour de l'œil (sommets triés
 * par angle), donc simple et sûr à trianguler. En plus de l'échantillonnage
 * uniforme, des rayons sont lancés vers les bords du cône et les coins des
 * obstacles (±ε) pour garder les transitions nettes.
 */
export function visionPolygon(from: Vec2, aim: number, obstacles: readonly Rect[]): Vec2[] {
  const angles: number[] = [];
  for (let i = 0; i < RAY_SAMPLES; i += 1) {
    angles.push(-Math.PI + (2 * Math.PI * i) / RAY_SAMPLES);
  }
  for (const edge of [aim - VISION_CONE_HALF_ANGLE, aim + VISION_CONE_HALF_ANGLE]) {
    angles.push(edge - RAY_EPSILON, edge + RAY_EPSILON);
  }
  for (const rect of obstacles) {
    for (const corner of [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x, y: rect.y + rect.h },
      { x: rect.x + rect.w, y: rect.y + rect.h },
    ]) {
      const angle = Math.atan2(corner.y - from.y, corner.x - from.x);
      angles.push(angle - RAY_EPSILON, angle + RAY_EPSILON);
    }
  }

  // Repli sur (-π, π] puis tri : l'ordre angulaire garantit un polygone simple.
  for (let i = 0; i < angles.length; i += 1) {
    let angle = angles[i]! % (2 * Math.PI);
    if (angle <= -Math.PI) angle += 2 * Math.PI;
    if (angle > Math.PI) angle -= 2 * Math.PI;
    angles[i] = angle;
  }
  angles.sort((a, b) => a - b);

  const points: Vec2[] = [];
  for (const angle of angles) {
    const reach =
      angleDiff(angle, aim) <= VISION_CONE_HALF_ANGLE ? VISION_CONE_RADIUS : VISION_NEAR_RADIUS;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    let t = reach;
    for (const rect of obstacles) {
      t = Math.min(t, rayRectEntry(from, dirX, dirY, rect, reach));
    }
    points.push({ x: from.x + dirX * t, y: from.y + dirY * t });
  }
  return points;
}
