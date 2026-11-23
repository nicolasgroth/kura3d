/**
 * @file src/store/modelIoActions.ts
 * @description Acciones de importación y exportación de modelos del store: lote parcial (importa
 * los archivos válidos y nombra los que fallaron), lectura en Worker, colocación en la cama
 * (conjunto apoyado o posición original), grupos por placa del laminador y por conjunto montado, aviso de malla abierta (con botón «Reparar malla») y de normales reorientadas, y exportación única
 * STL/3MF/OBJ+MTL/GLB/PLY de la selección o la escena con nombre elegido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import * as engine from '../engine';
import type { TranslationKey } from '../i18n';
import type { LanguageCode, MeshData, SceneObject, Vec3 } from '../types/kura';
import { FileSaveError, saveFileSet, type SaveSetEntry } from '../utils/platformBridge';
import { tCount } from '../utils/plural';
import { exportFileBase, sanitizeFileBase } from '../utils/exportNaming';
import { selectExportTargets } from './exportTargets';
import { placeGroupInFreeSpot, type BedSize } from '../core/scene/freeSpot';
import { exportSceneFiles, type ExportTaskArgs, type ExportTaskResult } from '../core/operations/engineTasks';
import { hasSplitParts, printLayoutTargets, zipPerPiece, type SplitExportMode } from './splitExport';
import { MAX_GROUP_NAME, objectAncestors, reconcileGroups } from '../core/scene/groups';
import { groupImported } from './importGrouping';
import { exportNotices, importErrorMessage } from './modelImportNotices';
import { readModelBatch } from './modelImportBatch';
import { isKuraScene, restoreKuraScene } from './kuraSceneRestore';
import { reportImportNotices, type ImportedEntry } from './importResultNotices';

export { importErrorMessage };

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

/**
 * Fuente de un archivo a importar (lectura diferida para fallar por archivo). En la web `read` entrega
 * el propio `File` (Blob), que se lee dentro del Worker; en escritorio, el ArrayBuffer leído del disco.
 */
export interface ModelImportSource {
  name: string;
  /** Tamaño en bytes si se conoce antes de leer (tope del lote y borrador de recuperación). */
  size?: number;
  read: () => Promise<ArrayBuffer | Blob>;
}

export interface ModelImportOptions {
  placement?: engine.ImportPlacementMode;
  /** Cancelación del usuario (botón Cancelar o Esc en la barra de progreso). */
  signal?: AbortSignal;
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
  buildObject: (params: { name: string; mesh: MeshData; position: Vec3; color: string; isHole?: boolean; rotation?: Vec3; scale?: Vec3 }) => SceneObject;
  /** Cama activa para buscar el hueco libre de las piezas importadas (null = sin límite). */
  bedSize?: () => BedSize | null;
  /** Genera los archivos de exportación (la app usa el Worker del motor; por defecto en proceso). */
  exportFiles?: (args: ExportTaskArgs) => Promise<ExportTaskResult>;
  /** Muestra los avisos del motor al leer (p. ej. normales reorientadas). */
  reportWarnings?: (warnings: readonly engine.EngineWarning[]) => void;
  /** Abre el panel Simplificar para un objeto (acción del aviso de malla pesada). */
  openSimplify?: (id: string) => void;
  /** Repara la malla de un objeto (acción del aviso de malla abierta). */
  repairMesh?: (id: string) => void | Promise<unknown>;
  /** Separa los cuerpos sueltos de un objeto en piezas (acción del aviso de varios cuerpos). */
  separateBodies?: (id: string) => void;
  /** Asegura un borrador de recuperación (si hay cambios sin guardar) antes de leer un archivo grande. */
  ensureRecoveryDraft?: () => Promise<void>;
  /** Sesión de lectura del lote (pruebas); por defecto el Worker de importación. */
  createImportSession?: (mtls: readonly engine.MtlSource[]) => engine.ModelImportSession;
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

export function createModelIoActions(deps: ModelIoDeps) {
  const { get, set, tr, pushHistory, buildObject } = deps;

  /** Importa un lote: los archivos válidos entran en un solo paso deshacible; los demás se informan. */
  async function importModelFiles(files: ModelImportSource[], options: ModelImportOptions = {}): Promise<boolean> {
    const placement = options.placement ?? get().importPlacementMode;
    const { models, failures, cancelled } = await readModelBatch(files, {
      tr,
      language: get().language,
      createSession: deps.createImportSession,
      ensureRecoveryDraft: deps.ensureRecoveryDraft,
      signal: options.signal,
    });
    if (cancelled) {
      get().addToast(tr('uxEscena.importCancelled'), 'info');
      return false;
    }

    if (models.length === 0) {
      get().addToast(failures.length > 0 ? failures.join(' · ') : tr('importError.no-geometry', { name: files[0]?.name ?? '' }), 'error');
      return false;
    }

    const state = get();
    const wasEmpty = state.objects.length === 0;
    const bed = deps.bedSize?.() ?? null;
    // Escenas exportadas por Kura3D: se restauran tal cual (sin reacomodo ni conjuntos).
    const sceneModels = models.filter(isKuraScene);
    const plainModels = models.filter((m) => !isKuraScene(m));
    // El conjunto se arma centrado y luego se mueve como bloque al primer hueco libre de la cama.
    const placed = engine.placeImportedModels(plainModels, placement, null);
    if (placement === 'bed' && !wasEmpty && placed.length > 0) {
      const spot = placeGroupInFreeSpot(state.objects, placed, bed);
      for (const p of placed) p.position = [p.position[0] + spot.offset[0], p.position[1], p.position[2] + spot.offset[2]];
      if (!spot.fits) get().addToast(tr('toast.placedOutsideBed'), 'info');
    }
    const created = placed.map((p) =>
      buildObject({
        name: (p.part.name || p.fileName).slice(0, MAX_GROUP_NAME),
        mesh: p.mesh,
        position: p.position,
        color: p.part.isHole ? '#f97316' : p.part.color ?? '',
        isHole: p.part.isHole,
      }),
    );
    // Placas del laminador y conjuntos montados quedan agrupados, en el mismo paso deshacible.
    const grouping = groupImported(plainModels, placed, created, state.groups?.length ?? 0, bed, tr);
    const entries: ImportedEntry[] = placed.map((p, i) => ({ object: grouping.objects[i], part: p.part, fileName: p.fileName }));
    const newGroups = [...grouping.groups];
    const notices = [...grouping.notices];
    for (const model of sceneModels) {
      const others = [...state.objects, ...entries.map((e) => e.object)];
      // Con la escena ya ocupada (y colocación en cama), el bloque entero va a un hueco libre.
      let offset: Vec3 = [0, 0, 0];
      if (placement === 'bed' && others.length > 0) {
        const items = model.parts.map((p) => ({ mesh: p.mesh, position: p.kura!.position, rotation: p.kura!.rotation, scale: p.kura!.scale }));
        const spot = placeGroupInFreeSpot(others, items, bed);
        offset = [spot.offset[0], 0, spot.offset[2]];
        if (!spot.fits) get().addToast(tr('toast.placedOutsideBed'), 'info');
      }
      const restored = restoreKuraScene(model, buildObject, offset);
      restored.objects.forEach((object, i) => entries.push({ object, part: model.parts[i], fileName: model.fileName }));
      newGroups.push(...restored.groups);
      notices.push(tr('realesMotor.sceneRestored', { name: model.fileName, count: restored.objects.length, groups: restored.groups.length }));
    }
    const createdObjects = entries.map((e) => e.object);
    const createdIds = createdObjects.map((o) => o.id);
    pushHistory();
    set((prev) => ({
      ...reconcileGroups({ objects: [...prev.objects, ...createdObjects], groups: [...(prev.groups ?? []), ...newGroups] }),
      selectedIds: createdIds,
    }));
    if (wasEmpty || placement === 'original') get().requestCameraPreset('fit', createdIds);
    else get().requestCameraPreset('ensure', createdIds);

    const noticeDeps = { tr, language: get().language, addToast: get().addToast, openSimplify: deps.openSimplify, repairMesh: deps.repairMesh, separateBodies: deps.separateBodies };
    reportImportNotices(entries, models.length, models[0].fileName, noticeDeps);
    for (const notice of notices) get().addToast(notice, 'info');
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
      // 3MF de la escena completa: viajan todos los objetos (ocultos y huecos sin ítem de build) y los
      // grupos, para que Kura3D la restaure tal cual al volver a abrirla.
      const fullScene = request.format === '3mf' && request.scope === 'scene' && !splitMode;
      const { files } = await exportFiles({
        format: request.format,
        targets: fullScene ? state.objects : layoutTargets,
        baseName: base,
        unitSystem: state.unitSystem,
        ...(fullScene ? { sceneGroups: state.groups ?? [] } : {}),
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
