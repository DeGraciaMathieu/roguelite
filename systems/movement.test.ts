import { describe, expect, it } from 'vitest';
import type { RunState } from '@/domain';
import type { PlayerIntent } from '@/input/intent';
import { createDebugRun } from '@/data/debugRoom';
import { DASH_COOLDOWN_MS, DASH_SPEED, PLAYER_MOVE_SPEED, WALL_THICKNESS } from '@/data/balance';
import { updateMovement } from './movement';

function intent(moveX: number, moveY: number, aimWorld = { x: 0, y: 0 }): PlayerIntent {
  return {
    move: { x: moveX, y: moveY },
    aimWorld,
    fire: false,
    reload: false,
    useConsumable: false,
    dash: false,
  };
}

function dashIntent(moveX: number, moveY: number): PlayerIntent {
  return { ...intent(moveX, moveY), dash: true };
}

function roomBounds(state: RunState) {
  const room = state.floor.rooms[state.floor.currentRoomId];
  if (!room) throw new Error('Salle courante introuvable');
  return room.bounds;
}

describe('updateMovement', () => {
  it('déplace le joueur selon l’intention et le delta', () => {
    const state = createDebugRun(42);
    const start = { ...state.player.pos };

    updateMovement(state, intent(1, 0), 1000 / 60);

    expect(state.player.pos.x).toBeGreaterThan(start.x);
    expect(state.player.pos.y).toBe(start.y);
  });

  it('parcourt PLAYER_MOVE_SPEED pixels par seconde simulée', () => {
    const state = createDebugRun(42);
    const startX = state.player.pos.x;

    // 60 ticks de 1000/60 ms = 1 s de simulation, trajet sans obstacle.
    for (let i = 0; i < 60; i += 1) {
      updateMovement(state, intent(-1, 0), 1000 / 60);
    }

    expect(startX - state.player.pos.x).toBeCloseTo(PLAYER_MOVE_SPEED, 5);
  });

  it('reste confiné dans la salle malgré une poussée continue vers un coin', () => {
    const state = createDebugRun(42);
    const bounds = roomBounds(state);
    const diag = Math.SQRT1_2;

    for (let i = 0; i < 600; i += 1) {
      updateMovement(state, intent(diag, diag), 1000 / 60);
    }

    const maxX = bounds.x + bounds.w - WALL_THICKNESS - state.player.radius;
    const maxY = bounds.y + bounds.h - WALL_THICKNESS - state.player.radius;
    // La résolution axe par axe s'arrête à moins d'un pas du mur, sans le pénétrer.
    expect(state.player.pos.x).toBeLessThanOrEqual(maxX);
    expect(state.player.pos.x).toBeGreaterThan(maxX - 5);
    expect(state.player.pos.y).toBeLessThanOrEqual(maxY);
    expect(state.player.pos.y).toBeGreaterThan(maxY - 5);
  });

  it('est bloqué par un obstacle mais glisse le long de celui-ci', () => {
    const state = createDebugRun(42);
    const obstacle = state.floor.rooms[state.floor.currentRoomId]?.obstacles[2];
    if (!obstacle) throw new Error('Obstacle de test manquant');

    // Part sous le pilier central et pousse vers le haut : Y doit buter dessus.
    state.player.pos = { x: obstacle.x + obstacle.w / 2, y: obstacle.y + obstacle.h + 40 };
    for (let i = 0; i < 120; i += 1) {
      updateMovement(state, intent(0, -1), 1000 / 60);
    }
    expect(state.player.pos.y).toBeGreaterThanOrEqual(obstacle.y + obstacle.h + state.player.radius - 0.001);

    // En poussant en diagonale, X continue d'avancer (glissement).
    const startX = state.player.pos.x;
    for (let i = 0; i < 30; i += 1) {
      updateMovement(state, intent(Math.SQRT1_2, -Math.SQRT1_2), 1000 / 60);
    }
    expect(state.player.pos.x).toBeGreaterThan(startX);
  });

  it('est bloqué par une fosse mais glisse le long de son bord', () => {
    const state = createDebugRun(42);
    const room = state.floor.rooms[state.floor.currentRoomId];
    if (!room) throw new Error('Salle de debug manquante');
    room.pits = [{ x: 500, y: 200, w: 100, h: 200 }];
    state.player.pos = { x: 460, y: 300 };

    for (let i = 0; i < 60; i += 1) {
      updateMovement(state, intent(1, 0), 1000 / 60);
    }
    // Bloqué au bord gauche de la fosse (500 - rayon).
    expect(state.player.pos.x).toBeLessThanOrEqual(500 - state.player.radius);

    // En diagonale, Y continue d'avancer le long du bord.
    const startY = state.player.pos.y;
    for (let i = 0; i < 30; i += 1) {
      updateMovement(state, intent(Math.SQRT1_2, Math.SQRT1_2), 1000 / 60);
    }
    expect(state.player.pos.y).toBeGreaterThan(startY);
    expect(state.player.pos.x).toBeLessThanOrEqual(500 - state.player.radius);
  });

  it('le dash propulse plus vite que la course, puis la vitesse retombe', () => {
    const state = createDebugRun(42);
    const startX = state.player.pos.x;

    updateMovement(state, dashIntent(1, 0), 1000 / 60);
    const dashStep = state.player.pos.x - startX;
    expect(dashStep).toBeCloseTo(DASH_SPEED / 60, 5);

    // Après la durée du dash, retour à la vitesse de course.
    for (let i = 0; i < 20; i += 1) {
      updateMovement(state, intent(1, 0), 1000 / 60);
    }
    expect(Math.hypot(state.player.vel.x, state.player.vel.y)).toBeCloseTo(PLAYER_MOVE_SPEED, 5);
  });

  it('la direction du dash est figée au déclenchement', () => {
    const state = createDebugRun(42);
    const startY = state.player.pos.y;

    updateMovement(state, dashIntent(1, 0), 1000 / 60);
    // Pendant le dash, pousser vers le bas ne change rien.
    for (let i = 0; i < 5; i += 1) {
      updateMovement(state, intent(0, 1), 1000 / 60);
    }
    expect(state.player.pos.y).toBe(startY);
  });

  it('respecte le cooldown entre deux dashs', () => {
    const state = createDebugRun(42);

    updateMovement(state, dashIntent(1, 0), 1000 / 60);
    // Laisse finir le dash, mais pas le cooldown.
    for (let i = 0; i < 12; i += 1) {
      updateMovement(state, intent(0, 0), 1000 / 60);
    }
    updateMovement(state, dashIntent(1, 0), 1000 / 60);
    expect(Math.abs(state.player.vel.x)).toBeLessThanOrEqual(PLAYER_MOVE_SPEED);

    // Cooldown écoulé : le dash repart.
    updateMovement(state, intent(0, 0), DASH_COOLDOWN_MS);
    updateMovement(state, dashIntent(1, 0), 1000 / 60);
    expect(state.player.vel.x).toBeCloseTo(DASH_SPEED, 5);
  });

  it('à l’arrêt, le dash part dans la direction de visée', () => {
    const state = createDebugRun(42);
    const start = { ...state.player.pos };
    // Vise vers le bas, sans bouger.
    updateMovement(state, intent(0, 0, { x: start.x, y: start.y + 100 }), 1000 / 60);

    updateMovement(state, dashIntent(0, 0), 1000 / 60);

    expect(state.player.pos.y).toBeGreaterThan(start.y);
    expect(state.player.pos.x).toBeCloseTo(start.x, 5);
  });

  it('oriente la visée vers le point monde visé', () => {
    const state = createDebugRun(42);
    const below = { x: state.player.pos.x, y: state.player.pos.y + 100 };

    updateMovement(state, intent(0, 0, below), 1000 / 60);

    expect(state.player.aim).toBeCloseTo(Math.PI / 2);
  });
});
