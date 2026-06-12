/**
 * Génération procédurale d'un étage : random walk avec embranchements sur une
 * grille de salles uniformes (deux voisines partagent un mur, la porte est au
 * milieu de l'arête commune). Déterministe : tout l'aléa vient d'un RngState
 * créé depuis la seed d'étage, jamais de Math.random. Aucune dépendance au rendu.
 */

import { asId, createRng, nextFloat, nextInt, pick } from '@/domain';
import type {
  Door,
  DoorId,
  EnemySpawn,
  Floor,
  LootSpawn,
  Rect,
  RngState,
  Room,
  RoomId,
  RoomKind,
  Vec2,
} from '@/domain';
import { WALL_THICKNESS } from '@/data/balance';
import { MEDKIT_ID } from '@/data/consumables';
import { circleIntersectsRect } from './collision';
import { DEFAULT_FLOOR_GEN } from '@/data/floorgen';
import type { FloorGenConfig } from '@/data/floorgen';

interface Cell {
  cx: number;
  cy: number;
}

const DIRECTIONS: readonly Cell[] = [
  { cx: 1, cy: 0 },
  { cx: -1, cy: 0 },
  { cx: 0, cy: 1 },
  { cx: 0, cy: -1 },
];

/** Zone à garder libre autour des portes et du centre (entrées et spawn du joueur). */
const OBSTACLE_CLEARANCE = 80;

/** Marge entre un obstacle/spawn et les murs. */
const INNER_MARGIN = WALL_THICKNESS + 24;

/** Seed d'étage dérivée de la seed de run (nombre d'or 32 bits pour décorréler). */
export function deriveFloorSeed(runSeed: number, floorIndex: number): number {
  return (runSeed ^ ((floorIndex + 1) * 0x9e3779b9)) >>> 0;
}

/**
 * Marche aléatoire avec embranchements : on étend depuis une salle déjà posée,
 * ce qui produit des couloirs et des culs-de-sac plutôt qu'un simple serpent.
 */
function layoutCells(rng: RngState, count: number): Cell[] {
  const cells: Cell[] = [{ cx: 0, cy: 0 }];
  const occupied = new Set<string>(['0,0']);
  let attempts = 0;
  while (cells.length < count) {
    if ((attempts += 1) > 10_000) throw new Error('layoutCells : trop de tentatives');
    const from = pick(rng, cells);
    const dir = pick(rng, DIRECTIONS);
    const cx = from.cx + dir.cx;
    const cy = from.cy + dir.cy;
    const key = `${cx},${cy}`;
    if (occupied.has(key)) continue;
    occupied.add(key);
    cells.push({ cx, cy });
  }
  return cells;
}

function cellBounds(cell: Cell, size: FloorGenConfig['roomSize']): Rect {
  return { x: cell.cx * size.w, y: cell.cy * size.h, w: size.w, h: size.h };
}

function bfsDepths(adjacency: ReadonlyArray<readonly number[]>, start: number): number[] {
  const depths = adjacency.map(() => -1);
  depths[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const node = queue[head]!;
    for (const next of adjacency[node] ?? []) {
      if (depths[next] === -1) {
        depths[next] = (depths[node] ?? 0) + 1;
        queue.push(next);
      }
    }
  }
  return depths;
}

function assignKinds(
  rng: RngState,
  adjacency: ReadonlyArray<readonly number[]>,
  exitIndex: number,
): RoomKind[] {
  const kinds: RoomKind[] = adjacency.map(() => 'combat');
  kinds[0] = 'start';
  kinds[exitIndex] = 'exit';

  const candidates = kinds.map((_, i) => i).filter((i) => i !== 0 && i !== exitIndex);
  if (candidates.length > 0) {
    kinds[pick(rng, candidates)] = 'loot';
  }
  const restCandidates = candidates.filter((i) => kinds[i] === 'combat');
  if (restCandidates.length > 0) {
    kinds[pick(rng, restCandidates)] = 'rest';
  }
  return kinds;
}

function rectContains(rect: Rect, point: Vec2): boolean {
  return (
    point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h
  );
}

function isObstaclePlacementClear(rect: Rect, bounds: Rect, doorPoints: readonly Vec2[]): boolean {
  const inflated: Rect = {
    x: rect.x - OBSTACLE_CLEARANCE,
    y: rect.y - OBSTACLE_CLEARANCE,
    w: rect.w + 2 * OBSTACLE_CLEARANCE,
    h: rect.h + 2 * OBSTACLE_CLEARANCE,
  };
  const center: Vec2 = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
  if (rectContains(inflated, center)) return false;
  return !doorPoints.some((point) => rectContains(inflated, point));
}

// --- Intérieurs de salles ------------------------------------------------------
// Les obstacles suivent un pattern structuré (alignements, symétries, grappes)
// choisi selon le RoomKind : plus naturel que des rects épars, et le couvert
// sert le gameplay (lignes de vue coupées, embuscades de meute).

type InteriorPattern = 'pillars' | 'crates' | 'walls' | 'shelves' | 'sparse';

function patternsForKind(kind: RoomKind): readonly InteriorPattern[] {
  switch (kind) {
    case 'combat':
      return ['pillars', 'crates', 'walls'];
    case 'boss':
      return ['pillars'];
    case 'loot':
      return ['shelves', 'crates'];
    case 'start':
    case 'rest':
    case 'exit':
      return ['sparse'];
  }
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function isPlacementValid(
  rect: Rect,
  bounds: Rect,
  doorPoints: readonly Vec2[],
  placed: readonly Rect[],
): boolean {
  if (
    rect.x < bounds.x + INNER_MARGIN ||
    rect.y < bounds.y + INNER_MARGIN ||
    rect.x + rect.w > bounds.x + bounds.w - INNER_MARGIN ||
    rect.y + rect.h > bounds.y + bounds.h - INNER_MARGIN
  ) {
    return false;
  }
  if (!isObstaclePlacementClear(rect, bounds, doorPoints)) return false;
  return !placed.some((other) => rectsOverlap(rect, other));
}

function centeredSquare(cx: number, cy: number, size: number): Rect {
  return { x: cx - size / 2, y: cy - size / 2, w: size, h: size };
}

/**
 * Tire des ensembles de pièces jusqu'à en obtenir un entièrement valide
 * (ou abandonne : un motif en moins vaut mieux qu'un passage bloqué).
 * Valider l'ensemble — pas pièce à pièce — préserve les symétries.
 */
function attemptPieces(
  rng: RngState,
  attempts: number,
  build: (rng: RngState) => Rect[],
  bounds: Rect,
  doorPoints: readonly Vec2[],
  placed: readonly Rect[],
): Rect[] {
  for (let i = 0; i < attempts; i += 1) {
    const pieces = build(rng);
    const allValid = pieces.every((piece, index) =>
      isPlacementValid(piece, bounds, doorPoints, [...placed, ...pieces.slice(0, index)]),
    );
    if (pieces.length > 0 && allValid) return pieces;
  }
  return [];
}

/** Piliers carrés en miroir autour du centre : du couvert lisible. */
function pillarsPattern(rng: RngState, bounds: Rect, doorPoints: readonly Vec2[]): Rect[] {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  return attemptPieces(
    rng,
    6,
    (r) => {
      const size = nextInt(r, 44, 64);
      const dx = nextInt(r, 130, 230);
      const dy = nextInt(r, 100, 170);
      if (nextFloat(r) < 0.6) {
        return [
          centeredSquare(cx - dx, cy - dy, size),
          centeredSquare(cx + dx, cy - dy, size),
          centeredSquare(cx - dx, cy + dy, size),
          centeredSquare(cx + dx, cy + dy, size),
        ];
      }
      return [centeredSquare(cx - dx, cy, size), centeredSquare(cx + dx, cy, size)];
    },
    bounds,
    doorPoints,
    [],
  );
}

/** Grappes de caisses serrées (2 à 4 par grappe) : un coin d'entrepôt. */
function cratesPattern(rng: RngState, bounds: Rect, doorPoints: readonly Vec2[]): Rect[] {
  const placed: Rect[] = [];
  const clusters = nextInt(rng, 2, 3);
  for (let c = 0; c < clusters; c += 1) {
    const cluster = attemptPieces(
      rng,
      6,
      (r) => {
        const size = nextInt(r, 30, 44);
        const gap = 4;
        const x = nextInt(r, bounds.x + INNER_MARGIN, bounds.x + bounds.w - INNER_MARGIN - 2 * size - gap);
        const y = nextInt(r, bounds.y + INNER_MARGIN, bounds.y + bounds.h - INNER_MARGIN - 2 * size - gap);
        const cells: Rect[] = [
          { x, y, w: size, h: size },
          { x: x + size + gap, y, w: size, h: size },
          { x, y: y + size + gap, w: size, h: size },
          { x: x + size + gap, y: y + size + gap, w: size, h: size },
        ];
        return cells.slice(0, nextInt(r, 2, 4));
      },
      bounds,
      doorPoints,
      placed,
    );
    placed.push(...cluster);
  }
  return placed;
}

/** Cloisons en L : des couloirs intérieurs et des angles morts. */
function wallsPattern(rng: RngState, bounds: Rect, doorPoints: readonly Vec2[]): Rect[] {
  const placed: Rect[] = [];
  const thickness = 24;
  const count = nextInt(rng, 1, 2);
  for (let i = 0; i < count; i += 1) {
    const piece = attemptPieces(
      rng,
      6,
      (r) => {
        const armA = nextInt(r, 100, 170);
        const armB = nextInt(r, 100, 170);
        const x = nextInt(r, bounds.x + INNER_MARGIN, bounds.x + bounds.w - INNER_MARGIN - armA);
        const y = nextInt(r, bounds.y + INNER_MARGIN, bounds.y + bounds.h - INNER_MARGIN - armB);
        // Bras vertical sous le bras horizontal, à gauche ou à droite : un L ou un J.
        const verticalX = nextFloat(r) < 0.5 ? x : x + armA - thickness;
        return [
          { x, y, w: armA, h: thickness },
          { x: verticalX, y: y + thickness, w: thickness, h: armB - thickness },
        ];
      },
      bounds,
      doorPoints,
      placed,
    );
    placed.push(...piece);
  }
  return placed;
}

/** Deux rangées d'étagères parallèles : la réserve se reconnaît d'un coup d'œil. */
function shelvesPattern(rng: RngState, bounds: Rect, doorPoints: readonly Vec2[]): Rect[] {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const thickness = 28;
  return attemptPieces(
    rng,
    6,
    (r) => {
      const offset = nextInt(r, 100, 150);
      if (nextFloat(r) < 0.5) {
        const length = nextInt(r, 220, 320);
        const x = bounds.x + (bounds.w - length) / 2 + nextInt(r, -60, 60);
        return [
          { x, y: cy - offset - thickness / 2, w: length, h: thickness },
          { x, y: cy + offset - thickness / 2, w: length, h: thickness },
        ];
      }
      const length = nextInt(r, 180, 260);
      const y = bounds.y + (bounds.h - length) / 2 + nextInt(r, -50, 50);
      return [
        { x: cx - offset - thickness / 2, y, w: thickness, h: length },
        { x: cx + offset - thickness / 2, y, w: thickness, h: length },
      ];
    },
    bounds,
    doorPoints,
    [],
  );
}

/** Salles de respiration : au plus une caisse isolée. */
function sparsePattern(rng: RngState, bounds: Rect, doorPoints: readonly Vec2[]): Rect[] {
  if (nextFloat(rng) < 0.5) return [];
  return attemptPieces(
    rng,
    8,
    (r) => {
      const w = nextInt(r, 32, 56);
      const h = nextInt(r, 32, 56);
      const x = nextInt(r, bounds.x + INNER_MARGIN, bounds.x + bounds.w - INNER_MARGIN - w);
      const y = nextInt(r, bounds.y + INNER_MARGIN, bounds.y + bounds.h - INNER_MARGIN - h);
      return [{ x, y, w, h }];
    },
    bounds,
    doorPoints,
    [],
  );
}

function generateObstacles(
  rng: RngState,
  kind: RoomKind,
  bounds: Rect,
  doorPoints: readonly Vec2[],
): Rect[] {
  switch (pick(rng, patternsForKind(kind))) {
    case 'pillars':
      return pillarsPattern(rng, bounds, doorPoints);
    case 'crates':
      return cratesPattern(rng, bounds, doorPoints);
    case 'walls':
      return wallsPattern(rng, bounds, doorPoints);
    case 'shelves':
      return shelvesPattern(rng, bounds, doorPoints);
    case 'sparse':
      return sparsePattern(rng, bounds, doorPoints);
  }
}

function randomPointInside(rng: RngState, bounds: Rect): Vec2 {
  return {
    x: nextInt(rng, bounds.x + INNER_MARGIN, bounds.x + bounds.w - INNER_MARGIN),
    y: nextInt(rng, bounds.y + INNER_MARGIN, bounds.y + bounds.h - INNER_MARGIN),
  };
}

/** Rayon de dégagement des points de spawn (couvre le plus gros ennemi courant). */
const SPAWN_CLEAR_RADIUS = 16;

/**
 * Point libre par rejet : jamais dans un obstacle ni une fosse. Repli sur le
 * centre de la salle, dont la clairance est déjà garantie par la génération.
 */
function randomClearPoint(rng: RngState, bounds: Rect, blocked: readonly Rect[]): Vec2 {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const point = randomPointInside(rng, bounds);
    if (!blocked.some((rect) => circleIntersectsRect(point, SPAWN_CLEAR_RADIUS, rect))) {
      return point;
    }
  }
  return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
}

function generatePits(
  rng: RngState,
  bounds: Rect,
  doorPoints: readonly Vec2[],
  obstacles: readonly Rect[],
  config: FloorGenConfig,
): Rect[] {
  const pits: Rect[] = [];
  const target = nextInt(rng, config.pitsPerCombatRoom.min, config.pitsPerCombatRoom.max);
  for (let n = 0; n < target; n += 1) {
    // Mêmes règles que les obstacles : jamais au prix d'un passage bloqué.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const w = nextInt(rng, 80, 200);
      const h = nextInt(rng, 64, 160);
      const x = nextInt(rng, bounds.x + INNER_MARGIN, bounds.x + bounds.w - INNER_MARGIN - w);
      const y = nextInt(rng, bounds.y + INNER_MARGIN, bounds.y + bounds.h - INNER_MARGIN - h);
      const rect: Rect = { x, y, w, h };
      if (isPlacementValid(rect, bounds, doorPoints, [...obstacles, ...pits])) {
        pits.push(rect);
        break;
      }
    }
  }
  return pits;
}

function pickWeighted<T extends { weight: number }>(rng: RngState, entries: readonly T[]): T {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = nextFloat(rng) * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll < 0) return entry;
  }
  const last = entries[entries.length - 1];
  if (!last) throw new Error('Table pondérée vide');
  return last;
}

/** Mix d'espèces du palier le plus profond atteint (table triée par minFloor croissant). */
function enemyMixForDepth(config: FloorGenConfig, floorIndex: number) {
  let current;
  for (const tier of config.enemyMixByDepth) {
    if (floorIndex >= tier.minFloor) current = tier;
  }
  if (!current) throw new Error('Table enemyMixByDepth vide ou sans palier pour cet étage');
  return current.mix;
}

function generateEnemySpawns(
  rng: RngState,
  bounds: Rect,
  config: FloorGenConfig,
  blocked: readonly Rect[],
  floorIndex: number,
  withTheropode: boolean,
): EnemySpawn[] {
  // Densité croissante avec la profondeur, plafonnée : la salle reste lisible.
  const depthBonus = Math.floor(floorIndex / config.extraEnemyEveryNFloors);
  const min = Math.min(config.enemiesPerCombatRoom.min + depthBonus, config.maxEnemiesPerCombatRoom);
  const max = Math.min(config.enemiesPerCombatRoom.max + depthBonus, config.maxEnemiesPerCombatRoom);
  const count = nextInt(rng, min, max);
  const mix = enemyMixForDepth(config, floorIndex);
  const spawns: EnemySpawn[] = [];
  // Le théropode s'ajoute au mix standard : un mini-boss, pas un remplacement.
  if (withTheropode) {
    spawns.push({ kind: 'theropode', at: randomClearPoint(rng, bounds, blocked) });
  }
  for (let n = 0; n < count; n += 1) {
    spawns.push({ kind: pickWeighted(rng, mix).kind, at: randomClearPoint(rng, bounds, blocked) });
  }
  return spawns;
}

function generateRoomLoot(
  rng: RngState,
  kind: RoomKind,
  bounds: Rect,
  config: FloorGenConfig,
  blocked: readonly Rect[],
): LootSpawn[] {
  const spawns: LootSpawn[] = [];
  if (kind === 'loot') {
    const count = nextInt(rng, 1, 2);
    for (let n = 0; n < count; n += 1) {
      const entry = pickWeighted(rng, config.ammoLoot);
      spawns.push({
        kind: 'ammo',
        at: randomClearPoint(rng, bounds, blocked),
        ammo: entry.ammo,
        amount: nextInt(rng, entry.amount.min, entry.amount.max),
      });
    }
    if (nextFloat(rng) < config.medkitLootChance) {
      spawns.push({ kind: 'consumable', at: randomClearPoint(rng, bounds, blocked), defId: MEDKIT_ID });
    }
  }
  if (kind === 'rest') {
    for (let n = 0; n < config.medkitsPerRestRoom; n += 1) {
      spawns.push({ kind: 'consumable', at: randomClearPoint(rng, bounds, blocked), defId: MEDKIT_ID });
    }
  }
  return spawns;
}

export function generateFloor(
  seed: number,
  index = 0,
  config: FloorGenConfig = DEFAULT_FLOOR_GEN,
): Floor {
  const rng = createRng(seed);
  const count = nextInt(rng, config.roomCount.min, config.roomCount.max);
  const cells = layoutCells(rng, count);
  const size = config.roomSize;

  const cellIndex = new Map<string, number>(cells.map((cell, i) => [`${cell.cx},${cell.cy}`, i]));
  const roomIds: RoomId[] = cells.map((_, i) => asId<'RoomId'>(`room-${i}`));

  // Une porte par arête de la grille (voisins est et sud pour ne compter
  // chaque paire qu'une fois) : le graphe garde ses boucles naturelles.
  const doors: Record<DoorId, Door> = {};
  const doorIdsByRoom: DoorId[][] = cells.map(() => []);
  const adjacency: number[][] = cells.map(() => []);
  let doorSeq = 0;
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i]!;
    for (const dir of [
      { cx: 1, cy: 0 },
      { cx: 0, cy: 1 },
    ]) {
      const j = cellIndex.get(`${cell.cx + dir.cx},${cell.cy + dir.cy}`);
      if (j === undefined) continue;
      const id = asId<'DoorId'>(`door-${doorSeq}`);
      doorSeq += 1;
      const at: Vec2 =
        dir.cx === 1
          ? { x: (cell.cx + 1) * size.w, y: cell.cy * size.h + size.h / 2 }
          : { x: cell.cx * size.w + size.w / 2, y: (cell.cy + 1) * size.h };
      doors[id] = {
        id,
        roomA: roomIds[i]!,
        roomB: roomIds[j]!,
        at,
        locked: false,
        keyItemId: null,
        open: false,
      };
      doorIdsByRoom[i]!.push(id);
      doorIdsByRoom[j]!.push(id);
      adjacency[i]!.push(j);
      adjacency[j]!.push(i);
    }
  }

  // L'exit est la salle la plus profonde depuis le start (BFS sur les portes).
  const depths = bfsDepths(adjacency, 0);
  const exitIndex = depths.indexOf(Math.max(...depths));
  const kinds = assignKinds(rng, adjacency, exitIndex);

  // Budget théropode de l'étage : tiré salle par salle, dans l'ordre de génération.
  let theropodesLeft = index >= config.theropode.minFloor ? config.theropode.maxPerFloor : 0;

  const rooms: Record<RoomId, Room> = {};
  for (let i = 0; i < cells.length; i += 1) {
    const kind = kinds[i]!;
    const bounds = cellBounds(cells[i]!, size);
    const doorIds = doorIdsByRoom[i]!;
    const doorPoints = doorIds.map((id) => doors[id]!.at);
    const obstacles = generateObstacles(rng, kind, bounds, doorPoints);
    const pits = kind === 'combat' ? generatePits(rng, bounds, doorPoints, obstacles, config) : [];
    const blocked = [...obstacles, ...pits];
    let enemySpawns: EnemySpawn[] = [];
    if (kind === 'combat') {
      const withTheropode =
        theropodesLeft > 0 && nextFloat(rng) < config.theropode.chancePerCombatRoom;
      if (withTheropode) theropodesLeft -= 1;
      enemySpawns = generateEnemySpawns(rng, bounds, config, blocked, index, withTheropode);
    }
    rooms[roomIds[i]!] = {
      id: roomIds[i]!,
      kind,
      bounds,
      obstacles,
      pits,
      doorIds,
      enemySpawns,
      lootSpawns: generateRoomLoot(rng, kind, bounds, config, blocked),
      spawned: false,
      cleared: enemySpawns.length === 0,
      discovered: i === 0,
    };
  }

  return {
    index,
    seed,
    rooms,
    doors,
    startRoomId: roomIds[0]!,
    exitRoomId: roomIds[exitIndex]!,
    currentRoomId: roomIds[0]!,
  };
}
