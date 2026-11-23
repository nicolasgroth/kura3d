/**
 * @file src/store/modelIoActions.ts
 * @description Acciones de importación y exportación de modelos del store: lote parcial (importa
 * los archivos válidos y nombra los que fallaron), lectura en Worker, colocación en la cama
 * (conjunto apoyado o posición original), grupos por placa del laminador y por conjunto montado, aviso de malla abierta y de normales reorientadas, y exportación única
 * STL/3MF/OBJ+MTL/GLB/PLY de la selección o la escena con nombre elegido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import * as engine from '../engine';
import { OPERATION_DEFAULTS } from '../engine/operationLimits';
import type { TranslationKey } from '../i18n';
import { ProjectCodecError } from '../project/projectSchema';
import type { LanguageCode, MeshData, SceneObject, Vec3 } from '../types/kura';
import { FileSaveError, LocalFileError, saveFileSet, type SaveSetEntry } from '../utils/platformBridge';
import { tCount } from '../utils/plural';
import { exportFileBase, sanitizeFileBase } from '../utils/exportNaming';
import { selectExportTargets } from './exportTargets';
import { placeGroupInFreeSpot, type BedSize } from '../core/scene/freeSpot';
import { exportSceneFiles, type ExportTaskArgs, type ExportTaskResult } from '../core/operations/engineTasks';
import { hasSplitParts, printLayoutTargets, zipPerPiece, type SplitExportMode } from './splitExport';
import { objectAncestors, reconcileGroups } from '../core/scene/groups';
import { groupImported } from './importGrouping';
import { exportNotices, tooLargeMessage } from './modelImportNotices';

export type ExportFormat = 'stl' | '3mf' | 'obj' | 'glb' | 'ply';
export type ExportScope = 'selection' | 'scene';

/** Petición del diálogo único de exportación. */
export interface ExportRequest {
  format: ExportFormat;
  scope: ExportScope;
  /** Nombre base sin extensión (se sanea); por defecto se deriva del proyecto. */
  fileName?: string;
  /** Piezas de una división: un archivo por pieza (ZIP) o un 3MF en disposición de impresión. */
  splitMode?: SplitExportMode;
  /** Grupo: un archivo por objeto en un ZIP, con el nombre del árbol (`Grupo - Objeto`). */
  perObject?: boolean;
}

/** Fuente de un archivo a importar (lectura diferida para fallar por archivo). */
export interface ModelImportSource {
  name: string;
  read: () => Promise<ArrayBuffer>;
}

export interface ModelImportOptions {
  placement?: engine.ImportPlacementMode;
}

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Estado mínimo del store que usan estas acciones. */
interface IoState {
  language: LanguageCode;
  objects: SceneObject[];
  selectedIds: string[];
  /** Grupos de la escena (nombres del árbol al exportar un archivo por objeto). */
  groups?: import('../types/kura').SceneGroup[];
  unitSystem: Parameters<typeof engine.exportSceneTo3MF>[1];
  printerProfile: { bedWidthMm?: number };
  customBedDimensions?: { width: number } | null;
  projectName: string | null;
  importPlacementMode: engine.ImportPlacementMode;
  addToast: (text: string, kind?: 'info' | 'success' | 'error', action?: { label: string; run: () => void }) => void;
  requestCameraPreset: (preset: 'fit' | 'ensure', ids?: string[]) => void;
}

export interface ModelIoDeps {
  get: () => IoState;
  set: (updater: (state: IoState) => Partial<IoState> & Record<string, unknown>) => void;
  tr: Translate;
  pushHistory: () => void;
  buildObject: (params: { name: string; mesh: MeshData; position: Vec3; color: string; isHole?: boolean }) => SceneObject;
  /** Cama activa para buscar el hueco libre de las piezas importadas (null = sin límite). */
  bedSize?: () => BedSize | null;
  /** Genera los archivos de exportación (la app usa el Worker del motor; por defecto en proceso). */
  exportFiles?: (args: ExportTaskArgs) => Promise<ExportTaskResult>;
  /** Muestra los avisos del motor al leer (p. ej. normales reorientadas). */
  reportWarnings?: (warnings: readonly engine.EngineWarning[]) => void;
  /** Abre el panel Simplificar para un objeto (acción del aviso de malla pesada). */
  openSimplify?: (id: string) => void;
}

const EXPORT_FILTERS: Record<ExportFormat, { name: string; extensions: string[] }> = {
  stl: { name: 'STL Binary', extensions: ['stl'] },
  '3mf': { name: '3D Manufacturing Format', extensions: ['3mf'] },
  obj: { name: 'Wavefront OBJ', extensions: ['obj'] },
  glb: { name: 'glTF Binary', extensions: ['glb'] },
  ply: { name: 'Stanford PLY', extensions: ['ply'] },
};

/** Huella XZ mundial de los objetos visibles de la escena (null si no hay). */
export function sceneFootprint(objects: SceneObject[]): engine.FootprintXZ | null {
  const box = new THREE.Box3();
  const local = new THREE.Box3();
  const matrix = new THREE.Matrix4();
  let any = false;
  for (const obj of objects) {
    if (!obj.visible || obj.mesh.positions.length < 3) continue;
    local.setFromArray(obj.mesh.positions);
    matrix.compose(
      new THREE.Vector3(...obj.position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ')),
      new THREE.Vector3(...obj.scale),
    );
    box.union(local.applyMatrix4(matrix));
    any = true;
  }
  return any ? { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z } : null;
}

/** Mensaje traducido de un fallo de importación que nombra el archivo. */
export function importErrorMessage(error: unknown, fileName: string, tr: Translate, language: LanguageCode = 'es'): string {
  if (error instanceof engine.ModelImportError) {
    if (error.code === 'too-large' && error.size) return tooLargeMessage(error.fileName ?? fileName, error.size, tr, language);
    const base = tr(`importError.${error.code}` as TranslationKey, { name: error.fileName ?? fileName });
    return error.detail && error.code !== 'unsupported' ? `${base.replace(/[.。।]$/, '')} (${error.detail})` : base;
  }
  if (error instanceof LocalFileError) return tr(`importError.${error.reason}` as TranslationKey, { name: error.fileName });
  if (error instanceof ProjectCodecError && error.code === 'too-large') return tr('importError.too-large', { name: fileName });
  const detail = error instanceof Error ? error.message : String(error);
  return tr('importError.corrupt', { name: fileName }) + (detail ? ` (${detail})` : '');
}

/** Busca el texto MTL que corresponde a un OBJ (por `mtllib` o, si hay uno solo, ese). */
function matchMtl(objBuffer: ArrayBuffer, mtls: Map<string, string>): string | undefined {
  if (mtls.size === 0) return undefined;
  const head = new TextDecoder('utf-8').decode(objBuffer.slice(0, 1 << 16));
  for (const lib of engine.objMaterialLibraries(head)) {
    const found = mtls.get(lib.split(/[\\/]/).pop()!.toLowerCase());
    if (found) return found;
  }
  return mtls.size === 1 ? [...mtls.values()][0] : undefined;
}

export function createModelIoActions(deps: ModelIoDeps) {
  const { get, set, tr, pushHistory, buildObject } = deps;

  /** Importa un lote: los archivos válidos entran en un solo paso deshacible; los demás se informan. */
  async function importModelFiles(files: ModelImportSource[], options: ModelImportOptions = {}): Promise<boolean> {
    const placement = options.placement ?? get().importPlacementMode;
    const failures: string[] = [];
    const mtls = new Map<string, string>();
    for (const file of files.filter((f) => /\.mtl$/i.test(f.name))) {
      try {
        mtls.set(file.name.toLowerCase(), new TextDecoder('utf-8').decode(await file.read()));
      } catch (error) {
        failures.push(importErrorMessage(error, file.name, tr, get().language));
      }
    }

    const models: engine.ImportedModel[] = [];
    for (const file of files.filter((f) => !/\.mtl$/i.test(f.name))) {
      try {
        if (!engine.detectModelFormat(file.name)) throw new engine.ModelImportError('unsupported', undefined, file.name);
        const buffer = await file.read();
        const mtlText = /\.obj$/i.test(file.name) ? matchMtl(buffer, mtls) : undefined;
        models.push(await engine.parseModelFileAsync(file.name, buffer, { mtlText }));
      } catch (error) {
        failures.push(importErrorMessage(error, file.name, tr, get().language));
      }
    }

    if (models.length === 0) {
      get().addToast(failures.length > 0 ? failures.join(' · ') : tr('importError.no-geometry', { name: files[0]?.name ?? '' }), 'error');
      return false;
    }

    const state = get();
    const wasEmpty = state.objects.length === 0;
    // El conjunto se arma centrado y luego se mueve como bloque al primer hueco libre de la cama.
    const placed = engine.placeImportedModels(models, placement, null);
    if (placement === 'bed' && !wasEmpty) {
      const spot = placeGroupInFreeSpot(state.objects, placed, deps.bedSize?.() ?? null);
      for (const p of placed) p.position = [p.position[0] + spot.offset[0], p.position[1], p.position[2] + spot.offset[2]];
      if (!spot.fits) get().addToast(tr('toast.placedOutsideBed'), 'info');
    }
    const created = placed.map((p) =>
      buildObject({
        name: p.part.name || p.fileName,
        mesh: p.mesh,
        position: p.position,
        color: p.part.isHole ? '#f97316' : p.part.color ?? '',
        isHole: p.part.isHole,
      }),
    );
    // Placas del laminador y conjuntos montados quedan agrupados, en el mismo paso deshacible.
    const grouping = groupImported(models, placed, created, state.groups?.length ?? 0, deps.bedSize?.() ?? null, tr);
    pushHistory();
    set((prev) => ({
      ...reconcileGroups({ objects: [...prev.objects, ...grouping.objects], groups: [...(prev.groups ?? []), ...grouping.groups] }),
      selectedIds: created.map((o) => o.id),
    }));
    if (wasEmpty || placement === 'original') get().requestCameraPreset('fit');
    else get().requestCameraPreset('ensure', created.map((o) => o.id));

    const pieces = created.length;
    const tris = created.reduce((acc, o) => acc + Math.floor(o.mesh.indices.length / 3), 0);
    const trisText = tr('import.trisSuffix', { tris: new Intl.NumberFormat(get().language).format(tris) });
    const summary = models.length === 1
      ? pieces === 1
        ? tr('import.importedOne', { name: models[0].fileName })
        : tr('import.importedParts', { name: models[0].fileName, count: pieces })
      : tr('import.importedFiles', { count: models.length, parts: pieces });
    get().addToast(`${summary} · ${trisText}`, 'success');
    for (const notice of grouping.notices) get().addToast(notice, 'info');
    const heavy = created.find((o) => o.stats.triangles >= OPERATION_DEFAULTS.heavyMesh.warnTriangles);
    if (heavy) {
      const fmt = new Intl.NumberFormat(get().language).format(heavy.stats.triangles);
      get().addToast(
        tr('import.heavy', { tris: fmt }),
        'info',
        deps.openSimplify ? { label: tr('import.heavy.action'), run: () => deps.openSimplify?.(heavy.id) } : undefined,
      );
    }
    const open = placed.filter((p) => p.part.openEdges > 0);
    if (open.length > 0) {
      const names = [...new Set(open.map((p) => p.part.name || p.fileName))];
      get().addToast(
        open.length === 1
          ? tr('import.openMesh', { name: names[0], edges: open[0].part.openEdges })
          : tr('import.openMeshMany', { count: open.length, list: names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '') }),
        'info',
      );
    }
    deps.reportWarnings?.(models.flatMap((m) => m.warnings ?? []));
    if (failures.length > 0) {
      get().addToast(tCount(get().language, { one: 'import.partialFailed.one', other: 'import.partialFailed.other' }, failures.length, { list: failures.join(' · ') }), 'error');
    }
    return true;
  }

  /** Objetos a exportar según el alcance (selector compartido con el Command Bus). */
  function exportTargets(scope: ExportScope): SceneObject[] {
    const { objects, selectedIds } = get();
    const { targets, skippedHoles } = selectExportTargets(objects, selectedIds, scope === 'selection');
    if (targets.length > 0 && skippedHoles > 0) get().addToast(tCount(get().language, { one: 'export.holesSkipped.one', other: 'export.holesSkipped.other' }, skippedHoles), 'info');
    return targets;
  }

  /** Exporta selección o escena en el formato pedido; false si no hay nada, se cancela o falla. */
  async function exportModel(request: ExportRequest): Promise<boolean> {
    const targets = exportTargets(request.scope);
    if (targets.length === 0) {
      get().addToast(tr('toast.nothingToExport'), 'error');
      return false;
    }
    const state = get();
    const base = exportFileBase(request.fileName, state.projectName, targets, tr('export.defaultName'));
    const fileName = `${base}.${request.format}`;
    const exportFiles = deps.exportFiles ?? exportSceneFiles;
    const splitMode = hasSplitParts(targets) ? request.splitMode : request.perObject ? 'perPiece' : undefined;
    try {
      if (splitMode === 'perPiece') {
        const zipName = `${base}.zip`;
        // Dentro del ZIP: <proyecto>_<código>; sin proyecto, el nombre del modelo original. Un grupo usa el
        // nombre elegido (el del grupo). Nunca arrastra la extensión del proyecto («grupos.kura»).
        const firstPart = targets.find((o) => o.metadata?.split);
        const pieceBase = request.perObject && !hasSplitParts(targets)
          ? base
          : sanitizeFileBase(state.projectName ?? '') || firstPart?.name.split(' · ')[0] || base;
        // Un archivo por objeto de un grupo: el nombre lleva la ruta del árbol.
        const named = request.perObject && !hasSplitParts(targets)
          ? targets.map((o) => ({ ...o, name: [...objectAncestors(state.groups ?? [], o).reverse().map((g) => g.name), o.name].join(' - ') }))
          : targets;
        const { data, count } = await zipPerPiece(named, pieceBase, {
          format: request.format,
          unitSystem: state.unitSystem,
        }, exportFiles);
        const saved = await saveFileSet([{ name: zipName, data, filters: [{ name: 'ZIP', extensions: ['zip'] }] }]);
        if (saved) get().addToast(tr('export.split.zipDone', { count, name: zipName }), 'success');
        return saved;
      }
      const bedWidth = state.customBedDimensions?.width ?? state.printerProfile.bedWidthMm ?? 256;
      const layoutTargets = splitMode === 'printLayout' && request.format === '3mf' ? printLayoutTargets(targets, bedWidth) : targets;
      const filters = [EXPORT_FILTERS[request.format]];
      const { files } = await exportFiles({
        format: request.format,
        targets: layoutTargets,
        baseName: base,
        unitSystem: state.unitSystem,
      });
      const entries: SaveSetEntry[] = files.map((f) => ({
        name: `${base}${f.suffix}`,
        data: f.data,
        filters: f.suffix === '.mtl' ? [{ name: 'Wavefront MTL', extensions: ['mtl'] }] : filters,
      }));
      const saved = await saveFileSet(entries);
      if (saved) {
        get().addToast(tr('toast.exported', { name: entries.map((e) => e.name).join(' + ') }), 'success');
        const triangles = layoutTargets.reduce((acc, o) => acc + Math.floor(o.mesh.indices.length / 3), 0);
        const sized = entries.filter((e) => !e.name.endsWith('.mtl')).map((e) => ({ name: e.name, bytes: e.data.byteLength }));
        for (const notice of exportNotices(sized, triangles, tr, get().language)) get().addToast(notice, 'info');
      }
      return saved;
    } catch (error) {
      const name = error instanceof FileSaveError ? error.fileName : fileName;
      get().addToast(tr('export.saveFailed', { name, message: error instanceof Error ? error.message : String(error) }), 'error');
      return false;
    }
  }

  return { importModelFiles, exportModel };
}
