/**
 * @file src/store/screwBossPanel.ts
 * @description Estado del panel «Torreta para tornillo»: abierto o no, la torreta elegida (tipo, medida, agujero,
 * alto y diámetro del poste), la cara bajo el cursor (vista previa) y el informe de la última colocada. Abrir exige
 * al menos una pieza sólida (si no, avisa por qué). `placeScrewBossAt` crea poste y agujero con la torreta vigente;
 * cada clic agrega otra, con un solo aviso corto que reemplaza al de la colocación anterior. La selección no cambia.
 * Los preajustes propios viven en `useScrewBossPresets` (preajustes de usuario genéricos, `userPresets.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { create } from 'zustand';
import type { ScrewBossParams } from '../core/addons/screwBoss';
import type { ScrewBossReport } from '../core/addons/screwBossAnalysis';
import { SCREW_BOSS_DEFAULTS, SCREW_BOSS_PRESET_KIND } from '../core/addons/screwBossPresets';
import { t } from '../i18n';
import type { Vec3 } from '../types/kura';
import { createHoverChannel, type AddonHover } from './addonHover';
import { hasMagnetHost } from './magnetPanel';
import { screwBossWarnings, screwBossWarningShortText } from './screwBossWarnings';
import { createUserPresetsStore } from './userPresets';
import { createPlacementToast, placeKeepingSelection } from './addonPlacement';
import { useKuraStore } from './useKuraStore';

export interface ScrewBossPanelState {
  open: boolean;
  params: ScrewBossParams;
  hover: AddonHover | null;
  lastReport: ScrewBossReport | null;
  /** Poste al que pertenece `lastReport`. */
  lastObjectId: string | null;
  /** Hay campos con medidas fuera de rango: no se coloca. */
  blocked: boolean;
}

export const useScrewBossPanel = create<ScrewBossPanelState>(() => ({
  open: false, params: { ...SCREW_BOSS_DEFAULTS }, hover: null, lastReport: null, lastObjectId: null, blocked: false,
}));

/** Preajustes de torreta del usuario (guardados en preferencias locales). */
export const useScrewBossPresets = createUserPresetsStore(SCREW_BOSS_PRESET_KIND);

const hoverChannel = createHoverChannel(() => useScrewBossPanel.getState().hover, (hover) => useScrewBossPanel.setState({ hover }));

export const setScrewBossHover = (hover: AddonHover | null): void => hoverChannel.set(hover);
export const flushScrewBossHover = (): void => hoverChannel.flush();

/** Abre el panel; sin piezas sólidas no abre y avisa por qué. */
export function openScrewBossPanel(): boolean {
  if (!hasMagnetHost()) {
    const store = useKuraStore.getState();
    store.addToast(t(store.language, 'turret.needSolid'), 'info');
    return false;
  }
  useScrewBossPanel.setState({ open: true, hover: null, lastReport: null, lastObjectId: null });
  return true;
}

export function closeScrewBossPanel(): void {
  setScrewBossHover(null);
  useScrewBossPanel.setState({ open: false, hover: null, lastReport: null, lastObjectId: null });
}

export function setScrewBossParams(patch: Partial<ScrewBossParams>): void {
  useScrewBossPanel.setState((s) => ({ params: { ...s.params, ...patch } }));
}

export function setScrewBossBlocked(blocked: boolean): void {
  if (useScrewBossPanel.getState().blocked !== blocked) useScrewBossPanel.setState({ blocked });
}

/** Con el panel abierto un clic en el visor coloca torretas: la pieza real no se selecciona ni se mueve. */
export function isScrewBossPlacementActive(): boolean {
  return useScrewBossPanel.getState().open;
}

/** Aviso de la colocación: el nuevo reemplaza al de la anterior. */
const showPlacementToast = createPlacementToast();

/** Coloca una torreta con las medidas vigentes sobre la cara indicada, sin cambiar la selección. */
export async function placeScrewBossAt(hostId: string, point: Vec3, normal: Vec3): Promise<boolean> {
  const { params, blocked } = useScrewBossPanel.getState();
  if (blocked) return false;
  const store = useKuraStore.getState();
  // Colocar no cambia lo que estaba seleccionado (salvo que el usuario lo cambie mientras corre el Worker).
  const result = await placeKeepingSelection(() => store.addScrewBoss({ hostId, params, point, normal, silent: true }), (r) => r.post.id);
  const after = useKuraStore.getState();
  if (!result) return false;
  const [warning] = screwBossWarnings(result.report, after.language);
  const placed = t(after.language, 'turret.placed', { name: result.post.name });
  showPlacementToast(warning ? `${placed} ${screwBossWarningShortText(warning, after.language)}` : placed, warning ? 'info' : 'success');
  useScrewBossPanel.setState({ lastReport: result.report, lastObjectId: result.post.id });
  return true;
}

// El informe de la última colocación solo vale mientras esa torreta exista (deshacer o borrar lo descarta). El panel
// es un único módulo de vida de la app: la suscripción no se cancela a propósito.
useKuraStore.subscribe((state) => {
  const { lastObjectId } = useScrewBossPanel.getState();
  if (lastObjectId && !state.objects.some((o) => o.id === lastObjectId)) useScrewBossPanel.setState({ lastReport: null, lastObjectId: null });
});
