/**
 * @file src/store/slices/quickActionsSlice.ts
 * @description Acciones rápidas del estudio: registro de la última acción repetible (F4) que envuelve
 * duplicar, mover, ahuecar, espejar, aplicar restas, simplificar, color, tipo y agregar pieza; agregar
 * pieza o pieza negativa desde el menú contextual; recalcular paramétricos (F5); búsqueda en la lista de
 * escena (F3) y petición de renombrar (F2). No registra acciones destructivas ni de archivo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { createPrimitive as createPrimitiveObject, positionOnTarget } from '../../core/operations';
import { HOLE_HELPER_COLOR } from '../../core/operations/creationOperations';
import { parametricStateOf } from '../../core/scene/parametric';
import { discParams, pieceParams, pieceSizeFor, pieceYOffset } from '../../core/scene/pieceSizing';
import { resolveHoleScope } from '../../core/scene/sceneRules';
import type { SceneObject, Vec3 } from '../../types/kura';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';
import type { PieceMode, RepeatOutcome, RepeatRecord } from '../quickActionsTypes';
import { sanitizeTransformPatch } from '../transformLimits';

/** Objetos cuyo nombre contiene `filter` (sin distinguir mayúsculas ni tildes). */
export function matchSceneObjects(objects: SceneObject[], filter: string): SceneObject[] {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = fold(filter.trim());
  if (!q) return objects;
  return objects.filter((o) => fold(o.name).includes(q));
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const isZero = (v: Vec3) => v.every((x) => Math.abs(x) < 1e-9);

export function createQuickActionsSlice(ctx: StoreContext, base: Partial<KuraStoreState>): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, runExclusive, opCtx } = ctx;

  const record = (rec: RepeatRecord) => set({ lastRepeatable: rec });
  const unlockedSelection = () => {
    const { objects, selectedIds } = get();
    return objects.filter((o) => selectedIds.includes(o.id) && !o.locked);
  };

  /** Agrega la primitiva centrada (−) o apoyada arriba (+) respecto de `target`; queda seleccionada. */
  const addPrimitivePiece = async (type: Parameters<typeof pieceParams>[0], mode: PieceMode, target: SceneObject, asDisc = false) =>
    runExclusive(`modular_${mode}_${asDisc ? 'disc' : type}`, null, async () => {
      await get().initEngine();
      const op = opCtx();
      const isHole = mode === 'negative';
      const side = pieceSizeFor(target);
      const params = asDisc ? discParams(side / 2) : pieceParams(type, side);
      const label = asDisc ? tr('menu.shape.disc') : op.naming.primitiveLabel(type);
      const mesh = type === 'text' ? await ctx.runEngine('primitiveMesh', { type, params }) : undefined;
      const yOffset = pieceYOffset(target, mode, asDisc ? (params.height ?? side) : side);
      const obj = await createPrimitiveObject(op, {
        mesh,
        type,
        params,
        name: `${op.naming.modulePrefix(isHole)} ${label}`,
        color: isHole ? HOLE_HELPER_COLOR : target.color,
        place: (m) => positionOnTarget(target, m, yOffset),
        materialPreset: target.materialPreset,
        isHole,
      });
      pushHistory();
      set((s) => ({
        objects: [...s.objects, obj],
        selectedIds: [obj.id],
        spawnedAtById: { ...s.spawnedAtById, [obj.id]: Date.now() },
      }));
      get().addToast(
        isHole ? tr('toast.subtractHelperCreated') : tr('toast.modularHelperCreated', { mode: '+', name: label }),
        'info',
      );
      return obj;
    });

  const replay = async (rec: RepeatRecord): Promise<RepeatOutcome> => {
    const s = get();
    const targets = unlockedSelection();
    const first = targets[0];
    switch (rec.kind) {
      case 'duplicate':
        return s.duplicateObjects().length > 0 ? 'done' : 'notApplicable';
      case 'nudge':
        if (!first) return 'notApplicable';
        s.nudgeSelectedObjects(rec.delta);
        return 'done';
      case 'transform': {
        if (!first || s.busyOperation) return 'notApplicable';
        const ids = new Set(targets.map((o) => o.id));
        const next = (o: SceneObject): Vec3 => {
          const cur = o[rec.part];
          return rec.part === 'scale'
            ? [cur[0] * rec.delta[0], cur[1] * rec.delta[1], cur[2] * rec.delta[2]]
            : [cur[0] + rec.delta[0], cur[1] + rec.delta[1], cur[2] + rec.delta[2]];
        };
        pushHistory();
        set((st) => ({
          objects: st.objects.map((o) => {
            if (!ids.has(o.id)) return o;
            const patch = sanitizeTransformPatch({ [rec.part]: next(o) });
            return patch ? { ...o, ...patch } : o;
          }),
        }));
        return 'done';
      }
      case 'hollow': {
        if (!first) return 'notApplicable';
        let ok = false;
        for (const o of targets) ok = (await s.hollowObject(o.id, { enabled: true, wallThickness: rec.wallThickness })) || ok;
        return ok ? 'done' : 'notApplicable';
      }
      case 'mirror': {
        if (!first) return 'notApplicable';
        let ok = false;
        for (const o of targets) ok = s.mirrorObject(o.id, rec.axis) || ok;
        return ok ? 'done' : 'notApplicable';
      }
      case 'applyHoles': {
        const scope = resolveHoleScope(s.objects, s.selectedIds);
        if (scope.solids.length === 0 || scope.holes.length === 0) return 'notApplicable';
        await s.applyHolesOnSolids();
        return 'done';
      }
      case 'addPiece':
        if (!first) return 'notApplicable';
        await s.addPieceToObject(rec.shape, rec.mode, first.id);
        return 'done';
      case 'simplify': {
        if (!first) return 'notApplicable';
        for (const o of targets) await s.simplifySelectedMesh(o.id, rec.toleranceMm);
        return 'done';
      }
      case 'color': {
        if (!first) return 'notApplicable';
        const ids = new Set(targets.map((o) => o.id));
        pushHistory();
        set((st) => ({ objects: st.objects.map((o) => (ids.has(o.id) ? { ...o, color: rec.color } : o)) }));
        return 'done';
      }
      case 'centerOnBed':
        return s.centerSelectionOnBed() ? 'done' : 'notApplicable';
      case 'group':
        return s.selectedIds.length > 0 && s.groupObjects() ? 'done' : 'notApplicable';
      case 'combine':
        return s.selectedIds.length > 1 && s.combineObjects() ? 'done' : 'notApplicable';
      case 'setType': {
        if (!first) return 'notApplicable';
        s.setObjectsHole(targets.map((o) => o.id), rec.isHole);
        return 'done';
      }
    }
  };

  let renameCounter = 0;

  return {
    lastRepeatable: null,
    pendingPiece: null,
    sceneFilter: '',
    renameRequest: null,
    searchFocusRequest: null,

    // ---- Envoltorios que registran la última acción repetible ----
    duplicateObjects: (ids) => {
      const created = base.duplicateObjects!(ids);
      if (created.length > 0) record({ kind: 'duplicate' });
      return created;
    },

    nudgeSelectedObjects: (deltaMm) => {
      const had = unlockedSelection().length > 0;
      base.nudgeSelectedObjects!(deltaMm);
      if (had) record({ kind: 'nudge', delta: [...deltaMm] as Vec3 });
    },

    setObjectTransform: (id, patch, recordHistory = false) => {
      const before = get().objects.find((o) => o.id === id);
      base.setObjectTransform!(id, patch, recordHistory);
      const after = get().objects.find((o) => o.id === id);
      // Solo las ediciones confirmadas (inspector) son repetibles; los arrastres del gizmo no.
      if (!recordHistory || !before || !after) return;
      for (const part of ['position', 'rotation', 'scale'] as const) {
        if (!patch[part]) continue;
        const delta: Vec3 = part === 'scale'
          ? [0, 1, 2].map((k) => (before.scale[k] !== 0 ? after.scale[k] / before.scale[k] : 1)) as Vec3
          : sub(after[part], before[part]);
        const neutral = part === 'scale' ? isZero(sub(delta, [1, 1, 1])) : isZero(delta);
        if (!neutral) record({ kind: 'transform', part, delta });
      }
    },

    hollowObject: async (id, options) => {
      const ok = await base.hollowObject!(id, options);
      if (ok && options.enabled) record({ kind: 'hollow', wallThickness: options.wallThickness });
      return ok;
    },

    mirrorObject: (id, axis) => {
      const ok = base.mirrorObject!(id, axis);
      if (ok) record({ kind: 'mirror', axis });
      return ok;
    },

    applyHolesOnSolids: async () => {
      const scope = resolveHoleScope(get().objects, get().selectedIds);
      const applicable = scope.solids.length > 0 && scope.holes.length > 0;
      await base.applyHolesOnSolids!();
      if (applicable) record({ kind: 'applyHoles' });
    },

    simplifySelectedMesh: async (id, toleranceMm) => {
      const ok = await base.simplifySelectedMesh!(id, toleranceMm);
      if (ok) record({ kind: 'simplify', toleranceMm });
      return ok;
    },

    updateObjectMeta: (id, patch) => {
      base.updateObjectMeta!(id, patch);
      const keys = Object.keys(patch);
      if (keys.length !== 1) return;
      if (patch.color) record({ kind: 'color', color: patch.color });
      else if (typeof patch.isHole === 'boolean') record({ kind: 'setType', isHole: patch.isHole });
    },

    setObjectsHole: (ids, isHole) => {
      const set_ = new Set(ids);
      const changing = get().objects.filter((o) => set_.has(o.id) && !o.locked && o.isHole !== isHole);
      if (changing.length === 0) return;
      pushHistory();
      const changeIds = new Set(changing.map((o) => o.id));
      set((s) => ({ objects: s.objects.map((o) => (changeIds.has(o.id) ? { ...o, isHole } : o)) }));
      record({ kind: 'setType', isHole });
    },

    // El SVG de una pieza se crea en el diálogo SVG: al terminar se coloca sobre el objeto y se marca el tipo.
    importSvgModel: async (options) => {
      const pending = get().pendingPiece;
      const obj = await base.importSvgModel!(options);
      if (pending && obj) {
        const target = get().objects.find((o) => o.id === pending.targetId);
        set((s) => ({
          pendingPiece: null,
          objects: s.objects.map((o) => {
            if (o.id !== obj.id || !target) return o;
            const isHole = pending.mode === 'negative';
            return {
              ...o,
              isHole,
              color: isHole ? HOLE_HELPER_COLOR : target.color,
              position: positionOnTarget(target, o.mesh, pieceYOffset(target, pending.mode, o.stats.dimensionsMm[1])),
            };
          }),
        }));
      }
      return obj;
    },

    setActiveDialog: (dialog) => {
      base.setActiveDialog!(dialog);
      if (dialog !== 'svg' && get().pendingPiece) set({ pendingPiece: null });
    },

    // ---- Agregar pieza ----
    addPieceToObject: async (shape, mode, targetId) => {
      const s = get();
      const target = s.objects.find((o) => o.id === (targetId ?? s.selectedIds[0]));
      if (!target) return null;
      if (s.busyOperation || s.projectBusy) return null;
      record({ kind: 'addPiece', shape, mode });
      if (shape === 'svg') {
        set({ pendingPiece: { mode, targetId: target.id } });
        s.setActiveDialog('svg');
        return null;
      }
      if (shape === 'import') return s.importModelAsModuleFromDialog(mode, target.id);
      if (shape === 'disc') return addPrimitivePiece('cylinder', mode, target, true);
      return addPrimitivePiece(shape, mode, target);
    },

    recomputeSelected: async () => {
      const targets = unlockedSelection();
      let count = 0;
      for (const obj of targets) {
        const st = parametricStateOf(obj);
        const edit = st.status === 'primitive'
          ? ({ kind: 'primitive', params: st.params } as const)
          : st.status === 'thread'
            ? ({ kind: 'thread', options: st.options } as const)
            : null;
        if (!edit) continue;
        if (await get().updatePrimitiveParams(obj.id, edit)) count += 1;
      }
      return count;
    },

    repeatLastAction: async () => {
      const rec = get().lastRepeatable;
      if (!rec) return 'none';
      if (get().busyOperation) return 'notApplicable';
      return replay(rec);
    },

    // ---- Búsqueda en la escena (F3) ----
    setSceneFilter: (value) => set({ sceneFilter: value.slice(0, 80) }),

    findSceneMatch: (mode) => {
      const { objects, selectedIds, sceneFilter } = get();
      const matches = matchSceneObjects(objects, sceneFilter);
      if (matches.length === 0 || !sceneFilter.trim()) return null;
      const current = selectedIds.length === 1 ? matches.findIndex((o) => o.id === selectedIds[0]) : -1;
      const index = mode === 'first' || current < 0
        ? 0
        : (current + (mode === 'next' ? 1 : -1) + matches.length) % matches.length;
      const found = matches[index];
      set({ selectedIds: [found.id] });
      get().requestCameraPreset('ensure', [found.id]);
      return found;
    },

    requestSceneSearchFocus: () => {
      renameCounter += 1;
      set({ searchFocusRequest: { n: renameCounter, at: Date.now() } });
    },

    requestRename: (id) => {
      const target = get().objects.find((o) => o.id === (id ?? get().selectedIds[0]));
      if (!target || target.locked) return false;
      renameCounter += 1;
      set({ renameRequest: { id: target.id, n: renameCounter, at: Date.now() } });
      return true;
    },
  };
}
