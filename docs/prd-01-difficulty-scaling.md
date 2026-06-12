# PRD 01 — Scaling de difficulté + théropode

**Priorité : 1 — Impact ★★★ — Effort moyen**

## Objectif

Donner un sens à la profondeur : descendre doit faire peur. Aujourd'hui
l'étage 5 est statistiquement identique à l'étage 1, ce qui vide de sa
substance le choix extraction / descente (cœur du risk/reward du jeu).

## Existant technique

- `Floor.index` (0-based) est généré et transporté partout… et n'influence
  rien. Le commentaire du domaine dit pourtant « sert au scaling de
  difficulté ».
- `Theropode` existe dans l'union `Enemy` (domaine) avec des stats
  placeholder dans `data/enemies.ts` (120 PV, lent, 35 dégâts) — jamais
  spawné : `floorgen.ts` ne tire que `raptor | compy`.
- La génération est déjà paramétrée par `FloorGenConfig` et entièrement
  déterministe (seed d'étage dérivée de la seed de run).

## Comportement

1. **Densité croissante** : le nombre d'ennemis par salle de combat augmente
   avec `Floor.index` (ex. `min/max + floor(index / 2)`, plafonné).
2. **Mix d'espèces par profondeur** : table pondérée par tranche d'étages —
   étages 0-1 : compys majoritaires ; 2-3 : raptors majoritaires ;
   4+ : théropode possible.
3. **Théropode mini-boss** : à partir de l'étage 3, chance qu'une salle
   combat contienne un théropode (1 max par étage). Lent mais tanky : il
   force le kite autour des obstacles et la gestion de munitions.
4. **Récompenses alignées** : `CURRENCY_PER_FLOOR` peut devenir progressif
   (l'étage 5 rapporte plus que l'étage 1) pour récompenser le risque.

## Hors-scope

- Boss d'étage (`Boss`, patterns `charge/sweep/roar-summon`) : PRD séparé
  à venir, dépend de celui-ci.
- Scaling des stats individuelles des ennemis (PV/dégâts par étage) : on
  scale le *nombre* et le *mix*, pas les archétypes — plus lisible.

## Impacts par couche

- `data/floorgen.ts` : table de mix par profondeur (données, pas de code).
- `data/enemies.ts` : valider/ajuster les stats du théropode.
- `systems/floorgen.ts` : `generateEnemySpawns` reçoit `Floor.index`.
- `systems/meta.ts` : récompense progressive (si retenue).
- IA : `theropode` utilise la machine à états existante telle quelle
  (différenciation par stats uniquement) — zéro code IA nouveau.
- Rendu : déjà prêt (couleur violette + rayon 26 mappés).

## Critères d'acceptation

- Même seed → même étage, y compris le mix d'ennemis (déterminisme intact).
- Étage 0 : aucun théropode possible ; étage 4 : théropode possible.
- La densité moyenne d'ennemis croît strictement entre l'étage 0 et l'étage 4.
- Un théropode se tue au handgun (sans relique) en < 1 chargeur + 1 recharge
  de marge — vérifier l'équilibrage en jeu.

## Tests

- `floorgen.test.ts` : mix par tranche (générer N étages par profondeur,
  vérifier les espèces présentes/absentes), densité croissante, déterminisme.
- `spawn.test.ts` : théropode matérialisé avec ses stats d'archétype.

## Risques / questions ouvertes

- Plafond de densité vs taille de salle fixe (800×600) : au-delà de ~8
  ennemis, illisible. Plafonner.
- Le théropode bloqué par les fosses peut devenir trivial à kiter : à
  équilibrer (portée d'attaque ? vitesse ?) après tests en jeu.
