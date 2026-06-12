/**
 * Catalogue des déblocages permanents achetables au hub. Données pures,
 * interprétées par systems/meta.ts.
 */

import { asId } from '@/domain';
import type { UnlockId, WeaponDefId } from '@/domain';
import { RIFLE_ID, SHOTGUN_ID } from './weapons';

export interface UnlockDef {
  id: UnlockId;
  name: string;
  description: string;
  cost: number;
  /** Arme rendue disponible au loadout de départ. */
  weaponId: WeaponDefId;
}

export const UNLOCK_DEFS: readonly UnlockDef[] = [
  {
    id: asId<'UnlockId'>('unlock-shotgun'),
    name: 'Fusil à pompe',
    description: '6 plombs par tir, recharge lente. Brutal de près.',
    cost: 150,
    weaponId: SHOTGUN_ID,
  },
  {
    id: asId<'UnlockId'>('unlock-rifle'),
    name: 'Fusil',
    description: 'Précis et puissant à distance. Chargeur court, cadence lente.',
    cost: 300,
    weaponId: RIFLE_ID,
  },
];
