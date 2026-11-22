/**
 * @file src/engine/__tests__/splitSurfaceChange.test.ts
 * @description "Permitir cola de milano pasante": con espiga la opción cambia uniones; con cola de milano ya
 * no hay otro tipo al que cambiar, y el motor lo dice (`SPLIT_SURFACE_CHANGE_UNUSED`) en vez de callar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ManifoldToplevel } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../manifoldKernel';
import { executeBedSplitGeometry, planBedSplit, type SplitConnectorOptions } from '../split';
import { objFrom } from './splitPipeShapes';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

const dovetail: SplitConnectorOptions = { type: 'dovetail', size: 5, depth: 8, tolerance: 0.25, count: 1 };
const dowel: SplitConnectorOptions = { type: 'dowel', size: 4, depth: 8, tolerance: 0.25, count: 1 };
const bed = { widthMm: 256, depthMm: 256, heightMm: 256 };
const unused = (r: { warnings: Array<{ code: string }> }) => r.warnings.some((x) => x.code === 'SPLIT_SURFACE_CHANGE_UNUSED');

describe('cola de milano pasante', () => {
  it('cubo 440 con cola de milano: la opción no cambia nada y el resultado lo dice', async () => {
    const obj = objFrom(w.Manifold.cube([440, 440, 440], true), 'cubo');
    const plan = await planBedSplit(obj, bed, { connector: dovetail });
    const off = await executeBedSplitGeometry(obj, plan, { connector: dovetail, assemblyAllowSurfaceChange: false });
    const on = await executeBedSplitGeometry(obj, plan, { connector: dovetail, assemblyAllowSurfaceChange: true });
    expect(on.glueJoints).toBe(off.glueJoints);
    expect(unused(on)).toBe(true);
    expect(unused(off)).toBe(false);
  }, 240_000);

  it('cubo 440 con espiga: la opción sí cambia uniones y no hay aviso de "sin efecto"', async () => {
    const obj = objFrom(w.Manifold.cube([440, 440, 440], true), 'cubo');
    const plan = await planBedSplit(obj, bed, { connector: dowel });
    const off = await executeBedSplitGeometry(obj, plan, { connector: dowel, assemblyAllowSurfaceChange: false });
    const on = await executeBedSplitGeometry(obj, plan, { connector: dowel, assemblyAllowSurfaceChange: true });
    expect(on.glueJoints).toBeLessThan(off.glueJoints);
    expect(unused(on)).toBe(false);
  }, 240_000);
});
