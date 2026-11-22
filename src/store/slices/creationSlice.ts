/**
 * @file src/store/slices/creationSlice.ts
 * @description Slice de creación: primitivas, módulos (+/−) sobre un objetivo, cubo inicial y
 * roscas ISO. Adaptador delgado sobre `src/core/operations/creationOperations`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { createModulePrimitive, createPrimitive, createThread, regenerateParametric, type PlaceMesh } from '../../core/operations';
import { placeInFreeSpot, type BedSize } from '../../core/scene/freeSpot';
import { parametricStateOf } from '../../core/scene/parametric';
import { resolveModuleTarget } from '../../core/scene/sceneRules';
import { PRINT_COLOR_PALETTE, type SceneObject } from '../../types/kura';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export function createCreationSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, runExclusive, opCtx, assertCurrent, commitChange, rejectWhileLocked } = ctx;

  /** Cama activa (perfil o medidas personalizadas), centrada en el origen. */
  const activeBed = (): BedSize | null => {
    const { customBedDimensions: custom, printerProfile: profile } = get();
    if (custom) return { width: custom.width, depth: custom.depth };
    return profile ? { width: profile.bedWidthMm, depth: profile.bedDepthMm } : null;
  };

  /** Colocador en el primer hueco libre; recuerda si la pieza cupo en la cama. */
  const freePlacer = () => {
    const result = { fits: true };
    const place: PlaceMesh = (mesh) => {
      const spot = placeInFreeSpot(get().objects, mesh, [0, 0, 0], [1, 1, 1], activeBed());
      result.fits = spot.fits;
      return spot.position;
    };
    return { place, result };
  };

  /** Tras colocar en espacio libre: avisa si no cupo y encuadra si quedó fuera de la cama. */
  const afterFreePlacement = (fits: boolean, wasEmpty: boolean) => {
    if (!fits) get().addToast(tr('toast.placedOutsideBed'), 'info');
    if (!fits || wasEmpty) get().requestCameraPreset('fit');
  };

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
        const free = options?.placement === 'free' && !options.position ? freePlacer() : null;
        const obj = await createPrimitive(op, {
          type,
          params,
          name: options?.name ?? op.naming.primitive(type, count),
          color: options?.color ?? PRINT_COLOR_PALETTE[count % PRINT_COLOR_PALETTE.length],
          position: options?.position,
          place: free?.place,
          materialPreset: options?.materialPreset,
          isHole: options?.isHole,
        });
        addSpawned(obj, [obj.id]);
        get().addToast(tr('toast.created', { name: obj.name }), 'success');
        if (free) afterFreePlacement(free.result.fits, count === 0);
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
        placement: 'free',
      });
      if (cube && wasEmpty) get().requestCameraPreset('fit');
    },

    createThreadObject: async (options) =>
      runExclusive('create_thread', null, async () => {
        await get().initEngine();
        const wasEmpty = get().objects.length === 0;
        const free = freePlacer();
        // La rosca se genera en el Worker en el origen y se ubica después en un espacio libre.
        const created = await ctx.runEngine('thread', { options, placement: { position: [0, 0, 0] } });
        const obj = { ...created, position: free.place(created.mesh) };
        addSpawned(obj, [obj.id]);
        get().addToast(tr('toast.created', { name: obj.name }), 'success');
        afterFreePlacement(free.result.fits, wasEmpty);
        return obj;
      }),

    updatePrimitiveParams: async (id, edit) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || rejectWhileLocked()) return null;
      if (obj.locked) {
        get().addToast(tr('store.error.locked'), 'error');
        return null;
      }
      const state = parametricStateOf(obj);
      if (state.status !== edit.kind) {
        get().addToast(tr('inspector.params.notParametric'), 'error');
        return null;
      }
      return runExclusive('update_primitive_params', null, async () => {
        await get().initEngine();
        const change = await regenerateParametric(opCtx(), obj, edit);
        assertCurrent([obj]);
        // Un solo paso de deshacer por edición confirmada (commitChange guarda el historial).
        commitChange(change, { select: [obj.id] });
        return get().objects.find((o) => o.id === id) ?? null;
      });
    },
  };
}
