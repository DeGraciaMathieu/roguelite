/**
 * Chargement des textures du jeu : spritesheet des dinosaures (6 frames de
 * 128×128, mapping par rôle annoté dans apercu_topdown_flat.png) et fichiers
 * individuels pour le joueur, les tuiles, les props, les portes et le loot.
 * Tout ce qui s'oriente regarde vers le haut (−y) : tourner de
 * `facing + SPRITE_ROTATION_OFFSET` aligne le museau sur le facing du
 * domaine (0 = +x).
 */

import { Assets, Rectangle, Texture } from 'pixi.js';
import type { AmmoType, EnemyKind } from '@/domain';
import spritesheetUrl from '../assets/spritesheet_td_128.png';
import playerHandgunUrl from '../assets/player_handgun_td_64.png';
import playerShotgunUrl from '../assets/player_shotgun_td_64.png';
import playerRifleUrl from '../assets/player_rifle_td_64.png';
import tileFloorUrl from '../assets/tile_floor_64.png';
import tileWallUrl from '../assets/tile_wall_64.png';
import tilePitUrl from '../assets/tile_pit_64.png';
import crateUrl from '../assets/crate_64.png';
import pillarUrl from '../assets/pillar_64.png';
import shelfUrl from '../assets/shelf_128x32.png';
import doorUrl from '../assets/door_64x16.png';
import doorLockedUrl from '../assets/door_locked_64x16.png';
import stairsUrl from '../assets/stairs_64.png';
import extractionUrl from '../assets/extraction_64.png';
import ammoHandgunUrl from '../assets/ammo_handgun_32.png';
import ammoShotgunUrl from '../assets/ammo_shotgun_32.png';
import ammoRifleUrl from '../assets/ammo_rifle_32.png';
import medkitUrl from '../assets/medkit_32.png';
import bandageUrl from '../assets/bandage_32.png';
import keyUrl from '../assets/key_32.png';
import relicUrl from '../assets/relic_32.png';

export const SPRITE_FRAME_SIZE = 128;

/**
 * Le dessin n'occupe pas toute sa frame (marges transparentes) et la
 * silhouette n'est pas circulaire : ajusté 1:1 sur la hitbox il paraît trop
 * petit. On grossit le visuel seul — le rayon de collision ne change pas.
 */
export const SPRITE_VISUAL_SCALE = 2.6;

/** Les sprites orientés regardent vers le haut (−y) ; le facing domaine vaut 0 vers +x. */
export const SPRITE_ROTATION_OFFSET = Math.PI / 2;

const ENEMY_FRAME_BY_KIND: Record<EnemyKind, number> = {
  raptor: 0,
  boss: 1,
  theropode: 2,
  compy: 5,
};

export interface GameTextures {
  enemies: Record<EnemyKind, Texture>;
  player: Record<AmmoType, Texture>;
  tiles: { floor: Texture; wall: Texture; pit: Texture };
  props: { crate: Texture; pillar: Texture; shelf: Texture };
  doors: { unlocked: Texture; locked: Texture };
  zones: { stairs: Texture; extraction: Texture };
  loot: {
    ammo: Record<AmmoType, Texture>;
    medkit: Texture;
    bandage: Texture;
    key: Texture;
    relic: Texture;
  };
}

export async function loadGameTextures(): Promise<GameTextures> {
  const [
    sheet,
    playerHandgun,
    playerShotgun,
    playerRifle,
    tileFloor,
    tileWall,
    tilePit,
    crate,
    pillar,
    shelf,
    door,
    doorLocked,
    stairs,
    extraction,
    ammoHandgun,
    ammoShotgun,
    ammoRifle,
    medkit,
    bandage,
    key,
    relic,
  ] = await Promise.all([
    Assets.load<Texture>(spritesheetUrl),
    Assets.load<Texture>(playerHandgunUrl),
    Assets.load<Texture>(playerShotgunUrl),
    Assets.load<Texture>(playerRifleUrl),
    Assets.load<Texture>(tileFloorUrl),
    Assets.load<Texture>(tileWallUrl),
    Assets.load<Texture>(tilePitUrl),
    Assets.load<Texture>(crateUrl),
    Assets.load<Texture>(pillarUrl),
    Assets.load<Texture>(shelfUrl),
    Assets.load<Texture>(doorUrl),
    Assets.load<Texture>(doorLockedUrl),
    Assets.load<Texture>(stairsUrl),
    Assets.load<Texture>(extractionUrl),
    Assets.load<Texture>(ammoHandgunUrl),
    Assets.load<Texture>(ammoShotgunUrl),
    Assets.load<Texture>(ammoRifleUrl),
    Assets.load<Texture>(medkitUrl),
    Assets.load<Texture>(bandageUrl),
    Assets.load<Texture>(keyUrl),
    Assets.load<Texture>(relicUrl),
  ]);

  const slice = (index: number): Texture =>
    new Texture({
      source: sheet.source,
      frame: new Rectangle(index * SPRITE_FRAME_SIZE, 0, SPRITE_FRAME_SIZE, SPRITE_FRAME_SIZE),
    });

  return {
    enemies: {
      raptor: slice(ENEMY_FRAME_BY_KIND.raptor),
      boss: slice(ENEMY_FRAME_BY_KIND.boss),
      theropode: slice(ENEMY_FRAME_BY_KIND.theropode),
      compy: slice(ENEMY_FRAME_BY_KIND.compy),
    },
    player: { handgun: playerHandgun, shotgun: playerShotgun, rifle: playerRifle },
    tiles: { floor: tileFloor, wall: tileWall, pit: tilePit },
    props: { crate, pillar, shelf },
    doors: { unlocked: door, locked: doorLocked },
    zones: { stairs, extraction },
    loot: {
      ammo: { handgun: ammoHandgun, shotgun: ammoShotgun, rifle: ammoRifle },
      medkit,
      bandage,
      key,
      relic,
    },
  };
}
