/**
 * @file src/engine/split/splitJoints.ts
 * @description Una unión de "dividir para imprimir" entre dos piezas que se tocan por un plano: la
 * cara de unión es la pieza alta recortada al prisma del contacto real y lejos de los demás planos;
 * ahí se ubican conectores (`layoutForCut`, reduciéndolos si no caben) y, en las islas de pared
 * con `type: 'lap'` (elección explícita: modifica la forma), un solape de borde (`splitLap.ts`).
 * Una sección más delgada que `minWallForConnectorMm` queda como corte liso para pegar (`glue`). La marca de pareja va en la
 * cara de unión si cabe (`splitLabels.ts`) y si no en la cara exterior (`splitOutsideLabel.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import { CONNECTOR_MIN_WALL_MM } from '../cutConnectorChecks';
import { connectorFootprintRadius, layoutForCut } from '../cutConnectorLayout';
import { buildConnectorSolid } from '../cutConnectorSolid';
import { engineWarning, type EngineWarning } from '../engineErrors';
import type { SplitBody } from './splitBodies';
import { buildLapSolids, type LapRejection } from './splitLap';
import { buildLooseDowelHoles, layoutType } from './splitLooseDowel';
import { recommendedConnectorRadius } from './assemblyConnectors';
import { buildJointLabel, orientedToWorld } from './splitLabels';
import { buildOutsideLabel } from './splitOutsideLabel';
import { ASSEMBLY_LIMITS, OPERATION_DEFAULTS } from '../operationLimits';
import { AXIS_INDEX, islandWidth, orientForAxis } from './splitSections';
import type { SplitAxis, SplitConnectorOptions, SplitJointKind, SplitLapInfo } from './splitTypes';

const MIN_WALL_DEFAULT = OPERATION_DEFAULTS.split.minWallForConnectorMm;

const NORMALS: Record<SplitAxis, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const BIG = 1e5;

/** Profundidad del alojamiento con su pared. */
export const holeDepth = (c: SplitConnectorOptions) => Math.max(0.8, c.depth + c.tolerance) + CONNECTOR_MIN_WALL_MM;

/**
 * Variantes del conector de mayor a menor, para reducirlo si no cabe. Con `recommended` (firmeza
 * activa) y un conector bajo ese radio, antes prueba agrandarlo al recomendado y luego agregar uno más.
 */
function connectorLadder(c: SplitConnectorOptions, recommended?: (count: number) => number): SplitConnectorOptions[] {
  const out: SplitConnectorOptions[] = [];
  if (recommended && c.size < recommended(c.count) - 1e-6) {
    out.push({ ...c, size: recommended(c.count) });
    out.push({ ...c, size: Math.max(c.size, recommended(c.count + 1)), count: c.count + 1 });
  }
  out.push(c);
  if (c.count > 1) out.push({ ...c, count: 1 });
  for (const f of [0.75, 0.5]) if (c.size * f >= 1.5) out.push({ ...c, size: c.size * f, count: 1 });
  return out;
}

/** Alcance de lo que sale de una cara hacia la celda vecina (conector o solape), mm. */
export function jointReach(c: SplitConnectorOptions | null, lapHeight: number): number {
  if (!c) return 0;
  const lap = c.type === 'lap' ? lapHeight + c.tolerance : 0;
  return Math.max(c.type === 'lap' ? 0 : holeDepth(c), lap);
}

/** Caja recortadora de la cara de unión: lateralmente se aleja de los planos internos. */
export function faceClipBox(wasm: ManifoldToplevel, cell: [number, number, number], axis: SplitAxis, bounds: number[][], inset: number): Manifold {
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

export interface JointInput {
  low: SplitBody;
  high: SplitBody;
  axis: SplitAxis;
  coord: number;
  /** Largo de la celda alta en el eje (para que quepan alojamiento o ranura). */
  span: number;
  /** Contacto real orientado; no se libera. */
  contact: CrossSection;
  bounds: number[][];
  label: string;
  connector: SplitConnectorOptions | null;
  lapHeightMm: number;
  labels: 'none' | 'engraved';
  labelPlacement: 'auto' | 'joint' | 'outside';
  labelDepthMm: number;
  labelMinHeightMm: number;
  /** Firmeza activa: agranda o agrega conectores bajo el radio recomendado (ver `BedSplitExecuteOptions`). */
  reinforce?: boolean;
}

/** Medida mayor de la pieza más chica (por volumen) de la unión, para la regla de firmeza. */
function smallerPieceDim(low: SplitBody, high: SplitBody): number {
  const m = low.m.volume() <= high.m.volume() ? low.m : high.m;
  const bb = m.boundingBox();
  return Math.max(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]);
}

export interface JointOutcome {
  kind: SplitJointKind;
  used: SplitConnectorOptions | null;
  centers: Vec3[];
  lap: SplitLapInfo | null;
  clearance: number;
  engraved: number;
  labelPlacement: 'joint' | 'outside' | null;
  labelHeightMm: number;
}

/** Arma una unión: agrega a `low.adds`/`high.subs`/`low.subs` los sólidos y devuelve lo aplicado. */
export async function buildJoint(wasm: ManifoldToplevel, j: JointInput, warnings: EngineWarning[]): Promise<JointOutcome> {
  const a = AXIS_INDEX[j.axis];
  const { low, high, axis, coord, connector } = j;
  const pair = { label: j.label, a: low.code, b: high.code };
  const handles: Array<{ delete: () => void }> = [];
  const own = <T extends { delete: () => void }>(h: T): T => {
    handles.push(h);
    return h;
  };
  try {
    // Cara de unión: pieza alta ∩ prisma del contacto ∩ caja lejos de otros planos
    const clip = own(faceClipBox(wasm, high.cell, axis, j.bounds, jointReach(connector, j.lapHeightMm) + 0.5));
    const prismLocal = own(j.contact.extrude(j.span + 2).translate([0, 0, coord - 1]));
    const prism = own(orientedToWorld(prismLocal, axis));
    const face = own(own(high.m.intersect(clip)).intersect(prism));
    let used: SplitConnectorOptions | null = null;
    let centers: Vec3[] = [];
    let clearance = 0;
    const { oriented, owned } = orientForAxis(face, axis);
    const faceSection = own(oriented.slice(coord + 0.01));
    if (owned) oriented.delete();
    const islands = faceSection.decompose();
    handles.push(...islands);
    const minWall = connector?.minWallForConnectorMm ?? MIN_WALL_DEFAULT;
    // Pared más delgada que el mínimo en todas las islas: corte liso para pegar, sin deformar
    const thinOnly = islands.length > 0 && islands.every((isl) => islandWidth(isl) < minWall);
    // El tarugo suelto también agujerea la pieza baja: necesita fondo a ambos lados del plano
    const lowSpan = coord - j.bounds[a][low.cell[a]];
    const roomBelow = connector?.type !== 'loose-dowel' || holeDepth(connector) < lowSpan;
    if (connector && connector.type !== 'lap' && !thinOnly && roomBelow && holeDepth(connector) < j.span && !face.isEmpty()) {
      const area = j.contact.area();
      const dim = j.reinforce ? smallerPieceDim(low, high) : 0;
      const ladder = connectorLadder(connector, j.reinforce ? (n) => recommendedConnectorRadius(area, n, dim) : undefined);
      for (const c of ladder) {
        const layout = layoutForCut(face, axis, coord + 0.01, { ...c, type: layoutType(connector.type) }, CONNECTOR_MIN_WALL_MM);
        if (layout.centers.length > 0 && layout.enoughRoom && layout.skippedIslands < layout.islands) {
          used = c;
          centers = layout.centers.map((p) => {
            const q = [...p] as Vec3;
            q[a] = coord;
            return q;
          });
          break;
        }
      }
      const reduced = used && used !== connector && (used.size < connector.size || used.count < connector.count);
      if (used && reduced) warnings.push(engineWarning('SPLIT_CONNECTOR_REDUCED', { ...pair, count: used.count, size: used.size }));
    }
    if (used && used.type === 'loose-dowel') {
      for (const center of centers) {
        const holes = buildLooseDowelHoles(wasm, axis, center, used);
        const inLow = own(low.m.intersect(holes.low));
        const inHigh = own(high.m.intersect(holes.high));
        clearance += inLow.volume() + inHigh.volume();
        low.subs.push(holes.low);
        high.subs.push(holes.high);
      }
    } else if (used && used.type !== 'lap') {
      for (const center of centers) {
        const male = buildConnectorSolid(wasm, layoutType(used.type), axis, center, used.size, used.depth, 0);
        const female = buildConnectorSolid(wasm, layoutType(used.type), axis, center, used.size, used.depth, used.tolerance);
        const maleIn = male.trimByPlane(NORMALS[axis], coord);
        const femaleIn = female.trimByPlane(NORMALS[axis], coord);
        clearance += femaleIn.volume() - maleIn.volume();
        maleIn.delete();
        femaleIn.delete();
        low.adds.push(male);
        high.subs.push(female);
      }
    }
    // Solape de borde (solo si se eligió `lap`)
    let lap: SplitLapInfo | null = null;
    let lapZone: CrossSection | undefined;
    const lapOn = connector && connector.type === 'lap';
    if (lapOn && j.span > j.lapHeightMm + connector.tolerance + 1) {
      const thin = islands;
      const rejected: LapRejection = { islands: 0, tongueMm: Infinity, grooveWallMm: Infinity };
      const solids = thin.length > 0 ? buildLapSolids(wasm, thin, axis, coord, j.lapHeightMm, connector.tolerance, rejected) : null;
      if (rejected.islands > 0) {
        warnings.push(engineWarning('SPLIT_LAP_NOT_PRINTABLE', {
          ...pair, tongue: rejected.tongueMm, groove: rejected.grooveWallMm, min: ASSEMBLY_LIMITS.minPrintableWallMm,
        }));
      }
      if (solids) {
        const tongueIn = own(low.m.intersect(solids.tongue));
        const grooveIn = own(high.m.intersect(solids.groove));
        clearance += grooveIn.volume() - (solids.tongue.volume() - tongueIn.volume());
        low.adds.push(solids.tongue);
        high.subs.push(solids.groove);
        lap = { islands: solids.islands, heightMm: j.lapHeightMm, tongueMm: solids.tongueMm, clearanceMm: connector.tolerance };
        lapZone = own(wasm.CrossSection.union(thin));
      }
    }
    const kind: SplitJointKind = used ? 'connector' : lap ? 'lap' : 'glue';
    if (connector && kind === 'glue') warnings.push(engineWarning(thinOnly ? 'SPLIT_JOINT_GLUE_ONLY' : 'SPLIT_JOINT_NO_CONNECTOR', pair));
    // Marca de pareja
    let engraved = 0;
    let labelPlacement: 'joint' | 'outside' | null = null;
    let labelHeightMm = 0;
    if (j.labels === 'engraved') {
      // Profundidad limitada a una fracción del espesor local (la isla más delgada de la cara)
      const wall = islands.length > 0 ? Math.min(...islands.map((isl) => islandWidth(isl))) : Infinity;
      const maxDepth = ASSEMBLY_LIMITS.labelDepthWallFraction * wall;
      const depthMm = Math.min(j.labelDepthMm, maxDepth);
      if (depthMm < j.labelDepthMm - 1e-9) {
        warnings.push(engineWarning('SPLIT_LABEL_DEPTH_CLAMPED', { label: j.label, depth: depthMm, requested: j.labelDepthMm, wall }));
      }
      let solids: { forLow: Manifold; forHigh: Manifold; heightMm: number } | null = null;
      if (j.labelPlacement !== 'outside') {
        const radius = used && used.type !== 'lap' ? connectorFootprintRadius(layoutType(used.type), used.size, used.tolerance) : 0;
        const inJoint = await buildJointLabel(wasm, {
          text: j.label, axis, coord, high: face, connectorCenters: centers, connectorRadius: radius,
          depthMm, minHeightMm: j.labelMinHeightMm, exclude: lapZone,
        });
        if (inJoint) {
          solids = inJoint;
          labelPlacement = 'joint';
        }
      }
      if (!solids && j.labelPlacement !== 'joint') {
        const highGap = lap ? lap.heightMm + lap.clearanceMm + 1.5 : 1;
        for (const h of [Math.max(j.labelMinHeightMm, 5), j.labelMinHeightMm]) {
          solids = await buildOutsideLabel(wasm, {
            text: j.label, axis, coord, contact: faceSection.isEmpty() ? j.contact : faceSection, low: low.m, high: high.m,
            highGapMm: highGap, depthMm, heightMm: h,
          });
          if (solids) break;
        }
        if (solids) labelPlacement = 'outside';
      }
      if (solids) {
        const inLow = low.m.intersect(solids.forLow);
        const inHigh = high.m.intersect(solids.forHigh);
        engraved += inLow.volume() + inHigh.volume();
        inLow.delete();
        inHigh.delete();
        low.subs.push(solids.forLow);
        high.subs.push(solids.forHigh);
        labelHeightMm = solids.heightMm;
      } else {
        warnings.push(engineWarning('SPLIT_LABEL_SKIPPED', { ...pair, min: j.labelMinHeightMm }));
      }
    }
    return { kind, used, centers, lap, clearance, engraved, labelPlacement, labelHeightMm };
  } finally {
    for (const h of handles) h.delete();
  }
}
