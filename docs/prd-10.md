# PRD 10 — Vitesse de projectile par arme

**Priorité : 10 — Impact ★ — Effort faible**

## Objectif

Donner à chaque arme une signature balistique. Aujourd'hui tous les
projectiles filent à la même vitesse (`PROJECTILE_SPEED = 700`), si bien que
le rifle — censé être l'arme « précise et forte **à distance** » (PRD 08) — ne
se distingue que par ses dégâts. Une balle de rifle tendue et rapide, des
plombs de shotgun lents et de courte portée : c'est le genre de différence qui
se *sent* manette en main et qui renforce le choix d'arme.

Effet de bord recherché, gratuit : à `PROJECTILE_TTL_MS` constant, la portée
d'un tir vaut `vitesse × TTL`. Varier la vitesse fait donc varier la portée
sans aucune logique supplémentaire — le shotgun devient une arme de contact,
le rifle balaie la salle.

## Existant technique

- `PROJECTILE_SPEED` (`data/balance.ts`) est une constante unique, lue
  directement dans `spawnProjectiles` (`systems/combat.ts`) pour fabriquer le
  `vel` de chaque projectile.
- `WeaponDef` (`domain/items.ts`) porte déjà `damage`, `magazineSize`,
  `reloadMs`, `fireRateMs`, `pellets`, `spread` — il manque la vitesse.
- `PROJECTILE_TTL_MS` (`data/balance.ts`) reste global : c'est lui qui, croisé
  avec la vitesse, détermine la portée effective.
- La collision des projectiles est **balayée** (`segmentIntersectsCircle` sur
  le segment parcouru au tick, `systems/combat.ts`) : indépendante de la
  vitesse, donc à l'abri du tunneling même à vélocité élevée. Augmenter la
  vitesse du rifle est sûr par construction.
- Le rendu dessine les projectiles à leur position, sans interpolation et sans
  dépendance à la vitesse : aucun changement requis.

## Comportement

1. **Champ de données** : `WeaponDef` gagne `projectileSpeed` (px/s). Les trois
   armes sont paramétrées dans `data/weapons.ts` — proposition d'équilibrage :

   | Arme    | Vitesse (px/s) | Portée @ TTL 1500 ms | Intention |
   |---------|----------------|----------------------|-----------|
   | Handgun | 700 (inchangé) | ~1050 px             | référence, aucune régression |
   | Shotgun | 480            | ~720 px             | plombs lents, arme de contact |
   | Rifle   | 1000           | ~1500 px            | balle tendue, balaie la salle |

2. **Lecture** : `spawnProjectiles` utilise `def.projectileSpeed` au lieu de la
   constante globale. Le reste (dispersion seedée, muzzle offset, TTL) ne bouge
   pas.
3. **Portée émergente** : on garde `PROJECTILE_TTL_MS` global. La portée tombe
   donc de la vitesse, sans champ dédié — un projectile lent disparaît plus
   tôt dans l'espace. (La salle fait 800×600 : la portée shotgun couvre encore
   un engagement franc, le rifle déborde volontairement.)

## Hors-scope

- TTL / portée par arme explicite (découpler portée et vitesse) : v2 si l'effet
  émergent ne suffit pas à l'équilibrage.
- Vitesse variable par projectile d'un même tir (gerbe de shotgun à vitesses
  inégales) : gadget, hors sujet.
- Chute/accélération, balistique non rectiligne : le projectile reste à vitesse
  constante sur sa trajectoire.
- Trainée de rendu proportionnelle à la vitesse (lien game feel, PRD 04) :
  cosmétique, candidat v2.

## Impacts par couche

- `domain/items.ts` : `projectileSpeed: number` dans `WeaponDef` (donnée pure).
- `data/weapons.ts` : valeur par arme (les trois défs).
- `data/balance.ts` : `PROJECTILE_SPEED` retiré (ou conservé comme défaut
  documentaire si on préfère une transition douce) ; `PROJECTILE_TTL_MS`
  inchangé.
- `systems/combat.ts` : `spawnProjectiles` lit `def.projectileSpeed`.
- Domaine (entités), IA, loot, méta, rendu, harnais : **aucun changement**.

## Critères d'acceptation

- Le handgun conserve exactement sa vitesse et sa portée actuelles (aucune
  régression sur les runs existantes).
- Un tir de rifle parcourt visiblement plus de distance par tick qu'un tir de
  shotgun, et porte plus loin avant expiration.
- Pas de tunneling : un projectile rapide touche un ennemi placé sur sa
  trajectoire aussi sûrement qu'un lent (collision balayée).
- Déterminisme intact : même seed → mêmes `vel` de projectiles (la vitesse est
  une donnée, pas un tirage).

## Tests

- `combat.test.ts` : paramétrer un cas existant sur le rifle et un sur le
  shotgun, vérifier la magnitude de `projectiles[0].vel`
  (`hypot(vel.x, vel.y) === def.projectileSpeed`).
- `combat.test.ts` : à TTL fixe, un projectile lent expire (disparaît) sur une
  distance plus courte qu'un rapide — test de portée émergente sur un tir
  immobilisé dans une salle dégagée.
- Pas de nouveau test de tunneling nécessaire : la collision balayée est déjà
  couverte (`updateProjectiles` + `segmentIntersectsCircle`).

## Risques / questions ouvertes

- **Portée shotgun trop courte ?** À 480 px/s la portée (~720 px) reste sous la
  largeur de salle (800). Si l'arme paraît inutile au-delà du contact, remonter
  la vitesse ou prévoir un TTL dédié (bascule vers le hors-scope v1).
- **Lisibilité du rifle rapide** : à 1000 px/s la balle traverse la salle en
  ~0,6 s ; vérifier qu'elle reste visible (taille de rendu `PROJECTILE_RADIUS`
  déjà fixe, indépendante de la vitesse — a priori OK).
- **Couplage vitesse/portée** : tant que les deux sont liés par le TTL global,
  on ne peut pas faire « rapide mais courte portée » (ni l'inverse). C'est le
  candidat v2 évident si un profil d'arme le réclame.