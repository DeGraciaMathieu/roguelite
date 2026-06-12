/**
 * Clés d'objectif. Données, pas de logique : la pose et l'usage vivent dans
 * la génération (floorgen) et les portes (doors).
 */

import { asId } from '@/domain';
import type { ItemDefId } from '@/domain';

/** Clé d'étage : ouvre l'unique porte verrouillée de l'étage où elle est posée. */
export const FLOOR_KEY_ID: ItemDefId = asId<'ItemDefId'>('floor-key');
