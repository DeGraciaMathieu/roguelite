/**
 * Catalogue du décor décoratif. Données, pas de logique.
 * Repris de assets/decals_pack/decals_manifest.json : dimensions de base,
 * famille, couche de rendu et mode de fondu. Les `Def` sont des données ; les
 * instances (Decal) vivent dans la run.
 */

import type { DecalKind } from '@/domain';

export type DecalCategory = 'decals' | 'debris' | 'overgrowth' | 'overhead' | 'lightSource';

/** 'floor' = dessiné sous les entités ; 'overhead' = au-dessus (tuyaux, néons). */
export type DecalLayer = 'floor' | 'overhead';

export interface DecalDef {
  category: DecalCategory;
  /** Dimensions de base, en coordonnées monde (avant facteur d'échelle). */
  w: number;
  h: number;
  layer: DecalLayer;
  /** 'add' pour les sources lumineuses (halo additif), 'normal' sinon. */
  blend: 'normal' | 'add';
}

export const DECAL_DEFS: Record<DecalKind, DecalDef> = {
  // Décalques de sol
  bloodStain: { category: 'decals', w: 48, h: 40, layer: 'floor', blend: 'normal' },
  bloodTrail: { category: 'decals', w: 80, h: 24, layer: 'floor', blend: 'normal' },
  clawMarks: { category: 'decals', w: 40, h: 40, layer: 'floor', blend: 'normal' },
  concreteCrack: { category: 'decals', w: 64, h: 16, layer: 'floor', blend: 'normal' },
  drainGrate: { category: 'decals', w: 32, h: 32, layer: 'floor', blend: 'normal' },
  hazardStripes: { category: 'decals', w: 96, h: 24, layer: 'floor', blend: 'normal' },
  oilSpill: { category: 'decals', w: 56, h: 48, layer: 'floor', blend: 'normal' },
  scorchMark: { category: 'decals', w: 44, h: 44, layer: 'floor', blend: 'normal' },
  // Débris au sol
  brokenCrate: { category: 'debris', w: 44, h: 44, layer: 'floor', blend: 'normal' },
  brokenPallet: { category: 'debris', w: 60, h: 40, layer: 'floor', blend: 'normal' },
  bulletCasings: { category: 'debris', w: 28, h: 28, layer: 'floor', blend: 'normal' },
  rubble: { category: 'debris', w: 52, h: 40, layer: 'floor', blend: 'normal' },
  scatteredPapers: { category: 'debris', w: 40, h: 32, layer: 'floor', blend: 'normal' },
  shatteredGlass: { category: 'debris', w: 36, h: 36, layer: 'floor', blend: 'normal' },
  // Végétation envahissante
  crackWeeds: { category: 'overgrowth', w: 36, h: 28, layer: 'floor', blend: 'normal' },
  ivy: { category: 'overgrowth', w: 32, h: 80, layer: 'floor', blend: 'normal' },
  moss: { category: 'overgrowth', w: 40, h: 40, layer: 'floor', blend: 'normal' },
  roots: { category: 'overgrowth', w: 64, h: 56, layer: 'floor', blend: 'normal' },
  // Suspendus / muraux
  hangingCable: { category: 'overhead', w: 16, h: 72, layer: 'overhead', blend: 'normal' },
  pipeRun: { category: 'overhead', w: 120, h: 20, layer: 'overhead', blend: 'normal' },
  ventDuct: { category: 'overhead', w: 64, h: 40, layer: 'overhead', blend: 'normal' },
  wallStain: { category: 'overhead', w: 48, h: 64, layer: 'overhead', blend: 'normal' },
  // Éclairages d'ambiance (fondu additif)
  alarmLight: { category: 'lightSource', w: 24, h: 24, layer: 'overhead', blend: 'add' },
  doorGlow: { category: 'lightSource', w: 48, h: 24, layer: 'overhead', blend: 'add' },
  emergencyLamp: { category: 'lightSource', w: 20, h: 28, layer: 'overhead', blend: 'add' },
  neonLight: { category: 'lightSource', w: 72, h: 12, layer: 'overhead', blend: 'add' },
};

/** Noms regroupés par couche, pour la génération (placement sol vs mural). */
export const FLOOR_DECAL_KINDS: readonly DecalKind[] = (Object.keys(DECAL_DEFS) as DecalKind[]).filter(
  (kind) => DECAL_DEFS[kind].layer === 'floor',
);
export const OVERHEAD_DECAL_KINDS: readonly DecalKind[] = (Object.keys(DECAL_DEFS) as DecalKind[]).filter(
  (kind) => DECAL_DEFS[kind].layer === 'overhead',
);
