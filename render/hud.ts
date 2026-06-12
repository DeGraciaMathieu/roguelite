/**
 * HUD en jeu (DOM, coin bas-gauche) : barre de vie et munitions de l'arme
 * équipée. Lit le RunState, ne décide de rien. Le DOM n'est touché que quand
 * le contenu change réellement (appelé à chaque frame).
 */

import { healthState } from '@/domain';
import type { HealthState, RunState } from '@/domain';
import { DASH_COOLDOWN_MS } from '@/data/balance';
import { getRelicDef } from '@/data/relics';
import { getWeaponDef } from '@/data/weapons';
import {
  ammoDropMultiplier,
  damageMultiplier,
  maxHealthBonus,
  moveSpeedMultiplier,
  reloadDurationMultiplier,
} from '@/systems/relics';

const COLOR_DEFAULT = '#d8e1e8';
const COLOR_WARNING = '#f0c33c';
const COLOR_EMPTY = '#e5533d';
const COLOR_DASH_READY = '#5d7fa3';
const COLOR_DASH_CHARGING = '#3a3f47';

/** Même code couleur que le cercle du joueur : Fine / Caution / Danger. */
const HEALTH_COLOR: Record<HealthState, string> = {
  fine: COLOR_DEFAULT,
  caution: COLOR_WARNING,
  danger: COLOR_EMPTY,
};

export interface Hud {
  update(state: RunState): void;
  hide(): void;
}

export function createHud(): Hud {
  const root = document.createElement('div');
  root.style.cssText = 'position: fixed; bottom: 12px; left: 12px; display: none;';

  const healthOutline = document.createElement('div');
  healthOutline.style.cssText =
    'width: 180px; height: 10px; border: 1px solid #8a939e; background: #14161a; margin-bottom: 4px;';
  const healthFill = document.createElement('div');
  healthFill.style.cssText = 'height: 100%; width: 100%;';
  healthOutline.appendChild(healthFill);
  root.appendChild(healthOutline);

  // Jauge de dash : se vide au déclenchement, pleine = prêt.
  const dashOutline = document.createElement('div');
  dashOutline.style.cssText =
    'width: 90px; height: 5px; border: 1px solid #4a5158; background: #14161a; margin-bottom: 6px;';
  const dashFill = document.createElement('div');
  dashFill.style.cssText = 'height: 100%; width: 100%;';
  dashOutline.appendChild(dashFill);
  root.appendChild(dashOutline);

  const ammoLabel = document.createElement('div');
  ammoLabel.style.cssText = 'font: 16px monospace; letter-spacing: 1px;';
  root.appendChild(ammoLabel);

  const consumableLabel = document.createElement('div');
  consumableLabel.style.cssText =
    'font: 13px monospace; letter-spacing: 1px; color: #8a939e; margin-top: 2px; display: none;';
  root.appendChild(consumableLabel);

  // Reliques portées, en initiales (CS = Crocs sertis…), même violet qu'au sol.
  const relicLabel = document.createElement('div');
  relicLabel.style.cssText =
    'font: 13px monospace; letter-spacing: 1px; color: #8a5fb0; margin-top: 2px; display: none;';
  root.appendChild(relicLabel);

  // Résultat agrégé des modificateurs (cumul multiplicatif), seulement le non-neutre.
  const modifierLabel = document.createElement('div');
  modifierLabel.style.cssText =
    'font: 12px monospace; letter-spacing: 1px; color: #8a939e; margin-top: 2px; display: none;';
  root.appendChild(modifierLabel);

  document.body.appendChild(root);

  let lastHealthWidth = '';
  let lastHealthColor = '';
  let lastDashWidth = '';
  let lastDashColor = '';
  let lastAmmoText = '';
  let lastAmmoColor = '';
  let lastConsumableText = '';
  let lastRelicText = '';
  let lastModifierText = '';

  /** ×1.5625 → "×1.56" ; ×1.5 → "×1.5". */
  const formatMult = (factor: number): string => `×${Number(factor.toFixed(2))}`;

  const modifierText = (state: RunState): string => {
    const parts: string[] = [];
    const damage = damageMultiplier(state);
    if (damage !== 1) parts.push(`DÉGÂTS ${formatMult(damage)}`);
    const speed = moveSpeedMultiplier(state);
    if (speed !== 1) parts.push(`VITESSE ${formatMult(speed)}`);
    const reload = reloadDurationMultiplier(state);
    if (reload !== 1) parts.push(`RECHARGE ${formatMult(reload)}`);
    const ammo = ammoDropMultiplier(state);
    if (ammo !== 1) parts.push(`MUNITIONS ${formatMult(ammo)}`);
    const health = maxHealthBonus(state);
    if (health !== 0) parts.push(`PV MAX +${health}`);
    return parts.join('  ');
  };

  const hide = (): void => {
    root.style.display = 'none';
  };

  return {
    update(state: RunState): void {
      const health = state.player.health;
      const width = `${Math.round((Math.max(0, health.current) / health.max) * 100)}%`;
      const healthColor = HEALTH_COLOR[healthState(health)];
      if (width !== lastHealthWidth) {
        healthFill.style.width = width;
        lastHealthWidth = width;
      }
      if (healthColor !== lastHealthColor) {
        healthFill.style.background = healthColor;
        lastHealthColor = healthColor;
      }

      const dashRatio = 1 - Math.min(1, state.player.dash.cooldownMs / DASH_COOLDOWN_MS);
      const dashWidth = `${Math.round(dashRatio * 100)}%`;
      const dashColor = dashRatio >= 1 ? COLOR_DASH_READY : COLOR_DASH_CHARGING;
      if (dashWidth !== lastDashWidth) {
        dashFill.style.width = dashWidth;
        lastDashWidth = dashWidth;
      }
      if (dashColor !== lastDashColor) {
        dashFill.style.background = dashColor;
        lastDashColor = dashColor;
      }

      const weapon = state.inventory.weapons[state.inventory.equippedIndex];
      if (weapon) {
        const def = getWeaponDef(weapon.defId);
        const reserve = state.inventory.ammo[def.ammo];
        const reloading = weapon.reloadingUntilMs !== null;
        const text = `[${state.inventory.equippedIndex + 1}] ${def.name.toUpperCase()}  ${weapon.ammoInMag} / ${reserve}${
          reloading ? ' — RECHARGE…' : ''
        }`;
        const color =
          weapon.ammoInMag === 0 && reserve === 0
            ? COLOR_EMPTY
            : reloading || weapon.ammoInMag === 0
              ? COLOR_WARNING
              : COLOR_DEFAULT;
        if (text !== lastAmmoText) {
          ammoLabel.textContent = text;
          lastAmmoText = text;
        }
        if (color !== lastAmmoColor) {
          ammoLabel.style.color = color;
          lastAmmoColor = color;
        }
        ammoLabel.style.display = 'block';
      } else {
        ammoLabel.style.display = 'none';
      }

      const medkits = state.inventory.consumables.reduce((sum, stack) => sum + stack.count, 0);
      const consumableText = medkits > 0 ? `MEDIKIT ×${medkits} (H)` : '';
      if (consumableText !== lastConsumableText) {
        consumableLabel.textContent = consumableText;
        consumableLabel.style.display = consumableText === '' ? 'none' : 'block';
        lastConsumableText = consumableText;
      }

      const relicText =
        state.relics.length > 0
          ? `RELIQUES : ${state.relics
              .map((relic) =>
                getRelicDef(relic.defId)
                  .name.split(' ')
                  .map((word) => word.charAt(0).toUpperCase())
                  .join(''),
              )
              .join(' ')}`
          : '';
      if (relicText !== lastRelicText) {
        relicLabel.textContent = relicText;
        relicLabel.style.display = relicText === '' ? 'none' : 'block';
        lastRelicText = relicText;
      }

      const modifiers = state.relics.length > 0 ? modifierText(state) : '';
      if (modifiers !== lastModifierText) {
        modifierLabel.textContent = modifiers;
        modifierLabel.style.display = modifiers === '' ? 'none' : 'block';
        lastModifierText = modifiers;
      }

      root.style.display = 'block';
    },

    hide,
  };
}
