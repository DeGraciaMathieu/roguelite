---
name: weapons
description: Use when adding or modifying weapons, ammo types, firing/reload, or projectiles/combat in the dinocrisis project
auto_invoke: true
---

# Weapons & combat

`Def` = donnée statique (catalogue) ; `Instance` = arme possédée pendant la run,
avec son état mutable. La logique de tir vit dans `systems/combat.ts`, jamais dans `data/`.

## Munitions

`AmmoType = 'handgun' | 'shotgun' | 'rifle'` (`domain/items.ts`). Réserve de
départ : `START_AMMO` (`data/balance.ts`).

## Armes

`WeaponDef` (`domain/items.ts`) : `ammo`, `damage`, `magazineSize`, `reloadMs`,
`fireRateMs`, `pellets`, `spread`, `projectileSpeed`. Catalogue dans `WEAPON_DEFS:
Record<WeaponDefId, WeaponDef>` (`data/weapons.ts`).

| Arme | ammo | dmg | mag | reload | cadence | pellets | spread | vitesse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Handgun | handgun | 10 | 12 | 1200ms | 250ms | 1 | 0.03 | 700 |
| Shotgun | shotgun | 6 | 6 | 2000ms | 900ms | 6 | 0.35 | 480 |
| Rifle | rifle | 28 | 5 | 1800ms | 700ms | 1 | 0 | 1200 |

La portée n'est pas un champ : elle découle de `projectileSpeed × PROJECTILE_TTL_MS`
(`data/balance.ts`). `WeaponInstance` : `ammoInMag`, `reloadingUntilMs`, `nextShotAtMs`.
Helpers : `getWeaponDef(id)`, `createWeaponInstance(id)` (chargeur plein).

## Combat / projectiles

`systems/combat.ts` :
- `updateCombat(state, intent)` — consomme `intent.fire`/`intent.reload`,
  applique cadence (`nextShotAtMs`), recharge (`reloadingUntilMs`), `spread` et
  `pellets`, émet des `Projectile`. Applique `damageMultiplier(state)` (reliques)
  et `reloadDurationMultiplier(state)`.
- `updateProjectiles(state, dtMs)` — déplace, teste collisions (cercle ennemi /
  mur via `systems/collision.ts`), applique dégâts + `bleedChance`, gère `ttlMs`.

`Projectile` (`domain/entities.ts`) : `damage`, `ammo`, `ownerId`, `ttlMs`.

## Checklist — ajouter une arme

1. `data/weapons.ts` : exporter un `WeaponDefId` (`asId<'WeaponDefId'>('…')`) et
   ajouter l'entrée dans `WEAPON_DEFS`. Commenter l'intention d'équilibrage
   (dégâts vs cadence vs portée vs rareté des munitions).
2. Si nouveau type de munition : étendre `AmmoType` (`domain/items.ts`) — le
   compilateur exigera de compléter `START_AMMO`, `Inventory.ammo`, les tables
   de loot et la télémétrie.
3. Rendre l'arme accessible : loadout de départ (`systems/run.ts` / `domain/meta.ts`)
   et/ou déblocage hub (`data/unlocks.ts`) et/ou loot (`LootSpawn` `weapon`).
4. Tests : `systems/combat.test.ts` (cadence, recharge, dégâts, pellets/spread).
