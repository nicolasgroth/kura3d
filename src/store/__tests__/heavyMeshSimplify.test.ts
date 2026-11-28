/**
 * @file src/store/__tests__/heavyMeshSimplify.test.ts
 * @description Malla densa con una sola fuente (`OPERATION_DEFAULTS.heavyMesh`): el análisis marca
 * «muy densa» desde el mismo umbral que el aviso al importar, y por debajo ya no. Simplificar siempre
 * informa triángulos antes → después y cambio de volumen, y el resultado de la operación trae ambos
 * volúmenes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PRINTER_PROFILES } from '../../types/kura';
import { createPrimitiveMesh } from '../../engine';
import { OPERATION_DEFAULTS } from '../../engine/operationLimits';
import { analyzePrintability } from '../../engine/printability';
import { makeObject } from '../../engine/__tests__/geometryTestUtils';
import { simplifyObject } from '../../core/operations/meshOperations';
import { APP_BUILD_POLICY } from '../../core/scene/sceneObjects';
import { useKuraStore } from '../useKuraStore';

const get = useKuraStore.getState;
let empty: ReturnType<typeof get>;
const bed = DEFAULT_PRINTER_PROFILES[0];

beforeAll(async () => {
  await get().initEngine();
  empty = get();
});
beforeEach(() => useKuraStore.setState({ ...empty, objects: [], groups: [], toasts: [], selectedIds: [] }, true));

describe('malla densa: una sola fuente', () => {
  it('el análisis marca «muy densa» desde heavyMesh.warnTriangles, no antes', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 20, segments: 64 });
    const tris = sphere.indices.length / 3;
    const limits = OPERATION_DEFAULTS.heavyMesh as { warnTriangles: number };
    const original = limits.warnTriangles;
    try {
      limits.warnTriangles = tris + 1;
      expect(analyzePrintability(makeObject('esfera', sphere), bed).densityQuality).not.toBe('high');
      limits.warnTriangles = tris;
      const report = analyzePrintability(makeObject('esfera', sphere), bed);
      expect(report.densityQuality).toBe('high');
      expect(report.issues.some((w) => w.code === 'HIGH_DENSITY')).toBe(true);
    } finally {
      limits.warnTriangles = original;
    }
    expect(OPERATION_DEFAULTS.heavyMesh.warnTriangles).toBe(300_000);
  });
});

describe('simplificar informa triángulos y volumen', () => {
  it('la operación trae triángulos y volúmenes antes y después', async () => {
    const sphere = await createPrimitiveMesh('sphere', { radius: 20, segments: 96 });
    const obj = makeObject('esfera', sphere);
    const ctx = { policy: APP_BUILD_POLICY, newId: () => 'x', naming: {} } as never;
    const change = await simplifyObject(ctx, obj, 0.2);
    const s = change.simplify!;
    expect(s.trianglesBefore).toBe(sphere.indices.length / 3);
    expect(s.trianglesAfter).toBeLessThan(s.trianglesBefore);
    expect(s.volumeBeforeMm3).toBeCloseTo((4 / 3) * Math.PI * 20 ** 3, -3);
    expect(s.volumeChangePct).toBeCloseTo((100 * (s.volumeAfterMm3 - s.volumeBeforeMm3)) / s.volumeBeforeMm3, 6);
  });

  it('el aviso del store muestra antes → después y el % de volumen', async () => {
    await get().createPrimitive('sphere', { radius: 20, segments: 96 });
    const id = get().objects[0].id;
    expect(await get().simplifySelectedMesh(id, 0.2)).toBe(true);
    const toast = get().toasts.find((t) => t.text.startsWith('Simplificado:'));
    expect(toast?.text).toMatch(/→ [\d.]+ triángulos · volumen [-+−]?[\d,]+ %/);
  });
});
