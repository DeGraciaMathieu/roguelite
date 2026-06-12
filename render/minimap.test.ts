import { describe, expect, it } from 'vitest';
import type { Floor, Room } from '@/domain';
import { generateFloor } from '@/systems/floorgen';
import { minimapModel } from './minimap';

function startRoom(floor: Floor): Room {
  const room = floor.rooms[floor.startRoomId];
  if (!room) throw new Error('Salle de départ manquante');
  return room;
}

/** Première salle voisine du start, via sa première porte. */
function firstNeighbor(floor: Floor): Room {
  const start = startRoom(floor);
  const doorId = start.doorIds[0];
  const door = doorId !== undefined ? floor.doors[doorId] : undefined;
  if (!door) throw new Error('Le start devrait avoir une porte');
  const neighborId = door.roomA === start.id ? door.roomB : door.roomA;
  const neighbor = floor.rooms[neighborId];
  if (!neighbor) throw new Error('Voisin manquant');
  return neighbor;
}

describe('minimapModel', () => {
  it('au départ, seule la salle start est visible et courante', () => {
    const model = minimapModel(generateFloor(42));

    expect(model.cells).toHaveLength(1);
    expect(model.cells[0]?.kind).toBe('start');
    expect(model.cells[0]?.current).toBe(true);
  });

  it('toutes les portes du start mènent vers de l’inexploré', () => {
    const floor = generateFloor(42);
    const model = minimapModel(floor);

    expect(model.cells[0]?.unexploredExits).toHaveLength(startRoom(floor).doorIds.length);
    expect(model.cells[0]?.exploredExits).toHaveLength(0);
  });

  it('découvrir une salle l’ajoute à la carte et crée un raccord exploré', () => {
    const floor = generateFloor(42);
    const neighbor = firstNeighbor(floor);
    neighbor.discovered = true;
    floor.currentRoomId = neighbor.id;

    const model = minimapModel(floor);

    expect(model.cells).toHaveLength(2);
    const startCell = model.cells.find((cell) => cell.kind === 'start');
    const neighborCell = model.cells.find((cell) => cell.current);
    expect(startCell?.current).toBe(false);
    expect(neighborCell).toBeDefined();
    expect(startCell?.exploredExits).toHaveLength(1);
    expect(startCell?.unexploredExits).toHaveLength(startRoom(floor).doorIds.length - 1);
  });

  it('produit des coordonnées de grille relatives positives et une emprise stable', () => {
    const floor = generateFloor(42);
    const before = minimapModel(floor);
    for (const room of Object.values(floor.rooms)) room.discovered = true;
    const after = minimapModel(floor);

    expect(after.cells).toHaveLength(Object.keys(floor.rooms).length);
    for (const cell of after.cells) {
      expect(cell.cx).toBeGreaterThanOrEqual(0);
      expect(cell.cy).toBeGreaterThanOrEqual(0);
      expect(cell.cx).toBeLessThan(after.gridW);
      expect(cell.cy).toBeLessThan(after.gridH);
    }
    // L'emprise ne dépend pas de la découverte : la carte ne saute pas.
    expect(before.gridW).toBe(after.gridW);
    expect(before.gridH).toBe(after.gridH);
  });
});
