/**
 * Politiques d'agent scriptées : le pendant headless de input/capture.
 * L'agent lit le RunState et émet un PlayerIntent par tick ; il ne mute
 * jamais l'état (les systèmes s'en chargent) et ne tire aucun aléa : chaque
 * décision est une fonction déterministe de l'état observé (information
 * complète : l'agent voit toute la salle courante, pas de vision limitée).
 */

import type { Door, Enemy, LootSpawn, Rect, Room, RoomId, RunState, Vec2 } from '@/domain';
import type { PlayerIntent } from '@/input/intent';
import { EXTRACTION_MIN_FLOOR, LOOT_PICKUP_RADIUS } from '@/data/balance';
import { getConsumableDef } from '@/data/consumables';
import { getWeaponDef } from '@/data/weapons';
import { pointInRect, segmentIntersectsRect } from '@/systems/collision';
import { consumableCount } from '@/systems/loot';
import { currentRoom } from '@/systems/movement';
import { extractionAvailable, extractionZone, stairZone } from '@/systems/stairs';
import { isBleeding } from '@/systems/status';
import { ARRIVAL_RADIUS, NAV_CELL, buildRoomNav } from './pathfind';
import type { RoomNav } from './pathfind';
import type { HeadlessAgent } from './pilot';

// --- Profils -------------------------------------------------------------------

export type PolicyId = 'cautious' | 'aggressive';

/** Une politique est un jeu de paramètres ; le cerveau est commun. */
export interface PolicyProfile {
  id: PolicyId;
  /** Ratio de vie sous lequel l'agent consomme un soin. */
  healAtRatio: number;
  /** Bande de distance de combat : kite en deçà de min, avance au-delà de max. */
  engageRange: { min: number; max: number };
  /** Ennemi plus près que ça → dash de désengagement (s'il est disponible). */
  panicRange: number;
  /** Visite toutes les salles (nettoyage + loot) avant de viser la sortie. */
  sweepFloor: boolean;
  /** Étage (0-based) à partir duquel l'agent prend l'extraction plutôt que l'escalier. */
  extractAtFloor: number;
}

/** Prudente : garde ses distances, soigne tôt, file vers la sortie, extrait dès que possible. */
export const CAUTIOUS_PROFILE: PolicyProfile = {
  id: 'cautious',
  healAtRatio: 0.65,
  engageRange: { min: 170, max: 300 },
  panicRange: 90,
  sweepFloor: false,
  extractAtFloor: EXTRACTION_MIN_FLOOR,
};

/** Agressive : nettoie chaque étage à courte portée, soigne tard, descend profond. */
export const AGGRESSIVE_PROFILE: PolicyProfile = {
  id: 'aggressive',
  healAtRatio: 0.3,
  engageRange: { min: 70, max: 180 },
  panicRange: 40,
  sweepFloor: true,
  extractAtFloor: 6,
};

// --- Lecture de l'état -----------------------------------------------------------

function enemiesInRoom(state: RunState, room: Room): Enemy[] {
  return Object.values(state.enemies).filter((enemy) => pointInRect(enemy.pos, room.bounds));
}

/**
 * Cible la plus proche *actionnable* : visible (on peut la tirer sur place) ou
 * joignable à pied. Un ennemi niché derrière une fosse sans ligne de vue est
 * ignoré plutôt que de tourner autour indéfiniment.
 */
function nearestActionableEnemy(state: RunState, room: Room, nav: RoomNav): Enemy | null {
  const from = state.player.pos;
  let best: Enemy | null = null;
  let bestDist = Infinity;
  for (const enemy of enemiesInRoom(state, room)) {
    const dist = Math.hypot(enemy.pos.x - from.x, enemy.pos.y - from.y);
    if (dist >= bestDist) continue;
    if (!hasLineOfSight(from, enemy.pos, room) && !nav.reachable(enemy.pos)) continue;
    best = enemy;
    bestDist = dist;
  }
  return best;
}

/** Même règle que l'IA : les obstacles coupent la vue, pas les fosses. */
function hasLineOfSight(from: Vec2, to: Vec2, room: Room): boolean {
  return !room.obstacles.some((obstacle) => segmentIntersectsRect(from, to, obstacle));
}

function totalAmmo(state: RunState, weaponIndex: number): number {
  const weapon = state.inventory.weapons[weaponIndex];
  if (!weapon) return 0;
  return weapon.ammoInMag + state.inventory.ammo[getWeaponDef(weapon.defId).ammo];
}

function canFight(state: RunState): boolean {
  return state.inventory.weapons.some((_, index) => totalAmmo(state, index) > 0);
}

/** Ne change d'arme que pour ne pas rester à sec (chargeur + réserve vides). */
function desiredWeaponSlot(state: RunState): number | null {
  if (totalAmmo(state, state.inventory.equippedIndex) > 0) return null;
  const index = state.inventory.weapons.findIndex((_, i) => totalAmmo(state, i) > 0);
  return index >= 0 ? index : null;
}

function wantsConsumable(state: RunState, profile: PolicyProfile): boolean {
  const player = state.player;
  const carries = (pred: (effect: ReturnType<typeof getConsumableDef>['effect']) => boolean): boolean =>
    state.inventory.consumables.some((stack) => pred(getConsumableDef(stack.defId).effect));

  if (isBleeding(player) && carries((effect) => effect.kind === 'cure')) return true;
  const ratio = player.health.current / player.health.max;
  return ratio < profile.healAtRatio && carries((effect) => effect.kind === 'heal');
}

// --- Loot ------------------------------------------------------------------------

/**
 * Reflète les règles d'updateLootPickup : viser un objet que le ramassage
 * laisserait au sol (arme sans système, inventaire plein) bouclerait à vide.
 */
function isCollectible(state: RunState, spawn: LootSpawn): boolean {
  switch (spawn.kind) {
    case 'ammo':
      return state.inventory.weapons.some(
        (weapon) => getWeaponDef(weapon.defId).ammo === spawn.ammo,
      );
    case 'consumable':
      return consumableCount(state.inventory) < state.inventory.capacity;
    case 'relic':
    case 'key':
      return true;
    case 'weapon':
      return false;
  }
}

/** Clé stable d'un loot au sol (les spawns ne bougent pas). */
function lootKey(room: Room, spawn: LootSpawn): string {
  return `${room.id}:${spawn.at.x},${spawn.at.y}`;
}

function nearestCollectibleLoot(
  state: RunState,
  room: Room,
  nav: RoomNav,
  abandoned: ReadonlySet<string>,
): LootSpawn | null {
  let best: LootSpawn | null = null;
  let bestDist = Infinity;
  // Il faut pouvoir se *poster* à portée de ramassage : un loot dont le
  // meilleur poste praticable est plus loin (collé à une dalle de fin
  // d'étage, niché derrière une fosse) est ignoré d'emblée.
  const standoff = state.player.radius + LOOT_PICKUP_RADIUS - ARRIVAL_RADIUS;
  for (const spawn of room.lootSpawns) {
    if (!isCollectible(state, spawn) || abandoned.has(lootKey(room, spawn))) continue;
    if (!nav.reachable(spawn.at, standoff)) continue;
    const dist = Math.hypot(spawn.at.x - state.player.pos.x, spawn.at.y - state.player.pos.y);
    if (dist < bestDist) {
      best = spawn;
      bestDist = dist;
    }
  }
  return best;
}

// --- Navigation entre salles -------------------------------------------------------

interface NavStep {
  dist: number;
  /** Porte à franchir depuis la salle courante pour aller vers cette salle. */
  firstDoorAt: Vec2 | null;
}

/** Même règle que updateDoorTransition : verrouillée = franchissable avec la clé portée. */
function isPassable(state: RunState, door: Door): boolean {
  if (!door.locked) return true;
  return door.keyItemId !== null && state.inventory.keyItems.includes(door.keyItemId);
}

/** BFS sur le graphe des portes ; l'ordre de parcours suit les données, donc déterministe. */
function reachableRooms(state: RunState, fromId: RoomId): Map<RoomId, NavStep> {
  const steps = new Map<RoomId, NavStep>([[fromId, { dist: 0, firstDoorAt: null }]]);
  const queue: RoomId[] = [fromId];
  while (queue.length > 0) {
    const roomId = queue.shift();
    if (roomId === undefined) break;
    const room = state.floor.rooms[roomId];
    const step = steps.get(roomId);
    if (!room || !step) continue;
    for (const doorId of room.doorIds) {
      const door = state.floor.doors[doorId];
      if (!door || !isPassable(state, door)) continue;
      const nextId = door.roomA === roomId ? door.roomB : door.roomA;
      if (steps.has(nextId)) continue;
      steps.set(nextId, { dist: step.dist + 1, firstDoorAt: step.firstDoorAt ?? door.at });
      queue.push(nextId);
    }
  }
  return steps;
}

/** Salle jamais visitée (contenu inconnu) ou contenant encore du loot prenable. */
function needsVisit(state: RunState, room: Room): boolean {
  return !room.spawned || room.lootSpawns.some((spawn) => isCollectible(state, spawn));
}

function pickTargetRoom(
  state: RunState,
  profile: PolicyProfile,
  graph: Map<RoomId, NavStep>,
  sweptRooms: ReadonlySet<RoomId>,
): RoomId | null {
  const floor = state.floor;
  const candidates = (keep: (room: Room) => boolean): Room[] =>
    Object.values(floor.rooms)
      .filter((room) => room.id !== floor.currentRoomId && graph.has(room.id) && keep(room))
      .sort((a, b) => {
        const distA = graph.get(a.id)?.dist ?? Infinity;
        const distB = graph.get(b.id)?.dist ?? Infinity;
        if (distA !== distB) return distA - distB;
        return a.id < b.id ? -1 : 1;
      });

  if (profile.sweepFloor) {
    const pending = candidates((room) => !sweptRooms.has(room.id) && needsVisit(state, room));
    if (pending[0]) return pending[0].id;
  }
  if (graph.has(floor.exitRoomId)) return floor.exitRoomId;
  // Sortie injoignable (porte verrouillée) : viser une salle contenant une clé.
  const keyRooms = candidates((room) => room.lootSpawns.some((spawn) => spawn.kind === 'key'));
  return keyRooms[0]?.id ?? null;
}

interface Destination {
  point: Vec2;
  /** Renseigné quand la destination est un loot : permet d'y renoncer s'il est hors d'atteinte. */
  lootKey: string | null;
}

/** Point à rejoindre quand la salle courante ne demande plus de combat. */
function destinationFor(
  state: RunState,
  profile: PolicyProfile,
  nav: RoomNav,
  sweptRooms: ReadonlySet<RoomId>,
  abandonedLoot: ReadonlySet<string>,
): Destination | null {
  const room = currentRoom(state);
  const loot = nearestCollectibleLoot(state, room, nav, abandonedLoot);
  if (loot) return { point: loot.at, lootKey: lootKey(room, loot) };

  const graph = reachableRooms(state, room.id);
  const targetId = pickTargetRoom(state, profile, graph, sweptRooms);
  if (targetId === null) return null;

  if (targetId === room.id) {
    if (room.kind !== 'exit') return null;
    const extract = extractionAvailable(state.floor) && state.floor.index >= profile.extractAtFloor;
    const zone = extract ? extractionZone(room) : stairZone(room);
    return { point: { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 }, lootKey: null };
  }
  const doorAt = graph.get(targetId)?.firstDoorAt;
  return doorAt ? { point: doorAt, lootKey: null } : null;
}

// --- Déplacement -------------------------------------------------------------------

function directionTo(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

/** Sous ce progrès par tick (px), on considère que l'agent n'avance plus. */
const STUCK_EPSILON = 0.4;
/** ~0,5 s de poussée sans progrès avant de tenter un pas de côté. */
const STUCK_TRIGGER_TICKS = 30;
/** Durée de base du pas de côté (~0,4 s), doublée à chaque blocage consécutif. */
const SIDESTEP_BASE_TICKS = 24;
/** Plafond d'escalade : 24 << 4 ≈ 6,4 s de pas de côté, assez pour toute cloison. */
const MAX_ESCAPE_LEVEL = 4;
/** Se rapprocher d'autant de l'objectif depuis le dernier blocage réarme l'escalade. */
const ESCAPE_RESET_PROGRESS = 40;

interface NavMemory {
  lastPos: Vec2;
  stuckTicks: number;
  sidestepTicksLeft: number;
  /** Direction du pas de côté, figée au déclenchement. */
  sidestepDir: Vec2;
  escapeLevel: number;
  /** Distance à l'objectif au dernier déclenchement (ratchet de progrès). */
  goalDistAtTrigger: number;
}

/**
 * Anti-blocage : coincé contre un coin d'obstacle ou une fosse, l'agent décale
 * sa poussée latéralement. Trois règles tirées des cas pathologiques observés :
 * la direction est figée au déclenchement (recalculée chaque tick, elle ferait
 * orbiter l'agent autour d'une cible inaccessible) ; la durée double à chaque
 * blocage consécutif et le côté alterne par niveau (balayage exponentiel des
 * deux côtés, contourne les cloisons longues) ; l'escalade ne se réarme que
 * sur progrès réel vers l'objectif (pas sur simple déplacement latéral).
 * Purement compté, donc déterministe.
 */
function applyStuckEscape(memory: NavMemory, pos: Vec2, intent: PlayerIntent): void {
  const moving = intent.move.x !== 0 || intent.move.y !== 0;
  const progressed = Math.hypot(pos.x - memory.lastPos.x, pos.y - memory.lastPos.y) > STUCK_EPSILON;
  memory.lastPos = { x: pos.x, y: pos.y };

  if (!moving) {
    memory.stuckTicks = 0;
    memory.sidestepTicksLeft = 0;
    return;
  }

  const goalDist = Math.hypot(intent.aimWorld.x - pos.x, intent.aimWorld.y - pos.y);
  if (goalDist < memory.goalDistAtTrigger - ESCAPE_RESET_PROGRESS) {
    memory.escapeLevel = 0;
    memory.goalDistAtTrigger = goalDist;
  }

  if (memory.sidestepTicksLeft > 0) {
    memory.sidestepTicksLeft -= 1;
    intent.move = { x: memory.sidestepDir.x, y: memory.sidestepDir.y };
    return;
  }

  memory.stuckTicks = progressed ? 0 : memory.stuckTicks + 1;
  if (memory.stuckTicks >= STUCK_TRIGGER_TICKS) {
    memory.stuckTicks = 0;
    const sign = memory.escapeLevel % 2 === 0 ? 1 : -1;
    memory.sidestepDir = { x: -intent.move.y * sign, y: intent.move.x * sign };
    memory.sidestepTicksLeft = SIDESTEP_BASE_TICKS << Math.min(memory.escapeLevel, MAX_ESCAPE_LEVEL);
    memory.escapeLevel += 1;
    memory.goalDistAtTrigger = Math.min(memory.goalDistAtTrigger, goalDist);
    intent.move = { x: memory.sidestepDir.x, y: memory.sidestepDir.y };
  }
}

// --- Cerveau -------------------------------------------------------------------------

export function createPolicyAgent(profile: PolicyProfile): HeadlessAgent {
  const memory: NavMemory = {
    lastPos: { x: Number.NaN, y: Number.NaN },
    stuckTicks: 0,
    sidestepTicksLeft: 0,
    sidestepDir: { x: 0, y: 0 },
    escapeLevel: 0,
    goalDistAtTrigger: Number.POSITIVE_INFINITY,
  };

  // Salles déjà balayées (rien d'actionnable dedans) : évite qu'un sweep
  // re-cible sans fin une salle au loot injoignable. Réinitialisé par étage.
  const sweptRooms = new Set<RoomId>();
  // Loot auquel on a renoncé : atteignable au mieux hors du rayon de ramassage
  // (ex. relique collée à une dalle de fin d'étage). Réinitialisé par étage.
  const abandonedLoot = new Set<string>();
  let sweptFloorIndex = -1;

  // Le flood de navigation ne dépend que de la salle et de la cellule du
  // joueur : on le recalcule seulement quand l'une des deux change.
  let cachedNav: RoomNav | null = null;
  let cachedRoomId: RoomId | null = null;
  let cachedCell = -1;

  /**
   * Dalle de fin d'étage à ne pas traverser : les deux dalles sont voisines,
   * marcher vers l'une en coupant l'autre déclencherait l'effet non voulu
   * (descente accidentelle en allant s'extraire, et inversement).
   */
  function forbiddenZones(state: RunState, room: Room): readonly Rect[] {
    if (room.kind !== 'exit') return [];
    const wantsExtract =
      extractionAvailable(state.floor) && state.floor.index >= profile.extractAtFloor;
    if (wantsExtract) return [stairZone(room)];
    return extractionAvailable(state.floor) ? [extractionZone(room)] : [];
  }

  function navFor(state: RunState, room: Room): RoomNav {
    const col = Math.floor((state.player.pos.x - room.bounds.x) / NAV_CELL);
    const row = Math.floor((state.player.pos.y - room.bounds.y) / NAV_CELL);
    const cell = row * 1000 + col;
    if (!cachedNav || cachedRoomId !== room.id || cachedCell !== cell) {
      cachedNav = buildRoomNav(room, state.player.pos, state.player.radius, forbiddenZones(state, room));
      cachedRoomId = room.id;
      cachedCell = cell;
    }
    return cachedNav;
  }

  return (state: RunState): PlayerIntent => {
    const player = state.player;
    const room = currentRoom(state);
    const nav = navFor(state, room);

    if (sweptFloorIndex !== state.floor.index) {
      sweptRooms.clear();
      abandonedLoot.clear();
      sweptFloorIndex = state.floor.index;
    }

    const target = nearestActionableEnemy(state, room, nav);

    const intent: PlayerIntent = {
      move: { x: 0, y: 0 },
      aimWorld: { x: player.pos.x, y: player.pos.y },
      fire: false,
      reload: false,
      useConsumable: wantsConsumable(state, profile),
      dash: false,
      weaponSlot: desiredWeaponSlot(state),
    };

    if (target && canFight(state)) {
      // Engagement : tenir la bande de distance du profil, tirer à vue.
      intent.aimWorld = { x: target.pos.x, y: target.pos.y };
      const dist = Math.hypot(target.pos.x - player.pos.x, target.pos.y - player.pos.y);
      const los = hasLineOfSight(player.pos, target.pos, room);
      intent.fire = los;
      if (!los) {
        intent.move = nav.stepToward(player.pos, target.pos) ?? directionTo(player.pos, target.pos);
      } else if (dist < profile.engageRange.min) {
        intent.move = directionTo(target.pos, player.pos);
      } else if (dist > profile.engageRange.max) {
        intent.move = nav.stepToward(player.pos, target.pos) ?? directionTo(player.pos, target.pos);
      }
    } else {
      // Salle sûre (ou plus de munitions : on fuit) : recharge et navigation.
      const weapon = state.inventory.weapons[state.inventory.equippedIndex];
      if (weapon) {
        const def = getWeaponDef(weapon.defId);
        intent.reload = weapon.ammoInMag < def.magazineSize && state.inventory.ammo[def.ammo] > 0;
      }
      if (!target && nearestCollectibleLoot(state, room, nav, abandonedLoot) === null) {
        sweptRooms.add(room.id);
      }
      const dest = destinationFor(state, profile, nav, sweptRooms, abandonedLoot);
      if (dest) {
        const step = nav.stepToward(player.pos, dest.point);
        const distToDest = Math.hypot(dest.point.x - player.pos.x, dest.point.y - player.pos.y);
        if (step === null && dest.lootKey !== null && distToDest > player.radius + LOOT_PICKUP_RADIUS) {
          // Au mieux du chemin praticable et toujours hors de portée de
          // ramassage : on renonce (loot collé à une dalle, niché, etc.).
          abandonedLoot.add(dest.lootKey);
        } else {
          intent.move = step ?? directionTo(player.pos, dest.point);
          intent.aimWorld = dest.point;
        }
      }
    }

    // Dash de désengagement quand un ennemi colle, qu'on se batte ou qu'on fuie.
    if (target) {
      const dist = Math.hypot(target.pos.x - player.pos.x, target.pos.y - player.pos.y);
      if (
        dist < profile.panicRange &&
        player.dash.remainingMs <= 0 &&
        player.dash.cooldownMs <= 0 &&
        (intent.move.x !== 0 || intent.move.y !== 0)
      ) {
        intent.dash = true;
      }
    }

    applyStuckEscape(memory, player.pos, intent);
    return intent;
  };
}
