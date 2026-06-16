---
description: Compare features et couverture de tests, propose et écrit les tests manquants
---

# /check-tests

Compare ce que fait le code et ce que les tests couvrent, puis comble les trous
avec des tests **macro** (via les fonctions exportées).

## Étapes

1. **Lire le code** : parcours `domain/`, `systems/`, `core/`, `harness/`,
   `render/` (modèles purs) pour lister les comportements exportés.
2. **Lire les tests** : recense les `*.test.ts` et ce qu'ils exercent (cf. skill
   `testing` pour le périmètre de chaque fichier).
3. **Comparer features ↔ couverture** : dresse la liste des comportements **non
   couverts**, en priorisant les piliers du projet (déterminisme de la procgen,
   collisions, combat, méta/migration).
4. **Lister les tests manquants** et **attendre la validation de l'utilisateur**
   avant d'écrire quoi que ce soit (un test par comportement, décrit en une ligne).
5. **Écrire les tests validés** : tests macro uniquement, via les fonctions
   exportées, dans le `*.test.ts` du dossier concerné, environnement `node`
   (aucune dépendance Pixi/DOM). Ajoute un cas de déterminisme multi-seeds quand
   de l'aléa seedé est en jeu.
6. **Lancer les tests** : `npm run test`. Corrige jusqu'au vert.

## Rapport (final)

- Couverture **avant / après** (comportements couverts / total estimé).
- Tests ajoutés (fichier + intitulé).
- Résultat de `npm run test`.
