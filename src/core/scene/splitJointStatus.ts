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
import type { SceneObject, SplitJointRecord, SplitStoredReport, Vec3 } from '../../types/kura';
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
  /**
   * Estado del armado al terminar de dividir (piezas que traban con su detalle, choques, interferencias,
   * huecos y uniones débiles medidas); sin él, solo se ven los avisos.
   */
  report?: SplitStoredReport;
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
  'ASSEMBLY_JOINT_GLUED_FOR_CLASH',
  'ASSEMBLY_JOINT_TYPE_CHANGED',
  'SPLIT_LAP_NOT_PRINTABLE',
  'SPLIT_LABEL_DEPTH_CLAMPED',
  'ASSEMBLY_CONNECTOR_CLASH',
  'ASSEMBLY_GAP',
  'SPLIT_JOINT_PARTIAL_GLUE',
  'SPLIT_CONNECTOR_REINFORCED',
  'SPLIT_LABEL_DOTS',
  'SPLIT_JOINT_MESH_OPEN',
  // Lleva el código de la pieza (no la etiqueta): se muestra en las uniones de esa pieza.
  'SPLIT_PART_NOT_CLOSED',
]);

export type SplitJointMark = 'joint' | 'outside' | 'dots' | 'skipped' | 'none' | 'unknown';

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
  /** `true` si la marca de pareja de esta unión va como puntos por fuera (`labelPlacement: 'dots'`). */
  labelDots: boolean;
  /** Dónde quedó la marca de pareja: en la cara de unión, por fuera, como puntos, omitida (sin espacio), desactivada o sin dato. */
  mark: SplitJointMark;
  /** `true` si el motor reforzó el conector de esta unión (solo si aún tiene conector). */
  reinforced: boolean;
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
    : notes?.report?.weak
      ? notes.report.weak.map((w) => ({ ...w, areaFraction: 0 }))
      : (notes?.weakJoints ?? []).map((joint) => {
        const w = warnings.find((x) => x.code === 'ASSEMBLY_WEAK_JOINT' && labelOf(x) === joint);
        return { joint, measuredMm: Number(w?.params.measured ?? 0), recommendedMm: Number(w?.params.recommended ?? 0), areaFraction: 0 };
      });
  const suggestions = validation ? validation.suggestions : notes?.suggestions ?? [];
  for (const w of warnings) if (w.code === 'ASSEMBLY_JOINT_TYPE_CHANGED') changed.add(labelOf(w));
  for (const w of warnings) if (w.code === 'ASSEMBLY_JOINT_GLUED_FOR_ORDER' || w.code === 'ASSEMBLY_JOINT_GLUED_FOR_CLASH') glued.add(labelOf(w));
  // Piezas que traba cada unión: de la última validación o, si no hay, del informe de la división.
  const blockedDetail = validation ? validation.blockedDetail : notes?.report?.blockedDetail ?? [];

  return records.map((r) => {
    const stillConnector = r.kind === 'connector' && !glued.has(r.label) && !changed.has(r.label);
    // Una unión pegada o cambiada ya no se mide como conector débil
    const weak = stillConnector ? weakList.find((w) => w.joint === r.label) ?? null : null;
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
    const seen = new Set<string>();
    const own = warnings.filter((w) => {
      if (!JOINT_WARNING_CODES.has(w.code)) return false;
      // El refuerzo solo se cuenta en uniones que conservan conector
      if (w.code === 'SPLIT_CONNECTOR_REINFORCED' && !stillConnector) return false;
      const mine = w.code === 'SPLIT_PART_NOT_CLOSED' ? [r.a, r.b].includes(String(w.params.code)) : labelOf(w) === r.label;
      const key = `${w.code}:${w.params.code ?? ''}`;
      if (!mine || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const blocks = blockedDetail.filter((b) => b.conflictingJoints.includes(r.label)).map((b) => b.code);
    // La marca de puntos la dice el registro; los proyectos anteriores (sin el campo) la deducen del aviso.
    const labelDots = r.labelPlacement !== undefined ? r.labelPlacement === 'dots' : own.some((w) => w.code === 'SPLIT_LABEL_DOTS');
    const skipped = warnings.some((w) => w.code === 'SPLIT_LABEL_SKIPPED' && labelOf(w) === r.label);
    const mark: SplitJointMark = labelDots ? 'dots'
      : r.labelPlacement === 'joint' || r.labelPlacement === 'outside' ? r.labelPlacement
        : skipped ? 'skipped'
          : r.labelPlacement === null ? 'none' : 'unknown';
    return {
      label: r.label, a: r.a, b: r.b, axis: r.axis, position: r.position, kind: r.kind, connector: r.connector,
      centers: r.connectorCenters, status, labelDots, mark,
      reinforced: own.some((w) => w.code === 'SPLIT_CONNECTOR_REINFORCED'),
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
