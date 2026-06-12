/**
 * Formes vectorielles des unités sans sprite : silhouette du joueur et barre
 * de vie ennemie. Paramétrées (position, orientation, rayon, couleur) et
 * inscrites dans le rayon de collision — le visuel ne ment pas sur la hitbox.
 */

import type { Graphics } from 'pixi.js';
import type { AmmoType } from '@/domain';

const COLOR_OUTLINE = 0x14161a;

/**
 * Canon du joueur, seule pièce qui déborde du rayon : sa silhouette et sa
 * couleur signent l'arme équipée. Couleurs alignées sur le loot de munitions
 * (jaune handgun, orange shotgun, bleu-gris rifle) : un seul langage visuel.
 */
interface BarrelStyle {
  length: number;
  halfWidth: number;
  color: number;
}

const BARREL_BY_AMMO: Record<AmmoType, BarrelStyle> = {
  handgun: { length: 9, halfWidth: 2.5, color: 0xf0c33c },
  shotgun: { length: 7, halfWidth: 3.6, color: 0xe07b39 },
  rifle: { length: 16, halfWidth: 1.8, color: 0x9bd0d0 },
};

/** Disque couleur santé, liseré sombre, canon signant l'arme côté visée. */
export function drawPlayerShape(
  graphics: Graphics,
  x: number,
  y: number,
  radius: number,
  aim: number,
  color: number,
  ammo: AmmoType,
): void {
  const barrel = BARREL_BY_AMMO[ammo];
  const cos = Math.cos(aim);
  const sin = Math.sin(aim);
  const tip = radius + barrel.length;
  // Rectangle du canon : de l'axe du joueur vers la visée, dessiné sous le
  // disque pour que seule la partie qui dépasse se voie.
  graphics
    .poly([
      { x: x - sin * barrel.halfWidth, y: y + cos * barrel.halfWidth },
      { x: x + cos * tip - sin * barrel.halfWidth, y: y + sin * tip + cos * barrel.halfWidth },
      { x: x + cos * tip + sin * barrel.halfWidth, y: y + sin * tip - cos * barrel.halfWidth },
      { x: x + sin * barrel.halfWidth, y: y - cos * barrel.halfWidth },
    ])
    .fill(barrel.color)
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
