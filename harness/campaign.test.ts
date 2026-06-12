import { describe, expect, it } from 'vitest';
import { runCampaign } from './campaign';
import { CAUTIOUS_PROFILE } from './policies';

describe('runCampaign', () => {
  it('produit un record par seed × politique, dans un ordre stable', () => {
    const records = runCampaign({
      seeds: [1, 2],
      profiles: [CAUTIOUS_PROFILE],
      maxTicks: 60_000,
    });

    expect(records.map((r) => [r.policy, r.seed])).toEqual([
      ['cautious', 1],
      ['cautious', 2],
    ]);
    // Les runs aboutissent (la prudente extrait sur ces seeds, cf. policies.test).
    expect(records.every((r) => r.status === 'extracted')).toBe(true);
  });

  it('est déterministe : deux campagnes identiques → records identiques', () => {
    const options = { seeds: [1, 2], profiles: [CAUTIOUS_PROFILE], maxTicks: 60_000 };

    expect(runCampaign(options)).toEqual(runCampaign(options));
  });
});
