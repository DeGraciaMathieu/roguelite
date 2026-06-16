---
name: loot
description: Use when adding or modifying loot spawns, loot tables, item pickup, or inventory capacity in the dinocrisis project
auto_invoke: true
---

# Loot & inventory

Le loot est posé à la génération (`LootSpawn`), instancié paresseusement au
spawn de salle, puis ramassé par proximité.

## Modèle

`LootSpawn` (union discriminée, `domain/floor.ts`) :

| kind | Champs | Devient |
| --- | --- | --- |
| `ammo` | `ammo`, `amount` | munitions dans `Inventory.ammo` (× `ammoDropMultiplier`) |
| `consumable` | `defId` (`ItemDefId`) | `ItemStack` dans `Inventory.consumables` (soumis à `capacity`) |
| `weapon` | `defId` | nouvelle `WeaponInstance` dans `Inventory.weapons` |
| `relic` | `defId` (`RelicDefId`) | `Relic` dans `state.relics` |
| `key` | `defId` (`ItemDefId`) | `Inventory.keyItems` (hors capacité) |

`Inventory` (`domain/items.ts`) : `ammo`, `weapons`, `equippedIndex`,
`consumables`, `keyItems`, `capacity` (slots de consommables limités = tension).

## Tables de loot

Définies dans la config de génération (`data/floorgen.ts`) : `ammoLoot` (table
pondérée par `weight` + `amount.min/max`), `medkitLootChance`, `bandageLootChance`,
`relicLootChance` (≤ 1 relique/étage), `medkitsPerRestRoom`. Tirage déterministe
via le RNG d'étage dans `systems/floorgen.ts`.

## Ramassage

`systems/loot.ts` :
- `updateLootPickup(state)` — ramasse les `LootSpawn` dans `LOOT_PICKUP_RADIUS`
  (`data/balance.ts`) du joueur, applique l'effet selon `kind`, retire le spawn.
  Respecte `Inventory.capacity` pour les consommables.
- `consumableCount(inventory)` — total courant face à la capacité.

`systems/spawn.ts` → `spawnRoomContent` matérialise les `lootSpawns` au premier
passage. Rendu : couleur par `kind` dans `render/renderer.ts`.

## Checklist — ajouter un type de loot

1. Si nouveau `kind` : étendre `LootSpawn` (`domain/floor.ts`). Le compilateur
   signalera les `switch` (pickup, génération, rendu).
2. `systems/loot.ts` : gérer le ramassage du nouveau `kind`.
3. `data/floorgen.ts` + `systems/floorgen.ts` : décider où il apparaît (table +
   tirage seedé).
4. `render/renderer.ts` : couleur/sprite.
5. Tests : `systems/loot.test.ts` (effet, capacité), + déterminisme dans
   `systems/floorgen.test.ts` si la table change.
