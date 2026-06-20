import { describe, expect, it } from 'vitest';
import { asId } from '@/domain';
import type { Rect, Room, Vec2 } from '@/domain';
import { ARRIVAL_RADIUS, buildRoomNav } from './pathfind';

const RADIUS = 12;

/** Salle nue de taille standard ; obstacles/fosses passés au besoin. */
function makeRoom(obstacles: Rect[] = [], pits: Rect[] = []): Room {
  return {
    id: asId<'RoomId'>('test-room'),
    kind: 'combat',
    bounds: { x: 0, y: 0, w: 800, h: 600 },
    obstacles,
    pits,
    doorIds: [],
    enemySpawns: [],
    lootSpawns: [],
    spawned: true,
    cleared: false,
    discovered: true,
  };
}

/** Mur vertical pleine hauteur au milieu de la salle (coupe en deux). */
const FULL_WALL: Rect = { x: 380, y: 0, w: 40, h: 600 };
/** Même mur mais s’arrêtant à mi-hauteur : laisse un passage par le bas. */
const WALL_WITH_GAP: Rect = { x: 380, y: 0, w: 40, h: 400 };

const LEFT: Vec2 = { x: 100, y: 300 };
const RIGHT: Vec2 = { x: 700, y: 300 };

describe('buildRoomNav — salle dégagée', () => {
  it('rejoint n’importe quel point de la zone praticable', () => {
    const nav = buildRoomNav(makeRoom(), LEFT, RADIUS);
    expect(nav.reachable(RIGHT)).toBe(true);
  });

  it('pas en ligne droite : direction unitaire vers la cible', () => {
    const nav = buildRoomNav(makeRoom(), LEFT, RADIUS);
    const dir = nav.stepToward(LEFT, RIGHT);
    expect(dir).not.toBeNull();
    if (!dir) throw new Error('direction attendue');
    expect(Math.hypot(dir.x, dir.y)).toBeCloseTo(1, 10);
    // Cible droit devant : cap quasi horizontal vers +x.
    expect(dir.x).toBeGreaterThan(0.9);
    expect(Math.abs(dir.y)).toBeLessThan(0.1);
  });

  it('renvoie null une fois la cible atteinte (sous le rayon d’arrivée)', () => {
    const nav = buildRoomNav(makeRoom(), LEFT, RADIUS);
    const near: Vec2 = { x: LEFT.x + ARRIVAL_RADIUS / 2, y: LEFT.y };
    expect(nav.stepToward(LEFT, near)).toBeNull();
  });
});

describe('buildRoomNav — obstacles', () => {
  it('contourne un mur percé d’un passage', () => {
    const nav = buildRoomNav(makeRoom([WALL_WITH_GAP]), LEFT, RADIUS);
    expect(nav.reachable(RIGHT)).toBe(true);
    const dir = nav.stepToward(LEFT, RIGHT);
    expect(dir).not.toBeNull();
    if (!dir) throw new Error('direction attendue');
    // Le passage est en bas : le premier pas ne fonce pas tout droit, il descend.
    expect(dir.y).toBeGreaterThan(0);
  });

  it('déclare injoignable une cible derrière un mur plein', () => {
    const nav = buildRoomNav(makeRoom([FULL_WALL]), LEFT, RADIUS);
    expect(nav.reachable(RIGHT)).toBe(false);
    expect(nav.stepToward(LEFT, RIGHT)).toBeNull();
  });

  it('une zone `avoid` bloque le passage comme un mur', () => {
    const nav = buildRoomNav(makeRoom(), LEFT, RADIUS, [FULL_WALL]);
    expect(nav.reachable(RIGHT)).toBe(false);
  });
});

describe('buildRoomNav — maxStandoff', () => {
  it('un point hors zone praticable n’est « proche » qu’avec une tolérance suffisante', () => {
    const nav = buildRoomNav(makeRoom(), LEFT, RADIUS);
    const corner: Vec2 = { x: 4, y: 4 }; // dans la marge de mur, pas praticable
    expect(nav.reachable(corner, 5)).toBe(false);
    expect(nav.reachable(corner)).toBe(true); // tolérance infinie par défaut
  });
});

describe('buildRoomNav — déterminisme', () => {
  it('deux navs identiques produisent les mêmes pas', () => {
    const a = buildRoomNav(makeRoom([WALL_WITH_GAP]), LEFT, RADIUS);
    const b = buildRoomNav(makeRoom([WALL_WITH_GAP]), LEFT, RADIUS);
    expect(a.stepToward(LEFT, RIGHT)).toEqual(b.stepToward(LEFT, RIGHT));
  });
});
