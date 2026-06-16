---
description: Vérifie le diff courant contre les conventions du projet + tests
---

# /check-conventions

Vérifie que les modifications en cours respectent les conventions du projet.

## Étapes

1. **Charger les conventions** : lis `CLAUDE.md` (racine) pour avoir la liste à
   jour des conventions de code, visuelles et de comportement.
2. **Récupérer les modifications** :
   - `git diff` (non indexé),
   - `git diff --cached` (indexé),
   - `git status --porcelain` (fichiers non suivis).
   Lis le contenu des fichiers non suivis pertinents.
3. **S'arrêter si rien** : s'il n'y a aucune modification, signale-le et arrête.
4. **Vérifier chaque convention**, avec un statut `OK` / `VIOLATION` / `N/A` et,
   pour chaque violation, le `fichier:ligne` + l'extrait concerné. Au minimum :
   - aucune logique métier ni mutation du domaine dans `render/` ;
   - pas de `Math.random` (RNG seedé threadé) ; déterminisme préservé ;
   - pas d'`any`, typage strict respecté ;
   - unions discriminées + `switch` exhaustifs (pas de flags ad hoc) ;
   - IDs brandés créés via `asId` aux frontières seulement ;
   - data sans logique / systèmes en `update*(state, …, dtMs)` / step.ts unique ;
   - pas de singleton ni d'état global caché ;
   - méta : `META_VERSION` incrémenté + migration si la forme change ;
   - palette/visuel conformes si `render/` est touché ;
   - nommage anglais dans le code, commentaires sur le « pourquoi ».
5. **Cohérence tests/doc** : tout nouveau comportement a-t-il un test ? Le
   CLAUDE.md / le skill de référence concerné est-il à jour ?
6. **Lancer les tests** : `npm run test` (et `npm run typecheck` si du typage a
   changé). Rapporte le résultat réel.

## Rapport (final, concis)

- Tableau `convention → statut → preuve (fichier:ligne)`.
- Liste des violations avec correctif suggéré.
- Résultat des tests/typecheck.
- **Verdict global** : conforme / à corriger (une phrase).
