import { describe, expect, it } from 'vitest';
import { asId } from '@/domain';
import type { Door, RunState } from '@/domain';
import { generateFloor } from './floorgen';
import { createRunWithFloor } from './run';
import { updateDoorTransition } from './doors';

/** Run générée + première porte de la salle de départ. */
function runAtStartDoor(): { state: RunState; door: Door } {
  const state = createRunWithFloor(5, generateFloor(5));
  const start = state.floor.rooms[state.floor.startRoomId];
  if (!start) throw new Error('Salle de départ manquante');
  const doorId = start.doorIds[0];
  const door = doorId !== undefined ? state.floor.doors[doorId] : undefined;
  if (!door) throw new Error('La salle de départ devrait avoir au moins une porte');
  return { state, door };
}

describe('updateDoorTransition', () => {
  it('ne fait rien loin des portes', () => {
    const { state } = runAtStartDoor();
    const startId = state.floor.currentRoomId;

    updateDoorTransition(state); // joueur au centre de la salle

    expect(state.floor.currentRoomId).toBe(startId);
  });

  it('fait passer dans la salle voisine au contact de la porte', () => {
    const { state, door } = runAtStartDoor();
    const startId = state.floor.currentRoomId;
    const expectedTarget = door.roomA === startId ? door.roomB : door.roomA;

    state.player.pos = { ...door.at };
    updateDoorTransition(state);

    expect(state.floor.currentRoomId).toBe(expectedTarget);
    expect(state.floor.rooms[expectedTarget]?.discovered).toBe(true);
    expect(door.open).toBe(true);
  });

  it('replace le joueur dans la salle cible, hors de la zone de déclenchement', () => {
    const { state, door } = runAtStartDoor();
    state.player.pos = { ...door.at };
    updateDoorTransition(state);
    const arrivedRoomId = state.floor.currentRoomId;
    const bounds = state.floor.rooms[arrivedRoomId]?.bounds;
    if (!bounds) throw new Error('Salle cible manquante');

    expect(state.player.pos.x).toBeGreaterThan(bounds.x);
    expect(state.player.pos.x).toBeLessThan(bounds.x + bounds.w);
    expect(state.player.pos.y).toBeGreaterThan(bounds.y);
    expect(state.player.pos.y).toBeLessThan(bounds.y + bounds.h);

    // Pas de rebond immédiat par la même porte.
    updateDoorTransition(state);
    expect(state.floor.currentRoomId).toBe(arrivedRoomId);
  });

  it('purge les projectiles au changement de salle', () => {
    const { state, door } = runAtStartDoor();
    state.projectiles.push({
      id: asId<'EntityId'>('p-test'),
      pos: { ...state.player.pos },
      vel: { x: 0, y: 0 },
      damage: 1,
      ammo: 'handgun',
      ownerId: 'player',
      ttlMs: 1000,
    });

    state.player.pos = { ...door.at };
    updateDoorTransition(state);

    expect(state.projectiles).toHaveLength(0);
  });

  it('ignore une porte verrouillée', () => {
    const { state, door } = runAtStartDoor();
    const startId = state.floor.currentRoomId;
    door.locked = true;

    state.player.pos = { ...door.at };
    updateDoorTransition(state);

    expect(state.floor.currentRoomId).toBe(startId);
  });
});
