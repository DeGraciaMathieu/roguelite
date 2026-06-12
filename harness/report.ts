/**
 * Agrégation des mesures de runs par politique et mise en forme des
 * rapports : résumé console lisible, export CSV par run. Pur : aucune E/S,
 * le CLI (sim.ts) décide où écrire.
 */

import type { AmmoType } from '@/domain';
import type { RunRecord } from './telemetry';

const AMMO_TYPES: readonly AmmoType[] = ['handgun', 'shotgun', 'rifle'];

export interface FloorWipeRate {
  floor: number;
  /** Runs ayant atteint cet étage. */
  reached: number;
  /** Morts survenues à cet étage. */
  deaths: number;
  /** deaths / reached. */
  rate: number;
}

export interface PolicySummary {
  policy: string;
  runs: number;
  extracted: number;
  dead: number;
  tickCapped: number;
  extractionRate: number;
  avgTicks: number;
  avgDurationMs: number;
  avgKills: number;
  avgDeepestFloor: number;
  /** Histogramme des étages de mort (clés en string : sérialisation JSON stable). */
  deathFloorHistogram: Record<string, number>;
  wipeRateByFloor: FloorWipeRate[];
  avgAmmoPickedUp: Record<AmmoType, number>;
  avgAmmoSpent: Record<AmmoType, number>;
  avgMedkitsUsed: number;
  avgBandagesUsed: number;
}

function average(records: readonly RunRecord[], pick: (record: RunRecord) => number): number {
  if (records.length === 0) return 0;
  return records.reduce((sum, record) => sum + pick(record), 0) / records.length;
}

function summarizePolicy(policy: string, records: readonly RunRecord[]): PolicySummary {
  const extracted = records.filter((r) => r.status === 'extracted').length;
  const dead = records.filter((r) => r.status === 'dead').length;
  const tickCapped = records.filter((r) => r.status === 'tick-cap').length;

  const deathFloorHistogram: Record<string, number> = {};
  for (const record of records) {
    if (record.deathFloor === null) continue;
    const key = String(record.deathFloor);
    deathFloorHistogram[key] = (deathFloorHistogram[key] ?? 0) + 1;
  }

  const maxFloor = records.reduce((max, r) => Math.max(max, r.deepestFloor), 0);
  const wipeRateByFloor: FloorWipeRate[] = [];
  for (let floor = 0; floor <= maxFloor; floor += 1) {
    const reached = records.filter((r) => r.deepestFloor >= floor).length;
    const deaths = records.filter((r) => r.deathFloor === floor).length;
    wipeRateByFloor.push({ floor, reached, deaths, rate: reached > 0 ? deaths / reached : 0 });
  }

  const avgAmmo = (
    pick: (record: RunRecord) => Record<AmmoType, number>,
  ): Record<AmmoType, number> => ({
    handgun: average(records, (r) => pick(r).handgun),
    shotgun: average(records, (r) => pick(r).shotgun),
    rifle: average(records, (r) => pick(r).rifle),
  });

  return {
    policy,
    runs: records.length,
    extracted,
    dead,
    tickCapped,
    extractionRate: records.length > 0 ? extracted / records.length : 0,
    avgTicks: average(records, (r) => r.ticks),
    avgDurationMs: average(records, (r) => r.durationMs),
    avgKills: average(records, (r) => r.kills),
    avgDeepestFloor: average(records, (r) => r.deepestFloor),
    deathFloorHistogram,
    wipeRateByFloor,
    avgAmmoPickedUp: avgAmmo((r) => r.ammoPickedUp),
    avgAmmoSpent: avgAmmo((r) => r.ammoSpent),
    avgMedkitsUsed: average(records, (r) => r.medkitsUsed),
    avgBandagesUsed: average(records, (r) => r.bandagesUsed),
  };
}

/** Une entrée par politique, dans l'ordre d'apparition des records. */
export function summarize(records: readonly RunRecord[]): PolicySummary[] {
  const byPolicy = new Map<string, RunRecord[]>();
  for (const record of records) {
    const group = byPolicy.get(record.policy);
    if (group) group.push(record);
    else byPolicy.set(record.policy, [record]);
  }
  return [...byPolicy.entries()].map(([policy, group]) => summarizePolicy(policy, group));
}

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function fixed(value: number, digits = 1): string {
  return value.toFixed(digits);
}

/** Résumé lisible pour la console, une section par politique. */
export function formatSummaries(summaries: readonly PolicySummary[]): string {
  const lines: string[] = [];
  for (const s of summaries) {
    lines.push(`=== ${s.policy} — ${s.runs} runs ===`);
    lines.push(
      `  issues      extraction ${pct(s.extractionRate)} (${s.extracted})` +
        `  morts ${s.dead}  tick-cap ${s.tickCapped}`,
    );
    lines.push(
      `  moyenne     ${fixed(s.avgDurationMs / 1000)} s (${Math.round(s.avgTicks)} ticks)` +
        `  kills ${fixed(s.avgKills)}  étage max ${fixed(s.avgDeepestFloor)}`,
    );
    const ammo = AMMO_TYPES.map(
      (type) => `${type} +${fixed(s.avgAmmoPickedUp[type])}/-${fixed(s.avgAmmoSpent[type])}`,
    ).join('  ');
    lines.push(`  munitions   ${ammo} (ramassées/-tirées par run)`);
    lines.push(
      `  soins       medkits ${fixed(s.avgMedkitsUsed)}/run  bandages ${fixed(s.avgBandagesUsed)}/run`,
    );
    const wipes = s.wipeRateByFloor
      .map((w) => `é${w.floor} ${w.deaths}/${w.reached} (${pct(w.rate)})`)
      .join('  ');
    lines.push(`  wipe/étage  ${wipes}`);
    lines.push('');
  }
  return lines.join('\n');
}

/** CSV par run, colonnes à plat (munitions préfixées par type). */
export function toCsv(records: readonly RunRecord[]): string {
  const header = [
    'seed',
    'policy',
    'status',
    'ticks',
    'durationMs',
    'deepestFloor',
    'floorsCleared',
    'kills',
    'deathFloor',
    ...AMMO_TYPES.map((type) => `ammoPickedUp_${type}`),
    ...AMMO_TYPES.map((type) => `ammoSpent_${type}`),
    'medkitsPickedUp',
    'medkitsUsed',
    'bandagesPickedUp',
    'bandagesUsed',
    'finalHealth',
  ];
  const rows = records.map((r) =>
    [
      r.seed,
      r.policy,
      r.status,
      r.ticks,
      r.durationMs,
      r.deepestFloor,
      r.floorsCleared,
      r.kills,
      r.deathFloor ?? '',
      ...AMMO_TYPES.map((type) => r.ammoPickedUp[type]),
      ...AMMO_TYPES.map((type) => r.ammoSpent[type]),
      r.medkitsPickedUp,
      r.medkitsUsed,
      r.bandagesPickedUp,
      r.bandagesUsed,
      r.finalHealth,
    ].join(','),
  );
  return [header.join(','), ...rows].join('\n');
}
