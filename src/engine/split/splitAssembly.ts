/**
 * @file src/engine/split/splitAssembly.ts
 * @description Validación de armado dentro de "dividir para imprimir": antes de aplicar conectores se
 * valida con los cuerpos lisos de cada celda (sin conectores) y, con `autoFix`, las uniones que traban
 * el montaje pasan a "para pegar" quitando sus sólidos de conector o solape (la marca de pareja se
 * conserva); al final se valida el resultado y se anota en cada pieza su paso y dirección de entrada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import { buildConnectorSolid } from '../cutConnectorSolid';
import { layoutType } from './splitLooseDowel';
import type { SplitConnectorOptions, SplitConnectorType, SplitJointKind, SplitLapInfo, SplitPart } from './splitTypes';
import type { Vec3 } from '../../types/kura';
import type { EngineWarning } from '../engineErrors';
import { manifoldToMeshData } from '../manifoldKernel';
import type { SplitBody } from './splitBodies';
import type { AssemblyFix, AssemblyJointInput, AssemblyReport, AssemblySuggestion } from './assemblyTypes';
import { validateAssembly } from './validateAssembly';
import type { SplitAxis } from './splitTypes';

/** Unión en construcción con los sólidos que aportó (para poder quitarlos). */
export interface PendingJoint {
  label: string;
  axis: SplitAxis;
  position: number;
  low: number;
  high: number;
  connector: SplitConnectorOptions | null;
  connectorCenters: Vec3[];
  kind: SplitJointKind;
  lap: SplitLapInfo | null;
  contactAreaMm2: number;
  clearance: number;
  /** Sólidos de conector/solape agregados a `low.adds` y restados en `high.subs` (y en `low.subs`: agujeros del tarugo suelto). */
  solids: { adds: Manifold[]; subs: Manifold[]; lowSubs?: Manifold[] };
}

/** Quita de sus piezas los sólidos de conector o solape de una unión (los libera). */
function dropSolids(j: PendingJoint, low: SplitBody, high: SplitBody): void {
  const drop = (list: Manifold[], from: Manifold[]) => {
    for (const h of list) {
      from.splice(from.indexOf(h), 1);
      h.delete();
    }
  };
  drop(j.solids.adds, low.adds);
  drop(j.solids.subs, high.subs);
  drop(j.solids.lowSubs ?? [], low.subs);
}

/** Rehace los conectores de una unión con otro tipo, en los mismos centros y medidas. */
function rebuildAs(wasm: ManifoldToplevel, j: PendingJoint, low: SplitBody, high: SplitBody, type: SplitConnectorType): number {
  const c = j.connector!;
  const normal: Vec3 = j.axis === 'x' ? [1, 0, 0] : j.axis === 'y' ? [0, 1, 0] : [0, 0, 1];
  let clearance = 0;
  const adds: Manifold[] = [];
  const subs: Manifold[] = [];
  // Cola de milano que entra deslizando: su ranura atraviesa la pieza alta a lo largo del deslizamiento
  const bb = high.m.boundingBox();
  const through = 2 * Math.max(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]) + 2;
  for (const center of j.connectorCenters) {
    const t = layoutType(type);
    const male = buildConnectorSolid(wasm, t, j.axis, center, c.size, c.depth, 0);
    const female = buildConnectorSolid(wasm, t, j.axis, center, c.size, c.depth, c.tolerance, t === 'dovetail' ? through : undefined);
    const maleIn = male.trimByPlane(normal, j.position);
    // La ranura pasante sobresale de la pieza: cuenta solo lo que quita del material
    const femaleIn = high.m.intersect(female);
    clearance += femaleIn.volume() - maleIn.volume();
    maleIn.delete();
    femaleIn.delete();
    adds.push(male);
    subs.push(female);
  }
  low.adds.push(...adds);
  high.subs.push(...subs);
  Object.assign(j, { connector: { ...c, type }, clearance, solids: { adds, subs, lowSubs: [] } });
  return clearance;
}

/**
 * Valida con los cuerpos lisos y aplica el arreglo que destraba el montaje: pasa uniones a "para
 * pegar" (quita sus sólidos) o, si conserva más uniones con conector, cambia el tipo de algunas
 * (`fix.changeType`, rehechas en los mismos centros). `clearanceDelta` se suma a la holgura total.
 */
export function fixAssemblyBeforeConnectors(
  wasm: ManifoldToplevel,
  order: SplitBody[],
  joints: PendingJoint[],
  warnings: EngineWarning[],
  apply = true,
  allowTypeChange = true,
): { glued: string[]; fix: AssemblyFix | null; suggestions: AssemblySuggestion[]; clearanceDelta: number } {
  const index = new Map(order.map((b, i) => [b.id, i]));
  const parts = order.map((b) => ({ code: b.code, mesh: manifoldToMeshData(b.m), assembly: { position: [0, 0, 0] as Vec3, rotation: [0, 0, 0] as Vec3 } }));
  const input: AssemblyJointInput[] = joints.map((j) => ({
    label: j.label, axis: j.axis, position: j.position, kind: j.kind, connector: j.connector,
    connectorCenters: j.connectorCenters, contactAreaMm2: j.contactAreaMm2,
    a: { part: index.get(j.low)!, code: order[index.get(j.low)!].code },
    b: { part: index.get(j.high)!, code: order[index.get(j.high)!].code },
  }));
  const report = validateAssembly(parts, input, { autoFix: apply, checkExterior: false, allowTypeChange });
  if (!report.fix.applied) return { glued: [], fix: report.blocked.length > 0 ? report.fix : null, suggestions: report.suggestions, clearanceDelta: 0 };
  let clearanceDelta = 0;
  const bodies = new Map(order.map((b) => [b.id, b]));
  for (const label of report.fix.glueJoints) {
    const j = joints.find((x) => x.label === label)!;
    dropSolids(j, bodies.get(j.low)!, bodies.get(j.high)!);
    clearanceDelta -= j.clearance;
    Object.assign(j, { kind: 'glue', connector: null, connectorCenters: [], lap: null, clearance: 0, solids: { adds: [], subs: [] } });
  }
  for (const { joint, type } of report.fix.changeType) {
    const j = joints.find((x) => x.label === joint)!;
    const low = bodies.get(j.low)!;
    const high = bodies.get(j.high)!;
    dropSolids(j, low, high);
    clearanceDelta -= j.clearance;
    clearanceDelta += rebuildAs(wasm, j, low, high, type);
  }
  warnings.push(...report.warnings.filter((w) => w.code === 'ASSEMBLY_JOINT_GLUED_FOR_ORDER' || w.code === 'ASSEMBLY_JOINT_TYPE_CHANGED'));
  return { glued: report.fix.glueJoints, fix: report.fix, suggestions: report.suggestions, clearanceDelta };
}

/** Valida las piezas terminadas y anota paso y dirección de entrada en cada una. */
export function finalAssemblyReport(
  parts: SplitPart[],
  joints: AssemblyJointInput[],
  volumes: { source: number; clearance: number; engraved: number },
  fix: AssemblyFix | null,
  suggestions: AssemblySuggestion[] = [],
): AssemblyReport {
  const report = validateAssembly(parts, joints, {
    sourceVolumeMm3: volumes.source, clearanceVolumeMm3: volumes.clearance, engravedVolumeMm3: volumes.engraved,
  });
  // Con conectores ya puestos el barrido no puede simular quitarlos: el arreglo sale de los cuerpos lisos
  if (fix) {
    report.fix = fix;
    report.suggestions = suggestions;
  }
  for (const s of report.order) {
    parts[s.part].assemblyStep = s.step;
    parts[s.part].insertDirection = s.direction;
  }
  return report;
}
