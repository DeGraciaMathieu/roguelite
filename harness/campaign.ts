/**
 * Campagne d'équilibrage : joue N seeds × M politiques en headless et
 * collecte une mesure par run. Pur et déterministe : mêmes seeds + mêmes
 * politiques → mêmes records, à l'octet près.
 */

import type { PolicyProfile } from './policies';
import { createPolicyAgent } from './policies';
import { runHeadless } from './pilot';
import { observeRun } from './telemetry';
import type { RunRecord } from './telemetry';

export interface CampaignOptions {
  seeds: readonly number[];
  profiles: readonly PolicyProfile[];
  /** Plafond de ticks par run (défaut : celui du pilote). */
  maxTicks?: number;
}

export function runCampaign(options: CampaignOptions): RunRecord[] {
  const records: RunRecord[] = [];
  for (const profile of options.profiles) {
    for (const seed of options.seeds) {
      // Agent et observateur neufs par run : aucune mémoire ne fuit d'une
      // run à l'autre, chaque mesure est indépendante.
      const observer = observeRun(createPolicyAgent(profile));
      const outcome = runHeadless(
        seed,
        observer.agent,
        options.maxTicks === undefined ? {} : { maxTicks: options.maxTicks },
      );
      records.push(observer.finalize(outcome, profile.id));
    }
  }
  return records;
}
