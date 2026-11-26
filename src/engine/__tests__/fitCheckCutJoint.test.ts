/**
 * @file src/engine/__tests__/fitCheckCutJoint.test.ts
 * @description Comprobar encaje tras Dividir: dos piezas del mismo corte, en posición de armado y en contacto
 * por su cara de corte, se clasifican aparte («unión del corte») y no cuentan como justas; las piezas que no
 * son pareja o no están en posición de armado siguen marcándose como justas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { MeshData, SceneObject, SplitPartMetadata, Vec3 } from '../../types/kura';
import { createPrimitiveMesh } from '../primitives';
import { runFitCheck } from '../fitCheck';
import { makeObject } from './geometryTestUtils';

const box = (w: number, h: number, d: number) => createPrimitiveMesh('box', { width: w, height: h, depth: d });

function part(id: string, mesh: MeshData, position: Vec3, code: string, partner: string | null, assembly: Vec3, groupId = 'g1'): SceneObject {
  const split: SplitPartMetadata = {
    groupId, code, cell: [0, 0, 0],
    assembly: { position: assembly, rotation: [0, 0, 0] },
    print: { position: [0, 0, 0], rotation: [0, 0, 0], plate: 1, downFace: '-y' },
    jointLabels: [],
    ...(partner ? { jointPartners: [{ label: '1', code: partner }] } : {}),
  };
  return makeObject(id, mesh, { position, name: id, metadata: { split } });
}

describe('Comprobar encaje: unión del corte', () => {
  it('dos mitades en posición de armado, en contacto, no cuentan como justas', async () => {
    const m = await box(10, 10, 10);
    const a = part('A1', m, [0, 0, 0], 'A1', 'B1', [0, 0, 0]);
    const b = part('B1', m, [10, 0, 0], 'B1', 'A1', [10, 0, 0]);
    const r = await runFitCheck({ objects: [a, b] });
    expect(r.pairs[0].status).toBe('cutJoint');
    expect(r.summary.tight).toBe(0);
    expect(r.summary.cutJoints).toBe(1);
    expect(r.summary.message.key).toBe('fitCheck.summary.clean');
  });

  it('la posición de armado vale aunque todo el grupo se haya movido junto', async () => {
    const m = await box(10, 10, 10);
    const a = part('A1', m, [50, 0, 20], 'A1', 'B1', [0, 0, 0]);
    const b = part('B1', m, [60, 0, 20], 'B1', 'A1', [10, 0, 0]);
    expect((await runFitCheck({ objects: [a, b] })).pairs[0].status).toBe('cutJoint');
  });

  it('piezas del mismo corte pero fuera de la posición de armado siguen siendo justas', async () => {
    const m = await box(10, 10, 10);
    const a = part('A1', m, [0, 0, 0], 'A1', 'B1', [0, 0, 0]);
    const b = part('B1', m, [10, 0, 0], 'B1', 'A1', [30, 0, 0]);
    expect((await runFitCheck({ objects: [a, b] })).pairs[0].status).toBe('tight');
  });

  it('piezas que no son pareja, o de otro corte, siguen siendo justas', async () => {
    const m = await box(10, 10, 10);
    const a = part('A1', m, [0, 0, 0], 'A1', null, [0, 0, 0]);
    const b = part('C1', m, [10, 0, 0], 'C1', null, [10, 0, 0]);
    expect((await runFitCheck({ objects: [a, b] })).pairs[0].status).toBe('tight');
    const c = part('A1', m, [0, 0, 0], 'A1', 'B1', [0, 0, 0], 'g1');
    const d = part('B1', m, [10, 0, 0], 'B1', 'A1', [10, 0, 0], 'g2');
    expect((await runFitCheck({ objects: [c, d] })).pairs[0].status).toBe('tight');
  });
});
