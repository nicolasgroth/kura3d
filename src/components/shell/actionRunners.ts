/**
 * @file src/components/shell/actionRunners.ts
 * @description Qué hace cada acción del menú «Acciones»: exactamente lo mismo que su entrada actual (menú
 * contextual, paleta o inspector): abre su diálogo, lleva el inspector a su panel o lanza la operación del
 * store sobre la selección. Antes registra la acción como activa (`setActiveAction`) para el panel contextual.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../../i18n';
import type { AlignMode, ObjectRole } from '../../types/kura';
import { actionHasPanel, type ActionId } from '../../store/actionsCatalog';
import { useKuraStore } from '../../store/useKuraStore';
import { openHollowPanel, OPEN_INSPECTOR_EVENT } from '../inspector/hollowPanelRequest';
import { REFINE_UI_DEFAULTS } from '../refineDefaults';

/**
 * Deja a la vista el panel derecho para una acción con opciones: sale del modo sin distracciones y, en
 * pantallas estrechas, abre la hoja del inspector (en escritorio el store ya despliega el panel plegado).
 */
export function revealContextPanel(): void {
  const state = useKuraStore.getState();
  if (state.uiDensity === 'zen') state.toggleZenMode();
  if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 900px)').matches) {
    window.dispatchEvent(new Event(OPEN_INSPECTOR_EVENT));
  }
}

/** Abre solo las opciones de una acción en el panel, sin ejecutarla (accesos del resumen del objeto). */
export function openActionPanel(id: ActionId): void {
  useKuraStore.getState().setActiveAction(id);
  revealContextPanel();
}

/** Ejecuta la acción sobre la selección actual (la disponibilidad ya se comprobó al pintar el menú). */
export function runAction(id: ActionId): void {
  const state = useKuraStore.getState();
  const ids = state.selectedIds;
  const primary = ids[0];
  state.setActiveAction(id);
  if (actionHasPanel(id) && id !== 'hollow' && id !== 'simplify') revealContextPanel();
  switch (id) {
    case 'hollow':
      if (primary) openHollowPanel(primary);
      return;
    case 'splitForBed':
      state.setActiveDialog('splitForBed');
      return;
    case 'fitToBed':
      void state.openFitToBed(ids);
      return;
    case 'mold':
      state.setActiveDialog('mold');
      return;
    case 'project':
      state.setActiveDialog('project');
      return;
    case 'repair':
      if (primary) void state.repairObjectMesh(primary);
      return;
    case 'simplify':
      if (primary) state.requestSimplifyPanel(primary);
      return;
    case 'refine':
      if (primary) void state.refineSelectedMesh(primary, REFINE_UI_DEFAULTS.edgeMm, REFINE_UI_DEFAULTS.smooth);
      return;
    case 'smooth':
    case 'texture':
    case 'modules':
      // Solo opciones: el panel contextual muestra su sección y el usuario aplica desde allí.
      return;
    case 'hull':
      void state.runConvexHull();
      return;
    case 'splitColors':
      if (primary) void state.splitObjectByColor(primary);
      return;
    case 'splitParts':
      if (primary) void state.splitDisconnectedObject(primary);
      return;
    case 'group':
      state.groupObjects(ids);
      return;
    case 'ungroup':
      state.ungroupObjects();
      return;
    case 'combine':
      state.combineObjects(ids);
      return;
    case 'union':
      void state.runBooleanOnSelection('union');
      return;
    case 'applyHoles':
      void state.applyHolesOnSolids();
      return;
    case 'dropToBed':
      state.dropObjectsToBed(ids);
      return;
    case 'centerOnBed':
      state.centerSelectionOnBed(ids);
      return;
    case 'validate':
      if (primary) void state.runPrintabilityCheck(primary);
      return;
    case 'detect':
      if (primary) void state.detectObjectStructures(primary);
      return;
    case 'orient':
      // Solo opciones: el panel calcula al abrirse y el usuario aplica desde allí.
      return;
    case 'fitCheck':
      // Bajo pedido: el panel muestra las opciones y el usuario comprueba desde allí.
      return;
    case 'convert':
    case 'align':
      // Tienen submenú: se ejecutan con `runConvert` o `runAlign`.
      return;
  }
}

export function runConvert(role: ObjectRole): void {
  const state = useKuraStore.getState();
  state.setActiveAction('convert');
  state.setObjectsRole(state.selectedIds, role);
}

export function runAlign(mode: AlignMode): void {
  const state = useKuraStore.getState();
  state.setActiveAction('align');
  state.alignSelectedObjects(mode);
}

/** «Una placa por objeto»: reparte la selección (o todas las piezas) y avisa cuántas piezas y placas nuevas hubo. */
export function runSpreadOnePlatePerObject(): void {
  const state = useKuraStore.getState();
  const result = state.spreadOnePlatePerObject();
  if (!result) {
    state.addToast(t(state.language, 'plates.spread.reason'), 'info');
    return;
  }
  state.addToast(t(state.language, 'plates.toast.spread', { count: result.pieces, created: result.created }), 'success');
}

/** «Mover a placa»: lleva la selección a la placa `plateId` (`null` = placa nueva) y avisa cuántas piezas pasaron. */
export function runMoveToPlate(plateId: string | null): void {
  const state = useKuraStore.getState();
  const count = state.moveToPlate(plateId);
  if (count === 0) return;
  const after = useKuraStore.getState();
  const name = after.plates.find((p) => p.id === (plateId ?? after.activePlateId))?.name ?? '';
  // Si el bloque es más grande que la cama destino, se movió igual y el aviso lo dice.
  after.addToast(t(after.language, after.lastMoveToPlateFits ? 'plates.toast.moved' : 'plates.toast.movedNoFit', { count, name }), 'info');
}
