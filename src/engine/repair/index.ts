/**
 * @file src/engine/repair/index.ts
 * @description Punto de entrada de diagnóstico y reparación de mallas. `repairMeshVerified` repara y
 * exige que Manifold acepte el resultado (sin la soldadura de respaldo de `meshDataToManifold`); si no,
 * lanza `MESH_REPAIR_FAILED` con el diagnóstico. Devuelve avisos para lo que no se pudo cerrar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';
import { EngineError, engineWarning, type EngineWarning } from '../engineErrors';
import { initManifoldEngine } from '../manifoldKernel';
import { repairMeshData, type MeshRepairOptions, type MeshRepairReport } from './meshRepair';

export { diagnoseMesh, type MeshDiagnosis, type MeshHole } from './meshDiagnose';
export { repairMeshData, DEFAULT_REPAIR_WELD_MM, type MeshRepairOptions, type MeshRepairReport, type MeshDiagnosisSummary } from './meshRepair';
export { CLOSURE_WELD_MM, closureCounts, isMeshClosed, type ClosureCounts } from './meshTopology';

/** Agujeros cerrados que superan esta fracción del modelo se avisan (tapa plana visible). */
const LARGE_HOLE_FRACTION = 0.1;

/** Indica si Manifold acepta la malla tal cual (fusión de vértices coincidentes, sin soldadura extra). */
export async function manifoldAccepts(mesh: Pick<MeshData, 'positions' | 'indices'>): Promise<boolean> {
  if (mesh.indices.length === 0) return false;
  const wasm = await initManifoldEngine();
  const m = new wasm.Mesh({ numProp: 3, vertProperties: new Float32Array(mesh.positions), triVerts: new Uint32Array(mesh.indices) });
  m.merge();
  try {
    const solid = new wasm.Manifold(m);
    const ok = solid.status() === 'NoError';
    solid.delete();
    return ok;
  } catch {
    return false;
  }
}

/** Resultado de una reparación verificada. */
export interface VerifiedRepair {
  mesh: MeshData;
  report: MeshRepairReport;
  warnings: EngineWarning[];
}

/** Repara y verifica con Manifold; lanza `MESH_REPAIR_FAILED` si el resultado no es un sólido válido. */
export async function repairMeshVerified(mesh: MeshData, options: MeshRepairOptions = {}): Promise<VerifiedRepair> {
  const { mesh: out, report } = repairMeshData(mesh, options);
  options.onProgress?.('repair:verify');
  const after = report.after;
  if (!after.closed || !(await manifoldAccepts(out))) {
    throw new EngineError('MESH_REPAIR_FAILED', {
      holes: after.holeCount,
      boundary: after.boundaryEdges,
      nonManifold: after.nonManifoldEdges,
      sizeMm: after.holes[0]?.sizeMm ?? 0,
    });
  }
  const warnings: EngineWarning[] = [];
  if (report.unfilledHoles.length > 0) {
    const biggest = Math.max(...report.unfilledHoles.map((h) => h.sizeMm));
    warnings.push(engineWarning('REPAIR_HOLES_LEFT', { count: report.unfilledHoles.length, sizeMm: biggest }));
  }
  const modelSize = Math.max(1e-9, ...modelExtent(out));
  const large = report.before.holes.filter((h) => h.sizeMm > LARGE_HOLE_FRACTION * modelSize);
  if (report.filledHoles > 0 && large.length > 0) {
    warnings.push(engineWarning('REPAIR_LARGE_HOLES_FILLED', { count: large.length, sizeMm: large[0].sizeMm }));
  }
  return { mesh: out, report, warnings };
}

function modelExtent(mesh: Pick<MeshData, 'positions'>): number[] {
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  const p = mesh.positions;
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (p[i + k] < mn[k]) mn[k] = p[i + k];
      if (p[i + k] > mx[k]) mx[k] = p[i + k];
    }
  }
  return [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
}
