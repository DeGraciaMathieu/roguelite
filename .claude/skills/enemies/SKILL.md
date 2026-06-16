---
name: enemies
description: Use when adding or modifying enemy kinds, enemy archetypes/stats, or the AI behavior (idle/patrol/chase/attack) in the dinocrisis project
auto_invoke: true
---

# Enemies

Les ennemis sont une **union discriminée** sur `kind`. Les différences de
comportement passent par les **stats de data**, pas par du code spécifique
(seule la meute raptor a une géométrie dédiée).

## Types

`Enemy = Raptor | Compy | Theropode | Boss` (`domain/entities.ts`).

| kind | Rôle | PV | moveSpeed | aggro | dmg | cooldown | bleed | Particularité |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `raptor` | Rapide, chasse en meute, flanque | 30 | 235 | 260 | 15 | 900ms | 0.25 | `packId`, flanc circulaire |
| `compy` | Faible, en essaim, harcèle | 10 | 180 | 200 | 5 | 700ms | 0 | — |
| `theropode` | Mini-boss lent et tanky (étage 3+) | 120 | 120 | 300 | 35 | 1500ms | 0 | 1 max / étage |
| `boss` | Boss majeur, pattern dédié | 400 | 140 | 10000 | 40 | 1200ms | 0 | `pattern`, `phaseIndex` — placeholder, pas spawné |

Stats dans `ENEMY_ARCHETYPES: Record<EnemyKind, EnemyArchetype>` (`data/enemies.ts`).
Meute raptor : `RAPTOR_PACK` (`flankRadius`, `flankAngleStep`).

## IA

`AiState` (`domain/entities.ts`) : `phase` (`idle`/`patrol`/`chase`/`attack`),
`targetId`, `lastKnownTarget`, `attackCooldownMs`, `patrolIndex`.

- Logique : `systems/ai.ts` → `updateAi(state, dtMs)`.
- La patrouille suit `patrolPath` (fixé au spawn) à mi-vitesse ; la chasse à
  `moveSpeed` plein si ligne de vue dégagée (≤ `aggroRadius`).
- L'IA ignore le fog of war / la visibilité de rendu : elle voit via collision
  (ligne de vue géométrique sur les obstacles pleins, pas les fosses).

## Spawn

`systems/spawn.ts` → `spawnRoomContent(state, room)` instancie paresseusement les
`EnemySpawn` de la salle (au premier passage). `allocEntityId(state)` fournit un
`EntityId` déterministe (`nextEntitySeq`). Le mix d'espèces et le théropode sont
décidés à la génération (`systems/floorgen.ts`, config `data/floorgen.ts`).

## Checklist — ajouter un type d'ennemi

1. `domain/entities.ts` : ajouter l'interface (`extends EnemyBase`, champ
   `kind: '<nom>'`) et l'inclure dans l'union `Enemy`. Le compilateur signalera
   tous les `switch` à compléter.
2. `data/enemies.ts` : ajouter l'entrée dans `ENEMY_ARCHETYPES` (le `Record<EnemyKind, …>`
   exige la clé). Renseigner les stats + commenter le pourquoi de l'équilibrage.
3. `systems/ai.ts` : ne toucher que si le comportement diffère des phases
   génériques (sinon les stats suffisent).
4. `systems/spawn.ts` / `data/floorgen.ts` : décider où/quand il apparaît (mix,
   règle dédiée comme le théropode).
5. `render/renderer.ts` : couleur dans `ENEMY_COLOR` + sprite si besoin.
6. Tests : `systems/ai.test.ts` (comportement) et/ou `systems/spawn.test.ts`.
