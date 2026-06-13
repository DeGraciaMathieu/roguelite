/**
 * Catalogue statique des armes. Données, pas de logique de jeu.
 */

import { asId } from '@/domain';
import type { WeaponDef, WeaponDefId, WeaponInstance } from '@/domain';

export const HANDGUN_ID: WeaponDefId = asId<'WeaponDefId'>('handgun');
export const SHOTGUN_ID: WeaponDefId = asId<'WeaponDefId'>('shotgun');
export const RIFLE_ID: WeaponDefId = asId<'WeaponDefId'>('rifle');

export const WEAPON_DEFS: Record<WeaponDefId, WeaponDef> = {
  [HANDGUN_ID]: {
    id: HANDGUN_ID,
    name: 'Handgun',
    ammo: 'handgun',
    damage: 10,
    magazineSize: 12,
    reloadMs: 1200,
    fireRateMs: 250,
    pellets: 1,
    spread: 0.03,
    projectileSpeed: 700,
  },
  [SHOTGUN_ID]: {
    id: SHOTGUN_ID,
    name: 'Shotgun',
    ammo: 'shotgun',
    damage: 6,
    magazineSize: 6,
    reloadMs: 2000,
    fireRateMs: 900,
    pellets: 6,
    spread: 0.35,
    // Plombs lents : arme de contact, portée ~720 px (< largeur de salle).
    projectileSpeed: 480,
  },
  /** Précis et fort à distance ; cadence et chargeur faibles en contrepartie.
   * 28 dégâts : one-shot un compy, 2 balles un raptor, 5 un théropode. */
  [RIFLE_ID]: {
    id: RIFLE_ID,
    name: 'Rifle',
    ammo: 'rifle',
    damage: 28,
    magazineSize: 5,
    reloadMs: 1800,
    fireRateMs: 700,
    pellets: 1,
    spread: 0,
    // Balle tendue et rapide : balaie la salle, portée ~1500 px.
    projectileSpeed: 1000,
  },
};

export function getWeaponDef(id: WeaponDefId): WeaponDef {
  const def = WEAPON_DEFS[id];
  if (!def) throw new Error(`WeaponDef inconnue : ${id}`);
  return def;
}

/** Instance neuve d'une arme (chargeur plein, prête à tirer). */
export function createWeaponInstance(id: WeaponDefId): WeaponInstance {
  return {
    defId: id,
    ammoInMag: getWeaponDef(id).magazineSize,
    reloadingUntilMs: null,
    nextShotAtMs: 0,
  };
}
