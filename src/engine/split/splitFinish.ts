/**
 * @file src/engine/split/splitFinish.ts
 * @description Último paso de "dividir para imprimir": aplica a cada cuerpo sus sólidos (machos y
 * lengüetas sumados; alojamientos, ranuras y marcas restados), lo pasa a malla cerrada
 * (`closeSplitMesh`) y arma la pieza. Si una malla no cierra ni tras la limpieza, sus uniones pasan a
 * corte liso para pegar (sin conector ni solape, `SPLIT_JOINT_MESH_OPEN`) y se rehacen las piezas
 * afectadas; si aun así queda abierta (p. ej. por la marca), se avisa `SPLIT_PART_NOT_CLOSED`. Nunca
 * se entrega una pieza abierta en silencio.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ManifoldToplevel } from 'manifold-3d';
import type { MeshData, Vec3 } from '../../types/kura';
import { engineWarning, type EngineWarning } from '../engineErrors';
import { manifoldToMeshData } from '../manifoldKernel';
import { normalizeMeshToBed } from '../primitives';
import { demoteToGlue, type PendingJoint } from './splitAssembly';
import type { SplitBody } from './splitBodies';
import { closeSplitMesh } from './splitMeshClean';
import type { SplitPart } from './splitTypes';

interface Built {
  mesh: MeshData;
  closed: boolean;
  min: Vec3;
  max: Vec3;
  volume: number;
}

function buildBody(wasm: ManifoldToplevel, b: SplitBody): Built {
  let m = b.m;
  if (b.adds.length > 0) {
    const u = wasm.Manifold.union([m, ...b.adds]);
    m = u;
  }
  if (b.subs.length > 0) {
    const cutter = wasm.Manifold.union(b.subs);
    const r = m.subtract(cutter);
    cutter.delete();
    if (m !== b.m) m.delete();
    m = r;
  }
  try {
    const { mesh, closed } = closeSplitMesh(wasm, normalizeMeshToBed(manifoldToMeshData(m)));
    const bb = m.boundingBox();
    return { mesh, closed, min: bb.min as Vec3, max: bb.max as Vec3, volume: m.volume() };
  } finally {
    if (m !== b.m) m.delete();
  }
}

/**
 * Piezas terminadas (en el orden de `order`) e índice cuerpo → pieza. `clearanceDelta` (≤ 0) es la
 * holgura que dejan de quitar las uniones pasadas a pegar por malla abierta.
 */
export function finishParts(
  wasm: ManifoldToplevel,
  order: SplitBody[],
  joints: PendingJoint[],
  warnings: EngineWarning[],
): { parts: SplitPart[]; index: Map<number, number>; clearanceDelta: number } {
  const bodies = new Map(order.map((b) => [b.id, b]));
  const built = new Map(order.map((b) => [b.id, buildBody(wasm, b)]));
  let clearanceDelta = 0;
  const dirty = new Set<number>();
  for (const b of order) {
    if (built.get(b.id)!.closed) continue;
    for (const j of joints) {
      if ((j.low !== b.id && j.high !== b.id) || j.kind === 'glue') continue;
      clearanceDelta -= demoteToGlue(j, bodies.get(j.low)!, bodies.get(j.high)!);
      warnings.push(engineWarning('SPLIT_JOINT_MESH_OPEN', { label: j.label, a: bodies.get(j.low)!.code, b: bodies.get(j.high)!.code }));
      dirty.add(j.low);
      dirty.add(j.high);
    }
  }
  for (const id of dirty) built.set(id, buildBody(wasm, bodies.get(id)!));
  const parts: SplitPart[] = [];
  const index = new Map<number, number>();
  for (const b of order) {
    const r = built.get(b.id)!;
    if (!r.closed) warnings.push(engineWarning('SPLIT_PART_NOT_CLOSED', { code: b.code }));
    index.set(b.id, parts.length);
    parts.push({
      code: b.code,
      cell: b.cell,
      mesh: r.mesh,
      assembly: { position: [(r.min[0] + r.max[0]) / 2, r.min[1], (r.min[2] + r.max[2]) / 2], rotation: [0, 0, 0] },
      bounds: { min: r.min, max: r.max },
      volumeMm3: r.volume,
      jointLabels: b.labels,
    });
  }
  return { parts, index, clearanceDelta };
}
