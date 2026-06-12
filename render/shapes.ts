/**
 * Formes vectorielles des unités sans sprite : silhouette du joueur et barre
 * de vie ennemie. Paramétrées (position, orientation, rayon, couleur) et
 * inscrites dans le rayon de collision — le visuel ne ment pas sur la hitbox.
 */

import type { Graphics } from 'pixi.js';

const COLOR_OUTLINE = 0x14161a;

/** Canon du joueur : court et épais, seule pièce qui déborde du rayon. */
const BARREL_LENGTH = 9;
const BARREL_HALF_WIDTH = 2.5;

/** Disque couleur santé, liseré sombre, canon épais côté visée. */
export function drawPlayerShape(
  graphics: Graphics,
  x: number,
  y: number,
  radius: number,
  aim: number,
  color: number,
): void {
  const cos = Math.cos(aim);
  const sin = Math.sin(aim);
  const tip = radius + BARREL_LENGTH;
  // Rectangle du canon : de l'axe du joueur vers la visée, dessiné sous le
  // disque pour que seule la partie qui dépasse se voie.
  graphics
    .poly([
      { x: x - sin * BARREL_HALF_WIDTH, y: y + cos * BARREL_HALF_WIDTH },
      { x: x + cos * tip - sin * BARREL_HALF_WIDTH, y: y + sin * tip + cos * BARREL_HALF_WIDTH },
      { x: x + cos * tip + sin * BARREL_HALF_WIDTH, y: y + sin * tip - cos * BARREL_HALF_WIDTH },
      { x: x + sin * BARREL_HALF_WIDTH, y: y - cos * BARREL_HALF_WIDTH },
    ])
    .fill(color)
    .stroke({ width: 1.5, color: COLOR_OUTLINE });
  graphics.circle(x, y, radius).fill(color).stroke({ width: 2, color: COLOR_OUTLINE });
}

const HEALTH_BAR_HEIGHT = 3;
const HEALTH_BAR_OFFSET = 7;
const COLOR_HEALTH_BAR_BG = 0x14161a;
const COLOR_HEALTH_BAR = 0xe5533d;

/** Fine barre au-dessus de l'unité ; à n'appeler que pour les blessés. */
export function drawEnemyHealthBar(
  graphics: Graphics,
  x: number,
  y: number,
  radius: number,
  ratio: number,
): void {
  const width = radius * 2;
  const barX = x - radius;
  const barY = y - radius - HEALTH_BAR_OFFSET;
  graphics.rect(barX, barY, width, HEALTH_BAR_HEIGHT).fill(COLOR_HEALTH_BAR_BG);
  graphics.rect(barX, barY, width * Math.max(0, ratio), HEALTH_BAR_HEIGHT).fill(COLOR_HEALTH_BAR);
}
