/**
 * @file src/engine/__tests__/smoothRealModels.perf.test.ts
 * @description Criterio de éxito de «Suavizar malla» en modelos reales: con intensidad 0,5 y 5 pasadas, cada modelo se
 * aplica con intensidad efectiva ≥ 0,4 en al menos el 95 % de los vértices movibles, sigue cerrado con la misma
 * topología (mismo género), cambia el volumen menos de ±0,5 % y no trae triángulos invertidos ni autointersecciones
 * nuevas. Lee los modelos de la carpeta local `.eval-tmp/modelos/` del repositorio principal (modelos de terceros que
 * no se versionan) y se omite si no existe. Solo corre con `npm run test:perf` (`KURA_MODELS=a.stl,b.stl` elige).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { parseModelFile } from '../io/modelImport';
import { isClosedMesh } from '../meshClosure';
import { signedVolume, smoothMesh } from '../smooth';
import { detectSmoothDamage } from '../smooth/smoothDamage';
import { buildSmoothGraph } from '../smooth/smoothGraph';
import { resolveSmoothOptions } from '../smooth/smoothOptions';

interface NodeFs {
  existsSync(path: string): boolean;
  readFileSync(path: string): Uint8Array;
}
interface NodeProcess {
  env: Record<string, string | undefined>;
  getBuiltinModule(id: string): NodeFs;
}
const nodeProcess = (globalThis as unknown as { process: NodeProcess }).process;
const { existsSync, readFileSync } = nodeProcess.getBuiltinModule('node:fs');

const MODELS_DIR = 'G:/proyectos/kura3d/.eval-tmp/modelos';
const DEFAULT_MODELS = ['obj_1_OcarinaDeluxe.stl', 'obj_1_tinker.obj.stl', 'Spiral+Phoenix+12cm+STL.stl'];
const MODELS = nodeProcess.env.KURA_MODELS ? nodeProcess.env.KURA_MODELS.split(',') : DEFAULT_MODELS;
const STRENGTH = 0.5;
const ITERATIONS = 5;
/** Tiempo máximo por modelo (ms): holgado para una máquina cargada; el informe imprime el real. */
const MAX_MS = 60_000;

function loadMesh(file: string): MeshData {
  const buf = readFileSync(`${MODELS_DIR}/${file}`);
  const model = parseModelFile(file, buf.slice().buffer as ArrayBuffer, {
    limits: { maxFileBytes: 1e9, maxUncompressedBytes: 2e9, maxTriangles: 2e7, maxParts: 20_000 },
  });
  const parts = model.parts.filter((p) => !p.isHole);
  // Los STL de la prueba son de una sola pieza; con varias se toma la más grande.
  return parts.reduce((a, b) => (b.mesh.indices.length > a.mesh.indices.length ? b : a)).mesh;
}

describe.skipIf(!existsSync(MODELS_DIR))('Suavizar en modelos reales (intensidad 0,5, 5 pasadas)', () => {
  it.each(MODELS)('%s', (file) => {
    if (!existsSync(`${MODELS_DIR}/${file}`)) return;
    const mesh = loadMesh(file);
    const closedBefore = isClosedMesh(mesh);
    const t0 = performance.now();
    const { mesh: out, report } = smoothMesh(mesh, { strength: STRENGTH, iterations: ITERATIONS });
    const ms = performance.now() - t0;
    const volPct = (100 * (signedVolume(out.positions, out.indices) - signedVolume(mesh.positions, mesh.indices))) /
      Math.abs(signedVolume(mesh.positions, mesh.indices));
    const graph = buildSmoothGraph(mesh, resolveSmoothOptions());
    const moved = new Uint8Array(mesh.positions.length / 3).fill(1);
    const damage = detectSmoothDamage(mesh.positions, out.positions, mesh.indices, graph.weld, moved);
    console.info(
      `[suavizar reales] ${file}: ${mesh.indices.length / 3} tri, ${(ms / 1000).toFixed(2)} s, ` +
        `intensidad global ${report.appliedStrength}, cobertura ≥0,8·pedida ${(100 * report.strengthCoverage).toFixed(2)} %, ` +
        `protegidos por daño ${report.damageProtectedVertices} de ${report.movableVertices} movibles, ` +
        `movidos ${report.movedVertices}, despl. máx ${report.maxDisplacementMm.toFixed(3)} mm, volumen ${volPct.toFixed(4)} %, ` +
        `rondas ${report.attempts.length} ${JSON.stringify(report.attempts)}`,
    );
    expect(out.indices).toEqual(mesh.indices); // misma topología ⇒ mismo género
    expect(isClosedMesh(out)).toBe(closedBefore);
    expect(damage).toEqual({ invertedTriangles: 0, newIntersections: 0 });
    expect(Math.abs(volPct)).toBeLessThan(0.5);
    expect(report.appliedStrength).toBeGreaterThanOrEqual(0.4);
    expect(report.strengthCoverage).toBeGreaterThanOrEqual(0.95);
    expect(ms).toBeLessThan(MAX_MS);
  }, 600_000);
});
