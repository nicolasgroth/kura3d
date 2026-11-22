/**
 * @file src/core/scene/splitJointStatus.ts
 * @description Lista de uniones de un grupo dividido para la interfaz: junta los registros guardados en
 * cada pieza (`metadata.split.joints`), lo que dijo el motor al dividir (avisos, arreglos aplicados) y el
 * último "Validar armado", y deduce el estado de cada unión (firme, débil, para pegar, tipo cambiado o
 * que traba el montaje), sus avisos propios y las opciones que sugiere el motor. También da el orden de
 * armado por pieza y los tarugos sueltos del grupo. Sin React ni motor: solo datos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { EngineWarning, EngineWarningCode } from '../../engine/engineErrors';
import type { AssemblyFixOption, AssemblySuggestion, WeakJoint } from '../../engine/split/assemblyTypes';
import type { SceneObject, SplitJointRecord, Vec3 } from '../../types/kura';
import type { SplitGroup } from './splitGroups';

export type SplitJointStatus = 'ok' | 'weak' | 'glue' | 'changed' | 'blocked';

/** Lo que el motor dijo al dividir el grupo (se conserva en la sesión; no va al archivo .kura). */
export interface SplitGroupNotes {
  warnings: EngineWarning[];
  suggestions: AssemblySuggestion[];
  weakJoints: string[];
  gluedByFix: string[];
  /** `"3:dovetail"`: unión y tipo al que cambió el arreglo. */
  changedByFix: string[];
}

/** Resultado de revalidar el armado (subconjunto de `storedAssemblyResponse` que usa la interfaz). */
export interface SplitValidationReport {
  ok: boolean;
  parts: number;
  joints: number;
  steps: number;
  blocked: string[];
  clashes: number;
  weak: WeakJoint[];
  suggestions: AssemblySuggestion[];
  order: Array<{ step: number; code: string; direction: string }>;
  blockedDetail: Array<{ code: string; conflictingJoints: string[]; blockingParts: string[] }>;
  closure: { ok: boolean; interference: unknown[]; gaps: unknown[] };
  warnings: EngineWarning[];
}

/** Códigos de aviso que se muestran junto a la unión afectada (llevan `label` en sus parámetros). */
const JOINT_WARNING_CODES: ReadonlySet<EngineWarningCode> = new Set<EngineWarningCode>([
  'ASSEMBLY_JOINT_GLUED_FOR_ORDER',
  'ASSEMBLY_JOINT_TYPE_CHANGED',
  'SPLIT_LAP_NOT_PRINTABLE',
  'SPLIT_LABEL_DEPTH_CLAMPED',
  'ASSEMBLY_CONNECTOR_CLASH',
  'ASSEMBLY_GAP',
]);

export interface SplitJointRow {
  label: string;
  a: string;
  b: string;
  axis: SplitJointRecord['axis'];
  position: number;
  kind: SplitJointRecord['kind'];
  connector: SplitJointRecord['connector'];
  centers: Vec3[];
  status: SplitJointStatus;
  /** Medida y recomendación del conector si la unión es débil. */
  weak: { measuredMm: number; recommendedMm: number } | null;
  /** Avisos del motor propios de esta unión (solape no imprimible, marca limitada, pegada, cambiada…). */
  warnings: EngineWarning[];
  /** Piezas que esta unión impide montar (si traba). */
  blocks: string[];
  /** Alternativas del motor para una unión que traba: `glue` o `change-type:<tipo>`. */
  options: AssemblyFixOption[];
}

/** Registros de uniones de las piezas del grupo, sin repetir (cada unión se guarda en sus dos piezas). */
export function groupJointRecords(group: Pick<SplitGroup, 'parts'>): SplitJointRecord[] {
  const seen = new Map<string, SplitJointRecord>();
  for (const part of group.parts) {
    for (const j of part.metadata.split.joints ?? []) if (!seen.has(j.label)) seen.set(j.label, j);
  }
  return [...seen.values()].sort((x, y) => Number(x.label) - Number(y.label) || x.label.localeCompare(y.label));
}

const labelOf = (w: EngineWarning) => String(w.params.label ?? '');

/** Filas de la sección "Uniones". `validation` (si existe) manda sobre lo dicho al dividir. */
export function buildJointRows(
  group: Pick<SplitGroup, 'parts'>,
  notes: SplitGroupNotes | null | undefined,
  validation: SplitValidationReport | null | undefined,
): SplitJointRow[] {
  const records = groupJointRecords(group);
  const warnings = [...(notes?.warnings ?? []), ...(validation?.warnings ?? [])];
  const changed = new Set((notes?.changedByFix ?? []).map((c) => c.split(':')[0]));
  const glued = new Set(notes?.gluedByFix ?? []);
  const weakList: WeakJoint[] = validation
    ? validation.weak
    : (notes?.weakJoints ?? []).map((joint) => {
        const w = warnings.find((x) => x.code === 'ASSEMBLY_WEAK_JOINT' && labelOf(x) === joint);
        return { joint, measuredMm: Number(w?.params.measured ?? 0), recommendedMm: Number(w?.params.recommended ?? 0), areaFraction: 0 };
      });
  const suggestions = validation ? validation.suggestions : notes?.suggestions ?? [];
  for (const w of warnings) if (w.code === 'ASSEMBLY_JOINT_TYPE_CHANGED') changed.add(labelOf(w));
  for (const w of warnings) if (w.code === 'ASSEMBLY_JOINT_GLUED_FOR_ORDER') glued.add(labelOf(w));

  return records.map((r) => {
    const weak = weakList.find((w) => w.joint === r.label) ?? null;
    // Una unión ya pegada o cambiada por el motor no sigue trabando: solo una unión aún con conector puede trabar.
    const pending = r.kind === 'connector' && !glued.has(r.label) && !changed.has(r.label) ? suggestions.find((s) => s.joint === r.label) : undefined;
    const status: SplitJointStatus = pending
      ? 'blocked'
      : changed.has(r.label)
        ? 'changed'
        : r.kind === 'glue' || glued.has(r.label)
          ? 'glue'
          : weak
            ? 'weak'
            : 'ok';
    const seenCodes = new Set<string>();
    const own = warnings.filter((w) => {
      if (!JOINT_WARNING_CODES.has(w.code) || labelOf(w) !== r.label || seenCodes.has(w.code)) return false;
      seenCodes.add(w.code);
      return true;
    });
    const blocks = validation ? validation.blockedDetail.filter((b) => b.conflictingJoints.includes(r.label)).map((b) => b.code) : [];
    return {
      label: r.label, a: r.a, b: r.b, axis: r.axis, position: r.position, kind: r.kind, connector: r.connector,
      centers: r.connectorCenters, status,
      weak: weak ? { measuredMm: weak.measuredMm, recommendedMm: weak.recommendedMm } : null,
      warnings: own, blocks, options: pending?.options ?? [],
    };
  });
}

/** Piezas del grupo por paso de montaje (las sin paso van al final, por código). */
export function assemblyOrderOf(group: Pick<SplitGroup, 'parts'>): Array<{ id: string; code: string; step: number | null; direction: string | null }> {
  return group.parts
    .map((o) => ({ id: o.id, code: o.metadata.split.code, step: o.metadata.split.assemblyStep ?? null, direction: o.metadata.split.insertDirection ?? null }))
    .sort((p, q) => (p.step ?? Infinity) - (q.step ?? Infinity) || p.code.localeCompare(q.code));
}

/** Lotes de tarugos sueltos del grupo (objetos con `metadata.splitDowel` del mismo `groupId`). */
export function groupLooseDowels(objects: SceneObject[], groupId: string): Array<{ id: string; diameterMm: number; lengthMm: number; count: number }> {
  return objects
    .filter((o) => o.metadata?.splitDowel?.groupId === groupId)
    .map((o) => ({ id: o.id, ...o.metadata!.splitDowel! }));
}

/** Tipo de conector que propone una opción `change-type:<tipo>`; `null` si es `glue`. */
export function optionType(option: AssemblyFixOption): string | null {
  return option.startsWith('change-type:') ? option.slice('change-type:'.length) : null;
}
