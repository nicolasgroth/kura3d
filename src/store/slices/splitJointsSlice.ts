/**
 * @file src/store/slices/splitJointsSlice.ts
 * @description Estado de interfaz de las uniones de un grupo dividido: lo que dijo el motor al dividir
 * (`splitNotes`), el último "Validar armado" por grupo (`splitValidation`, solo lectura en el Worker) y la
 * unión resaltada en el visor (`splitJointFocus`). Nada de esto va al historial ni al archivo `.kura`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SplitGroupNotes, SplitValidationReport } from '../../core/scene/splitJointStatus';
import type { SplitForBedRequest } from '../splitCommandSchemas';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export type SplitValidationState =
  | { status: 'running' }
  | { status: 'done'; report: SplitValidationReport }
  | { status: 'error' }
  | { status: 'nodata' };

/** Lo pedido al dividir, para repetir la división con el refuerzo activo (solo en la sesión). */
export interface SplitRequestRecord {
  /** Objeto que se dividió (al deshacer vuelve con este id). */
  objectId: string;
  request: Omit<SplitForBedRequest, 'target'>;
  /** Pasos de deshacer justo después de dividir: si cambia, ya hay otros pasos encima y no se puede rehacer. */
  historyDepth: number;
}

export interface SplitJointsSliceState {
  /** Petición con la que se dividió cada grupo (por `groupId`), para "Reforzar y dividir de nuevo". */
  splitRequests: Record<string, SplitRequestRecord>;
  setSplitRequest: (groupId: string, record: SplitRequestRecord) => void;
  /**
   * Deshace la división del grupo y la repite con los mismos parámetros y `reinforceWeakJoints: true`.
   * Solo si la división es lo último del historial; devuelve `false` si no se pudo.
   */
  reinforceSplitGroup: (groupId: string) => Promise<boolean>;
  /** Avisos y arreglos del motor al dividir, por grupo (`groupId`). */
  splitNotes: Record<string, SplitGroupNotes>;
  setSplitNotes: (groupId: string, notes: SplitGroupNotes) => void;
  /** Último "Validar armado" por grupo. */
  splitValidation: Record<string, SplitValidationState>;
  /** Revalida el armado del grupo con las uniones guardadas en sus piezas. */
  validateSplitGroup: (groupId: string) => Promise<void>;
  /** Unión que el usuario señala (cursor o foco en la lista) para resaltarla en el visor. */
  splitJointFocus: { groupId: string; label: string } | null;
  setSplitJointFocus: (focus: { groupId: string; label: string } | null) => void;
}

export function createSplitJointsSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get } = ctx;
  return {
    splitNotes: {},
    splitRequests: {},
    setSplitRequest: (groupId, record) => set((s) => ({ splitRequests: { ...s.splitRequests, [groupId]: record } })),
    reinforceSplitGroup: async (groupId) => {
      const rec = get().splitRequests[groupId];
      if (!rec || rec.request.execute.reinforceWeakJoints || get().past.length !== rec.historyDepth || get().busyOperation) return false;
      get().undo();
      if (get().past.length >= rec.historyDepth) return false;
      const out = await get().splitObjectForBed(rec.objectId, {
        ...rec.request,
        execute: { ...rec.request.execute, reinforceWeakJoints: true },
      });
      return Boolean(out && out.parts.length > 0);
    },
    splitValidation: {},
    splitJointFocus: null,
    setSplitJointFocus: (focus) => {
      const cur = get().splitJointFocus;
      if (cur?.groupId === focus?.groupId && cur?.label === focus?.label) return;
      set({ splitJointFocus: focus });
    },
    setSplitNotes: (groupId, notes) =>
      // Una división nueva del mismo grupo reemplaza lo anterior, también su validación.
      set((s) => {
        const { [groupId]: _old, ...validation } = s.splitValidation;
        return { splitNotes: { ...s.splitNotes, [groupId]: notes }, splitValidation: validation };
      }),
    validateSplitGroup: async (groupId) => {
      const parts = get().objects.filter((o) => o.metadata?.split?.groupId === groupId);
      const put = (v: SplitJointsSliceState['splitValidation'][string]) => set((s) => ({ splitValidation: { ...s.splitValidation, [groupId]: v } }));
      if (parts.length === 0 || parts.every((p) => !p.metadata?.split?.joints)) {
        put({ status: 'nodata' });
        return;
      }
      put({ status: 'running' });
      const report = await get().validateSplitAssembly(parts);
      put(report ? { status: 'done', report: report as unknown as SplitValidationReport } : { status: 'error' });
    },
  };
}
