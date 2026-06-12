/**
 * Machine à états globale de l'application. Les quatre phases du jeu sont
 * typées dès maintenant ; menu et hub seront branchés à l'étape 6, la table
 * des transitions les prévoit déjà.
 */

export type GamePhase = 'menu' | 'hub' | 'run' | 'gameover';

const ALLOWED_TRANSITIONS: Record<GamePhase, readonly GamePhase[]> = {
  menu: ['hub', 'run'],
  hub: ['run'],
  run: ['gameover'],
  gameover: ['run', 'hub'],
};

export interface PhaseMachine {
  readonly phase: GamePhase;
  /** Transition gardée : lève si elle n'est pas dans la table des transitions. */
  transitionTo(next: GamePhase): void;
}

export function createPhaseMachine(initial: GamePhase): PhaseMachine {
  let phase = initial;
  return {
    get phase(): GamePhase {
      return phase;
    },
    transitionTo(next: GamePhase): void {
      if (!ALLOWED_TRANSITIONS[phase].includes(next)) {
        throw new Error(`Transition de phase invalide : ${phase} -> ${next}`);
      }
      phase = next;
    },
  };
}
