import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt, pick } from './core';

/** Génère `count` flottants successifs à partir d'un RNG neuf sur `seed`. */
function sequence(seed: number, count: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => nextFloat(rng));
}

describe('createRng', () => {
  it('conserve la seed et initialise le curseur dessus', () => {
    const rng = createRng(42);
    expect(rng.seed).toBe(42);
    expect(rng.cursor).toBe(42);
  });
});

describe('nextFloat', () => {
  it('reste dans [0, 1)', () => {
    const rng = createRng(1337);
    for (let i = 0; i < 1000; i += 1) {
      const value = nextFloat(rng);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('est déterministe : même seed → même séquence', () => {
    expect(sequence(42, 50)).toEqual(sequence(42, 50));
  });

  it('diverge entre deux seeds différentes', () => {
    expect(sequence(1, 50)).not.toEqual(sequence(2, 50));
  });

  it('fait avancer le curseur à chaque tirage', () => {
    const rng = createRng(7);
    const before = rng.cursor;
    nextFloat(rng);
    expect(rng.cursor).not.toBe(before);
  });
});

describe('nextInt', () => {
  it('reste dans [min, max] inclus', () => {
    const rng = createRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i += 1) {
      const value = nextInt(rng, 0, 3);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(3);
      seen.add(value);
    }
    // Les deux bornes sont atteignables (déterministe sur cette seed).
    expect(seen.has(0)).toBe(true);
    expect(seen.has(3)).toBe(true);
  });

  it('renvoie toujours la borne quand min === max', () => {
    const rng = createRng(3);
    for (let i = 0; i < 10; i += 1) {
      expect(nextInt(rng, 5, 5)).toBe(5);
    }
  });

  it('est déterministe : même seed → mêmes entiers', () => {
    const a = createRng(2024);
    const b = createRng(2024);
    const drawsA = Array.from({ length: 20 }, () => nextInt(a, 0, 100));
    const drawsB = Array.from({ length: 20 }, () => nextInt(b, 0, 100));
    expect(drawsA).toEqual(drawsB);
  });
});

describe('pick', () => {
  it('renvoie un élément du tableau', () => {
    const rng = createRng(11);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 50; i += 1) {
      expect(items).toContain(pick(rng, items));
    }
  });

  it('renvoie l’unique élément d’un singleton', () => {
    const rng = createRng(5);
    expect(pick(rng, ['solo'])).toBe('solo');
  });

  it('lève sur un tableau vide', () => {
    const rng = createRng(5);
    expect(() => pick(rng, [])).toThrow('pick() sur un tableau vide');
  });

  it('est déterministe : même seed → mêmes choix', () => {
    const items = ['x', 'y', 'z', 'w'] as const;
    const a = createRng(808);
    const b = createRng(808);
    const choicesA = Array.from({ length: 30 }, () => pick(a, items));
    const choicesB = Array.from({ length: 30 }, () => pick(b, items));
    expect(choicesA).toEqual(choicesB);
  });
});
