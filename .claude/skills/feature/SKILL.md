---
name: feature
description: "Implement the following feature: $ARGUMENTS"
user_invocable: true
---

# Feature workflow

Implémente une feature de bout en bout dans le projet dinocrisis, en respectant
le CLAUDE.md et les skills de référence. **N'implémente que ce qui est demandé.**

## 1. Comprendre

- Reformule la feature en une phrase pour confirmer la compréhension.
- Invoque le skill `architecture` pour cibler la/les couche(s) et fichier(s).
- Pose des questions de clarification **avant de coder** si quoi que ce soit est
  ambigu : valeurs numériques (dégâts, coûts, probabilités), interactions avec
  l'existant, cas limites, impact sur le déterminisme ou la forme de l'état méta.
- Si la feature relève d'une étape du workflow incrémental imposé, montre la
  structure de fichiers + les types introduits et attends validation.

## 2. Implémenter

- Invoque les skills de référence pertinents (`enemies`, `weapons`,
  `consumables`, `relics`, `floorgen`, `loot`, `meta`, `harness`).
- Modifie **uniquement** les fichiers nécessaires.
- Respecte les conventions : pas de logique dans `render/`, pas de `Math.random`
  (RNG seedé threadé), unions discriminées, IDs brandés via `asId`, pas d'`any`,
  pas d'état global. Insère toute nouvelle étape de simulation dans `systems/step.ts`.

## 3. Tester

- Ajoute des **tests macro** sur le comportement (fonctions exportées), dans le
  `*.test.ts` du dossier concerné (cf. skill `testing`). Couvre le déterminisme
  si de l'aléa seedé est en jeu.
- Lance `npm run test` (et `npm run typecheck` si le typage a changé).
- Corrige jusqu'au vert. Après 2 échecs, prends du recul et repense le plan.

## 4. Documenter

- Si le périmètre change : mets à jour le CLAUDE.md, le skill de référence
  concerné (tables/checklists), ou la doc in-app (descriptions joueur).

## 5. Résumer

Rends un résumé concis : fichiers modifiés, tests ajoutés, **résultat réel** des
tests (`npm run test` / `npm run typecheck`).
