/**
 * @file src/core/__tests__/smoothOperation.test.ts
 * @description Operación y tarea `smooth` del motor: un solo parche (un paso de deshacer) con la
 * malla suavizada y estadísticas, mismo resultado en el Worker (buffers transferidos) que en proceso,
 * progreso por iteración, error tipado `SMOOTH_DAMAGE` a través del límite y cambio vacío cuando no
 * hay nada que mover.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initManifoldEngine, isEngineError } from '../../engine';
import { thinFold, uvSphere, withRadialNoise } from '../../engine/__tests__/smoothFixtures';
import { createEngineClient } from '../operations/engineClient';
import { runEngineTaskInProcess } from '../operations/engineTasks';
import { smoothObject } from '../operations/smoothOperations';
import { createKeyedNaming } from '../scene/resultNames';
import { APP_BUILD_POLICY, buildSceneObject, makeId } from '../scene/sceneObjects';
import { FakeEngineWorker } from './fakeEngineWorker';

const naming = createKeyedNaming((key) => key, { color: (hex) => hex, structure: (_r, id) => id });
const ctx = () => ({ policy: APP_BUILD_POLICY, newId: () => makeId('mesh'), naming });
const sphereObj = () =>
  buildSceneObject({ id: 's', name: 'Esfera', source: 'imported', mesh: withRadialNoise(uvSphere(20, 48, 24), 0.1) });

describe('operación smooth', () => {
  beforeAll(async () => { await initManifoldEngine(); });

  it('devuelve un solo parche con malla y estadísticas nuevas, y el informe', () => {
    const obj = sphereObj();
    const { change, report } = smoothObject(ctx(), obj);
    expect(change.patches).toHaveLength(1);
    expect(change.added).toEqual([]);
    expect(change.removedIds).toEqual([]);
    const patch = change.patches[0].patch;
    expect(patch.mesh!.indices.length).toBe(obj.mesh.indices.length);
    expect(patch.stats!.triangles).toBe(obj.stats.triangles);
    expect(patch.stats!.isManifold).toBe(true);
    expect(report.movedVertices).toBeGreaterThan(0);
    // La entrada queda intacta (deshacer vuelve a ella).
    expect(obj.mesh.positions).toEqual(sphereObj().mesh.positions);
  });

  it('en el Worker da lo mismo que en proceso, transfiere buffers e informa avance', async () => {
    const obj = sphereObj();
    const args = { obj, options: { iterations: 5 } };
    const local = await runEngineTaskInProcess(ctx(), 'smooth', args);
    const worker = new FakeEngineWorker();
    const phases: string[] = [];
    const remote = await createEngineClient(() => worker).run(ctx(), 'smooth', args, (p) => phases.push(p)).promise;
    expect(Array.from(remote.change.patches[0].patch.mesh!.positions)).toEqual(Array.from(local.change.patches[0].patch.mesh!.positions));
    expect(remote.report.volumeChangePct).toBeCloseTo(local.report.volumeChangePct, 9);
    expect(worker.tasks).toEqual(['smooth']);
    expect(worker.transfers[0].length).toBeGreaterThan(0);
    expect(phases).toEqual(expect.arrayContaining(['smooth:1/5', 'smooth:5/5', 'smooth:check']));
  });

  it('SMOOTH_DAMAGE cruza el límite del Worker con su código', async () => {
    const fold = buildSceneObject({ id: 'f', name: 'Pliegue', source: 'imported', mesh: await thinFold() });
    const run = createEngineClient(() => new FakeEngineWorker()).run(ctx(), 'smooth', {
      obj: fold,
      options: { preserveSharpEdges: false, iterations: 60, onDamage: 'error' },
    });
    let err: unknown;
    try { await run.promise; } catch (e) { err = e; }
    expect(isEngineError(err) && err.code === 'SMOOTH_DAMAGE').toBe(true);
  });

  it('sin vértices que mover: sin parches, con aviso', () => {
    const { change } = smoothObject(ctx(), sphereObj(), { zone: { triangles: [] } });
    expect(change.patches).toEqual([]);
    expect(change.warnings.map((w) => w.code)).toEqual(['SMOOTH_NO_EFFECT']);
  });
});
