/**
 * Navigation locale à la salle pour les agents : grille grossière (obstacles
 * et fosses gonflés du rayon du joueur), BFS depuis la position du joueur,
 * suivi de chemin avec lissage par ligne droite. Entièrement déterministe.
 *
 * Sans cela, un suivi direct + pas de côté ne sort pas des poches concaves
 * (cloisons en L) et ne sait pas dire qu'une cible est injoignable.
 */

import type { Rect, Room, Vec2 } from '@/domain';
import { WALL_THICKNESS } from '@/data/balance';
import { segmentIntersectsRect } from '@/systems/collision';

export const NAV_CELL = 16;
const CELL = NAV_CELL;

/**
 * Seuil d'arrivée : doit dépasser la distance parcourue en un tick
 * (220 px/s / 60 ≈ 3,7 px, marge pour les reliques de vitesse), sinon le
 * joueur survole la cible à chaque tick sans jamais « arriver » et oscille.
 */
export const ARRIVAL_RADIUS = 6;

export interface RoomNav {
  /**
   * Le point est-il atteignable à pied depuis la position de départ ?
   * `maxStandoff` : distance max tolérée entre le meilleur poste praticable et
   * le point (ex. rayon de ramassage pour un loot — pouvoir s'approcher « pas
   * trop loin » ne suffit pas s'il faut un contact).
   */
  reachable(point: Vec2, maxStandoff?: number): boolean;
  /**
   * Direction unitaire du prochain pas de `from` vers `to` ; null si atteint
   * ou injoignable. `from` est passé frais à chaque appel : le flood, lui,
   * peut être mis en cache tant qu'on reste dans la même cellule.
   */
  stepToward(from: Vec2, to: Vec2): Vec2 | null;
}

function inflate(rect: Rect, by: number): Rect {
  return { x: rect.x - by, y: rect.y - by, w: rect.w + 2 * by, h: rect.h + 2 * by };
}

/**
 * `avoid` : zones sans collision physique mais à ne jamais traverser (ex. la
 * dalle d'escalier quand on vise la dalle d'extraction voisine — la toucher
 * déclencherait une descente non voulue).
 */
export function buildRoomNav(
  room: Room,
  from: Vec2,
  radius: number,
  avoid: readonly Rect[] = [],
): RoomNav {
  const bounds = room.bounds;
  const cols = Math.floor(bounds.w / CELL);
  const rows = Math.floor(bounds.h / CELL);
  const inset = WALL_THICKNESS + radius;
  // Les zones `avoid` se déclenchent au contact du cercle joueur : marge
  // supplémentaire d'une demi-cellule pour qu'un segment entre deux centres
  // de cellules libres ne puisse pas les frôler.
  const solids = [
    ...[...room.obstacles, ...room.pits].map((rect) => inflate(rect, radius)),
    ...avoid.map((rect) => inflate(rect, radius + CELL / 2 + 2)),
  ];

  const cellCenter = (col: number, row: number): Vec2 => ({
    x: bounds.x + (col + 0.5) * CELL,
    y: bounds.y + (row + 0.5) * CELL,
  });

  // Échantillonnage au centre de cellule : avec CELL < largeur min des passages
  // (gonflés), aucun couloir réel ne se referme sur la grille.
  const isSolid = (col: number, row: number): boolean => {
    const center = cellCenter(col, row);
    if (
      center.x < bounds.x + inset ||
      center.x > bounds.x + bounds.w - inset ||
      center.y < bounds.y + inset ||
      center.y > bounds.y + bounds.h - inset
    ) {
      return true;
    }
    return solids.some(
      (rect) =>
        center.x >= rect.x &&
        center.x <= rect.x + rect.w &&
        center.y >= rect.y &&
        center.y <= rect.y + rect.h,
    );
  };

  const clampToWalkable = (point: Vec2): Vec2 => ({
    x: Math.min(Math.max(point.x, bounds.x + inset), bounds.x + bounds.w - inset),
    y: Math.min(Math.max(point.y, bounds.y + inset), bounds.y + bounds.h - inset),
  });

  const cellOf = (point: Vec2): { col: number; row: number } => ({
    col: Math.min(Math.max(Math.floor((point.x - bounds.x) / CELL), 0), cols - 1),
    row: Math.min(Math.max(Math.floor((point.y - bounds.y) / CELL), 0), rows - 1),
  });

  /**
   * Cellule libre la plus proche du point réel, en anneaux croissants.
   * Le choix au plus près du point (et non au premier de l'ordre de balayage)
   * est important : un joueur qui glisse sur la frontière d'un solide gonflé
   * changerait sinon de cellule de départ d'un tick à l'autre, et le chemin
   * basculerait d'un côté à l'autre de l'obstacle (oscillation sur place).
   */
  const nearestFreeCell = (col: number, row: number, ref: Vec2): number => {
    for (let ring = 0; ring <= 3; ring += 1) {
      let best = -1;
      let bestDist = Infinity;
      for (let dr = -ring; dr <= ring; dr += 1) {
        for (let dc = -ring; dc <= ring; dc += 1) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          const c = col + dc;
          const r = row + dr;
          if (c < 0 || c >= cols || r < 0 || r >= rows || isSolid(c, r)) continue;
          const center = cellCenter(c, r);
          const dist = (center.x - ref.x) ** 2 + (center.y - ref.y) ** 2;
          if (dist < bestDist) {
            best = r * cols + c;
            bestDist = dist;
          }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  };

  // BFS 4-directionnel depuis la cellule du joueur ; `parent` permet de
  // remonter un chemin depuis n'importe quelle cellule atteinte.
  const parent = new Int32Array(cols * rows).fill(-2); // -2 = non visité
  const startCell = cellOf(from);
  const start = nearestFreeCell(startCell.col, startCell.row, from);
  if (start >= 0) {
    parent[start] = -1; // -1 = racine
    const queue: number[] = [start];
    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head];
      if (index === undefined) break;
      const col = index % cols;
      const row = Math.floor(index / cols);
      const neighbors = [
        [col + 1, row],
        [col - 1, row],
        [col, row + 1],
        [col, row - 1],
      ] as const;
      for (const [c, r] of neighbors) {
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        const next = r * cols + c;
        if (parent[next] !== -2 || isSolid(c, r)) continue;
        parent[next] = index;
        queue.push(next);
      }
    }
  }

  const targetIndex = (point: Vec2): number => {
    const clamped = clampToWalkable(point);
    const cell = cellOf(clamped);
    const index = nearestFreeCell(cell.col, cell.row, clamped);
    if (index < 0) return -1;
    return parent[index] === -2 ? -1 : index;
  };

  const straightLineClear = (a: Vec2, b: Vec2): boolean =>
    !solids.some((rect) => segmentIntersectsRect(a, b, rect));

  return {
    reachable(point: Vec2, maxStandoff = Infinity): boolean {
      const index = targetIndex(point);
      if (index < 0) return false;
      const center = cellCenter(index % cols, Math.floor(index / cols));
      return Math.hypot(center.x - point.x, center.y - point.y) <= maxStandoff;
    },

    stepToward(from: Vec2, to: Vec2): Vec2 | null {
      const goal = clampToWalkable(to);
      // Ligne droite dégagée : pas besoin de la grille.
      if (straightLineClear(from, goal)) {
        const dx = goal.x - from.x;
        const dy = goal.y - from.y;
        const len = Math.hypot(dx, dy);
        if (len < ARRIVAL_RADIUS) return null;
        return { x: dx / len, y: dy / len };
      }

      const index = targetIndex(to);
      if (index < 0) return null;
      // Chemin cellule de la cible → joueur, remis dans le sens joueur → cible.
      const path: number[] = [];
      for (let cursor = index; cursor >= 0; cursor = parent[cursor] ?? -1) {
        path.push(cursor);
      }
      path.reverse();

      // Cible dans la cellule du joueur : cap direct (l'arrivée se juge sur elle).
      if (path.length < 2) {
        const dx = goal.x - from.x;
        const dy = goal.y - from.y;
        const len = Math.hypot(dx, dy);
        if (len < ARRIVAL_RADIUS) return null;
        return { x: dx / len, y: dy / len };
      }

      // Lissage : viser la dalle la plus lointaine du chemin joignable en ligne
      // droite — uniquement parmi les dalles *en avant* (path[0] est la cellule
      // du joueur : la viser ferait osciller sur place), repli sur la suivante.
      let waypoint: Vec2 | null = null;
      for (let i = 1; i < path.length; i += 1) {
        const cell = path[i];
        if (cell === undefined) break;
        const center = cellCenter(cell % cols, Math.floor(cell / cols));
        const reachableInLine =
          Math.hypot(center.x - from.x, center.y - from.y) >= ARRIVAL_RADIUS &&
          straightLineClear(from, center);
        if (reachableInLine) waypoint = center;
      }
      const next = path[1];
      const aim =
        waypoint ?? (next !== undefined ? cellCenter(next % cols, Math.floor(next / cols)) : goal);
      const dx = aim.x - from.x;
      const dy = aim.y - from.y;
      const len = Math.hypot(dx, dy);
      if (len < ARRIVAL_RADIUS) return null;
      return { x: dx / len, y: dy / len };
    },
  };
}
