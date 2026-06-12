/**
 * Système de mouvement du joueur : intention → vitesse → position, résolue
 * contre les murs et obstacles de la salle courante (glissement le long des
 * parois). Mutation contrôlée du RunState ; aucune dépendance au rendu.
 */

import type { Room, RunState } from '@/domain';
import type { PlayerIntent } from '@/input/intent';
import { DASH_COOLDOWN_MS, DASH_DURATION_MS, DASH_SPEED, PLAYER_MOVE_SPEED } from '@/data/balance';
import { moveCircle, wallRects } from './collision';

export function currentRoom(state: RunState): Room {
  const room = state.floor.rooms[state.floor.currentRoomId];
  if (!room) throw new Error(`Salle courante introuvable : ${state.floor.currentRoomId}`);
  return room;
}

export function updateMovement(state: RunState, intent: PlayerIntent, dtMs: number): void {
  const player = state.player;
  const dash = player.dash;
  const dtSec = dtMs / 1000;

  // Le cooldown court depuis le déclenchement (dash compris).
  dash.cooldownMs = Math.max(0, dash.cooldownMs - dtMs);

  // Déclenchement : direction figée — celle du déplacement, sinon la visée.
  if (intent.dash && dash.remainingMs <= 0 && dash.cooldownMs === 0) {
    const moving = Math.hypot(intent.move.x, intent.move.y) > 1e-6;
    dash.dir = moving
      ? { x: intent.move.x, y: intent.move.y }
      : { x: Math.cos(player.aim), y: Math.sin(player.aim) };
    dash.remainingMs = DASH_DURATION_MS;
    dash.cooldownMs = DASH_COOLDOWN_MS;
  }

  // Pendant le dash, les entrées de direction sont ignorées : c'est un
  // engagement, pas un boost de vitesse pilotable.
  const dashing = dash.remainingMs > 0;
  if (dashing) dash.remainingMs = Math.max(0, dash.remainingMs - dtMs);

  player.vel.x = (dashing ? dash.dir.x : intent.move.x) * (dashing ? DASH_SPEED : PLAYER_MOVE_SPEED);
  player.vel.y = (dashing ? dash.dir.y : intent.move.y) * (dashing ? DASH_SPEED : PLAYER_MOVE_SPEED);

  const room = currentRoom(state);
  // Les fosses bloquent le corps comme les obstacles (mais pas les tirs).
  const solids = [...wallRects(room.bounds), ...room.obstacles, ...room.pits];
  player.pos = moveCircle(
    player.pos,
    player.radius,
    { x: player.vel.x * dtSec, y: player.vel.y * dtSec },
    solids,
  );

  player.aim = Math.atan2(intent.aimWorld.y - player.pos.y, intent.aimWorld.x - player.pos.x);
}
