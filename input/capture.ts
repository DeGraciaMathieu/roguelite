/**
 * Capture clavier/souris et traduction en PlayerIntent.
 * Utilise les codes physiques (KeyW/KeyA/KeyS/KeyD) : fonctionne en WASD
 * sur QWERTY et en ZQSD sur AZERTY sans configuration.
 */

import type { Vec2 } from '@/domain';
import type { PlayerIntent } from './intent';

export interface InputCapture {
  /** Intention courante ; screenToWorld est injecté pour rester agnostique du rendu. */
  intent(screenToWorld: (screen: Vec2) => Vec2): PlayerIntent;
  dispose(): void;
}

const LEFT_CODES = ['KeyA', 'ArrowLeft'];
const RIGHT_CODES = ['KeyD', 'ArrowRight'];
const UP_CODES = ['KeyW', 'ArrowUp'];
const DOWN_CODES = ['KeyS', 'ArrowDown'];
const RELOAD_CODES = ['KeyR'];
const USE_CONSUMABLE_CODES = ['KeyH'];
const DASH_CODES = ['Space'];

export function createInputCapture(surface: HTMLElement): InputCapture {
  const pressed = new Set<string>();
  // Fronts montants depuis la dernière lecture d'intention (drainés par intent()).
  const justPressed = new Set<string>();
  let mouseScreen: Vec2 = { x: 0, y: 0 };
  let firePressed = false;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!event.repeat && !pressed.has(event.code)) justPressed.add(event.code);
    pressed.add(event.code);
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    pressed.delete(event.code);
  };
  const onMouseMove = (event: MouseEvent): void => {
    const rect = surface.getBoundingClientRect();
    mouseScreen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) firePressed = true;
  };
  const onMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) firePressed = false;
  };
  const onBlur = (): void => {
    // Évite les entrées "fantômes" restées actives quand la fenêtre perd le focus.
    pressed.clear();
    justPressed.clear();
    firePressed = false;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  const isPressed = (codes: readonly string[]): boolean => codes.some((code) => pressed.has(code));

  return {
    intent(screenToWorld: (screen: Vec2) => Vec2): PlayerIntent {
      const x = (isPressed(RIGHT_CODES) ? 1 : 0) - (isPressed(LEFT_CODES) ? 1 : 0);
      const y = (isPressed(DOWN_CODES) ? 1 : 0) - (isPressed(UP_CODES) ? 1 : 0);
      const length = Math.hypot(x, y);
      const move: Vec2 = length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
      const useConsumable = USE_CONSUMABLE_CODES.some((code) => justPressed.has(code));
      const dash = DASH_CODES.some((code) => justPressed.has(code));
      justPressed.clear();
      return {
        move,
        aimWorld: screenToWorld(mouseScreen),
        fire: firePressed,
        reload: isPressed(RELOAD_CODES),
        useConsumable,
        dash,
      };
    },
    dispose(): void {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
