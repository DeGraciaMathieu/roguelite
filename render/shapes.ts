/**
 * Dessins vectoriels d'appoint au-dessus des sprites : barre de vie ennemie.
 */

import type { Graphics } from 'pixi.js';

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
