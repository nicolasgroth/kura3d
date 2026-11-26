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
import type { LanguageCode, MeshData, ObjectRole, SceneObject, Vec3 } from '../types/kura';
import { isReference, roleFromLegacy } from '../core/scene/objectRole';
import { FileSaveError, saveFileSet, type SaveSetEntry } from '../utils/platformBridge';
import { tCount } from '../utils/plural';
import { exportFileBase, sanitizeFileBase } from '../utils/exportNaming';
import { selectExportTargets } from './exportTargets';
import { printPosedObjects } from './sceneLayout';
import { placeGroupInFreeSpot, type BedSize } from '../core/scene/freeSpot';
import { exportSceneFiles, type ExportTaskArgs, type ExportTaskResult } from '../core/operations/engineTasks';
import { hasSplitParts, printLayoutTargets, zipPerPiece, type SplitExportMode } from './splitExport';
import { MAX_GROUP_NAME, objectAncestors, reconcileGroups } from '../core/scene/groups';
import { groupImported } from './importGrouping';
import { exportNotices, importErrorMessage } from './modelImportNotices';
import { onlyPlate, singleFilePlan, zipPerPlate, type PlateExportMode } from './plateExportFlow';
import { planPlateExport } from '../core/scene/plateExport';
import { readModelBatch } from './modelImportBatch';
import { isKuraScene, kuraWorldPosition, restoreKuraScene } from './kuraSceneRestore';
import { reportImportNotices, type ImportedEntry } from './importResultNotices';
import { maxDimension, rescaleAsBlock } from './unitRescale';
import { IMPORT_BATCH_TRIANGLES, insertImportedObjects, yieldToMain } from './importInsertion';
import { primeCreasedMesh } from '../utils/creasedNormals';

/** Escena previa a una importación (para su paso de deshacer). */
export interface HistoryBase {
  objects: SceneObject[];
  selectedIds: string[];
  groups: import('../types/kura').SceneGroup[];
  /** Placas antes de importar (P7: abrir un 3MF de la app puede restaurarlas). */
  plates?: import('../types/plates').ScenePlate[];
}

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
  /** Piezas de varias placas en 3MF: un archivo con todas las placas (por defecto) o un 3MF por placa (ZIP). */
  plateMode?: PlateExportMode;
  /** Solo las piezas de esta placa, respecto de su cama (Command Bus). */
  plateId?: string;
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
  /** Lo importado entra como referencia (se ve y se mide; nunca se imprime ni exporta). */
  asReference?: boolean;
}

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Estado mínimo del store que usan estas acciones. */
interface IoState {
  language: LanguageCode;
  objects: SceneObject[];
  selectedIds: string[];
  /** Grupos de la escena (nombres del árbol al exportar un archivo por objeto). */
  groups?: import('../types/kura').SceneGroup[];
  /** Placas de un laminador → placas reales (P7); ausente en pruebas que no lo usan. */
  convertGroupsToPlates?: (groupIds?: string[]) => unknown;
  unitSystem: Parameters<typeof engine.exportSceneTo3MF>[1];
  printerProfile: { bedWidthMm?: number };
  customBedDimensions?: { width: number } | null;
  projectName: string | null;
  /** Placas de impresión (cada pieza se exporta respecto de la cama de la suya). */
  plates?: import('../types/plates').ScenePlate[];
  /** Modo de vista (ausente = imprimir): se exporta siempre desde las poses de impresión. */
  layout?: import('../types/plates').SceneLayout;
  importPlacementMode: engine.ImportPlacementMode;
  addToast: (text: string, kind?: 'info' | 'success' | 'error', action?: import('./storeTypes').ToastAction) => void;
  requestCameraPreset: (preset: 'fit' | 'ensure', ids?: string[]) => void;
}

export interface ModelIoDeps {
  get: () => IoState;
  set: (updater: (state: IoState) => Partial<IoState> & Record<string, unknown>) => void;
  tr: Translate;
  /** Paso de deshacer; con `before`, el estado previo es ese (la importación ya lo cambió por tandas). */
  pushHistory: (before?: HistoryBase) => void;
  buildObject: (params: {
    name: string; mesh: MeshData; position: Vec3; color: string; role?: ObjectRole; rotation?: Vec3; scale?: Vec3;
    /** Estadísticas locales calculadas en el Worker (evita recorrer la malla en el hilo principal). */
    stats?: SceneObject['stats'];
  }) => SceneObject;
  /** Avance de la entrada a la escena tras leer (pieza `done` de `total` ya en la escena). */
  onBuildProgress?: (done: number, total: number) => void;
  /** Cesión entre tandas de inserción (pruebas); por defecto, hasta el próximo pintado. */
  yieldFrame?: () => Promise<void>;
  /** Triángulos por tanda de inserción (pruebas); por defecto `IMPORT_BATCH_TRIANGLES`. */
  batchTriangles?: number;
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
  repairMeshes?: (groups: string[][]) => void | Promise<unknown>;
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

/** Siembra el sombreado con pliegue calculado en el Worker para la malla ya colocada de la pieza. */
function primeImportedShading(mesh: MeshData, part: engine.ImportedPart) {
  const shading = part.analysis?.shading;
  if (shading) primeCreasedMesh(mesh.positions, mesh.indices, shading);
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
    // Escenas exportadas por Kurra Studio: se restauran tal cual (sin reacomodo ni conjuntos).
    const sceneModels = models.filter(isKuraScene);
    const plainModels = models.filter((m) => !isKuraScene(m));
    // El conjunto se arma centrado y luego se mueve como bloque al primer hueco libre de la cama.
    const placed = engine.placeImportedModels(plainModels, placement, null);
    if (placement === 'bed' && !wasEmpty && placed.length > 0) {
      const spot = placeGroupInFreeSpot(state.objects, placed, bed);
      for (const p of placed) p.position = [p.position[0] + spot.offset[0], p.position[1], p.position[2] + spot.offset[2]];
      if (!spot.fits) get().addToast(tr('toast.placedOutsideBed'), 'info');
    }
    // Objetos construidos por tramos acotados en triángulos (cediendo el hilo entre tramos). El
    // sombreado del visor llega hecho desde el Worker y se siembra en su caché antes de montar.
    const created: SceneObject[] = [];
    let sliceTriangles = 0;
    for (const p of placed) {
      if (sliceTriangles >= (deps.batchTriangles ?? IMPORT_BATCH_TRIANGLES)) {
        sliceTriangles = 0;
        await yieldToMain();
      }
      sliceTriangles += Math.floor(p.mesh.indices.length / 3);
      primeImportedShading(p.mesh, p.part);
      created.push(buildObject({
        name: (p.part.name || p.fileName).slice(0, MAX_GROUP_NAME),
        mesh: p.mesh,
        position: p.position,
        color: p.part.isHole && !options.asReference ? '#f97316' : p.part.color ?? '',
        role: options.asReference ? 'reference' : roleFromLegacy(p.part.isHole),
        stats: p.part.analysis?.stats,
      }));
    }
    // Placas del laminador y conjuntos montados quedan agrupados, en el mismo paso deshacible.
    const grouping = groupImported(plainModels, placed, created, state.groups?.length ?? 0, bed, tr);
    const entries: ImportedEntry[] = placed.map((p, i) => ({ object: grouping.objects[i], part: p.part, fileName: p.fileName }));
    const newGroups = [...grouping.groups];
    const notices = [...grouping.notices];
    const restoredPlates: import('../types/plates').ScenePlate[] = [];
    for (const model of sceneModels) {
      const others = [...state.objects, ...entries.map((e) => e.object)];
      // Con la escena ya ocupada (y colocación en cama), el bloque entero va a un hueco libre.
      let offset: Vec3 = [0, 0, 0];
      if (placement === 'bed' && others.length > 0) {
        const items = model.parts.map((p) => ({ mesh: p.mesh, position: kuraWorldPosition(p.kura!), rotation: p.kura!.rotation, scale: p.kura!.scale }));
        const spot = placeGroupInFreeSpot(others, items, bed);
        offset = [spot.offset[0], 0, spot.offset[2]];
        if (!spot.fits) get().addToast(tr('toast.placedOutsideBed'), 'info');
      }
      for (const part of model.parts) primeImportedShading(part.mesh, part);
      // P7: abierto en una escena vacía y sin placas, sus placas reales vuelven como placas (con su cama).
      const withPlates = others.length === 0 && !(state.plates?.length) && !restoredPlates.length;
      const restored = restoreKuraScene(model, buildObject, offset, options.asReference, withPlates);
      restoredPlates.push(...restored.plates);
      restored.objects.forEach((object, i) => entries.push({ object, part: model.parts[i], fileName: model.fileName }));
      newGroups.push(...restored.groups);
      notices.push(tr('realesMotor.sceneRestored', { name: model.fileName, count: restored.objects.length, groups: restored.groups.length }));
    }
    const createdObjects = entries.map((e) => e.object);
    const createdIds = createdObjects.map((o) => o.id);
    // Entran a la escena por tandas, pintando entre una y otra; un solo paso deshacible al final.
    const before = { objects: state.objects, selectedIds: state.selectedIds, groups: state.groups ?? [], plates: state.plates ?? [] };
    const inserted = await insertImportedObjects(createdObjects, (prev) => ({
      ...reconcileGroups({ objects: [...prev.objects, ...createdObjects], groups: [...(prev.groups ?? []), ...newGroups] }),
      selectedIds: createdIds,
      ...(restoredPlates.length ? { plates: restoredPlates, activePlateId: restoredPlates[0].id } : {}),
    }), {
      get: () => get(),
      set: (patch) => set((prev) => patch(prev)),
      onProgress: deps.onBuildProgress,
      yieldFrame: deps.yieldFrame,
      signal: options.signal,
      budget: deps.batchTriangles,
    });
    if (!inserted) {
      get().addToast(tr('uxEscena.importCancelled'), 'info');
      return false;
    }
    pushHistory(before);
    if (wasEmpty || placement === 'original') get().requestCameraPreset('fit', createdIds);
    else get().requestCameraPreset('ensure', createdIds);

    const noticeDeps = { tr, language: get().language, addToast: get().addToast, openSimplify: deps.openSimplify, repairMesh: deps.repairMesh, repairMeshes: deps.repairMeshes, separateBodies: deps.separateBodies };
    reportImportNotices(entries, models.length, models[0].fileName, noticeDeps);
    // Placas de un laminador (P7): el aviso ofrece volverlas placas reales (otro paso de deshacer, aparte del de importar).
    const offers = new Map(grouping.plateOffers.map((o) => [o.notice, o]));
    notices.forEach((notice, i) => {
      const o = offers.get(i);
      get().addToast(notice, 'info', o ? { label: tr('plates.convert.offer'), ariaLabel: tr('plates.convert.importOffer', { name: o.fileName, count: o.count }), run: () => void get().convertGroupsToPlates?.(o.groupIds) } : undefined);
    });
    reportUnitHint(plainModels, entries);
    deps.reportWarnings?.(models.flatMap((m) => m.warnings ?? []));
    if (failures.length > 0) {
      get().addToast(tCount(get().language, { one: 'import.partialFailed.one', other: 'import.partialFailed.other' }, failures.length, { list: failures.join(' · ') }), 'error');
    }
    return true;
  }

  /**
   * Reescala ×`factor` los objetos como un bloque, en un paso deshacible (corrección de unidades).
   * Devuelve false si no queda ninguno de esos objetos o el factor no es válido.
   */
  function rescaleObjects(ids: readonly string[], factor: number): boolean {
    const wanted = new Set(ids);
    const targets = get().objects.filter((o) => wanted.has(o.id));
    if (targets.length === 0 || !Number.isFinite(factor) || factor <= 0) return false;
    const scaled = new Map(rescaleAsBlock(targets, factor).map((o) => [o.id, o]));
    pushHistory();
    set((prev) => ({ objects: prev.objects.map((o) => scaled.get(o.id) ?? o) }));
    const fmt = new Intl.NumberFormat(get().language, { maximumFractionDigits: 2 });
    get().addToast(tr('realesMotor.unitRescaled', { name: targets[0].name, factor: fmt.format(factor), size: fmt.format(maxDimension([...scaled.values()])) }), 'success');
    get().requestCameraPreset('fit', [...scaled.keys()]);
    return true;
  }

  /** Unidades dudosas del primer archivo sin unidad que las tenga: aviso con la escala más probable. */
  function reportUnitHint(models: readonly engine.ImportedModel[], entries: readonly ImportedEntry[]) {
    const model = models.find((m) => m.unitHint);
    const hint = model?.unitHint;
    if (!model || !hint) return;
    const ids = entries.filter((e) => model.parts.includes(e.part)).map((e) => e.object.id);
    const best = hint.suggestions[0];
    const fmt = new Intl.NumberFormat(get().language, { maximumFractionDigits: hint.maxDimensionMm < 10 ? 2 : 0 });
    const factorFmt = new Intl.NumberFormat(get().language, { maximumFractionDigits: 3 });
    get().addToast(
      tr('realesMotor.unitDoubt', { name: model.fileName, size: fmt.format(hint.maxDimensionMm) }),
      'info',
      {
        label: best.kind === 'fit'
          ? tr('realesMotor.unitFit', { mm: Math.round(best.resultMm) })
          : tr('realesMotor.unitScale', { factor: factorFmt.format(best.factor) }),
        run: () => void rescaleObjects(ids, best.factor),
        targetIds: ids,
        watch: 'scale',
      },
    );
  }

  /** Objetos a exportar según el alcance (selector compartido con el Command Bus), siempre en pose de impresión. */
  function exportTargets(scope: ExportScope): SceneObject[] {
    const { selectedIds } = get();
    const objects = printPosedObjects(get());
    const { targets, skippedHoles, skippedReferences } = selectExportTargets(objects, selectedIds, scope === 'selection');
    if (targets.length > 0 && skippedHoles > 0) get().addToast(tCount(get().language, { one: 'export.holesSkipped.one', other: 'export.holesSkipped.other' }, skippedHoles), 'info');
    if (skippedReferences > 0) get().addToast(tCount(get().language, { one: 'reference.export.skipped.one', other: 'reference.export.skipped.other' }, skippedReferences), 'info');
    return targets;
  }

  /** Exporta selección o escena en el formato pedido; false si no hay nada, se cancela o falla. */
  async function exportModel(request: ExportRequest): Promise<boolean> {
    const plates = get().plates ?? [];
    const scoped = exportTargets(request.scope);
    const targets = request.plateId ? onlyPlate(scoped, plates, request.plateId) : scoped;
    if (targets.length === 0) {
      get().addToast(tr('toast.nothingToExport'), 'error');
      return false;
    }
    const state = get();
    // Proyecto sin nombre: el nombre visible («Escena sin título»), no uno genérico de la app.
    const base = exportFileBase(request.fileName, state.projectName, targets, tr('app.untitled'));
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
      // Con placas: cada pieza respecto de la cama de su placa; varias placas en STL/OBJ/PLY/GLB (o 3MF por placa) = ZIP.
      const byPlate = splitMode === 'printLayout' ? null : planPlateExport(targets, plates);
      if (byPlate && byPlate.excluded > 0) get().addToast(tr('export.plates.excluded', { count: byPlate.excluded }), 'info');
      if (byPlate && byPlate.buckets.length === 0) {
        get().addToast(tr('toast.nothingToExport'), 'error');
        return false;
      }
      if (byPlate && byPlate.buckets.length >= 2 && (request.format !== '3mf' || request.plateMode === 'perPlate')) {
        const zipName = `${base}.zip`;
        const { data, names } = await zipPerPlate(byPlate.buckets, { format: request.format, unitSystem: state.unitSystem }, exportFiles);
        const saved = await saveFileSet([{ name: zipName, data, filters: [{ name: 'ZIP', extensions: ['zip'] }] }]);
        if (saved) get().addToast(tr('export.plates.zipDone', { count: names.length, name: zipName }), 'success');
        return saved;
      }
      const bedWidth = state.customBedDimensions?.width ?? state.printerProfile.bedWidthMm ?? 256;
      const layoutTargets = splitMode === 'printLayout' && request.format === '3mf' ? printLayoutTargets(targets, bedWidth) : targets;
      const filters = [EXPORT_FILTERS[request.format]];
      // 3MF de la escena completa: viajan los objetos (ocultos y negativos sin ítem de build) y los grupos,
      // para que Kurra Studio la restaure tal cual al volver a abrirla. Las referencias nunca: solo en el `.kura`.
      const fullScene = request.format === '3mf' && request.scope === 'scene' && !splitMode && !request.plateId;
      const single = byPlate ? singleFilePlan(targets, plates, fullScene ? printPosedObjects(state).filter((o) => !isReference(o)) : undefined) : null;
      const { files } = await exportFiles({
        format: request.format,
        targets: single ? single.targets : layoutTargets,
        baseName: base,
        unitSystem: state.unitSystem,
        ...(fullScene ? { sceneGroups: state.groups ?? [] } : {}),
        ...(single?.plateLayout && request.format === '3mf' ? { plateLayout: single.plateLayout } : {}),
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

  return { importModelFiles, exportModel, rescaleObjects };
}
