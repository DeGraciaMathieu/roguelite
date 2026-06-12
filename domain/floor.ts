/**
 * Structure d'un étage généré procéduralement.
 * Layout par graphe : salles (noeuds) reliées par des portes (arêtes).
 * Pur et déterministe à partir d'une seed.
 */

import type { DoorId, ItemDefId, Rect, RoomId, Vec2 } from './core';
import type { EnemyKind } from './entities';
import type { RelicDefId } from './core';

// --- Salles ------------------------------------------------------------------

export type RoomKind =
  | 'start' // entrée de l'étage
  | 'combat' // salle d'affrontement
  | 'loot' // récompenses
  | 'rest' // typewriter / soin, respiration
  | 'boss' // boss d'étage (selon la profondeur)
  | 'exit'; // escalier vers l'étage suivant

export interface EnemySpawn {
  kind: EnemyKind;
  at: Vec2;
}

export type LootSpawn =
  | { kind: 'ammo'; at: Vec2; ammo: 'handgun' | 'shotgun' | 'rifle'; amount: number }
  | { kind: 'consumable'; at: Vec2; defId: ItemDefId }
  | { kind: 'weapon'; at: Vec2; defId: ItemDefId }
  | { kind: 'relic'; at: Vec2; defId: RelicDefId }
  | { kind: 'key'; at: Vec2; defId: ItemDefId };

export interface Room {
  id: RoomId;
  kind: RoomKind;
  /** Emprise en coordonnées monde. */
  bounds: Rect;
  /** Obstacles pleins (caisses, piliers) : bloquent corps, tirs et vue. */
  obstacles: Rect[];
  /** Zones de vide : infranchissables au sol, mais les tirs et la vue passent. */
  pits: Rect[];
  doorIds: DoorId[];
  /** Spawns matérialisés à la première visite (spawn paresseux). */
  enemySpawns: EnemySpawn[];
  lootSpawns: LootSpawn[];
  /** True une fois le contenu instancié. */
  spawned: boolean;
  /** True quand tous les ennemis de la salle sont éliminés. */
  cleared: boolean;
  /** True une fois la salle découverte (fog of war). */
  discovered: boolean;
}

// --- Portes ------------------------------------------------------------------

export interface Door {
  id: DoorId;
  roomA: RoomId;
  roomB: RoomId;
  /** Position de l'ouverture (pour le rendu et le passage). */
  at: Vec2;
  locked: boolean;
  /** Clé requise si verrouillée. */
  keyItemId: ItemDefId | null;
  open: boolean;
}

// --- Étage -------------------------------------------------------------------

export interface Floor {
  /** Profondeur, 0-based. Sert au scaling de difficulté. */
  index: number;
  /** Seed dérivée de la run, pour rejouer l'étage à l'identique. */
  seed: number;
  rooms: Record<RoomId, Room>;
  doors: Record<DoorId, Door>;
  startRoomId: RoomId;
  exitRoomId: RoomId;
  /** Salle où se trouve actuellement le joueur. */
  currentRoomId: RoomId;
}
