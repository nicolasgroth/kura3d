/**
 * @file src/engine/split/splitAssemblyRepair.ts
 * @description Cierre seguro del armado en "dividir para imprimir": valida las piezas TERMINADAS (con
 * conectores, solapes y marcas) y, mientras queden piezas bloqueadas o conectores que chocan, pasa a
 * corte liso para pegar las uniones responsables y rehace esas piezas. Así el resultado por defecto
 * siempre es armable: lo que no se pudo destrabar con conector queda para pegar, con aviso por unión
 * (su marca de pareja se conserva) y la alternativa de cambio de tipo en `suggestions`.
 * - Choques: entre dos conectores se pega la unión armada después (la de etiqueta mayor); contra el
 *   exterior, la propia.
 * - Bloqueos: el arreglo voraz solo-pegar (`greedyFix` vía `validateAssembly`) sobre las piezas
 *   terminadas; si no propone nada, las uniones restrictivas de las piezas bloqueadas.
 * `fix.applied` es `true` solo si el informe final no tiene bloqueos ni choques.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ManifoldToplevel } from 'manifold-3d';
import { engineWarning, type EngineWarning } from '../engineErrors';
import type { AssemblyFix, AssemblyJointInput, AssemblyPartInput, AssemblyReport, AssemblySuggestion } from './assemblyTypes';
import { demoteToGlue, type PendingJoint } from './splitAssembly';
import type { SplitBody } from './splitBodies';
import { rebuildParts } from './splitFinish';
import type { SplitConnectorOptions, SplitPart } from './splitTypes';
import { checkSuggestions, type OriginalConnectors } from './splitSuggestionCheck';
import { validateAssembly } from './validateAssembly';

/** Rondas de arreglo como máximo (cada una pega al menos una unión). */
const MAX_ROUNDS = 8;

export interface RepairInput {
  wasm: ManifoldToplevel;
  bodies: Map<number, SplitBody>;
  joints: PendingJoint[];
  parts: SplitPart[];
  index: Map<number, number>;
  /** Uniones en el formato de la validación, leídas del estado actual de `joints`. */
  toJoints: () => AssemblyJointInput[];
  volumes: { source: number; clearance: number; engraved: number };
  /** Mallas lisas (sin conectores) de las piezas, en el orden de `parts`. */
  smoothParts: () => AssemblyPartInput[];
  /** Arreglo y sugerencias del paso previo (cuerpos lisos), o `null`. */
  preFix: AssemblyFix | null;
  preSuggestions: AssemblySuggestion[];
  /** Con `false` solo se informa (no se pega nada): `assemblyAutoFix: false`. */
  autoFix: boolean;
  /** Conector pedido (para comprobar los cambios de tipo de uniones pegadas antes de poner conectores). */
  connector: SplitConnectorOptions | null;
  warnings: EngineWarning[];
}

/** Solape como espiga sin centros: restringe la entrada a la normal del plano, como su lengüeta. */
const lapAsDowel = (joints: AssemblyJointInput[]): AssemblyJointInput[] =>
  joints.map((j) => (j.kind === 'lap' ? { ...j, kind: 'connector', connector: { type: 'dowel', size: 1, depth: 1, tolerance: 0, count: 1 } } : j));

const byLabel = (x: string, y: string) => Number(x) - Number(y) || x.localeCompare(y);

/** Uniones a pegar para quitar los choques del informe. */
function clashCulprits(report: AssemblyReport): string[] {
  return report.clashes.map((c) => (c.other && byLabel(c.other.joint, c.joint) > 0 ? c.other.joint : c.joint));
}

/**
 * Uniones a pegar para destrabar las piezas bloqueadas: el arreglo voraz solo-pegar sobre las piezas
 * terminadas; si no propone nada (bloqueo por barrido: la geometría de un solape o conector topa), las
 * uniones con conector o solape entre cada pieza bloqueada y las piezas con que topa.
 */
function blockCulprits(
  parts: SplitPart[], smooth: () => AssemblyPartInput[], joints: AssemblyJointInput[], report: AssemblyReport,
): string[] {
  if (report.blocked.length === 0) return [];
  // Primero con los cuerpos lisos (el barrido en vóxeles no confunde lengüeta y ranura con holgura fina) y
  // el solape tratado como restrictivo (entra por la normal): el voraz da el mínimo a pegar.
  const opts = { autoFix: true, allowTypeChange: false, checkExterior: false } as const;
  for (const target of [smooth(), parts]) {
    const greedy = validateAssembly(target, lapAsDowel(joints), opts);
    const pending = greedy.fix.glueJoints.filter((l) => joints.find((j) => j.label === l)?.kind !== 'glue');
    if (pending.length > 0) return pending;
  }
  const out = report.blocked.flatMap((b) => b.conflictingJoints);
  for (const b of report.blocked) {
    const blocking = new Set(b.blockingParts);
    for (const j of joints) {
      if (j.kind === 'glue') continue;
      const other = j.a.part === b.part ? j.b.code : j.b.part === b.part ? j.a.code : null;
      if (other !== null && blocking.has(other)) out.push(j.label);
    }
  }
  return out;
}

/**
 * Sugerencias para las uniones pegadas aquí: pegar, o cambiar de tipo. El solape se evalúa como espiga
 * (entra igual, por la normal), así el arreglo con cambio de superficie dice si una cola de milano
 * destrabaría la unión.
 */
function suggestionsFor(parts: AssemblyPartInput[], joints: AssemblyJointInput[], glued: string[]): AssemblySuggestion[] {
  const r = validateAssembly(parts, lapAsDowel(joints), { autoFix: false, allowTypeChange: true, allowSurfaceChange: true, checkExterior: false });
  const alt = new Map(r.suggestions.map((s) => [s.joint, s.options]));
  return glued.map((joint) => ({ joint, options: alt.get(joint) ?? ['glue'] }));
}

/** Valida las piezas terminadas, pega lo que traba o choca, y devuelve el informe final y la holgura que dejó de quitar (≤ 0). */
export function settleAssembly(input: RepairInput): { report: AssemblyReport; clearanceDelta: number } {
  const { wasm, bodies, joints, parts, index, warnings } = input;
  let clearanceDelta = 0;
  let smoothCache: AssemblyPartInput[] | null = null;
  const smooth = () => (smoothCache ??= input.smoothParts());
  const glued: string[] = [];
  const suggestions: AssemblySuggestion[] = [];
  const originals: OriginalConnectors = new Map();
  const validate = () => validateAssembly(parts, input.toJoints(), {
    sourceVolumeMm3: input.volumes.source,
    clearanceVolumeMm3: input.volumes.clearance + clearanceDelta,
    engravedVolumeMm3: input.volumes.engraved,
  });
  let report = validate();
  for (let round = 0; input.autoFix && round < MAX_ROUNDS && (report.blocked.length > 0 || report.clashes.length > 0); round++) {
    const current = input.toJoints();
    const culprits = new Set([...clashCulprits(report), ...blockCulprits(parts, smooth, current, report)]);
    const todo = joints.filter((j) => culprits.has(j.label) && j.kind !== 'glue');
    if (todo.length === 0) break;
    const blockedNow = new Set(report.blocked.length > 0 ? todo.map((j) => j.label) : []);
    suggestions.push(...suggestionsFor(smooth(), current, todo.map((j) => j.label)));
    const dirty = new Set<number>();
    for (const j of todo) {
      const low = bodies.get(j.low)!;
      const high = bodies.get(j.high)!;
      if (j.connector) originals.set(j.label, { connector: { ...j.connector }, centers: j.connectorCenters.map((c) => [c[0], c[1], c[2]]) });
      clearanceDelta -= demoteToGlue(j, low, high);
      glued.push(j.label);
      const code = blockedNow.has(j.label) && !clashCulprits(report).includes(j.label) ? 'ASSEMBLY_JOINT_GLUED_FOR_ORDER' : 'ASSEMBLY_JOINT_GLUED_FOR_CLASH';
      warnings.push(engineWarning(code, { label: j.label, a: low.code, b: high.code }));
      dirty.add(j.low);
      dirty.add(j.high);
    }
    rebuildParts(wasm, bodies, dirty, parts, index, warnings);
    report = validate();
  }
  const ok = report.blocked.length === 0 && report.clashes.length === 0;
  if (!input.autoFix && input.preFix) {
    report.fix = input.preFix;
    report.suggestions = input.preSuggestions;
  } else if (input.preFix || glued.length > 0) {
    const pre = input.preFix ?? { glueJoints: [], changeType: [], applied: false };
    const gluedSet = new Set(glued);
    report.fix = {
      glueJoints: [...new Set([...pre.glueJoints, ...glued])].sort(byLabel),
      changeType: pre.changeType.filter((c) => !gluedSet.has(c.joint)),
      applied: ok,
    };
    const merged = new Map(input.preSuggestions.map((s) => [s.joint, s]));
    for (const s of suggestions) {
      const prev = merged.get(s.joint);
      merged.set(s.joint, { joint: s.joint, options: [...new Set([...(prev?.options ?? []), ...s.options])] });
    }
    report.suggestions = [...merged.values()].sort((x, y) => byLabel(x.joint, y.joint));
  }
  // Solo sugerencias de uniones pegadas o que aún traban, y cambios de tipo que el validador confirma
  report.suggestions = checkSuggestions(report, parts, input.toJoints(), originals, input.connector);
  for (const s of report.order) {
    parts[s.part].assemblyStep = s.step;
    parts[s.part].insertDirection = s.direction;
  }
  return { report, clearanceDelta };
}
