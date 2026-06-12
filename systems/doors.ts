/**
 * Franchissement de portes façon survival-horror : la porte est une zone de
 * contact sur le mur, pas un trou dans la géométrie. La toucher téléporte le
 * joueur juste de l'autre côté, dans la salle voisine.
 */

import type { Room, RunState, Vec2 } from '@/domain';
import { currentRoom } from './movement';
import { spawnRoomContent } from './spawn';

/**
 * Rayon de contact : doit dépasser WALL_THICKNESS + rayon joueur pour qu'un
 * joueur collé au mur au niveau de la porte la déclenche.
 */
const DOOR_TRIGGER_RADIUS = 32;

/**
 * Distance porte → position d'arrivée. Strictement supérieure au rayon de
 * déclenchement, sinon la porte de la salle cible re-téléporterait aussitôt.
 */
const ENTRY_INSET = 48;

/** Position d'arrivée : depuis le point de porte, vers l'intérieur de la salle. */
function entryPosition(target: Room, doorAt: Vec2): Vec2 {
  const b = target.bounds;
  if (Math.abs(doorAt.x - b.x) < 1) return { x: b.x + ENTRY_INSET, y: doorAt.y };
  if (Math.abs(doorAt.x - (b.x + b.w)) < 1) return { x: b.x + b.w - ENTRY_INSET, y: doorAt.y };
  if (Math.abs(doorAt.y - b.y) < 1) return { x: doorAt.x, y: b.y + ENTRY_INSET };
  return { x: doorAt.x, y: b.y + b.h - ENTRY_INSET };
}

export function updateDoorTransition(state: RunState): void {
  const room = currentRoom(state);
  for (const doorId of room.doorIds) {
    const door = state.floor.doors[doorId];
    if (!door) continue;

    const dx = state.player.pos.x - door.at.x;
    const dy = state.player.pos.y - door.at.y;
    if (dx * dx + dy * dy > DOOR_TRIGGER_RADIUS * DOOR_TRIGGER_RADIUS) continue;

    if (door.locked) {
      // Bonne clé portée → déverrouillage et passage immédiat (le détour est
      // déjà payé). La clé reste en inventaire : elle meurt avec l'étage.
      const hasKey =
        door.keyItemId !== null && state.inventory.keyItems.includes(door.keyItemId);
      if (!hasKey) continue;
      door.locked = false;
    }

    const targetId = door.roomA === room.id ? door.roomB : door.roomA;
    const target = state.floor.rooms[targetId];
    if (!target) continue;

    state.player.pos = entryPosition(target, door.at);
    state.player.vel = { x: 0, y: 0 };
    state.floor.currentRoomId = targetId;
    target.discovered = true;
    door.open = true;
    spawnRoomContent(state, target);
    // Les projectiles n'existent que dans la salle courante : on purge.
    state.projectiles = [];
    return;
  }
}
