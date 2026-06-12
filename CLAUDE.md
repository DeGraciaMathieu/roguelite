# CLAUDE.md

Contexte et conventions pour ce projet. Lis ce fichier avant toute tâche et
respecte-le. En cas de doute sur l'architecture, demande avant d'implémenter.

## Le projet

Jeu web **roguelite survival-horror 2D top-down**, inspiré de Dino Crisis.
Le joueur descend dans une installation de recherche infestée de dinosaures.
Chaque run est générée procéduralement, la mort est permanente, une
méta-progression persiste entre les runs.

Pilier de design : la tension vient de la **rareté des ressources** et de
l'incertitude de la génération, pas de la difficulté brute.

## Stack

- TypeScript en mode `strict` (et `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Vite
- Pixi.js pour le rendu uniquement
- Web Audio API pour le son
- `localStorage` pour la persistance méta (sérialisation versionnée)
- Aucun game engine lourd. Boucle de jeu maison.

## Architecture cible

Règle non négociable : **aucune logique métier dans la couche de rendu.**
Pixi ne fait qu'afficher un état ; il ne décide de rien.

Séparation en couches :

- `core/` — boucle de jeu (fixed timestep + interpolation), gestion du temps,
  machine à états global (menu / hub / run / game over).
- `domain/` — état pur, sans dépendance à Pixi ni au DOM : entités, stats,
  inventaire, état de run, état méta. Sérialisable et testable en isolation.
- `systems/` — systèmes explicites qui font évoluer le domaine : mouvement,
  collision, IA, combat, génération de niveau, loot. Chaque système prend
  l'état + un delta et produit le nouvel état (ou le mute de façon contrôlée).
- `render/` — adaptateurs Pixi. Lit le domaine, dessine. Jamais l'inverse.
- `input/` — capture clavier/souris, traduit en intentions (pas en effets).
- `audio/` — wrapper Web Audio.
- `data/` — définitions statiques (archétypes d'ennemis, armes, salles,
  reliques) sous forme de données, pas de code en dur disséminé.

La logique de jeu doit pouvoir tourner **sans rendu** (utile pour les tests
et pour valider le déterminisme de la génération).

## Conventions de code

- Typage strict partout. Pas de `any`. Si un type est galère, on modélise
  mieux, on ne contourne pas.
- Préfère les types de données explicites et les unions discriminées
  (ex. `type Enemy = Raptor | Compy | Theropode`) plutôt que des flags.
- Fonctions pures dès que possible dans `domain/` et `systems/`.
- Pas de singleton planqué ni d'état global implicite. L'état du jeu est
  un objet explicite qu'on passe et qu'on fait évoluer.
- Commente le *pourquoi* quand la logique est non triviale (IA, procgen,
  résolution de collisions), pas le *quoi*.
- Nommage cohérent et en anglais dans le code ; les échanges avec moi en
  français.

## Déterminisme & seed

La génération procédurale doit être **déterministe** : une seed donnée
produit toujours le même étage. Utilise un PRNG seedé (pas `Math.random`
directement), injecté, jamais appelé en global. La seed de la run est
affichée et rejouable.

## Persistance

- État de run : en mémoire, perdu à la mort (c'est le principe).
- État méta : `localStorage`, sérialisation **versionnée** (`{ version, data }`)
  avec une fonction de migration prévue dès le départ. Ne jamais lire un blob
  sans valider sa forme.

## Workflow attendu

Travaille **par incréments testables**. Ne passe pas à l'étape suivante tant
que la précédente n'est pas jouable/vérifiable. Ordre imposé :

1. Boucle de jeu (fixed timestep) + déplacement + rendu d'une salle statique.
2. Collisions + tir + une salle jouable de bout en bout.
3. Génération procédurale d'un étage multi-salles (layout par graphe).
4. IA ennemis (états idle/patrol/chase/attack) + combat complet.
5. Enchaînement d'étages + permadeath + écran de game over.
6. Hub + méta-progression + persistance.

**Avant de coder une nouvelle étape**, montre-moi :
- la structure de fichiers concernée,
- le modèle de données (les types) que tu vas introduire.

J'valide, ensuite tu implémentes. Ne lance pas la procgen (étape 3) tant que
la boucle et le combat d'une salle ne sont pas solides.

## Tests

- Le `domain/` et la procgen doivent être testables sans rendu.
- Au minimum : tests sur le déterminisme de la génération (même seed → même
  étage) et sur la résolution de collisions.

## Hors-scope v1 (ne pas implémenter sans accord)

- Multijoueur.
- Sauvegarde de run en cours (la permadeath est volontaire).
- Assets graphiques complexes : on reste sur des formes/placeholders propres
  tant que le gameplay n'est pas bouclé.

## Commandes

- `npm install` — installe les dépendances
- `npm run dev` — serveur de dev Vite
- `npm run build` — build de production
- `npm run test` — tests
- `npm run typecheck` — vérifie le typage strict (à faire passer avant tout commit)
