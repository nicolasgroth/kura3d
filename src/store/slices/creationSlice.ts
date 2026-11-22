/**
 * @file src/store/slices/creationSlice.ts
 * @description Slice de creación: primitivas, módulos (+/−) sobre un objetivo, cubo inicial y
 * roscas ISO. Adaptador delgado sobre `src/core/operations/creationOperations`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { createModulePrimitive, createPrimitive, createThread } from '../../core/operations';
import { resolveModuleTarget } from '../../core/scene/sceneRules';
import { PRINT_COLOR_PALETTE, type SceneObject } from '../../types/kura';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export function createCreationSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, runExclusive, opCtx } = ctx;

  /** Agrega un objeto recién creado con animación de aparición. */
  const addSpawned = (obj: SceneObject, selectedIds: string[]) => {
    pushHistory();
    const now = Date.now();
    set((state) => ({
      objects: [...state.objects, obj],
      selectedIds,
      spawnedAtById: { ...state.spawnedAtById, [obj.id]: now },
    }));
  };

  return {
    createPrimitive: async (type, params, options) =>
      runExclusive(type, null, async () => {
        await get().initEngine();
        const op = opCtx();
        const count = get().objects.length;
        const obj = await createPrimitive(op, {
          type,
          params,
          name: options?.name ?? op.naming.primitive(type, count),
          color: options?.color ?? PRINT_COLOR_PALETTE[count % PRINT_COLOR_PALETTE.length],
          position: options?.position,
          materialPreset: options?.materialPreset,
          isHole: options?.isHole,
        });
        addSpawned(obj, [obj.id]);
        get().addToast(tr('toast.created', { name: obj.name }), 'success');
        return obj;
      }),

    addSubtractHelperPrimitive: async (type, targetId) => get().addModularPrimitive(type, 'negative', targetId),

    addModularPrimitive: async (type, mode, targetId) => {
      const state = get();
      const targetObj = resolveModuleTarget(state.objects, state.selectedIds, targetId) ?? state.objects[0];
      const isHole = mode === 'negative';
      if (!targetObj) return get().createPrimitive(type, undefined, { isHole });

      return runExclusive(`modular_${mode}_${type}`, null, async () => {
        await get().initEngine();
        const op = opCtx();
        const modObj = await createModulePrimitive(op, type, mode, targetObj);
        addSpawned(modObj, isHole ? [modObj.id] : [targetObj.id, modObj.id]);
        get().addToast(
          isHole
            ? tr('toast.subtractHelperCreated')
            : tr('toast.modularHelperCreated', { mode: '+', name: op.naming.primitiveLabel(type) }),
          'info',
        );
        return modObj;
      });
    },

    createStarterCube: async () => {
      if (get().busyOperation || get().projectBusy) return;
      const wasEmpty = get().objects.length === 0;
      const cube = await get().createPrimitive('box', { width: 30, height: 30, depth: 30 }, {
        name: `${tr('sidebar.primitive.box')} Kura3D 30 mm`,
        color: PRINT_COLOR_PALETTE[0],
        materialPreset: 'pla_matte',
      });
      if (cube && wasEmpty) get().requestCameraPreset('fit');
    },

    createThreadObject: async (options) =>
      runExclusive('create_thread', null, async () => {
        await get().initEngine();
        const existingCount = get().objects.length;
        const spawnX = existingCount > 0 ? Math.min(90, existingCount * 28) : 0;
        const obj = await createThread(opCtx(), options, { position: [spawnX, 0, 0] });
        addSpawned(obj, [obj.id]);
        get().addToast(tr('toast.created', { name: obj.name }), 'success');
        return obj;
      }),
  };
}
