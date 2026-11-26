/**
 * @file src/store/plateArrangePanel.ts
 * @description Estado y lógica del panel «Repartir en placas…»: qué repartir (selección o todo), criterio (incluida
 * «Una placa por objeto», que usa su acción propia), orientación, separación y margen; la vista previa en vivo
 * (`planArrangeOnPlates`, sin tocar escena ni historial) con su estado de cálculo, y «Repartir», que aplica con las
 * mismas opciones en un paso de deshacer, cierra el panel, pasa a Imprimir si se estaba en Armado o Libre y avisa el
 * resultado con «Deshacer» persistente y la lista de lo que no cupo. Los componentes solo leen y llaman.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { create } from 'zustand';
import { ARRANGE_DEFAULTS, newPlatesUsed, type ArrangeCriterion, type ArrangeOptions, type ArrangeOrient, type ArrangeReport } from '../core/scene/plateArrangeTypes';
import { projectBed } from '../core/scene/activePlateBed';
import { assignable } from '../core/scene/plates';
import { t } from '../i18n';
import type { SceneObject } from '../types/kura';
import { arrangeGhost, type ArrangeGhost } from './plateArrangeGhost';
import { undoToastAction } from './toastActionState';
import { useKuraStore } from './useKuraStore';
import type { ArrangePreview } from './slices/plateArrangeSlice';

export type ArrangeChoice = ArrangeCriterion | 'onePerObject';
export type ArrangeScope = 'selection' | 'all';
/** `idle`: sin cálculo (p. ej. «Una placa por objeto»). `cancelled`: el usuario canceló. `failed`: el motor falló. */
export type ArrangePreviewStatus = 'idle' | 'running' | 'ready' | 'cancelled' | 'failed';

export interface PlateArrangePanelState {
  open: boolean;
  scope: ArrangeScope;
  criterion: ArrangeChoice;
  orient: ArrangeOrient;
  spacingMm: number;
  marginMm: number;
  status: ArrangePreviewStatus;
  preview: ArrangePreview | null;
  /** Contornos para el visor; null si no hay vista previa o son demasiadas piezas para dibujarlos. */
  ghost: ArrangeGhost | null;
}

const INITIAL: PlateArrangePanelState = {
  open: false, scope: 'all', criterion: ARRANGE_DEFAULTS.criterion, orient: ARRANGE_DEFAULTS.orient,
  spacingMm: ARRANGE_DEFAULTS.spacingMm, marginMm: ARRANGE_DEFAULTS.marginMm, status: 'idle', preview: null, ghost: null,
};

export const usePlateArrangePanel = create<PlateArrangePanelState>(() => ({ ...INITIAL }));

/** Máximo de piezas nombradas en el aviso de resultado antes de resumir con «y N más». */
const NAMED_UNPLACED_MAX = 5;

/** Pieza que el reparto puede mover: sólida, sin bloquear y que no es un agregado. */
const arrangeable = (o: SceneObject): boolean => assignable(o) && !o.metadata?.addon;

/** Ids repartibles según el alcance: la selección, o todas las piezas visibles. */
export function arrangeScopeIds(objects: readonly SceneObject[], selectedIds: readonly string[], scope: ArrangeScope): string[] {
  const picked = new Set(selectedIds);
  return objects.filter((o) => arrangeable(o) && (scope === 'selection' ? picked.has(o.id) : o.visible)).map((o) => o.id);
}

/** Opciones del motor con las del panel (null en `ids` = todas las visibles). */
export function plateArrangeOptionsOf(panel: PlateArrangePanelState, ids: readonly string[]): ArrangeOptions {
  return {
    ids: panel.scope === 'selection' ? ids : null,
    criterion: panel.criterion === 'onePerObject' ? 'compact' : panel.criterion,
    spacingMm: panel.spacingMm, marginMm: panel.marginMm, orient: panel.orient,
  };
}

let requestSeq = 0;

/** Abre el panel. Sin piezas que repartir (o con una operación en curso) no abre y avisa por qué. */
export function openPlateArrangePanel(): boolean {
  const store = useKuraStore.getState();
  if (store.busyOperation) {
    store.addToast(t(store.language, 'rediseno.reason.busy'), 'info');
    return false;
  }
  if (arrangeScopeIds(store.objects, store.selectedIds, 'all').length === 0) {
    store.addToast(t(store.language, 'plates.arrange.toast.nothing'), 'info');
    return false;
  }
  const hasSelection = arrangeScopeIds(store.objects, store.selectedIds, 'selection').length > 0;
  usePlateArrangePanel.setState({ ...INITIAL, open: true, scope: hasSelection ? 'selection' : 'all' });
  useKuraStore.setState({ commandPaletteOpen: false });
  return true;
}

export function closePlateArrangePanel(): void {
  requestSeq += 1;
  useKuraStore.getState().cancelArrangeOnPlates();
  usePlateArrangePanel.setState({ ...INITIAL });
}

/** Cambia opciones; la vista previa anterior deja de valer hasta el próximo cálculo. */
export function setPlateArrangeOptions(patch: Partial<Pick<PlateArrangePanelState, 'scope' | 'criterion' | 'orient' | 'spacingMm' | 'marginMm'>>): void {
  usePlateArrangePanel.setState({ ...patch, preview: null, ghost: null, status: 'idle' });
}

/** Calcula la vista previa con las opciones vigentes. «Una placa por objeto» no tiene vista previa de reparto. */
export async function refreshPlateArrangePreview(): Promise<void> {
  const panel = usePlateArrangePanel.getState();
  if (!panel.open) return;
  const mine = ++requestSeq;
  const store = useKuraStore.getState();
  if (panel.criterion === 'onePerObject') {
    store.cancelArrangeOnPlates();
    usePlateArrangePanel.setState({ status: 'idle', preview: null, ghost: null });
    return;
  }
  const ids = arrangeScopeIds(store.objects, store.selectedIds, panel.scope);
  if (ids.length === 0) {
    store.cancelArrangeOnPlates();
    usePlateArrangePanel.setState({ status: 'idle', preview: null, ghost: null });
    return;
  }
  usePlateArrangePanel.setState({ status: 'running', preview: null, ghost: null });
  const result = await store.planArrangeOnPlates(plateArrangeOptionsOf(panel, ids));
  // Otro pedido (u otro cierre) tomó el relevo: este resultado ya no cuenta.
  if (mine !== requestSeq || !usePlateArrangePanel.getState().open) return;
  const now = useKuraStore.getState();
  usePlateArrangePanel.setState(result
    ? { status: 'ready', preview: result, ghost: arrangeGhost(result.plan, now.objects, projectBed(now)) }
    : { status: 'failed', preview: null, ghost: null });
}

/** «Cancelar» del cálculo en curso: se queda sin vista previa hasta que se cambie una opción. */
export function cancelPlateArrangePreview(): void {
  requestSeq += 1;
  useKuraStore.getState().cancelArrangeOnPlates();
  usePlateArrangePanel.setState({ status: 'cancelled', preview: null, ghost: null });
}

const reasonText = (language: Parameters<typeof t>[0], reason: ArrangeReport['unplaced'][number]['reason']) =>
  t(language, `plates.arrangeDlg.preview.reason.${reason}`);

/** «a, b y 3 más» con nombres de piezas (para el aviso). */
function unplacedList(language: Parameters<typeof t>[0], report: ArrangeReport, objects: readonly SceneObject[]): string {
  const name = (id: string) => objects.find((o) => o.id === id)?.name ?? id;
  const shown = report.unplaced.slice(0, NAMED_UNPLACED_MAX).map((u) => `${name(u.id)} (${reasonText(language, u.reason)})`);
  const rest = report.unplaced.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} ${t(language, 'plates.arrangeDlg.toast.more', { count: rest })}` : shown.join(', ');
}

/**
 * «Repartir»: aplica con las opciones del panel. Devuelve true si se aplicó (el panel se cierra). En armado o libre
 * pasa a Imprimir para que se vea el resultado. El aviso lleva «Deshacer» persistente; lo que no cupo va aparte.
 */
export async function applyPlateArrange(): Promise<boolean> {
  const panel = usePlateArrangePanel.getState();
  const store = useKuraStore.getState();
  const language = store.language;
  const ids = arrangeScopeIds(store.objects, store.selectedIds, panel.scope);
  if (!panel.open || ids.length === 0) return false;

  if (panel.criterion === 'onePerObject') {
    closePlateArrangePanel();
    const result = store.spreadOnePlatePerObject(ids);
    if (!result) {
      store.addToast(t(language, 'plates.spread.reason'), 'info');
      return false;
    }
    store.addToast(
      t(language, 'plates.toast.spread', { count: result.pieces, created: result.created }), 'success',
      undoToastAction(t(language, 'toast.undo'), () => useKuraStore.getState().past, () => useKuraStore.getState().undo(), true),
    );
    return true;
  }

  const wasPrint = store.layout === 'print';
  const report = await store.arrangeOnPlatesApply(plateArrangeOptionsOf(panel, ids), { quiet: true });
  if (!report) return false;
  closePlateArrangePanel();
  // Sin nada que mover, el aviso del motivo es del panel (con `quiet` el store calla).
  if (report.moved === 0) {
    const n = report.unplaced.length;
    store.addToast(t(language, n ? 'plates.arrange.toast.unplaced' : 'plates.arrange.toast.nothing', { count: n }), 'info');
    return true;
  }
  const after = useKuraStore.getState();
  // En Armado o Libre las placas no se ven: se pasa a Imprimir (no agrega paso de deshacer).
  const switched = !wasPrint && after.setViewMode('print') === 'changed';
  const state = useKuraStore.getState();
  // «Nuevas» = nuevas que reciben piezas (≤ usadas); la implícita que pasa a «Placa 1» no es nueva para el usuario.
  const created = newPlatesUsed(report);
  const text = created > 0
    ? t(language, 'plates.arrangeDlg.toast.done', { count: report.placed.length, plates: report.platesUsed.length, created })
    : t(language, 'plates.arrangeDlg.toast.doneNoNew', { count: report.placed.length, plates: report.platesUsed.length });
  state.addToast(
    switched ? `${text} ${t(language, 'plates.arrangeDlg.toast.switched')}` : text, 'success',
    undoToastAction(t(language, 'toast.undo'), () => useKuraStore.getState().past, () => useKuraStore.getState().undo(), true),
  );
  if (report.unplaced.length) state.addToast(t(language, 'plates.arrangeDlg.toast.unplaced', { list: unplacedList(language, report, state.objects) }), 'info');
  return true;
}
