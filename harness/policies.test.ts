import { describe, expect, it } from 'vitest';
import { asId } from '@/domain';
import type { EntityId, Raptor, RunState, Vec2 } from '@/domain';
import { createDebugRun } from '@/data/debugRoom';
import { MEDKIT_ID } from '@/data/consumables';
import { createRun } from '@/systems/run';
import { runHeadless } from './pilot';
import { AGGRESSIVE_PROFILE, CAUTIOUS_PROFILE, createPolicyAgent } from './policies';

function spawnRaptor(state: RunState, at: Vec2): Raptor {
  const raptor: Raptor = {
    kind: 'raptor',
    packId: null,
    id: asId<'EntityId'>('test-raptor') as EntityId,
    pos: { ...at },
    vel: { x: 0, y: 0 },
    facing: 0,
    radius: 14,
    health: { current: 30, max: 30 },
    ai: { phase: 'idle', attackCooldownMs: 0, patrolIndex: 0 },
    patrolPath: [],
  };
  state.enemies[raptor.id] = raptor;
  return raptor;
}

/** Place un raptor à `dist` px à droite du joueur (ligne de vue dégagée en salle debug). */
function debugRunWithRaptorAt(dist: number): RunState {
  const state = createDebugRun(42);
  spawnRaptor(state, { x: state.player.pos.x + dist, y: state.player.pos.y });
  return state;
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

describe('createPolicyAgent — comportement par tick', () => {
  it('tire sur l’ennemi à vue et tient la distance dans la bande d’engagement', () => {
    const state = debugRunWithRaptorAt(200); // dans [170, 300] (prudente)
    const intent = createPolicyAgent(CAUTIOUS_PROFILE)(state, 0);

    expect(intent.fire).toBe(true);
    expect(intent.aimWorld).toEqual({ x: state.player.pos.x + 200, y: state.player.pos.y });
    expect(intent.move).toEqual({ x: 0, y: 0 });
  });

  it('kite quand l’ennemi est sous la distance minimale', () => {
    const state = debugRunWithRaptorAt(80); // sous 170 (prudente)
    const intent = createPolicyAgent(CAUTIOUS_PROFILE)(state, 0);

    const towardEnemy = { x: 1, y: 0 };
    expect(intent.fire).toBe(true);
    expect(dot(intent.move, towardEnemy)).toBeLessThan(0);
    // 80 < panicRange (90) et dash disponible : désengagement.
    expect(intent.dash).toBe(true);
  });

  it('avance sur l’ennemi au-delà de la bande (agressive)', () => {
    const state = debugRunWithRaptorAt(300); // au-delà de 180 (agressive)
    const intent = createPolicyAgent(AGGRESSIVE_PROFILE)(state, 0);

    expect(intent.fire).toBe(true);
    expect(dot(intent.move, { x: 1, y: 0 })).toBeGreaterThan(0);
  });

  it('soigne sous le seuil du profil — la prudente avant l’agressive', () => {
    const state = createDebugRun(42);
    state.player.health.current = 50; // ratio 0,5
    state.inventory.consumables.push({ defId: MEDKIT_ID, count: 1 });

    expect(createPolicyAgent(CAUTIOUS_PROFILE)(state, 0).useConsumable).toBe(true); // 0,5 < 0,65
    expect(createPolicyAgent(AGGRESSIVE_PROFILE)(state, 0).useConsumable).toBe(false); // 0,5 > 0,3
  });

  it('change d’arme uniquement à sec (chargeur + réserve vides)', () => {
    const state = createDebugRun(42);
    const handgun = state.inventory.weapons[0];
    if (!handgun) throw new Error('Handgun manquant');
    handgun.ammoInMag = 0;
    state.inventory.ammo.handgun = 0;

    const intent = createPolicyAgent(CAUTIOUS_PROFILE)(state, 0);
    expect(intent.weaponSlot).toBe(1); // shotgun, premier slot approvisionné
  });

  it('recharge tactiquement quand la salle est sûre', () => {
    const state = createDebugRun(42);
    const handgun = state.inventory.weapons[0];
    if (!handgun) throw new Error('Handgun manquant');
    handgun.ammoInMag = 3;

    expect(createPolicyAgent(CAUTIOUS_PROFILE)(state, 0).reload).toBe(true);
  });

  it('navigue dès le premier tick d’une vraie run (salle de départ sûre)', () => {
    const state = createRun(1);
    const intent = createPolicyAgent(CAUTIOUS_PROFILE)(state, 0);

    expect(Math.hypot(intent.move.x, intent.move.y)).toBeGreaterThan(0);
  });
});

describe('createPolicyAgent — runs headless complètes', () => {
  it('est déterministe : même seed + même politique → même run au tick près', () => {
    const a = runHeadless(1337, createPolicyAgent(CAUTIOUS_PROFILE), { maxTicks: 60_000 });
    const b = runHeadless(1337, createPolicyAgent(CAUTIOUS_PROFILE), { maxTicks: 60_000 });

    // `startedAtMs` vient de Date.now() : on le neutralise avant comparaison.
    a.finalState.stats.startedAtMs = 0;
    b.finalState.stats.startedAtMs = 0;

    expect(a.ticks).toBe(b.ticks);
    expect(a.status).toBe(b.status);
    expect(a.finalState).toEqual(b.finalState);
  });

  it('les deux politiques produisent des runs distinctes à seed égale', () => {
    const cautious = runHeadless(1337, createPolicyAgent(CAUTIOUS_PROFILE), { maxTicks: 60_000 });
    const aggressive = runHeadless(1337, createPolicyAgent(AGGRESSIVE_PROFILE), {
      maxTicks: 60_000,
    });

    expect(
      cautious.ticks !== aggressive.ticks ||
        cautious.stats.kills !== aggressive.stats.kills ||
        cautious.status !== aggressive.status,
    ).toBe(true);
  });

  it('la prudente extrait au premier étage possible', () => {
    const outcome = runHeadless(1, createPolicyAgent(CAUTIOUS_PROFILE), { maxTicks: 60_000 });

    expect(outcome.status).toBe('extracted');
    expect(outcome.stats.deepestFloor).toBe(1);
  });

  it('l’agressive descend plus profond et tue plus que la prudente', () => {
    const cautious = runHeadless(1, createPolicyAgent(CAUTIOUS_PROFILE), { maxTicks: 60_000 });
    const aggressive = runHeadless(1, createPolicyAgent(AGGRESSIVE_PROFILE), {
      maxTicks: 60_000,
    });

    // Les deux runs se terminent d'elles-mêmes (pas de livelock).
    expect(cautious.status).not.toBe('tick-cap');
    expect(aggressive.status).not.toBe('tick-cap');
    expect(aggressive.stats.deepestFloor).toBeGreaterThan(cautious.stats.deepestFloor);
    expect(aggressive.stats.kills).toBeGreaterThan(cautious.stats.kills);
  });
});
