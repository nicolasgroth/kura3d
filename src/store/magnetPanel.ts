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
import { MAGNET_DEFAULTS, MAGNET_RANGES, type MagnetParams } from '../core/addons/magnetPocket';
import { MAGNET_PRESET_KIND } from '../core/addons/magnetPresets';
import type { PocketWallReport } from '../core/addons/pocketWall';
import { isSolid } from '../core/scene/objectRole';
import { t } from '../i18n';
import { magnetWarnings, magnetWarningShortText, type MagnetWarning } from './magnetWarnings';
import type { Vec3 } from '../types/kura';
import { createUserPresetsStore } from './userPresets';
import { ADDON_HOVER_EPS, createHoverChannel, sameAddonHover, type AddonHover } from './addonHover';
import { createPlacementToast, placeKeepingSelection } from './addonPlacement';
import { useKuraStore } from './useKuraStore';

export type MagnetHover = AddonHover;

export interface MagnetPanelState {
  open: boolean;
  params: MagnetParams;
  hover: MagnetHover | null;
  lastWall: PocketWallReport | null;
  /** Imán al que pertenece `lastWall`. */
  lastObjectId: string | null;
  /** Hay campos con medidas fuera de rango: no se coloca. */
  blocked: boolean;
}

export const useMagnetPanel = create<MagnetPanelState>(() => ({
  open: false, params: { ...MAGNET_DEFAULTS }, hover: null, lastWall: null, lastObjectId: null, blocked: false,
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
  useMagnetPanel.setState({ open: true, hover: null, lastWall: null, lastObjectId: null });
  return true;
}

export function closeMagnetPanel(): void {
  setMagnetHover(null);
  useMagnetPanel.setState({ open: false, hover: null, lastWall: null, lastObjectId: null });
}

/** Ancho con que arranca un rectangular sin ancho (la mitad del largo, al menos el mínimo). */
export const rectDefaultWidth = (sizeMm: number) => Math.max(MAGNET_RANGES.widthMm.min, Math.round(sizeMm) / 2);

export function setMagnetParams(patch: Partial<MagnetParams>): void {
  useMagnetPanel.setState((s) => {
    const params = { ...s.params, ...patch };
    if (params.shape === 'rect' && params.widthMm === undefined) params.widthMm = rectDefaultWidth(params.sizeMm);
    return { params };
  });
}

export function setMagnetBlocked(blocked: boolean): void {
  if (useMagnetPanel.getState().blocked !== blocked) useMagnetPanel.setState({ blocked });
}

/** Diferencia (mm o componente de normal) por debajo de la cual dos golpes del cursor son el mismo. */
export const MAGNET_HOVER_EPS = ADDON_HOVER_EPS;

/** Misma pieza, mismo punto y misma normal (con tolerancia): nada que escribir en el store. */
export const sameMagnetHover = sameAddonHover;

const hoverChannel = createHoverChannel(() => useMagnetPanel.getState().hover, (hover) => useMagnetPanel.setState({ hover }));

/** Aplica ya el último punto pendiente (al cerrar, y en pruebas). */
export const flushMagnetHover = (): void => hoverChannel.flush();

/**
 * Cara bajo el cursor. Solo escribe en el store si cambió (con tolerancia) y agrupa los movimientos de un mismo
 * cuadro en una escritura; `null` (el cursor salió) se aplica de inmediato y descarta lo pendiente.
 */
export const setMagnetHover = (hover: MagnetHover | null): void => hoverChannel.set(hover);

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

/** Aviso de la colocación: el nuevo reemplaza al de la anterior. */
const showPlacementToast = createPlacementToast();

/**
 * Coloca un alojamiento con el imán vigente sobre la cara indicada. No altera la selección que había y deja un solo
 * aviso por colocación: «agregado» más la advertencia más grave (el detalle completo queda en el panel).
 */
export async function placeMagnetAt(hostId: string, point: Vec3, normal: Vec3): Promise<boolean> {
  const { params, blocked } = useMagnetPanel.getState();
  if (blocked) return false;
  const store = useKuraStore.getState();
  // Colocar no cambia lo que estaba seleccionado (salvo que el usuario lo cambie mientras corre el Worker).
  const result = await placeKeepingSelection(() => store.addMagnetPocket({ hostId, params, point, normal, silent: true }), (r) => r.obj.id);
  const after = useKuraStore.getState();
  if (!result) return false;
  // Un solo aviso, corto: «agregado» más la advertencia más grave resumida (el detalle queda en el panel).
  const warning = mostSevereMagnetWarning(magnetWarnings(result.wall, after.language));
  const placed = t(after.language, 'magnet.placed', { name: result.obj.name });
  showPlacementToast(warning ? `${placed} ${magnetWarningShortText(warning, after.language)}` : placed, warning ? 'info' : 'success');
  useMagnetPanel.setState({ lastWall: result.wall, lastObjectId: result.obj.id });
  return true;
}

// El resultado de la última colocación solo vale mientras ese imán exista (deshacer o borrar lo descarta). El panel
// es un único módulo de vida de la app: la suscripción no se cancela a propósito.
useKuraStore.subscribe((state) => {
  const { lastObjectId } = useMagnetPanel.getState();
  if (lastObjectId && !state.objects.some((o) => o.id === lastObjectId)) useMagnetPanel.setState({ lastWall: null, lastObjectId: null });
});
