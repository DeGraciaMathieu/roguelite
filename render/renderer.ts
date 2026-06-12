/**
 * Adaptateur Pixi : lit le RunState et dessine, rien d'autre.
 * Caméra par salle : la vue saute sur la salle courante à chaque transition.
 * Conserve un snapshot de la position du joueur avant chaque tick pour
 * interpoler le rendu entre deux pas de simulation — le domaine reste pur.
 */

import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { healthState } from '@/domain';
import type { AmmoType, Door, EnemyKind, EntityId, HealthState, Room, RunState, Vec2 } from '@/domain';
import { PROJECTILE_RADIUS, WALL_THICKNESS } from '@/data/balance';
import { getWeaponDef } from '@/data/weapons';
import { reloadDurationMultiplier } from '@/systems/relics';
import { extractionAvailable, extractionZone, stairZone } from '@/systems/stairs';
import {
  EFFECTS_ENABLED,
  ENEMY_FLASH_MS,
  PLAYER_DAMAGE_FLASH_MS,
  createEffectPool,
  effectProgress,
  spawnDashGhost,
  spawnDeathRing,
  spawnImpactSparks,
  tickEffects,
} from './effects';
import { drawMinimap } from './minimap';
import { drawEnemyHealthBar, drawPlayerShape } from './shapes';
import { isVisible, visionPolygon } from './visibility';
import {
  SPRITE_FRAME_SIZE,
  SPRITE_ROTATION_OFFSET,
  SPRITE_VISUAL_SCALE,
  loadEnemyTextures,
} from './sprites';

const COLOR_FLOOR = 0x1a1d22;
const COLOR_WALL = 0x3a3f47;
const COLOR_OBSTACLE = 0x2c313a;
const COLOR_PIT = 0x050608;
const COLOR_PIT_EDGE = 0x23262c;
const COLOR_DOOR = 0x7a9e63;
const COLOR_STAIRS = 0x5d7fa3;
const COLOR_EXTRACTION = 0xc9a44a;
const COLOR_PROJECTILE = 0xf0c33c;

/** Couleur du joueur selon l'état de santé dérivé du domaine (pas de HUD). */
const COLOR_PLAYER_BY_HEALTH: Record<HealthState, number> = {
  fine: 0xd8e1e8,
  caution: 0xf0c33c,
  danger: 0xe5533d,
};

const COLOR_ENEMY: Record<EnemyKind, number> = {
  raptor: 0xc0563e,
  compy: 0x9bbf65,
  theropode: 0x8a5fb0,
  boss: 0xb03060,
};

/** Même violet que le théropode : la famille « relique/menace rare » se lit d'un coup d'œil. */
const COLOR_RELIC = 0x8a5fb0;

const COLOR_AMMO_LOOT: Record<AmmoType, number> = {
  handgun: 0xf0c33c,
  shotgun: 0xe07b39,
  rifle: 0x9bd0d0,
};
const LOOT_DRAW_W = 12;
const LOOT_DRAW_H = 8;

const DOOR_DRAW_WIDTH = 64;

/** Voile de vision limitée : obscurité partielle, le décor reste deviné. */
const COLOR_VEIL = 0x050608;
const VEIL_ALPHA = 0.8;

/** Teinte multiplicative du flash d'impact (un sprite ne peut pas « blanchir »). */
const ENEMY_FLASH_TINT = 0xff6b6b;
const NO_TINT = 0xffffff;
const COLOR_DAMAGE_VIGNETTE = 0xe5533d;
const DAMAGE_VIGNETTE_THICKNESS = 26;
const DAMAGE_VIGNETTE_MAX_ALPHA = 0.4;
/** Recul de tir : 1-2 px, une frame — plus marqué au shotgun (pellets > 1). */
const RECOIL_PX_SINGLE = 1;
const RECOIL_PX_MULTI = 2;
/** Cadence de ponte des fantômes de dash (~3 sur un dash de 150 ms). */
const DASH_GHOST_INTERVAL_MS = 50;

const RELOAD_BAR_WIDTH = 28;
const RELOAD_BAR_HEIGHT = 4;
const RELOAD_BAR_OFFSET = 12;
const COLOR_RELOAD_BAR_BG = 0x14161a;
const COLOR_RELOAD_BAR = 0xf0c33c;

export interface Renderer {
  canvas: HTMLCanvasElement;
  /** À appeler juste avant chaque tick de simulation, pour l'interpolation. */
  snapshot(state: RunState): void;
  render(state: RunState, alpha: number): void;
  screenToWorld(screen: Vec2): Vec2;
  /** Détruit l'application Pixi et retire le canvas (relance de run). */
  dispose(): void;
}

function currentRoom(state: RunState): Room {
  const room = state.floor.rooms[state.floor.currentRoomId];
  if (!room) throw new Error(`Salle courante introuvable : ${state.floor.currentRoomId}`);
  return room;
}

function roomDoors(state: RunState, room: Room): Door[] {
  return room.doorIds
    .map((id) => state.floor.doors[id])
    .filter((door): door is Door => door !== undefined);
}

function drawDoor(graphics: Graphics, door: Door, room: Room): void {
  const b = room.bounds;
  const onVerticalWall = Math.abs(door.at.x - b.x) < 1 || Math.abs(door.at.x - (b.x + b.w)) < 1;
  if (onVerticalWall) {
    const x = Math.abs(door.at.x - b.x) < 1 ? b.x : b.x + b.w - WALL_THICKNESS;
    graphics.rect(x, door.at.y - DOOR_DRAW_WIDTH / 2, WALL_THICKNESS, DOOR_DRAW_WIDTH).fill(COLOR_DOOR);
  } else {
    const y = Math.abs(door.at.y - b.y) < 1 ? b.y : b.y + b.h - WALL_THICKNESS;
    graphics.rect(door.at.x - DOOR_DRAW_WIDTH / 2, y, DOOR_DRAW_WIDTH, WALL_THICKNESS).fill(COLOR_DOOR);
  }
}

function drawRoom(graphics: Graphics, room: Room, doors: readonly Door[], canExtract: boolean): void {
  const { x, y, w, h } = room.bounds;
  graphics.rect(x, y, w, h).fill(COLOR_WALL);
  graphics
    .rect(x + WALL_THICKNESS, y + WALL_THICKNESS, w - 2 * WALL_THICKNESS, h - 2 * WALL_THICKNESS)
    .fill(COLOR_FLOOR);
  for (const obstacle of room.obstacles) {
    graphics.rect(obstacle.x, obstacle.y, obstacle.w, obstacle.h).fill(COLOR_OBSTACLE);
  }
  for (const pit of room.pits) {
    graphics
      .rect(pit.x, pit.y, pit.w, pit.h)
      .fill(COLOR_PIT)
      .stroke({ width: 1, color: COLOR_PIT_EDGE });
  }
  for (const door of doors) {
    drawDoor(graphics, door, room);
  }
  if (room.kind === 'exit') {
    const stairs = stairZone(room);
    graphics.rect(stairs.x, stairs.y, stairs.w, stairs.h).fill(COLOR_STAIRS);
    if (canExtract) {
      const extraction = extractionZone(room);
      graphics.rect(extraction.x, extraction.y, extraction.w, extraction.h).fill(COLOR_EXTRACTION);
    }
  }
}

export async function createRenderer(state: RunState): Promise<Renderer> {
  let viewRoom = currentRoom(state);
  const enemyTextures = await loadEnemyTextures();

  const app = new Application();
  await app.init({
    width: viewRoom.bounds.w,
    height: viewRoom.bounds.h,
    background: 0x0a0b0d,
    antialias: true,
  });

  // Le monde bouge avec la caméra ; le stage reste à l'origine pour que
  // l'UI en jeu (minimap) puisse être fixe à l'écran.
  const world = new Container();
  app.stage.addChild(world);
  world.position.set(-viewRoom.bounds.x, -viewRoom.bounds.y);

  const roomGraphics = new Graphics();
  drawRoom(roomGraphics, viewRoom, roomDoors(state, viewRoom), extractionAvailable(state.floor));
  world.addChild(roomGraphics);

  // Couche dynamique : le loot disparaît au ramassage, on le redessine par frame.
  const lootGraphics = new Graphics();
  world.addChild(lootGraphics);

  // Sprites des dinosaures, un par ennemi vivant de la salle courante ;
  // enemyGraphics ne dessine plus que leurs barres de vie.
  const enemyLayer = new Container();
  world.addChild(enemyLayer);
  const enemySprites = new Map<EntityId, Sprite>();

  const enemyGraphics = new Graphics();
  world.addChild(enemyGraphics);

  // Effets éphémères : au-dessus des ennemis, sous le joueur et ses tirs.
  const effectsGraphics = new Graphics();
  world.addChild(effectsGraphics);

  // Vision limitée : voile au-dessus du décor et des entités mais sous les
  // projectiles et le joueur (on tire dans le noir). La zone vue est un
  // masque inversé : le voile n'est rendu qu'à l'extérieur de la forme.
  // (Pas de Graphics.cut() : sa triangulation est peu fiable sur les
  // polygones concaves comme notre trou de serrure.)
  const veilGraphics = new Graphics();
  world.addChild(veilGraphics);
  const visionMaskGraphics = new Graphics();
  world.addChild(visionMaskGraphics);
  veilGraphics.setMask({ mask: visionMaskGraphics, inverse: true });

  const projectileGraphics = new Graphics();
  world.addChild(projectileGraphics);

  const playerGraphics = new Graphics();
  world.addChild(playerGraphics);

  // Voile de dégât : espace écran, sous la minimap pour la laisser lisible.
  const vignetteGraphics = new Graphics();
  app.stage.addChild(vignetteGraphics);

  const minimapGraphics = new Graphics();
  app.stage.addChild(minimapGraphics);

  let prevPlayerPos: Vec2 = { ...state.player.pos };

  // --- Feedback de combat : état de rendu pur, alimenté par diff d'état ------
  // Le renderer ne voit que l'état courant ; on garde une photo de la frame
  // précédente (PV par ennemi, projectiles vivants…) pour en déduire les
  // impacts, morts et tirs. Les entrées sont réutilisées : pas d'allocation
  // par frame en croisière, hors apparition d'une entité nouvelle.
  interface EnemySnap {
    x: number;
    y: number;
    radius: number;
    color: number;
    health: number;
    seen: boolean;
  }
  interface ProjectileSnap {
    x: number;
    y: number;
    seen: boolean;
  }
  const effectPool = createEffectPool();
  const enemySnaps = new Map<string, EnemySnap>();
  const projectileSnaps = new Map<string, ProjectileSnap>();
  const enemyFlashUntil = new Map<string, number>();
  let prevPlayerHealth = state.player.health.current;
  let prevWeaponKey = '';
  let prevAmmoInMag = -1;
  let playerFlashUntil = 0;
  let lastGhostAt = 0;
  let recoilPx = 0;
  let floorKey = `${state.floor.seed}:${state.floor.index}`;
  let lastFrameAt = performance.now();

  function resetFeedback(renderState: RunState): void {
    enemySnaps.clear();
    projectileSnaps.clear();
    enemyFlashUntil.clear();
    for (const effect of effectPool) effect.active = false;
    prevPlayerHealth = renderState.player.health.current;
    recoilPx = 0;
  }

  function inRoomBounds(room: Room, x: number, y: number): boolean {
    const b = room.bounds;
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  function updateFeedback(renderState: RunState, room: Room, now: number): void {
    // Ennemis : PV en baisse → flash ; disparu → anneau de mort.
    for (const enemy of Object.values(renderState.enemies)) {
      const snap = enemySnaps.get(enemy.id);
      if (snap) {
        if (enemy.health.current < snap.health) enemyFlashUntil.set(enemy.id, now + ENEMY_FLASH_MS);
        snap.x = enemy.pos.x;
        snap.y = enemy.pos.y;
        snap.health = enemy.health.current;
        snap.seen = true;
      } else {
        enemySnaps.set(enemy.id, {
          x: enemy.pos.x,
          y: enemy.pos.y,
          radius: enemy.radius,
          color: COLOR_ENEMY[enemy.kind],
          health: enemy.health.current,
          seen: true,
        });
      }
    }
    for (const [id, snap] of enemySnaps) {
      if (!snap.seen) {
        if (inRoomBounds(room, snap.x, snap.y)) {
          spawnDeathRing(effectPool, snap.x, snap.y, snap.radius, snap.color);
        }
        enemySnaps.delete(id);
        enemyFlashUntil.delete(id);
      } else {
        snap.seen = false;
      }
    }

    // Projectiles : disparu → étincelles au dernier point connu (mur ou chair).
    for (const projectile of renderState.projectiles) {
      const snap = projectileSnaps.get(projectile.id);
      if (snap) {
        snap.x = projectile.pos.x;
        snap.y = projectile.pos.y;
        snap.seen = true;
      } else {
        projectileSnaps.set(projectile.id, { x: projectile.pos.x, y: projectile.pos.y, seen: true });
      }
    }
    for (const [id, snap] of projectileSnaps) {
      if (!snap.seen) {
        if (inRoomBounds(room, snap.x, snap.y)) {
          spawnImpactSparks(effectPool, snap.x, snap.y, COLOR_PROJECTILE);
        }
        projectileSnaps.delete(id);
      } else {
        snap.seen = false;
      }
    }

    // PV du joueur en baisse → voile rouge sur les bords.
    const health = renderState.player.health.current;
    if (health < prevPlayerHealth) playerFlashUntil = now + PLAYER_DAMAGE_FLASH_MS;
    prevPlayerHealth = health;

    // Chargeur entamé sur la même arme → recul d'une frame.
    const weapon = renderState.inventory.weapons[renderState.inventory.equippedIndex];
    if (weapon) {
      const def = getWeaponDef(weapon.defId);
      const key = `${weapon.defId}:${renderState.inventory.equippedIndex}`;
      if (key === prevWeaponKey && weapon.ammoInMag < prevAmmoInMag) {
        recoilPx = def.pellets > 1 ? RECOIL_PX_MULTI : RECOIL_PX_SINGLE;
      }
      prevWeaponKey = key;
      prevAmmoInMag = weapon.ammoInMag;
    }

    // Dash en cours → fantômes du cercle joueur, cadence bornée.
    if (renderState.player.dash.remainingMs > 0 && now - lastGhostAt >= DASH_GHOST_INTERVAL_MS) {
      const player = renderState.player;
      spawnDashGhost(
        effectPool,
        player.pos.x,
        player.pos.y,
        player.radius,
        COLOR_PLAYER_BY_HEALTH[healthState(player.health)],
      );
      lastGhostAt = now;
    }
  }

  function drawEffects(now: number): void {
    effectsGraphics.clear();
    for (const effect of effectPool) {
      if (!effect.active) continue;
      const progress = effectProgress(effect);
      const fade = 1 - progress;
      if (effect.kind === 'spark') {
        effectsGraphics.circle(effect.x, effect.y, effect.radius).fill({ color: effect.color, alpha: fade });
      } else if (effect.kind === 'deathRing') {
        // Le cercle du défunt se dilate et s'estompe.
        effectsGraphics
          .circle(effect.x, effect.y, effect.radius * (1 + progress))
          .stroke({ width: 2, color: effect.color, alpha: fade * 0.8 });
      } else {
        effectsGraphics.circle(effect.x, effect.y, effect.radius).fill({ color: effect.color, alpha: fade * 0.3 });
      }
    }

    vignetteGraphics.clear();
    if (now < playerFlashUntil) {
      const alpha = ((playerFlashUntil - now) / PLAYER_DAMAGE_FLASH_MS) * DAMAGE_VIGNETTE_MAX_ALPHA;
      const w = app.screen.width;
      const h = app.screen.height;
      const t = DAMAGE_VIGNETTE_THICKNESS;
      vignetteGraphics
        .rect(0, 0, w, t)
        .rect(0, h - t, w, t)
        .rect(0, t, t, h - 2 * t)
        .rect(w - t, t, t, h - 2 * t)
        .fill({ color: COLOR_DAMAGE_VIGNETTE, alpha });
    }
  }

  // La minimap ne se redessine que quand la découverte ou la salle change.
  let minimapKey = '';
  function refreshMinimap(renderState: RunState): void {
    const floor = renderState.floor;
    const discoveredCount = Object.values(floor.rooms).filter((r) => r.discovered).length;
    const key = `${floor.seed}:${floor.index}:${floor.currentRoomId}:${discoveredCount}`;
    if (key === minimapKey) return;
    minimapKey = key;
    const size = drawMinimap(minimapGraphics, floor);
    minimapGraphics.position.set(app.screen.width - size.w - 10, 10);
  }
  refreshMinimap(state);

  return {
    canvas: app.canvas,

    snapshot(snapshotState: RunState): void {
      prevPlayerPos = { ...snapshotState.player.pos };
    },

    render(renderState: RunState, alpha: number): void {
      const now = performance.now();
      const frameDtMs = Math.min(100, now - lastFrameAt);
      lastFrameAt = now;

      const room = currentRoom(renderState);
      if (room.id !== viewRoom.id) {
        viewRoom = room;
        world.position.set(-room.bounds.x, -room.bounds.y);
        roomGraphics.clear();
        drawRoom(roomGraphics, room, roomDoors(renderState, room), extractionAvailable(renderState.floor));
        // Changement de salle = téléportation : on n'interpole pas par-dessus.
        prevPlayerPos = { ...renderState.player.pos };
      }
      refreshMinimap(renderState);

      // Nouvel étage : les photos de la frame précédente n'ont plus de sens.
      const stateFloorKey = `${renderState.floor.seed}:${renderState.floor.index}`;
      if (stateFloorKey !== floorKey) {
        floorKey = stateFloorKey;
        resetFeedback(renderState);
      }

      if (EFFECTS_ENABLED) {
        updateFeedback(renderState, room, now);
        tickEffects(effectPool, frameDtMs);
        // Recul de tir : une frame, dans l'axe opposé à la visée.
        const recoilX = recoilPx * -Math.cos(renderState.player.aim);
        const recoilY = recoilPx * -Math.sin(renderState.player.aim);
        world.position.set(-room.bounds.x + recoilX, -room.bounds.y + recoilY);
        recoilPx = 0;
        drawEffects(now);
      }

      const player = renderState.player;
      const x = prevPlayerPos.x + (player.pos.x - prevPlayerPos.x) * alpha;
      const y = prevPlayerPos.y + (player.pos.y - prevPlayerPos.y) * alpha;
      /** Œil du joueur (position rendue) : centre du voile et des raycasts de visibilité. */
      const eye: Vec2 = { x, y };

      lootGraphics.clear();
      for (const spawn of room.lootSpawns) {
        // Le loot ne se révèle qu'à portée de vue (halo/cône + ligne dégagée).
        if (!isVisible(eye, player.aim, spawn.at, room.obstacles)) continue;
        if (spawn.kind === 'ammo') {
          lootGraphics
            .rect(spawn.at.x - LOOT_DRAW_W / 2, spawn.at.y - LOOT_DRAW_H / 2, LOOT_DRAW_W, LOOT_DRAW_H)
            .fill(COLOR_AMMO_LOOT[spawn.ammo]);
        } else if (spawn.kind === 'consumable') {
          // Medkit : carré blanc à croix rouge.
          lootGraphics.rect(spawn.at.x - 7, spawn.at.y - 7, 14, 14).fill(0xd8e1e8);
          lootGraphics.rect(spawn.at.x - 5, spawn.at.y - 1.5, 10, 3).fill(0xe5533d);
          lootGraphics.rect(spawn.at.x - 1.5, spawn.at.y - 5, 3, 10).fill(0xe5533d);
        } else if (spawn.kind === 'relic') {
          // Relique : losange violet.
          lootGraphics
            .poly([
              { x: spawn.at.x, y: spawn.at.y - 10 },
              { x: spawn.at.x + 7, y: spawn.at.y },
              { x: spawn.at.x, y: spawn.at.y + 10 },
              { x: spawn.at.x - 7, y: spawn.at.y },
            ])
            .fill(COLOR_RELIC);
        }
      }

      enemyGraphics.clear();
      for (const enemy of Object.values(renderState.enemies)) {
        if (!inRoomBounds(room, enemy.pos.x, enemy.pos.y)) {
          continue;
        }
        // Invisible (trop loin ou derrière un obstacle) : pas dessiné, mais la
        // simulation continue — l'IA vit sa vie dans le noir.
        let sprite = enemySprites.get(enemy.id);
        if (!isVisible(eye, player.aim, enemy.pos, room.obstacles)) {
          if (sprite) sprite.visible = false;
          continue;
        }
        if (!sprite) {
          sprite = new Sprite(enemyTextures[enemy.kind]);
          sprite.anchor.set(0.5);
          enemyLayer.addChild(sprite);
          enemySprites.set(enemy.id, sprite);
        }
        sprite.visible = true;
        const scale = (enemy.radius * 2 * SPRITE_VISUAL_SCALE) / SPRITE_FRAME_SIZE;
        sprite.position.set(enemy.pos.x, enemy.pos.y);
        // Le museau suit le facing (sprites top-down symétriques, pas de flip).
        sprite.rotation = enemy.facing + SPRITE_ROTATION_OFFSET;
        sprite.scale.set(scale);
        // Impact tout frais : teinte rouge le temps du flash.
        const flashUntil = enemyFlashUntil.get(enemy.id);
        const flashing = flashUntil !== undefined && now < flashUntil;
        if (flashUntil !== undefined && !flashing) enemyFlashUntil.delete(enemy.id);
        sprite.tint = flashing ? ENEMY_FLASH_TINT : NO_TINT;
        // Barre de vie : seulement sur les blessés, zéro bruit au repos.
        if (enemy.health.current < enemy.health.max) {
          // Rayon visuel : la barre se cale au-dessus du sprite agrandi.
          drawEnemyHealthBar(
            enemyGraphics,
            enemy.pos.x,
            enemy.pos.y,
            enemy.radius * SPRITE_VISUAL_SCALE,
            enemy.health.current / enemy.health.max,
          );
        }
      }
      // Sprites orphelins (mort, hors salle) : retirés de la scène.
      for (const [id, sprite] of enemySprites) {
        const enemy = renderState.enemies[id];
        if (!enemy || !inRoomBounds(room, enemy.pos.x, enemy.pos.y)) {
          sprite.destroy();
          enemySprites.delete(id);
        }
      }

      // Voile d'obscurité ; la zone vue (halo + cône) est portée par le masque inversé.
      veilGraphics.clear();
      veilGraphics
        .rect(room.bounds.x, room.bounds.y, room.bounds.w, room.bounds.h)
        .fill({ color: COLOR_VEIL, alpha: VEIL_ALPHA });
      visionMaskGraphics.clear();
      visionMaskGraphics.poly(visionPolygon(eye, player.aim)).fill(0xffffff);

      const equipped = renderState.inventory.weapons[renderState.inventory.equippedIndex];
      playerGraphics.clear();
      drawPlayerShape(
        playerGraphics,
        x,
        y,
        player.radius,
        player.aim,
        COLOR_PLAYER_BY_HEALTH[healthState(player.health)],
        equipped ? getWeaponDef(equipped.defId).ammo : 'handgun',
      );

      // Barre de progression de recharge au-dessus de la tête, le temps de la recharge.
      if (equipped && equipped.reloadingUntilMs !== null) {
        const reloadMs = getWeaponDef(equipped.defId).reloadMs * reloadDurationMultiplier(renderState);
        const progress = Math.min(
          1,
          Math.max(0, 1 - (equipped.reloadingUntilMs - renderState.elapsedMs) / reloadMs),
        );
        const barX = x - RELOAD_BAR_WIDTH / 2;
        const barY = y - player.radius - RELOAD_BAR_OFFSET;
        playerGraphics
          .rect(barX, barY, RELOAD_BAR_WIDTH, RELOAD_BAR_HEIGHT)
          .fill(COLOR_RELOAD_BAR_BG);
        playerGraphics
          .rect(barX, barY, RELOAD_BAR_WIDTH * progress, RELOAD_BAR_HEIGHT)
          .fill(COLOR_RELOAD_BAR);
      }

      // Pas d'interpolation pour les projectiles : trop rapides et trop
      // éphémères pour que le décalage d'un demi-tick soit perceptible.
      projectileGraphics.clear();
      for (const projectile of renderState.projectiles) {
        projectileGraphics
          .circle(projectile.pos.x, projectile.pos.y, PROJECTILE_RADIUS)
          .fill(COLOR_PROJECTILE);
      }
    },

    screenToWorld(screen: Vec2): Vec2 {
      // Compense un éventuel redimensionnement CSS du canvas, puis replace
      // dans le repère monde de la salle affichée.
      const rect = app.canvas.getBoundingClientRect();
      const scaleX = rect.width > 0 ? app.screen.width / rect.width : 1;
      const scaleY = rect.height > 0 ? app.screen.height / rect.height : 1;
      return {
        x: screen.x * scaleX + viewRoom.bounds.x,
        y: screen.y * scaleY + viewRoom.bounds.y,
      };
    },

    dispose(): void {
      app.destroy(true);
    },
  };
}
