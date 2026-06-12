/**
 * Catalogue statique des consommables. Données, pas de logique :
 * les effets sont interprétés par systems/consumables.ts.
 */

import { asId } from '@/domain';
import type { ConsumableDef, ItemDefId } from '@/domain';

export const MEDKIT_ID: ItemDefId = asId<'ItemDefId'>('medkit');

export const CONSUMABLE_DEFS: Record<ItemDefId, ConsumableDef> = {
  [MEDKIT_ID]: {
    id: MEDKIT_ID,
    name: 'Medikit',
    effect: { kind: 'heal', amount: 50 },
  },
};

export function getConsumableDef(id: ItemDefId): ConsumableDef {
  const def = CONSUMABLE_DEFS[id];
  if (!def) throw new Error(`ConsumableDef inconnue : ${id}`);
  return def;
}
