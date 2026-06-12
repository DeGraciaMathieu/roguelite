import { describe, expect, it } from 'vitest';
import type { RunState } from '@/domain';
import { deriveFloorSeed } from './floorgen';
import { createRun } from './run';
import { spawnRoomContent } from './spawn';
import { extractionZone, stairZone, updateStairs } from './stairs';

/** Run dont le joueur est téléporté dans la salle exit. */
function runAtExit(seed = 11): RunState {
  const state = createRun(seed);
  state.floor.currentRoomId = state.floor.exitRoomId;
  const exit = state.floor.rooms[state.floor.exitRoomId];
  if (!exit) throw new Error('Salle exit manquante');
  // Coin de la salle : hors de la zone d'escalier centrale.
  state.player.pos = { x: exit.bounds.x + 60, y: exit.bounds.y + 60 };
  return state;
}

function enterStairs(state: RunState): void {
  const exit = state.floor.rooms[state.floor.exitRoomId];
  if (!exit) throw new Error('Salle exit manquante');
  const zone = stairZone(exit);
  state.player.pos = { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 };
  updateStairs(state);
}

describe('updateStairs', () => {
  it('ne descend pas hors de la zone d’escalier', () => {
    const state = runAtExit();

    updateStairs(state);

    expect(state.floor.index).toBe(0);
    expect(state.stats.floorsCleared).toBe(0);
  });

  it('descend au contact : étage suivant, seed dérivée, joueur au départ', () => {
    const state = runAtExit();

    enterStairs(state);

    expect(state.floor.index).toBe(1);
    expect(state.floor.seed).toBe(deriveFloorSeed(state.seed, 1));
    expect(state.floor.currentRoomId).toBe(state.floor.startRoomId);
    expect(state.stats.floorsCleared).toBe(1);
    expect(state.stats.deepestFloor).toBe(1);

    const start = state.floor.rooms[state.floor.startRoomId];
    expect(state.player.pos).toEqual({
      x: (start?.bounds.x ?? 0) + (start?.bounds.w ?? 0) / 2,
      y: (start?.bounds.y ?? 0) + (start?.bounds.h ?? 0) / 2,
    });
  });

  it('purge les ennemis et projectiles de l’ancien étage', () => {
    const state = runAtExit();
    // Matérialise une salle de combat de l'étage 0 pour avoir des ennemis.
    const combat = Object.values(state.floor.rooms).find((room) => room.enemySpawns.length > 0);
    if (!combat) throw new Error('Aucune salle de combat générée');
    spawnRoomContent(state, combat);
    expect(Object.keys(state.enemies).length).toBeGreaterThan(0);

    enterStairs(state);

    expect(Object.keys(state.enemies)).toHaveLength(0);
    expect(state.projectiles).toHaveLength(0);
  });

  it('la descente est déterministe : même seed de run, même étage suivant', () => {
    const a = runAtExit(77);
    const b = runAtExit(77);

    enterStairs(a);
    enterStairs(b);

    expect(a.floor).toEqual(b.floor);
  });

  it('pas d’extraction à l’étage 0 : la dalle est inerte', () => {
    const state = runAtExit();
    const exit = state.floor.rooms[state.floor.exitRoomId];
    if (!exit) throw new Error('Salle exit manquante');
    const zone = extractionZone(exit);
    state.player.pos = { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 };

    updateStairs(state);

    expect(state.status).toBe('active');
    expect(state.floor.index).toBe(0);
  });

  it('extraction possible dès l’étage 2, avec l’étage en cours compté', () => {
    const state = runAtExit();
    enterStairs(state); // descend à l'étage d'index 1

    state.floor.currentRoomId = state.floor.exitRoomId;
    const exit = state.floor.rooms[state.floor.exitRoomId];
    if (!exit) throw new Error('Salle exit manquante');
    const zone = extractionZone(exit);
    state.player.pos = { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 };

    updateStairs(state);

    expect(state.status).toBe('extracted');
    expect(state.stats.floorsCleared).toBe(2);
    expect(state.floor.index).toBe(1); // on ne descend pas : on sort
  });

  it('santé et inventaire persistent à travers la descente', () => {
    const state = runAtExit();
    state.player.health.current = 47;
    const weapon = state.inventory.weapons[state.inventory.equippedIndex];
    if (!weapon) throw new Error('Aucune arme équipée');
    weapon.ammoInMag = 3;

    enterStairs(state);

    expect(state.player.health.current).toBe(47);
    expect(state.inventory.weapons[state.inventory.equippedIndex]?.ammoInMag).toBe(3);
  });
});
