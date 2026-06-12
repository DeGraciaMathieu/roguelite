/**
 * Assemblage de l'état initial d'une run à partir des définitions statiques
 * (data/) et d'un étage. Pur, sans rendu.
 */

import { createRng } from '@/domain';
import type { AmmoType, Floor, Inventory, Player, Room, RunState, StartingLoadout } from '@/domain';
import { PLAYER_MAX_HEALTH, PLAYER_RADIUS, START_AMMO } from '@/data/balance';
import { HANDGUN_ID, createWeaponInstance, getWeaponDef } from '@/data/weapons';
import { deriveFloorSeed, generateFloor } from './floorgen';
import { spawnRoomContent } from './spawn';

const DEFAULT_LOADOUT: StartingLoadout = { weaponId: HANDGUN_ID };

function createPlayer(room: Room): Player {
  return {
    pos: { x: room.bounds.x + room.bounds.w / 2, y: room.bounds.y + room.bounds.h / 2 },
    vel: { x: 0, y: 0 },
    aim: 0,
    radius: PLAYER_RADIUS,
    health: { current: PLAYER_MAX_HEALTH, max: PLAYER_MAX_HEALTH },
    dash: { remainingMs: 0, dir: { x: 0, y: 0 }, cooldownMs: 0 },
    status: [],
  };
}

function createStartingInventory(loadout: StartingLoadout): Inventory {
  const def = getWeaponDef(loadout.weaponId);
  // Seule la réserve de l'arme choisie est servie : la rareté reste le pilier.
  const ammo: Record<AmmoType, number> = { handgun: 0, shotgun: 0, rifle: 0 };
  ammo[def.ammo] = START_AMMO[def.ammo];
  return {
    ammo,
    weapons: [createWeaponInstance(loadout.weaponId)],
    equippedIndex: 0,
    consumables: [],
    keyItems: [],
    capacity: 4,
  };
}

/** Assemble une run sur un étage fourni (utile aux tests et fixtures). */
export function createRunWithFloor(
  seed: number,
  floor: Floor,
  loadout: StartingLoadout = DEFAULT_LOADOUT,
): RunState {
  const start = floor.rooms[floor.startRoomId];
  if (!start) throw new Error('Salle de départ manquante dans le floor');
  const state: RunState = {
    seed,
    rng: createRng(seed),
    floor,
    player: createPlayer(start),
    inventory: createStartingInventory(loadout),
    relics: [],
    enemies: {},
    projectiles: [],
    nextEntitySeq: 0,
    elapsedMs: 0,
    status: 'active',
    stats: { floorsCleared: 0, kills: 0, deepestFloor: 0, startedAtMs: Date.now() },
  };
  spawnRoomContent(state, start);
  return state;
}

/** Run complète : étage 0 généré depuis une seed dérivée de la seed de run. */
export function createRun(seed: number, loadout: StartingLoadout = DEFAULT_LOADOUT): RunState {
  return createRunWithFloor(seed, generateFloor(deriveFloorSeed(seed, 0), 0), loadout);
}
