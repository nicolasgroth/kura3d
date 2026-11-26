/**
 * @file src/engine/__tests__/simplifyMeasure.perf.test.ts
 * @description Medición (etapa 0 de `docs/diseno/FORMAS_SIMPLES.md`): cuánto baja `Manifold.simplify` los
 * triángulos sin perder forma, cuánto más daría re-triangular caras planas y qué fracción está en cilindros o
 * esferas. Corre sobre piezas que genera la app y, si existe la carpeta local `.eval-tmp/modelos/` del repositorio
 * principal (modelos de terceros que no se versionan), sobre esos archivos. Escribe los números en
 * `.eval-tmp/medicion-simplificar/` y en consola. Solo corre con `npm run test:perf`
 * (`KURA_MODELS=a.stl,b.3mf` elige archivos).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { ManifoldToplevel } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { primitiveMesh } from '../../core/operations/creationOperations';
import { runRecipe } from '../../core/recipes/run/executeRecipe';
import { EXAMPLES, clone } from '../../core/recipes/__tests__/fixtures';
import { expectOk, testContext } from '../../core/recipes/__tests__/runSupport';
import type { MeshData } from '../../types/kura';
import { parseModelFile } from '../io/modelImport';
import { initManifoldEngine } from '../manifoldKernel';
import { createMetricThread } from '../threads';
import { combine, measureBody, type BodyReport } from './simplifyMeasureSupport';

interface NodeFs {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options: { recursive: boolean }): void;
  readFileSync(path: string): Uint8Array;
  writeFileSync(path: string, data: string): void;
}
interface NodeProcess {
  env: Record<string, string | undefined>;
  getBuiltinModule(id: string): NodeFs;
}
const nodeProcess = (globalThis as unknown as { process: NodeProcess }).process;
const { existsSync, mkdirSync, readFileSync, writeFileSync } = nodeProcess.getBuiltinModule('node:fs');
const join = (dir: string, file: string) => `${dir}/${file}`;

const MODELS_DIR = 'G:/proyectos/kura3d/.eval-tmp/modelos';
const OUT_DIR = 'G:/proyectos/kura3d/.eval-tmp/medicion-simplificar';
/** Subconjunto por defecto: un archivo por modelo, sin los de más de ~1,2 M de triángulos. */
const DEFAULT_MODELS = [
  'llaveros.3mf', 'obj_1_tinker.obj.stl', 'ocarina.3mf', 'Starwars_AT-AT.3mf', 'NeroBlackClover_SeparatePlate.3mf',
  'Sagradocorazon.3mf', 'Spiral+Phoenix+12cm+STL.stl', 'obj_1_obj_1_300mm helmet.stl', 'busto_anubis_gotico.stl',
  'frierenmw.stl', 'pack_fidget_NG.3mf',
];
const MODELS = nodeProcess.env.KURA_MODELS ? nodeProcess.env.KURA_MODELS.split(',') : DEFAULT_MODELS;

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await initManifoldEngine();
  mkdirSync(OUT_DIR, { recursive: true });
});

function report(name: string, bodies: BodyReport[]) {
  const r = combine(bodies);
  writeFileSync(join(OUT_DIR, `${name.replace(/[^\w.+-]/g, '_')}.json`), JSON.stringify({ name, ...r }, null, 1));
  const rows = r.rows.map((x) =>
    `  tol ${x.tol}: ${x.tris} tri (${((x.tris / r.tris) * 100).toFixed(1)} %), vol ${x.volPct.toFixed(4)} %, ` +
    `desv ${x.hausdorffMm.toFixed(4)} mm, cerrada ${x.closed}, género ${x.genusSame}, ${(x.ms / 1000).toFixed(1)} s`);
  console.log([
    `${name}: ${r.tris} tri en ${r.bodies} cuerpos (${r.skippedBodies} omitidos)`,
    `  plano: ${r.planarTris} tri en ${r.planarRegions} regiones, mínimo ${r.planarMin}`,
    `  plano tras 0,001: ${r.simpPlanarTris} tri, mínimo ${r.simpPlanarMin}`,
    `  primitivas: cilindro ${r.prim.cylinderTris} tri (${r.prim.cylinders}), esfera ${r.prim.sphereTris} tri ` +
      `(${r.prim.spheres}), suave sin ajuste ${r.prim.unfitTris}`,
    ...rows,
  ].join('\n'));
  return r;
}

describe('medición de Simplificar: piezas de la app', () => {
  const pieces: Array<[string, () => Promise<MeshData>]> = [
    ['app-cubo', () => primitiveMesh('box', {})],
    ['app-cilindro-64', () => primitiveMesh('cylinder', { segments: 64 })],
    ['app-esfera', () => primitiveMesh('sphere', {})],
    ['app-caja-asistente', async () => {
      const res = expectOk(await runRecipe(testContext(), { recipe: clone(EXAMPLES.caja), options: { bed: { w: 220, d: 220, h: 250 } } }));
      return res.change.added[0].mesh;
    }],
    ['app-texto', () => primitiveMesh('text', { text: 'Kura3D', fontSize: 10, height: 2 })],
    ['app-rosca-M8', () => createMetricThread({ kind: 'bolt', diameterMm: 8, lengthMm: 16, clearanceMm: 0 })],
  ];
  it.each(pieces)('%s', async (name, make) => {
    const r = report(name, [measureBody(wasm, await make())]);
    expect(r.skippedBodies).toBe(0);
    for (const row of r.rows) expect(row.closed).toBe(true);
  }, 120_000);
});

describe.skipIf(!existsSync(MODELS_DIR))('medición de Simplificar: modelos locales', () => {
  it.each(MODELS)('%s', (file) => {
    const path = join(MODELS_DIR, file);
    if (!existsSync(path)) return;
    const buf = readFileSync(path);
    const model = parseModelFile(file, buf.slice().buffer as ArrayBuffer, {
      limits: { maxFileBytes: 1e9, maxUncompressedBytes: 2e9, maxTriangles: 2e7, maxParts: 20_000 },
    });
    // Las instancias repetidas de un 3MF comparten malla: se mide una vez.
    const meshes = [...new Set(model.parts.filter((p) => !p.isHole).map((p) => p.mesh))];
    const r = report(file, meshes.map((m) => measureBody(wasm, m)));
    expect(r.bodies).toBeGreaterThan(0);
  }, 1_800_000);
});
