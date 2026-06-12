import { describe, expect, it } from 'vitest';
import { MAX_FRAME_MS, stepFixed } from './loop';

describe('stepFixed', () => {
  it('produit un nombre de ticks déterministe pour un temps donné', () => {
    const result = stepFixed(0, 100, 20);
    expect(result.ticks).toBe(5);
    expect(result.accumulatorMs).toBe(0);
    expect(result.alpha).toBe(0);
  });

  it('reporte le reliquat de temps et expose un alpha pour le rendu', () => {
    const result = stepFixed(0, 50, 20);
    expect(result.ticks).toBe(2);
    expect(result.accumulatorMs).toBe(10);
    expect(result.alpha).toBeCloseTo(0.5);
  });

  it('cumule le reliquat entre les frames', () => {
    const first = stepFixed(0, 30, 20);
    expect(first.ticks).toBe(1);
    const second = stepFixed(first.accumulatorMs, 30, 20);
    expect(second.ticks).toBe(2);
    expect(second.accumulatorMs).toBe(0);
  });

  it('borne une frame trop longue pour éviter la spirale de la mort', () => {
    const result = stepFixed(0, 10_000, 20);
    expect(result.ticks).toBe(Math.floor(MAX_FRAME_MS / 20));
  });
});
