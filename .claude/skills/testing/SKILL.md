---
name: testing
description: Use when adding or running tests, deciding what to test, or verifying determinism/collision/balance in the dinocrisis project
auto_invoke: true
---

# Testing

Commande : **`npm run test`** (= `vitest run`). Typage : `npm run typecheck`.
Les tests vivent à côté du code (`*.test.ts`), environnement `node` (pas de DOM).

## Philosophie

- **Tests macro sur le comportement, pas l'implémentation.** On exerce les
  fonctions exportées (`generateFloor`, `stepRun`, `updateCombat`, `migrateMeta`…)
  et on assert sur l'état résultant, pas sur des détails internes.
- Le `domain/` et la procgen se testent **sans rendu** : c'est volontaire et non
  négociable. Aucun test ne doit dépendre de Pixi ni du DOM.
- Priorités imposées par le projet : **déterminisme de la génération** (même seed
  → même étage, à l'octet près) et **résolution de collisions**.
- Pour le déterminisme : boucler sur plusieurs seeds (`[1, 42, 1337, 0xdeadbeef]`,
  ou 25 seeds pour les tests statistiques de mix/densité).

## Périmètre des fichiers de test

| Fichier | Couvre |
| --- | --- |
| `core/loop.test.ts` | Pas fixe + accumulateur (`stepFixed`, spirale de la mort) |
| `core/game.test.ts` | Transitions de la machine à états |
| `core/metaStorage.test.ts` | Lecture/écriture méta, migration au boot |
| `systems/floorgen.test.ts` | Déterminisme, connexité du graphe, densité/mix |
| `systems/collision.test.ts` | `pointInRect`, `circleIntersectsRect`, `moveCircle`, segments |
| `systems/ai.test.ts` | Phases idle/patrol/chase/attack, perte de vue |
| `systems/combat.test.ts` | Tir, cadence, recharge, dégâts, projectiles |
| `systems/movement.test.ts` | Déplacement, dash, blocage par murs |
| `systems/consumables.test.ts` | Soin, cure, recharge munitions |
| `systems/loot.test.ts` | Ramassage, capacité d'inventaire |
| `systems/relics.test.ts` | Multiplicateurs dérivés des effets |
| `systems/meta.test.ts` | Récompenses de run, achat de déblocage |
| `systems/run.test.ts` | Création de run, loadout |
| `systems/spawn.test.ts` | Instanciation paresseuse du contenu de salle |
| `systems/stairs.test.ts` | Extraction, descente d'étage |
| `systems/status.test.ts` | Saignement, stun |
| `systems/doors.test.ts` | Transition de salle, fog of war, portes verrouillées |
| `systems/step.test.ts` | Tick complet (intégration des systèmes) |
| `render/*.test.ts` | Modèles purs de rendu (`minimap`, `visibility`, `effects`) — pas de Pixi |
| `harness/*.test.ts` | Pilote, politiques, campagne, télémétrie, rapport déterministes |

## Où placer un nouveau test

- Même dossier que le code testé, suffixe `.test.ts`, à côté du `.ts`.
- Importer les **fonctions exportées** (souvent via l'alias `@/…` pour les data).
- Une nouvelle mécanique de gameplay → un test dans le `systems/<x>.test.ts`
  correspondant ; une intégration multi-systèmes → `systems/step.test.ts`.
- Toujours ajouter un cas de **déterminisme** quand de l'aléa seedé est en jeu.
