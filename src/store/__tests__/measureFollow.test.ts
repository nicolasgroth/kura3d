/**
 * @file src/store/__tests__/measureFollow.test.ts
 * @description Las mediciones siguen a sus objetos: al mover, girar o escalar un objeto, la distancia, el
 * ángulo y el área se recalculan en vivo; si el objeto se borra o su malla cambia la medición queda
 * desactualizada (y vuelve con deshacer); abrir otro proyecto o vaciar la cama las limpia.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { computeMeshStats } from '../../engine/primitives';
import { fakeBox } from '../../test/fakeObjects';
import type { MeshData, SceneObject } from '../../types/kura';
import { useMeasureStore } from '../measureStore';
import { resolveMeasurements } from '../measureResolve';
import '../measureSceneSync';
import { useKuraStore } from '../useKuraStore';

/** Cubo de lado `s` apoyado en la cama (Y 0..s), sin WASM. */
function cubeMesh(s: number): MeshData {
  const h = s / 2;
  const v = [[-h, 0, -h], [h, 0, -h], [h, s, -h], [-h, s, -h], [-h, 0, h], [h, 0, h], [h, s, h], [-h, s, h]].flat();
  const f = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2];
  return { positions: new Float32Array(v), indices: new Uint32Array(f) };
}

const OPTS = { snapRadiusMm: 0, noSnap: true, additive: false };
const objs = () => useKuraStore.getState().objects;
const resolved = () => resolveMeasurements(useMeasureStore.getState().measurements, objs());
const move = (id: string, patch: Partial<SceneObject>) =>
  useKuraStore.setState({ objects: objs().map((o) => (o.id === id ? { ...o, ...patch } : o)) } as never);

describe('las mediciones siguen a sus objetos', () => {
  let a: SceneObject, b: SceneObject;
  beforeEach(() => {
    const mesh = cubeMesh(20);
    const base = { mesh, stats: computeMeshStats(mesh) };
    a = { ...fakeBox('a', 'A', 20), ...base };
    b = { ...fakeBox('b', 'B', 20), ...base, position: [60, 0, 0] };
    useKuraStore.setState({ objects: [a, b], selectedIds: [] } as never);
    useMeasureStore.getState().reset();
  });

  it('distancia entre A y B: mover, escalar y girar B actualiza el valor', () => {
    const m = useMeasureStore.getState();
    m.pick(a, [0, 10, 0], null, OPTS);
    m.pick(b, [60, 10, 0], null, OPTS);
    expect((resolved()[0] as { distanceMm: number }).distanceMm).toBeCloseTo(60, 4);
    move('b', { position: [100, 0, 0] });
    expect((resolved()[0] as { distanceMm: number }).distanceMm).toBeCloseTo(100, 4);
    move('b', { position: [100, 0, 0], scale: [2, 2, 2] });
    // El punto local de B era (0, 10, 0): con escala 2 queda a altura 20; Δ = (100, 10, 0).
    expect((resolved()[0] as { distanceMm: number }).distanceMm).toBeCloseTo(Math.hypot(100, 10), 4);
    expect(resolved()[0].stale).toBe(false);
  });

  it('ángulo de tres puntos: girar o mover el objeto lo conserva; deformarlo con la escala lo cambia', () => {
    const m = useMeasureStore.getState();
    m.setMode('angle');
    m.pick(a, [10, 20, 0], null, OPTS);
    m.pick(a, [0, 20, 0], null, OPTS);
    m.pick(a, [10, 20, -10], null, OPTS);
    const deg = () => (resolved()[0] as { deg: number }).deg;
    expect(deg()).toBeCloseTo(45, 3);
    move('a', { rotation: [0.4, 1, 0.2], position: [5, 3, 1] });
    expect(deg()).toBeCloseTo(45, 3);
    move('a', { scale: [3, 1, 1] });
    expect(deg()).toBeCloseTo((Math.atan(10 / 30) * 180) / Math.PI, 2);
  });

  it('área: escalar al doble multiplica el área por 4', () => {
    const m = useMeasureStore.getState();
    m.setMode('area');
    // Cara superior del cubo (índice 2 de los triángulos de la tapa).
    m.pick(a, [0, 20, 0], 1, OPTS);
    const before = (resolved()[0] as { areaMm2: number }).areaMm2;
    expect(before).toBeCloseTo(400, 3);
    move('a', { scale: [2, 2, 2] });
    expect((resolved()[0] as { areaMm2: number }).areaMm2).toBeCloseTo(1600, 3);
  });

  it('borrar un objeto la desactualiza; deshacer (mismo objeto) la devuelve; cambiar la malla la invalida', () => {
    const m = useMeasureStore.getState();
    m.pick(a, [0, 10, 0], null, OPTS);
    m.pick(b, [60, 10, 0], null, OPTS);
    useKuraStore.setState({ objects: [a] } as never);
    expect(resolved()[0].stale).toBe(true);
    useKuraStore.setState({ objects: [a, b] } as never);
    expect(resolved()[0].stale).toBe(false);
    // Operación destructiva: malla nueva.
    useKuraStore.setState({ objects: [a, { ...b, mesh: cubeMesh(20) }] } as never);
    expect(resolved()[0].stale).toBe(true);
    // Sigue estando en la lista para poder borrarla.
    expect(useMeasureStore.getState().measurements).toHaveLength(1);
    useMeasureStore.getState().remove(useMeasureStore.getState().measurements[0].id);
    expect(resolved()).toHaveLength(0);
  });

  it('abrir otro proyecto o vaciar la cama limpia las mediciones', () => {
    const m = useMeasureStore.getState();
    m.pick(a, [0, 10, 0], null, OPTS);
    m.pick(b, [60, 10, 0], null, OPTS);
    expect(useMeasureStore.getState().measurements).toHaveLength(1);
    useKuraStore.setState({ projectDraftId: 'otro-proyecto' } as never);
    expect(useMeasureStore.getState().measurements).toHaveLength(0);

    useMeasureStore.getState().pick(a, [0, 10, 0], null, OPTS);
    useMeasureStore.getState().pick(b, [60, 10, 0], null, OPTS);
    useKuraStore.getState().clearScene();
    expect(useMeasureStore.getState().measurements).toHaveLength(0);
  });
});
