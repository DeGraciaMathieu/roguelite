/**
 * Sprites top-down des dinosaures : découpe de la spritesheet (6 frames de
 * 128×128) en une texture par espèce. Le mapping suit les rôles annotés dans
 * les assets (apercu_topdown_flat.png) : raptor → raptor, t-rex « boss » →
 * boss, tricératops « tank » → théropode, dilophosaure (petit gabarit) →
 * compy. Stégosaure (3) et ptérodactyle (4) restent en réserve.
 */

import { Assets, Rectangle, Texture } from 'pixi.js';
import type { EnemyKind } from '@/domain';
import spritesheetUrl from '../assets/spritesheet_td_128.png';

export const SPRITE_FRAME_SIZE = 128;

/**
 * Le dessin n'occupe pas toute sa frame (marges transparentes) et la
 * silhouette n'est pas circulaire : ajusté 1:1 sur la hitbox il paraît trop
 * petit. On grossit le visuel seul — le rayon de collision ne change pas.
 */
export const SPRITE_VISUAL_SCALE = 2.2;

const FRAME_BY_KIND: Record<EnemyKind, number> = {
  raptor: 0,
  boss: 1,
  theropode: 2,
  compy: 5,
};

export type EnemyTextures = Record<EnemyKind, Texture>;

/**
 * Les sprites regardent vers le haut (−y) : tourner de `facing + π/2` aligne
 * le museau sur le facing du domaine (0 = +x). Symétriques, ils se passent
 * de flip quelle que soit la direction.
 */
export const SPRITE_ROTATION_OFFSET = Math.PI / 2;

export async function loadEnemyTextures(): Promise<EnemyTextures> {
  const sheet = await Assets.load<Texture>(spritesheetUrl);
  const slice = (index: number): Texture =>
    new Texture({
      source: sheet.source,
      frame: new Rectangle(index * SPRITE_FRAME_SIZE, 0, SPRITE_FRAME_SIZE, SPRITE_FRAME_SIZE),
    });
  return {
    raptor: slice(FRAME_BY_KIND.raptor),
    boss: slice(FRAME_BY_KIND.boss),
    theropode: slice(FRAME_BY_KIND.theropode),
    compy: slice(FRAME_BY_KIND.compy),
  };
}
