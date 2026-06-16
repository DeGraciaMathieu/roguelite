---
name: floorgen
description: Use when modifying procedural floor generation, room layout, enemy density/mix, locked doors, or floor tuning in the dinocrisis project
auto_invoke: true
---

# Floor generation

Génération **déterministe** d'un étage (layout par graphe : salles = nœuds,
portes = arêtes). Même seed → même étage, à l'octet près (testé). Aucun
`Math.random` : le RNG d'étage dérive de la seed de run.

## Modèle (`domain/floor.ts`)

- `Floor` : `index` (profondeur 0-based, pilote le scaling), `seed`, `rooms`,
  `doors`, `startRoomId`, `exitRoomId`, `currentRoomId`.
- `Room` : `kind`, `bounds` (`Rect`), `obstacles` (bloquent corps/tirs/vue),
  `pits` (bloquent le sol, laissent passer tirs et vue), `doorIds`,
  `enemySpawns`, `lootSpawns`, flags `spawned`/`cleared`/`discovered`.
- `RoomKind` : `start | combat | loot | rest | boss | exit`.
- `Door` : `roomA`/`roomB`, `at`, `locked`, `keyItemId`, `open`.

## Config vs logique

- **Config (données)** : `data/floorgen.ts` → `DEFAULT_FLOOR_GEN: FloorGenConfig`.
  `roomCount`, `roomSize` (taille unique = murs partagés = portes valides),
  `enemiesPerCombatRoom` + `extraEnemyEveryNFloors` + `maxEnemiesPerCombatRoom`,
  `enemyMixByDepth` (tranches `minFloor` croissantes), `theropode`
  (`minFloor`/`chancePerCombatRoom`/`maxPerFloor`), `ammoLoot` (table pondérée),
  `medkit/bandage/relicLootChance`, `medkitsPerRestRoom`, `pitsPerCombatRoom`,
  `lockedDoor` (`minFloor`/`chance`, au plus une par étage).
- **Logique** : `systems/floorgen.ts` → `generateFloor(...)` (utilise le RNG
  d'étage), `deriveFloorSeed(runSeed, floorIndex)`.

## Invariants garantis (couverts par les tests)

- Le graphe est **connexe** : toutes les salles atteignables depuis `start`.
- Une porte verrouillée ne coupe jamais l'accès à sa clé (repli « aucune porte
  verrouillée » sur les graphes sans pont).
- Spawns posés sur le périmètre/clairance valides, pas dans un obstacle ;
  clairance ~80 px autour du centre de la salle exit.
- Densité et mix d'espèces croissent avec `floor.index` selon la config.

## Checklist — modifier la génération

1. **Réglage de valeurs** : éditer `DEFAULT_FLOOR_GEN` (`data/floorgen.ts`).
   Ne pas mettre de logique ici.
2. **Nouvelle règle de génération** : `systems/floorgen.ts`, en tirant via le
   RNG d'étage threadé (jamais `Math.random`). Commenter le pourquoi.
3. **Nouveau `RoomKind`** : étendre `domain/floor.ts`, gérer son contenu dans la
   génération + `systems/spawn.ts`, couleur minimap dans `render/minimap.ts`.
4. Tests **obligatoires** dans `systems/floorgen.test.ts` : déterminisme
   multi-seeds, connexité, et toute nouvelle invariante (densité/mix statistiques
   sur ~25 seeds).
