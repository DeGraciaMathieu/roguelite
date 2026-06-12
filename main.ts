/**
 * Composition root : câble input → boucle → systèmes → rendu → méta.
 * Seul endroit où les couches se connaissent entre elles.
 */

import type { RunState } from '@/domain';
import { createPhaseMachine } from '@/core/game';
import { createGameLoop } from '@/core/loop';
import { createMetaStorage } from '@/core/metaStorage';
import { createInputCapture } from '@/input/capture';
import type { InputCapture } from '@/input/capture';
import { createHud } from '@/render/hud';
import { createHubScreen } from '@/render/hub';
import { createGameOverlay } from '@/render/overlay';
import { createRenderer } from '@/render/renderer';
import type { Renderer } from '@/render/renderer';
import { HANDGUN_ID } from '@/data/weapons';
import { updateAi } from '@/systems/ai';
import { updateCombat, updateProjectiles } from '@/systems/combat';
import { updateConsumables } from '@/systems/consumables';
import { updateDoorTransition } from '@/systems/doors';
import { updateLootPickup } from '@/systems/loot';
import { applyRunRewards, purchaseUnlock } from '@/systems/meta';
import { updateMovement } from '@/systems/movement';
import { createRun } from '@/systems/run';
import { updateStairs } from '@/systems/stairs';
import { updateStatus } from '@/systems/status';

/** Seed rejouable via `?seed=123` ; aléatoire sinon. */
function resolveSeed(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  if (raw !== null) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed >>> 0;
  }
  return Date.now() >>> 0;
}

interface Session {
  state: RunState;
  renderer: Renderer;
  input: InputCapture;
}

async function boot(): Promise<void> {
  const appElement = document.querySelector('#app');
  if (!appElement) throw new Error('Élément #app introuvable');
  const container: Element = appElement;

  const metaStorage = createMetaStorage(window.localStorage, HANDGUN_ID);
  let meta = metaStorage.load();

  const overlay = createGameOverlay();
  const hub = createHubScreen();
  const hud = createHud();
  const phase = createPhaseMachine('hub');
  let session: Session | null = null;
  // La seed d'URL ne vaut que pour la première run ; ensuite, nouvelle seed.
  let pendingSeed: number | null = resolveSeed();

  async function startRun(seed: number): Promise<void> {
    if (session) {
      session.renderer.dispose();
      session.input.dispose();
    }
    overlay.setSeed(seed);
    history.replaceState(null, '', `?seed=${seed}`);

    const state = createRun(seed);
    const renderer = await createRenderer(state);
    container.appendChild(renderer.canvas);
    session = { state, renderer, input: createInputCapture(renderer.canvas) };
  }

  function showHub(): void {
    hub.show(meta, {
      onStartRun: (): void => {
        hub.hide();
        phase.transitionTo('run');
        const seed = pendingSeed ?? (Date.now() >>> 0);
        pendingSeed = null;
        void startRun(seed);
      },
      onPurchase: (def): void => {
        const updated = purchaseUnlock(meta, def);
        if (!updated) return;
        meta = updated;
        metaStorage.save(meta);
        showHub();
      },
    });
  }

  showHub();

  const loop = createGameLoop({
    update(dtMs: number): void {
      if (!session || phase.phase !== 'run') return;
      const { state, renderer, input } = session;

      renderer.snapshot(state);
      const intent = input.intent(renderer.screenToWorld);
      updateMovement(state, intent, dtMs);
      updateDoorTransition(state);
      updateStairs(state);
      updateLootPickup(state);
      updateConsumables(state, intent);
      updateAi(state, dtMs);
      updateStatus(state, dtMs);
      updateCombat(state, intent);
      updateProjectiles(state, dtMs);
      state.elapsedMs += dtMs;

      if (state.status !== 'active') {
        meta = applyRunRewards(meta, state.stats, state.status);
        metaStorage.save(meta);
        phase.transitionTo('gameover');
        overlay.showRunEnd(state.stats, state.seed, state.status, () => {
          overlay.hideRunEnd();
          phase.transitionTo('hub');
          showHub();
        });
      }
    },
    render(alpha: number): void {
      if (!session) return;
      session.renderer.render(session.state, alpha);
      if (phase.phase === 'run') {
        hud.update(session.state);
      } else {
        hud.hide();
      }
    },
  });

  loop.start();
}

void boot();
