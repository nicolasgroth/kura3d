/**
 * @file src/core/scene/__tests__/plateBedChange.test.ts
 * @description Cambiar la cama de una placa (P7): cama desde un perfil, volver a la del proyecto, validación, y que una
 * cama más grande no pise a la vecina (se recoloca la placa que choca, con sus piezas y acompañantes, en imprimir y en
 * armado).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { SceneObject, Vec3 } from '../../../types/kura';
import type { ScenePlate } from '../../../types/plates';
import { plateBedFromProfile, samePlateBed, setPlateBed } from '../plateBedChange';
import { overlappingPlates } from '../plateOverlap';

const BED = { widthMm: 180, depthMm: 180, heightMm: 180 };
const CTX = { bed: { widthMm: 180, depthMm: 180 } };
const BIG = { name: 'X1', profileId: 'bambu-x1c', widthMm: 256, depthMm: 256, heightMm: 256 };

function box(id: string, position: Vec3, plateRef?: string, extra: Partial<SceneObject> = {}): SceneObject {
  return {
    id, name: id, source: 'primitive', position, rotation: [0, 0, 0], scale: [1, 1, 1], color: '#fff', role: 'solid', visible: true, locked: false,
    mesh: { positions: new Float32Array(), indices: new Uint32Array() },
    ...(plateRef ? { plateRef } : {}), ...extra,
  } as unknown as SceneObject;
}

// Dos placas de 180 en la cuadrícula de siempre (paso 180 + 40).
const PLATES: ScenePlate[] = [
  { id: 'p1', name: 'Placa 1', origin: [0, 0] },
  { id: 'p2', name: 'Placa 2', origin: [220, 0] },
];
const opts = (layout: 'print' | 'assembly' = 'print') => ({ projectBed: BED, layout, ctx: CTX });

describe('cama de una placa', () => {
  it('desde un perfil conserva id, nombre, medidas y margen', () => {
    const bed = plateBedFromProfile({ id: 'user-1', name: 'Mía', brand: 'generic', bedWidthMm: 250, bedDepthMm: 210, maxHeightMm: 200, showPrintVolume: true, colorSlots: 1, marginMm: 3 });
    expect(bed).toEqual({ profileId: 'user-1', name: 'Mía', widthMm: 250, depthMm: 210, heightMm: 200, marginMm: 3 });
  });

  it('asigna una cama más chica sin mover nada y vuelve a la del proyecto con null', () => {
    const scene = { objects: [box('a', [220, 0, 0], 'p2')], plates: PLATES };
    const small = { name: 'Mini', widthMm: 120, depthMm: 120, heightMm: 120 };
    const res = setPlateBed(scene, 'p2', small, opts())!;
    expect(res.scene.plates[1].bed).toEqual(small);
    expect(res.scene.plates[1].origin).toEqual([220, 0]);
    expect(res.relocated).toEqual([]);
    expect(res.scene.objects).toBe(scene.objects);
    const back = setPlateBed(res.scene, 'p2', null, opts())!;
    expect(back.scene.plates[1].bed).toBeUndefined();
  });

  it('rechaza placa inexistente, cama inválida y cambios que no cambian nada', () => {
    const scene = { objects: [], plates: PLATES };
    expect(setPlateBed(scene, 'nope', BIG, opts())).toBeNull();
    expect(setPlateBed(scene, 'p1', { ...BIG, widthMm: 0 }, opts())).toBeNull();
    expect(setPlateBed(scene, 'p1', { ...BIG, widthMm: 20_000 }, opts())).toBeNull();
    expect(setPlateBed(scene, 'p1', { ...BIG, heightMm: Number.NaN }, opts())).toBeNull();
    expect(setPlateBed(scene, 'p1', null, opts())).toBeNull();
    const once = setPlateBed(scene, 'p1', BIG, opts())!;
    expect(setPlateBed(once.scene, 'p1', { ...BIG }, opts())).toBeNull();
  });

  it('recorta el nombre de la cama', () => {
    const res = setPlateBed({ objects: [], plates: PLATES }, 'p2', { ...BIG, name: `  ${'x'.repeat(200)}  ` }, opts())!;
    expect(res.scene.plates[1].bed!.name).toHaveLength(80);
  });

  it('una cama más grande que pisaría a la vecina la recoloca con sus piezas y acompañantes', () => {
    const magnet = box('m', [230, 0, 5], undefined, { metadata: { addon: { hostId: 'b' } } } as Partial<SceneObject>);
    const scene = { objects: [box('a', [0, 0, 0], 'p1'), box('b', [225, 0, 5], 'p2'), magnet], plates: PLATES };
    const res = setPlateBed(scene, 'p1', BIG, opts())!;
    expect(res.relocated).toEqual(['p2']);
    expect(overlappingPlates(res.scene.plates, BED)).toEqual([]);
    const p2 = res.scene.plates[1];
    const dx = p2.origin[0] - 220, dz = p2.origin[1];
    // Separadas al menos 40 mm: 256/2 + 180/2 + 40.
    expect(p2.origin[0] - 0).toBeGreaterThanOrEqual(128 + 90 + 40 - 1e-6);
    const b = res.scene.objects.find((o) => o.id === 'b')!;
    expect(b.position).toEqual([225 + dx, 0, 5 + dz]);
    expect(res.scene.objects.find((o) => o.id === 'm')!.position).toEqual([230 + dx, 0, 5 + dz]);
    // La placa 1 y su pieza no se mueven.
    expect(res.scene.plates[0].origin).toEqual([0, 0]);
    expect(res.scene.objects[0]).toBe(scene.objects[0]);
  });

  it('agrandar la segunda placa hacia la primera mueve la segunda, no la primera', () => {
    const scene = { objects: [box('a', [0, 0, 0], 'p1'), box('b', [220, 0, 0], 'p2')], plates: PLATES };
    const res = setPlateBed(scene, 'p2', BIG, opts())!;
    expect(res.relocated).toEqual(['p2']);
    expect(res.scene.plates[0].origin).toEqual([0, 0]);
    expect(overlappingPlates(res.scene.plates, BED)).toEqual([]);
    const p2 = res.scene.plates[1];
    expect(res.scene.objects[1].position[0] - p2.origin[0]).toBeCloseTo(0);
  });

  it('en armado no toca la figura: traslada la pose de impresión guardada', () => {
    const b = box('b', [10, 50, 10], 'p2', { restPose: { position: [225, 0, 5], rotation: [0, 0, 0] } });
    const scene = { objects: [box('a', [0, 0, 0], 'p1'), b], plates: PLATES };
    const res = setPlateBed(scene, 'p1', BIG, opts('assembly'))!;
    const p2 = res.scene.plates[1];
    const moved = res.scene.objects[1];
    expect(moved.position).toEqual([10, 50, 10]);
    expect(moved.restPose!.position).toEqual([225 + p2.origin[0] - 220, 0, 5 + p2.origin[1]]);
  });

  it('samePlateBed compara medidas, margen y perfil', () => {
    expect(samePlateBed(undefined, undefined)).toBe(true);
    expect(samePlateBed(BIG, { ...BIG })).toBe(true);
    expect(samePlateBed(BIG, { ...BIG, marginMm: 2 })).toBe(false);
    expect(samePlateBed(BIG, undefined)).toBe(false);
  });
});
