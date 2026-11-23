/**
 * @file src/store/importResultNotices.ts
 * @description Avisos tras importar: resumen (piezas y triángulos), malla pesada (con «Simplificar»),
 * varios cuerpos en una pieza (con «Separar») y malla abierta. Las piezas que comparten la misma malla
 * de origen (instancias repetidas de un 3MF) cuentan una sola vez: un aviso por malla única («usada en
 * N piezas») con un botón que las repara todas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type * as engine from '../engine';
import { OPERATION_DEFAULTS } from '../engine/operationLimits';
import { countMeshBodies } from '../engine/io/meshBodies';
import type { LanguageCode, MeshData, SceneObject } from '../types/kura';
import type { Translate } from './modelImportNotices';

/** Objeto creado y la pieza leída de la que viene. */
export interface ImportedEntry {
  object: SceneObject;
  part: engine.ImportedPart;
  fileName: string;
}

export interface ImportNoticeDeps {
  tr: Translate;
  language: LanguageCode;
  addToast: (text: string, kind?: 'info' | 'success' | 'error', action?: { label: string; run: () => void }) => void;
  openSimplify?: (id: string) => void;
  /** Repara un objeto; si devuelve una promesa, las reparaciones en lote van una tras otra. */
  repairMesh?: (id: string) => void | Promise<unknown>;
  /** «Reparar todas»: grupos de piezas que comparten malla; cada malla se repara una vez y se resume. */
  repairMeshes?: (groups: string[][]) => void | Promise<unknown>;
  separateBodies?: (id: string) => void;
}

/** Piezas agrupadas por su malla de origen (misma referencia = misma malla del archivo). */
export function uniqueMeshes(entries: readonly ImportedEntry[]): Array<{ mesh: MeshData; entries: ImportedEntry[] }> {
  const byMesh = new Map<MeshData, ImportedEntry[]>();
  for (const entry of entries) {
    const key = entry.part.mesh;
    const list = byMesh.get(key);
    if (list) list.push(entry);
    else byMesh.set(key, [entry]);
  }
  return [...byMesh.entries()].map(([mesh, list]) => ({ mesh, entries: list }));
}

export function reportImportNotices(entries: readonly ImportedEntry[], modelCount: number, firstFileName: string, deps: ImportNoticeDeps): void {
  const { tr, addToast } = deps;
  const fmt = (n: number) => new Intl.NumberFormat(deps.language).format(n);
  const pieces = entries.length;
  const tris = entries.reduce((acc, e) => acc + Math.floor(e.object.mesh.indices.length / 3), 0);
  const trisText = tr('import.trisSuffix', { tris: fmt(tris) });
  const summary = modelCount === 1
    ? pieces === 1
      ? tr('import.importedOne', { name: firstFileName })
      : tr('import.importedParts', { name: firstFileName, count: pieces })
    : tr('import.importedFiles', { count: modelCount, parts: pieces });
  addToast(`${summary} · ${trisText}`, 'success');

  const unique = uniqueMeshes(entries);
  const heavy = unique.find((u) => u.mesh.indices.length / 3 >= OPERATION_DEFAULTS.heavyMesh.warnTriangles);
  if (heavy) {
    const id = heavy.entries[0].object.id;
    addToast(
      tr('import.heavy', { tris: fmt(Math.floor(heavy.mesh.indices.length / 3)) }),
      'info',
      deps.openSimplify ? { label: tr('import.heavy.action'), run: () => deps.openSimplify?.(id) } : undefined,
    );
  }
  // Un archivo con varios cuerpos sueltos en una sola pieza: se avisa y se ofrece separarlos.
  for (const u of unique) {
    const bodies = (u.entries[0].part.analysis ? u.entries[0].part.analysis.bodies : countMeshBodies(u.mesh)) ?? 1;
    if (bodies <= 1) continue;
    const object = u.entries[0].object;
    addToast(
      tr('uxEscena.multiBody', { name: object.name, count: bodies }),
      'info',
      deps.separateBodies ? { label: tr('uxEscena.multiBody.action'), run: () => deps.separateBodies?.(object.id) } : undefined,
    );
    break;
  }
  const open = unique.filter((u) => u.entries[0].part.openEdges > 0);
  if (open.length === 0) return;
  const label = (e: ImportedEntry) => e.part.name || e.fileName;
  // Una reparación por malla única, aplicada a todas sus piezas, con un aviso resumen; sin la acción por
  // lotes, en serie (cada reparación es una operación exclusiva del motor).
  const repairAll = (groups: string[][]) => () => {
    if (deps.repairMeshes) {
      void deps.repairMeshes(groups);
      return;
    }
    void (async () => {
      for (const id of groups.flat()) await deps.repairMesh?.(id);
    })();
  };
  const canRepair = Boolean(deps.repairMesh || deps.repairMeshes);
  if (open.length === 1) {
    const u = open[0];
    const ids = u.entries.map((e) => e.object.id);
    const edges = u.entries[0].part.openEdges;
    addToast(
      ids.length === 1
        ? tr('import.openMesh', { name: label(u.entries[0]), edges })
        : tr('realesMotor.openMeshShared', { name: label(u.entries[0]), count: ids.length, edges }),
      'info',
      ids.length === 1
        ? deps.repairMesh ? { label: tr('repair.action'), run: () => void deps.repairMesh?.(ids[0]) } : undefined
        : canRepair ? { label: tr('realesMotor.repairAll'), run: repairAll([ids]) } : undefined,
    );
    return;
  }
  const names = open.map((u) => label(u.entries[0]));
  const groups = open.map((u) => u.entries.map((e) => e.object.id));
  addToast(
    tr('import.openMeshMany', { count: open.length, list: names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '') }),
    'info',
    canRepair ? { label: tr('realesMotor.repairAll'), run: repairAll(groups) } : undefined,
  );
}
