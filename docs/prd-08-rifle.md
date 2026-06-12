# PRD 08 — Fusil (rifle)

**Priorité : 8 — Impact ★ — Effort faible**

## Objectif

Compléter le triptyque d'armes : le type de munitions `rifle` existe dans
tout le code (inventaire, loot, HUD) sans qu'aucune arme ne le consomme.
Le fusil donne un troisième style de jeu : précision et dégâts à distance,
cadence et chargeur faibles.

## Existant technique

- `AmmoType = 'handgun' | 'shotgun' | 'rifle'` traverse déjà tout le
  projet ; `inventory.ammo.rifle` est initialisé à 0 partout.
- La table de loot (`data/floorgen.ts → ammoLoot`) est pondérée : ajouter
  une entrée `rifle` suffit côté génération.
- Le catalogue d'armes et la boutique du hub sont génériques : `WeaponDef`
  gère déjà dégâts/cadence/chargeur/recharge/pellets/spread, et
  `data/unlocks.ts` + `systems/meta.ts` savent vendre et débloquer une
  arme sans code nouveau.

## Comportement

1. **Déf** (`data/weapons.ts`) — proposition d'équilibrage initial :
   dégâts 28 (one-shot un compy, 2 coups un raptor), chargeur 5,
   recharge 1 800 ms, cadence 700 ms, pellets 1, spread 0 (précis).
2. **Déblocage** : second article de la boutique, ~300 crédits (après le
   shotgun dans la progression méta).
3. **Loot** : entrée `ammoLoot` `{ rifle, weight 2, amount 4-8 }` — rare,
   cohérent avec la puissance.
4. **Réserve de départ** : `START_AMMO.rifle` passe de 0 à ~10.
5. **HUD/rendu** : rien à faire (générique) ; couleur de loot `rifle` déjà
   mappée (bleu-gris).

## Hors-scope

- Pénétration des cibles / tir traversant (v2 — serait sa vraie signature).
- Lunette / zoom.
- Port de deux armes et switch en run (changement de design majeur, hors
  sujet ici).

## Impacts par couche

- `data/weapons.ts`, `data/unlocks.ts`, `data/balance.ts`,
  `data/floorgen.ts` : pur ajout de données.
- Aucun système modifié, aucun changement de domaine.

## Critères d'acceptation

- Le rifle s'achète au hub, se sélectionne au loadout, tire/recharge/épuise
  ses munitions comme les autres armes.
- Ses munitions apparaissent en loot et ne sont ramassées que s'il est
  porté (règle de sélectivité existante).
- L'équilibrage tient la promesse : tuer un raptor coûte 2 balles, un
  théropode (PRD 01) ~5.

## Tests

- `meta.test.ts` : déblocage/sélection du rifle (mêmes cas que le shotgun).
- `combat.test.ts` : paramétrer un cas existant sur le rifle (cadence
  longue, chargeur court) — faible coût, ou s'appuyer sur la généricité.

## Risques / questions ouvertes

- Trois armes au hub : vérifier que l'UI loadout reste lisible (elle est
  générique, mais l'équilibre visuel est à contrôler).
- Sans pénétration, le rifle risque d'être un « gros handgun » — assumer
  pour la v1, la pénétration est le candidat v2 évident.
