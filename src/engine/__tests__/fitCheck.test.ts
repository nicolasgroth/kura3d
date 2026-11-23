/**
 * @file src/engine/__tests__/fitCheck.test.ts
 * @description Comprobar encaje (`runFitCheck`): holgura medida contra la esperada, volumen exacto de
 * un choque, restas pendientes aplicadas (o ignoradas a pedido), referencia que no cabe, fase ancha
 * (cuenta de pares, no reloj), malla abierta marcada como aproximada, 200 objetos con costo acotado,
 * cancelación a mitad y que la escena no cambia.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { createPrimitiveMesh } from '../primitives';
import { FitCheckCancelledError, runFitCheck } from '../fitCheck';
import { makeObject } from './geometryTestUtils';

const box = (w: number, h: number, d: number) => createPrimitiveMesh('box', { width: w, height: h, depth: d });
const at = (id: string, mesh: MeshData, position: Vec3, extra: Partial<SceneObject> = {}) =>
  makeObject(id, mesh, { position, name: id, ...extra });

/** Caja de `outer` mm con una cavidad cerrada de `inner` mm (dos cáscaras, sólido válido). */
async function hollowBox(outer: number, inner: number): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const a = wasm.Manifold.cube([outer, outer, outer], true);
  const b = wasm.Manifold.cube([inner, inner, inner], true);
  const r = a.subtract(b);
  try {
    return manifoldToMeshData(r);
  } finally {
    a.delete(); b.delete(); r.delete();
  }
}

/** Cubo con un triángulo menos: malla abierta. */
function openCopy(mesh: MeshData): MeshData {
  return { ...mesh, indices: mesh.indices.slice(3) };
}

describe('runFitCheck: holgura y choque', () => {
  it('cubo de 10 mm en una caja hueca con 1 mm de holgura: 1,00 ± 0,01 y sin choque', async () => {
    const shell = at('caja', await hollowBox(20, 12), [0, 0, 0]);
    // Las primitivas se apoyan en Y = 0 (cama): el cubo se baja 5 mm para quedar centrado.
    const cube = at('cubo', await box(10, 10, 10), [0, -5, 0]);
    const r = await runFitCheck({ objects: [shell, cube] });
    expect(r.pairs).toHaveLength(1);
    const p = r.pairs[0];
    expect(p.status).toBe('ok');
    expect(p.interference).toBeNull();
    expect(p.clearanceMm).toBeCloseTo(1, 2);
    expect(p.approximate).toBe(false);
    expect(p.closest).not.toBeNull();
    expect(r.summary).toMatchObject({ evaluatedPairs: 1, interferes: 0, tight: 0, ok: 1 });
  });

  it('dos cubos de 10 mm desplazados 8 mm se cruzan 200 mm³ exactos, con zona y dirección', async () => {
    const a = at('A', await box(10, 10, 10), [0, 0, 0]);
    const b = at('B', await box(10, 10, 10), [8, 0, 0]);
    const r = await runFitCheck({ objects: [a, b] });
    const p = r.pairs[0];
    expect(p.status).toBe('interferes');
    expect(p.approximate).toBe(false);
    expect(p.interference!.volumeMm3).toBeCloseTo(200, 6);
    // Zona en ejes del usuario: X 3..5, Y −5..5 (fondo), Z 0..10 (las primitivas se apoyan en la cama).
    expect(p.interference!.zoneBox.min[0]).toBeCloseTo(3, 6);
    expect(p.interference!.zoneBox.max[0]).toBeCloseTo(5, 6);
    expect(p.clearanceMm).toBe(0);
    const rec = p.recommendation!;
    expect(rec.key).toBe('fitCheck.rec.separate');
    expect(rec.estimate).toBe(true);
    expect(rec.params.direction).toBe('-x');
    expect(rec.params.distanceMm).toBeCloseTo(2.25, 6);
    expect(r.summary.worst).toMatchObject({ status: 'interferes' });
  });

  it('dos sólidos que se tocan sin cruzarse quedan "justos" (holgura 0, sin volumen)', async () => {
    const a = at('A', await box(10, 10, 10), [0, 0, 0]);
    const b = at('B', await box(10, 10, 10), [10.1, 0, 0]);
    const r = await runFitCheck({ objects: [a, b] });
    expect(r.pairs[0].status).toBe('tight');
    expect(r.pairs[0].clearanceMm).toBeCloseTo(0.1, 4);
    expect(r.pairs[0].recommendation).toMatchObject({ key: 'fitCheck.rec.tight' });
    expect(r.pairs[0].recommendation!.params.missingMm).toBeCloseTo(0.15, 4);
  });
});

describe('runFitCheck: restas pendientes', () => {
  async function shaftScene() {
    // Placa 30×10×30 (Y arriba interno), agujero por un negativo r 3 sin aplicar, eje r 2,9 dentro.
    const plate = at('Placa', await box(30, 10, 30), [0, 0, 0]);
    const hole = at('Agujero', await createPrimitiveMesh('cylinder', { radius: 3, height: 20, segments: 64 }), [0, -10, 0], { role: 'negative' });
    const shaft = at('Eje', await createPrimitiveMesh('cylinder', { radius: 2.9, height: 20, segments: 64 }), [0, -10, 0]);
    return { plate, hole, shaft };
  }

  it('aplica el negativo antes de comparar y da la holgura real (0,1 mm < 0,25 → justo)', async () => {
    const { plate, hole, shaft } = await shaftScene();
    const r = await runFitCheck({ objects: [plate, shaft], negatives: [hole] });
    const p = r.pairs[0];
    expect(p.status).toBe('tight');
    expect(p.interference).toBeNull();
    expect(p.clearanceMm!).toBeGreaterThan(0.095);
    expect(p.clearanceMm!).toBeLessThan(0.101);
    expect(r.subtractions.applied).toBe(1);
    expect(p.recommendation!.key).toBe('fitCheck.rec.tight');
    expect(p.recommendation!.params.missingMm).toBeCloseTo(0.25 - p.clearanceMm!, 2);
  });

  it('con applyPendingSubtractions: false ignora el negativo, reporta el cruce y lo anota', async () => {
    const { plate, hole, shaft } = await shaftScene();
    const r = await runFitCheck({ objects: [plate, shaft], negatives: [hole], options: { applyPendingSubtractions: false } });
    expect(r.pairs[0].status).toBe('interferes');
    expect(r.subtractions).toMatchObject({ applied: 0, ignored: 1 });
    expect(r.notes.map((n) => n.key)).toContain('fitCheck.note.subtractionsIgnored');
  });

  it('un negativo en la lista de objetos no cuenta como pieza', async () => {
    const { plate, hole, shaft } = await shaftScene();
    const r = await runFitCheck({ objects: [plate, shaft, hole], negatives: [hole] });
    expect(r.pairs).toHaveLength(1);
    expect(r.objectIds.sort()).toEqual(['Eje', 'Placa']);
  });
});

describe('runFitCheck: referencias', () => {
  it('una placa de referencia 0,5 mm más ancha que su alojamiento: choque exacto y "agrandar"', async () => {
    const wasm = await initManifoldEngine();
    const outer = wasm.Manifold.cube([30, 10, 30], true);
    const pocket = wasm.Manifold.cube([20, 8, 20], true).translate([0, 2, 0]);
    const housingM = outer.subtract(pocket);
    const housing = at('Caja', manifoldToMeshData(housingM), [0, 0, 0]);
    outer.delete(); pocket.delete(); housingM.delete();
    const board = at('Arduino', await box(21, 2, 21), [0, 2, 0], { role: 'reference' });
    const r = await runFitCheck({ objects: [housing, board] });
    const p = r.pairs[0];
    expect(p.kind).toBe('reference-solid');
    expect(p.aId).toBe('Arduino');
    expect(p.status).toBe('interferes');
    expect(p.interference!.volumeMm3).toBeCloseTo((21 * 21 - 20 * 20) * 2, 4);
    expect(p.recommendation!.key).toBe('fitCheck.rec.enlarge');
    expect(p.recommendation!.params.perSideMm).toBeCloseTo(0.75, 2);
    expect(p.recommendation!.params.axes).toBe('X, Y');
  });

  it('pares referencia–referencia se omiten', async () => {
    const a = at('R1', await box(10, 10, 10), [0, 0, 0], { role: 'reference' });
    const b = at('R2', await box(10, 10, 10), [5, 0, 0], { role: 'reference' });
    const r = await runFitCheck({ objects: [a, b] });
    expect(r.pairs).toHaveLength(0);
    expect(r.summary.possiblePairs).toBe(0);
  });

  it('referencia con malla abierta: resultado aproximado y marcado', async () => {
    const a = at('Pieza', await box(10, 10, 10), [0, 0, 0]);
    const b = at('Ref', openCopy(await box(10, 10, 10)), [8, 0, 0], { role: 'reference' });
    const r = await runFitCheck({ objects: [a, b] });
    const p = r.pairs[0];
    expect(p.status).toBe('interferes');
    expect(p.approximate).toBe(true);
    expect(p.interference!.approximate).toBe(true);
    expect(p.interference!.crossingTriangles).toBeGreaterThan(0);
    expect(p.interference!.volumeMm3).toBeGreaterThan(120);
    expect(p.interference!.volumeMm3).toBeLessThan(280);
    expect(r.notes.map((n) => n.key)).toContain('fitCheck.note.openMesh');
  });
});

describe('runFitCheck: costo acotado', () => {
  it('la fase ancha descarta pares lejanos (cuenta de pares evaluados)', async () => {
    const m = await box(10, 10, 10);
    const objs = [at('a', m, [0, 0, 0]), at('b', m, [10.5, 0, 0]), at('c', m, [200, 0, 0]), at('d', m, [0, 300, 0])];
    const r = await runFitCheck({ objects: objs });
    expect(r.summary.possiblePairs).toBe(6);
    expect(r.summary.evaluatedPairs).toBe(1);
    expect(r.summary.far).toBe(5);
  });

  it('200 cubos en grilla: solo vecinos llegan a la fase fina y maxPairs corta con aviso', async () => {
    const m = await box(2, 2, 2);
    const objs: SceneObject[] = [];
    for (let i = 0; i < 20; i++) for (let j = 0; j < 10; j++) objs.push(at(`c${i}_${j}`, m, [i * 3, 0, j * 3]));
    const r = await runFitCheck({ objects: objs });
    expect(r.summary.possiblePairs).toBe(19900);
    // Vecinos en 8 direcciones a 1 mm (o 1,41 en diagonal): 190 + 180 + 2·171 = 712.
    expect(r.summary.broadPhaseCandidates).toBe(712);
    expect(r.summary.evaluatedPairs).toBe(712);
    expect(r.summary.interferes + r.summary.tight).toBe(0);
    const cut = await runFitCheck({ objects: objs, options: { maxPairs: 100 } });
    expect(cut.summary.evaluatedPairs).toBe(100);
    expect(cut.truncated).toBe(true);
    expect(cut.notes.map((n) => n.key)).toContain('fitCheck.note.truncated');
  });

  it('se cancela a mitad (por progreso) con FitCheckCancelledError', async () => {
    const m = await box(10, 10, 10);
    const objs = [0, 1, 2, 3, 4].map((i) => at(`o${i}`, m, [i * 9, 0, 0]));
    let calls = 0;
    await expect(
      runFitCheck({ objects: objs }, { onProgress: () => { calls++; }, shouldCancel: () => calls >= 3 }),
    ).rejects.toBeInstanceOf(FitCheckCancelledError);
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('no cambia la escena: mismas mallas, posiciones y transformaciones', async () => {
    const plate = at('Placa', await box(30, 10, 30), [1, 2, 3], { rotation: [0, 0.3, 0] });
    const hole = at('H', await createPrimitiveMesh('cylinder', { radius: 3, height: 20 }), [0, -10, 0], { role: 'negative' });
    const before = [plate, hole].map((o) => ({ pos: [...o.position], rot: [...o.rotation], p: Array.from(o.mesh.positions), i: Array.from(o.mesh.indices), mesh: o.mesh }));
    await runFitCheck({ objects: [plate, at('x', await box(5, 5, 5), [1, 2, 3])], negatives: [hole] });
    [plate, hole].forEach((o, k) => {
      expect(o.mesh).toBe(before[k].mesh);
      expect([...o.position]).toEqual(before[k].pos);
      expect([...o.rotation]).toEqual(before[k].rot);
      expect(Array.from(o.mesh.positions)).toEqual(before[k].p);
      expect(Array.from(o.mesh.indices)).toEqual(before[k].i);
    });
  });
});
