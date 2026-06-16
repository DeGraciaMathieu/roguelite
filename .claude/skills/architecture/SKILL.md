---
name: architecture
description: Use when adding new code, deciding which layer/file a change belongs to, or reasoning about the domain/systems/render separation in the dinocrisis project
auto_invoke: true
---

# Architecture

Règle d'or : **aucune logique métier dans `render/`.** La simulation tourne
sans rendu (jeu et harnais partagent les mêmes systèmes).

## Carte des couches

| Module | Responsabilité | Importe Pixi/DOM ? |
| --- | --- | --- |
| `domain/` | État pur sérialisable : types, IDs brandés, RNG, entités, items, floor, run, meta. Petites fonctions dérivées. | Non |
| `data/` | Catalogues statiques (`*_DEFS`), constantes d'équilibrage. Données, zéro logique. | Non |
| `systems/` | Font évoluer le domaine (`update*(state, …, dtMs)`). IA, collision, combat, procgen, loot, méta. | Non |
| `harness/` | Joue des runs headless pour l'équilibrage. Lecture seule du gameplay. | Non |
| `input/` | Capture clavier/souris → `PlayerIntent` (intentions, pas effets). | DOM (capture) |
| `core/` | Boucle fixed-timestep, machine à états globale, adaptateur de persistance. | DOM (rAF/storage) |
| `render/` | Adaptateurs Pixi/DOM : lisent le domaine, dessinent. Jamais l'inverse. | Oui |
| `main.ts` | Composition root : câble input → boucle → systèmes → rendu → méta. | Oui |

## Fichiers clés

- `domain/core.ts` — `Brand`, `asId`, `Vec2`, `Rect`, `RngState` (`createRng`,
  `nextFloat`, `nextInt`, `pick`).
- `domain/entities.ts` — `Player`, `Enemy` (union `kind`), `Projectile`,
  `StatusEffect`, `AiState`, `healthState`.
- `domain/items.ts` — `WeaponDef/Instance`, `ConsumableDef`, `RelicDef`,
  `Inventory`, `AmmoType`.
- `domain/floor.ts` — `Floor`, `Room`, `Door`, `EnemySpawn`, `LootSpawn`.
- `domain/run.ts` — `RunState` (l'état complet d'une run), `RunStats`, `RunStatus`.
- `domain/meta.ts` — `MetaState`, `META_VERSION`, `migrateMeta`, `serializeMeta`.
- `systems/step.ts` — `stepRun()` : **ordre canonique** des systèmes par tick.
- `core/loop.ts` — `createGameLoop`, `stepFixed`, `FIXED_DT_MS`, `MAX_FRAME_MS`.
- `core/game.ts` — `PhaseMachine` (`menu`/`hub`/`run`/`gameover`).

## Pipeline d'un tick (`systems/step.ts`)

`movement → doorTransition → stairs → lootPickup → consumables → ai → status →
combat → projectiles`, puis `elapsedMs += dt`. Toute nouvelle étape de
simulation s'insère ici, à la bonne place dans l'ordre, et **nulle part ailleurs**.

## Où placer du nouveau code

| Type de changement | Fichier(s) |
| --- | --- |
| Nouvelle donnée d'équilibrage (constante) | `data/balance.ts` |
| Nouveau type d'ennemi | `domain/entities.ts` + `data/enemies.ts` + `systems/spawn.ts` (cf. skill `enemies`) |
| Nouvelle arme / munition | `domain/items.ts` + `data/weapons.ts` (cf. skill `weapons`) |
| Nouveau consommable | `data/consumables.ts` + `systems/consumables.ts` (cf. skill `consumables`) |
| Nouvelle relique | `domain/items.ts` (effet) + `data/relics.ts` + `systems/relics.ts` |
| Réglage de génération | `data/floorgen.ts` (config) / `systems/floorgen.ts` (logique) |
| Nouvel état du joueur/ennemi | `domain/` puis le `system` qui le fait évoluer |
| Nouvelle étape de simulation | un `systems/<x>.ts` + insertion dans `systems/step.ts` |
| Nouveau visuel | `render/*` uniquement, en lisant le domaine (jamais de mutation) |
| Nouvelle intention joueur | `input/intent.ts` + `input/capture.ts` + le système qui la consomme |
| Déblocage / persistance méta | `data/unlocks.ts` + `systems/meta.ts` + `domain/meta.ts` |

Si un changement te pousse à importer Pixi ou le DOM dans `domain/` ou
`systems/`, c'est le signe que la logique est mal placée : remodélise.
