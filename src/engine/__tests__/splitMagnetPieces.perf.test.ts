/**
 * @file src/engine/__tests__/splitMagnetPieces.perf.test.ts
 * @description Dividir una figura orgánica real (Spiral Phoenix de la carpeta local de evaluación, que no se versiona;
 * si falta, se omite) con la misma cama con imanes y sin conectores: cuenta piezas del plan y del resultado y
 * uniones: con imanes debe dar las mismas piezas que sin conector (en cama de 70 daba 5 y 4: el plan sumaba a los
 * imanes el saliente mínimo de los machos). Solo corre con `npm run test:perf`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { readSTL } from '../io/stl';
import { initManifoldEngine } from '../manifoldKernel';
import { executeBedSplitGeometry, planBedSplit, type SplitConnectorOptions } from '../split';
import { magnetConnector } from '../split/splitMagnet';
import { MAGNET_DEFAULTS } from '../../core/addons/magnetPocket';
import { normalizeMeshToBed } from '../primitives';
import { makeObject } from './geometryTestUtils';

interface NodeFs {
  existsSync(path: string): boolean;
  readFileSync(path: string): Uint8Array;
}
const fs = (globalThis as unknown as { process: { getBuiltinModule: (id: string) => NodeFs } }).process.getBuiltinModule('node:fs');
const MODEL = 'G:/proyectos/kura3d/.eval-tmp/modelos/Spiral+Phoenix+12cm+STL.stl';
const present = fs.existsSync(MODEL);

describe('dividir: mismas piezas con y sin imanes (Spiral Phoenix)', () => {
  it.skipIf(!present)('cuenta piezas del plan y del resultado con imanes y sin conector', async () => {
    await initManifoldEngine();
    const bytes = fs.readFileSync(MODEL);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const mesh = normalizeMeshToBed(readSTL(buffer, 'phoenix.stl').parts[0].mesh);
    const obj = makeObject('phoenix', mesh);
    const dowel: SplitConnectorOptions = { type: 'dowel', size: 4, sizeAuto: true, depth: 6, tolerance: 0.25, count: 2 };
    const connectors: Array<[string, SplitConnectorOptions | null]> = [['sin', null], ['espiga', dowel], ['imanes', magnetConnector(MAGNET_DEFAULTS, 'auto')]];
    const beds = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env.PHOENIX_BEDS;
    for (const side of beds ? beds.split(',').map(Number) : [100, 80, 70, 60, 50]) {
      const bed = { widthMm: side, depthMm: side, heightMm: side };
      const out: string[] = [];
      const parts: Record<string, number> = {};
      for (const [name, connector] of connectors) {
        const plan = await planBedSplit(obj, bed, { connector });
        const res = await executeBedSplitGeometry(obj, plan);
        parts[name] = res.parts.length;
        const c = plan.counts;
        const planes = plan.planes.map((q) => `${q.axis}${q.position.toFixed(1)}`).join(',');
        out.push(`${name}: celdas ${plan.pieces.length} (${c.x}×${c.y}×${c.z}; ${planes}), previa ${plan.occupancy?.pieces ?? '-'} (exacta ${plan.occupancy?.exact}), resultado ${res.parts.length}, uniones ${res.joints.length}, avisos ${[...new Set(res.warnings.map((w) => w.code))].join(',')}`);
      }
      console.info(`cama ${side}: \n  ${out.join('\n  ')}`);
    }
    expect(present).toBe(true);
  }, 600_000);
});
