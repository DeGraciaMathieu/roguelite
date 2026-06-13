import { describe, expect, it } from 'vitest';
import {
  DEATH_RING_DURATION_MS,
  PICKUP_DURATION_MS,
  SPARK_DURATION_MS,
  createEffectPool,
  effectProgress,
  spawnDeathRing,
  spawnEffect,
  spawnImpactSparks,
  spawnPickup,
  tickEffects,
} from './effects';

describe('pool d’effets', () => {
  it('spawn active un slot avec un âge remis à zéro', () => {
    const pool = createEffectPool();
    spawnDeathRing(pool, 10, 20, 14, 0xffffff);

    const active = pool.filter((effect) => effect.active);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ kind: 'deathRing', x: 10, y: 20, radius: 14, ageMs: 0 });
  });

  it('tick vieillit puis expire les effets à leur durée de vie', () => {
    const pool = createEffectPool();
    spawnDeathRing(pool, 0, 0, 14, 0xffffff);

    tickEffects(pool, DEATH_RING_DURATION_MS - 1);
    expect(pool.filter((effect) => effect.active)).toHaveLength(1);

    tickEffects(pool, 1);
    expect(pool.filter((effect) => effect.active)).toHaveLength(0);
  });

  it('réutilise les slots libérés sans faire grossir le pool', () => {
    const pool = createEffectPool();
    const capacity = pool.length;
    for (let cycle = 0; cycle < 3; cycle += 1) {
      for (let n = 0; n < capacity; n += 1) spawnDeathRing(pool, n, 0, 4, 0);
      expect(pool.filter((effect) => effect.active)).toHaveLength(capacity);
      tickEffects(pool, DEATH_RING_DURATION_MS);
    }
    expect(pool.length).toBe(capacity);
  });

  it('pool plein : l’effet excédentaire est sauté sans erreur', () => {
    const pool = createEffectPool();
    for (let n = 0; n < pool.length + 5; n += 1) spawnDeathRing(pool, n, 0, 4, 0);
    expect(pool.filter((effect) => effect.active)).toHaveLength(pool.length);
  });

  it('les étincelles partent en croix et dérivent au tick', () => {
    const pool = createEffectPool();
    spawnImpactSparks(pool, 100, 100, 0xf0c33c);

    const sparks = pool.filter((effect) => effect.active);
    expect(sparks).toHaveLength(4);
    const directions = new Set(sparks.map((s) => `${Math.sign(s.vx)},${Math.sign(s.vy)}`));
    expect(directions.size).toBe(4);

    tickEffects(pool, 100);
    for (const spark of sparks) {
      expect(spark.x).not.toBe(100);
      expect(spark.ageMs).toBe(100);
      expect(spark.durationMs).toBe(SPARK_DURATION_MS);
    }
  });

  it('spawnPickup active un anneau qui expire à sa durée', () => {
    const pool = createEffectPool();
    spawnPickup(pool, 30, 40, 16, 0x6fcf6f);

    const active = pool.filter((effect) => effect.active);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ kind: 'pickup', x: 30, y: 40, radius: 16, ageMs: 0 });

    tickEffects(pool, PICKUP_DURATION_MS - 1);
    expect(pool.filter((effect) => effect.active)).toHaveLength(1);
    tickEffects(pool, 1);
    expect(pool.filter((effect) => effect.active)).toHaveLength(0);
  });

  it('pool plein : un pickup excédentaire est sauté sans erreur', () => {
    const pool = createEffectPool();
    for (let n = 0; n < pool.length; n += 1) spawnDeathRing(pool, n, 0, 4, 0);
    spawnPickup(pool, 0, 0, 16, 0x6fcf6f);
    expect(pool.filter((effect) => effect.active)).toHaveLength(pool.length);
    expect(pool.some((effect) => effect.kind === 'pickup')).toBe(false);
  });

  it('effectProgress va de 0 à 1, borné', () => {
    const pool = createEffectPool();
    spawnEffect(pool, { kind: 'spark', x: 0, y: 0, vx: 0, vy: 0, radius: 2, color: 0, durationMs: 100 });
    const effect = pool[0]!;

    expect(effectProgress(effect)).toBe(0);
    tickEffects(pool, 50);
    expect(effectProgress(effect)).toBe(0.5);
  });
});
