import { describe, expect, it } from 'vitest';
import { summarize, toCsv } from './report';
import type { RunRecord } from './telemetry';

function record(overrides: Partial<RunRecord>): RunRecord {
  return {
    seed: 1,
    policy: 'cautious',
    status: 'extracted',
    ticks: 1000,
    durationMs: 1000 * (1000 / 60),
    deepestFloor: 1,
    floorsCleared: 2,
    kills: 5,
    deathFloor: null,
    ammoPickedUp: { handgun: 10, shotgun: 0, rifle: 0 },
    ammoSpent: { handgun: 20, shotgun: 0, rifle: 0 },
    medkitsPickedUp: 1,
    medkitsUsed: 1,
    bandagesPickedUp: 0,
    bandagesUsed: 0,
    finalHealth: 80,
    ...overrides,
  };
}

describe('summarize', () => {
  it('agrège par politique : taux, moyennes, histogramme des morts', () => {
    const records = [
      record({ seed: 1, kills: 4 }),
      record({ seed: 2, status: 'dead', deathFloor: 2, deepestFloor: 2, kills: 8 }),
      record({ seed: 3, status: 'tick-cap', kills: 6 }),
      record({ seed: 1, policy: 'aggressive', kills: 20 }),
    ];

    const summaries = summarize(records);
    expect(summaries.map((s) => s.policy)).toEqual(['cautious', 'aggressive']);

    const cautious = summaries[0];
    if (!cautious) throw new Error('Résumé cautious manquant');
    expect(cautious.runs).toBe(3);
    expect(cautious.extracted).toBe(1);
    expect(cautious.dead).toBe(1);
    expect(cautious.tickCapped).toBe(1);
    expect(cautious.extractionRate).toBeCloseTo(1 / 3, 10);
    expect(cautious.avgKills).toBeCloseTo(6, 10);
    expect(cautious.deathFloorHistogram).toEqual({ '2': 1 });
  });

  it('calcule le taux de wipe par étage sur les runs l’ayant atteint', () => {
    const records = [
      record({ seed: 1, deepestFloor: 1 }), // extraite à l'étage 1
      record({ seed: 2, status: 'dead', deathFloor: 1, deepestFloor: 1 }),
      record({ seed: 3, status: 'dead', deathFloor: 0, deepestFloor: 0 }),
    ];

    const summary = summarize(records)[0];
    if (!summary) throw new Error('Résumé manquant');
    expect(summary.wipeRateByFloor).toEqual([
      { floor: 0, reached: 3, deaths: 1, rate: 1 / 3 },
      { floor: 1, reached: 2, deaths: 1, rate: 1 / 2 },
    ]);
  });
});

describe('toCsv', () => {
  it('produit un en-tête + une ligne par run, deathFloor vide hors mort', () => {
    const csv = toCsv([record({}), record({ seed: 2, status: 'dead', deathFloor: 3 })]);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('seed,policy,status');
    expect(lines[0]).toContain('ammoSpent_handgun');
    expect(lines[1]).toContain('1,cautious,extracted');
    expect(lines[1]).toContain(',,'); // deathFloor vide
    expect(lines[2]).toContain(',3,'); // deathFloor renseigné
  });
});
