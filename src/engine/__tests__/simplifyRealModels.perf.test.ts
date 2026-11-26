/**
 * @file src/engine/__tests__/simplifyRealModels.perf.test.ts
 * @description Medición de Simplificar «Por cantidad» al 50 % sobre modelos reales de la carpeta local de
 * evaluación (no se versionan; cada modelo que falta se omite): ocarina, fénix, Frieren y tinker (reparado).
 * Imprime una tabla con aplicado/bloqueado, triángulos, % de volumen, desviación, género, versión segura y tiempo.
 * Frieren (género 58, túneles finos) tiene que aplicarse: perder túneles por debajo de
 * `SIMPLIFY_HOLE_LOSS_MIN_DEVIATION_MM` no es destructivo. Solo corre con `npm run test:perf`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { readSTL } from '../io/stl';
import { repairMeshData } from '../repair';
import { isMeshClosed } from '../repair/meshTopology';
import { simplifyMeshDetailed, type SimplifyReport } from '../simplify';
import { makeObject } from './geometryTestUtils';
import type { MeshData } from '../../types/kura';

interface NodeFs {
  existsSync(path: string): boolean;
  readFileSync(path: string): Uint8Array;
}
const fs = (globalThis as unknown as { process: { getBuiltinModule: (id: string) => NodeFs } }).process.getBuiltinModule('node:fs');
const DIR = 'G:/proyectos/kura3d/.eval-tmp/modelos/';
const MODELS = [
  { name: 'ocarina', file: 'obj_1_OcarinaDeluxe.stl', repair: false },
  { name: 'phoenix', file: 'Spiral+Phoenix+12cm+STL.stl', repair: false },
  { name: 'frieren', file: 'frierenmw.stl', repair: false },
  { name: 'tinker', file: 'obj_1_tinker.obj.stl', repair: true },
] as const;

function load(file: string, repair: boolean): MeshData {
  const bytes = fs.readFileSync(DIR + file);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const mesh = readSTL(buffer, file).parts[0].mesh;
  if (!repair && isMeshClosed(mesh.positions, mesh.indices)) return mesh;
  return repairMeshData(mesh).mesh;
}

function row(name: string, r: SimplifyReport, ms: number): string {
  const safe = r.safe ? `${r.safe.triangles} (−${(100 * (1 - r.safe.triangles / r.trianglesBefore)).toFixed(1)} %)` : String(r.safe ?? '—');
  return `| ${name} | ${r.applied ? 'aplicado' : 'bloqueado'} | ${(r.destructive ?? []).join(',') || '—'} | ` +
    `${r.trianglesBefore} → ${r.trianglesAfter} | ${r.volumeChangePct.toFixed(2)} % | ${r.maxDeviationMm.toFixed(3)} mm | ` +
    `${r.genusBefore} → ${r.genusAfter} | ${safe} | ${r.warnings.join(',') || '—'} | ${ms.toFixed(0)} ms |`;
}

describe('Simplificar al 50 %: modelos reales', () => {
  for (const m of MODELS) {
    const present = fs.existsSync(DIR + m.file);
    it.skipIf(!present)(`${m.name}: informe al 50 %`, async () => {
      const mesh = load(m.file, m.repair);
      const t0 = performance.now();
      const { report: r } = await simplifyMeshDetailed(makeObject(m.name, mesh), { mode: 'target', targetPercent: 50 });
      console.info(row(m.name, r, performance.now() - t0));
      if (m.name === 'frieren') {
        // Túneles finos con −0,07 % de volumen y ~0,1 mm de desviación: se aplica y se avisa.
        expect(r.applied).toBe(true);
        if (r.genusAfter !== r.genusBefore) expect(r.warnings).toContain('genus_changed');
      }
      // Una versión segura ofrecida tiene que reducir de forma apreciable.
      if (r.safe) expect(r.safe.triangles).toBeLessThan(r.trianglesBefore * 0.9);
    }, 600_000);
  }
});
