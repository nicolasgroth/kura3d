/**
 * @file src/store/__tests__/referenceExclusions.test.ts
 * @description Una referencia nunca se exporta, resta, combina ni divide; no ocupa cama ni recibe
 * piezas; no cuenta en el pie ni en "Fuera de volumen". Cada exclusión con su prueba, sobre el motor real.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strFromU8, unzipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import * as engine from '../../engine';
import { sceneFootprints } from '../../core/scene/freeSpot';
import { resolveModuleTarget } from '../../core/scene/sceneRules';
import { sceneCounts } from '../../components/StatusBarCount';
import { checkObjectsOutOfBounds } from '../../components/viewport/viewportHelpers';
import { selectExportTargets } from '../exportTargets';
import { exportableObjects } from '../../engine/io/stl';
import { addBox, byId, resetStore, store } from './storeTestUtils';

const stlTriangles = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset).getUint32(80, true);
const threeMfObjects = (bytes: Uint8Array) => {
  const model = strFromU8(unzipSync(bytes)['3D/3dmodel.model']);
  return (model.match(/<object /g) ?? []).length;
};

describe('Referencias: exclusiones', () => {
  beforeEach(() => resetStore());

  it('ningún formato exporta la referencia (STL, 3MF de escena completa, OBJ, PLY; GLB usa el mismo filtro)', async () => {
    const solid = await addBox(10);
    await addBox(20, [40, 0, 0], { role: 'reference' });
    const objects = store().objects;
    expect(exportableObjects(objects).map((o) => o.id)).toEqual([solid.id]);
    expect(stlTriangles(engine.exportSceneToBinarySTL(objects))).toBe(12);
    // Escena completa: los negativos y ocultos viajan sin ítem de build; la referencia, nunca.
    expect(threeMfObjects(engine.exportSceneTo3MF(objects, 'mm', undefined, undefined, { groups: [] }))).toBe(1);
    expect(threeMfObjects(engine.exportSceneTo3MF(objects))).toBe(1);
    const obj = engine.exportSceneToOBJ(objects, 'escena');
    expect((obj.obj.match(/^f /gm) ?? []).length).toBe(12);
    const ply = new TextDecoder().decode(engine.exportSceneToPLY(objects).subarray(0, 400));
    expect(ply).toContain('element face 12');
  });

  it('exportar selección con una referencia la omite y lo avisa; el bus informa skippedReferences', async () => {
    const solid = await addBox(10);
    const ref = await addBox(20, [40, 0, 0], { role: 'reference' });
    const sel = selectExportTargets(store().objects, [solid.id, ref.id], true);
    expect(sel.targets.map((o) => o.id)).toEqual([solid.id]);
    expect(sel.skippedReferences).toBe(1);
    store().selectObject(solid.id);
    store().selectObject(ref.id, true);
    const res = await store().executeCommand({ id: '1', command: 'export_stl', params: { onlySelected: true, returnBytes: true } });
    expect(res.ok).toBe(true);
    expect(res.result).toMatchObject({ triangleCount: 12, skippedReferences: 1 });
    store().selectObject(ref.id);
    const only = await store().executeCommand({ id: '2', command: 'export_3mf', params: { onlySelected: true } });
    expect(only.ok).toBe(false);
  });

  it('Aplicar restas no resta ni consume la referencia (aunque toque un negativo)', async () => {
    const solid = await addBox(10);
    const ref = await addBox(10, [3, 0, 0], { role: 'reference' });
    await addBox(4, [0, 0, 0], { role: 'negative' });
    const refMesh = byId(ref.id)!.mesh;
    const solidMesh = byId(solid.id)!.mesh;
    await store().applyHolesOnSolids();
    expect(byId(ref.id)?.mesh).toBe(refMesh);
    expect(byId(ref.id)?.role).toBe('reference');
    expect(store().objects.some((o) => o.role === 'negative')).toBe(false);
    const solids = store().objects.filter((o) => o.role === 'solid');
    expect(solids).toHaveLength(1);
    expect(solids[0].mesh).not.toBe(solidMesh); // el sólido sí recibió la resta
  });

  it('una referencia sola con un negativo: no hay nada que restar', async () => {
    const ref = await addBox(10, [0, 0, 0], { role: 'reference' });
    await addBox(4, [0, 0, 0], { role: 'negative' });
    const before = byId(ref.id)!.mesh;
    await store().applyHolesOnSolids();
    expect(byId(ref.id)?.mesh).toBe(before);
    expect(store().objects.some((o) => o.role === 'negative')).toBe(true);
  });

  it('booleanas, combinar y envolvente rechazan la referencia y no tocan la escena', async () => {
    const solid = await addBox(10);
    const ref = await addBox(10, [5, 0, 0], { role: 'reference' });
    const count = store().objects.length;
    expect(await store().runBooleanOnSelection('union', solid.id, ref.id)).toBeNull();
    expect(await store().runBooleanOnSelection('subtract', ref.id, solid.id)).toBeNull();
    expect(store().combineObjects([solid.id, ref.id])).toBeNull();
    expect(await store().runConvexHull([solid.id, ref.id])).toBeNull();
    expect(store().objects).toHaveLength(count);
    expect(byId(ref.id)?.role).toBe('reference');
  });

  it('cortar, dividir, ahuecar, texturizar, separar por colores y analizar no actúan sobre la referencia', async () => {
    const ref = await addBox(20, [0, 0, 0], { role: 'reference' });
    const mesh = byId(ref.id)!.mesh;
    expect(await store().planeCutObject(ref.id, { axis: 'x', offset: 0, connectorType: 'none' } as never)).toEqual([]);
    expect(await store().hollowObject(ref.id, { enabled: true, wallThickness: 2 })).toBe(false);
    expect(store().applyTextureToObject(ref.id, { pattern: 'fuzzy', depth: 0.4, scale: 1 })).toBe(false);
    expect(await store().splitObjectByColor(ref.id)).toEqual([]);
    expect(await store().splitDisconnectedObject(ref.id)).toEqual([]);
    expect(await store().runPrintabilityCheck(ref.id)).toBeNull();
    expect(byId(ref.id)?.mesh).toBe(mesh);
    expect(store().objects).toHaveLength(1);
  });

  it('no ocupa cama: un cubo nuevo puede ir donde está la referencia; no recibe piezas', async () => {
    const ref = await addBox(60, [0, 0, 0], { role: 'reference' });
    expect(sceneFootprints(store().objects)).toEqual([]);
    const cube = await store().createPrimitive('box', { width: 10, height: 10, depth: 10 }, { placement: 'free' });
    expect(cube).not.toBeNull();
    expect(Math.abs(cube!.position[0])).toBeLessThan(1);
    expect(Math.abs(cube!.position[2])).toBeLessThan(1);
    expect(resolveModuleTarget(store().objects, [ref.id], ref.id)?.id).toBe(cube!.id);
  });

  it('el pie no la cuenta y "Fuera de volumen" no la considera', async () => {
    await addBox(10);
    const ref = await addBox(10, [0, 0, 0], { role: 'reference' });
    const counts = sceneCounts(store().objects);
    expect(counts).toMatchObject({ total: 1, visible: 1, visibleTris: 12, references: 1 });
    const far = { ...byId(ref.id)!, position: [5000, 0, 0] as [number, number, number] };
    const profile = { ...store().printerProfile, showPrintVolume: true };
    expect(checkObjectsOutOfBounds([store().objects[0], far], profile)).toBe(false);
    expect(checkObjectsOutOfBounds([{ ...far, role: 'solid' }], profile)).toBe(true);
  });

  it('convertir a sólido y de vuelta: un paso de deshacer cada vez; H no la cambia', async () => {
    const ref = await addBox(10, [0, 0, 0], { role: 'reference' });
    store().setObjectsRole([ref.id], 'solid');
    expect(byId(ref.id)?.role).toBe('solid');
    store().setObjectsRole([ref.id], 'reference');
    expect(byId(ref.id)?.role).toBe('reference');
    store().undo();
    expect(byId(ref.id)?.role).toBe('solid');
    store().undo();
    expect(byId(ref.id)?.role).toBe('reference');
  });

  it('bus: set_object_role con alias isHole, get_scene_state informa role y create_primitive acepta role', async () => {
    const box = await addBox(10);
    let res = await store().executeCommand({ id: '1', command: 'set_object_role', params: { id: box.id, role: 'reference', referenceOpacity: 0.6 } });
    expect(res.ok).toBe(true);
    expect(byId(box.id)).toMatchObject({ role: 'reference', referenceOpacity: 0.6 });
    res = await store().executeCommand({ id: '2', command: 'set_object_role', params: { ids: [box.id], isHole: true } });
    expect(byId(box.id)?.role).toBe('negative');
    res = await store().executeCommand({ id: '3', command: 'get_scene_state', params: {} });
    expect((res.result as { objects: { role: string; isHole: boolean }[] }).objects[0]).toMatchObject({ role: 'negative', isHole: true });
    res = await store().executeCommand({ id: '4', command: 'create_primitive', params: { type: 'box', role: 'reference' } });
    expect(res.ok).toBe(true);
    expect(store().objects.at(-1)?.role).toBe('reference');
    res = await store().executeCommand({ id: '5', command: 'set_object_role', params: { id: box.id, role: 'ghost' } });
    expect(res.ok).toBe(false);
  });
});
