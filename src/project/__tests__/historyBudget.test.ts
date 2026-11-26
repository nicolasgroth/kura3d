/**
 * @file src/project/__tests__/historyBudget.test.ts
 * @description Pruebas de la estimación de memoria del historial (buffers contados una vez por
 * identidad), el recorte por presupuesto y máximo duro, y el recorte propio del archivo `.kura`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { SceneSnapshot } from '../../store/storeTypes';
import type { MeshData, SceneObject } from '../../types/kura';
import {
  defaultHistoryLimits,
  estimateHistoryBytes,
  FILE_HISTORY_MAX_STEPS,
  OBJECT_OVERHEAD_BYTES,
  STEP_OVERHEAD_BYTES,
  trimHistory,
  trimHistoryForFile,
} from '../historyBudget';

const MB = 1024 * 1024;

function bigMesh(triangles: number): MeshData {
  return { positions: new Float32Array(triangles * 9), indices: new Uint32Array(triangles * 3) };
}
function meshBytes(m: MeshData): number {
  return m.positions.byteLength + m.indices.byteLength;
}
function obj(mesh: MeshData, x = 0): SceneObject {
  return { id: 'a', mesh, position: [x, 0, 0] } as unknown as SceneObject;
}
function snap(objects: SceneObject[]): SceneSnapshot {
  return { objects, selectedIds: [] } as SceneSnapshot;
}
const budget = (mb: number, maxSteps = 500) => ({ budgetBytes: mb * MB, maxSteps });

describe('estimateHistoryBytes', () => {
  it('200 movimientos de una pieza de 100 mil triángulos pesan apenas más que un snapshot', () => {
    const mesh = bigMesh(100_000);
    const steps = Array.from({ length: 200 }, (_, i) => snap([obj(mesh, i)]));
    const bytes = estimateHistoryBytes(steps);
    const fixed = 200 * (STEP_OVERHEAD_BYTES + OBJECT_OVERHEAD_BYTES);
    expect(bytes).toBe(meshBytes(mesh) + fixed);
    expect(bytes).toBeLessThan(meshBytes(mesh) * 1.05);
  });

  it('10 operaciones con malla nueva pesan unas 10 mallas', () => {
    const meshes = Array.from({ length: 10 }, () => bigMesh(100_000));
    const bytes = estimateHistoryBytes(meshes.map((m) => snap([obj(m)])));
    const expected = meshes.reduce((s, m) => s + meshBytes(m), 0);
    expect(bytes).toBeGreaterThanOrEqual(expected);
    expect(bytes).toBeLessThan(expected * 1.01);
  });

  it('cuenta normales y colores por cara una sola vez', () => {
    const mesh: MeshData = { ...bigMesh(10), normals: new Float32Array(90), faceColors: Array(10).fill('#ffffff') };
    const one = estimateHistoryBytes([snap([obj(mesh)])]);
    const two = estimateHistoryBytes([snap([obj(mesh)]), snap([obj(mesh, 5)])]);
    expect(one).toBeGreaterThan(meshBytes(mesh) + 360);
    expect(two - one).toBe(STEP_OVERHEAD_BYTES + OBJECT_OVERHEAD_BYTES);
  });
});

describe('trimHistory', () => {
  const meshMb = () => bigMesh(Math.round((1 * MB) / 48)); // ~1 MB (36+12 bytes por triángulo)

  it('descarta los pasos más antiguos al superar el presupuesto', () => {
    const past = Array.from({ length: 10 }, (_, i) => snap([obj(meshMb(), i)]));
    const r = trimHistory(past, [], budget(4));
    expect(r.past.length).toBeLessThanOrEqual(4);
    expect(r.past.length).toBeGreaterThanOrEqual(3);
    expect(r.past[r.past.length - 1]).toBe(past[9]);
    expect(r.droppedByBudget).toBe(10 - r.past.length);
    expect(r.droppedByCount).toBe(0);
  });

  it('respeta el máximo duro de pasos aunque sobre memoria', () => {
    const mesh = bigMesh(100);
    const past = Array.from({ length: 80 }, (_, i) => snap([obj(mesh, i)]));
    const r = trimHistory(past, [], budget(1024, 50));
    expect(r.past).toHaveLength(50);
    expect(r.past[0]).toBe(past[30]);
    expect(r.droppedByCount).toBe(30);
    expect(r.droppedByBudget).toBe(0);
  });

  it('siempre conserva al menos el último paso aunque exceda el presupuesto', () => {
    const past = [snap([obj(meshMb())]), snap([obj(meshMb())]), snap([obj(bigMesh(Math.round((8 * MB) / 48)))])];
    const r = trimHistory(past, [], budget(1));
    expect(r.past).toEqual([past[2]]);
  });

  it('sin nada que descartar devuelve los mismos arreglos', () => {
    const past = [snap([obj(bigMesh(10))])];
    const future: SceneSnapshot[] = [];
    const r = trimHistory(past, future, budget(64));
    expect(r.past).toBe(past);
    expect(r.future).toBe(future);
  });

  it('recorta el futuro más lejano cuando el pasado ya está al mínimo', () => {
    const past = [snap([obj(meshMb())])];
    const future = Array.from({ length: 5 }, (_, i) => snap([obj(meshMb(), i)]));
    const r = trimHistory(past, future, budget(3));
    expect(r.past).toEqual(past);
    expect(r.future[0]).toBe(future[0]);
    expect(r.future.length).toBeLessThan(5);
  });
});

describe('defaultHistoryLimits', () => {
  it('256 MB en escritorio y 96 MB con poca memoria o ancho de móvil', () => {
    expect(defaultHistoryLimits({ deviceMemory: 8, width: 1440 })).toEqual({ budgetMb: 256, maxSteps: 500 });
    expect(defaultHistoryLimits({ deviceMemory: 4, width: 1440 }).budgetMb).toBe(96);
    expect(defaultHistoryLimits({ deviceMemory: 8, width: 390 }).budgetMb).toBe(96);
  });
});

describe('trimHistoryForFile', () => {
  it('guarda los 40 pasos más recientes', () => {
    const mesh = bigMesh(10);
    const past = Array.from({ length: 300 }, (_, i) => snap([obj(mesh, i)]));
    const future = Array.from({ length: 5 }, (_, i) => snap([obj(mesh, 1000 + i)]));
    const r = trimHistoryForFile(past, future);
    expect(r.past.length + r.future.length).toBe(FILE_HISTORY_MAX_STEPS);
    expect(r.past[r.past.length - 1]).toBe(past[299]);
    expect(r.future[0]).toBe(future[0]);
  });

  it('no supera 64 MB aunque haya menos de 40 pasos', () => {
    const past = Array.from({ length: 30 }, () => snap([obj(bigMesh(Math.round((10 * MB) / 48)))]));
    const r = trimHistoryForFile(past, []);
    expect(estimateHistoryBytes(r.past)).toBeLessThanOrEqual(64 * MB);
    expect(r.past.length).toBeLessThan(30);
    expect(r.past[r.past.length - 1]).toBe(past[29]);
  });
});
