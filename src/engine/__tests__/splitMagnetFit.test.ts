/**
 * @file src/engine/__tests__/splitMagnetFit.test.ts
 * @description Comprobar encaje y registro guardado tras dividir con imanes: las piezas en posición de armado son
 * «unión del corte» (ni choque ni justas), el registro de la unión guarda imán, cantidad, posiciones y polaridad,
 * pasa la validación del `.kura` y la revalidación del armado no traba la unión de imanes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { ManifoldToplevel } from 'manifold-3d';
import { DEFAULT_PRINTER_PROFILES, type SceneObject, type SplitPartMetadata } from '../../types/kura';
import { initManifoldEngine } from '../manifoldKernel';
import { runFitCheck } from '../fitCheck';
import { executeBedSplitGeometry, jointRecord, planBedSplit, validateStoredAssembly } from '../split';
import { magnetConnector } from '../split/splitMagnet';
import { MAGNET_DEFAULTS } from '../../core/addons/magnetPocket';
import { decodeProject, encodeProject } from '../../project/projectCodec';
import { makeObject } from './geometryTestUtils';
import { objFromM } from './splitModelHarness';

let w: ManifoldToplevel;
beforeAll(async () => {
  w = await initManifoldEngine();
});

async function splitBlock(): Promise<SceneObject[]> {
  const obj = objFromM(w.Manifold.cube([40, 60, 30], true), 'bloque');
  const plan = await planBedSplit(obj, { widthMm: 200, depthMm: 200, heightMm: 50 }, { connector: magnetConnector(MAGNET_DEFAULTS, 'auto'), axes: ['y'], allowRotation: false });
  const res = await executeBedSplitGeometry(obj, plan);
  const records = res.joints.map(jointRecord);
  return res.parts.map((p, i) => {
    const split: SplitPartMetadata = {
      groupId: 'g1', code: p.code, cell: p.cell, assembly: p.assembly,
      print: { position: [0, 0, 0], rotation: [0, 0, 0], plate: 0, downFace: '-y' },
      jointLabels: p.jointLabels,
      jointPartners: res.joints.filter((j) => j.a.part === i || j.b.part === i).map((j) => ({ label: j.label, code: j.a.part === i ? j.b.code : j.a.code })),
      joints: records.filter((r) => r.a === p.code || r.b === p.code),
    };
    return makeObject(p.code, p.mesh, { position: p.assembly.position, rotation: p.assembly.rotation, name: p.code, metadata: { split } });
  });
}

describe('imanes: encaje y registro', () => {
  it('en posición de armado las dos piezas son «unión del corte», sin choque ni justas', async () => {
    const parts = await splitBlock();
    const r = await runFitCheck({ objects: parts });
    expect(r.pairs).toHaveLength(1);
    expect(r.pairs[0].status).toBe('cutJoint');
    expect(r.summary.tight).toBe(0);
    expect(r.summary.cutJoints).toBe(1);
  }, 60_000);

  it('el registro guarda el imán y pasa la validación del proyecto; revalidar no traba la unión', async () => {
    const parts = await splitBlock();
    const rec = parts[0].metadata!.split!.joints![0];
    expect(rec.connector).toMatchObject({ type: 'magnet', magnet: { shape: 'round', sizeMm: 5, heightMm: 2, clearanceMm: 0.2, depthClearanceMm: 0.2 } });
    expect(rec.connector).not.toHaveProperty('countAuto');
    expect(rec.magnets).toMatchObject({ count: 2, polarity: 'opposite' });
    expect(rec.connectorCenters).toHaveLength(2);
    // Ida y vuelta por el .kura: el esquema estricto acepta el registro con imanes
    const back = decodeProject(encodeProject({
      objects: parts, selectedIds: [], past: [], future: [], unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0],
      customBedDimensions: null, sectionPlane: { enabled: false, heightMm: 10 }, snapGridMm: 0,
    }));
    expect(back.objects[0].metadata?.split?.joints?.[0].magnets).toEqual(rec.magnets);
    const report = validateStoredAssembly(parts);
    expect(report.blocked).toEqual([]);
    expect(report.clashes).toEqual([]);
  }, 60_000);
});
