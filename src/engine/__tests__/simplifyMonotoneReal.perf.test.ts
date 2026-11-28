/**
 * @file src/engine/__tests__/simplifyMonotoneReal.perf.test.ts
 * @description Monotonía de «Por tolerancia» sobre un modelo real de la carpeta local de evaluación (la ocarina; no
 * se versiona: si falta, se omite). Imprime la tabla tolerancia → triángulos aplicados (y lo pedido, cuando se aplicó
 * la versión segura) y exige que más tolerancia nunca deje más triángulos. Solo corre con `npm run test:perf`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { readSTL } from '../io/stl';
import { repairMeshData } from '../repair';
import { isMeshClosed } from '../repair/meshTopology';
import { simplifyMeshDetailed } from '../simplify';
import { makeObject } from './geometryTestUtils';

interface NodeFs {
  existsSync(path: string): boolean;
  readFileSync(path: string): Uint8Array;
}
const fs = (globalThis as unknown as { process: { getBuiltinModule: (id: string) => NodeFs } }).process.getBuiltinModule('node:fs');
const FILE = 'G:/proyectos/kura3d/.eval-tmp/modelos/obj_1_OcarinaDeluxe.stl';
const TOLERANCES = [0.5, 1, 2, 3, 4, 6, 8, 10, 12, 15, 20];

describe('Simplificar «Por tolerancia»: monotonía en la ocarina', () => {
  it.skipIf(!fs.existsSync(FILE))('más tolerancia nunca deja más triángulos', async () => {
    const bytes = fs.readFileSync(FILE);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    let mesh = readSTL(buffer, 'ocarina.stl').parts[0].mesh;
    if (!isMeshClosed(mesh.positions, mesh.indices)) mesh = repairMeshData(mesh).mesh;
    const obj = makeObject('ocarina', mesh);
    const rows: string[] = [];
    const applied: number[] = [];
    for (const toleranceMm of TOLERANCES) {
      const { report: r } = await simplifyMeshDetailed(obj, { mode: 'tolerance', toleranceMm });
      applied.push(r.trianglesAfter);
      rows.push(`| ${toleranceMm} | ${r.appliedVariant} | ${r.trianglesBefore} → ${r.trianglesAfter} | ` +
        `pedido ${r.requested?.triangles ?? '—'} | segura tol ${r.safe ? r.safe.toleranceMm.toFixed(3) : '—'} | ` +
        `${(r.destructive ?? []).join(',') || '—'} | ${r.maxDeviationMm.toFixed(2)} mm |`);
    }
    console.info(rows.join('\n'));
    for (let i = 1; i < applied.length; i++) expect(applied[i]).toBeLessThanOrEqual(applied[i - 1]);
  }, 900_000);
});
