/**
 * Pilote de run headless : joue une run complète sans Pixi ni DOM, en
 * réutilisant les systèmes tels quels via stepRun. Consommateur en lecture
 * du domaine — aucune logique de gameplay ne vit ici.
 */

import { FIXED_DT_MS } from '@/core/loop';
import type { RunState, RunStats } from '@/domain';
import type { PlayerIntent } from '@/input/intent';
import { createRun } from '@/systems/run';
import { stepRun } from '@/systems/step';

/**
 * Un agent lit l'état de run et émet une intention par tick.
 * Contrat de déterminisme : à seed + agent fixés, mêmes intentions à chaque
 * tick — tout aléa de l'agent doit passer par un PRNG seedé, jamais Math.random.
 */
export type HeadlessAgent = (state: RunState, tick: number) => PlayerIntent;

/** Garde-fou anti-boucle infinie : 10 minutes de simulation à 60 ticks/s. */
export const DEFAULT_MAX_TICKS = 36_000;

export interface HeadlessOptions {
  /** Plafond de ticks avant arrêt forcé (défaut : DEFAULT_MAX_TICKS). */
  maxTicks?: number;
  /** Pas de simulation en ms (défaut : FIXED_DT_MS, le même que le jeu). */
  dtMs?: number;
}

/** `tick-cap` : la run était encore active au plafond de ticks. */
export type HeadlessOutcomeStatus = 'dead' | 'extracted' | 'tick-cap';

export interface RunOutcome {
  seed: number;
  status: HeadlessOutcomeStatus;
  ticks: number;
  elapsedMs: number;
  stats: RunStats;
  /** État final brut, lecture seule : la télémétrie en dérive ses métriques. */
  finalState: RunState;
}

export function runHeadless(
  seed: number,
  agent: HeadlessAgent,
  options: HeadlessOptions = {},
): RunOutcome {
  const maxTicks = options.maxTicks ?? DEFAULT_MAX_TICKS;
  const dtMs = options.dtMs ?? FIXED_DT_MS;

  const state = createRun(seed);
  let ticks = 0;
  while (state.status === 'active' && ticks < maxTicks) {
    stepRun(state, agent(state, ticks), dtMs);
    ticks += 1;
  }

  return {
    seed,
    status: state.status === 'active' ? 'tick-cap' : state.status,
    ticks,
    elapsedMs: state.elapsedMs,
    stats: state.stats,
    finalState: state,
  };
}
