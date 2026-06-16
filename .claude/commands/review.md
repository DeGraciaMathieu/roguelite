---
description: Revue complète du diff — conventions, tests, maintenabilité, cohérence système
---

# /review

Revue complète des modifications en cours. Enchaîne les axes ci-dessous, chacun
avec son constat, puis un verdict global.

## Étapes

1. **Récupérer les modifications** : `git diff`, `git diff --cached`,
   `git status --porcelain` (+ lire les fichiers non suivis). S'arrêter si rien.

2. **Conventions** (cf. CLAUDE.md, comme `/check-conventions`) : statut
   `OK`/`VIOLATION`/`N/A` par convention, avec `fichier:ligne`. Points durs :
   rien dans `render/`, pas de `Math.random`, pas d'`any`, unions discriminées,
   IDs brandés, data sans logique, `step.ts` unique, méta versionnée.

3. **Tests** (comme `/check-tests`) : chaque comportement introduit/modifié
   est-il couvert par un test macro ? Lister les manques. Le déterminisme
   seedé est-il testé ?

4. **Maintenabilité** :
   - couplage / dépendances circulaires entre couches (le domaine ne dépend de rien) ;
   - responsabilité unique par fonction/module ;
   - duplication (notamment : ne pas dupliquer le pipeline de `systems/step.ts`) ;
   - complexité : fonctions > 40 lignes ou > 3 niveaux d'indentation à signaler ;
   - nommage clair (anglais), commentaires sur le « pourquoi » ;
   - magic values : extraire vers `data/balance.ts` ou une constante nommée.

5. **Cohérence système** :
   - intégration avec l'existant (réutilise les helpers/systèmes en place) ;
   - stabilité de la forme de l'état (`RunState`/`MetaState`) ; migration prévue
     si `MetaState` change ;
   - respect des patterns (`update*(state, …, dtMs)`, `*_DEFS`, `Def`/`Instance`,
     spawn paresseux, intentions côté input).

6. **Lancer les tests** : `npm run test` + `npm run typecheck`.

## Rapport (final)

Pour chaque axe : constat + items concrets (`fichier:ligne`). Puis :

- **Verdict** : une phrase (prêt à merger / corrections nécessaires).
- **Actions correctives** : liste ordonnée des changements à faire.
