/**
 * @file src/engine/__tests__/splitConnectorRoom.test.ts
 * @description Registro global de conectores (`ConnectorRoom`) y cierre seguro del armado
 * (`settleAssembly`) de "dividir para imprimir": un conector no se acepta si deja menos de la pared
 * mínima contra los de otras uniones o contra el exterior; con firmeza activa el cubo de 440 sigue
 * reforzado pero sin choques; y `fix.applied` solo es verdadero si el informe final queda armable.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { ManifoldToplevel } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { normalizeMeshToBed } from '../primitives';
import { executeBedSplitGeometry, planBedSplit, type SplitConnectorOptions } from '../split';
import { connectorClashes } from '../split/assemblyConnectors';
import type { SplitBody } from '../split/splitBodies';
import { ConnectorRoom } from '../split/splitConnectorRoom';
import { makeObject } from './geometryTestUtils';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

const body = (id: number, m: ReturnType<ManifoldToplevel['Manifold']['cube']>): SplitBody =>
  ({ id, cell: [0, 0, 0], code: `P${id}`, m, adds: [], subs: [], labels: [] });

const cube440 = () => {
  const m = w.Manifold.cube([440, 440, 440], true);
  const obj = makeObject('cubo', normalizeMeshToBed(manifoldToMeshData(m)), { position: [0, -220, 0] });
  m.delete();
  return obj;
};

describe('ConnectorRoom', () => {
  const dowel: SplitConnectorOptions = { type: 'dowel', size: 4, depth: 10, tolerance: 0.2, count: 1 };

  it('rechaza un conector que pisa uno de otra unión y acepta uno lejano o de la misma unión', () => {
    const low = body(0, w.Manifold.cube([200, 100, 200], true).translate([0, 50, 0]));
    const high = body(1, w.Manifold.cube([200, 100, 200], true).translate([0, 150, 0]));
    const room = new ConnectorRoom();
    const first = room.capsulesFor('1', 'y', 100, dowel, [[0, 100, 0]], low, high);
    expect(room.check(first, low, high)).toEqual([true]);
    room.add(first);
    // A 6 mm de eje a eje: dos radios de 4,2 se pisan
    const near = room.capsulesFor('2', 'y', 100, dowel, [[6, 100, 0]], low, high);
    expect(room.check(near, low, high)).toEqual([false]);
    // La misma unión no se compara consigo (su separación la da la ubicación)
    const same = room.capsulesFor('1', 'y', 100, dowel, [[6, 100, 0]], low, high);
    expect(room.check(same, low, high)).toEqual([true]);
    const far = room.capsulesFor('2', 'y', 100, dowel, [[40, 100, 0]], low, high);
    expect(room.check(far, low, high)).toEqual([true]);
    room.remove('1');
    expect(room.check(near, low, high)).toEqual([true]);
    low.m.delete();
    high.m.delete();
  });

  it('rechaza un conector cuya pared al exterior queda bajo el mínimo', () => {
    const low = body(0, w.Manifold.cube([200, 100, 200], true).translate([0, 50, 0]));
    const high = body(1, w.Manifold.cube([200, 100, 200], true).translate([0, 150, 0]));
    const room = new ConnectorRoom();
    // Borde en x = 100: radio 4,2 a 4,6 mm del borde deja 0,4 mm de pared
    const edge = room.capsulesFor('1', 'y', 100, dowel, [[95.4, 100, 0]], low, high);
    expect(room.check(edge, low, high)).toEqual([false]);
    const inside = room.capsulesFor('1', 'y', 100, dowel, [[90, 100, 0]], low, high);
    expect(room.check(inside, low, high)).toEqual([true]);
    low.m.delete();
    high.m.delete();
  });
});

describe('división con firmeza activa y armado final', () => {
  it('cubo 440 / tarugo suelto Ø4: sigue reforzando donde cabe y ningún par de conectores choca', async () => {
    const obj = cube440();
    const conn: SplitConnectorOptions = { type: 'loose-dowel', size: 4, depth: 10, tolerance: 0.2, count: 2 };
    const plan = await planBedSplit(obj, { widthMm: 250, depthMm: 250, heightMm: 250 }, { maxPieces: 'auto', connector: conn });
    const res = await executeBedSplitGeometry(obj, plan, { reinforceWeakJoints: true });
    const a = res.assembly!;
    expect(a.clashes).toEqual([]);
    expect(a.blocked).toEqual([]);
    expect(a.fix.applied).toBe(true);
    // Medida independiente de las cápsulas (sin exterior): ninguna pareja bajo 0,8 mm
    expect(connectorClashes(res.joints, null, [], 0.8)).toEqual([]);
    expect(res.joints.some((j) => j.connector && j.connector.size > conn.size + 1e-6)).toBe(true);
    expect(res.joints.every((j) => j.kind === 'glue' || j.connectorCenters.length > 0)).toBe(true);
  }, 120_000);

  it('cubo 440 / solape sin arreglo automático: informa el bloqueo y no lo da por arreglado', async () => {
    const obj = cube440();
    const conn: SplitConnectorOptions = { type: 'lap', size: 4, depth: 6, tolerance: 0.2, count: 1, lapHeightMm: 6 };
    const plan = await planBedSplit(obj, { widthMm: 250, depthMm: 250, heightMm: 250 }, { maxPieces: 'auto', connector: conn });
    const raw = await executeBedSplitGeometry(obj, plan, { assemblyAutoFix: false });
    expect(raw.assembly!.blocked.length).toBeGreaterThan(0);
    expect(raw.assembly!.fix.applied).toBe(false);
    expect(raw.joints.every((j) => j.kind === 'lap')).toBe(true);
    const fixed = await executeBedSplitGeometry(obj, plan, {});
    expect(fixed.assembly!.blocked).toEqual([]);
    expect(fixed.assembly!.fix.applied).toBe(true);
    // Lo pegado se avisa por unión y ofrece la alternativa de cambio de tipo
    const glued = fixed.joints.filter((j) => j.kind === 'glue').map((j) => j.label);
    expect(glued.length).toBeGreaterThan(0);
    expect(fixed.assembly!.fix.glueJoints).toEqual(expect.arrayContaining(glued));
    for (const l of glued) expect(fixed.warnings.some((x) => x.code === 'ASSEMBLY_JOINT_GLUED_FOR_ORDER' && x.params.label === l)).toBe(true);
    expect(fixed.assembly!.suggestions.some((s) => s.options.some((o) => o.startsWith('change-type:')))).toBe(true);
  }, 120_000);
});
