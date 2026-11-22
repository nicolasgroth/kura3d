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
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { resolveModuleTarget } from '../../core/scene/sceneRules';
import { PRINT_COLOR_PALETTE, type MeshData, type SceneObject, type Vec3 } from '../../types/kura';
import { openLocalFile, openLocalFiles } from '../../utils/platformBridge';
import { createModelIoActions, type ModelImportSource } from '../modelIoActions';
import { loadInitialImportPlacement, STORAGE_IMPORT_PLACEMENT_KEY, writeStorage } from '../preferencesStorage';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

/** Parsea un archivo STL, 3MF u OBJ en mallas normalizadas listas para insertar en la escena. */
function parseModelBufferToMeshes(
  file: { name: string; buffer: ArrayBuffer },
  invalidGeometryMessage: string,
): Array<{ name: string; mesh: MeshData; color?: string }> {
  const normalize = (mesh: MeshData) => {
    const normalized = engine.normalizeMeshToBed(mesh);
    const vertexCount = normalized.positions.length / 3;
    if (!Number.isInteger(vertexCount) || vertexCount < 3 ||
        normalized.indices.length < 3 || normalized.indices.length % 3 !== 0 ||
        normalized.indices.some((index) => index >= vertexCount) ||
        !normalized.positions.every(Number.isFinite) ||
        (normalized.normals && (normalized.normals.length !== normalized.positions.length ||
          !normalized.normals.every(Number.isFinite)))) {
      throw new Error(invalidGeometryMessage);
    }
    return normalized;
  };
  // Lectores validados (índices, NaN, límites); cada pieza se centra para anclarla al objetivo.
  return engine.parseModelFile(file.name, file.buffer).parts.map((part) => ({
    name: part.name || file.name.replace(/\.[^.]+$/, ''),
    mesh: normalize(part.mesh),
    color: part.color,
  }));
}

export function createIoSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, runExclusive, runtime, projectErrorMessage, opCtx } = ctx;

  const modelIo = createModelIoActions({
    get: () => get(),
    set: (updater) => set((state) => updater(state) as Partial<KuraStoreState>),
    tr,
    pushHistory: () => pushHistory(),
    buildObject: ({ name, mesh, position, color, isHole }) =>
      buildSceneObject({ name, source: 'imported', mesh, position, color: color || PRINT_COLOR_PALETTE[0], isHole }),
    exportFiles: (args) => ctx.runEngineDetached('export', args),
  });

  /** Agrega un objeto creado, lo selecciona y avisa. */
  const addCreated = (obj: SceneObject, toastKey: 'toast.imported' | 'toast.created') => {
    pushHistory();
    set((state) => ({ objects: [...state.objects, obj], selectedIds: [obj.id] }));
    get().addToast(tr(toastKey, { name: obj.name }), 'success');
    return obj;
  };

  return {
    importModelAsModule: async (file, mode, targetId) => {
      return runExclusive(`import_module_${mode}`, null, async () => {
        await get().initEngine();
        const parsedParts = parseModelBufferToMeshes(file, tr('dropProject.invalidGeometry', { name: file.name }));
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
        const obj = await importSvg(opCtx(), options, { name: options.name || 'SVG Extruido', color: PRINT_COLOR_PALETTE[0] });
        return addCreated(obj, 'toast.imported');
      }),

    generateImageRelief: async (options) =>
      runExclusive('image_to_3d', null, async () => {
        await get().initEngine();
        const obj = await imageRelief(opCtx(), options, { name: options.name || 'Relieve 3D', color: PRINT_COLOR_PALETTE[6] });
        return addCreated(obj, 'toast.created');
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
      const state = get();
      if (state.projectBusy || state.busyOperation || state.aiBusy || runtime.transformSnapshotBeforeDrag) {
        state.addToast(tr('fileProject.busy'), 'info');
        return false;
      }
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
    exportScene3mf: async (onlySelected = false, slicerTarget) =>
      modelIo.exportModel({ format: '3mf', scope: onlySelected ? 'selection' : 'scene', slicerTarget }),
    export3MFForSlicer: async (slicerTarget, onlySelected = false) => get().exportScene3mf(onlySelected, slicerTarget),
    exportSelectedObj: async () =>
      modelIo.exportModel({ format: 'obj', scope: get().selectedIds.length > 0 ? 'selection' : 'scene' }),
  };
}
