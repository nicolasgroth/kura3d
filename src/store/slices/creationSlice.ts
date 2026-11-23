/**
 * @file src/store/slices/creationSlice.ts
 * @description Slice de creación: primitivas, módulos (+/−) sobre un objetivo, cubo inicial y
 * roscas ISO. Adaptador delgado sobre `src/core/operations/creationOperations`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { createModulePrimitive, createPrimitive, type PlaceMesh } from '../../core/operations';
import { activeBedSize } from '../bedSize';
import { overlapsOthers, placeInFreeSpot } from '../../core/scene/freeSpot';
import { parametricStateOf } from '../../core/scene/parametric';
import { resolveModuleTarget } from '../../core/scene/sceneRules';
import { PRINT_COLOR_PALETTE, type SceneObject, type Vec3 } from '../../types/kura';
import { BRAND } from '../../brand';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export function createCreationSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, runExclusive, opCtx, assertCurrent, commitChange, rejectWhileLocked } = ctx;

  const activeBed = () => activeBedSize(get());

  /** Colocador en el primer hueco libre; recuerda si la pieza cupo en la cama. */
  const freePlacer = (rotation: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) => {
    const result = { fits: true };
    const place: PlaceMesh = (mesh) => {
      const spot = placeInFreeSpot(get().objects, mesh, rotation, scale, activeBed());
      result.fits = spot.fits;
      return spot.position;
    };
    return { place, result };
  };

  /**
   * Tras colocar en espacio libre: avisa si no cupo en la cama y encuadra. Escena vacía o fuera de la
   * cama: encuadre de toda la escena; si ya había objetos, se asegura que la pieza nueva quede a la vista.
   */
  const afterFreePlacement = (fits: boolean, wasEmpty: boolean, newId: string) => {
    if (!fits) get().addToast(tr('toast.placedOutsideBed'), 'info');
    if (!fits || wasEmpty) get().requestCameraPreset('fit');
    else get().requestCameraPreset('ensure', [newId]);
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
        // El texto 3D (maquetado y extrusión de glifos) se genera en el Worker; las demás primitivas son
        // instantáneas y se generan aquí.
        const mesh = type === 'text' ? await ctx.runEngine('primitiveMesh', { type, params }) : undefined;
        const free = options?.placement === 'free' && !options.position ? freePlacer(options.rotation, options.scale) : null;
        const obj = await createPrimitive(op, {
          mesh,
          type,
          params,
          name: options?.name ?? (options?.label ? `${options.label} ${count + 1}` : op.naming.primitive(type, count)),
          color: options?.color ?? PRINT_COLOR_PALETTE[count % PRINT_COLOR_PALETTE.length],
          position: options?.position,
          rotation: options?.rotation,
          scale: options?.scale,
          place: free?.place,
          materialPreset: options?.materialPreset,
          isHole: options?.isHole,
        });
        addSpawned(obj, [obj.id]);
        get().addToast(tr('toast.created', { name: obj.name }), 'success');
        if (free) afterFreePlacement(free.result.fits, count === 0, obj.id);
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
      await get().createPrimitive('box', { width: 30, height: 30, depth: 30 }, {
        name: `${tr('sidebar.primitive.box')} ${BRAND.name} 30 mm`,
        color: PRINT_COLOR_PALETTE[0],
        materialPreset: 'pla_matte',
        placement: 'free',
      });
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
        afterFreePlacement(free.result.fits, wasEmpty, obj.id);
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
        // Texto 3D y roscas pueden tardar: la regeneración corre en el Worker.
        const change = await ctx.runEngine('regenerateParametric', { obj, edit });
        assertCurrent([obj]);
        // Texto 3D: el nombre sigue al texto mientras conserve el texto anterior (no editado a mano).
        const oldText = state.status === 'primitive' ? (state.params as { text?: unknown }).text : undefined;
        const newText = edit.kind === 'primitive' ? (edit.params as { text?: unknown }).text : undefined;
        if (typeof oldText === 'string' && typeof newText === 'string' && oldText.trim() && newText.trim()
          && oldText !== newText && obj.name.includes(oldText) && change.patches?.[0]) {
          change.patches[0].patch.name = obj.name.split(oldText).join(newText.trim());
        }
        // Un solo paso de deshacer por edición confirmada (commitChange guarda el historial).
        const others = get().objects.filter((o) => o.id !== id);
        const overlappedBefore = overlapsOthers(others, [obj]);
        commitChange(change, { select: [obj.id] });
        // Si al crecer pisa a otro objeto (y antes no), va a un hueco libre en el mismo paso de deshacer.
        const grown = get().objects.find((o) => o.id === id);
        if (grown && !overlappedBefore && overlapsOthers(others, [grown])) {
          const spot = placeInFreeSpot(others, grown.mesh, grown.rotation, grown.scale, activeBed());
          set((st) => ({ objects: st.objects.map((o) => (o.id === id ? { ...o, position: spot.position } : o)) }));
          get().addToast(tr(spot.fits ? 'uxEscena.grewMoved' : 'toast.placedOutsideBed'), 'info');
          get().requestCameraPreset('ensure', [id]);
        }
        return get().objects.find((o) => o.id === id) ?? null;
      });
    },
  };
}
