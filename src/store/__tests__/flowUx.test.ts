/**
 * @file src/store/__tests__/flowUx.test.ts
 * @description Pruebas del lote de flujo de usabilidad: avisos con «Deshacer» al vaciar la cama y
 * eliminar, encuadre de piezas nuevas con la escena ya poblada, primera pintura sobre un objeto
 * paramétrico (y su deshacer), cavidad cerrada en el análisis y aviso al ahuecar sin drenaje.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { parametricStateOf, primitiveParamFields } from '../../core/scene/parametric';
import { analyzePrintability } from '../../engine/printability';
import { DEFAULT_PRINTER_PROFILES } from '../../types/kura';
import { addBox, byId, resetStore, store } from './storeTestUtils';
import { useKuraStore } from '../useKuraStore';

const toasts = () => store().toasts;

describe('Vaciar cama y eliminar con «Deshacer»', () => {
  beforeEach(() => resetStore());

  it('vaciar la cama avisa con el número de objetos y el aviso deshace', async () => {
    await addBox(10, [0, 0, 0]);
    await addBox(10, [30, 0, 0]);
    store().clearScene();
    expect(store().objects).toHaveLength(0);
    const toast = toasts().at(-1)!;
    expect(toast.text).toContain('2');
    expect(toast.action?.label).toBe('Deshacer');
    toast.action!.run();
    expect(store().objects).toHaveLength(2);
  });

  it('eliminar varios objetos avisa con «Deshacer» y lo restaura', async () => {
    const a = await addBox(10, [0, 0, 0]);
    const b = await addBox(10, [30, 0, 0]);
    store().deleteObjects([a.id, b.id]);
    expect(store().objects).toHaveLength(0);
    const toast = toasts().at(-1)!;
    expect(toast.action).toBeDefined();
    toast.action!.run();
    expect(store().objects).toHaveLength(2);
  });
});

describe('Piezas nuevas a la vista', () => {
  beforeEach(() => resetStore());

  it('crear en espacio libre con la escena poblada pide asegurar la pieza nueva a la vista', async () => {
    await addBox(30, [0, 0, 0]);
    const created = await store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { placement: 'free' });
    expect(created).not.toBeNull();
    expect(store().selectedIds).toEqual([created!.id]);
    expect(store().cameraRequest?.preset).toBe('ensure');
    expect(store().cameraRequest?.ids).toEqual([created!.id]);
    // No cae sobre la pieza existente.
    const first = store().objects[0];
    expect(Math.abs(created!.position[0] - first.position[0]) + Math.abs(created!.position[2] - first.position[2])).toBeGreaterThan(29);
  });
});

describe('Pintar sobre un objeto paramétrico', () => {
  beforeEach(() => resetStore());

  it('el pincel con borde fino quita los parámetros y deshacer devuelve la primitiva intacta', async () => {
    const box = await store().createPrimitive('box', { width: 20, height: 20, depth: 20 }, { position: [0, 0, 0] });
    expect(parametricStateOf(box!).status).toBe('primitive');
    useKuraStore.setState({ paintRefineEdge: true, paintRadiusMm: 4 });
    store().paintObjectSurface(box!.id, [10, 10, 3], null, 'brush');
    expect(parametricStateOf(byId(box!.id)!).status).toBe('modified');
    store().undo();
    const restored = byId(box!.id)!;
    expect(parametricStateOf(restored).status).toBe('primitive');
    expect(restored.primitiveParams).toEqual(box!.primitiveParams);
  });
});

describe('Orden de los parámetros del cubo', () => {
  it('Ancho (X), Fondo (Y), Alto (Z)', () => {
    expect(primitiveParamFields('box').map((f) => f.key)).toEqual(['width', 'depth', 'height']);
  });
});

describe('Cavidad cerrada en piezas ahuecadas', () => {
  beforeEach(() => resetStore());
  const bed = DEFAULT_PRINTER_PROFILES[0];

  it('un cubo ahuecado sin drenaje avisa de la cavidad y no menciona soportes', async () => {
    const box = await addBox(30);
    await store().hollowObject(box.id, { enabled: true, wallThickness: 2.2 });
    expect(toasts().some((t) => t.text.includes('cavidad cerrada'))).toBe(true);
    const report = analyzePrintability(byId(box.id)!, bed);
    expect(report.issues.map((i) => i.code)).toContain('SEALED_CAVITY');
    expect(report.warnings.join(' ').toLowerCase()).not.toContain('activar soportes');
  });

  it('con orificio de drenaje no hay cavidad cerrada ni aviso', async () => {
    const box = await addBox(30);
    await store().hollowObject(box.id, { enabled: true, wallThickness: 2.2, drainHole: true, drainHoleRadius: 3 });
    expect(toasts().some((t) => t.text.includes('cavidad cerrada'))).toBe(false);
    expect(analyzePrintability(byId(box.id)!, bed).issues.map((i) => i.code)).not.toContain('SEALED_CAVITY');
  });

  it('un cubo macizo no tiene cavidad', async () => {
    const box = await addBox(30);
    expect(analyzePrintability(box, bed).issues.map((i) => i.code)).not.toContain('SEALED_CAVITY');
  });
});
