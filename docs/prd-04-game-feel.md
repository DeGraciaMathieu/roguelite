# PRD 04 — Game feel (feedback de combat)

**Priorité : 4 — Impact ★★ — Effort faible**

## Objectif

Le combat fonctionne mais ne « claque » pas : aucun retour visuel à l'impact,
à la morsure, à la mort. Quelques effets purement cosmétiques font paraître
le même gameplay deux fois meilleur.

## Existant technique

- Règle non négociable : le rendu lit l'état, il ne décide de rien. Les
  effets éphémères (flashs, particules) sont du **état de rendu**, pas du
  domaine — ils vivent dans `render/`.
- Problème connu : le renderer ne sait pas *ce qui vient de se passer*,
  seulement l'état courant. Deux options :
  1. **Détection par diff** (PV qui baissent, ennemi disparu…) — simple,
     suffisant pour la v1 ;
  2. **File d'événements de simulation** — plus propre, partagée avec
     l'audio (PRD 02). Si les deux PRD sont faits, prendre l'option 2.

## Comportement (v1, par coût croissant)

1. **Flash d'impact ennemi** : l'ennemi touché blanchit ~80 ms (suivi des
   PV par id côté rendu).
2. **Flash de dégât joueur** : voile rouge bref sur les bords du canvas
   quand `player.health.current` baisse.
3. **Étincelle d'impact** : 3-4 particules au point de disparition d'un
   projectile (mur ou ennemi), durée < 200 ms.
4. **Mort d'ennemi** : cercle qui se dilate/s'estompe ~150 ms à la position
   du défunt.
5. **Recul de tir** : micro-secousse de caméra (1-2 px, 1 frame) au tir —
   plus marquée au shotgun.
6. **Traînée de dash** : 2-3 fantômes du cercle joueur qui s'estompent.

## Hors-scope

- Toute mutation du domaine ou des systèmes pour le feedback (interdit) :
  si l'option « file d'événements » est retenue, elle est produite par les
  systèmes mais **purement descriptive** et purgée chaque tick.
- Animations squelettiques / sprites (toujours hors-scope v1 global).
- Screen shake configurable / accessibilité (v2).

## Impacts par couche

- `render/effects.ts` (nouveau) : pool d'effets éphémères avec durée de vie,
  dessinés dans une couche dédiée du `world`.
- `render/renderer.ts` : alimentation (diff d'état ou événements) + tick des
  effets avec `alpha`/temps réel.
- Si option événements : `core/events.ts` + production dans `combat.ts`/
  `ai.ts` (champ transitoire, hors sérialisation de référence — à valider).

## Critères d'acceptation

- Aucun test de simulation existant modifié : le domaine et les systèmes
  produisent exactement le même état qu'avant (hors éventuelle file
  d'événements purement additive).
- Les effets n'allouent pas par frame en régime de croisière (pool).
- Tout est désactivable par un booléen unique (debug/perf).

## Tests

- Si file d'événements : tests purs de production/purge.
- Sinon : `render/effects.ts` peut exposer une logique de pool pure
  (tick/expiration) testable sans Pixi.

## Risques / questions ouvertes

- La détection par diff rate les cas « dégât + heal le même tick » —
  négligeable en v1, argument de plus pour la file d'événements en v2.
- Garder les effets sobres : c'est un survival-horror, pas un twin-stick
  arcade — pas de hit-stop, pas de slow motion.
