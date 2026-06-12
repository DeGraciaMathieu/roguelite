# PRD 07 — Saignement (bleed / cure)

**Priorité : 7 — Impact ★ — Effort faible**

## Objectif

Ajouter une pression temporelle aux blessures : une morsure de raptor peut
faire saigner, et le saignement draine la vie jusqu'à être soigné. C'est le
« poison à la Dino Crisis » explicitement prévu par le domaine.

## Existant technique

- `StatusEffect` (domaine) : `{ kind: 'bleed'; remainingMs; dps }` existe,
  ainsi que `stun` — `Player.status: StatusEffect[]` est toujours vide.
- `ConsumableEffect` a un variant `{ kind: 'cure'; status: 'bleed' }` —
  le système de consommables (`systems/consumables.ts`) n'interprète que
  `heal` aujourd'hui (switch explicite, extension prévue).

## Comportement

1. **Infliction** : une attaque de raptor a ~25 % de chance (RNG de la run,
   déterministe) d'appliquer `bleed` (ex. 8 s à 2 PV/s = 16 PV au total).
   Réapplication = rafraîchit la durée (pas de cumul de dps).
2. **Tic de dégâts** : un système (ou une extension du système existant le
   plus pertinent — à trancher au plan : `systems/status.ts` dédié) fait
   décroître `remainingMs` et applique `dps`. Le saignement **peut tuer**.
3. **Soin** : nouveau consommable « bandage » (`cure: bleed`), généré comme
   les medkits (salles loot/rest), utilisé via la touche H — la file de
   consommables utilise le premier stack *pertinent* : bandage si on
   saigne, sinon medkit (à trancher : touche dédiée vs heuristique).
4. **Feedback** : barre de vie HUD avec liseré/teinte spécifique pendant le
   saignement + gouttes au rendu (lien PRD 04) ; le `healthState` dérivé
   continue de piloter la couleur du joueur.

## Hors-scope

- `stun` (modélisé mais autre sujet — viendra avec le boss).
- Saignement des ennemis (v2 — arme à dégâts sur la durée).
- Résistances / immunités.

## Impacts par couche

- `data/consumables.ts` : déf « bandage ».
- `data/enemies.ts` : chance de bleed par archétype (raptor seulement v1).
- `systems/status.ts` (nouveau, pur) : tick des `StatusEffect`.
- `systems/ai.ts` : application à la morsure (tirage RNG run).
- `systems/consumables.ts` : interprétation de `cure`.
- `render/hud.ts` : indicateur de saignement.

## Critères d'acceptation

- Le saignement draine exactement `dps × durée` (aux arrondis de tick près)
  et s'arrête seul à expiration.
- Le bandage purge `bleed` immédiatement ; un medkit ne le purge pas.
- La mort par saignement déclenche le game over normal.
- Déterminisme : même seed + mêmes inputs → mêmes saignements.

## Tests

- `status.test.ts` : drain, expiration, rafraîchissement sans cumul.
- `consumables.test.ts` : cure purge bleed, n'est pas consommé sans bleed.
- `ai.test.ts` : application sous RNG contrôlé (seed fixée).

## Risques / questions ouvertes

- Heuristique de la touche H avec deux types de consommables : si elle
  devient confuse, passer à une touche dédiée (J ?) ou un cycle de
  sélection — à éprouver en jeu.
- Équilibrage : 16 PV de drain ≈ une morsure supplémentaire ; ne pas
  empiler bleed + meute sans laisser de fenêtre de fuite.
