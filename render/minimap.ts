/**
 * Minimap en brouillard de guerre : seules les salles découvertes
 * (`Room.discovered`, tenu à jour par le système de portes) apparaissent.
 * `minimapModel` est pur — testable sans Pixi ; `drawMinimap` ne fait que
 * dessiner ce modèle.
 */

import { Graphics } from 'pixi.js';
import type { Floor, Room, RoomKind, Vec2 } from '@/domain';

export type ExitDirection = 'n' | 's' | 'e' | 'w';

export interface MinimapCell {
  /** Coordonnées de grille relatives à l'emprise de l'étage (≥ 0). */
  cx: number;
  cy: number;
  kind: RoomKind;
  current: boolean;
  /** Portes vers des salles non découvertes : dessinées en stubs sombres. */
  unexploredExits: ExitDirection[];
  /** Portes vers des salles découvertes : dessinées en raccords clairs. */
  exploredExits: ExitDirection[];
}

export interface MinimapModel {
  cells: MinimapCell[];
  /** Emprise de l'étage entier (en cellules) : ancrage stable, la carte ne saute pas. */
  gridW: number;
  gridH: number;
}

function directionOf(room: Room, doorAt: Vec2): ExitDirection {
  const b = room.bounds;
  if (Math.abs(doorAt.y - b.y) < 1) return 'n';
  if (Math.abs(doorAt.y - (b.y + b.h)) < 1) return 's';
  if (Math.abs(doorAt.x - b.x) < 1) return 'w';
  return 'e';
}

export function minimapModel(floor: Floor): MinimapModel {
  const rooms = Object.values(floor.rooms);
  const first = rooms[0];
  if (!first) return { cells: [], gridW: 0, gridH: 0 };
  const cellW = first.bounds.w;
  const cellH = first.bounds.h;

  const gridCoords = rooms.map((room) => ({
    cx: Math.round(room.bounds.x / cellW),
    cy: Math.round(room.bounds.y / cellH),
  }));
  const minCx = Math.min(...gridCoords.map((c) => c.cx));
  const minCy = Math.min(...gridCoords.map((c) => c.cy));
  const gridW = Math.max(...gridCoords.map((c) => c.cx)) - minCx + 1;
  const gridH = Math.max(...gridCoords.map((c) => c.cy)) - minCy + 1;

  const cells: MinimapCell[] = [];
  for (let i = 0; i < rooms.length; i += 1) {
    const room = rooms[i]!;
    if (!room.discovered) continue;

    const unexploredExits: ExitDirection[] = [];
    const exploredExits: ExitDirection[] = [];
    for (const doorId of room.doorIds) {
      const door = floor.doors[doorId];
      if (!door) continue;
      const otherId = door.roomA === room.id ? door.roomB : door.roomA;
      const other = floor.rooms[otherId];
      if (!other) continue;
      (other.discovered ? exploredExits : unexploredExits).push(directionOf(room, door.at));
    }

    cells.push({
      cx: gridCoords[i]!.cx - minCx,
      cy: gridCoords[i]!.cy - minCy,
      kind: room.kind,
      current: room.id === floor.currentRoomId,
      unexploredExits,
      exploredExits,
    });
  }
  return { cells, gridW, gridH };
}

// --- Dessin --------------------------------------------------------------------

const CELL_W = 18;
const CELL_H = 13;
const GAP = 4;
const PITCH_X = CELL_W + GAP;
const PITCH_Y = CELL_H + GAP;
const PADDING = 5;

const COLOR_BY_KIND: Record<RoomKind, number> = {
  start: 0x4a5158,
  combat: 0x3a3f47,
  loot: 0xc9a44a,
  rest: 0x7a9e63,
  boss: 0xb03060,
  exit: 0x5d7fa3,
};
const COLOR_CURRENT = 0xd8e1e8;
const COLOR_EXPLORED_LINK = 0x4a5158;
const COLOR_UNEXPLORED_STUB = 0x2c313a;
const COLOR_BACKDROP = 0x0a0b0d;

function drawExit(graphics: Graphics, x: number, y: number, dir: ExitDirection, color: number): void {
  switch (dir) {
    case 'e':
      graphics.rect(x + CELL_W, y + CELL_H / 2 - 2, GAP, 4).fill(color);
      break;
    case 'w':
      graphics.rect(x - GAP, y + CELL_H / 2 - 2, GAP, 4).fill(color);
      break;
    case 'n':
      graphics.rect(x + CELL_W / 2 - 2, y - GAP, 4, GAP).fill(color);
      break;
    case 's':
      graphics.rect(x + CELL_W / 2 - 2, y + CELL_H, 4, GAP).fill(color);
      break;
  }
}

/** Dessine la minimap à l'origine locale et retourne sa taille en pixels. */
export function drawMinimap(graphics: Graphics, floor: Floor): { w: number; h: number } {
  graphics.clear();
  const model = minimapModel(floor);
  const w = model.gridW * PITCH_X - GAP + 2 * PADDING;
  const h = model.gridH * PITCH_Y - GAP + 2 * PADDING;
  if (model.cells.length === 0) return { w, h };

  graphics.rect(0, 0, w, h).fill({ color: COLOR_BACKDROP, alpha: 0.75 });

  for (const cell of model.cells) {
    const x = PADDING + cell.cx * PITCH_X;
    const y = PADDING + cell.cy * PITCH_Y;
    for (const dir of cell.exploredExits) drawExit(graphics, x, y, dir, COLOR_EXPLORED_LINK);
    for (const dir of cell.unexploredExits) drawExit(graphics, x, y, dir, COLOR_UNEXPLORED_STUB);
    graphics.rect(x, y, CELL_W, CELL_H).fill(COLOR_BY_KIND[cell.kind]);
    if (cell.current) {
      graphics.rect(x, y, CELL_W, CELL_H).stroke({ width: 1.5, color: COLOR_CURRENT });
    }
  }
  return { w, h };
}
