import { describe, expect, it } from 'vitest';
import type { Room, RunState } from '@/domain';
import { ENEMY_ARCHETYPES } from '@/data/enemies';
import { generateFloor } from './floorgen';
import { createRunWithFloor } from './run';
import { spawnRoomContent } from './spawn';

/** Run générée + une salle de combat encore non visitée. */
function runWithCombatRoom(seed = 9): { state: RunState; room: Room } {
  const state = createRunWithFloor(seed, generateFloor(seed));
  const room = Object.values(state.floor.rooms).find((candidate) => candidate.enemySpawns.length > 0);
  if (!room) throw new Error('Aucune salle de combat générée');
  return { state, room };
}

describe('spawnRoomContent', () => {
  it('matérialise un ennemi par spawn à la première visite', () => {
    const { state, room } = runWithCombatRoom();

    spawnRoomContent(state, room);

    expect(room.spawned).toBe(true);
    expect(Object.keys(state.enemies)).toHaveLength(room.enemySpawns.length);
  });

  it('ne respawne jamais une salle déjà visitée', () => {
    const { state, room } = runWithCombatRoom();
    spawnRoomContent(state, room);
    const count = Object.keys(state.enemies).length;

    spawnRoomContent(state, room);

    expect(Object.keys(state.enemies)).toHaveLength(count);
  });

  it('applique les stats de l’archétype et place l’ennemi au point de spawn', () => {
    const { state, room } = runWithCombatRoom();
    spawnRoomContent(state, room);

    for (const enemy of Object.values(state.enemies)) {
      const archetype = ENEMY_ARCHETYPES[enemy.kind];
      expect(enemy.health).toEqual({ current: archetype.maxHealth, max: archetype.maxHealth });
      expect(enemy.radius).toBe(archetype.radius);
      expect(enemy.ai.phase).toBe('idle');
      expect(room.enemySpawns.map((spawn) => spawn.at)).toContainEqual(enemy.pos);
    }
  });

  it('produit des ids déterministes pour un même état', () => {
    const a = runWithCombatRoom(21);
    const b = runWithCombatRoom(21);
    spawnRoomContent(a.state, a.room);
    spawnRoomContent(b.state, b.room);

    expect(Object.keys(a.state.enemies)).toEqual(Object.keys(b.state.enemies));
  });

  it('matérialise un théropode avec les stats de son archétype', () => {
    const { state, room } = runWithCombatRoom();
    room.enemySpawns = [
      { kind: 'theropode', at: { x: room.bounds.x + 150, y: room.bounds.y + 150 } },
    ];

    spawnRoomContent(state, room);

    const enemies = Object.values(state.enemies);
    expect(enemies).toHaveLength(1);
    const theropode = enemies[0]!;
    const archetype = ENEMY_ARCHETYPES.theropode;
    expect(theropode.kind).toBe('theropode');
    expect(theropode.health).toEqual({ current: archetype.maxHealth, max: archetype.maxHealth });
    expect(theropode.radius).toBe(archetype.radius);
    expect(theropode.ai.phase).toBe('idle');
  });

  it('les raptors d’une même salle forment une seule meute', () => {
    const { state, room } = runWithCombatRoom();
    room.enemySpawns = [
      { kind: 'raptor', at: { x: room.bounds.x + 100, y: room.bounds.y + 100 } },
      { kind: 'raptor', at: { x: room.bounds.x + 200, y: room.bounds.y + 100 } },
      { kind: 'compy', at: { x: room.bounds.x + 300, y: room.bounds.y + 100 } },
    ];

    spawnRoomContent(state, room);

    const raptors = Object.values(state.enemies).filter((enemy) => enemy.kind === 'raptor');
    const compys = Object.values(state.enemies).filter((enemy) => enemy.kind === 'compy');
    expect(raptors).toHaveLength(2);
    expect(raptors[0]?.packId).not.toBeNull();
    expect(raptors[0]?.packId).toBe(raptors[1]?.packId);
    expect(compys[0] && 'packId' in compys[0]).toBe(false);
  });

  it('deux salles donnent deux meutes distinctes', () => {
    const { state } = runWithCombatRoom();
    const combatRooms = Object.values(state.floor.rooms)
      .filter((room) => room.enemySpawns.length > 0)
      .slice(0, 2);
    for (const room of combatRooms) {
      room.enemySpawns = [{ kind: 'raptor', at: { x: room.bounds.x + 100, y: room.bounds.y + 100 } }];
      spawnRoomContent(state, room);
    }

    const packIds = Object.values(state.enemies)
      .filter((enemy) => enemy.kind === 'raptor')
      .map((enemy) => enemy.packId);
    expect(new Set(packIds).size).toBe(combatRooms.length);
  });

  it('borne le chemin de patrouille à l’intérieur de la salle', () => {
    const { state, room } = runWithCombatRoom();
    spawnRoomContent(state, room);

    const b = room.bounds;
    for (const enemy of Object.values(state.enemies)) {
      for (const waypoint of enemy.patrolPath) {
        expect(waypoint.x).toBeGreaterThan(b.x);
        expect(waypoint.x).toBeLessThan(b.x + b.w);
        expect(waypoint.y).toBeGreaterThan(b.y);
        expect(waypoint.y).toBeLessThan(b.y + b.h);
      }
    }
  });
});
