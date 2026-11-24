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
}

export const useMagnetPanel = create<MagnetPanelState>(() => ({ open: false, params: { ...MAGNET_DEFAULTS }, hover: null, lastWall: null }));

/** Preajustes de imán del usuario (guardados en preferencias locales). */
export const useMagnetPresets = createUserPresetsStore(MAGNET_PRESET_KIND);

/** Hay al menos una pieza sólida visible donde colocar un alojamiento. */
export function hasMagnetHost(): boolean {
  return useKuraStore.getState().objects.some((o) => isSolid(o) && o.visible);
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
  useMagnetPanel.setState({ open: false, hover: null });
}

export function setMagnetParams(patch: Partial<MagnetParams>): void {
  useMagnetPanel.setState((s) => ({ params: { ...s.params, ...patch } }));
}

export function setMagnetHover(hover: MagnetHover | null): void {
  const prev = useMagnetPanel.getState().hover;
  if (prev === hover) return;
  useMagnetPanel.setState({ hover });
}

/** Coloca un alojamiento con el imán vigente sobre la cara indicada. */
export async function placeMagnetAt(hostId: string, point: Vec3, normal: Vec3): Promise<boolean> {
  const { params } = useMagnetPanel.getState();
  const result = await useKuraStore.getState().addMagnetPocket({ hostId, params, point, normal });
  if (!result) return false;
  useMagnetPanel.setState({ lastWall: result.wall });
  return true;
}
