import { describe, expect, it } from 'vitest';
import { asId } from '@/domain';
import type { Enemy, RunState, WeaponInstance } from '@/domain';
import type { PlayerIntent } from '@/input/intent';
import { createDebugRun } from '@/data/debugRoom';
import { START_AMMO } from '@/data/balance';
import { RIFLE_ID, createWeaponInstance, getWeaponDef } from '@/data/weapons';
import { updateCombat, updateProjectiles } from './combat';
import { spawnRoomContent } from './spawn';

function intent(overrides: Partial<PlayerIntent> = {}): PlayerIntent {
  return {
    move: { x: 0, y: 0 },
    aimWorld: { x: 0, y: 0 },
    fire: false,
    reload: false,
    useConsumable: false,
    dash: false,
    weaponSlot: null,
    ...overrides,
  };
}

function equipped(state: RunState): WeaponInstance {
  const weapon = state.inventory.weapons[state.inventory.equippedIndex];
  if (!weapon) throw new Error('Aucune arme équipée');
  return weapon;
}

/** Salle de debug avec un raptor dans l'axe de tir par défaut (vers la droite). */
function stateWithEnemyInLine(): { state: RunState; enemy: Enemy } {
  const state = createDebugRun(1);
  const room = state.floor.rooms[state.floor.currentRoomId];
  if (!room) throw new Error('Salle de debug manquante');
  room.spawned = false;
  room.enemySpawns = [{ kind: 'raptor', at: { x: 500, y: 300 } }];
  spawnRoomContent(state, room);
  const enemy = Object.values(state.enemies)[0];
  if (!enemy) throw new Error('Ennemi non spawné');
  return { state, enemy };
}

describe('updateCombat', () => {
  it('tire un projectile et consomme une munition du chargeur', () => {
    const state = createDebugRun(1);
    const magazineSize = getWeaponDef(equipped(state).defId).magazineSize;

    updateCombat(state, intent({ fire: true }));

    expect(state.projectiles).toHaveLength(1);
    expect(equipped(state).ammoInMag).toBe(magazineSize - 1);
    expect(state.projectiles[0]?.ownerId).toBe('player');
  });

  it('respecte la cadence de tir', () => {
    const state = createDebugRun(1);
    const def = getWeaponDef(equipped(state).defId);

    updateCombat(state, intent({ fire: true }));
    updateCombat(state, intent({ fire: true }));
    expect(state.projectiles).toHaveLength(1);

    state.elapsedMs = def.fireRateMs;
    updateCombat(state, intent({ fire: true }));
    expect(state.projectiles).toHaveLength(2);
  });

  it('recharge automatiquement quand on tire chargeur vide', () => {
    const state = createDebugRun(1);
    const def = getWeaponDef(equipped(state).defId);
    equipped(state).ammoInMag = 0;

    updateCombat(state, intent({ fire: true }));
    expect(state.projectiles).toHaveLength(0);
    expect(equipped(state).reloadingUntilMs).toBe(def.reloadMs);

    state.elapsedMs = def.reloadMs;
    updateCombat(state, intent());
    expect(equipped(state).ammoInMag).toBe(def.magazineSize);
    expect(state.inventory.ammo[def.ammo]).toBe(START_AMMO[def.ammo] - def.magazineSize);
    expect(equipped(state).reloadingUntilMs).toBeNull();
  });

  it('recharge à la demande et complète seulement le chargeur entamé', () => {
    const state = createDebugRun(1);
    const def = getWeaponDef(equipped(state).defId);

    updateCombat(state, intent({ fire: true })); // chargeur à magazineSize - 1
    state.elapsedMs = def.fireRateMs;
    updateCombat(state, intent({ reload: true }));
    expect(equipped(state).reloadingUntilMs).toBe(state.elapsedMs + def.reloadMs);

    state.elapsedMs += def.reloadMs;
    updateCombat(state, intent());
    expect(equipped(state).ammoInMag).toBe(def.magazineSize);
    expect(state.inventory.ammo[def.ammo]).toBe(START_AMMO[def.ammo] - 1);
  });

  it('ne tire pas pendant une recharge', () => {
    const state = createDebugRun(1);
    const def = getWeaponDef(equipped(state).defId);

    updateCombat(state, intent({ fire: true })); // entame le chargeur
    state.elapsedMs = def.fireRateMs;
    updateCombat(state, intent({ reload: true }));
    expect(equipped(state).reloadingUntilMs).not.toBeNull();

    state.elapsedMs += def.reloadMs - 1;
    updateCombat(state, intent({ fire: true }));
    expect(state.projectiles).toHaveLength(1); // uniquement le tir initial
  });

  it('les touches 1-3 changent l’arme équipée, les slots invalides sont ignorés', () => {
    const state = createDebugRun(1);
    expect(state.inventory.equippedIndex).toBe(0);

    updateCombat(state, intent({ weaponSlot: 1 }));
    expect(state.inventory.equippedIndex).toBe(1);

    updateCombat(state, intent({ weaponSlot: 5 }));
    expect(state.inventory.equippedIndex).toBe(1);

    updateCombat(state, intent({ weaponSlot: 0 }));
    expect(state.inventory.equippedIndex).toBe(0);
  });

  it('chaque arme garde son chargeur et sa recharge en changeant de slot', () => {
    const state = createDebugRun(1);
    const def = getWeaponDef(equipped(state).defId);

    updateCombat(state, intent({ fire: true })); // entame le chargeur du handgun
    state.elapsedMs = def.fireRateMs;
    updateCombat(state, intent({ reload: true })); // lance sa recharge
    const reloadingUntil = equipped(state).reloadingUntilMs;
    expect(reloadingUntil).not.toBeNull();

    updateCombat(state, intent({ weaponSlot: 2 })); // passe au rifle
    expect(equipped(state).reloadingUntilMs).toBeNull(); // le rifle, lui, est prêt

    updateCombat(state, intent({ weaponSlot: 0 })); // revient au handgun
    expect(equipped(state).reloadingUntilMs).toBe(reloadingUntil);
  });

  it('le rifle tire un seul projectile précis, à cadence longue', () => {
    const state = createDebugRun(1);
    state.inventory.weapons = [createWeaponInstance(RIFLE_ID)];
    const def = getWeaponDef(RIFLE_ID);

    updateCombat(state, intent({ fire: true }));
    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0]?.damage).toBe(def.damage);
    expect(state.projectiles[0]?.ammo).toBe('rifle');

    // Cadence longue : rien ne part avant fireRateMs.
    state.elapsedMs = def.fireRateMs - 1;
    updateCombat(state, intent({ fire: true }));
    expect(state.projectiles).toHaveLength(1);

    state.elapsedMs = def.fireRateMs;
    updateCombat(state, intent({ fire: true }));
    expect(state.projectiles).toHaveLength(2);
  });

  it('chargeur court du rifle : recharge auto après 5 tirs', () => {
    const state = createDebugRun(1);
    state.inventory.weapons = [createWeaponInstance(RIFLE_ID)];
    const def = getWeaponDef(RIFLE_ID);

    for (let shot = 0; shot < def.magazineSize; shot += 1) {
      state.elapsedMs = shot * def.fireRateMs;
      updateCombat(state, intent({ fire: true }));
    }
    expect(state.projectiles).toHaveLength(def.magazineSize);
    expect(equipped(state).ammoInMag).toBe(0);

    // Chargeur vide + tir : la recharge démarre, servie par la réserve rifle.
    updateCombat(state, intent({ fire: true }));
    expect(equipped(state).reloadingUntilMs).toBe(state.elapsedMs + def.reloadMs);

    state.elapsedMs += def.reloadMs;
    updateCombat(state, intent());
    expect(equipped(state).ammoInMag).toBe(def.magazineSize);
    expect(state.inventory.ammo.rifle).toBe(START_AMMO.rifle - def.magazineSize);
  });

  it('une relique de dégâts multiplie les dégâts des projectiles', () => {
    const state = createDebugRun(1);
    const def = getWeaponDef(equipped(state).defId);
    state.relics = [{ defId: asId<'RelicDefId'>('crocs-sertis') }]; // damageMult 1.25

    updateCombat(state, intent({ fire: true }));

    expect(state.projectiles[0]?.damage).toBeCloseTo(def.damage * 1.25);
  });

  it('une relique de recharge raccourcit la durée de recharge', () => {
    const state = createDebugRun(1);
    const def = getWeaponDef(equipped(state).defId);
    state.relics = [{ defId: asId<'RelicDefId'>('mains-lestes') }]; // reloadSpeedMult 0.7
    equipped(state).ammoInMag = 0;

    updateCombat(state, intent({ fire: true })); // recharge auto

    expect(equipped(state).reloadingUntilMs).toBeCloseTo(def.reloadMs * 0.7);
  });

  it('est déterministe : même seed, même dispersion de tir', () => {
    const stateA = createDebugRun(7);
    const stateB = createDebugRun(7);

    updateCombat(stateA, intent({ fire: true }));
    updateCombat(stateB, intent({ fire: true }));

    expect(stateA.projectiles[0]?.vel).toEqual(stateB.projectiles[0]?.vel);
    expect(stateA.projectiles[0]?.id).toEqual(stateB.projectiles[0]?.id);
  });
});

describe('updateProjectiles', () => {
  it('avance les projectiles puis les absorbe au contact d’un mur', () => {
    const state = createDebugRun(1);
    updateCombat(state, intent({ fire: true })); // visée par défaut : vers la droite

    for (let i = 0; i < 10; i += 1) {
      updateProjectiles(state, 1000 / 60);
    }
    expect(state.projectiles).toHaveLength(1);

    // Le mur droit est à ~370 px : atteint bien avant l'expiration du TTL.
    for (let i = 0; i < 40; i += 1) {
      updateProjectiles(state, 1000 / 60);
    }
    expect(state.projectiles).toHaveLength(0);
  });

  it('blesse un ennemi touché et consomme le projectile', () => {
    const { state, enemy } = stateWithEnemyInLine();
    const startHealth = enemy.health.current;

    updateCombat(state, intent({ fire: true })); // visée par défaut : vers l'ennemi
    for (let i = 0; i < 20; i += 1) updateProjectiles(state, 1000 / 60);

    const damage = getWeaponDef(equipped(state).defId).damage;
    expect(enemy.health.current).toBe(startHealth - damage);
    expect(state.projectiles).toHaveLength(0);
    expect(state.stats.kills).toBe(0);
  });

  it('tue un ennemi, incrémente kills et marque la salle nettoyée', () => {
    const { state, enemy } = stateWithEnemyInLine();
    enemy.health.current = getWeaponDef(equipped(state).defId).damage;

    updateCombat(state, intent({ fire: true }));
    for (let i = 0; i < 20; i += 1) updateProjectiles(state, 1000 / 60);

    expect(Object.keys(state.enemies)).toHaveLength(0);
    expect(state.stats.kills).toBe(1);
    expect(state.floor.rooms[state.floor.currentRoomId]?.cleared).toBe(true);
  });

  it('un projectile traverse une fosse sans s’y arrêter', () => {
    const state = createDebugRun(1);
    const room = state.floor.rooms[state.floor.currentRoomId];
    if (!room) throw new Error('Salle de debug manquante');
    room.pits = [{ x: 500, y: 200, w: 120, h: 200 }];

    updateCombat(state, intent({ fire: true })); // tir vers la droite depuis (~416, 300)
    for (let i = 0; i < 12; i += 1) {
      updateProjectiles(state, 1000 / 60); // ~140 px parcourus : au-dessus du vide
    }

    expect(state.projectiles).toHaveLength(1);
    const x = state.projectiles[0]?.pos.x ?? 0;
    expect(x).toBeGreaterThan(500);
    expect(x).toBeLessThan(620);
  });

  it('expire un projectile au bout de son TTL', () => {
    const state = createDebugRun(1);
    updateCombat(state, intent({ fire: true }));
    const projectile = state.projectiles[0];
    if (!projectile) throw new Error('Projectile manquant');
    // Immobile au centre : seule l'expiration peut le retirer.
    projectile.vel = { x: 0, y: 0 };

    updateProjectiles(state, projectile.ttlMs + 1);
    expect(state.projectiles).toHaveLength(0);
  });
});
