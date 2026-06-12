import { describe, expect, it } from 'vitest';
import type { Rect } from '@/domain';
import {
  VISION_CONE_RADIUS,
  VISION_NEAR_RADIUS,
  isVisible,
  visionPolygon,
} from './visibility';

const EYE = { x: 100, y: 100 };
const AIM_RIGHT = 0;

describe('isVisible — halo + cône de visée', () => {
  it('voit tout autour dans le halo de proximité, même de dos', () => {
    const behind = { x: EYE.x - VISION_NEAR_RADIUS + 1, y: 100 };
    expect(isVisible(EYE, AIM_RIGHT, behind, [])).toBe(true);
  });

  it('voit loin dans le cône de visée, pas au-delà de sa portée', () => {
    expect(isVisible(EYE, AIM_RIGHT, { x: EYE.x + VISION_CONE_RADIUS - 1, y: 100 }, [])).toBe(true);
    expect(isVisible(EYE, AIM_RIGHT, { x: EYE.x + VISION_CONE_RADIUS + 1, y: 100 }, [])).toBe(false);
  });

  it('ne voit pas à distance de cône hors du cône (sur le côté ou derrière)', () => {
    const side = { x: 100, y: 100 + 300 }; // 90° de la visée, hors halo
    const behind = { x: 100 - 300, y: 100 };
    expect(isVisible(EYE, AIM_RIGHT, side, [])).toBe(false);
    expect(isVisible(EYE, AIM_RIGHT, behind, [])).toBe(false);
  });

  it('le repli d’angle fonctionne autour de ±π (visée vers la gauche)', () => {
    const aimLeft = Math.PI;
    const farLeft = { x: 100 - 300, y: 100 };
    expect(isVisible(EYE, aimLeft, farLeft, [])).toBe(true);
  });

  it('un obstacle entre les deux coupe la vue, même dans le cône', () => {
    const pillar: Rect = { x: 160, y: 80, w: 40, h: 40 };
    expect(isVisible(EYE, AIM_RIGHT, { x: 300, y: 100 }, [pillar])).toBe(false);
    // Cible décalée dont la ligne contourne le pilier, toujours dans le cône.
    expect(isVisible(EYE, AIM_RIGHT, { x: 300, y: 220 }, [pillar])).toBe(true);
  });

  it('une fosse ne coupe pas la vue : seuls les obstacles pleins sont des bloqueurs', () => {
    // Contrat d'appel : le renderer fournit room.obstacles, jamais room.pits.
    const roomObstacles: Rect[] = [{ x: 500, y: 500, w: 40, h: 40 }]; // ailleurs
    expect(isVisible(EYE, AIM_RIGHT, { x: 300, y: 100 }, roomObstacles)).toBe(true);
  });
});

describe('visionPolygon', () => {
  // Toutes les directions cardinales et diagonales (écran : y vers le bas),
  // dont le haut-gauche où la couture du contour s'était cassée.
  const AIMS = [0, Math.PI / 2, Math.PI, -Math.PI / 2, -(3 * Math.PI) / 4, Math.PI / 4, (3 * Math.PI) / 4, -Math.PI / 4];

  it.each(AIMS)('visée %f rad : contour borné entre halo et cône, sans point aberrant', (aim) => {
    const points = visionPolygon(EYE, aim, []);
    const distances = points.map((p) => Math.hypot(p.x - EYE.x, p.y - EYE.y));
    for (const distance of distances) {
      expect(distance).toBeGreaterThanOrEqual(VISION_NEAR_RADIUS - 1e-6);
      expect(distance).toBeLessThanOrEqual(VISION_CONE_RADIUS + 1e-6);
    }
    expect(Math.max(...distances)).toBeCloseTo(VISION_CONE_RADIUS, 6);
    expect(Math.min(...distances)).toBeCloseTo(VISION_NEAR_RADIUS, 6);
  });

  it.each(AIMS)('visée %f rad : le point le plus lointain est dans l’axe de visée', (aim) => {
    const points = visionPolygon(EYE, aim, []);
    const distances = points.map((p) => Math.hypot(p.x - EYE.x, p.y - EYE.y));
    const farthest = points[distances.indexOf(Math.max(...distances))]!;
    const angle = Math.atan2(farthest.y - EYE.y, farthest.x - EYE.x);
    let diff = Math.abs(angle - aim) % (2 * Math.PI);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    expect(diff).toBeLessThanOrEqual(Math.PI / 5 + 1e-6);
  });

  it('le contour est fermé sans saut : deux sommets consécutifs restent proches', () => {
    for (const aim of AIMS) {
      const points = visionPolygon(EYE, aim, []);
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i]!;
        const b = points[(i + 1) % points.length]!;
        const step = Math.hypot(b.x - a.x, b.y - a.y);
        // Le plus grand pas légitime est la jointure radiale cône → halo
        // (épaissie d'un chouïa par les rayons doublés à ±ε du bord).
        expect(step).toBeLessThanOrEqual(VISION_CONE_RADIUS - VISION_NEAR_RADIUS + 1e-4);
      }
    }
  });

  it('un obstacle dans le cône porte une ombre : les rayons s’arrêtent à son bord', () => {
    // Pilier dans l'axe de visée : entrée à 60 px de l'œil, coins à ~0.32 rad.
    const pillar: Rect = { x: 160, y: 80, w: 40, h: 40 };
    const points = visionPolygon(EYE, AIM_RIGHT, [pillar]);

    // Le rayon le plus proche de l'axe est clampé au bord du pilier…
    const along = points.filter((p) => {
      const angle = Math.atan2(p.y - EYE.y, p.x - EYE.x);
      return Math.abs(angle) < 0.05;
    });
    expect(along.length).toBeGreaterThan(0);
    for (const point of along) {
      expect(Math.hypot(point.x - EYE.x, point.y - EYE.y)).toBeCloseTo(60, 0);
    }

    // … tandis qu'un rayon du cône qui passe sous l'ombre garde sa portée pleine.
    const clear = points.filter((p) => {
      const angle = Math.atan2(p.y - EYE.y, p.x - EYE.x);
      return angle > 0.4 && angle < Math.PI / 5;
    });
    expect(clear.length).toBeGreaterThan(0);
    for (const point of clear) {
      expect(Math.hypot(point.x - EYE.x, point.y - EYE.y)).toBeCloseTo(VISION_CONE_RADIUS, 4);
    }
  });

  it('hors du cône, l’obstacle ne change rien au halo s’il est plus loin que lui', () => {
    const farBehind: Rect = { x: EYE.x - 400, y: 80, w: 40, h: 40 }; // derrière, hors halo
    const points = visionPolygon(EYE, AIM_RIGHT, [farBehind]);
    const behind = points.filter((p) => p.x < EYE.x - VISION_NEAR_RADIUS / 2);
    for (const point of behind) {
      expect(Math.hypot(point.x - EYE.x, point.y - EYE.y)).toBeCloseTo(VISION_NEAR_RADIUS, 4);
    }
  });
});
