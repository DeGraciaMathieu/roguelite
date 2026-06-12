import { describe, expect, it } from 'vitest';
import { WALL_THICKNESS } from '@/data/balance';
import { circleIntersectsRect, moveCircle, pointInRect, wallRects } from './collision';

const RECT = { x: 100, y: 100, w: 50, h: 50 };

describe('pointInRect', () => {
  it('détecte un point à l’intérieur et sur le bord', () => {
    expect(pointInRect({ x: 120, y: 120 }, RECT)).toBe(true);
    expect(pointInRect({ x: 100, y: 100 }, RECT)).toBe(true);
  });

  it('rejette un point à l’extérieur', () => {
    expect(pointInRect({ x: 99, y: 120 }, RECT)).toBe(false);
    expect(pointInRect({ x: 120, y: 151 }, RECT)).toBe(false);
  });
});

describe('circleIntersectsRect', () => {
  it('détecte un chevauchement par une face', () => {
    expect(circleIntersectsRect({ x: 90, y: 125 }, 12, RECT)).toBe(true);
  });

  it('gère les coins : proche en diagonale mais hors de portée', () => {
    // À (92, 92), distance au coin (100, 100) = √128 ≈ 11.3 : touche avec r=12…
    expect(circleIntersectsRect({ x: 92, y: 92 }, 12, RECT)).toBe(true);
    // …mais pas avec r=11.
    expect(circleIntersectsRect({ x: 92, y: 92 }, 11, RECT)).toBe(false);
  });

  it('rejette un cercle éloigné', () => {
    expect(circleIntersectsRect({ x: 0, y: 0 }, 12, RECT)).toBe(false);
  });
});

describe('moveCircle', () => {
  it('se déplace librement sans solide', () => {
    const next = moveCircle({ x: 10, y: 10 }, 5, { x: 7, y: -3 }, []);
    expect(next).toEqual({ x: 17, y: 7 });
  });

  it('glisse le long d’une paroi : X bloqué, Y conservé', () => {
    const wall = { x: 100, y: 0, w: 20, h: 200 };
    const next = moveCircle({ x: 80, y: 100 }, 12, { x: 20, y: 5 }, [wall]);
    expect(next).toEqual({ x: 80, y: 105 });
  });

  it('bloque les deux axes dans un coin', () => {
    const wallRight = { x: 100, y: 0, w: 20, h: 200 };
    const wallBottom = { x: 0, y: 100, w: 200, h: 20 };
    const next = moveCircle({ x: 85, y: 85 }, 12, { x: 20, y: 20 }, [wallRight, wallBottom]);
    expect(next).toEqual({ x: 85, y: 85 });
  });
});

describe('wallRects', () => {
  it('produit quatre murs couvrant le périmètre', () => {
    const walls = wallRects({ x: 0, y: 0, w: 800, h: 600 });
    expect(walls).toHaveLength(4);
    expect(walls).toContainEqual({ x: 0, y: 0, w: 800, h: WALL_THICKNESS });
    expect(walls).toContainEqual({ x: 0, y: 600 - WALL_THICKNESS, w: 800, h: WALL_THICKNESS });
    expect(walls).toContainEqual({ x: 0, y: 0, w: WALL_THICKNESS, h: 600 });
    expect(walls).toContainEqual({ x: 800 - WALL_THICKNESS, y: 0, w: WALL_THICKNESS, h: 600 });
  });
});
