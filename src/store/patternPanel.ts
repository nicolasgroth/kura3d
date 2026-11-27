/**
 * @file src/store/patternPanel.ts
 * @description Estado y lógica del panel «Patrón»: tipo (lineal, circular o espejo), los valores de cada formulario, la
 * vista previa fantasma que calcula el panel y «Aplicar», que usa `applyPattern` del store con los mismos valores. Al
 * abrir propone un paso con el tamaño de la pieza más 5 mm (lo recalcula al cambiar el eje mientras el usuario no lo
 * edite). Los componentes solo leen y llaman; el plan lo resuelve `store/patternPlanning.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { create } from 'zustand';
import { t } from '../i18n';
import { internalAxisOfUser, internalIndexOfUser, type AxisName } from '../core/scene/displayAxes';
import { groupBoxOf, PATTERN_RANGES, type CircularSpec, type LinearSpec, type MirrorSpec, type PatternCenterMode, type PatternDistanceMode, type MirrorBase } from '../core/scene/patterns';
import { boxForObjects, type FrameBox } from '../core/scene/cameraFraming';
import { ghostWorldBox, type PatternGhost } from '../core/scene/patternGhost';
import type { SceneObject, Vec3 } from '../types/kura';
import { patternSources, type PatternRequest } from './patternPlanning';
import { useKuraStore } from './useKuraStore';

export type PatternKind = 'linear' | 'circular' | 'mirror';
/** Holgura que se suma al tamaño de la pieza en el paso propuesto. */
export const PATTERN_DEFAULT_GAP_MM = 5;

export interface PatternPanelState {
  open: boolean;
  kind: PatternKind;
  union: boolean;
  // Lineal
  count: number;
  axis: AxisName;
  mode: PatternDistanceMode;
  distanceMm: number;
  /** El usuario ya editó la distancia: no se vuelve a proponer al cambiar el eje. */
  distanceTouched: boolean;
  grid: boolean;
  rows: number;
  rowAxis: AxisName;
  rowDistanceMm: number;
  rowDistanceTouched: boolean;
  // Circular
  circCount: number;
  circAxis: AxisName;
  center: PatternCenterMode;
  pointMm: Vec3;
  totalAngleDeg: number;
  rotateCopies: boolean;
  // Espejo
  mirrorAxis: AxisName;
  mirrorBase: MirrorBase;
  offsetMm: number;
  keepOriginal: boolean;
  /** Fantasma de la vista previa para el visor (lo escribe el panel). */
  ghost: PatternGhost | null;
}

const INITIAL: PatternPanelState = {
  open: false, kind: 'linear', union: false,
  count: PATTERN_RANGES.count.default, axis: 'x', mode: 'step', distanceMm: PATTERN_RANGES.distanceMm.default, distanceTouched: false,
  grid: false, rows: 2, rowAxis: 'y', rowDistanceMm: PATTERN_RANGES.distanceMm.default, rowDistanceTouched: false,
  circCount: 6, circAxis: 'z', center: 'bed', pointMm: [0, 0, 0], totalAngleDeg: 360, rotateCopies: true,
  mirrorAxis: 'x', mirrorBase: 'object', offsetMm: 0, keepOriginal: true,
  ghost: null,
};

/** Caja de todo el patrón (copias del fantasma y piezas de origen), para que la cámara lo deje entero a la vista. */
export function patternFrameBox(ghost: PatternGhost | null, sources: ReadonlyArray<Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>>): FrameBox | null {
  const copies = ghost ? ghostWorldBox(ghost) : null;
  const originals = boxForObjects(sources);
  if (!copies) return originals;
  if (!originals) return copies;
  return { min: [0, 1, 2].map((i) => Math.min(copies.min[i], originals.min[i])) as Vec3, max: [0, 1, 2].map((i) => Math.max(copies.max[i], originals.max[i])) as Vec3 };
}

export const usePatternPanel = create<PatternPanelState>(() => ({ ...INITIAL }));

/** Piezas sobre las que trabaja el patrón: la selección (sin los imanes dependientes, que se suman al resolver). */
export const patternTargetIds = (objects: readonly SceneObject[], selectedIds: readonly string[]): string[] => {
  const picked = new Set(selectedIds);
  return objects.filter((o) => picked.has(o.id)).map((o) => o.id);
};

/** Tamaño de las piezas a lo largo de un eje del usuario, más la holgura (paso propuesto). */
export function suggestedStepMm(objects: readonly SceneObject[], ids: readonly string[], axis: AxisName): number {
  const box = groupBoxOf(patternSources(objects, ids, true));
  if (!box) return PATTERN_RANGES.distanceMm.default;
  const idx = internalIndexOfUser(axis);
  const size = box.max[idx] - box.min[idx];
  return Math.round((size + PATTERN_DEFAULT_GAP_MM) * 10) / 10;
}

const LINEAR_AXIS_NEXT: Record<AxisName, AxisName> = { x: 'y', y: 'x', z: 'x' };

/** Abre el panel. Sin piezas seleccionadas (o con una operación en curso) no abre y avisa por qué. */
export function openPatternPanel(kind: PatternKind = 'linear'): boolean {
  const store = useKuraStore.getState();
  if (store.busyOperation) {
    store.addToast(t(store.language, 'rediseno.reason.busy'), 'info');
    return false;
  }
  const ids = patternTargetIds(store.objects, store.selectedIds);
  if (ids.length === 0) {
    store.addToast(t(store.language, 'pattern.noSelection'), 'info');
    return false;
  }
  usePatternPanel.setState({
    ...INITIAL, open: true, kind,
    distanceMm: suggestedStepMm(store.objects, ids, INITIAL.axis),
    rowDistanceMm: suggestedStepMm(store.objects, ids, INITIAL.rowAxis),
  });
  useKuraStore.setState({ commandPaletteOpen: false });
  return true;
}

export function closePatternPanel(): void {
  usePatternPanel.setState({ ...INITIAL });
}

type Editable = Omit<PatternPanelState, 'open' | 'ghost'>;

/** Cambia valores. Al cambiar un eje que el usuario no ajustó a mano, el paso se propone de nuevo con el tamaño de la pieza. */
export function setPatternOptions(patch: Partial<Editable>): void {
  const state = usePatternPanel.getState();
  const next: Partial<PatternPanelState> = { ...patch };
  const store = useKuraStore.getState();
  const ids = patternTargetIds(store.objects, store.selectedIds);
  if ('distanceMm' in patch) next.distanceTouched = true;
  if ('rowDistanceMm' in patch) next.rowDistanceTouched = true;
  if (patch.axis && !('distanceMm' in patch) && !state.distanceTouched) next.distanceMm = suggestedStepMm(store.objects, ids, patch.axis);
  if (patch.rowAxis && !('rowDistanceMm' in patch) && !state.rowDistanceTouched) next.rowDistanceMm = suggestedStepMm(store.objects, ids, patch.rowAxis);
  // Si el eje de las filas coincide con el de la fila, se propone otro para no apilar las copias.
  if (patch.axis && patch.axis === (patch.rowAxis ?? state.rowAxis)) next.rowAxis = LINEAR_AXIS_NEXT[patch.axis];
  usePatternPanel.setState(next);
}

/** Pedido al store con los valores del formulario del tipo activo. */
export function patternRequestOf(panel: PatternPanelState, ids: string[]): PatternRequest {
  if (panel.kind === 'linear') {
    const spec: LinearSpec = {
      count: panel.count, axis: panel.axis, mode: panel.mode, distanceMm: panel.distanceMm,
      ...(panel.grid ? { rows: panel.rows, rowAxis: panel.rowAxis, rowDistanceMm: panel.rowDistanceMm } : {}),
    };
    return { kind: 'linear', ids, spec, union: panel.union };
  }
  if (panel.kind === 'circular') {
    const spec: CircularSpec = { count: panel.circCount, axis: panel.circAxis, totalAngleDeg: panel.totalAngleDeg, rotateCopies: panel.rotateCopies };
    return { kind: 'circular', ids, spec, center: { mode: panel.center, ...(panel.center === 'point' ? { pointMm: panel.pointMm } : {}) }, union: panel.union };
  }
  const spec: MirrorSpec = { axis: panel.mirrorAxis, base: panel.mirrorBase, offsetMm: panel.offsetMm, keepOriginal: panel.keepOriginal };
  return { kind: 'mirror', ids, spec, union: panel.union };
}

/** «Aplicar»: usa los valores del panel con la selección actual; si se aplicó, cierra el panel. */
export async function applyPatternPanel(): Promise<boolean> {
  const panel = usePatternPanel.getState();
  const store = useKuraStore.getState();
  const ids = patternTargetIds(store.objects, store.selectedIds);
  if (!panel.open || ids.length === 0) return false;
  const result = await store.applyPattern(patternRequestOf(panel, ids));
  if (!result) return false;
  closePatternPanel();
  return true;
}

/** Eje interno de un eje del usuario (para mostrar el plano del espejo en el visor, si hiciera falta). */
export const internalAxisLetter = (axis: AxisName): AxisName => internalAxisOfUser(axis).axis;
