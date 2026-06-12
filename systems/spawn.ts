/**
 * Matérialisation paresseuse du contenu d'une salle : les EnemySpawn posés par
 * la génération deviennent des Enemy à la première visite, jamais après
 * (`room.spawned`). Les ids viennent du compteur de la run : déterministe.
 */

import { asId } from '@/domain';
import type { Enemy, EnemyKind, EntityId, Rect, Room, RunState, Vec2 } from '@/domain';
import { WALL_THICKNESS } from '@/data/balance';
import { ENEMY_ARCHETYPES } from '@/data/enemies';
import { circleIntersectsRect } from './collision';

export function allocEntityId(state: RunState): EntityId {
  const id = asId<'EntityId'>(`e${state.nextEntitySeq}`);
  state.nextEntitySeq += 1;
  return id;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Boucle de patrouille carrée autour du spawn, bornée à l'intérieur des murs.
 * Les coins qui tomberaient dans un obstacle sont écartés : un waypoint
 * inatteignable bloquerait l'ennemi contre le décor.
 */
function buildPatrolPath(at: Vec2, patrolRadius: number, enemyRadius: number, room: Room): Vec2[] {
  if (patrolRadius <= 0) return [];
  const inset = WALL_THICKNESS + enemyRadius + 8;
  const b = room.bounds;
  const corners: Vec2[] = [
    { x: at.x - patrolRadius, y: at.y - patrolRadius },
    { x: at.x + patrolRadius, y: at.y - patrolRadius },
    { x: at.x + patrolRadius, y: at.y + patrolRadius },
    { x: at.x - patrolRadius, y: at.y + patrolRadius },
  ].map((corner) => ({
    x: clamp(corner.x, b.x + inset, b.x + b.w - inset),
    y: clamp(corner.y, b.y + inset, b.y + b.h - inset),
  }));
  const blocking = [...room.obstacles, ...room.pits];
  return corners.filter(
    (corner) => !blocking.some((rect: Rect) => circleIntersectsRect(corner, enemyRadius, rect)),
  );
}

function createEnemy(
  state: RunState,
  room: Room,
  kind: EnemyKind,
  at: Vec2,
  packId: number | null,
): Enemy {
  const archetype = ENEMY_ARCHETYPES[kind];
  const base = {
    id: allocEntityId(state),
    pos: { ...at },
    vel: { x: 0, y: 0 },
    facing: 0,
    radius: archetype.radius,
    health: { current: archetype.maxHealth, max: archetype.maxHealth },
    ai: { phase: 'idle' as const, attackCooldownMs: 0, patrolIndex: 0 },
    patrolPath: buildPatrolPath(at, archetype.patrolRadius, archetype.radius, room),
  };
  switch (kind) {
    case 'raptor':
      return { ...base, kind, packId };
    case 'compy':
      return { ...base, kind };
    case 'theropode':
      return { ...base, kind };
    case 'boss':
      return { ...base, kind, pattern: 'charge', phaseIndex: 0 };
  }
}

export function spawnRoomContent(state: RunState, room: Room): void {
  if (room.spawned) return;
  room.spawned = true;

  // Les raptors d'une même salle forment une meute (alerte partagée, flanc).
  // L'id de meute sort du même compteur que les EntityId : déterministe.
  let packId: number | null = null;
  if (room.enemySpawns.some((spawn) => spawn.kind === 'raptor')) {
    packId = state.nextEntitySeq;
    state.nextEntitySeq += 1;
  }

  for (const spawn of room.enemySpawns) {
    const enemy = createEnemy(state, room, spawn.kind, spawn.at, packId);
    state.enemies[enemy.id] = enemy;
  }
}
