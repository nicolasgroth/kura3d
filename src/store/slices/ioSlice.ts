/**
 * @file src/store/slices/ioSlice.ts
 * @description Slice de importación y exportación: SVG extruido, relieve de imagen, mallas
 * STL/3MF/OBJ/PLY (escena o como módulo +/− sobre un objetivo), colocación de importaciones y
 * exportación única (STL, 3MF, OBJ+MTL, GLB, PLY).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { importPartsPhase, importStagePhase, parseImportParts, type ImportStage } from '../importPhase';
import * as engine from '../../engine';
import { HOLE_HELPER_COLOR, importSvg, imageRelief, positionOnTarget, readSvgContours } from '../../core/operations';
import { announceFreePlacement, createFreePlacer, type FreePlacer } from '../freePlacement';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { resolveModuleTarget } from '../../core/scene/sceneRules';
import { PRINT_COLOR_PALETTE, type ImageTo3DOptions, type SceneObject, type Vec3 } from '../../types/kura';

type ImageShapeMode = NonNullable<ImageTo3DOptions['shapeMode']>;
import { MAX_MODEL_FILE_BYTES, openLocalFile, openLocalFiles } from '../../utils/platformBridge';
import { flushRecoveryDraft } from '../../project/recoveryFlush';
import { activeBedSize } from '../bedSize';
import { cloneSnapshot, isProjectDirty } from '../projectDocument';
import { createModelIoActions, type ModelImportSource } from '../modelIoActions';
import { loadInitialImportPlacement, STORAGE_IMPORT_PLACEMENT_KEY, writeStorage } from '../preferencesStorage';
import type { EngineJob } from '../../core/operations/engineClient';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

/** Lee un archivo STL, 3MF, OBJ o PLY en el Worker: piezas centradas listas para anclar a un objetivo. */
async function parseModelBufferToMeshes(file: { name: string; buffer: ArrayBuffer }) {
  // Los lectores ya validan índices, NaN, límites y orientación; aquí solo se centra cada pieza.
  const model = await engine.parseModelFileAsync(file.name, file.buffer);
  const parts = model.parts.map((part) => ({
    name: part.name || file.name.replace(/\.[^.]+$/, ''),
    mesh: engine.normalizeMeshToBed(part.mesh),
    color: part.color,
  }));
  return { parts, warnings: model.warnings ?? [] };
}

export function createIoSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, runExclusive, runtime, projectErrorMessage, opCtx, reportEngineWarnings } = ctx;

  /** Igual que en `importModelFiles`: no se importa durante otra operación, la IA o un arrastre. */
  const rejectWhileBusy = () => {
    const state = get();
    if (state.projectBusy || state.busyOperation || state.aiBusy || runtime.transformSnapshotBeforeDrag) {
      state.addToast(tr('fileProject.busy'), 'info');
      return true;
    }
    return false;
  };

  // Tras importar se encuadra SIEMPRE todo lo importado (con margen y descontando paneles): con
  // `ensure` un conjunto grande que ya asomaba en pantalla quedaba diminuto o a medias.
  /** Fase de la importación en la barra de progreso (no pisa un avance por piezas del motor). */
  const setImportStage = (stage: ImportStage) => {
    const progress = get().busyProgress;
    if (!progress || progress.name !== 'import_mesh' || parseImportParts(progress.phase)) return;
    const phase = importStagePhase(stage);
    if (progress.phase !== phase) set({ busyProgress: { ...progress, phase } });
  };
  const fitImported = (_preset: 'fit' | 'ensure', ids?: string[]) => get().requestCameraPreset('fit', ids);
  const modelIo = createModelIoActions({
    get: () => ({ ...get(), requestCameraPreset: fitImported }),
    set: (updater) => set((state) => updater(state) as Partial<KuraStoreState>),
    tr,
    // La importación entra por tandas: su paso de deshacer guarda la escena de antes de empezar.
    pushHistory: (before) => (before ? ctx.pushHistoryStep(cloneSnapshot(before.objects, before.selectedIds, before.groups, get().plates, get().layout)) : pushHistory()),
    buildObject: ({ name, mesh, position, color, role, rotation, scale, stats }) =>
      (setImportStage('place'), buildSceneObject({ name, source: 'imported', mesh, position, rotation, scale, stats, color: color || PRINT_COLOR_PALETTE[get().objects.length % PRINT_COLOR_PALETTE.length], role })),
    onBuildProgress: (done, total) => {
      const progress = get().busyProgress;
      if (progress) set({ busyProgress: { ...progress, phase: importPartsPhase(done, total), done, total } });
    },
    exportFiles: (args) => ctx.runEngineDetached('export', args),
    reportWarnings: (warnings) => reportEngineWarnings(warnings),
    openSimplify: (id) => get().requestSimplifyPanel(id),
    repairMesh: (id) => get().repairObjectMesh(id),
    repairMeshes: (groups) => get().repairObjectMeshes(groups),
    separateBodies: (id) => void get().splitDisconnectedObject(id),
    bedSize: () => {
      setImportStage('place');
      return activeBedSize(get());
    },
    // Antes de un modelo grande: si hay cambios sin guardar, el borrador de recuperación queda escrito.
    ensureRecoveryDraft: async () => {
      if (isProjectDirty(get())) await flushRecoveryDraft();
    },
  });

  const freePlacer = () => createFreePlacer(get);

  /** Agrega un objeto creado, lo selecciona, avisa con su nombre y lo deja a la vista. */
  const addCreated = (obj: SceneObject, toastKey: 'toast.imported' | `toast.imageDone.${ImageShapeMode}`, free: FreePlacer) => {
    pushHistory();
    set((state) => ({ objects: [...state.objects, obj], selectedIds: [obj.id] }));
    get().addToast(tr(toastKey, { name: obj.name }), 'success');
    announceFreePlacement(get(), tr, free.result, obj.id);
    return obj;
  };

  return {
    importModelAsModule: async (file, mode, targetId) => {
      if (rejectWhileBusy()) return null;
      return runExclusive(`import_module_${mode}`, null, async () => {
        await get().initEngine();
        const { parts: parsedParts, warnings } = await parseModelBufferToMeshes(file);
        if (parsedParts.length === 0) return null;

        const state = get();
        const targetObj = resolveModuleTarget(state.objects, state.selectedIds, targetId);
        const isHole = mode === 'negative';
        const prefix = isHole ? '−' : '+';
        const created = parsedParts.map((part) => {
          const position: Vec3 | undefined = targetObj ? positionOnTarget(targetObj, part.mesh) : undefined;
          return buildSceneObject({
            name: `${prefix} ${part.name}`,
            source: 'imported',
            mesh: part.mesh,
            position,
            color: isHole ? HOLE_HELPER_COLOR : part.color || PRINT_COLOR_PALETTE[0],
            role: isHole ? 'negative' : 'solid',
          });
        });

        pushHistory();
        const now = Date.now();
        set((prev) => ({
          objects: [...prev.objects, ...created],
          selectedIds: isHole || !targetObj ? created.map((c) => c.id) : [targetObj.id, ...created.map((c) => c.id)],
          spawnedAtById: { ...prev.spawnedAtById, ...Object.fromEntries(created.map((c) => [c.id, now])) },
        }));
        get().addToast(tr('toast.modularHelperCreated', { mode: prefix, name: created[0].name }), 'success');
        reportEngineWarnings(warnings);
        return created[0];
      });
    },

    importModelAsModuleFromDialog: async (mode, targetId) => {
      const file = await openLocalFile('.stl,.3mf,.obj,.ply');
      if (!file) return null;
      return get().importModelAsModule(file, mode, targetId);
    },

    importSvgModel: async (options) =>
      runExclusive('import_svg', null, async () => {
        await get().initEngine();
        // Los contornos se leen aquí (SVGLoader necesita DOMParser); la extrusión corre en el Worker.
        const mesh = await ctx.runEngine('svgMesh', { options, contours: readSvgContours(options) });
        const free = freePlacer();
        const obj = await importSvg(opCtx(), options, { name: options.name || 'SVG Extruido', color: PRINT_COLOR_PALETTE[0], place: free.place }, mesh);
        return addCreated(obj, 'toast.imported', free);
      }),

    generateImageRelief: async (options) =>
      runExclusive('image_to_3d', null, async () => {
        await get().initEngine();
        // La malla se genera en el Worker (se transfiere una copia del RGBA: el diálogo la conserva
        // para reintentar) y se ubica después en un hueco libre de la escena vigente.
        const mesh = await ctx.runEngine('imageReliefMesh', { options });
        const free = freePlacer();
        const obj = await imageRelief(opCtx(), options, { name: options.name || 'Relieve 3D', color: PRINT_COLOR_PALETTE[6], place: free.place }, mesh);
        return addCreated(obj, `toast.imageDone.${options.shapeMode ?? 'flat'}`, free);
      }),

    importPlacementMode: loadInitialImportPlacement(),
    setImportPlacementMode: (mode) => {
      writeStorage(STORAGE_IMPORT_PLACEMENT_KEY, mode);
      set({ importPlacementMode: mode });
    },

    importMeshFromDialog: async (placement, options) => {
      let files: ModelImportSource[];
      try {
        files = await openLocalFiles(engine.MODEL_IMPORT_ACCEPT, MAX_MODEL_FILE_BYTES);
      } catch (err) {
        get().addToast(tr('toast.errorPrefix', { message: projectErrorMessage(err) }), 'error');
        return;
      }
      if (files.length > 0) await get().importModelFiles(files, { placement, asReference: options?.asReference });
    },

    rescaleObjects: (ids, factor) => (rejectWhileBusy() ? false : modelIo.rescaleObjects(ids, factor)),

    importModelFiles: async (files, options) => {
      if (files.length === 0) return false;
      if (rejectWhileBusy()) return false;
      return runExclusive(
        'import_mesh',
        false,
        async () => {
          await get().initEngine();
          // La lectura corre en su propio Worker: la barra de progreso la puede cancelar (botón o Esc).
          const controller = new AbortController();
          const job: EngineJob<unknown> = { id: -1, inWorker: true, promise: Promise.resolve(), cancel: () => controller.abort() };
          ctx.runtime.activeJob = job;
          const progress = get().busyProgress;
          if (progress) set({ busyProgress: { ...progress, cancellable: true } });
          try {
            // Etapas visibles en la barra: leer el archivo, interpretarlo (Worker) y colocarlo en la escena.
            setImportStage('read');
            const staged = files.map((file) => ({
              ...file,
              read: async () => {
                setImportStage('read');
                const data = await file.read();
                setImportStage('parse');
                return data;
              },
            }));
            return await modelIo.importModelFiles(staged, { ...options, signal: controller.signal });
          } finally {
            if (ctx.runtime.activeJob === job) ctx.runtime.activeJob = null;
            const current = get().busyProgress;
            if (current) set({ busyProgress: { ...current, cancellable: false } });
          }
        },
        { onError: (err) => get().addToast(tr('toast.errorPrefix', { message: projectErrorMessage(err) }), 'error') },
      );
    },

    exportModel: (request) => modelIo.exportModel(request),
    exportSceneStl: async (onlySelected = false) =>
      modelIo.exportModel({ format: 'stl', scope: onlySelected ? 'selection' : 'scene' }),
    exportScene3mf: async (onlySelected = false) =>
      modelIo.exportModel({ format: '3mf', scope: onlySelected ? 'selection' : 'scene' }),
    exportSelectedObj: async () =>
      modelIo.exportModel({ format: 'obj', scope: get().selectedIds.length > 0 ? 'selection' : 'scene' }),
  };
}
