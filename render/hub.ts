/**
 * Écran de hub entre les runs (DOM, hors canvas). Affiche la méta et délègue
 * toute décision aux callbacks de la composition root : aucune logique ici.
 */

import type { MetaState, WeaponDefId } from '@/domain';
import { UNLOCK_DEFS } from '@/data/unlocks';
import type { UnlockDef } from '@/data/unlocks';
import { getWeaponDef } from '@/data/weapons';
import { unlockedWeapons } from '@/systems/meta';

export interface HubActions {
  onStartRun(): void;
  onPurchase(def: UnlockDef): void;
  onSelectWeapon(id: WeaponDefId): void;
}

export interface HubScreen {
  /** Re-rendu complet à chaque appel : la méta vient de changer. */
  show(meta: MetaState, actions: HubActions): void;
  hide(): void;
}

const BUTTON_STYLE =
  'font: 14px monospace; cursor: pointer; background: #2c313a; color: #d8e1e8;' +
  'border: 1px solid #8a939e; padding: 6px 16px; margin: 4px;';

function line(text: string, color = '#8a939e'): HTMLDivElement {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `margin: 4px 0; color: ${color};`;
  return el;
}

function sectionTitle(text: string): HTMLDivElement {
  const el = line(text, '#d8e1e8');
  el.style.marginTop = '24px';
  el.style.letterSpacing = '2px';
  return el;
}

function buildHub(meta: MetaState, actions: HubActions): HTMLDivElement {
  const root = document.createElement('div');
  root.style.cssText =
    'position: fixed; inset: 0; display: grid; place-items: center;' +
    'background: #0a0b0d; color: #d8e1e8; font: 16px monospace; text-align: center;';

  const panel = document.createElement('div');

  const title = document.createElement('div');
  title.textContent = 'INSTALLATION — HUB';
  title.style.cssText = 'font-size: 28px; margin-bottom: 24px; letter-spacing: 4px;';
  panel.appendChild(title);

  panel.appendChild(line(`crédits : ${meta.currency}`, '#f0c33c'));
  panel.appendChild(
    line(
      `runs : ${meta.records.totalRuns} — kills : ${meta.records.totalKills} — meilleur étage : ${
        meta.records.bestFloor + 1
      }`,
    ),
  );

  panel.appendChild(sectionTitle('LOADOUT'));
  for (const weaponId of unlockedWeapons(meta)) {
    const def = getWeaponDef(weaponId);
    const button = document.createElement('button');
    const selected = meta.loadout.weaponId === weaponId;
    button.textContent = selected ? `[ ${def.name} ]` : def.name;
    button.style.cssText = BUTTON_STYLE + (selected ? 'border-color: #f0c33c; color: #f0c33c;' : '');
    button.addEventListener('click', () => actions.onSelectWeapon(weaponId));
    panel.appendChild(button);
  }

  const purchasable = UNLOCK_DEFS.filter((def) => !meta.unlocks.includes(def.id));
  if (purchasable.length > 0) {
    panel.appendChild(sectionTitle('BOUTIQUE'));
    for (const def of purchasable) {
      const button = document.createElement('button');
      button.textContent = `${def.name} — ${def.cost} crédits`;
      button.title = def.description;
      button.disabled = meta.currency < def.cost;
      button.style.cssText = BUTTON_STYLE + (button.disabled ? 'opacity: 0.4; cursor: default;' : '');
      button.addEventListener('click', () => actions.onPurchase(def));
      panel.appendChild(button);
      panel.appendChild(line(def.description));
    }
  }

  const start = document.createElement('button');
  start.textContent = 'DESCENDRE';
  start.style.cssText = BUTTON_STYLE + 'margin-top: 32px; padding: 12px 32px; font-size: 18px;';
  start.addEventListener('click', () => actions.onStartRun());
  panel.appendChild(document.createElement('div')).appendChild(start);

  root.appendChild(panel);
  return root;
}

export function createHubScreen(): HubScreen {
  let root: HTMLDivElement | null = null;

  const hide = (): void => {
    root?.remove();
    root = null;
  };

  return {
    show(meta: MetaState, actions: HubActions): void {
      hide();
      root = buildHub(meta, actions);
      document.body.appendChild(root);
    },
    hide,
  };
}
