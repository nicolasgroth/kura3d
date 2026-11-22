/**
 * @file src/store/__tests__/segmentationStale.test.ts
 * @description Pruebas de invalidación de la segmentación estructural: undo/redo y cualquier
 * reemplazo de malla la descartan, el resultado lleva la huella de la malla y extraer, colorear o
 * separar con una segmentación vieja se rechaza sin tocar la fuente.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { computeMeshFingerprint } from '../../engine/meshFingerprint';
import { isEngineError } from '../../engine/engineErrors';
import { extractStructuralRegion, splitAllDetectedStructures } from '../../engine/structuralSegmentation';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

describe('Segmentación obsoleta', () => {
  beforeEach(() => resetStore());

  it('el resultado lleva la huella de la malla analizada', async () => {
    const box = await addBox(20);
    const seg = await store().detectObjectStructures(box.id);
    expect(seg?.meshFingerprint).toBe(computeMeshFingerprint(byId(box.id)!.mesh));
  });

  it('undo y redo descartan la segmentación activa', async () => {
    const box = await addBox(20);
    await store().detectObjectStructures(box.id);
    expect(store().activeSegmentation).not.toBeNull();
    store().undo();
    expect(store().activeSegmentation).toBeNull();
  });

  it('reemplazar la malla (refinar) descarta la segmentación', async () => {
    const box = await addBox(20);
    await store().detectObjectStructures(box.id);
    expect(await store().refineSelectedMesh(box.id, 4)).toBe(true);
    expect(store().activeSegmentation).toBeNull();
  });

  it('extraer con removeFromSource y una segmentación vieja no reemplaza la fuente', async () => {
    const box = await addBox(20);
    const seg = await store().detectObjectStructures(box.id);
    const before = byId(box.id)!;
    // Segmentación forzada sobre una malla que ya cambió (estado inconsistente simulado).
    const other = await addBox(12, [40, 0, 0]);
    useKuraStore.setState({ activeSegmentation: { ...seg!, objectId: other.id } });
    const res = await store().extractDetectedStructure(seg!.regions[0].id, true);
    expect(res).toBeNull();
    expect(byId(other.id)!.mesh).toBe(other.mesh);
    expect(byId(box.id)!.mesh).toBe(before.mesh);
  });

  it('el motor rechaza índices de cara fuera de la malla con un código tipado', async () => {
    const box = await addBox(20);
    const seg = await store().detectObjectStructures(box.id);
    const region = { ...seg!.regions[0], faceIndices: [0, 1, 99999] };
    await expect(extractStructuralRegion(byId(box.id)!, region)).rejects.toSatisfy(
      (err: unknown) => isEngineError(err) && err.code === 'SEGMENTATION_REGION_INVALID',
    );
  });

  it('el motor rechaza separar con una huella distinta', async () => {
    const box = await addBox(20);
    const seg = await store().detectObjectStructures(box.id);
    await expect(
      splitAllDetectedStructures(byId(box.id)!, { ...seg!, meshFingerprint: 'otra' }),
    ).rejects.toSatisfy((err: unknown) => isEngineError(err) && err.code === 'SEGMENTATION_STALE');
  });
});

describe('Exclusión de operaciones asíncronas', () => {
  beforeEach(() => resetStore());

  it('una segunda operación mientras otra corre se rechaza y no libera el bloqueo ajeno', async () => {
    const box = await addBox(20);
    const first = store().refineSelectedMesh(box.id, 4);
    expect(store().busyOperation).toBe('refine');
    const second = await store().simplifySelectedMesh(box.id, 0.1);
    expect(second).toBe(false);
    // El rechazo no puede apagar el bloqueo de la primera.
    expect(store().busyOperation).toBe('refine');
    expect(await first).toBe(true);
    expect(store().busyOperation).toBeNull();
  });

  it('crear primitivas en paralelo: la segunda se rechaza con aviso', async () => {
    const a = store().createPrimitive('box');
    const b = await store().createPrimitive('sphere');
    expect(b).toBeNull();
    expect(await a).not.toBeNull();
    expect(store().toasts.some((t) => t.text.includes('Espera'))).toBe(true);
  });
});
