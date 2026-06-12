# PRD 03 — Reliques

**Priorité : 3 — Impact ★★★ — Effort moyen+**

## Objectif

Rendre deux runs différentes. Les reliques (modificateurs passifs à la
Isaac) sont le cœur « build » d'un roguelite ; sans elles, chaque run au
handgun se joue pareil.

## Existant technique — tout est déjà modélisé, rien n'est interprété

- `RelicEffect` (domaine) : `damageMult`, `moveSpeedMult`, `maxHealthAdd`,
  `reloadSpeedMult`, `ammoDropMult` — « modélisés en données ; ce sont les
  systèmes qui les interprètent » (commentaire du domaine).
- `RelicDef` (id branded `RelicDefId`, nom, description, effets multiples),
  `Relic` (instance de run), `RunState.relics: Relic[]`.
- `LootSpawn` a un kind `'relic'` que la génération ne pose jamais et que
  le ramassage ignore explicitement (`systems/loot.ts`).

## Comportement

1. **Catalogue** : `data/relics.ts`, 6-8 défs v1, une par effet + 2 combos
   (ex. « Crocs sertis » : damageMult 1.25 ; « Sang froid » : maxHealthAdd
   +25 ; « Mains lestes » : reloadSpeedMult 0.7 ; « Pillard » :
   ammoDropMult 1.5 ; « Foulée » : moveSpeedMult 1.15…).
2. **Acquisition** : 1 relique par étage maximum, posée dans la salle
   `loot` avec une chance configurée (tirage RNG seedé, déterministe),
   ramassée au contact (pas de limite de port : les reliques ne comptent
   pas dans `capacity`).
3. **Interprétation** : un module pur `systems/relics.ts` expose des
   agrégateurs (`damageMultiplier(state)`, `moveSpeed(state)`, …) que les
   systèmes existants consomment :
   - `combat.ts` : dégâts des projectiles, durée de recharge ;
   - `movement.ts` : vitesse de course (le dash reste fixe, à trancher) ;
   - `loot.ts`/`floorgen.ts` : montants de munitions (ammoDropMult) ;
   - `maxHealthAdd` : appliqué à l'acquisition (heal du delta).
4. **Visibilité** : ligne HUD (icônes/initiales) + au sol, losange violet.

## Hors-scope

- Reliques maudites / à malus (v2).
- Synergies scriptées entre reliques (v2 — les multiplicateurs se cumulent
  multiplicativement, c'est tout).
- Reliques en récompense de boss (dépend du futur PRD boss).

## Impacts par couche

- `data/relics.ts` (nouveau catalogue), `data/floorgen.ts` (chance de spawn).
- `systems/relics.ts` (nouveau, fonctions pures), retouches ciblées dans
  `combat.ts`, `movement.ts`, `loot.ts`, `floorgen.ts`.
- `render/` : losange au sol + ligne HUD.
- Domaine : **aucun changement** (tout existe).

## Critères d'acceptation

- Même seed → mêmes reliques aux mêmes endroits.
- Les effets se cumulent (2× damageMult 1.25 → ×1.5625).
- `maxHealthAdd` survit à la descente d'étage (l'état de run persiste).
- Une run sans relique se comporte exactement comme aujourd'hui
  (multiplicateurs neutres = 1).

## Tests

- `relics.test.ts` : agrégateurs (vide → neutre, cumul multiplicatif).
- `combat.test.ts` : dégâts et recharge modifiés avec relique en inventaire.
- `loot.test.ts` : ramassage d'une relique → `state.relics`, retirée du sol.
- `floorgen.test.ts` : au plus une relique par étage, déterminisme.

## Risques / questions ouvertes

- Équilibrage : ammoDropMult interagit avec l'économie de rareté (pilier
  design) — commencer prudent (≤ 1.5).
- `moveSpeedMult` vs raptors (260 px/s) : à 1.15 le joueur (253) reste plus
  lent — garder ce plafond pour préserver la pression de la meute.
