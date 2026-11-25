/**
 * @file src/core/__tests__/simplifyVolumeWarning.test.ts
 * @description Simplificar avisa con `SIMPLIFY_VOLUME_CHANGED` (y el porcentaje) cuando el volumen
 * cambia más que el umbral; una simplificación que conserva el volumen no avisa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { computeMeshStats, createPrimitiveMesh, initManifoldEngine } from '../../engine';
import { OPERATION_DEFAULTS } from '../../engine/operationLimits';
import { localizeEngineWarning } from '../../engine/engineErrors';
import * as ops from '../operations';
import { createKeyedNaming } from '../scene/resultNames';
import { APP_BUILD_POLICY, buildSceneObject } from '../scene/sceneObjects';

const naming = createKeyedNaming((key) => key, { color: (hex) => hex, structure: (_r, id) => id });
const ctx: ops.OperationContext = { policy: APP_BUILD_POLICY, newId: () => 'm1', naming };

describe('simplificar con pérdida de volumen', () => {
  beforeAll(async () => { await initManifoldEngine(); });

  it('avisa con el porcentaje cuando la esfera pierde más del umbral', async () => {
    const mesh = await createPrimitiveMesh('sphere', { radius: 20, segments: 64 });
    const obj = buildSceneObject({ id: 's', name: 'Esfera', source: 'primitive', mesh });
    // A 5 mm el resultado es destructivo (no se aplicaría): se fuerza para medir el aviso del resultado aplicado.
    const change = await ops.simplifyObject(ctx, obj, { mode: 'tolerance', toleranceMm: 5, allowDestructive: true });
    const after = change.patches[0].patch.mesh!;
    const pct = (100 * (computeMeshStats(after).volumeMm3 - computeMeshStats(mesh).volumeMm3)) / computeMeshStats(mesh).volumeMm3;
    expect(Math.abs(pct)).toBeGreaterThan(OPERATION_DEFAULTS.simplify.volumeWarnPct);
    expect(change.warnings).toEqual([{ code: 'SIMPLIFY_VOLUME_CHANGED', params: { pct: Math.round(pct * 10) / 10 } }]);
    expect(localizeEngineWarning('es', change.warnings[0])).toContain(String(Math.round(pct * 10) / 10).replace('.', ','));
  });

  it('no avisa si el volumen casi no cambia', async () => {
    const mesh = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
    const obj = buildSceneObject({ id: 'b', name: 'Caja', source: 'primitive', mesh });
    const change = await ops.simplifyObject(ctx, obj, 0.1);
    expect(change.warnings).toEqual([]);
  });
});
