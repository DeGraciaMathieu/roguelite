/**
 * Boucle de jeu : simulation à pas fixe + interpolation au rendu.
 * Agnostique du jeu : ne connaît ni le domaine, ni Pixi, ni le DOM (hors rAF).
 */

export interface LoopHooks {
  /** Appelé à pas fixe, autant de fois que nécessaire pour rattraper le temps réel. */
  update: (dtMs: number) => void;
  /** Appelé une fois par frame ; alpha ∈ [0, 1) sert à interpoler le rendu entre deux ticks. */
  render: (alpha: number) => void;
}

export interface GameLoop {
  start(): void;
  stop(): void;
}

export const FIXED_DT_MS = 1000 / 60;

/**
 * Borne le temps consommé par frame : après un onglet en arrière-plan, on
 * abandonne le temps perdu plutôt que de simuler des centaines de ticks
 * d'un coup (spirale de la mort).
 */
export const MAX_FRAME_MS = 250;

export interface StepResult {
  /** Nombre de ticks de simulation à exécuter pour cette frame. */
  ticks: number;
  /** Reliquat de temps non simulé, reporté à la frame suivante. */
  accumulatorMs: number;
  /** Fraction du tick suivant déjà écoulée, pour l'interpolation du rendu. */
  alpha: number;
}

/** Cœur pur de la boucle, testable sans rAF. */
export function stepFixed(accumulatorMs: number, frameMs: number, fixedDtMs: number): StepResult {
  let acc = accumulatorMs + Math.min(frameMs, MAX_FRAME_MS);
  let ticks = 0;
  while (acc >= fixedDtMs) {
    acc -= fixedDtMs;
    ticks += 1;
  }
  return { ticks, accumulatorMs: acc, alpha: acc / fixedDtMs };
}

export function createGameLoop(hooks: LoopHooks, fixedDtMs: number = FIXED_DT_MS): GameLoop {
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let accumulatorMs = 0;

  function frame(now: number): void {
    const frameMs = lastTime === null ? 0 : now - lastTime;
    lastTime = now;

    const step = stepFixed(accumulatorMs, frameMs, fixedDtMs);
    accumulatorMs = step.accumulatorMs;
    for (let i = 0; i < step.ticks; i += 1) {
      hooks.update(fixedDtMs);
    }
    hooks.render(step.alpha);

    rafId = requestAnimationFrame(frame);
  }

  return {
    start(): void {
      if (rafId !== null) return;
      lastTime = null;
      accumulatorMs = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop(): void {
      if (rafId === null) return;
      cancelAnimationFrame(rafId);
      rafId = null;
    },
  };
}
