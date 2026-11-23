/**
 * @file src/store/historyLabels.ts
 * @description Nombres legibles de los pasos del historial de deshacer. Un paso se nombra con la acción
 * repetible (F4) que lo registró, guardada aparte en un `WeakMap` (no cambia el contenido del paso ni retiene
 * memoria: muere con él); si no tiene nombre, se deduce comparando el estado antes y después (agregar,
 * eliminar, mover, rotar, escalar, editar malla, pintar…). `historyTimeline` arma la lista que muestra el
 * desplegable del historial: «Inicio» y cada acción con su posición, la actual marcada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../i18n';
import type { LanguageCode, SceneObject } from '../types/kura';
import type { ProjectSceneSnapshot } from '../project/projectSchema';
import { isPaintDeltaStep, type HistoryStep } from './historySteps';
import { repeatLabel } from './repeatLabel';
import type { RepeatRecord } from './quickActionsTypes';

const tags = new WeakMap<object, RepeatRecord>();
/** Último paso empujado y cuándo: `record` (F4) lo nombra si llega enseguida. */
let lastPushed: { step: WeakRef<object>; at: number } | null = null;
/** Ventana para asociar el registro F4 al paso recién empujado (operaciones asíncronas incluidas). */
const TAG_WINDOW_MS = 15_000;

export function notePushedStep(step: HistoryStep): void {
  lastPushed = { step: new WeakRef(step), at: Date.now() };
}

/** Nombra el último paso empujado con la acción que lo registró, si es el último del pasado y no tiene nombre. */
export function tagLastPushedStep(rec: RepeatRecord, past: readonly HistoryStep[]): void {
  const step = lastPushed?.step.deref();
  if (!step || !lastPushed || Date.now() - lastPushed.at > TAG_WINDOW_MS) return;
  if (past[past.length - 1] !== step || tags.has(step)) return;
  tags.set(step, rec);
}

/** Pasa el nombre de un paso a la instantánea que lo reemplaza al deshacer o rehacer. */
export function carryStepLabel(from: HistoryStep, to: HistoryStep): void {
  const rec = tags.get(from);
  if (rec && from !== to) tags.set(to, rec);
}

const objectsOf = (step: HistoryStep | undefined, current: readonly SceneObject[]): readonly SceneObject[] | null =>
  step === undefined ? current : isPaintDeltaStep(step) ? null : (step as ProjectSceneSnapshot).objects;

/** Grupos de un paso como texto comparable (las instantáneas copian los grupos: no sirve comparar referencias). */
const groupsOf = (step: HistoryStep | undefined, current: unknown): string =>
  JSON.stringify(step === undefined ? current ?? [] : isPaintDeltaStep(step) ? null : (step as ProjectSceneSnapshot).groups ?? []);

const differs = (a: readonly number[], b: readonly number[]) => a.some((v, i) => Math.abs(v - b[i]) > 1e-9);

/** Campos que ya se comparan aparte (o que solo derivan de la malla). */
const SKIP_KEYS = new Set(['mesh', 'position', 'rotation', 'scale', 'stats']);

/** Cambió algo más que la malla y la transformación (nombre, color, tipo, visibilidad…). Las instantáneas copian
 * los objetos, así que se compara campo a campo. */
function propsDiffer(a: SceneObject, b: SceneObject): boolean {
  const ra = a as unknown as Record<string, unknown>;
  const rb = b as unknown as Record<string, unknown>;
  for (const key of new Set([...Object.keys(ra), ...Object.keys(rb)])) {
    if (SKIP_KEYS.has(key)) continue;
    const va = ra[key];
    const vb = rb[key];
    if (va === vb) continue;
    if (typeof va === 'object' && typeof vb === 'object' && JSON.stringify(va) === JSON.stringify(vb)) continue;
    if (va === undefined && vb === undefined) continue;
    return true;
  }
  return false;
}

/** Deduce el nombre de una acción comparando los objetos antes y después. */
export function describeChange(
  language: LanguageCode,
  before: readonly SceneObject[],
  after: readonly SceneObject[],
  groupsChanged: boolean,
): string {
  const beforeById = new Map(before.map((o) => [o.id, o]));
  const afterIds = new Set(after.map((o) => o.id));
  const added = after.filter((o) => !beforeById.has(o.id));
  const removed = before.filter((o) => !afterIds.has(o.id));
  const many = (count: number) => t(language, 'ux7.menu.objects', { count });
  if (added.length > 0 && removed.length > 0) {
    return t(language, 'rediseno.history.step.replace', { name: removed.length === 1 ? removed[0].name : many(removed.length) });
  }
  if (added.length > 0) {
    return added.length === 1
      ? t(language, 'rediseno.history.step.add', { name: added[0].name })
      : t(language, 'rediseno.history.step.addMany', { count: added.length });
  }
  if (removed.length > 0) {
    return removed.length === 1
      ? t(language, 'rediseno.history.step.remove', { name: removed[0].name })
      : t(language, 'rediseno.history.step.removeMany', { count: removed.length });
  }
  const kinds = new Set<string>();
  let changed: SceneObject[] = [];
  for (const o of after) {
    const prev = beforeById.get(o.id);
    if (!prev || prev === o) continue;
    const kind = prev.mesh !== o.mesh
      ? 'mesh'
      : differs(prev.position, o.position)
        ? 'move'
        : differs(prev.rotation, o.rotation)
          ? 'rotate'
          : differs(prev.scale, o.scale)
            ? 'scale'
            : propsDiffer(prev, o)
              ? 'props'
              : null;
    if (!kind) continue;
    changed = [...changed, o];
    kinds.add(kind);
  }
  if (changed.length === 0) {
    return t(language, groupsChanged ? 'rediseno.history.step.groups' : 'rediseno.history.step.other');
  }
  const name = changed.length === 1 ? changed[0].name : many(changed.length);
  if (kinds.size === 1) {
    const [kind] = [...kinds];
    return t(language, `rediseno.history.step.${kind}` as 'rediseno.history.step.move', { name });
  }
  return t(language, 'rediseno.history.step.many', { count: changed.length });
}

export interface HistoryTimelineEntry {
  /** Posición a la que se vuelve al elegirla: 0 = inicio, `past.length` = estado actual. */
  position: number;
  label: string;
  /** Deshecha (se puede rehacer). */
  undone: boolean;
  current: boolean;
}

/**
 * Lista del historial para el desplegable: «Inicio» y cada acción, de la más antigua a la más nueva.
 * Muestra como mucho `max` acciones (las más cercanas al final); `hidden` dice cuántas quedaron fuera.
 */
export function historyTimeline(
  language: LanguageCode,
  state: { past: readonly HistoryStep[]; future: readonly HistoryStep[]; objects: readonly SceneObject[]; groups: unknown },
  max = 50,
): { entries: HistoryTimelineEntry[]; hidden: number } {
  const { past, future, objects } = state;
  const total = past.length + future.length;
  const current = past.length;
  const label = (i: number): string => {
    // Acción i (1..total): de la posición i-1 a la i.
    const inPast = i <= past.length;
    const owner = inPast ? past[i - 1] : future[i - past.length - 1];
    const tag = tags.get(owner);
    if (tag) return repeatLabel(language, tag);
    if (isPaintDeltaStep(owner)) {
      const name = objects.find((o) => o.id === owner.objectId)?.name ?? '';
      return t(language, 'rediseno.history.step.paint', { name });
    }
    const beforeStep = inPast ? past[i - 1] : i - past.length - 2 >= 0 ? future[i - past.length - 2] : undefined;
    const afterStep = inPast ? past[i] : future[i - past.length - 1];
    const before = objectsOf(beforeStep, objects);
    const after = objectsOf(afterStep, objects);
    if (!before || !after) return t(language, 'rediseno.history.step.other');
    const groupsChanged = groupsOf(beforeStep, state.groups) !== groupsOf(afterStep, state.groups);
    return describeChange(language, before, after, groupsChanged);
  };
  const first = Math.max(1, Math.min(current, total - max + 1));
  const entries: HistoryTimelineEntry[] = [];
  if (first === 1) entries.push({ position: 0, label: t(language, 'rediseno.history.start'), undone: false, current: current === 0 });
  for (let i = first; i <= total; i += 1) {
    entries.push({ position: i, label: label(i), undone: i > current, current: i === current });
  }
  return { entries, hidden: first - 1 };
}
