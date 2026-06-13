# PRD 12 — Retour visuel au ramassage

**Priorité : 12 — Impact ★ — Effort faible**

## Objectif

Confirmer visuellement un ramassage, là où il a lieu, dans le monde. Aujourd'hui
seul le HUD bouge (compteur de munitions, ligne de consommables) : le geste de
récupérer un objet ne « claque » pas et, dans une salle sombre (PRD 05), on
peut ramasser sans s'en rendre compte. Un petit effet au point de ramassage
ferme la boucle d'action — d'autant plus utile que les ressources sont rares
(pilier de design).

Comme tout le feedback du jeu (PRD 04), c'est de l'**état de rendu** : le
renderer le déduit et le dessine, la simulation l'ignore totalement.

## Existant technique

- **Le ramassage est déjà un signal détectable** : `updateLootPickup`
  (`systems/loot.ts`) retire l'objet de `room.lootSpawns` quand il est crédité ;
  un objet hors de portée ou non ramassable, lui, reste dans la liste. Une
  entrée qui disparaît = un vrai ramassage.
- **Le renderer suit déjà la liste de loot** : il reconstruit ses sprites quand
  `room.lootSpawns.length` change (`renderer.ts`, clé `${room.id}:${length}`) —
  mais cette clé dit *qu'*un objet a bougé, pas *lequel* ni *où*.
- **Le pool d'effets existe** (`render/effects.ts`, PRD 04) : `spawnDeathRing`,
  `spawnImpactSparks`, `tickEffects`, capacité fixe, zéro alloc par frame,
  branche de dessin par `EffectKind` dans `renderer.drawEffects`.
- **Garde-fous déjà en place** : `resetFeedback` purge les effets au changement
  d'étage ; les effets de mort/impact sont bornés par `inRoomBounds` ;
  `prevPlayerPos` est resynchronisé au changement de salle. Le pickup devra se
  greffer sur les mêmes gardes (ne pas confondre un changement de salle/étage,
  qui vide la liste de loot d'un coup, avec une rafale de ramassages).
- **Couleurs par type déjà définies** : textures de loot + `COLOR_BY_KIND`
  (minimap) — de quoi teinter l'effet selon l'objet.

## Comportement

1. **Détection par diff** : le renderer mémorise les positions de loot de la
   salle courante d'une frame à l'autre. Une position présente avant, absente
   après (salle inchangée) = ramassage → un effet à ce point. Sur changement de
   salle ou d'étage, on resynchronise sans rien émettre.
2. **Effet v1 — anneau d'absorption** : nouveau `EffectKind 'pickup'`, un anneau
   qui se **contracte** vers le point (l'inverse de l'anneau de mort qui se
   dilate) + 2-3 étincelles courtes — lecture « objet aspiré », sobre. Teinté
   selon le type ramassé (ammo doré, medkit/bandage vert, relique violet, clé
   doré), pour renforcer *ce* qu'on a pris.
3. **Durée** : ~180 ms, calibré « sobre » comme le reste du game feel (survival-
   horror, pas twin-stick).
4. **(Option) Étiquette flottante « +N »** : pour les munitions, un petit label
   qui monte et s'estompe est l'info la plus parlante (quantité ramassée). Mais
   le pool ne dessine que des formes — le texte demande un `Pixi.Text` à part.
   À trancher (voir questions ouvertes) ; la v1 peut s'en passer.

## Hors-scope

- File d'événements de simulation (alternative au diff, partagée avec l'audio
  PRD 02 et le game feel PRD 04) : plus propre, mais on reste sur le diff tant
  que l'audio n'est pas là — bascule v2 cohérente avec le reste.
- Son de ramassage : c'est le PRD 02 (audio), entrée « Ramassage » déjà prévue.
- Animation du HUD (flash du slot crédité) : autre surface, autre PRD si besoin.
- Effet différencié par rareté (relique « brillante » vs munition discrète) :
  v2, après calage du ton de base.

## Impacts par couche

- `render/effects.ts` : `EffectKind 'pickup'` + `spawnPickup(...)` + branche de
  dessin (anneau contractant) ; éventuelle constante de durée.
- `render/renderer.ts` : snapshot des positions de loot par salle, détection des
  disparitions, appel de `spawnPickup` teinté par `spawn.kind` ; greffe sur les
  gardes existantes (salle/étage). Réutilise la couleur par type.
- Domaine, systèmes, data : **aucun changement**.

## Critères d'acceptation

- Ramasser un objet déclenche un effet bref à sa position exacte, teinté selon
  son type.
- Aucun effet parasite au changement de salle ou d'étage (la liste de loot qui
  se renouvelle n'est pas lue comme des ramassages).
- Un objet laissé au sol (hors portée, ou non ramassable comme une munition
  d'arme non portée) ne déclenche rien.
- Aucune allocation par frame en régime de croisière (pool réutilisé).
- Désactivable par le booléen unique du game feel (`EFFECTS_ENABLED`).
- Simulation strictement inchangée à seed égale (tests de systèmes intacts).

## Tests

- `effects.test.ts` : `spawnPickup` active un slot, l'anneau vieillit et expire
  à sa durée, le pool plein saute l'effet — mêmes cas que les effets existants,
  logique de pool pure et testable sans Pixi.
- Le placement/teinte/déclenchement relève du rendu : **revue visuelle** sur
  plusieurs seeds (salle loot, ramassage en rafale, ramassage en salle sombre
  PRD 05 — l'effet doit rester visible sous le voile).

## Risques / questions ouvertes

- **Étiquette « +N » : pool ou texte ?** Le pool ne fait pas de texte. Si le
  « +N » est jugé indispensable (surtout pour les munitions), prévoir un petit
  mécanisme de label monde (`Pixi.Text` éphémère) à côté du pool — sinon s'en
  tenir à l'anneau teinté en v1.
- **Diff et ramassages simultanés** : deux objets pris dans le même tick =
  deux disparitions la même frame → deux effets. Géré naturellement par le diff
  ensembliste (on compare des ensembles de positions, pas un compteur).
- **Sous le voile (PRD 05)** : l'effet est au-dessus du décor ; vérifier qu'il
  passe au bon niveau de couche pour rester lisible quand la salle est
  assombrie, comme les projectiles.