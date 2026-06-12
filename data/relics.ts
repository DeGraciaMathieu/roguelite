/**
 * Catalogue statique des reliques (modificateurs passifs de run, style Isaac).
 * Données pures ; l'interprétation vit dans systems/relics.ts.
 */

import { asId } from '@/domain';
import type { RelicDef, RelicDefId } from '@/domain';

export const RELIC_DEFS: readonly RelicDef[] = [
  {
    id: asId<'RelicDefId'>('crocs-sertis'),
    name: 'Crocs sertis',
    description: 'Dégâts +25 %.',
    effects: [{ kind: 'damageMult', factor: 1.25 }],
  },
  {
    id: asId<'RelicDefId'>('sang-froid'),
    name: 'Sang froid',
    description: 'PV max +25.',
    effects: [{ kind: 'maxHealthAdd', amount: 25 }],
  },
  {
    id: asId<'RelicDefId'>('mains-lestes'),
    name: 'Mains lestes',
    description: 'Recharge 30 % plus rapide.',
    effects: [{ kind: 'reloadSpeedMult', factor: 0.7 }],
  },
  {
    // Prudent (≤ 1.5) : la rareté des munitions est un pilier de design.
    id: asId<'RelicDefId'>('pillard'),
    name: 'Pillard',
    description: 'Munitions ramassées +50 %.',
    effects: [{ kind: 'ammoDropMult', factor: 1.5 }],
  },
  {
    // Plafond 1.15 : à 253 px/s le joueur reste plus lent que la meute.
    id: asId<'RelicDefId'>('foulee'),
    name: 'Foulée',
    description: 'Vitesse de course +15 %.',
    effects: [{ kind: 'moveSpeedMult', factor: 1.15 }],
  },
  {
    id: asId<'RelicDefId'>('predateur'),
    name: 'Prédateur',
    description: 'Dégâts +15 %, vitesse +5 %.',
    effects: [
      { kind: 'damageMult', factor: 1.15 },
      { kind: 'moveSpeedMult', factor: 1.05 },
    ],
  },
  {
    id: asId<'RelicDefId'>('veteran'),
    name: 'Vétéran',
    description: 'PV max +15, recharge 15 % plus rapide.',
    effects: [
      { kind: 'maxHealthAdd', amount: 15 },
      { kind: 'reloadSpeedMult', factor: 0.85 },
    ],
  },
];

export function getRelicDef(id: RelicDefId): RelicDef {
  const def = RELIC_DEFS.find((candidate) => candidate.id === id);
  if (!def) throw new Error(`RelicDef inconnue : ${id}`);
  return def;
}
