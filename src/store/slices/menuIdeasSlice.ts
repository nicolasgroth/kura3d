/**
 * @file src/store/slices/menuIdeasSlice.ts
 * @description Acciones de las ideas de menú: centrar en la cama (X e Y, sin tocar la altura; repetible con F4),
 * restablecer rotación y escala, reemplazar la geometría de un objeto por la de un archivo STL/3MF/OBJ/PLY
 * (conserva nombre, posición, rotación, escala, color y tipo; un paso de deshacer; avisa si el tamaño cambia más
 * de 5 %) y petición del panel Simplificar. La lógica pura vive en `core/scene`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../engine';
import { centerOnBedPositions } from '../../core/scene/centerOnBed';
import { replacedGeometryPatch } from '../../core/scene/replaceGeometry';
import type { SceneObject, Vec3 } from '../../types/kura';
import { openLocalFile } from '../../utils/platformBridge';
import { importErrorMessage } from '../modelIoActions';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

/** Variación de tamaño (en %) a partir de la cual el reemplazo avisa. */
export const REPLACE_SIZE_WARN_PCT = 5;

export function createMenuIdeasSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, runExclusive, rejectWhileLocked, projectErrorMessage, reportEngineWarnings } = ctx;
  let requestCounter = 0;

  /** Objetos de `ids` (o de la selección) que existen y no están bloqueados. */
  const editable = (ids?: string[]): SceneObject[] => {
    const { objects, selectedIds } = get();
    const wanted = new Set(ids && ids.length > 0 ? ids : selectedIds);
    return objects.filter((o) => wanted.has(o.id) && !o.locked);
  };

  const patchAll = (patches: Map<string, Partial<SceneObject>>) =>
    set((s) => ({ objects: s.objects.map((o) => (patches.has(o.id) ? { ...o, ...patches.get(o.id) } : o)) }));

  return {
    simplifyRequest: null,

    centerSelectionOnBed: (ids) => {
      const targets = editable(ids);
      if (targets.length === 0 || rejectWhileLocked()) return false;
      const positions = centerOnBedPositions(targets);
      const moved = targets.filter((o) => {
        const p = positions[o.id];
        return p && (Math.abs(p[0] - o.position[0]) > 1e-9 || Math.abs(p[2] - o.position[2]) > 1e-9);
      });
      if (moved.length > 0) {
        pushHistory();
        patchAll(new Map(targets.map((o) => [o.id, { position: positions[o.id] as Vec3 }])));
      }
      get().addToast(tr('toast.centeredOnBed'), 'success');
      get().requestCameraPreset('ensure', targets.map((o) => o.id));
      set({ lastRepeatable: { kind: 'centerOnBed' } });
      return true;
    },

    resetObjectsRotation: (ids) => {
      const targets = editable(ids).filter((o) => o.rotation.some((v) => v !== 0));
      if (targets.length === 0 || rejectWhileLocked()) return false;
      pushHistory();
      patchAll(new Map(targets.map((o) => [o.id, { rotation: [0, 0, 0] as Vec3 }])));
      get().addToast(tr('toast.rotationReset'), 'success');
      return true;
    },

    resetObjectsScale: (ids) => {
      const targets = editable(ids).filter((o) => o.scale.some((v) => v !== 1));
      if (targets.length === 0 || rejectWhileLocked()) return false;
      pushHistory();
      patchAll(new Map(targets.map((o) => [o.id, { scale: [1, 1, 1] as Vec3 }])));
      get().addToast(tr('toast.scaleReset'), 'success');
      return true;
    },

    replaceObjectMesh: async (id, file) => {
      const first = get().objects.find((o) => o.id === id);
      if (!first || first.locked) return false;
      return runExclusive(
        'replace_mesh',
        false,
        async () => {
          await get().initEngine();
          let model: engine.ImportedModel;
          try {
            if (!engine.detectModelFormat(file.name)) throw new engine.ModelImportError('unsupported', undefined, file.name);
            model = await engine.parseModelFileAsync(file.name, file.buffer);
          } catch (error) {
            get().addToast(importErrorMessage(error, file.name, tr, get().language), 'error');
            return false;
          }
          const part = model.parts[0];
          if (!part || part.mesh.indices.length === 0) {
            get().addToast(tr('importError.no-geometry', { name: file.name }), 'error');
            return false;
          }
          // El objeto pudo cambiar o bloquearse mientras se leía el archivo.
          const target = get().objects.find((o) => o.id === id);
          if (!target || target.locked) return false;
          const { patch, sizeChangePct } = replacedGeometryPatch(target, engine.normalizeMeshToBed(part.mesh));
          pushHistory();
          set((s) => ({ objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
          get().addToast(tr('toast.replaced', { name: target.name }), 'success');
          if (sizeChangePct > REPLACE_SIZE_WARN_PCT) {
            get().addToast(tr('toast.replaced.sizeChanged', { percent: Math.round(sizeChangePct) }), 'info');
          }
          if (model.parts.length > 1) get().addToast(tr('toast.replaced.manyParts', { count: model.parts.length }), 'info');
          reportEngineWarnings(model.warnings ?? []);
          get().requestCameraPreset('ensure', [id]);
          return true;
        },
        { onError: (err) => get().addToast(tr('toast.errorPrefix', { message: projectErrorMessage(err) }), 'error') },
      );
    },

    replaceObjectMeshFromDialog: async (id) => {
      let picked: Awaited<ReturnType<typeof openLocalFile>>;
      try {
        picked = await openLocalFile('.stl,.3mf,.obj,.ply');
      } catch (err) {
        get().addToast(tr('toast.errorPrefix', { message: projectErrorMessage(err) }), 'error');
        return false;
      }
      if (!picked) return false;
      return get().replaceObjectMesh(id, picked);
    },

    requestSimplifyPanel: (id) => {
      requestCounter += 1;
      set({ simplifyRequest: { id, n: requestCounter, at: Date.now() } });
    },
  };
}
