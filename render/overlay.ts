/**
 * Chrome d'UI en DOM, hors canvas : seed courante et écran de fin de run
 * (mort ou extraction). Lit le domaine, ne décide de rien — la suite est un
 * callback fourni par la composition root.
 */

import type { RunStats, RunStatus } from '@/domain';

export interface GameOverlay {
  setSeed(seed: number): void;
  showRunEnd(stats: RunStats, seed: number, status: RunStatus, onContinue: () => void): void;
  hideRunEnd(): void;
}

function buildRunEndScreen(
  stats: RunStats,
  seed: number,
  status: RunStatus,
  onContinue: () => void,
): HTMLDivElement {
  const root = document.createElement('div');
  root.style.cssText =
    'position: fixed; inset: 0; display: grid; place-items: center;' +
    'background: rgba(10, 11, 13, 0.88); color: #d8e1e8; font: 16px monospace; text-align: center;';

  const panel = document.createElement('div');

  const extracted = status === 'extracted';
  const title = document.createElement('div');
  title.textContent = extracted ? 'EXTRACTION RÉUSSIE' : 'VOUS ÊTES MORT';
  title.style.cssText = `color: ${extracted ? '#7a9e63' : '#e5533d'}; font-size: 32px; margin-bottom: 24px; letter-spacing: 4px;`;
  panel.appendChild(title);

  const lines = [
    `profondeur atteinte : étage ${stats.deepestFloor + 1}`,
    `étages descendus : ${stats.floorsCleared}`,
    `dinosaures abattus : ${stats.kills}`,
    `seed : ${seed}`,
  ];
  for (const text of lines) {
    const line = document.createElement('div');
    line.textContent = text;
    line.style.cssText = 'margin: 4px 0; color: #8a939e; user-select: text;';
    panel.appendChild(line);
  }

  const button = document.createElement('button');
  button.textContent = 'Retour au hub';
  button.style.cssText =
    'margin-top: 24px; padding: 8px 24px; font: 16px monospace; cursor: pointer;' +
    'background: #2c313a; color: #d8e1e8; border: 1px solid #8a939e;';
  button.addEventListener('click', onContinue);
  panel.appendChild(button);

  root.appendChild(panel);
  return root;
}

export function createGameOverlay(): GameOverlay {
  const seedLabel = document.createElement('div');
  seedLabel.style.cssText =
    'position: fixed; top: 8px; left: 8px; color: #8a939e; font: 12px monospace; user-select: text;';
  document.body.appendChild(seedLabel);

  let runEndScreen: HTMLDivElement | null = null;

  const hideRunEnd = (): void => {
    runEndScreen?.remove();
    runEndScreen = null;
  };

  return {
    setSeed(seed: number): void {
      seedLabel.textContent = `seed: ${seed}`;
    },
    showRunEnd(stats: RunStats, seed: number, status: RunStatus, onContinue: () => void): void {
      hideRunEnd();
      runEndScreen = buildRunEndScreen(stats, seed, status, onContinue);
      document.body.appendChild(runEndScreen);
    },
    hideRunEnd,
  };
}
