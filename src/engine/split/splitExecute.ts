/**
 * @file src/engine/split/splitExecute.ts
 * @description Ejecución de "dividir para imprimir": corta el sólido mundial por los planos del plan
 * (`splitByPlane` en secuencia, X → Y → Z), y en cada unión entre celdas vecinas ubica conectores con
 * `layoutForCut` sobre la cara de la pieza del lado positivo, recortada lejos de los demás planos de
 * corte para que alojamientos de ejes distintos no se crucen. Machos en la pieza negativa, alojamientos
 * con holgura en la positiva (`buildConnectorSolid`), y opcionalmente la etiqueta de la unión grabada
 * en ambas caras (`splitLabels.ts`). Todo en Manifold: las piezas salen cerradas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { SceneObject, Vec3 } from '../../types/kura';
import { CONNECTOR_MIN_WALL_MM } from '../cutConnectorChecks';
import { connectorFootprintRadius, layoutForCut } from '../cutConnectorLayout';
import { buildConnectorSolid } from '../cutConnectorSolid';
import { engineWarning, type EngineWarning } from '../engineErrors';
import { initManifoldEngine, manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { applyTransformToMesh, normalizeMeshToBed } from '../primitives';
import { buildJointLabel } from './splitLabels';
import { SPLIT_DEFAULTS, splitPartCode } from './splitPlan';
import { AXIS_INDEX } from './splitSections';
import type {
  BedSplitExecuteOptions,
  BedSplitPlan,
  BedSplitResult,
  SplitAxis,
  SplitConnectorOptions,
  SplitJoint,
  SplitPart,
} from './splitTypes';

const AXES: SplitAxis[] = ['x', 'y', 'z'];
const NORMALS: Record<SplitAxis, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const BIG = 1e5;

type Cell = [number, number, number];
const key = (c: Cell) => c.join(',');

/** Profundidad del alojamiento con su pared. */
const holeDepth = (c: SplitConnectorOptions) => Math.max(0.8, c.depth + c.tolerance) + CONNECTOR_MIN_WALL_MM;

/** Corta por los planos de un eje cada pieza de la lista; devuelve la nueva lista con su celda. */
function cutAxis(
  cells: Array<{ cell: Cell; m: Manifold }>,
  axis: SplitAxis,
  planes: number[],
  tick: () => void,
): Array<{ cell: Cell; m: Manifold }> {
  if (planes.length === 0) return cells;
  const a = AXIS_INDEX[axis];
  const out: Array<{ cell: Cell; m: Manifold }> = [];
  for (const { cell, m } of cells) {
    let rest = m;
    planes.forEach((p, t) => {
      const [above, below] = rest.splitByPlane(NORMALS[axis], p);
      if (rest !== m || t > 0) rest.delete();
      const c = [...cell] as Cell;
      c[a] = t;
      out.push({ cell: c, m: below });
      rest = above;
      tick();
    });
    const c = [...cell] as Cell;
    c[a] = planes.length;
    out.push({ cell: c, m: rest });
    m.delete();
  }
  return out;
}

/** Caja recortadora de la cara de unión: lateralmente se aleja de los planos internos. */
function faceClipBox(wasm: ManifoldToplevel, cell: Cell, axis: SplitAxis, bounds: number[][], inset: number): Manifold {
  const lo: number[] = [];
  const hi: number[] = [];
  for (let a = 0; a < 3; a++) {
    const n = bounds[a].length - 1;
    const i = cell[a];
    if (a === AXIS_INDEX[axis]) {
      lo.push(-BIG);
      hi.push(BIG);
      continue;
    }
    lo.push(i > 0 ? bounds[a][i] + inset : -BIG);
    hi.push(i < n - 1 ? bounds[a][i + 1] - inset : BIG);
  }
  const size: Vec3 = [Math.max(1e-3, hi[0] - lo[0]), Math.max(1e-3, hi[1] - lo[1]), Math.max(1e-3, hi[2] - lo[2])];
  return wasm.Manifold.cube(size, false).translate(lo as Vec3);
}

/** Variantes del conector de mayor a menor, para reducirlo si no cabe. */
function connectorLadder(c: SplitConnectorOptions): SplitConnectorOptions[] {
  const out: SplitConnectorOptions[] = [c];
  if (c.count > 1) out.push({ ...c, count: 1 });
  for (const f of [0.75, 0.5]) if (c.size * f >= 1.5) out.push({ ...c, size: c.size * f, count: 1 });
  return out;
}

interface CellWork {
  m: Manifold;
  adds: Manifold[];
  subs: Manifold[];
  labels: string[];
}

/**
 * Divide `obj` según `plan`. Devuelve piezas (malla local + transformación de armado), uniones con
 * etiqueta y conectores aplicados, volúmenes de control y avisos tipados.
 */
export async function executeBedSplitGeometry(
  obj: SceneObject,
  plan: BedSplitPlan,
  options: BedSplitExecuteOptions = {},
): Promise<BedSplitResult> {
  const t0 = performance.now();
  const wasm = await initManifoldEngine();
  const connector = options.connector === undefined ? plan.connector : options.connector;
  const labels = options.labels ?? 'none';
  const labelDepth = options.labelDepthMm ?? SPLIT_DEFAULTS.labelDepthMm;
  const labelMin = options.labelMinHeightMm ?? SPLIT_DEFAULTS.labelMinHeightMm;
  const warnings: EngineWarning[] = [];
  const world = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
  const source = meshDataToManifold(wasm, world, undefined, obj.color);
  const sourceVolume = source.volume();
  const counts = [plan.counts.x, plan.counts.y, plan.counts.z];
  const planesBy = AXES.map((axis) => plan.planes.filter((p) => p.axis === axis).map((p) => p.position).sort((a, b) => a - b));
  const bounds = AXES.map((_, a) => [plan.bounds.min[a], ...planesBy[a], plan.bounds.max[a]]);
  const totalCuts = planesBy[0].length + planesBy[1].length * counts[0] + planesBy[2].length * counts[0] * counts[1];
  let done = 0;
  const tick = () => options.onProgress?.(++done, totalCuts);
  const temp: Array<{ delete: () => void }> = [];

  // 1. Cortes en secuencia
  let cells: Array<{ cell: Cell; m: Manifold }> = [{ cell: [0, 0, 0], m: source }];
  for (let a = 0; a < 3; a++) cells = cutAxis(cells, AXES[a], planesBy[a], tick);
  const work = new Map<string, CellWork & { cell: Cell }>();
  let empty = 0;
  for (const { cell, m } of cells) {
    if (m.isEmpty() || m.volume() < 1e-6) {
      empty++;
      m.delete();
    } else work.set(key(cell), { cell, m, adds: [], subs: [], labels: [] });
  }
  if (empty > 0) warnings.push(engineWarning('SPLIT_EMPTY_CELLS', { count: empty }));
  const codeOf = (c: Cell) => splitPartCode(c, counts[2]);

  try {
    // 2. Uniones entre celdas vecinas
    const joints: Array<Omit<SplitJoint, 'a' | 'b'> & { low: Cell; high: Cell }> = [];
    let clearance = 0;
    let engraved = 0;
    for (const w of work.values()) {
      for (let a = 0; a < 3; a++) {
        const axis = AXES[a];
        const high = [...w.cell] as Cell;
        high[a]++;
        const hw = work.get(key(high));
        if (!hw) continue;
        const coord = bounds[a][high[a]];
        const label = String(joints.length + 1);
        const pair = { label, a: codeOf(w.cell), b: codeOf(high) };
        const span = bounds[a][high[a] + 1] - coord;
        const inset = connector ? holeDepth(connector) + 0.5 : 0;
        const clip = faceClipBox(wasm, high, axis, bounds, inset);
        const face = hw.m.intersect(clip);
        clip.delete();
        temp.push(face);
        let used: SplitConnectorOptions | null = null;
        let centers: Vec3[] = [];
        if (connector && holeDepth(connector) < span && !face.isEmpty()) {
          for (const c of connectorLadder(connector)) {
            const layout = layoutForCut(face, axis, coord + 0.01, c, CONNECTOR_MIN_WALL_MM);
            if (layout.centers.length > 0 && layout.enoughRoom && layout.skippedIslands < layout.islands) {
              used = c;
              centers = layout.centers.map((p) => {
                const q = [...p] as Vec3;
                q[a] = coord;
                return q;
              });
              if (layout.skippedIslands > 0) {
                warnings.push(engineWarning('CUT_CONNECTOR_ISLAND_SKIPPED', { skipped: layout.skippedIslands, islands: layout.islands, size: c.size }));
              }
              break;
            }
          }
          if (!used) warnings.push(engineWarning('SPLIT_JOINT_NO_CONNECTOR', pair));
          else if (used !== connector) warnings.push(engineWarning('SPLIT_CONNECTOR_REDUCED', { ...pair, count: used.count, size: used.size }));
        }
        if (used) {
          for (const center of centers) {
            const male = buildConnectorSolid(wasm, used.type, axis, center, used.size, used.depth, 0);
            const female = buildConnectorSolid(wasm, used.type, axis, center, used.size, used.depth, used.tolerance);
            const maleIn = male.trimByPlane(NORMALS[axis], coord);
            const femaleIn = female.trimByPlane(NORMALS[axis], coord);
            clearance += femaleIn.volume() - maleIn.volume();
            maleIn.delete();
            femaleIn.delete();
            w.adds.push(male);
            hw.subs.push(female);
          }
        }
        let labelEngraved = false;
        let labelHeightMm = 0;
        if (labels === 'engraved') {
          const radius = used ? connectorFootprintRadius(used.type, used.size, used.tolerance) : 0;
          const solids = await buildJointLabel(wasm, {
            text: label,
            axis,
            coord,
            high: face,
            connectorCenters: centers,
            connectorRadius: radius,
            depthMm: labelDepth,
            minHeightMm: labelMin,
          });
          if (solids) {
            const inLow = w.m.intersect(solids.forLow);
            const inHigh = hw.m.intersect(solids.forHigh);
            engraved += inLow.volume() + inHigh.volume();
            inLow.delete();
            inHigh.delete();
            w.subs.push(solids.forLow);
            hw.subs.push(solids.forHigh);
            labelEngraved = true;
            labelHeightMm = solids.heightMm;
          } else {
            warnings.push(engineWarning('SPLIT_LABEL_SKIPPED', { ...pair, min: labelMin }));
          }
        }
        w.labels.push(label);
        hw.labels.push(label);
        joints.push({ label, axis, position: coord, low: w.cell, high, connector: used, connectorCenters: centers, labelEngraved, labelHeightMm });
      }
    }

    // 3. Aplicar conectores y marcas, y pasar a mallas
    const parts: SplitPart[] = [];
    const index = new Map<string, number>();
    const ordered = [...work.values()].sort((p, q) => p.cell[2] - q.cell[2] || p.cell[1] - q.cell[1] || p.cell[0] - q.cell[0]);
    for (const w of ordered) {
      let m = w.m;
      if (w.adds.length > 0) {
        const u = wasm.Manifold.union([m, ...w.adds]);
        if (m !== w.m) m.delete();
        m = u;
      }
      if (w.subs.length > 0) {
        const cutter = wasm.Manifold.union(w.subs);
        const r = m.subtract(cutter);
        cutter.delete();
        if (m !== w.m) m.delete();
        m = r;
      }
      const mesh = manifoldToMeshData(m);
      const bb = m.boundingBox();
      const volume = m.volume();
      if (m !== w.m) m.delete();
      index.set(key(w.cell), parts.length);
      parts.push({
        code: codeOf(w.cell),
        cell: w.cell,
        mesh: normalizeMeshToBed(mesh),
        assembly: { position: [(bb.min[0] + bb.max[0]) / 2, bb.min[1], (bb.min[2] + bb.max[2]) / 2], rotation: [0, 0, 0] },
        bounds: { min: bb.min as Vec3, max: bb.max as Vec3 },
        volumeMm3: volume,
        jointLabels: w.labels,
      });
    }
    const sign = (axis: SplitAxis, s: '+' | '-') => `${s}${axis}` as SplitJoint['a']['face'];
    const outJoints: SplitJoint[] = joints.map(({ low, high, ...j }) => ({
      ...j,
      a: { part: index.get(key(low))!, code: codeOf(low), face: sign(j.axis, '+') },
      b: { part: index.get(key(high))!, code: codeOf(high), face: sign(j.axis, '-') },
    }));
    return {
      parts,
      joints: outJoints,
      sourceVolumeMm3: sourceVolume,
      clearanceVolumeMm3: clearance,
      engravedVolumeMm3: engraved,
      warnings,
      elapsedMs: performance.now() - t0,
    };
  } finally {
    for (const w of work.values()) {
      w.m.delete();
      for (const h of [...w.adds, ...w.subs]) h.delete();
    }
    for (const h of temp) h.delete();
  }
}
