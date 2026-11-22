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
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export type SplitValidationState =
  | { status: 'running' }
  | { status: 'done'; report: SplitValidationReport }
  | { status: 'error' }
  | { status: 'nodata' };

export interface SplitJointsSliceState {
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
