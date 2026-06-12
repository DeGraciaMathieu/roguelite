/**
 * Adaptateur Pixi : lit le RunState et dessine, rien d'autre.
 * Caméra par salle : la vue saute sur la salle courante à chaque transition.
 * Conserve un snapshot de la position du joueur avant chaque tick pour
 * interpoler le rendu entre deux pas de simulation — le domaine reste pur.
 */

import { Application, Container, Graphics } from 'pixi.js';
import { healthState } from '@/domain';
import type { AmmoType, Door, EnemyKind, HealthState, Room, RunState, Vec2 } from '@/domain';
import { PROJECTILE_RADIUS, WALL_THICKNESS } from '@/data/balance';
import { getWeaponDef } from '@/data/weapons';
import { reloadDurationMultiplier } from '@/systems/relics';
import { extractionAvailable, extractionZone, stairZone } from '@/systems/stairs';
import { drawMinimap } from './minimap';

const COLOR_FLOOR = 0x1a1d22;
const COLOR_WALL = 0x3a3f47;
const COLOR_OBSTACLE = 0x2c313a;
const COLOR_PIT = 0x050608;
const COLOR_PIT_EDGE = 0x23262c;
const COLOR_DOOR = 0x7a9e63;
const COLOR_STAIRS = 0x5d7fa3;
const COLOR_EXTRACTION = 0xc9a44a;
const COLOR_AIM = 0xe5533d;
const COLOR_PROJECTILE = 0xf0c33c;
const COLOR_FACING = 0x14161a;

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

const AIM_INDICATOR_LENGTH = 22;
const DOOR_DRAW_WIDTH = 64;

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

  const enemyGraphics = new Graphics();
  world.addChild(enemyGraphics);

  const projectileGraphics = new Graphics();
  world.addChild(projectileGraphics);

  const playerGraphics = new Graphics();
  world.addChild(playerGraphics);

  const minimapGraphics = new Graphics();
  app.stage.addChild(minimapGraphics);

  let prevPlayerPos: Vec2 = { ...state.player.pos };

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

      lootGraphics.clear();
      for (const spawn of room.lootSpawns) {
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
        const b = room.bounds;
        const inRoom =
          enemy.pos.x >= b.x && enemy.pos.x <= b.x + b.w && enemy.pos.y >= b.y && enemy.pos.y <= b.y + b.h;
        if (!inRoom) continue;
        enemyGraphics.circle(enemy.pos.x, enemy.pos.y, enemy.radius).fill(COLOR_ENEMY[enemy.kind]);
        enemyGraphics
          .moveTo(enemy.pos.x, enemy.pos.y)
          .lineTo(
            enemy.pos.x + Math.cos(enemy.facing) * enemy.radius,
            enemy.pos.y + Math.sin(enemy.facing) * enemy.radius,
          )
          .stroke({ width: 2, color: COLOR_FACING });
      }

      const player = renderState.player;
      const x = prevPlayerPos.x + (player.pos.x - prevPlayerPos.x) * alpha;
      const y = prevPlayerPos.y + (player.pos.y - prevPlayerPos.y) * alpha;

      playerGraphics.clear();
      playerGraphics.circle(x, y, player.radius).fill(COLOR_PLAYER_BY_HEALTH[healthState(player.health)]);

      const aimStartX = x + Math.cos(player.aim) * player.radius;
      const aimStartY = y + Math.sin(player.aim) * player.radius;
      playerGraphics
        .moveTo(aimStartX, aimStartY)
        .lineTo(
          aimStartX + Math.cos(player.aim) * AIM_INDICATOR_LENGTH,
          aimStartY + Math.sin(player.aim) * AIM_INDICATOR_LENGTH,
        )
        .stroke({ width: 2, color: COLOR_AIM });

      // Barre de progression de recharge au-dessus de la tête, le temps de la recharge.
      const weapon = renderState.inventory.weapons[renderState.inventory.equippedIndex];
      if (weapon && weapon.reloadingUntilMs !== null) {
        const reloadMs = getWeaponDef(weapon.defId).reloadMs * reloadDurationMultiplier(renderState);
        const progress = Math.min(
          1,
          Math.max(0, 1 - (weapon.reloadingUntilMs - renderState.elapsedMs) / reloadMs),
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
