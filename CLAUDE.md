# CLAUDE.md

Jeu web **roguelite survival-horror 2D top-down** inspiré de Dino Crisis :
descente dans une installation infestée, runs générées procéduralement,
permadeath, méta-progression persistante. La tension naît de la **rareté des
ressources** et de l'incertitude de la génération, pas de la difficulté brute.

Lis ce fichier avant toute tâche et respecte-le. En cas de doute sur
l'architecture, demande avant d'implémenter.

## Stack

- **Langage** : TypeScript en mode `strict` (+ `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`). Pas de `any`.
- **Build / dev** : Vite (`npm run dev`, `npm run build`).
- **Rendu** : Pixi.js **uniquement pour afficher**, jamais pour décider.
- **Audio** : Web Audio API (dossier `audio/` encore vide).
- **Persistance méta** : `localStorage`, sérialisation versionnée.
- **Runtime** : Node 22+ (cf. `.nvmrc`), modules ESM (`"type": "module"`).
- **Tests** : Vitest. Commande exacte : **`npm run test`** (= `vitest run`).
- **Typage** : `npm run typecheck` (= `tsc --noEmit`) — doit passer avant tout commit.
- Imports via l'alias `@/*` qui pointe sur la racine (ex. `@/domain`, `@/systems/step`).

Le code source vit à la **racine**, pas dans `src/` : `core/`, `domain/`,
`systems/`, `render/`, `input/`, `audio/`, `data/`, `harness/`.

## Conventions de code

Règle non négociable : **aucune logique métier dans la couche de rendu.**
Pixi lit un état et le dessine ; il ne décide de rien.

- **Séparation en couches** (cf. skill `architecture`) :
  - `domain/` — état pur, sérialisable, sans Pixi ni DOM. Types + petites
    fonctions dérivées (`healthState`, `isDead`).
  - `systems/` — font évoluer le domaine. Signature type : `update*(state, …, dtMs)`,
    mutation contrôlée de `state`. `systems/step.ts` est la **source de vérité
    unique** de l'ordre des systèmes (partagée jeu ↔ harnais, ne jamais dupliquer).
  - `data/` — catalogues statiques (`*_DEFS`), aucune logique. Les `Def` sont
    des données ; les `Instance` vivent dans la run.
  - `render/`, `input/`, `audio/`, `core/` — adaptateurs. `input/` traduit en
    **intentions** (`PlayerIntent`), jamais en effets.
  - `main.ts` — seule composition root : le seul endroit où les couches se câblent.
- **Unions discriminées** plutôt que des flags : `type Enemy = Raptor | Compy |
  Theropode | Boss` (discriminant `kind`), `StatusEffect`, `RelicEffect`,
  `LootSpawn`, `ConsumableEffect`. L'exhaustivité est vérifiée par le compilateur.
- **IDs brandés** (`EntityId`, `RoomId`, `WeaponDefId`…) : créés uniquement via
  `asId<…>()` aux frontières (data, génération). Ne pas mélanger les types d'ID.
- **Déterminisme** : jamais `Math.random`. PRNG seedé (`RngState`) threadé
  explicitement dans `state.rng`. EntityId via `nextEntitySeq` monotone, jamais d'UUID.
- **Pas de singleton ni d'état global caché.** L'état est un objet `RunState` /
  `MetaState` qu'on passe et fait évoluer.
- Fonctions pures dès que possible dans `domain/` et `systems/`.
- Commente le **pourquoi** (IA, procgen, collision, équilibrage), pas le quoi.
- Nommage **en anglais** dans le code ; échanges avec moi **en français**.

## Conventions visuelles (couche `render/` uniquement)

Thème survival-horror sombre, rendu top-down, UI en `monospace`. Palette
observée (centralisée par constantes dans `render/renderer.ts`, `render/hud.ts`,
`render/minimap.ts`) :

| Rôle | Couleur |
| --- | --- |
| Fond app / canvas | `0x0a0b0d` |
| Voile fog of war | `0x050608` |
| Texte clair | `#d8e1e8` |
| Texte secondaire | `#8a939e` |
| Doré (munitions, projectile, réticule, crédits, warning) | `0xf0c33c` |
| Rouge (vide, danger, sang, vignette de dégâts) | `0xe5533d` |
| Santé fine / caution / danger | `0xd8e1e8` / `0xf0c33c` / `0xe5533d` |
| Dash prêt / en charge | `#5d7fa3` / `#3a3f47` |
| Ennemis raptor / compy / theropode / boss | `0xc0563e` / `0x9bbf65` / `0x8a5fb0` / `0xb03060` |
| Loot munitions / soin / arme·relique | `0xf0c33c` / `0x6fcf6f` / `0xb060e0` |
| Minimap start / combat / loot / rest | `0x4a5158` / `0x3a3f47` / `0xc9a44a` / `0x7a9e63` |

Le DOM (HUD, hub, overlay) n'est touché **que quand le contenu change** (appelé
chaque frame, mais diff avant écriture).

## Comportement

- **Ne jamais déclarer une tâche terminée sans avoir lancé `npm run test`** (et
  `npm run typecheck` si du typage a changé). Rapporte le résultat réel.
- N'implémente **que** ce qui est demandé : pas de métrique, visualisation ou
  détection en plus sans accord explicite.
- **Après 2 tentatives échouées**, arrête-toi, prends du recul et repense le
  plan avant de réessayer.
- Avant de coder une nouvelle étape du workflow imposé, montre la structure de
  fichiers et les types introduits, puis attends validation.
- Explore le minimum : si tu as assez de contexte, code ; sinon, explore par incréments.
- Après édition, nettoie le superflu (imports/constantes/CSS inutilisés, lignes vides).

## Déterminisme & seed

Génération **déterministe** : une seed → toujours le même étage. PRNG seedé
injecté (`RngState`), jamais global. La seed de run est affichée et rejouable
(`?seed=123`). Les seeds d'étage dérivent de la seed de run (`deriveFloorSeed`).

## Persistance

- **État de run** : en mémoire, perdu à la mort (permadeath volontaire).
- **État méta** : `localStorage`, enveloppe versionnée `{ version, data }`.
  Toute lecture passe par `migrateMeta` (jamais confiance au blob brut).
  Incrémenter `META_VERSION` + ajouter une migration à chaque changement de forme.

## Workflow incrémental imposé

Travaille par incréments testables. Ordre : (1) boucle + déplacement + salle
statique, (2) collisions + tir + salle jouable, (3) procgen multi-salles,
(4) IA + combat, (5) enchaînement d'étages + permadeath + game over,
(6) hub + méta + persistance. Ne passe pas à l'étape suivante tant que la
précédente n'est pas jouable/vérifiable.

## Skills disponibles

Référence (auto-invoqués) :

- `architecture` — carte des fichiers, responsabilité de chaque module, où placer du nouveau code.
- `testing` — commande de test, philosophie, périmètre des fichiers de test.
- `enemies` — archétypes d'ennemis, IA (idle/patrol/chase/attack), spawn.
- `weapons` — armes, munitions, combat, projectiles.
- `consumables` — consommables et leurs effets.
- `relics` — reliques (modificateurs passifs de run) et leur interprétation.
- `floorgen` — génération procédurale d'étage (layout par graphe).
- `loot` — tables et spawns de loot, ramassage, inventaire.
- `meta` — méta-progression, déblocages au hub, persistance versionnée.
- `harness` — harnais d'équilibrage headless (agents scriptés, télémétrie).

Workflow (déclenchable) :

- `feature` — implémenter une feature de bout en bout (comprendre → implémenter → tester → documenter → résumer).

Commandes (`/`):

- `check-conventions` — vérifie le diff courant contre les conventions + tests.
- `check-tests` — compare features ↔ couverture, propose et écrit les tests manquants.
- `review` — revue complète : conventions + tests + maintenabilité + cohérence système.
