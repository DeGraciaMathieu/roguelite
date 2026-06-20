import { describe, expect, it } from 'vitest';
import { WALL_THICKNESS } from '@/data/balance';
import {
  circleIntersectsRect,
  moveCircle,
  pointInRect,
  segmentIntersectsCircle,
  segmentIntersectsRect,
  wallRects,
} from './collision';

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

describe('segmentIntersectsCircle', () => {
  const C = { x: 100, y: 0 };

  it('touche : renvoie le t d’entrée le long du segment', () => {
    // Segment horizontal y=0 vers un cercle de rayon 10 centré en (100, 0) :
    // entrée à x=90, soit t = 90/200 = 0.45.
    const t = segmentIntersectsCircle({ x: 0, y: 0 }, { x: 200, y: 0 }, C, 10);
    expect(t).toBeCloseTo(0.45);
  });

  it('rate : le segment passe à côté du cercle', () => {
    // Décalé de 20 px en y : hors du rayon 10.
    expect(segmentIntersectsCircle({ x: 0, y: 20 }, { x: 200, y: 20 }, C, 10)).toBeNull();
  });

  it('tangent : effleure le bord, compté comme touche (inclusif)', () => {
    // y=10 frôle le cercle de rayon 10 : contact unique à x=100, t=0.5.
    const t = segmentIntersectsCircle({ x: 0, y: 10 }, { x: 200, y: 10 }, C, 10);
    expect(t).toBeCloseTo(0.5);
  });

  it('a déjà dans le cercle : contact immédiat à t=0', () => {
    expect(segmentIntersectsCircle({ x: 100, y: 0 }, { x: 200, y: 0 }, C, 10)).toBe(0);
  });

  it('contact au-delà du segment : pas de touche', () => {
    // Le cercle est en (100,0) mais le segment s'arrête à x=50.
    expect(segmentIntersectsCircle({ x: 0, y: 0 }, { x: 50, y: 0 }, C, 10)).toBeNull();
  });

  it('ordre par t : le cercle le plus proche du départ donne le plus petit t', () => {
    const near = segmentIntersectsCircle({ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 50, y: 0 }, 10);
    const far = segmentIntersectsCircle({ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 150, y: 0 }, 10);
    expect(near).not.toBeNull();
    expect(far).not.toBeNull();
    expect(near as number).toBeLessThan(far as number);
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

describe('segmentIntersectsRect', () => {
  it('traverse le rect de part en part', () => {
    expect(segmentIntersectsRect({ x: 50, y: 125 }, { x: 200, y: 125 }, RECT)).toBe(true);
  });

  it('détecte un segment dont une extrémité est à l’intérieur', () => {
    expect(segmentIntersectsRect({ x: 125, y: 125 }, { x: 300, y: 125 }, RECT)).toBe(true);
  });

  it('rejette un segment qui passe entièrement à côté', () => {
    expect(segmentIntersectsRect({ x: 0, y: 0 }, { x: 10, y: 90 }, RECT)).toBe(false);
  });

  it('gère un segment axial : croise s’il est aligné sur le rect, rate sinon', () => {
    // Vertical à x=125 (delta x nul) : traverse la tranche du rect.
    expect(segmentIntersectsRect({ x: 125, y: 0 }, { x: 125, y: 300 }, RECT)).toBe(true);
    // Vertical à x=75 (delta x nul) : hors de la tranche, rejeté par le slab.
    expect(segmentIntersectsRect({ x: 75, y: 0 }, { x: 75, y: 300 }, RECT)).toBe(false);
  });

  it('effleure un bord : tangence comptée comme intersection', () => {
    expect(segmentIntersectsRect({ x: 50, y: 100 }, { x: 200, y: 100 }, RECT)).toBe(true);
  });

  it('un segment en deçà du rect ne le touche pas (slab paramétrique borné à [0,1])', () => {
    expect(segmentIntersectsRect({ x: 50, y: 125 }, { x: 80, y: 125 }, RECT)).toBe(false);
  });
});
