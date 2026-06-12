import { describe, expect, it } from 'vitest';
import { defaultMeta } from '@/domain';
import type { RunStats } from '@/domain';
import {
  CURRENCY_FLOOR_DEPTH_BONUS,
  CURRENCY_PER_FLOOR,
  CURRENCY_PER_KILL,
  EXTRACTION_BONUS_MULTIPLIER,
} from '@/data/balance';
import { UNLOCK_DEFS } from '@/data/unlocks';
import { HANDGUN_ID, RIFLE_ID, SHOTGUN_ID } from '@/data/weapons';
import {
  applyRunRewards,
  purchaseUnlock,
  runCurrencyReward,
  selectLoadoutWeapon,
  unlockedWeapons,
} from './meta';

const SHOTGUN_UNLOCK = UNLOCK_DEFS.find((def) => def.weaponId === SHOTGUN_ID);
const RIFLE_UNLOCK = UNLOCK_DEFS.find((def) => def.weaponId === RIFLE_ID);
if (!SHOTGUN_UNLOCK || !RIFLE_UNLOCK) throw new Error('Catalogue de déblocages incomplet');

function stats(overrides: Partial<RunStats> = {}): RunStats {
  return { floorsCleared: 2, kills: 8, deepestFloor: 2, startedAtMs: 0, ...overrides };
}

describe('runCurrencyReward', () => {
  // Étages 0 et 1 descendus : base ×2 + bonus de profondeur du second étage.
  const FLOORS_REWARD = 2 * CURRENCY_PER_FLOOR + CURRENCY_FLOOR_DEPTH_BONUS;

  it('calcule la récompense de base à la mort', () => {
    expect(runCurrencyReward(stats(), 'dead')).toBe(8 * CURRENCY_PER_KILL + FLOORS_REWARD);
  });

  it('applique le bonus d’extraction', () => {
    const base = 8 * CURRENCY_PER_KILL + FLOORS_REWARD;
    expect(runCurrencyReward(stats(), 'extracted')).toBe(Math.floor(base * EXTRACTION_BONUS_MULTIPLIER));
  });

  it('récompense progressive : un étage profond rapporte plus qu’un étage tôt', () => {
    const reward = (floorsCleared: number) =>
      runCurrencyReward(stats({ kills: 0, floorsCleared }), 'dead');
    expect(reward(5) - reward(4)).toBeGreaterThan(reward(2) - reward(1));
  });
});

describe('applyRunRewards', () => {
  it('crédite la monnaie et met à jour les records sans muter l’entrée', () => {
    const meta = defaultMeta(HANDGUN_ID);

    const updated = applyRunRewards(meta, stats(), 'dead');

    expect(updated.currency).toBe(runCurrencyReward(stats(), 'dead'));
    expect(updated.records).toEqual({ totalRuns: 1, totalKills: 8, bestFloor: 2 });
    expect(meta.currency).toBe(0);
    expect(meta.records.totalRuns).toBe(0);
  });

  it('ne régresse jamais le meilleur étage', () => {
    let meta = defaultMeta(HANDGUN_ID);
    meta = applyRunRewards(meta, stats({ deepestFloor: 5 }), 'dead');
    meta = applyRunRewards(meta, stats({ deepestFloor: 1 }), 'dead');

    expect(meta.records.bestFloor).toBe(5);
    expect(meta.records.totalRuns).toBe(2);
  });
});

describe('purchaseUnlock', () => {
  it('débite le coût et enregistre le déblocage', () => {
    const meta = { ...defaultMeta(HANDGUN_ID), currency: SHOTGUN_UNLOCK.cost + 10 };

    const updated = purchaseUnlock(meta, SHOTGUN_UNLOCK);

    expect(updated?.currency).toBe(10);
    expect(updated?.unlocks).toContain(SHOTGUN_UNLOCK.id);
  });

  it('refuse un solde insuffisant', () => {
    const meta = { ...defaultMeta(HANDGUN_ID), currency: SHOTGUN_UNLOCK.cost - 1 };
    expect(purchaseUnlock(meta, SHOTGUN_UNLOCK)).toBeNull();
  });

  it('refuse un déblocage déjà possédé', () => {
    const meta = {
      ...defaultMeta(HANDGUN_ID),
      currency: SHOTGUN_UNLOCK.cost * 2,
      unlocks: [SHOTGUN_UNLOCK.id],
    };
    expect(purchaseUnlock(meta, SHOTGUN_UNLOCK)).toBeNull();
  });
});

describe('loadout', () => {
  it('ne propose que l’arme de base sans déblocage', () => {
    expect(unlockedWeapons(defaultMeta(HANDGUN_ID))).toEqual([HANDGUN_ID]);
  });

  it('propose le shotgun une fois débloqué et permet de le sélectionner', () => {
    const meta = { ...defaultMeta(HANDGUN_ID), unlocks: [SHOTGUN_UNLOCK.id] };

    expect(unlockedWeapons(meta)).toEqual([HANDGUN_ID, SHOTGUN_ID]);
    expect(selectLoadoutWeapon(meta, SHOTGUN_ID)?.loadout).toEqual({ weaponId: SHOTGUN_ID });
  });

  it('refuse une arme non débloquée', () => {
    expect(selectLoadoutWeapon(defaultMeta(HANDGUN_ID), SHOTGUN_ID)).toBeNull();
    expect(selectLoadoutWeapon(defaultMeta(HANDGUN_ID), RIFLE_ID)).toBeNull();
  });

  it('débloque, propose et sélectionne le rifle', () => {
    let meta = { ...defaultMeta(HANDGUN_ID), currency: RIFLE_UNLOCK.cost };

    const purchased = purchaseUnlock(meta, RIFLE_UNLOCK);
    expect(purchased).not.toBeNull();
    meta = purchased!;

    expect(meta.currency).toBe(0);
    expect(unlockedWeapons(meta)).toEqual([HANDGUN_ID, RIFLE_ID]);
    expect(selectLoadoutWeapon(meta, RIFLE_ID)?.loadout).toEqual({ weaponId: RIFLE_ID });
  });
});
