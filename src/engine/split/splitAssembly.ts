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

import type { Manifold } from 'manifold-3d';
import type { SplitConnectorOptions, SplitJointKind, SplitLapInfo, SplitPart } from './splitTypes';
import type { Vec3 } from '../../types/kura';
import type { EngineWarning } from '../engineErrors';
import { manifoldToMeshData } from '../manifoldKernel';
import type { SplitBody } from './splitBodies';
import type { AssemblyJointInput, AssemblyReport } from './assemblyTypes';
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
  /** Sólidos de conector/solape agregados a `low.adds` y restados en `high.subs`. */
  solids: { adds: Manifold[]; subs: Manifold[] };
}

/** Valida con los cuerpos lisos y pasa a "para pegar" las uniones que traban el montaje. */
export function fixAssemblyBeforeConnectors(
  order: SplitBody[],
  joints: PendingJoint[],
  warnings: EngineWarning[],
  apply = true,
): { glued: string[]; suggested: string[]; clearanceRemoved: number } {
  const index = new Map(order.map((b, i) => [b.id, i]));
  const parts = order.map((b) => ({ code: b.code, mesh: manifoldToMeshData(b.m), assembly: { position: [0, 0, 0] as Vec3, rotation: [0, 0, 0] as Vec3 } }));
  const input: AssemblyJointInput[] = joints.map((j) => ({
    label: j.label, axis: j.axis, position: j.position, kind: j.kind, connector: j.connector,
    connectorCenters: j.connectorCenters, contactAreaMm2: j.contactAreaMm2,
    a: { part: index.get(j.low)!, code: order[index.get(j.low)!].code },
    b: { part: index.get(j.high)!, code: order[index.get(j.high)!].code },
  }));
  const report = validateAssembly(parts, input, { autoFix: apply, checkExterior: false });
  if (!report.fix.applied) return { glued: [], suggested: report.fix.glueJoints, clearanceRemoved: 0 };
  let clearanceRemoved = 0;
  const bodies = new Map(order.map((b) => [b.id, b]));
  for (const label of report.fix.glueJoints) {
    const j = joints.find((x) => x.label === label)!;
    const low = bodies.get(j.low)!;
    const high = bodies.get(j.high)!;
    for (const h of j.solids.adds) {
      low.adds.splice(low.adds.indexOf(h), 1);
      h.delete();
    }
    for (const h of j.solids.subs) {
      high.subs.splice(high.subs.indexOf(h), 1);
      h.delete();
    }
    clearanceRemoved += j.clearance;
    Object.assign(j, { kind: 'glue', connector: null, connectorCenters: [], lap: null, clearance: 0, solids: { adds: [], subs: [] } });
  }
  warnings.push(...report.warnings.filter((w) => w.code === 'ASSEMBLY_JOINT_GLUED_FOR_ORDER'));
  return { glued: report.fix.glueJoints, suggested: [], clearanceRemoved };
}

/** Valida las piezas terminadas y anota paso y dirección de entrada en cada una. */
export function finalAssemblyReport(
  parts: SplitPart[],
  joints: AssemblyJointInput[],
  volumes: { source: number; clearance: number; engraved: number },
  glued: string[],
  suggested: string[] = [],
): AssemblyReport {
  const report = validateAssembly(parts, joints, {
    sourceVolumeMm3: volumes.source, clearanceVolumeMm3: volumes.clearance, engravedVolumeMm3: volumes.engraved,
  });
  // Con conectores ya puestos el barrido no puede simular quitarlos: el arreglo sale de los cuerpos lisos
  if (glued.length > 0) report.fix = { glueJoints: glued, applied: true };
  else if (report.blocked.length > 0) report.fix = { glueJoints: suggested, applied: false };
  for (const s of report.order) {
    parts[s.part].assemblyStep = s.step;
    parts[s.part].insertDirection = s.direction;
  }
  return report;
}
