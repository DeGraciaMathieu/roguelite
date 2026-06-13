/**
 * Système de combat : tir du joueur (cadence, chargeur, recharge, dispersion
 * seedée), cycle de vie des projectiles et dégâts aux ennemis (morts, kills,
 * salle nettoyée).
 */

import { isDead, nextFloat } from '@/domain';
import type { Enemy, Room, RunState, Vec2, WeaponDef, WeaponInstance } from '@/domain';
import type { PlayerIntent } from '@/input/intent';
import { PROJECTILE_SPEED, PROJECTILE_TTL_MS } from '@/data/balance';
import { getWeaponDef } from '@/data/weapons';
import { pointInRect, segmentIntersectsCircle, segmentIntersectsRect, wallRects } from './collision';
import { currentRoom } from './movement';
import { damageMultiplier, reloadDurationMultiplier } from './relics';
import { allocEntityId } from './spawn';

/** Distance bouche du canon : le projectile naît hors du cercle du joueur. */
const MUZZLE_OFFSET = 4;

function equippedWeapon(state: RunState): WeaponInstance | null {
  return state.inventory.weapons[state.inventory.equippedIndex] ?? null;
}

function spawnProjectiles(state: RunState, def: WeaponDef): void {
  const player = state.player;
  const damage = def.damage * damageMultiplier(state);
  for (let i = 0; i < def.pellets; i += 1) {
    // Dispersion symétrique autour de la visée, tirée du RNG de la run
    // pour préserver le déterminisme seedé.
    const angle = player.aim + (nextFloat(state.rng) - 0.5) * def.spread;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const muzzle = player.radius + MUZZLE_OFFSET;
    state.projectiles.push({
      id: allocEntityId(state),
      pos: { x: player.pos.x + dirX * muzzle, y: player.pos.y + dirY * muzzle },
      vel: { x: dirX * PROJECTILE_SPEED, y: dirY * PROJECTILE_SPEED },
      damage,
      ammo: def.ammo,
      ownerId: 'player',
      ttlMs: PROJECTILE_TTL_MS,
    });
  }
}

export function updateCombat(state: RunState, intent: PlayerIntent): void {
  // Changement d'arme : chaque instance garde son chargeur et sa recharge en
  // cours (une recharge échue se termine au retour sur l'arme).
  if (
    intent.weaponSlot !== null &&
    intent.weaponSlot >= 0 &&
    intent.weaponSlot < state.inventory.weapons.length
  ) {
    state.inventory.equippedIndex = intent.weaponSlot;
  }

  const weapon = equippedWeapon(state);
  if (!weapon) return;
  const def = getWeaponDef(weapon.defId);
  const now = state.elapsedMs;

  // Fin de recharge : transvase la réserve dans le chargeur.
  if (weapon.reloadingUntilMs !== null && now >= weapon.reloadingUntilMs) {
    const reserve = state.inventory.ammo[def.ammo];
    const loaded = Math.min(def.magazineSize - weapon.ammoInMag, reserve);
    weapon.ammoInMag += loaded;
    state.inventory.ammo[def.ammo] = reserve - loaded;
    weapon.reloadingUntilMs = null;
  }

  // Recharge demandée, ou automatique quand on tire chargeur vide.
  const wantsReload = intent.reload || (intent.fire && weapon.ammoInMag === 0);
  if (
    wantsReload &&
    weapon.reloadingUntilMs === null &&
    weapon.ammoInMag < def.magazineSize &&
    state.inventory.ammo[def.ammo] > 0
  ) {
    weapon.reloadingUntilMs = now + def.reloadMs * reloadDurationMultiplier(state);
  }

  if (
    intent.fire &&
    weapon.reloadingUntilMs === null &&
    weapon.ammoInMag > 0 &&
    now >= weapon.nextShotAtMs
  ) {
    spawnProjectiles(state, def);
    weapon.ammoInMag -= 1;
    weapon.nextShotAtMs = now + def.fireRateMs;
  }
}

/**
 * Premier ennemi rencontré sur le segment [from, to], avec le t de son point de
 * contact. Sur deux ennemis alignés, le plus petit t — donc le plus proche du
 * tireur — gagne.
 */
function firstEnemyOnSegment(
  state: RunState,
  from: Vec2,
  to: Vec2,
): { enemy: Enemy; t: number } | null {
  let best: { enemy: Enemy; t: number } | null = null;
  for (const enemy of Object.values(state.enemies)) {
    const t = segmentIntersectsCircle(from, to, enemy.pos, enemy.radius);
    if (t === null) continue;
    if (best === null || t < best.t) best = { enemy, t };
  }
  return best;
}

function applyDamageToEnemy(state: RunState, room: Room, enemy: Enemy, damage: number): void {
  enemy.health.current -= damage;
  if (!isDead(enemy.health)) return;
  delete state.enemies[enemy.id];
  state.stats.kills += 1;
  const survivors = Object.values(state.enemies).some((other) => pointInRect(other.pos, room.bounds));
  if (room.spawned && !survivors) room.cleared = true;
}

export function updateProjectiles(state: RunState, dtMs: number): void {
  const room = currentRoom(state);
  const solids = [...wallRects(room.bounds), ...room.obstacles];
  const dtSec = dtMs / 1000;

  state.projectiles = state.projectiles.filter((projectile) => {
    projectile.ttlMs -= dtMs;
    if (projectile.ttlMs <= 0) return false;

    // Collision balayée sur le segment parcouru ce tick : on cherche le premier
    // contact le long de [prev → next] plutôt que de tester le seul point final.
    // Indépendant de la vitesse, donc à l'abri du tunneling à haute vélocité.
    const prev = { x: projectile.pos.x, y: projectile.pos.y };
    const next = {
      x: prev.x + projectile.vel.x * dtSec,
      y: prev.y + projectile.vel.y * dtSec,
    };

    const enemyHit =
      projectile.ownerId === 'player' ? firstEnemyOnSegment(state, prev, next) : null;

    if (enemyHit) {
      // Un mur ou un obstacle interposé entre le tireur et l'ennemi absorbe le
      // tir avant qu'il n'atteigne la cible : on borne le test au sous-segment.
      const contact = {
        x: prev.x + (next.x - prev.x) * enemyHit.t,
        y: prev.y + (next.y - prev.y) * enemyHit.t,
      };
      if (solids.some((solid) => segmentIntersectsRect(prev, contact, solid))) return false;
      applyDamageToEnemy(state, room, enemyHit.enemy, projectile.damage);
      return false;
    }

    if (solids.some((solid) => segmentIntersectsRect(prev, next, solid))) return false;

    projectile.pos.x = next.x;
    projectile.pos.y = next.y;
    return true;
  });
}
