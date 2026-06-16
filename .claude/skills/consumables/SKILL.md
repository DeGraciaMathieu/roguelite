---
name: consumables
description: Use when adding or modifying consumables (medkits, bandages…) or their effects in the dinocrisis project
auto_invoke: true
---

# Consumables

Catalogue de données pures ; les effets sont **interprétés par
`systems/consumables.ts`**, jamais codés dans `data/`.

## Modèle

`ConsumableEffect` (union discriminée, `domain/items.ts`) :

| kind | Champs | Effet |
| --- | --- | --- |
| `heal` | `amount` | Rend des PV (borné à `health.max`) |
| `cure` | `status: 'bleed'` | Soigne le saignement |
| `ammo` | `ammo`, `amount` | Recharge des munitions du type donné |

`ConsumableDef` : `id` (`ItemDefId`), `name`, `effect`. Catalogue :
`CONSUMABLE_DEFS: Record<ItemDefId, ConsumableDef>` (`data/consumables.ts`).

| Def | id | Effet |
| --- | --- | --- |
| Medikit | `MEDKIT_ID` (`medkit`) | `heal` 50 |
| Bandage | `BANDAGE_ID` (`bandage`) | `cure` bleed |

Helper : `getConsumableDef(id)`. Stockés dans `Inventory.consumables`
(`ItemStack[]`), soumis à `Inventory.capacity` (la rareté est un pilier de design).

## Usage

`systems/consumables.ts` → `updateConsumables(state, intent)` lit l'intention
d'usage, applique l'effet via un `switch` exhaustif sur `effect.kind`
(soin → `Health`, cure → `cureBleed` de `systems/status.ts`, ammo → `Inventory.ammo`).

## Checklist — ajouter un consommable

1. Si l'effet est nouveau : étendre `ConsumableEffect` (`domain/items.ts`). Le
   compilateur signalera le `switch` à compléter dans `systems/consumables.ts`.
2. `data/consumables.ts` : exporter un `ItemDefId` (`asId<'ItemDefId'>('…')`) et
   ajouter l'entrée dans `CONSUMABLE_DEFS`.
3. `systems/consumables.ts` : gérer le nouveau `kind` d'effet si besoin.
4. Distribution : ajouter aux tables de loot (`data/floorgen.ts` + `systems/floorgen.ts`,
   cf. skill `loot`) ou aux salles `rest`.
5. Tests : `systems/consumables.test.ts`. Couvrir aussi la télémétrie si
   l'effet touche munitions/soin (`harness/telemetry.ts`).
