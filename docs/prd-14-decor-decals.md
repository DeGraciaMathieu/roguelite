# PRD-14 — Décor décoratif (decals)

## Intention

Rendre les salles plus vivantes en y répartissant des éléments **purement
visuels** : taches de sang, débris, végétation envahissante, tuyauterie au
plafond, éclairages d'ambiance. Le pack d'assets est déjà livré dans
`assets/decals_pack/` (26 PNG + `decals_manifest.json`).

**Contrainte forte** : ces éléments n'ont **aucune incidence gameplay**. Pas de
collision, pas de blocage de vue, pas d'effet. Ils sont générés de façon
**déterministe** (seed → même décor) et seulement *dessinés* par la couche
`render/`.

## Périmètre

Les 26 décals du manifest, en 5 familles :

| Famille | `kind` | Couche de rendu |
| --- | --- | --- |
| `decals` | bloodStain, bloodTrail, clawMarks, concreteCrack, drainGrate, hazardStripes, oilSpill, scorchMark | sol |
| `debris` | brokenCrate, brokenPallet, bulletCasings, rubble, scatteredPapers, shatteredGlass | sol |
| `overgrowth` | crackWeeds, ivy, moss, roots | sol |
| `overhead` | hangingCable, pipeRun, ventDuct, wallStain | au-dessus |
| `lightSource` | alarmLight, doorGlow, emergencyLamp, neonLight | au-dessus (blend `add`) |

Hors périmètre : animation des décals, décals destructibles, interaction,
édition manuelle dans l'éditeur de map (branche séparée).

## Architecture (respect strict des couches)

### 1. `domain/floor.ts` — la donnée

Nouveau type, ajouté au modèle de salle. Pas une union discriminée : le `kind`
ne change pas la *forme* des données (juste la texture), donc une interface
plate suffit.

```ts
/** Élément purement décoratif d'une salle. Aucune incidence gameplay. */
export interface Decal {
  kind: DecalKind;
  /** Centre, en coordonnées monde. */
  at: Vec2;
  /** Rotation de rendu (radians) — variété visuelle. */
  rotation: number;
  /** Facteur d'échelle appliqué aux dimensions de base — variété visuelle. */
  scale: number;
}
```

`DecalKind` (union de littéraux des 26 noms) vit dans `domain/core.ts` à côté
des autres identifiants de catalogue. `Room` gagne un champ `decals: Decal[]`.

### 2. `data/decals.ts` — le catalogue (données, zéro logique)

Reprend le manifest : dimensions de base, famille, couche, blend.

```ts
export type DecalCategory = 'decals' | 'debris' | 'overgrowth' | 'overhead' | 'lightSource';
export type DecalLayer = 'floor' | 'overhead';

export interface DecalDef {
  category: DecalCategory;
  w: number;
  h: number;
  layer: DecalLayer;        // 'floor' = sous les entités ; 'overhead' = au-dessus
  blend: 'normal' | 'add';  // 'add' pour les lightSource
}

export const DECAL_DEFS: Record<DecalKind, DecalDef> = { /* … manifest … */ };
```

Densités de génération (combien par salle, par famille) ajoutées à
`data/floorgen.ts` dans `FloorGenConfig` :

```ts
decals: {
  floorPerRoom: { min: number; max: number };   // sang/débris/végétation
  overheadPerRoom: { min: number; max: number }; // tuyaux/néons/etc.
};
```

### 3. `systems/floorgen.ts` — la génération (seedée)

```ts
export function generateDecals(rng: RngState, room: Room, config: FloorGenConfig): Decal[]
```

- Placement **déterministe** via un RNG **dérivé indépendant** par salle
  (`deriveDecalSeed`), pour ne **pas** perturber le flux RNG existant
  (ennemis / loot / géométrie) — garantit que les tests floorgen actuels
  passent sans changement.
- Décals `floor` : posés dans les zones libres de la salle (en évitant les
  centres d'obstacles/pits, mais sans contrainte dure — c'est décoratif).
- Décals `overhead` : ancrés le long des murs / près des portes.
- Appelé à la construction de chaque salle ; résultat stocké dans `room.decals`.

### 4. `render/sprites.ts` + `render/renderer.ts` — le dessin

- `loadGameTextures` charge les 26 textures → `textures.decals: Record<DecalKind, Texture>`
  (import glob Vite `import.meta.glob('../assets/decals_pack/decals/**/*.png')`
  pour éviter 26 imports manuels et les fautes de frappe).
- Deux nouvelles couches dans `buildRoom` / `createRenderer` :
  - `decalFloorLayer` — inséré **juste après** `roomLayer`, sous le loot et les
    entités.
  - `decalOverheadLayer` — inséré **sous le voile de fog** (les décals restent
    masqués par le brouillard comme le reste du décor), au-dessus des entités.
- Chaque décal : `Sprite` ancré au centre (`anchor 0.5`), positionné à `at`,
  `rotation`, taille = `DECAL_DEFS[kind].{w,h} * scale`, `blendMode = 'add'`
  pour les `lightSource`.
- Reconstruites en même temps que `roomLayer` (changement de salle).

### 5. Persistance

Aucun impact. Les décals vivent dans le `Floor` en mémoire (perdu à la mort,
permadeath). Pas de changement de `META_VERSION`.

## Critères d'acceptation

- Une seed donnée → décor identique (déterminisme vérifié par test).
- `npm run typecheck` et `npm run test` passent ; les tests floorgen existants
  ne changent pas (RNG décor indépendant).
- Aucun décal ne modifie collision, vue, ni IA (vérifié : les systèmes ne lisent
  jamais `room.decals`).
- Les `lightSource` sont rendus en blend additif ; les `overhead` au-dessus des
  entités ; le reste sous les entités.

## Tests (Vitest)

- `generateDecals` : même seed → mêmes décals (déterminisme).
- `generateDecals` : produit un nombre de décals dans les bornes de config.
- Invariant : ajouter la génération de décals ne change pas les `enemySpawns` /
  `lootSpawns` / géométrie d'un étage à seed fixe (RNG indépendant).
