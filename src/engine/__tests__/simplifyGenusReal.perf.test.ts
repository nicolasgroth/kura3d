/**
 * @file src/engine/__tests__/simplifyGenusReal.perf.test.ts
 * @description Medición de Simplificar «Por cantidad» sobre un modelo real con agujeros pasantes (fénix de la
 * carpeta local de evaluación, que no se versiona; si falta, se omite): objetivo 5000 triángulos. Imprime género
 * antes → después, triángulos y avisos; si pierde agujeros, el aviso de género tiene que estar. Solo corre con
 * `npm run test:perf`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { readSTL } from '../io/stl';
import { bodyGenus, simplifyMeshDetailed } from '../simplify';
import { searchTargetTolerance } from '../simplify/simplifyTarget';
import { initManifoldEngine, meshDataToManifold } from '../manifoldKernel';
import { makeObject } from './geometryTestUtils';

interface NodeFs {
  existsSync(path: string): boolean;
  readFileSync(path: string): Uint8Array;
}
const fs = (globalThis as unknown as { process: { getBuiltinModule: (id: string) => NodeFs } }).process.getBuiltinModule('node:fs');
const MODEL = 'G:/proyectos/kura3d/.eval-tmp/modelos/Spiral+Phoenix+12cm+STL.stl';
const present = fs.existsSync(MODEL);

describe('Simplificar por cantidad: fénix (modelo real)', () => {
  it.skipIf(!present)('objetivo 5000: conserva los agujeros dentro de la holgura o avisa', async () => {
    const bytes = fs.readFileSync(MODEL);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const mesh = readSTL(buffer, 'phoenix.stl').parts[0].mesh;
    const t0 = performance.now();
    const { report: r } = await simplifyMeshDetailed(makeObject('f', mesh), { mode: 'target', targetTriangles: 5000 });
    console.info(`fénix: ${r.trianglesBefore} → ${r.trianglesAfter} tri, género ${r.genusBefore} → ${r.genusAfter}, ` +
      `${JSON.stringify(r.target)}, avisos ${r.warnings.join(',')}, ${(performance.now() - t0).toFixed(0)} ms`);
    // Antes de esta corrección: búsqueda sin guardia de género y `Manifold.genus()` (no suma por cuerpo).
    const wasm = await initManifoldEngine();
    const solid = meshDataToManifold(wasm, mesh);
    const plain = searchTargetTolerance(solid, 5000, 0.001, 50, {});
    console.info(`  sin guardia: ${plain.best.numTri()} tri, genus() ${solid.genus()} → ${plain.best.genus()}, por cuerpo ${bodyGenus(solid)} → ${bodyGenus(plain.best)}, ${JSON.stringify(plain.info)}`);
    plain.best.delete();
    solid.delete();
    if (r.genusAfter !== r.genusBefore) expect(r.warnings).toContain('genus_changed');
    else expect(r.warnings).not.toContain('genus_changed');
  }, 120_000);
});
