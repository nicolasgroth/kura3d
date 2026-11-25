/**
 * @file src/store/slices/creationSlice.ts
 * @description Slice de creación: primitivas, módulos (+/−) sobre un objetivo, cubo inicial y
 * roscas ISO. Adaptador delgado sobre `src/core/operations/creationOperations`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { createModulePrimitive, createPrimitive } from '../../core/operations';
import { announceFreePlacement, createFreePlacer, type FreePlacer } from '../freePlacement';
import { placementBedSize } from '../bedSize';
import { activePlateBed } from '../../core/scene/activePlateBed';
import { overlapsOthers, placeInFreeSpot } from '../../core/scene/freeSpot';
import { parametricStateOf } from '../../core/scene/parametric';
import { resolveModuleTarget } from '../../core/scene/sceneRules';
import { PRINT_COLOR_PALETTE, type SceneObject, type Vec3 } from '../../types/kura';
import { isNegative, isReference, isSolid } from '../../core/scene/objectRole';
import { BRAND } from '../../brand';
import { attachToTarget, negativeOnTopFace } from '../../core/scene/attachPiece';
import { nextNumberedName, withoutModulePrefix } from '../../core/scene/resultNames';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';
import { negativeSpotFor, rememberSpawnTarget } from '../negativeSpawn';

export function createCreationSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, runExclusive, opCtx, assertCurrent, commitChange, rejectWhileLocked } = ctx;

  const activeBed = () => placementBedSize(get());

  const freePlacer = (rotation?: Vec3, scale?: Vec3) => createFreePlacer(get, rotation, scale);
  const afterFreePlacement = (free: FreePlacer, newId: string) => announceFreePlacement(get(), tr, free.result, newId);

  /**
   * Objeto a perforar por un macho negativo: el pedido por id o el único seleccionado (sin bloquear).
   * Por selección no se perfora otra pieza roscada (recién creada queda seleccionada: perno, tuerca).
   */
  const negativeTarget = (targetId?: string): SceneObject | null => {
    const { objects, selectedIds } = get();
    const ok = (o: SceneObject | undefined) => (o && !o.locked && isSolid(o) ? o : null);
    if (targetId) return ok(objects.find((o) => o.id === targetId));
    const selected = selectedIds.length === 1 ? ok(objects.find((o) => o.id === selectedIds[0])) : null;
    return selected && selected.parametric?.kind !== 'thread' ? selected : null;
  };

  /** Traslada al origen de la placa activa lo creado en el origen del mundo (sin placas, no cambia nada). */
  const onActivePlate = (obj: SceneObject): SceneObject => {
    const [ox, oz] = activePlateBed(get()).origin;
    if (ox === 0 && oz === 0) return obj;
    return { ...obj, position: [obj.position[0] + ox, obj.position[1], obj.position[2] + oz] };
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
        // Sólido seleccionado al crear: un negativo va sobre él (excepción a «lo nuevo no cae encima»).
        const solid = options?.position ? null : negativeTarget();
        // El texto 3D (maquetado y extrusión de glifos) se genera en el Worker; las demás primitivas son
        // instantáneas y se generan aquí.
        const mesh = type === 'text' ? await ctx.runEngine('primitiveMesh', { type, params }) : undefined;
        const free = options?.placement === 'free' && !options.position ? freePlacer(options.rotation, options.scale) : null;
        const obj = await createPrimitive(op, {
          mesh,
          type,
          params,
          name: options?.name ?? nextNumberedName(options?.label ?? op.naming.primitiveLabel(type), get().objects.map((o) => o.name)),
          color: options?.color ?? PRINT_COLOR_PALETTE[count % PRINT_COLOR_PALETTE.length],
          position: options?.position,
          rotation: options?.rotation,
          scale: options?.scale,
          place: free?.place,
          materialPreset: options?.materialPreset,
          role: options?.role,
        });
        if (solid) rememberSpawnTarget(obj, solid.id);
        const over = solid && isNegative(obj) ? negativeSpotFor(obj, get().objects) : null;
        // Sin posición ni colocador (comandos, MCP): el «origen» es el de la placa activa, no el del mundo.
        const placed = over ? { ...obj, position: over } : options?.position || free ? obj : onActivePlate(obj);
        addSpawned(placed, [placed.id]);
        get().addToast(tr('toast.created', { name: placed.name }), 'success');
        if (over) get().requestCameraPreset('ensure', [placed.id]);
        else if (free) afterFreePlacement(free, placed.id);
        return placed;
      }),

    addSubtractHelperPrimitive: async (type, targetId) => get().addModularPrimitive(type, 'negative', targetId),

    addModularPrimitive: async (type, mode, targetId) => {
      const state = get();
      const targetObj = resolveModuleTarget(state.objects, state.selectedIds, targetId) ?? state.objects.find((o) => !isReference(o));
      const isHole = mode === 'negative';
      if (!targetObj) return get().createPrimitive(type, undefined, { role: isHole ? 'negative' : 'solid' });

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

    createThreadObject: async (options, extra = {}) =>
      runExclusive('create_thread', null, async () => {
        await get().initEngine();
        const target = options.kind === 'hole' ? negativeTarget(extra.targetId) : null;
        if (target) {
          const created = await ctx.runEngine('thread', { options, placement: { position: [0, 0, 0] } });
          const obj = { ...created, position: negativeOnTopFace(target, created.mesh) };
          pushHistory();
          let grouped = false;
          set((s) => {
            const next = attachToTarget(s, obj, target.id);
            grouped = next.grouped;
            return { objects: next.objects, groups: next.groups, selectedIds: [obj.id], spawnedAtById: { ...s.spawnedAtById, [obj.id]: Date.now() } };
          });
          get().addToast(grouped
            ? tr('toast.pieceNegativeGrouped', { name: obj.name, target: withoutModulePrefix(target.name) })
            : tr('toast.created', { name: obj.name }), 'success');
          return obj;
        }
        const free = freePlacer();
        // La rosca se genera en el Worker en el origen y se ubica después en un espacio libre.
        const created = await ctx.runEngine('thread', { options, placement: { position: [0, 0, 0] } });
        const obj = { ...created, position: free.place(created.mesh) };
        addSpawned(obj, [obj.id]);
        get().addToast(tr('toast.created', { name: obj.name }), 'success');
        afterFreePlacement(free, obj.id);
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
