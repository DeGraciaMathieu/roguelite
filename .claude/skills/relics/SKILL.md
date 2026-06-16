---
name: relics
description: Use when adding or modifying relics (passive run modifiers, Isaac-style) or how their effects are interpreted in the dinocrisis project
auto_invoke: true
---

# Relics

Modificateurs passifs de run (style Isaac). Effets **modélisés en données**,
**interprétés par `systems/relics.ts`** sous forme de multiplicateurs dérivés
(jamais d'effet en dur dans le combat/mouvement).

## Modèle

`RelicEffect` (union discriminée, `domain/items.ts`) :

| kind | Champ | Lu par |
| --- | --- | --- |
| `damageMult` | `factor` | `damageMultiplier(state)` → combat |
| `moveSpeedMult` | `factor` | `moveSpeedMultiplier(state)` → mouvement |
| `maxHealthAdd` | `amount` | `maxHealthBonus(state)` → PV max |
| `reloadSpeedMult` | `factor` | `reloadDurationMultiplier(state)` → recharge |
| `ammoDropMult` | `factor` | `ammoDropMultiplier(state)` → loot munitions |

`RelicDef` : `id` (`RelicDefId`), `name`, `description`, `effects: RelicEffect[]`
(une relique peut cumuler plusieurs effets). Catalogue : `RELIC_DEFS` (tableau,
`data/relics.ts`). Acquise → `Relic { defId }` dans `state.relics`.

## Catalogue actuel

| Relique | Effets | Borne de design |
| --- | --- | --- |
| Crocs sertis | damage ×1.25 | — |
| Sang froid | maxHealth +25 | — |
| Mains lestes | reload ×0.7 | — |
| Pillard | ammoDrop ×1.5 | ≤ 1.5 (rareté munitions) |
| Foulée | moveSpeed ×1.15 | ≤ 1.15 (rester plus lent que la meute) |
| Prédateur | damage ×1.15, moveSpeed ×1.05 | — |
| Vétéran | maxHealth +15, reload ×0.85 | — |

## Interprétation

`systems/relics.ts` : les `*Multiplier(state)` agrègent les effets de toutes les
reliques (produit des `factor`, somme des `amount`). `acquireRelic(state, defId)`
ajoute la relique (et applique `maxHealthAdd` immédiatement au PV max).

## Checklist — ajouter une relique

1. Si l'effet est nouveau : étendre `RelicEffect` (`domain/items.ts`) **et**
   ajouter le `*Multiplier`/`*Bonus` correspondant dans `systems/relics.ts`,
   puis le consommer là où il s'applique (combat, mouvement, loot…).
2. `data/relics.ts` : ajouter l'objet dans `RELIC_DEFS` (`id` via `asId`, `name`,
   `description` joueur, `effects`). Respecter les bornes d'équilibrage (cf. commentaires).
3. La relique entre automatiquement dans le pool de loot `relic` (cf. skill `loot`).
4. Tests : `systems/relics.test.ts` (multiplicateur résultant, cumul).
