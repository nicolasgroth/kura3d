/**
 * @file src/core/__tests__/splitOperations.test.ts
 * @description Operación de escena "dividir para imprimir": reemplaza el objeto por piezas armadas en
 * su lugar con nombre por código de rejilla y `metadata.split` (armado, impresión y placa), y la tarea
 * del Worker reporta el avance por corte y resuelve los nombres en el hilo principal.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initManifoldEngine, manifoldToMeshData, normalizeMeshToBed } from '../../engine';
import type { SceneObject } from '../../types/kura';
import * as ops from '../operations';
import { handleEngineRequest } from '../operations/engineWorkerHost';
import type { EngineTaskResponse } from '../operations/engineWire';
import { createKeyedNaming } from '../scene/resultNames';
import { APP_BUILD_POLICY, buildSceneObject } from '../scene/sceneObjects';

const naming = createKeyedNaming((key) => key, { color: (hex) => hex, structure: (_r, id) => id });
let counter = 0;
const ctx: ops.OperationContext = { policy: APP_BUILD_POLICY, newId: () => `s_${++counter}`, naming };
const BED = { widthMm: 250, depthMm: 250, heightMm: 250 };
let column: SceneObject;

beforeAll(async () => {
  const wasm = await initManifoldEngine();
  const raw = wasm.Manifold.cylinder(600, 50, 50, 48);
  const up = raw.rotate([-90, 0, 0]);
  raw.delete();
  const mesh = normalizeMeshToBed(manifoldToMeshData(up));
  up.delete();
  column = { ...buildSceneObject({ id: 'col', name: 'Columna', source: 'imported', mesh, position: [10, 0, -5] }) };
});

describe('executeBedSplit', () => {
  it('reemplaza el objeto por piezas nombradas, armadas en su lugar y con metadata de impresión', async () => {
    const plan = await ops.planSplitForBed(ctx, column, BED);
    const phases: string[] = [];
    const { result, change } = await ops.executeBedSplit({ ...ctx, onProgress: (p) => phases.push(p) }, column, plan, { bed: BED });
    expect(change.removedIds).toEqual(['col']);
    expect(result.parts.map((p) => p.name)).toEqual(plan.pieces.map((p) => `Columna · ${p.code}`));
    expect(phases).toEqual(plan.planes.map((_, i) => `cut:${i + 1}/${plan.planes.length}`));
    for (const p of result.parts) {
      expect(p.position).toEqual(p.metadata?.split?.assembly.position);
      expect(p.metadata?.split?.groupId).toBe('col');
      expect(p.metadata?.split?.print.plate).toBeGreaterThanOrEqual(0);
      expect(p.position[0]).toBeCloseTo(10, 3);
      expect(p.position[2]).toBeCloseTo(-5, 3);
    }
    expect(result.joints.length).toBe(result.parts.length - 1);
    // Cada pieza sabe con qué vecina se une y por cuál unión.
    const first = result.parts[0].metadata?.split;
    expect(first?.jointPartners).toEqual([{ label: result.joints[0].label, code: result.joints[0].b.code }]);
  });

  it('corre en el Worker con avance por corte y nombres diferidos', async () => {
    const plan = await ops.planSplitForBed(ctx, column, BED);
    const responses: EngineTaskResponse[] = [];
    await handleEngineRequest(
      { type: 'run', id: 1, task: 'splitForBed', args: { obj: column, plan, options: { bed: BED } }, policy: APP_BUILD_POLICY },
      (r) => responses.push(structuredClone(r)),
    );
    const cuts = responses.filter((r) => r.type === 'progress' && r.phase.startsWith('cut:'));
    expect(cuts).toHaveLength(plan.planes.length);
    const done = responses.find((r) => r.type === 'done');
    expect(done && done.type === 'done' && done.names.every((n) => n.method === 'splitPart')).toBe(true);
  });
});
