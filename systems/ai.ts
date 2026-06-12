/**
 * IA ennemie : machine à états idle / patrol / chase / attack, appliquée aux
 * seuls ennemis de la salle courante. Détection par distance + ligne de vue
 * (raycast contre les obstacles) ; la perte de vue envoie l'ennemi vers la
 * dernière position connue avant de reprendre sa patrouille.
 *
 * Meute de raptors : la détection se fait en deux passes — d'abord qui voit le
 * joueur (et donc quelles meutes sont alertées), ensuite le comportement de
 * chacun. Un membre alerté sans ligne de vue connaît la position du joueur ;
 * un membre alerté avec ligne de vue vise un point d'encerclement plutôt que
 * de foncer droit. Aucun aléa : les décisions sont géométriques, le
 * déterminisme de la run est préservé.
 */

import { isDead, nextFloat } from '@/domain';
import type { Enemy, Raptor, Rect, RunState, Vec2 } from '@/domain';
import { BLEED_DPS, BLEED_DURATION_MS } from '@/data/balance';
import { ENEMY_ARCHETYPES, RAPTOR_PACK } from '@/data/enemies';
import { moveCircle, pointInRect, segmentIntersectsRect, wallRects } from './collision';
import { currentRoom } from './movement';
import { applyBleed } from './status';

/** Distance de validation d'un waypoint de patrouille. */
const PATROL_WAYPOINT_TOLERANCE = 20;

/** Distance à laquelle la dernière position connue est considérée fouillée. */
const LOST_TARGET_TOLERANCE = 24;

/** La patrouille va moins vite que la chasse : lisible et moins punitif. */
const PATROL_SPEED_FACTOR = 0.5;

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function hasLineOfSight(from: Vec2, to: Vec2, obstacles: readonly Rect[]): boolean {
  return !obstacles.some((obstacle) => segmentIntersectsRect(from, to, obstacle));
}

function moveToward(
  enemy: Enemy,
  target: Vec2,
  speed: number,
  dtSec: number,
  solids: readonly Rect[],
): void {
  const dx = target.x - enemy.pos.x;
  const dy = target.y - enemy.pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) {
    enemy.vel = { x: 0, y: 0 };
    return;
  }
  enemy.vel = { x: (dx / dist) * speed, y: (dy / dist) * speed };
  enemy.pos = moveCircle(
    enemy.pos,
    enemy.radius,
    { x: enemy.vel.x * dtSec, y: enemy.vel.y * dtSec },
    solids,
  );
  enemy.facing = Math.atan2(dy, dx);
}

/** Meutes de la salle : membres triés par id pour des indices de flanc stables. */
function collectPacks(enemies: readonly Enemy[]): Map<number, Raptor[]> {
  const packs = new Map<number, Raptor[]>();
  for (const enemy of enemies) {
    if (enemy.kind !== 'raptor' || enemy.packId === null) continue;
    const members = packs.get(enemy.packId) ?? [];
    members.push(enemy);
    packs.set(enemy.packId, members);
  }
  for (const members of packs.values()) {
    members.sort((a, b) => (a.id < b.id ? -1 : 1));
  }
  return packs;
}

/**
 * Point d'encerclement du membre : cercle de flankRadius autour du joueur,
 * cap de base = direction joueur → centroïde de la meute, décalé d'un angle
 * propre à l'index du membre. La meute se déploie en éventail.
 */
function flankTarget(player: Vec2, members: readonly Raptor[], enemy: Raptor): Vec2 {
  const index = members.findIndex((member) => member.id === enemy.id);
  let cx = 0;
  let cy = 0;
  for (const member of members) {
    cx += member.pos.x;
    cy += member.pos.y;
  }
  const base = Math.atan2(cy / members.length - player.y, cx / members.length - player.x);
  const angle = base + (index - (members.length - 1) / 2) * RAPTOR_PACK.flankAngleStep;
  return {
    x: player.x + Math.cos(angle) * RAPTOR_PACK.flankRadius,
    y: player.y + Math.sin(angle) * RAPTOR_PACK.flankRadius,
  };
}

export function updateAi(state: RunState, dtMs: number): void {
  const room = currentRoom(state);
  const player = state.player;
  // Les fosses bloquent les corps mais ni les tirs ni la ligne de vue
  // (le raycast de détection ne teste que les obstacles).
  const solids = [...wallRects(room.bounds), ...room.obstacles, ...room.pits];
  const dtSec = dtMs / 1000;

  // Les ennemis des autres salles attendent leur tour, figés.
  const enemiesInRoom = Object.values(state.enemies).filter((enemy) =>
    pointInRect(enemy.pos, room.bounds),
  );

  // Passe 1 : détection — qui voit le joueur, quelles meutes sont alertées.
  const sees = new Map<Enemy, boolean>();
  const alertedPacks = new Set<number>();
  for (const enemy of enemiesInRoom) {
    const archetype = ENEMY_ARCHETYPES[enemy.kind];
    const seesPlayer =
      distance(enemy.pos, player.pos) <= archetype.aggroRadius &&
      hasLineOfSight(enemy.pos, player.pos, room.obstacles);
    sees.set(enemy, seesPlayer);
    if (seesPlayer && enemy.kind === 'raptor' && enemy.packId !== null) {
      alertedPacks.add(enemy.packId);
    }
  }
  const packs = collectPacks(enemiesInRoom);

  // Passe 2 : comportement.
  for (const enemy of enemiesInRoom) {
    const archetype = ENEMY_ARCHETYPES[enemy.kind];
    enemy.ai.attackCooldownMs = Math.max(0, enemy.ai.attackCooldownMs - dtMs);

    const toPlayer = distance(enemy.pos, player.pos);
    const contactDistance = enemy.radius + player.radius + archetype.attackRange;
    const seesPlayer = sees.get(enemy) ?? false;
    const packAlerted =
      enemy.kind === 'raptor' && enemy.packId !== null && alertedPacks.has(enemy.packId);

    // Alerte de meute : un membre sans ligne de vue apprend la position.
    if (packAlerted && !seesPlayer) {
      enemy.ai.lastKnownTarget = { ...player.pos };
      if (enemy.ai.phase === 'idle' || enemy.ai.phase === 'patrol') {
        enemy.ai.phase = 'chase';
      }
    }

    if (seesPlayer) {
      enemy.ai.lastKnownTarget = { ...player.pos };
      enemy.ai.phase = toPlayer <= contactDistance ? 'attack' : 'chase';
    } else if (enemy.ai.phase === 'attack') {
      enemy.ai.phase = 'chase';
    }

    switch (enemy.ai.phase) {
      case 'idle': {
        enemy.vel = { x: 0, y: 0 };
        if (enemy.patrolPath.length > 0) enemy.ai.phase = 'patrol';
        break;
      }
      case 'patrol': {
        const waypoint = enemy.patrolPath[enemy.ai.patrolIndex % enemy.patrolPath.length];
        if (!waypoint) {
          enemy.ai.phase = 'idle';
          break;
        }
        if (distance(enemy.pos, waypoint) <= PATROL_WAYPOINT_TOLERANCE) {
          enemy.ai.patrolIndex = (enemy.ai.patrolIndex + 1) % enemy.patrolPath.length;
        } else {
          moveToward(enemy, waypoint, archetype.moveSpeed * PATROL_SPEED_FACTOR, dtSec, solids);
        }
        break;
      }
      case 'chase': {
        let target = seesPlayer ? player.pos : enemy.ai.lastKnownTarget;
        if (!target) {
          enemy.ai.phase = enemy.patrolPath.length > 0 ? 'patrol' : 'idle';
          break;
        }
        if (!seesPlayer && !packAlerted && distance(enemy.pos, target) <= LOST_TARGET_TOLERANCE) {
          // Dernière position connue fouillée sans retrouver le joueur.
          delete enemy.ai.lastKnownTarget;
          enemy.ai.phase = enemy.patrolPath.length > 0 ? 'patrol' : 'idle';
          break;
        }
        // Encerclement : loin du joueur et en meute, on se déploie en éventail.
        if (seesPlayer && enemy.kind === 'raptor' && enemy.packId !== null) {
          const members = packs.get(enemy.packId);
          if (members && members.length >= 2 && toPlayer > RAPTOR_PACK.flankRadius) {
            target = flankTarget(player.pos, members, enemy);
          }
        }
        moveToward(enemy, target, archetype.moveSpeed, dtSec, solids);
        break;
      }
      case 'attack': {
        enemy.vel = { x: 0, y: 0 };
        enemy.facing = Math.atan2(player.pos.y - enemy.pos.y, player.pos.x - enemy.pos.x);
        if (enemy.ai.attackCooldownMs === 0) {
          player.health.current = Math.max(0, player.health.current - archetype.attackDamage);
          // Morsure qui fait saigner : tirage sur le RNG de la run, consommé
          // uniquement par les archétypes capables de l'infliger (déterminisme).
          if (archetype.bleedChance > 0 && nextFloat(state.rng) < archetype.bleedChance) {
            applyBleed(player, BLEED_DURATION_MS, BLEED_DPS);
          }
          enemy.ai.attackCooldownMs = archetype.attackCooldownMs;
          if (isDead(player.health)) {
            state.status = 'dead';
            return;
          }
        }
        break;
      }
    }
  }
}
