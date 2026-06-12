import { describe, expect, it } from 'vitest';
import type { Enemy, EnemyKind, RunState, Vec2 } from '@/domain';
import { ENEMY_ARCHETYPES } from '@/data/enemies';
import { createDebugRun } from '@/data/debugRoom';
import { updateAi } from './ai';
import { spawnRoomContent } from './spawn';

const TICK_MS = 1000 / 60;

/**
 * Fixture : la salle de debug (géométrie connue, pilier central en
 * (340, 200, 120, 28)) avec un ennemi injecté via le vrai spawn.
 */
function runWithEnemy(kind: EnemyKind, at: Vec2): { state: RunState; enemy: Enemy } {
  const state = createDebugRun(3);
  const room = state.floor.rooms[state.floor.currentRoomId];
  if (!room) throw new Error('Salle de debug manquante');
  room.spawned = false;
  room.enemySpawns = [{ kind, at }];
  spawnRoomContent(state, room);
  const enemy = Object.values(state.enemies)[0];
  if (!enemy) throw new Error('Ennemi non spawné');
  return { state, enemy };
}

describe('updateAi — détection', () => {
  it('hors de portée : l’ennemi patrouille sans approcher le joueur', () => {
    // Joueur au centre (400, 300) ; raptor à 320 px > aggro 260.
    const { state, enemy } = runWithEnemy('raptor', { x: 700, y: 500 });

    updateAi(state, TICK_MS);
    expect(enemy.ai.phase).toBe('patrol');

    const before = { ...enemy.pos };
    for (let i = 0; i < 30; i += 1) updateAi(state, TICK_MS);
    // Il bouge (patrouille) mais n'a pas verrouillé le joueur.
    expect(enemy.pos).not.toEqual(before);
    expect(enemy.ai.phase).toBe('patrol');
    expect(state.player.health.current).toBe(state.player.health.max);
  });

  it('à portée et à vue : l’ennemi chasse et se rapproche', () => {
    const { state, enemy } = runWithEnemy('raptor', { x: 600, y: 300 });
    const startDistance = Math.hypot(600 - 400, 0);

    for (let i = 0; i < 30; i += 1) updateAi(state, TICK_MS);

    const distance = Math.hypot(enemy.pos.x - 400, enemy.pos.y - 300);
    expect(['chase', 'attack']).toContain(enemy.ai.phase);
    expect(distance).toBeLessThan(startDistance);
    expect(enemy.ai.lastKnownTarget).toEqual(state.player.pos);
  });

  it('un obstacle bloque la ligne de vue', () => {
    // Le pilier (340-460, 200-228) coupe le segment (400,150) → (400,300).
    const { state, enemy } = runWithEnemy('raptor', { x: 400, y: 150 });

    updateAi(state, TICK_MS);

    expect(enemy.ai.phase).not.toBe('chase');
    expect(enemy.ai.phase).not.toBe('attack');
    expect(enemy.ai.lastKnownTarget).toBeUndefined();
  });
});

describe('updateAi — meute', () => {
  /** Deux raptors spawnés ensemble : même salle, même meute. */
  function runWithPack(a: Vec2, b: Vec2): { state: RunState; raptors: Enemy[] } {
    const state = createDebugRun(3);
    const room = state.floor.rooms[state.floor.currentRoomId];
    if (!room) throw new Error('Salle de debug manquante');
    room.spawned = false;
    room.enemySpawns = [
      { kind: 'raptor', at: a },
      { kind: 'raptor', at: b },
    ];
    spawnRoomContent(state, room);
    return { state, raptors: Object.values(state.enemies) };
  }

  it('alerte toute la meute quand un seul membre voit le joueur', () => {
    // A voit le joueur ; B est derrière le pilier (ligne de vue coupée),
    // le scénario où un raptor isolé resterait en patrouille.
    const { state, raptors } = runWithPack({ x: 600, y: 300 }, { x: 400, y: 150 });
    const blind = raptors.find((raptor) => raptor.pos.y === 150);
    if (!blind) throw new Error('Raptor aveugle manquant');

    updateAi(state, TICK_MS);

    expect(blind.ai.phase).toBe('chase');
    expect(blind.ai.lastKnownTarget).toEqual(state.player.pos);
  });

  it('la meute se déploie en éventail au lieu de foncer en colonne', () => {
    // Deux raptors presque côte à côte, à l'est du joueur, à vue.
    const { state, raptors } = runWithPack({ x: 650, y: 290 }, { x: 650, y: 310 });
    const initialSpread = 20;

    for (let i = 0; i < 30; i += 1) updateAi(state, TICK_MS);

    const [a, b] = raptors;
    if (!a || !b) throw new Error('Meute incomplète');
    const spread = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
    // L'encerclement écarte les membres (cibles à ~120 px l'une de l'autre).
    expect(spread).toBeGreaterThan(initialSpread + 40);
    expect(['chase', 'attack']).toContain(a.ai.phase);
    expect(['chase', 'attack']).toContain(b.ai.phase);
  });
});

describe('updateAi — attaque', () => {
  const archetype = ENEMY_ARCHETYPES.raptor;

  it('blesse le joueur au contact, sous cooldown', () => {
    // Contact : rayon raptor 14 + rayon joueur 12 + portée 6 = 32 ≥ 30.
    const { state, enemy } = runWithEnemy('raptor', { x: 430, y: 300 });
    const maxHealth = state.player.health.max;

    updateAi(state, TICK_MS);
    expect(enemy.ai.phase).toBe('attack');
    expect(state.player.health.current).toBe(maxHealth - archetype.attackDamage);

    // Cooldown actif : pas de second coup immédiat.
    updateAi(state, TICK_MS);
    expect(state.player.health.current).toBe(maxHealth - archetype.attackDamage);

    // Cooldown écoulé : nouveau coup.
    updateAi(state, archetype.attackCooldownMs);
    expect(state.player.health.current).toBe(maxHealth - 2 * archetype.attackDamage);
  });

  it('tue le joueur et termine la run', () => {
    const { state } = runWithEnemy('raptor', { x: 430, y: 300 });
    state.player.health.current = archetype.attackDamage;

    updateAi(state, TICK_MS);

    expect(state.player.health.current).toBe(0);
    expect(state.status).toBe('dead');
  });
});
