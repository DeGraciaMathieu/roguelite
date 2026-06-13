# PRD 11 — Échelle des sprites (unités + items)

**Priorité : 11 — Impact ★ — Effort faible**

## Objectif

Agrandir le rendu des unités (joueur + dinosaures) et des items au sol pour
une meilleure présence à l'écran et une lecture plus immédiate du combat. Pur
réglage cosmétique : la taille **visuelle** des sprites est volontairement
découplée de la **hitbox** (`render/sprites.ts` : « on grossit le visuel seul,
le rayon de collision ne change pas »), donc rien de ce PRD ne touche au
gameplay, à la simulation ni au déterminisme.

## Existant technique

- **Unités** : `SPRITE_VISUAL_SCALE = 2.2` (`render/sprites.ts`) est le bouton
  global, partagé par le joueur et tous les dinosaures. Le rendu applique
  `radius × 2 × SPRITE_VISUAL_SCALE` (`render/renderer.ts`), où `radius` est le
  rayon d'archétype (`data/enemies.ts`) ou du joueur (`data/balance.ts`). La
  taille *relative* entre espèces tombe donc gratuitement de leur `radius` — un
  seul curseur fait tout grossir en conservant les proportions.
- **Items / loot** : `LOOT_DRAW_SIZE = 18` (`render/renderer.ts`), taille monde
  fixe pour tous les types (ammo, medkit, bandage, clé, relique) ; les PNG
  source font 32 px.
- **Barres de vie ennemies** : déjà calées sur `radius × SPRITE_VISUAL_SCALE`
  (`renderer.ts` → `drawEnemyHealthBar`) — elles suivent l'échelle d'elles-mêmes.
- **Barre de recharge du joueur** : positionnée sur le `radius` **brut**
  (`renderer.ts`, `barY = y - player.radius - RELOAD_BAR_OFFSET`), pas sur le
  rayon visuel — c'est le point de friction du changement.

## Comportement

1. **Unités plus grandes** : remonter `SPRITE_VISUAL_SCALE` de `2.2` à `2.6`
   (valeur de départ, à affiner à l'œil de ±0.2). Joueur et dinos restent
   **couplés** : on conserve une constante unique, le rapport de taille
   joueur↔dinos est préservé.
2. **Items plus grands** : remonter `LOOT_DRAW_SIZE` de `18` à `22`.
3. **Recaler la barre de recharge joueur** sur le rayon visuel pour qu'elle
   reste au-dessus du sprite agrandi :
   `barY = y - player.radius × SPRITE_VISUAL_SCALE - RELOAD_BAR_OFFSET`.

Tailles obtenues (indicatives, à `SPRITE_VISUAL_SCALE = 2.6`) : joueur ~62 px,
compy ~42 px, raptor ~73 px, théropode ~135 px, boss ~187 px ; items ~22 px.

## Hors-scope

- **Découpler joueur et dinos** (`PLAYER_VISUAL_SCALE` / `ENEMY_VISUAL_SCALE`) :
  inutile pour un agrandissement uniforme. À ne faire que si l'on veut changer
  le *rapport* de taille (ex. joueur plus petit face aux menaces, choix
  d'ambiance) — découplage simple, candidat v2.
- **Portes** (`DOOR_DRAW_WIDTH`) : laissées telles quelles pour l'instant.
- **`LOOT_PICKUP_RADIUS`** (`data/balance.ts`, gameplay) : ne bouge pas. Un item
  rendu plus gros se ramasse toujours au même rayon — léger décalage
  visuel/hitbox assumé (voir risques).
- Toute modification des `radius` d'archétype (`data/enemies.ts`) : ce serait
  changer la hitbox et donc le gameplay — hors sujet, on passe par le scale.

## Impacts par couche

- `render/sprites.ts` : `SPRITE_VISUAL_SCALE` (valeur).
- `render/renderer.ts` : `LOOT_DRAW_SIZE` (valeur) + recalage de `barY` de la
  barre de recharge.
- Domaine, systèmes, data de gameplay, harnais : **aucun changement**.

## Critères d'acceptation

- Joueur, dinosaures et items sont visiblement plus grands, proportions entre
  espèces conservées.
- La barre de recharge reste au-dessus du sprite joueur, sans le chevaucher.
- Les barres de vie ennemies restent correctement positionnées au-dessus des
  sprites agrandis (vérification de non-régression).
- Hitbox inchangée : collisions, tirs, ramassage et IA se comportent
  exactement comme avant (à seed égale, simulation strictement identique —
  tests de systèmes intacts).

## Tests

- Le projet ne teste pas le rendu : **revue visuelle** sur plusieurs seeds —
  salle de meute (chevauchement des sprites lisible ?), théropode/boss
  (sprites les plus grands, pas de débordement gênant), salle loot (items à la
  bonne échelle), joueur en recharge (barre bien placée).
- Vérifier qu'aucun test de simulation existant n'est impacté (il ne devrait
  pas l'être : aucun fichier hors `render/` n'est touché).

## Risques / questions ouvertes

- **Lisibilité de la salle** : à 800×600, des sprites trop gros saturent vite
  une salle de meute. Garder le scale modéré et trancher à l'œil ; 2.6 est un
  point de départ, pas une cible.
- **Décalage visuel/hitbox du loot** : l'item paraît plus gros que sa zone de
  ramassage réelle (`LOOT_PICKUP_RADIUS` inchangé). Acceptable a priori ; si la
  sensation « je touche l'objet mais il ne se ramasse pas » apparaît, ajuster
  `LOOT_PICKUP_RADIUS` (gameplay) plutôt que la taille visuelle.
- **Sprites les plus grands près des murs/portes** : un boss ou théropode collé
  à un mur déborde visuellement sur celui-ci (le sprite dépasse la hitbox).
  Cosmétique et déjà vrai aujourd'hui à plus petite échelle ; à surveiller s'il
  devient choquant.