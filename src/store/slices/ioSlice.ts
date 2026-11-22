/**
 * @file src/store/slices/ioSlice.ts
 * @description Slice de importación y exportación: SVG extruido, relieve de imagen, mallas
 * STL/3MF/OBJ/PLY (escena o como módulo +/− sobre un objetivo), colocación de importaciones y
 * exportación única (STL, 3MF, OBJ+MTL, GLB, PLY).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../engine';
import { HOLE_HELPER_COLOR, importSvg, imageRelief, positionOnTarget } from '../../core/operations';
import { placeInFreeSpot } from '../../core/scene/freeSpot';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { resolveModuleTarget } from '../../core/scene/sceneRules';
import { PRINT_COLOR_PALETTE, type MeshData, type SceneObject, type Vec3 } from '../../types/kura';
import { openLocalFile, openLocalFiles } from '../../utils/platformBridge';
import { activeBedSize } from '../bedSize';
import { createModelIoActions, type ModelImportSource } from '../modelIoActions';
import { loadInitialImportPlacement, STORAGE_IMPORT_PLACEMENT_KEY, writeStorage } from '../preferencesStorage';
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

  const modelIo = createModelIoActions({
    get: () => get(),
    set: (updater) => set((state) => updater(state) as Partial<KuraStoreState>),
    tr,
    pushHistory: () => pushHistory(),
    buildObject: ({ name, mesh, position, color, isHole }) =>
      buildSceneObject({ name, source: 'imported', mesh, position, color: color || PRINT_COLOR_PALETTE[0], isHole }),
    exportFiles: (args) => ctx.runEngineDetached('export', args),
    reportWarnings: (warnings) => reportEngineWarnings(warnings),
    bedSize: () => activeBedSize(get()),
  });

  /** Colocador en el primer hueco libre; recuerda si cupo en la cama y si la escena estaba vacía. */
  const freePlacer = () => {
    const result = { fits: true, wasEmpty: get().objects.length === 0 };
    const place = (mesh: MeshData): Vec3 => {
      const spot = placeInFreeSpot(get().objects, mesh, [0, 0, 0], [1, 1, 1], activeBedSize(get()));
      result.fits = spot.fits;
      return spot.position;
    };
    return { place, result };
  };

  /** Agrega un objeto creado, lo selecciona y avisa. */
  const addCreated = (obj: SceneObject, toastKey: 'toast.imported' | 'toast.created', fits = true, wasEmpty = false) => {
    pushHistory();
    set((state) => ({ objects: [...state.objects, obj], selectedIds: [obj.id] }));
    get().addToast(tr(toastKey, { name: obj.name }), 'success');
    if (!fits) get().addToast(tr('toast.placedOutsideBed'), 'info');
    if (!fits || wasEmpty) get().requestCameraPreset('fit');
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
            isHole,
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
        const free = freePlacer();
        const obj = await importSvg(opCtx(), options, { name: options.name || 'SVG Extruido', color: PRINT_COLOR_PALETTE[0], place: free.place });
        return addCreated(obj, 'toast.imported', free.result.fits, free.result.wasEmpty);
      }),

    generateImageRelief: async (options) =>
      runExclusive('image_to_3d', null, async () => {
        await get().initEngine();
        const free = freePlacer();
        const obj = await imageRelief(opCtx(), options, { name: options.name || 'Relieve 3D', color: PRINT_COLOR_PALETTE[6], place: free.place });
        return addCreated(obj, 'toast.created', free.result.fits, free.result.wasEmpty);
      }),

    importPlacementMode: loadInitialImportPlacement(),
    setImportPlacementMode: (mode) => {
      writeStorage(STORAGE_IMPORT_PLACEMENT_KEY, mode);
      set({ importPlacementMode: mode });
    },

    importMeshFromDialog: async (placement) => {
      let files: ModelImportSource[];
      try {
        files = await openLocalFiles(engine.MODEL_IMPORT_ACCEPT);
      } catch (err) {
        get().addToast(tr('toast.errorPrefix', { message: projectErrorMessage(err) }), 'error');
        return;
      }
      if (files.length > 0) await get().importModelFiles(files, { placement });
    },

    importModelFiles: async (files, options) => {
      if (files.length === 0) return false;
      if (rejectWhileBusy()) return false;
      return runExclusive(
        'import_mesh',
        false,
        async () => {
          await get().initEngine();
          return modelIo.importModelFiles(files, options);
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
