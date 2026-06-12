# PRD 06 — Portes verrouillées + clés

**Priorité : 6 — Impact ★★ — Effort moyen**

## Objectif

Structurer l'exploration : une porte fermée + une clé à trouver ailleurs,
c'est le détour forcé classique du survival-horror (et une raison de plus
de traverser des salles de combat qu'on aurait évitées).

## Existant technique — le domaine attend depuis l'étape 0

- `Door.locked: boolean` et `Door.keyItemId: ItemDefId | null` existent ;
  toutes les portes sont générées `locked: false`.
- `systems/doors.ts` ignore déjà les portes verrouillées (`if door.locked
  → continue`) : le blocage fonctionne *aujourd'hui* si on pose le flag.
- `Inventory.keyItems: ItemDefId[]` existe (hors capacité, comme prévu).
- `LootSpawn` a un kind `'key'` jamais généré, ignoré par le ramassage.

## Comportement

1. **Génération** : au plus 1 porte verrouillée par étage (à partir de
   l'étage 1), choisie sur le graphe avec une contrainte forte : la clé est
   posée dans une salle **accessible sans franchir cette porte** (BFS sur
   le graphe privé de l'arête verrouillée). Jamais sur le chemin critique
   start → exit si cela rendrait l'exit inaccessible — par construction la
   contrainte BFS le garantit.
2. **Récompense derrière la porte** : la salle verrouillée a un meilleur
   loot (munitions doublées, medkit garanti, relique si PRD 03) — sinon
   personne ne cherche la clé.
3. **Ramassage** : la clé (kind `'key'`) rejoint `inventory.keyItems` au
   contact, sans limite de capacité.
4. **Ouverture** : au contact d'une porte verrouillée avec la bonne clé :
   `locked = false`, transition normale au contact suivant (ou immédiate —
   à trancher). Sans clé : la porte ne réagit pas (feedback : son « porte
   verrouillée » si PRD 02, teinte rouge de la porte au rendu).
5. **Rendu** : porte verrouillée en rouge sombre ; clé au sol en forme
   distinctive (petit « L » doré) ; minimap : stub spécifique (option).

## Hors-scope

- Plusieurs serrures/clés par étage (v2).
- Clés persistantes entre étages (la clé meurt avec l'étage).
- Portes à code / interrupteurs (v2+).

## Impacts par couche

- `data/items.ts` ou `data/keys.ts` : déf de la clé (ItemDefId).
- `systems/floorgen.ts` : choix de l'arête verrouillée + placement de la
  clé sous contrainte BFS (le BFS existe déjà pour l'exit).
- `systems/loot.ts` : case `'key'` du ramassage.
- `systems/doors.ts` : déverrouillage si clé portée.
- `render/` : couleurs porte/clé.

## Critères d'acceptation

- Tout étage généré reste **entièrement finissable** : exit atteignable
  sans la clé OU clé atteignable sans la porte (invariant testé par BFS
  sur de nombreuses seeds).
- Même seed → même porte verrouillée, même emplacement de clé.
- Sans clé, la porte ne laisse pas passer ; avec, elle s'ouvre et reste
  ouverte.

## Tests

- `floorgen.test.ts` : invariant d'accessibilité (BFS sans l'arête
  verrouillée atteint la clé ; BFS complet après déverrouillage atteint
  tout), au plus 1 porte verrouillée, déterminisme.
- `doors.test.ts` : blocage sans clé, ouverture avec clé.
- `loot.test.ts` : ramassage de clé → `keyItems`.

## Risques / questions ouvertes

- Étages à graphe très linéaire : si la porte verrouillée coupe le seul
  chemin vers l'exit, la contrainte BFS doit faire reculer le choix (ou ne
  pas verrouiller cet étage). Prévoir le repli « pas de porte verrouillée »
  plutôt qu'un étage cassé.
