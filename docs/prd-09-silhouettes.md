# PRD 09 — Silhouettes orientées des unités

**Priorité : 9 — Impact ★ — Effort faible**

## Objectif

Améliorer la lisibilité du combat : aujourd'hui toutes les unités sont des
cercles avec un trait d'orientation. Des silhouettes directionnelles
(formes pointées vers le facing) rendent la lecture instantanée — qui
regarde où, qui charge qui — sans sortir de la règle « formes/placeholders
propres » du CLAUDE.md (pas d'assets).

## Existant technique

- Le rendu connaît tout ce qu'il faut : `player.aim`, `enemy.facing`,
  `radius`, `kind`, `healthState(health)` — purement dérivé, aucun
  changement de domaine ni de systèmes.
- Couleurs par espèce et par état de santé déjà en place ; barre de
  recharge au-dessus du joueur déjà gérée.

## Comportement

1. **Joueur** : disque (couleur santé conservée) + canon court et épais
   côté visée (remplace le trait fin actuel) + liseré de contour sombre.
2. **Raptor** : flèche effilée orientée par `facing` (museau pointu, base
   large, encoche de queue) — la charge se lit avant d'arriver.
3. **Compy** : petit dard étroit, même grammaire en plus frêle.
4. **Théropode** : flèche massive et trapue (préparation PRD 01).
5. **Boss** : idem théropode + crête (placeholder, le boss n'existe pas).
6. **Barre de vie ennemie** : fine barre au-dessus, **visible uniquement si
   blessé** (`current < max`) — lecture sans bruit visuel au repos.
7. Les silhouettes restent inscrites dans le `radius` de collision (le
   visuel ne ment pas sur la hitbox).

## Hors-scope

- Sprites, textures, animations de squelette (hors-scope v1 global).
- Animation de marche/attaque (un léger « pas » oscillant est envisageable
  en v2 via `vel`).

## Impacts par couche

- `render/shapes.ts` (nouveau) : `drawPlayerShape(g, …)`,
  `drawEnemyShape(g, kind, …)` — fonctions de dessin paramétrées
  (position, facing, radius, couleur), réutilisées par le renderer.
- `render/renderer.ts` : remplacement des cercles par ces appels.
- Domaine, systèmes, tests de simulation : **aucun changement**.

## Critères d'acceptation

- À l'arrêt comme en mouvement, l'orientation de chaque unité est lisible
  sans le trait d'orientation actuel (qui disparaît, sauf le canon joueur).
- Les couleurs santé (joueur) et espèce (ennemis) sont conservées.
- La barre de vie ennemie n'apparaît que sur les blessés.
- Aucune régression de performance (formes simples, pas de filtre).

## Tests

- Le projet ne teste pas le rendu : revue visuelle sur plusieurs seeds
  (combat de meute, théropode si PRD 01 livré, salle sombre si PRD 05).

## Risques / questions ouvertes

- Le triangle « pur » peut être moins lisible qu'un cercle pour juger la
  hitbox circulaire — garder une base arrondie (forme goutte plutôt que
  triangle sec) si le ressenti en jeu le demande.
