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
import { pointInRect, wallRects } from './collision';
import { currentRoom } from './movement';
import { allocEntityId } from './spawn';

/** Distance bouche du canon : le projectile naît hors du cercle du joueur. */
const MUZZLE_OFFSET = 4;

function equippedWeapon(state: RunState): WeaponInstance | null {
  return state.inventory.weapons[state.inventory.equippedIndex] ?? null;
}

function spawnProjectiles(state: RunState, def: WeaponDef): void {
  const player = state.player;
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
      damage: def.damage,
      ammo: def.ammo,
      ownerId: 'player',
      ttlMs: PROJECTILE_TTL_MS,
    });
  }
}

export function updateCombat(state: RunState, intent: PlayerIntent): void {
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
    weapon.reloadingUntilMs = now + def.reloadMs;
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

function enemyAt(state: RunState, point: Vec2): Enemy | null {
  for (const enemy of Object.values(state.enemies)) {
    const dx = point.x - enemy.pos.x;
    const dy = point.y - enemy.pos.y;
    if (dx * dx + dy * dy <= enemy.radius * enemy.radius) return enemy;
  }
  return null;
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
    projectile.pos.x += projectile.vel.x * dtSec;
    projectile.pos.y += projectile.vel.y * dtSec;
    // Test ponctuel par tick : ~12 px parcourus par tick face à des solides
    // d'au moins 16 px d'épaisseur, le tunneling est impossible.
    if (solids.some((solid) => pointInRect(projectile.pos, solid))) return false;

    if (projectile.ownerId === 'player') {
      const hit = enemyAt(state, projectile.pos);
      if (hit) {
        applyDamageToEnemy(state, room, hit, projectile.damage);
        return false;
      }
    }
    return true;
  });
}
