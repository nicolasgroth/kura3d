/**
 * @file src/store/slices/paintSlice.ts
 * @description Slice de pintura por caras. Dos caminos: (1) el trazo en vivo del visor, que pinta
 * fuera del store y aquí solo se prepara (colores por cara sin historial) y se cierra con UN paso de
 * historial como delta; (2) la pintura de una sola vez (relleno, pintar todo, MCP, pincel con borde
 * fino), que también guarda delta si la topología no cambia e instantánea si se subdividió.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as ops from '../../core/operations';
import { OPERATION_DEFAULTS } from '../../engine/operationLimits';
import { diffFaceColors } from '../../engine/paint/colorDelta';
import { hasFaceColors, triangleCount } from '../../engine/paint/faceColors';
import type { MeshData, SceneObject } from '../../types/kura';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

function replaceMesh(objects: SceneObject[], id: string, mesh: MeshData): SceneObject[] {
  return objects.map((o) => (o.id === id ? { ...o, mesh } : o));
}

export function createPaintSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, pushHistory, pushHistoryStep, rejectWhileLocked, opCtx, runtime } = ctx;

  const editable = (id: string) => {
    const obj = get().objects.find((o) => o.id === id);
    return obj && !obj.locked ? obj : null;
  };

  /** Guarda el cambio de colores como delta (misma topología) o como instantánea (si no). */
  const recordColorChange = (before: SceneObject, after: MeshData) => {
    const delta = after.indices === before.mesh.indices ? diffFaceColors(before.mesh, after, before.color) : null;
    if (delta) pushHistoryStep({ kind: 'paintDelta', objectId: before.id, indices: after.indices, delta });
    else pushHistory();
  };

  return {
    paintObjectSurface: (id, localPoint, faceIndex, modeOverride) => {
      const state = get();
      const obj = editable(id);
      // Durante una operación en curso (o un arrastre sin confirmar) no se pinta: el resultado la pisaría.
      if (!obj || rejectWhileLocked()) return;
      const mode = modeOverride ?? state.paintMode;
      const color = state.paintColor;
      let change: ops.SceneChange | null;
      if (mode === 'whole') {
        change = ops.paintWholeObject(opCtx(), obj, color, OPERATION_DEFAULTS.paint.wholeSetsBaseColor);
      } else if (mode === 'smart_fill' && faceIndex !== null) {
        change = ops.paintRegion(opCtx(), obj, faceIndex, color);
      } else if (localPoint) {
        change = ops.paintBrushSample(opCtx(), obj, localPoint, state.paintRadiusMm, color, { refineEdge: state.paintRefineEdge });
      } else {
        return;
      }
      // Sin cambios de color (pasar el pincel sobre caras ya pintadas): ni historial ni render.
      if (!change || change.patches.length === 0) return;
      const stroke = runtime.paintStroke;
      if (stroke.open) {
        // Trazo con borde fino (cambia la topología): una instantánea al inicio del trazo.
        if (!stroke.recorded) pushHistory();
        stroke.recorded = true;
      } else {
        const mesh = change.patches.length === 1 && change.patches[0].id === id ? change.patches[0].patch.mesh : undefined;
        const onlyMesh = mesh && Object.keys(change.patches[0].patch).length === 1;
        if (mesh && onlyMesh) recordColorChange(obj, mesh);
        else pushHistory();
      }
      set((prev) => ({ objects: ops.applySceneChange(prev.objects, change) }));
    },

    beginPaintStroke: () => {
      runtime.paintStroke = { open: true, recorded: false };
    },
    endPaintStroke: () => {
      runtime.paintStroke = { open: false, recorded: false };
    },

    preparePaintStroke: (id) => {
      const obj = editable(id);
      if (!obj || rejectWhileLocked()) return null;
      let prepared = obj.mesh;
      if (!hasFaceColors(obj.mesh)) {
        // Mismo aspecto, pero con atributo de color en el visor: el trazo escribe ahí directamente.
        prepared = { ...obj.mesh, faceColors: new Array<string>(triangleCount(obj.mesh)).fill(obj.color.toLowerCase()) };
        set((prev) => ({ objects: replaceMesh(prev.objects, id, prepared) }));
      }
      runtime.livePaint = { objectId: id, original: obj.mesh, prepared };
      return prepared;
    },

    commitPaintStroke: (id, result) => {
      const live = runtime.livePaint;
      runtime.livePaint = null;
      if (!live || live.objectId !== id) return;
      const obj = get().objects.find((o) => o.id === id);
      // La malla cambió durante el trazo (otra acción la reemplazó): el trazo ya no aplica.
      if (!obj || obj.mesh !== live.prepared) return;
      if (!result || result.mesh.indices !== live.original.indices) {
        // Nada cambió: se deja la malla exactamente como estaba (sin colores si no los tenía).
        if (live.original !== live.prepared) set((prev) => ({ objects: replaceMesh(prev.objects, id, live.original) }));
        return;
      }
      const delta = { ...result.delta, beforePainted: hasFaceColors(live.original) };
      pushHistoryStep({ kind: 'paintDelta', objectId: id, indices: result.mesh.indices, delta });
      set((prev) => ({ objects: replaceMesh(prev.objects, id, result.mesh) }));
    },
  };
}
