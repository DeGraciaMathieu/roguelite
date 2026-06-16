---
name: meta
description: Use when modifying meta-progression, hub unlocks, starting loadout, run rewards, or versioned localStorage persistence in the dinocrisis project
auto_invoke: true
---

# Meta-progression & persistence

État **persistant entre les runs**, sérialisé dans `localStorage` sous forme
**versionnée**. Toute lecture passe par `migrateMeta` — jamais confiance au blob brut.

## Modèle (`domain/meta.ts`)

- `MetaState` : `currency` (monnaie persistante), `unlocks: UnlockId[]`,
  `loadout: StartingLoadout` (`weaponId`), `records: MetaRecords`
  (`totalRuns`, `totalKills`, `bestFloor`).
- Enveloppe disque : `PersistedMeta { version, data }`.
- `META_VERSION` (= 1) : **incrémenter à chaque changement de forme** + ajouter
  une branche dans le `switch` de `migrateMeta`.
- Helpers : `defaultMeta(starterWeapon)`, `migrateMeta(raw, starterWeapon)`
  (version inconnue/invalide → défaut, jamais de crash au boot), `serializeMeta`,
  garde de type `isPersistedMeta`.

## Déblocages (hub)

`data/unlocks.ts` → `UNLOCK_DEFS: UnlockDef[]` (`id`, `name`, `description`,
`cost`, `weaponId`). Actuels : Fusil à pompe (150), Fusil (300). Données pures,
interprétées par `systems/meta.ts`.

## Systèmes

- `systems/meta.ts` : `runCurrencyReward(stats, status)` (constantes
  `CURRENCY_PER_KILL`/`PER_FLOOR`/`FLOOR_DEPTH_BONUS`/`EXTRACTION_BONUS_MULTIPLIER`
  dans `data/balance.ts`), `applyRunRewards(meta, stats, status)` (retourne un
  **nouveau** `MetaState`), `purchaseUnlock(meta, def)` (retourne `MetaState | null`
  si fonds insuffisants/déjà acquis).
- `core/metaStorage.ts` : `createMetaStorage(storage, starterWeapon)` — **seul**
  adaptateur qui parle au stockage (lecture migrée, écriture sérialisée).
- Rendu : `render/hub.ts` (DOM, délègue tout aux callbacks de `main.ts`).

## Checklist — faire évoluer la méta

1. **Nouveau déblocage** : ajouter dans `UNLOCK_DEFS` (`data/unlocks.ts`).
   Vérifier que `systems/meta.ts` l'interprète (ex. `weaponId` → loadout).
2. **Nouveau champ dans `MetaState`** : éditer `domain/meta.ts`, **incrémenter
   `META_VERSION`**, ajouter la migration `case` correspondante dans `migrateMeta`,
   mettre à jour `defaultMeta` et `isPersistedMeta` si besoin.
3. **Nouvelle récompense** : constante dans `data/balance.ts` + logique dans
   `runCurrencyReward`/`applyRunRewards`.
4. Tests : `systems/meta.test.ts` (récompenses, achats) et
   `core/metaStorage.test.ts` (migration round-trip, blob invalide → défaut).
