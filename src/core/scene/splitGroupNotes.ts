/**
 * @file src/core/scene/splitGroupNotes.ts
 * @description Avisos de una división de "dividir para imprimir" entre el motor, la sesión y el archivo:
 * arma las notas del grupo y el informe de armado inicial a partir del resultado de la división, las
 * guarda en una forma plana con límites (`metadata.split.groupNotes`, para reabrir el `.kura`) y las
 * recupera validando los códigos de aviso. Sin React ni motor en ejecución: solo datos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { ENGINE_WARNING_CODES, type EngineWarning } from '../../engine/engineErrors';
import type { AssemblyFixOption, AssemblySummary } from '../../engine/split/assemblyTypes';
import type { SceneObject, SplitStoredNotes, SplitStoredReport } from '../../types/kura';
import type { SplitGroupNotes } from './splitJointStatus';

const KNOWN = new Set<string>(ENGINE_WARNING_CODES);
const MAX_WARNINGS = 256;

/** Notas del grupo con lo que dijo el motor al dividir (avisos, arreglos aplicados y estado del armado). */
export function buildGroupNotes(warnings: readonly EngineWarning[] | undefined, assembly: AssemblySummary | undefined): SplitGroupNotes {
  return {
    warnings: [...(warnings ?? [])],
    suggestions: assembly?.suggestions ?? [],
    weakJoints: assembly?.weakJoints ?? [],
    gluedByFix: assembly?.gluedByFix ?? [],
    changedByFix: assembly?.changedByFix ?? [],
    // Informe completo del cierre de la división: bloqueos con detalle, débiles medidas, interferencias y huecos.
    report: assembly
      ? {
          ok: assembly.ok, steps: assembly.steps, blocked: [...assembly.blocked], clashes: assembly.clashes,
          interference: assembly.closure?.interference.length ?? 0, gaps: assembly.closure?.gaps.length ?? 0,
          blockedDetail: (assembly.blockedDetail ?? []).map((b) => ({ code: b.code, conflictingJoints: [...b.conflictingJoints], blockingParts: [...b.blockingParts] })),
          weak: (assembly.weak ?? []).map((w) => ({ joint: w.joint, measuredMm: w.measuredMm, recommendedMm: w.recommendedMm })),
        }
      : undefined,
  };
}

/** Informe acotado para guardar (mismos límites que valida `projectSchema.ts`). */
function storedReport(r: SplitStoredReport): SplitStoredReport {
  const finite = (n: number) => (Number.isFinite(n) && n >= 0 ? n : 0);
  return {
    ok: r.ok, steps: r.steps, blocked: r.blocked.slice(0, 512), clashes: r.clashes, interference: r.interference, gaps: r.gaps,
    ...(r.blockedDetail ? {
      blockedDetail: r.blockedDetail.slice(0, 512).map((b) => ({
        code: b.code, conflictingJoints: b.conflictingJoints.slice(0, 64), blockingParts: b.blockingParts.slice(0, 64),
      })),
    } : {}),
    ...(r.weak ? { weak: r.weak.slice(0, 512).map((w) => ({ joint: w.joint, measuredMm: finite(w.measuredMm), recommendedMm: finite(w.recommendedMm) })) } : {}),
  };
}

/** Forma plana y acotada para guardar en el proyecto. */
export function toStoredNotes(notes: SplitGroupNotes): SplitStoredNotes {
  const params = (p: EngineWarning['params']) =>
    Object.fromEntries(Object.entries(p).slice(0, 16).map(([k, v]) => [k.slice(0, 32), typeof v === 'string' ? v.slice(0, 200) : v]));
  return {
    warnings: notes.warnings.slice(0, MAX_WARNINGS).map((w) => ({ code: w.code, params: params(w.params) })),
    suggestions: notes.suggestions.slice(0, 512).map((s) => ({ joint: s.joint, options: [...s.options].slice(0, 8) })),
    weakJoints: notes.weakJoints.slice(0, 512),
    gluedByFix: notes.gluedByFix.slice(0, 512),
    changedByFix: notes.changedByFix.slice(0, 512),
    ...(notes.report ? { report: storedReport(notes.report) } : {}),
  };
}

/** Notas guardadas → notas de la sesión (descarta los códigos de aviso que esta versión no conoce). */
export function fromStoredNotes(stored: SplitStoredNotes): SplitGroupNotes {
  return {
    warnings: stored.warnings.filter((w) => KNOWN.has(w.code)).map((w) => ({ code: w.code as EngineWarning['code'], params: { ...w.params } })),
    suggestions: stored.suggestions.map((s) => ({ joint: s.joint, options: s.options as AssemblyFixOption[] })),
    weakJoints: [...stored.weakJoints],
    gluedByFix: [...stored.gluedByFix],
    changedByFix: [...stored.changedByFix],
    report: stored.report ? storedReport(stored.report) : undefined,
  };
}

/** Pone las notas en la pieza de menor código de las piezas nuevas (una sola copia por grupo). */
export function attachNotesToParts<T extends Pick<SceneObject, 'metadata'>>(parts: readonly T[], notes: SplitGroupNotes): T[] {
  let first = -1;
  parts.forEach((p, i) => {
    const code = p.metadata?.split?.code;
    if (code === undefined) return;
    if (first < 0 || code.localeCompare(parts[first].metadata!.split!.code, undefined, { numeric: true }) < 0) first = i;
  });
  if (first < 0) return [...parts];
  const stored = toStoredNotes(notes);
  return parts.map((p, i) => (i === first ? { ...p, metadata: { ...p.metadata, split: { ...p.metadata!.split!, groupNotes: stored } } } : p));
}

/** Notas de un grupo: las de la sesión si hay y, si no, las guardadas en alguna de sus piezas. */
export function groupNotesOf(parts: readonly Pick<SceneObject, 'metadata'>[], session: SplitGroupNotes | null | undefined): SplitGroupNotes | null {
  if (session) return session;
  const stored = parts.find((p) => p.metadata?.split?.groupNotes)?.metadata?.split?.groupNotes;
  return stored ? fromStoredNotes(stored) : null;
}
