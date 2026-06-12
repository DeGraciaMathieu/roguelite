# PRD 05 — Vision limitée

**Priorité : 5 — Impact ★★ — Effort moyen**

## Objectif

En entrant dans une salle, le joueur voit tout : ennemis, loot, sortie.
L'exploration n'a aucune tension. Restreindre la vision transforme chaque
salle en inconnue — et rend symétrique ce que l'IA subit déjà (elle, ne te
voit que par ligne de vue).

## Existant technique

- Le raycast de ligne de vue existe côté IA (`segmentIntersectsRect` dans
  `systems/collision.ts`) : les obstacles coupent la vue, pas les fosses.
- Le rendu a des couches séparées (salle statique / loot / ennemis /
  projectiles / joueur) dans un `Container` monde : on peut masquer
  sélectivement.
- La minimap brouillard de guerre donne déjà la macro-information ; la
  vision limitée joue à l'échelle de la salle.

## Comportement

1. **Voile de salle** : au-delà d'un rayon autour du joueur (~260 px,
   aligné sur l'aggro des raptors), la salle est assombrie (obscurité
   partielle : le décor reste deviné, pas noir total).
2. **Entités cachées** : ennemis et loot ne sont **dessinés** que si
   visibles — distance < rayon ET ligne de vue dégagée (réutilise
   `segmentIntersectsRect` contre les obstacles ; les fosses ne cachent
   pas). L'état de simulation, lui, ne change pas : l'IA continue de
   fonctionner sur les ennemis invisibles.
3. **Direction de visée éclairante (option)** : cône plus clair côté souris
   (lampe), rayon de visibilité étendu (~340 px) dans le cône. À trancher
   au plan — la v1 peut être un simple cercle.
4. **Sons hors champ** (synergie PRD 02) : un ennemi invisible mais audible,
   c'est exactement l'effet recherché.

## Hors-scope

- Champ de vision géométrique exact avec ombres portées en polygones
  (shadowcasting) : coûteux, la v1 fait distance + raycast par entité.
- Modificateur de vision par relique (v2, lien PRD 03).
- Impact sur la détection IA (elle a déjà ses propres règles).

## Impacts par couche

- `render/renderer.ts` : masque d'obscurité (Graphics en overlay du monde,
  trou autour du joueur) + filtrage visuel des entités par visibilité.
- `render/visibility.ts` (nouveau) : `isVisible(from, to, obstacles,
  radius)` — fonction pure, testable, qui réutilise `collision.ts`.
- Domaine et systèmes : **aucun changement**.

## Critères d'acceptation

- La simulation est strictement inchangée (IA, spawns, combats identiques
  à seed égale, tests intacts).
- Un raptor derrière un pilier à 100 px n'est pas dessiné ; il l'est dès
  que la ligne de vue s'ouvre.
- Le loot d'une salle ne se révèle qu'en s'approchant.
- Les projectiles restent visibles (on voit ses balles partir dans le noir).
- Performance : pas de chute de frame rate perceptible (raycasts bornés au
  nombre d'entités de la salle, ~10 max).

## Tests

- `visibility.test.ts` : distance, obstacle coupant, fosse ne coupant pas.

## Risques / questions ouvertes

- Frustration vs tension : rayon trop court = injuste (raptor à 260 px te
  voit ; tu dois le voir aussi quand il te voit). Caler le rayon joueur ≥
  aggro raptor.
- L'indicateur de visée et l'aim souris pointant hors du rayon : OK (on
  vise dans le noir), mais à vérifier en jeu.
