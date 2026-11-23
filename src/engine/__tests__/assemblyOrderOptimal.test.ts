/**
 * @file src/engine/__tests__/assemblyOrderOptimal.test.ts
 * @description Arreglo de armado en rejillas 3D llenas: con el modelo de montaje actual (una pieza a la
 * vez, una dirección de entrada por pieza, barrido libre) se compara con la búsqueda EXHAUSTIVA sobre
 * todos los órdenes y direcciones (programación dinámica sobre conjuntos de piezas puestas). En 2×2×2 el
 * óptimo pega 5 de 12 (cota uniones − piezas + 1: ningún orden de a una pieza conserva más); en 3×2×3 el
 * voraz pegaba 17 de 33 y el óptimo es 16, que ahora da `assemblyOrderExact.ts`. Bajar de esa cota exige
 * armar por subconjuntos (filas → capas → pila), que cambia el modelo y el informe de pasos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { Vec3 } from '../../types/kura';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { jointDirections, restricts } from '../split/assemblyConnectors';
import type { AssemblyJointInput, AssemblyPartInput } from '../split/assemblyTypes';
import { DIRECTIONS, sweepShadows, voxelize, worldPositions } from '../split/assemblyVoxels';
import { validateAssembly } from '../split/validateAssembly';

const S = 20;
let wasm: Awaited<ReturnType<typeof initManifoldEngine>>;
beforeAll(async () => {
  wasm = await initManifoldEngine();
});

/** Rejilla llena de cubos de `S` mm con una espiga por cada par de vecinos (a = lado −, b = lado +). */
function grid(nx: number, ny: number, nz: number): { parts: AssemblyPartInput[]; joints: AssemblyJointInput[] } {
  const parts: AssemblyPartInput[] = [];
  const at = new Map<string, number>();
  for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) {
    const cube = wasm.Manifold.cube([S, S, S], false);
    const m = cube.translate([x * S, y * S, z * S]);
    at.set(`${x},${y},${z}`, parts.length);
    parts.push({ code: `P${x}${y}${z}`, mesh: manifoldToMeshData(m), assembly: { position: [0, 0, 0], rotation: [0, 0, 0] } });
    cube.delete();
    m.delete();
  }
  const joints: AssemblyJointInput[] = [];
  const axes = ['x', 'y', 'z'] as const;
  for (const [k, a] of at) {
    const c = k.split(',').map(Number);
    axes.forEach((axis, i) => {
      const n = [...c];
      n[i]++;
      const b = at.get(n.join(','));
      if (b === undefined) return;
      const center = c.map((v, j) => (j === i ? (v + 1) * S : v * S + S / 2)) as Vec3;
      joints.push({
        label: String(joints.length + 1), axis, position: (c[i] + 1) * S, kind: 'connector',
        connector: { type: 'dowel', size: 3, depth: 6, tolerance: 0.2, count: 1 }, connectorCenters: [center], contactAreaMm2: S * S,
        a: { part: a, code: parts[a].code }, b: { part: b, code: parts[b].code },
      });
    });
  }
  return { parts, joints };
}

/**
 * Máximo de uniones con conector conservables con el modelo actual, por programación dinámica sobre los
 * conjuntos de piezas puestas: al poner `p` sobre el conjunto `S` con la dirección `d` (sin piezas de `S`
 * en su barrido) se conservan sus uniones restrictivas hacia `S` compatibles con `d`. Lo que se decide en
 * un paso no afecta a los siguientes (cada unión se evalúa al poner la segunda de sus piezas).
 */
function exhaustiveMaxKept(parts: AssemblyPartInput[], joints: AssemblyJointInput[], touching = false): number {
  const n = parts.length;
  const world = parts.map((p) => worldPositions(p.mesh, p.assembly.position, p.assembly.rotation));
  const shadows = sweepShadows(voxelize(world, parts.map((p) => p.mesh), 1), n);
  const mine = parts.map((_, p) => joints.filter((j) => j.a.part === p || j.b.part === p));
  // Máscaras por pieza y dirección: piezas en el barrido y vecinas cuyas uniones esa dirección conserva
  const block = parts.map((_, p) => DIRECTIONS.map((d) => [...shadows[p].get(d)!].reduce((m, q) => m | (1 << q), 0)));
  const keepTo = parts.map((_, p) => DIRECTIONS.map((d) => mine[p]
    .filter((j) => restricts(j) && jointDirections(j, p).includes(d)).map((j) => (j.a.part === p ? j.b.part : j.a.part))));
  const best = new Int32Array(1 << n).fill(-1);
  // Con `touching`: base = la más baja (como el voraz) y cada pieza nueva toca lo ya puesto
  const minY = world.map((w) => Math.min(...w.filter((_, i) => i % 3 === 1)));
  const base = minY.indexOf(Math.min(...minY));
  for (let p = 0; p < n; p++) if (!touching || p === base) best[1 << p] = 0;
  for (let set = 1; set < 1 << n; set++) {
    if (best[set] < 0) continue;
    for (let p = 0; p < n; p++) {
      if (set & (1 << p)) continue;
      if (touching && !mine[p].some((j) => set & (1 << (j.a.part === p ? j.b.part : j.a.part)))) continue;
      let step = -1;
      for (let d = 0; d < DIRECTIONS.length; d++) {
        if (block[p][d] & set) continue;
        let kept = 0;
        for (const q of keepTo[p][d]) if (set & (1 << q)) kept++;
        step = Math.max(step, kept);
      }
      if (step < 0) continue;
      const next = set | (1 << p);
      best[next] = Math.max(best[next], best[set] + step);
    }
  }
  return best[(1 << n) - 1];
}

describe('armado de rejillas 3D: el arreglo da el óptimo exhaustivo para montar de a una pieza', () => {
  it.each([
    [2, 2, 2, 12, 5],
    [3, 2, 3, 33, 16],
  ])('%i×%i×%i: %i uniones, el óptimo exhaustivo pega %i y el arreglo también', (nx, ny, nz, total, glued) => {
    const { parts, joints } = grid(nx, ny, nz);
    expect(joints).toHaveLength(total);
    const maxKept = exhaustiveMaxKept(parts, joints);
    expect(total - maxKept).toBe(glued);
    // Con las reglas físicas del arreglo (base primero, cada pieza toca lo puesto) el óptimo es el mismo
    expect(total - exhaustiveMaxKept(parts, joints, true)).toBe(glued);
    // Cota: cada pieza (salvo la primera) conserva a lo más una unión
    expect(maxKept).toBe(parts.length - 1);
    const greedy = validateAssembly(parts, joints, { autoFix: true, allowTypeChange: false, checkExterior: false });
    expect(greedy.blocked).toHaveLength(0);
    expect(greedy.fix.glueJoints).toHaveLength(glued);
  }, 60_000);
});
