/**
 * Fixture de test : salle statique unique des étapes 1-2, sans procgen.
 * Conservée pour les tests de mouvement/combat qui ont besoin d'une géométrie
 * connue et stable. L'assemblage du RunState est délégué à systems/run.ts.
 */

import { asId } from '@/domain';
import type { Floor, Room, RoomId, RunState } from '@/domain';
import { createRunWithFloor } from '@/systems/run';

const DEBUG_ROOM_ID: RoomId = asId<'RoomId'>('debug-room');

function createDebugRoom(): Room {
  return {
    id: DEBUG_ROOM_ID,
    kind: 'start',
    bounds: { x: 0, y: 0, w: 800, h: 600 },
    obstacles: [
      { x: 160, y: 120, w: 56, h: 56 },
      { x: 584, y: 424, w: 56, h: 56 },
      { x: 340, y: 200, w: 120, h: 28 },
    ],
    pits: [],
    doorIds: [],
    decals: [],
    enemySpawns: [],
    lootSpawns: [],
    spawned: true,
    cleared: true,
    discovered: true,
  };
}

function createDebugFloor(seed: number): Floor {
  const room = createDebugRoom();
  return {
    index: 0,
    seed,
    rooms: { [room.id]: room },
    doors: {},
    startRoomId: room.id,
    exitRoomId: room.id,
    currentRoomId: room.id,
  };
}

export function createDebugRun(seed: number): RunState {
  return createRunWithFloor(seed, createDebugFloor(seed));
}
