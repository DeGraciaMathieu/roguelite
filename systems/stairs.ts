/**
 * Fin d'étage : la salle exit contient une dalle d'escalier (descendre plus
 * profond : plus de récompenses, plus de risque) et, dès EXTRACTION_MIN_FLOOR,
 * une dalle d'extraction (terminer la run vivant, avec bonus). L'étage suivant
 * est généré depuis une seed dérivée de la run : toute la descente est
 * rejouable. Santé, inventaire et stats persistent — la même run continue.
 */

import type { Floor, Rect, Room, RunState } from '@/domain';
import { EXIT_ZONE_OFFSET, EXTRACTION_MIN_FLOOR, STAIR_ZONE_SIZE } from '@/data/balance';
import { circleIntersectsRect } from './collision';
import { deriveFloorSeed, generateFloor } from './floorgen';
import { currentRoom } from './movement';
import { spawnRoomContent } from './spawn';

/** Dalle carrée décalée du centre (la procgen garde cette zone libre d'obstacles). */
function exitZone(room: Room, offsetX: number): Rect {
  const b = room.bounds;
  return {
    x: b.x + (b.w - STAIR_ZONE_SIZE) / 2 + offsetX,
    y: b.y + (b.h - STAIR_ZONE_SIZE) / 2,
    w: STAIR_ZONE_SIZE,
    h: STAIR_ZONE_SIZE,
  };
}

export function stairZone(room: Room): Rect {
  return exitZone(room, -EXIT_ZONE_OFFSET);
}

export function extractionZone(room: Room): Rect {
  return exitZone(room, EXIT_ZONE_OFFSET);
}

export function extractionAvailable(floor: Floor): boolean {
  return floor.index >= EXTRACTION_MIN_FLOOR;
}

export function descendFloor(state: RunState): void {
  const nextIndex = state.floor.index + 1;
  state.stats.floorsCleared += 1;
  state.stats.deepestFloor = Math.max(state.stats.deepestFloor, nextIndex);

  state.floor = generateFloor(deriveFloorSeed(state.seed, nextIndex), nextIndex);
  // L'ancien étage disparaît avec ses occupants.
  state.enemies = {};
  state.projectiles = [];

  const start = state.floor.rooms[state.floor.startRoomId];
  if (!start) throw new Error('Salle de départ manquante après la descente');
  state.player.pos = {
    x: start.bounds.x + start.bounds.w / 2,
    y: start.bounds.y + start.bounds.h / 2,
  };
  state.player.vel = { x: 0, y: 0 };
  spawnRoomContent(state, start);
}

export function updateStairs(state: RunState): void {
  const room = currentRoom(state);
  if (room.kind !== 'exit') return;

  if (circleIntersectsRect(state.player.pos, state.player.radius, stairZone(room))) {
    descendFloor(state);
    return;
  }

  if (
    extractionAvailable(state.floor) &&
    circleIntersectsRect(state.player.pos, state.player.radius, extractionZone(room))
  ) {
    // L'étage en cours compte comme franchi : on en sort vivant.
    state.stats.floorsCleared += 1;
    state.status = 'extracted';
  }
}
