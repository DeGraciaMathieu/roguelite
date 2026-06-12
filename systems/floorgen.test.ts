import { describe, expect, it } from 'vitest';
import type { EnemyKind, Floor, RoomId } from '@/domain';
import { DEFAULT_FLOOR_GEN } from '@/data/floorgen';
import { circleIntersectsRect } from './collision';
import { generateFloor } from './floorgen';

const SEEDS = [1, 42, 1337, 0xdeadbeef];

/** Échantillon plus large pour les tests statistiques (mix, densité). */
const MANY_SEEDS = Array.from({ length: 25 }, (_, i) => i + 1);

/** Parcours BFS de salle en salle via les portes. */
function reachableRooms(floor: Floor): Set<RoomId> {
  const visited = new Set<RoomId>([floor.startRoomId]);
  const queue: RoomId[] = [floor.startRoomId];
  for (let head = 0; head < queue.length; head += 1) {
    const room = floor.rooms[queue[head]!];
    if (!room) continue;
    for (const doorId of room.doorIds) {
      const door = floor.doors[doorId];
      if (!door) continue;
      const next = door.roomA === room.id ? door.roomB : door.roomA;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

/** Un point est-il sur le périmètre du rect (à epsilon près) ? */
function onPerimeter(point: { x: number; y: number }, rect: { x: number; y: number; w: number; h: number }): boolean {
  const onVertical =
    (Math.abs(point.x - rect.x) < 1 || Math.abs(point.x - (rect.x + rect.w)) < 1) &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h;
  const onHorizontal =
    (Math.abs(point.y - rect.y) < 1 || Math.abs(point.y - (rect.y + rect.h)) < 1) &&
    point.x >= rect.x &&
    point.x <= rect.x + rect.w;
  return onVertical || onHorizontal;
}

describe('generateFloor — déterminisme', () => {
  it('produit exactement le même étage pour une même seed', () => {
    for (const seed of SEEDS) {
      expect(generateFloor(seed)).toEqual(generateFloor(seed));
    }
  });

  it('produit des étages différents pour des seeds différentes', () => {
    expect(JSON.stringify(generateFloor(1))).not.toBe(JSON.stringify(generateFloor(2)));
  });
});

describe('generateFloor — scaling de difficulté', () => {
  function countByKind(floor: Floor, kind: EnemyKind): number {
    return Object.values(floor.rooms)
      .flatMap((room) => room.enemySpawns)
      .filter((spawn) => spawn.kind === kind).length;
  }

  /** Densité moyenne d'ennemis par salle de combat, agrégée sur MANY_SEEDS. */
  function averageDensity(floorIndex: number): number {
    let enemies = 0;
    let combatRooms = 0;
    for (const seed of MANY_SEEDS) {
      const floor = generateFloor(seed, floorIndex);
      for (const room of Object.values(floor.rooms)) {
        if (room.kind !== 'combat') continue;
        combatRooms += 1;
        enemies += room.enemySpawns.length;
      }
    }
    return enemies / combatRooms;
  }

  it('même seed + même index → même étage, mix d’ennemis compris', () => {
    for (const seed of SEEDS) {
      expect(generateFloor(seed, 4)).toEqual(generateFloor(seed, 4));
    }
  });

  it('aucun théropode avant l’étage minimal', () => {
    for (const seed of MANY_SEEDS) {
      for (let index = 0; index < DEFAULT_FLOOR_GEN.theropode.minFloor; index += 1) {
        expect(countByKind(generateFloor(seed, index), 'theropode')).toBe(0);
      }
    }
  });

  it('le théropode apparaît à l’étage 4', () => {
    const found = MANY_SEEDS.some((seed) => countByKind(generateFloor(seed, 4), 'theropode') > 0);
    expect(found).toBe(true);
  });

  it('jamais plus du plafond de théropodes par étage', () => {
    for (const seed of MANY_SEEDS) {
      for (let index = 0; index <= 8; index += 1) {
        expect(countByKind(generateFloor(seed, index), 'theropode')).toBeLessThanOrEqual(
          DEFAULT_FLOOR_GEN.theropode.maxPerFloor,
        );
      }
    }
  });

  it('étages 0-1 : compys majoritaires, étages 2-3 : raptors majoritaires', () => {
    for (const index of [0, 1]) {
      let compys = 0;
      let raptors = 0;
      for (const seed of MANY_SEEDS) {
        const floor = generateFloor(seed, index);
        compys += countByKind(floor, 'compy');
        raptors += countByKind(floor, 'raptor');
      }
      expect(compys).toBeGreaterThan(raptors);
    }
    for (const index of [2, 3]) {
      let compys = 0;
      let raptors = 0;
      for (const seed of MANY_SEEDS) {
        const floor = generateFloor(seed, index);
        compys += countByKind(floor, 'compy');
        raptors += countByKind(floor, 'raptor');
      }
      expect(raptors).toBeGreaterThan(compys);
    }
  });

  it('la densité moyenne croît strictement entre l’étage 0 et l’étage 4', () => {
    const shallow = averageDensity(0);
    const mid = averageDensity(2);
    const deep = averageDensity(4);
    expect(shallow).toBeLessThan(mid);
    expect(mid).toBeLessThan(deep);
  });

  it('la densité reste plafonnée même très profond (théropode en sus)', () => {
    for (const seed of SEEDS) {
      const floor = generateFloor(seed, 20);
      for (const room of Object.values(floor.rooms)) {
        if (room.kind !== 'combat') continue;
        expect(room.enemySpawns.length).toBeLessThanOrEqual(
          DEFAULT_FLOOR_GEN.maxEnemiesPerCombatRoom + DEFAULT_FLOOR_GEN.theropode.maxPerFloor,
        );
      }
    }
  });
});

describe('generateFloor — invariants structurels', () => {
  it.each(SEEDS)('seed %i : nombre de salles dans les bornes de la config', (seed) => {
    const floor = generateFloor(seed);
    const count = Object.keys(floor.rooms).length;
    expect(count).toBeGreaterThanOrEqual(DEFAULT_FLOOR_GEN.roomCount.min);
    expect(count).toBeLessThanOrEqual(DEFAULT_FLOOR_GEN.roomCount.max);
  });

  it.each(SEEDS)('seed %i : exactement un start et un exit, distincts', (seed) => {
    const floor = generateFloor(seed);
    const kinds = Object.values(floor.rooms).map((room) => room.kind);
    expect(kinds.filter((kind) => kind === 'start')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'exit')).toHaveLength(1);
    expect(floor.exitRoomId).not.toBe(floor.startRoomId);
    expect(floor.currentRoomId).toBe(floor.startRoomId);
    expect(floor.rooms[floor.startRoomId]?.kind).toBe('start');
    expect(floor.rooms[floor.exitRoomId]?.kind).toBe('exit');
  });

  it.each(SEEDS)('seed %i : toutes les salles sont atteignables depuis le start', (seed) => {
    const floor = generateFloor(seed);
    expect(reachableRooms(floor).size).toBe(Object.keys(floor.rooms).length);
  });

  it.each(SEEDS)('seed %i : portes cohérentes et posées sur les murs partagés', (seed) => {
    const floor = generateFloor(seed);
    for (const door of Object.values(floor.doors)) {
      const roomA = floor.rooms[door.roomA];
      const roomB = floor.rooms[door.roomB];
      expect(roomA).toBeDefined();
      expect(roomB).toBeDefined();
      expect(roomA?.doorIds).toContain(door.id);
      expect(roomB?.doorIds).toContain(door.id);
      expect(onPerimeter(door.at, roomA!.bounds)).toBe(true);
      expect(onPerimeter(door.at, roomB!.bounds)).toBe(true);
      expect(door.locked).toBe(false);
    }
  });

  it.each(SEEDS)('seed %i : la salle start est découverte, sans ennemis', (seed) => {
    const floor = generateFloor(seed);
    const start = floor.rooms[floor.startRoomId];
    expect(start?.discovered).toBe(true);
    expect(start?.enemySpawns).toHaveLength(0);
    expect(start?.cleared).toBe(true);
  });

  it.each(SEEDS)('seed %i : les obstacles ne se chevauchent jamais', (seed) => {
    const floor = generateFloor(seed);
    for (const room of Object.values(floor.rooms)) {
      for (let i = 0; i < room.obstacles.length; i += 1) {
        for (let j = i + 1; j < room.obstacles.length; j += 1) {
          const a = room.obstacles[i]!;
          const b = room.obstacles[j]!;
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlap).toBe(false);
        }
      }
    }
  });

  it.each(SEEDS)('seed %i : portes et centre des salles restent dégagés', (seed) => {
    const floor = generateFloor(seed);
    const clearance = 60; // marge de passage minimale autour des points vitaux
    for (const room of Object.values(floor.rooms)) {
      const vitalPoints = [
        { x: room.bounds.x + room.bounds.w / 2, y: room.bounds.y + room.bounds.h / 2 },
        ...room.doorIds.map((id) => floor.doors[id]?.at).filter((at): at is NonNullable<typeof at> => at !== undefined),
      ];
      for (const obstacle of room.obstacles) {
        for (const point of vitalPoints) {
          const inside =
            point.x >= obstacle.x - clearance &&
            point.x <= obstacle.x + obstacle.w + clearance &&
            point.y >= obstacle.y - clearance &&
            point.y <= obstacle.y + obstacle.h + clearance;
          expect(inside).toBe(false);
        }
      }
    }
  });

  it.each(SEEDS)('seed %i : fosses valides — dans la salle, sans chevauchement, passages dégagés', (seed) => {
    const floor = generateFloor(seed);
    const clearance = 60;
    for (const room of Object.values(floor.rooms)) {
      const b = room.bounds;
      const vitalPoints = [
        { x: b.x + b.w / 2, y: b.y + b.h / 2 },
        ...room.doorIds
          .map((id) => floor.doors[id]?.at)
          .filter((at): at is NonNullable<typeof at> => at !== undefined),
      ];
      const others = [...room.obstacles];
      for (const pit of room.pits) {
        expect(pit.x).toBeGreaterThan(b.x);
        expect(pit.y).toBeGreaterThan(b.y);
        expect(pit.x + pit.w).toBeLessThan(b.x + b.w);
        expect(pit.y + pit.h).toBeLessThan(b.y + b.h);
        for (const other of others) {
          const overlap =
            pit.x < other.x + other.w && other.x < pit.x + pit.w && pit.y < other.y + other.h && other.y < pit.y + pit.h;
          expect(overlap).toBe(false);
        }
        for (const point of vitalPoints) {
          const inside =
            point.x >= pit.x - clearance &&
            point.x <= pit.x + pit.w + clearance &&
            point.y >= pit.y - clearance &&
            point.y <= pit.y + pit.h + clearance;
          expect(inside).toBe(false);
        }
        others.push(pit);
      }
    }
  });

  it.each(SEEDS)('seed %i : aucun spawn dans un obstacle ou une fosse', (seed) => {
    const floor = generateFloor(seed);
    for (const room of Object.values(floor.rooms)) {
      const blocked = [...room.obstacles, ...room.pits];
      const points = [
        ...room.enemySpawns.map((spawn) => spawn.at),
        ...room.lootSpawns.map((spawn) => spawn.at),
      ];
      for (const point of points) {
        expect(blocked.some((rect) => circleIntersectsRect(point, 14, rect))).toBe(false);
      }
    }
  });

  it('au plus une relique par étage, toujours dans la salle loot', () => {
    let found = 0;
    for (const seed of MANY_SEEDS) {
      const floor = generateFloor(seed);
      let relics = 0;
      for (const room of Object.values(floor.rooms)) {
        const inRoom = room.lootSpawns.filter((spawn) => spawn.kind === 'relic').length;
        if (inRoom > 0) expect(room.kind).toBe('loot');
        relics += inRoom;
      }
      expect(relics).toBeLessThanOrEqual(1);
      found += relics;
    }
    expect(found).toBeGreaterThan(0); // la chance configurée produit bien des reliques
  });

  it.each(SEEDS)('seed %i : chaque salle rest contient ses medkits', (seed) => {
    const floor = generateFloor(seed);
    for (const room of Object.values(floor.rooms)) {
      if (room.kind !== 'rest') continue;
      const medkits = room.lootSpawns.filter((spawn) => spawn.kind === 'consumable');
      expect(medkits).toHaveLength(DEFAULT_FLOOR_GEN.medkitsPerRestRoom);
    }
  });

  it.each(SEEDS)('seed %i : obstacles et spawns dans les limites de leur salle', (seed) => {
    const floor = generateFloor(seed);
    for (const room of Object.values(floor.rooms)) {
      const b = room.bounds;
      for (const o of room.obstacles) {
        expect(o.x).toBeGreaterThan(b.x);
        expect(o.y).toBeGreaterThan(b.y);
        expect(o.x + o.w).toBeLessThan(b.x + b.w);
        expect(o.y + o.h).toBeLessThan(b.y + b.h);
      }
      for (const spawn of [...room.enemySpawns.map((s) => s.at), ...room.lootSpawns.map((s) => s.at)]) {
        expect(spawn.x).toBeGreaterThan(b.x);
        expect(spawn.x).toBeLessThan(b.x + b.w);
        expect(spawn.y).toBeGreaterThan(b.y);
        expect(spawn.y).toBeLessThan(b.y + b.h);
      }
      expect(room.spawned).toBe(false);
    }
  });
});
