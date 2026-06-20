import { describe, expect, it } from 'vitest';
import { healthState, isDead } from './entities';

describe('healthState', () => {
  it('est fine au-dessus de 60 % de vie', () => {
    expect(healthState({ current: 100, max: 100 })).toBe('fine');
    expect(healthState({ current: 61, max: 100 })).toBe('fine');
  });

  it('bascule en caution à 60 % et au-dessus de 25 %', () => {
    // Seuil inclusif : 0.6 n'est plus « fine ».
    expect(healthState({ current: 60, max: 100 })).toBe('caution');
    expect(healthState({ current: 26, max: 100 })).toBe('caution');
  });

  it('bascule en danger à 25 % et en dessous', () => {
    expect(healthState({ current: 25, max: 100 })).toBe('danger');
    expect(healthState({ current: 1, max: 100 })).toBe('danger');
    expect(healthState({ current: 0, max: 100 })).toBe('danger');
  });
});

describe('isDead', () => {
  it('est mort à zéro ou en dessous', () => {
    expect(isDead({ current: 0, max: 100 })).toBe(true);
    expect(isDead({ current: -5, max: 100 })).toBe(true);
  });

  it('est vivant au-dessus de zéro', () => {
    expect(isDead({ current: 1, max: 100 })).toBe(false);
    expect(isDead({ current: 100, max: 100 })).toBe(false);
  });
});
