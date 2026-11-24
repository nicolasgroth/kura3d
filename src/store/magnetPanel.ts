/**
 * @file src/store/magnetPanel.ts
 * @description Estado del panel «Alojamiento de imán»: abierto o no, el imán elegido (forma, medidas, holguras,
 * oculto), la cara bajo el cursor (vista previa) y la pared del último colocado. Abrir exige al menos una pieza
 * sólida (si no, avisa por qué). `placeMagnetAt` crea el negativo con el imán vigente; cada clic agrega otro.
 * Los preajustes propios viven en `useMagnetPresets` (preajustes de usuario genéricos, `userPresets.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { create } from 'zustand';
import { MAGNET_DEFAULTS, type MagnetParams } from '../core/addons/magnetPocket';
import { MAGNET_PRESET_KIND } from '../core/addons/magnetPresets';
import type { PocketWallReport } from '../core/addons/pocketWall';
import { isSolid } from '../core/scene/objectRole';
import { t } from '../i18n';
import { magnetWarnings, magnetWarningText, type MagnetWarning } from './magnetWarnings';
import type { Vec3 } from '../types/kura';
import { createUserPresetsStore } from './userPresets';
import { useKuraStore } from './useKuraStore';

export interface MagnetHover {
  hostId: string;
  point: Vec3;
  normal: Vec3;
}

export interface MagnetPanelState {
  open: boolean;
  params: MagnetParams;
  hover: MagnetHover | null;
  lastWall: PocketWallReport | null;
  /** Hay campos con medidas fuera de rango: no se coloca. */
  blocked: boolean;
}

export const useMagnetPanel = create<MagnetPanelState>(() => ({
  open: false, params: { ...MAGNET_DEFAULTS }, hover: null, lastWall: null, blocked: false,
}));

/** Preajustes de imán del usuario (guardados en preferencias locales). */
export const useMagnetPresets = createUserPresetsStore(MAGNET_PRESET_KIND);

/** Hay al menos una pieza sólida visible y sin bloquear donde colocar un alojamiento (las mismas que acepta la capa del visor). */
export function hasMagnetHost(): boolean {
  return useKuraStore.getState().objects.some((o) => isSolid(o) && o.visible && !o.locked);
}

/** Abre el panel; sin piezas sólidas no abre y avisa por qué. */
export function openMagnetPanel(): boolean {
  if (!hasMagnetHost()) {
    const store = useKuraStore.getState();
    store.addToast(t(store.language, 'magnet.needSolid'), 'info');
    return false;
  }
  useMagnetPanel.setState({ open: true, hover: null, lastWall: null });
  return true;
}

export function closeMagnetPanel(): void {
  setMagnetHover(null);
  useMagnetPanel.setState({ open: false, hover: null });
}

export function setMagnetParams(patch: Partial<MagnetParams>): void {
  useMagnetPanel.setState((s) => ({ params: { ...s.params, ...patch } }));
}

export function setMagnetBlocked(blocked: boolean): void {
  if (useMagnetPanel.getState().blocked !== blocked) useMagnetPanel.setState({ blocked });
}

/** Diferencia (mm o componente de normal) por debajo de la cual dos golpes del cursor son el mismo. */
export const MAGNET_HOVER_EPS = 1e-4;

const sameVec = (a: Vec3, b: Vec3) => Math.abs(a[0] - b[0]) <= MAGNET_HOVER_EPS && Math.abs(a[1] - b[1]) <= MAGNET_HOVER_EPS && Math.abs(a[2] - b[2]) <= MAGNET_HOVER_EPS;

/** Misma pieza, mismo punto y misma normal (con tolerancia): nada que escribir en el store. */
export function sameMagnetHover(a: MagnetHover | null, b: MagnetHover | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.hostId === b.hostId && sameVec(a.point, b.point) && sameVec(a.normal, b.normal);
}

let pendingHover: MagnetHover | null = null;
let hoverFrame: number | null = null;

function commitHover(hover: MagnetHover | null): void {
  if (!sameMagnetHover(useMagnetPanel.getState().hover, hover)) useMagnetPanel.setState({ hover });
}

/** Aplica ya el último punto pendiente (al cerrar, y en pruebas). */
export function flushMagnetHover(): void {
  if (hoverFrame !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(hoverFrame);
  hoverFrame = null;
  if (pendingHover) commitHover(pendingHover);
  pendingHover = null;
}

/**
 * Cara bajo el cursor. Solo escribe en el store si cambió (con tolerancia) y agrupa los movimientos de un mismo
 * cuadro en una escritura; `null` (el cursor salió) se aplica de inmediato y descarta lo pendiente.
 */
export function setMagnetHover(hover: MagnetHover | null): void {
  if (!hover || typeof requestAnimationFrame === 'undefined') {
    pendingHover = null;
    if (hoverFrame !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(hoverFrame);
    hoverFrame = null;
    commitHover(hover);
    return;
  }
  if (sameMagnetHover(pendingHover ?? useMagnetPanel.getState().hover, hover)) return;
  pendingHover = hover;
  if (hoverFrame !== null) return;
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = null;
    const next = pendingHover;
    pendingHover = null;
    if (next) commitHover(next);
  });
}

/** Con el panel abierto un clic en el visor coloca imanes: la pieza real no se selecciona ni se mueve. */
export function isMagnetPlacementActive(): boolean {
  return useMagnetPanel.getState().open;
}

/** Orden de gravedad de los avisos (de más a menos grave). */
const WARNING_RANK: readonly string[] = ['magnet.warn.through', 'magnet.warn.wall', 'magnet.warn.overlap', 'magnet.warn.near', 'magnet.warn.protrude'];

/** El aviso más grave de la lista (o null si está vacía). */
export function mostSevereMagnetWarning(warnings: readonly MagnetWarning[]): MagnetWarning | null {
  const rank = (w: MagnetWarning) => WARNING_RANK.indexOf(w.key);
  return [...warnings].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/**
 * Coloca un alojamiento con el imán vigente sobre la cara indicada. No altera la selección que había y deja un solo
 * aviso por colocación: «agregado» más la advertencia más grave (el detalle completo queda en el panel).
 */
/** Aviso de la última colocación que sigue a la vista (para reemplazarlo en la siguiente). */
let lastPlacementToastId: string | null = null;

export async function placeMagnetAt(hostId: string, point: Vec3, normal: Vec3): Promise<boolean> {
  const { params, blocked } = useMagnetPanel.getState();
  if (blocked) return false;
  const store = useKuraStore.getState();
  const selection = store.selectedIds;
  const knownToasts = new Set([...store.toasts.map((x) => x.id), ...store.toastHistory.map((x) => x.id)]);
  const result = await store.addMagnetPocket({ hostId, params, point, normal });
  const after = useKuraStore.getState();
  // Colocar no cambia lo que estaba seleccionado.
  if (after.selectedIds !== selection && (after.selectedIds.length !== selection.length || after.selectedIds.some((id, i) => id !== selection[i]))) {
    useKuraStore.setState({ selectedIds: selection });
  }
  if (!result) return false;
  // Un aviso por clic: se retiran los que emitió la colocación y se publica uno solo.
  const mine = (x: { id: string }) => !knownToasts.has(x.id);
  useKuraStore.setState((s) => ({ toasts: s.toasts.filter((x) => !mine(x)), toastHistory: s.toastHistory.filter((x) => !mine(x)) }));
  const warning = mostSevereMagnetWarning(magnetWarnings(result.wall, after.language));
  const created = t(after.language, 'magnet.created', { name: result.obj.name });
  // Al colocar varios seguidos, el aviso nuevo reemplaza al de la colocación anterior: apilados sobre el visor
  // tapaban la pieza y el siguiente clic caía en un aviso.
  const previous = lastPlacementToastId;
  if (previous) useKuraStore.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== previous) }));
  const before = new Set(useKuraStore.getState().toasts.map((x) => x.id));
  after.addToast(warning ? `${created} ${magnetWarningText(warning, after.language)}` : created, warning ? 'info' : 'success');
  lastPlacementToastId = useKuraStore.getState().toasts.find((x) => !before.has(x.id))?.id ?? null;
  useMagnetPanel.setState({ lastWall: result.wall });
  return true;
}
