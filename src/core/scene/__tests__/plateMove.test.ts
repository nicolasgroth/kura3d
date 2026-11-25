/**
 * @file src/core/scene/__tests__/plateMove.test.ts
 * @description Lógica pura de la interfaz de placas (P2): mover piezas entre placas (traslado al hueco equivalente,
 * pose de armado, acompañantes, hueco libre si pisa a otra), soltar sobre otra placa, lo nuevo cae en la placa
 * activa, hueco libre con origen, límites de arrastre con varias placas y marco de placa de las herramientas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { SceneObject, Vec3 } from '../../../types/kura';
import type { ScenePlate } from '../../../types/plates';
import { dragBoundsForBeds, dragMoveDelta } from '../dragMovePlane';
import { findFreeSpot, placeInFreeSpot } from '../freeSpot';
import { adoptNewPieces } from '../plateAdopt';
import { plateFrameFor, shiftChangeXZ } from '../plateFrame';
import { movePiecesToPlate, plateAtPoint, reassignByPosition } from '../plateMove';

const BED = { widthMm: 200, depthMm: 200, heightMm: 200 };
const CTX = { bed: { widthMm: 200, depthMm: 200 } };
const PLATES: ScenePlate[] = [
  { id: 'p1', name: 'Placa 1', origin: [0, 0] },
  { id: 'p2', name: 'Placa 2', origin: [250, 0] },
  { id: 'p3', name: 'Placa 3', origin: [0, -250] },
];

/** Cubo de lado `size` centrado en el origen local, con malla real (para huellas). */
function mesh(size: number) {
  const h = size / 2;
  const positions = new Float32Array([-h, 0, -h, h, 0, -h, h, 0, h, -h, 0, h, -h, size, -h, h, size, -h, h, size, h, -h, size, h]);
  return { positions, indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]) };
}

function box(id: string, position: Vec3, plateRef?: string, extra: Partial<SceneObject> = {}): SceneObject {
  return {
    id, name: id, source: 'primitive', position, rotation: [0, 0, 0], scale: [1, 1, 1], color: '#fff', role: 'solid', visible: true, locked: false,
    mesh: mesh(20), stats: { triangles: 12, vertices: 8, isManifold: true, volumeMm3: 8000, dimensionsMm: [20, 20, 20] },
    ...(plateRef ? { plateRef } : {}), ...extra,
  } as unknown as SceneObject;
}

describe('mover a placa', () => {
  it('traslada la pieza al hueco equivalente (misma posición relativa al origen de su placa)', () => {
    const scene = { objects: [box('a', [30, 0, -10], 'p1'), box('b', [0, 0, 0], 'p1')], plates: PLATES };
    const res = movePiecesToPlate(scene, ['a'], 'p2', 'print', CTX, BED)!;
    const a = res.scene.objects.find((o) => o.id === 'a')!;
    expect(a.plateRef).toBe('p2');
    expect(a.position).toEqual([280, 0, -10]);
    expect(res.scene.objects.find((o) => o.id === 'b')).toBe(scene.objects[1]);
    expect(res.moved).toEqual(['a']);
  });

  it('desde la placa 2 a la 3 resta el origen de la placa de partida', () => {
    const scene = { objects: [box('a', [260, 0, 5], 'p2')], plates: PLATES };
    const a = movePiecesToPlate(scene, ['a'], 'p3', 'print', CTX, BED)!.scene.objects[0];
    expect(a.position).toEqual([10, 0, -245]);
  });

  it('no mueve lo que ya está en la placa, lo bloqueado ni lo que no es sólido; sin cambios devuelve null', () => {
    const objects = [box('a', [0, 0, 0], 'p2'), box('l', [0, 0, 0], 'p1', { locked: true }), box('n', [0, 0, 0], undefined, { role: 'negative' } as Partial<SceneObject>)];
    expect(movePiecesToPlate({ objects, plates: PLATES }, ['a', 'l', 'n'], 'p2', 'print', CTX, BED)).toBeNull();
    expect(movePiecesToPlate({ objects, plates: PLATES }, ['a'], 'nada', 'print', CTX, BED)).toBeNull();
  });

  it('si el hueco equivalente pisa a otra pieza de la placa destino, el bloque va al primer hueco libre', () => {
    const scene = { objects: [box('a', [0, 0, 0], 'p1'), box('b', [250, 0, 0], 'p2')], plates: PLATES };
    const a = movePiecesToPlate(scene, ['a'], 'p2', 'print', CTX, BED)!.scene.objects[0];
    expect(a.plateRef).toBe('p2');
    // No quedó encima de «b» (cubos de 20 mm) y sigue dentro de la cama de la placa 2.
    expect(Math.abs(a.position[0] - 250) + Math.abs(a.position[2])).toBeGreaterThanOrEqual(20);
    expect(Math.abs(a.position[0] - 250)).toBeLessThanOrEqual(100);
    expect(Math.abs(a.position[2])).toBeLessThanOrEqual(100);
  });

  it('en armado la figura no se toca: se traslada la pose de impresión (restPose)', () => {
    const rest = { position: [30, 0, 0] as Vec3, rotation: [0, 0, 0] as Vec3 };
    const scene = { objects: [box('a', [5, 40, 5], 'p1', { restPose: rest })], plates: PLATES };
    const a = movePiecesToPlate(scene, ['a'], 'p2', 'assembly', CTX, BED)!.scene.objects[0];
    expect(a.position).toEqual([5, 40, 5]);
    expect(a.restPose!.position).toEqual([280, 0, 0]);
    expect(a.plateRef).toBe('p2');
  });

  it('en armado, una pieza sin restPose recibe una con su pose de impresión trasladada', () => {
    const scene = { objects: [box('a', [5, 0, 5], 'p1')], plates: PLATES };
    const a = movePiecesToPlate(scene, ['a'], 'p2', 'assembly', CTX, BED)!.scene.objects[0];
    expect(a.position).toEqual([5, 0, 5]);
    expect(a.restPose!.position).toEqual([255, 0, 5]);
  });

  it('un imán ligado y los negativos de un grupo que se mueve entero acompañan a su pieza', () => {
    const magnet = box('m', [32, 5, 0], undefined, { role: 'negative', metadata: { addon: { kind: 'magnet', hostId: 'a' } } } as unknown as Partial<SceneObject>);
    const hole = box('h', [0, 5, 0], undefined, { role: 'negative', groupRef: 'g' } as Partial<SceneObject>);
    const scene = { objects: [box('a', [30, 0, 0], 'p1', { groupRef: 'g' }), magnet, hole], plates: PLATES };
    const objects = movePiecesToPlate(scene, ['a'], 'p2', 'print', CTX, BED)!.scene.objects;
    expect(objects.find((o) => o.id === 'm')!.position).toEqual([282, 5, 0]);
    expect(objects.find((o) => o.id === 'h')!.position).toEqual([250, 5, 0]);
    expect(objects.find((o) => o.id === 'm')!.plateRef).toBeUndefined();
  });

  it('un acompañante con placa queda asignado a la placa destino (no físicamente en una y asignado a otra)', () => {
    const magnet = box('m', [32, 5, 0], 'p1', { role: 'negative', metadata: { addon: { kind: 'magnet', hostId: 'a' } } } as unknown as Partial<SceneObject>);
    const hole = box('h', [0, 5, 0], 'p1', { role: 'negative', groupRef: 'g' } as Partial<SceneObject>);
    const scene = { objects: [box('a', [30, 0, 0], 'p1', { groupRef: 'g' }), magnet, hole], plates: PLATES };
    const res = movePiecesToPlate(scene, ['a'], 'p2', 'print', CTX, BED)!;
    expect(res.scene.objects.find((o) => o.id === 'm')).toMatchObject({ plateRef: 'p2', position: [282, 5, 0] });
    expect(res.scene.objects.find((o) => o.id === 'h')).toMatchObject({ plateRef: 'p2', position: [250, 5, 0] });
    expect(res.moved).toEqual(['a']);
  });

  it('un negativo de grupo no acompaña si solo se mueve una de las piezas del grupo', () => {
    const hole = box('h', [0, 5, 0], undefined, { role: 'negative', groupRef: 'g' } as Partial<SceneObject>);
    const scene = { objects: [box('a', [0, 0, 0], 'p1', { groupRef: 'g' }), box('b', [40, 0, 0], 'p1', { groupRef: 'g' }), hole], plates: PLATES };
    const objects = movePiecesToPlate(scene, ['a'], 'p2', 'print', CTX, BED)!.scene.objects;
    expect(objects.find((o) => o.id === 'h')!.position).toEqual([0, 5, 0]);
  });
});

describe('soltar sobre otra placa', () => {
  it('plateAtPoint ubica el punto en la cama que lo contiene', () => {
    expect(plateAtPoint(PLATES, BED, 240, 10)?.id).toBe('p2');
    expect(plateAtPoint(PLATES, BED, 0, -240)?.id).toBe('p3');
    expect(plateAtPoint(PLATES, BED, 125, 0)).toBeNull();
  });

  it('reasigna según el centro de la huella, sin trasladar; fuera de toda placa conserva la suya', () => {
    const scene = { objects: [box('a', [250, 0, 0], 'p1'), box('b', [125, 0, 0], 'p1'), box('c', [0, 0, 0], 'p1')], plates: PLATES };
    const next = reassignByPosition(scene, ['a', 'b', 'c'], BED)!;
    expect(next.objects.map((o) => o.plateRef)).toEqual(['p2', 'p1', 'p1']);
    expect(next.objects[0].position).toEqual([250, 0, 0]);
    expect(reassignByPosition({ objects: [box('c', [0, 0, 0], 'p1')], plates: PLATES }, ['c'], BED)).toBeNull();
  });
});

describe('lo nuevo cae en la placa activa', () => {
  const before = [box('a', [0, 0, 0], 'p1')];

  it('una pieza sólida nueva sin placa recibe la activa; sin placas no hace nada', () => {
    const after = [...before, box('n', [0, 0, 0])];
    expect(adoptNewPieces(before, after, PLATES, 'p2')!.find((o) => o.id === 'n')!.plateRef).toBe('p2');
    expect(adoptNewPieces(before, after, PLATES, null)!.find((o) => o.id === 'n')!.plateRef).toBe('p1');
    expect(adoptNewPieces(before, after, [], null)).toBeNull();
  });

  it('lo que reemplaza a piezas de una misma placa queda en esa placa, aunque otra sea la activa', () => {
    const src = [box('a', [250, 0, 0], 'p2')];
    const out = adoptNewPieces(src, [box('x', [250, 0, 0]), box('y', [260, 0, 0])], PLATES, 'p1')!;
    expect(out.map((o) => o.plateRef)).toEqual(['p2', 'p2']);
  });

  it('no toca copias con placa, referencias ni negativos', () => {
    const after = [...before, box('c', [0, 0, 0], 'p3'), box('r', [0, 0, 0], undefined, { role: 'reference' } as Partial<SceneObject>)];
    expect(adoptNewPieces(before, after, PLATES, 'p2')).toBeNull();
  });
});

describe('colocar con origen', () => {
  it('findFreeSpot busca en el marco de la placa y devuelve coordenadas de mundo', () => {
    const spot = findFreeSpot([], [20, 20], { width: 200, depth: 200, origin: [250, 0] });
    expect(spot).toEqual({ x: 250, z: 0, fits: true });
  });

  it('esquiva lo ocupado en esa placa y no se deja engañar por lo de otra', () => {
    const occupied = [{ minX: 240, maxX: 260, minZ: -10, maxZ: 10 }, { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }];
    const spot = findFreeSpot(occupied, [20, 20], { width: 200, depth: 200, origin: [250, 0] });
    expect(spot.fits).toBe(true);
    expect(Math.abs(spot.x - 250) + Math.abs(spot.z)).toBeGreaterThan(20);
    expect(spot.x).toBeGreaterThan(150);
  });

  it('sin origen es el de siempre', () => {
    expect(findFreeSpot([], [20, 20], { width: 200, depth: 200 })).toEqual({ x: 0, z: 0, fits: true });
    expect(placeInFreeSpot([], mesh(20), [0, 0, 0], [1, 1, 1], { width: 200, depth: 200, origin: [250, 0] }).position[0]).toBe(250);
  });
});

describe('arrastre con varias placas', () => {
  it('los límites cubren todas las placas y dejan llegar a la última', () => {
    const bounds = dragBoundsForBeds([{ width: 200, depth: 200 }, { width: 200, depth: 200, origin: [250, 0] }])!;
    expect(bounds.rect!.maxX).toBeGreaterThan(350);
    const delta = dragMoveDelta({
      rayOrigin: [250, 300, 0], rayDir: [0, -1, 0], grab: [0, 0, 0], reference: [0, 0, 0], snapMm: 0, bounds,
    })!;
    expect(delta[0]).toBe(250);
  });

  it('sin placas lejanas se conserva el rectángulo centrado de siempre', () => {
    expect(dragBoundsForBeds([])).toBeNull();
  });
});

describe('marco de placa de las herramientas', () => {
  const source = { printerProfile: { bedWidthMm: 200, bedDepthMm: 200, maxHeightMm: 200 }, customBedDimensions: null, plates: PLATES, activePlateId: 'p1' };

  it('toma la placa de la primera pieza; sin placa, el mundo; sin placas, como siempre', () => {
    expect(plateFrameFor(source, [{ plateRef: 'p2' }]).origin).toEqual([250, 0]);
    expect(plateFrameFor(source, [{ plateRef: undefined }]).origin).toEqual([0, 0]);
    expect(plateFrameFor({ ...source, plates: [] }, [{ plateRef: 'p2' }])).toMatchObject({ origin: [0, 0], plateId: null });
    expect(plateFrameFor({ ...source, activePlateId: 'p3' }).origin).toEqual([0, -250]);
  });

  it('shiftChangeXZ suma el origen solo a las posiciones', () => {
    const change = { added: [], removedIds: [], warnings: [], patches: [{ id: 'a', patch: { position: [1, 2, 3] as Vec3 } }, { id: 'b', patch: { rotation: [0, 0, 0] as Vec3 } }] };
    const moved = shiftChangeXZ(change, [250, -10]);
    expect(moved.patches[0].patch.position).toEqual([251, 2, -7]);
    expect(moved.patches[1]).toBe(change.patches[1]);
    expect(shiftChangeXZ(change, [0, 0])).toBe(change);
  });
});
