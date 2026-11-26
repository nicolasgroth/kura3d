/**
 * @file src/store/addonPanelStore.ts
 * @description Estado común del panel de un agregado que se coloca con clic sobre una cara (ojo de cerradura, paso
 * de cable): abierto o no, las medidas elegidas, la cara bajo el cursor (vista previa, por el canal agrupado de
 * `addonHover`), el informe de la última colocada y si hay campos inválidos. Abrir exige al menos una pieza sólida
 * (si no, avisa por qué). `placeAt` coloca con las medidas vigentes sin cambiar la selección (`addonPlacement.ts`) y deja
 * un solo aviso corto que reemplaza al de la colocación anterior. El informe se descarta si su pieza deja de existir.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { t, type TranslationKey } from '../i18n';
import type { LanguageCode, SceneObject, Vec3 } from '../types/kura';
import { createHoverChannel, type AddonHover } from './addonHover';
import { createPlacementToast, placeKeepingSelection } from './addonPlacement';
import { hasMagnetHost } from './magnetPanel';
import { useKuraStore } from './useKuraStore';

export interface AddonPanelState<P, R> {
  open: boolean;
  params: P;
  hover: AddonHover | null;
  lastReport: R | null;
  /** Pieza a la que pertenece `lastReport`. */
  lastObjectId: string | null;
  /** Hay campos con medidas fuera de rango: no se coloca. */
  blocked: boolean;
}

export interface AddonPanelConfig<P, R> {
  defaults: Readonly<P>;
  needSolidKey: TranslationKey;
  /** «{name} agregado.» */
  placedKey: TranslationKey;
  /** Coloca en silencio (lo implementa el slice del store). */
  add: (request: { hostId: string; params: P; point: Vec3; normal: Vec3; silent: true }) => Promise<{ object: SceneObject; report: R } | null>;
  /** Texto corto del aviso más grave, o null si no hay avisos. */
  shortWarning: (report: R, language: LanguageCode) => string | null;
}

export interface AddonPanel<P, R> {
  usePanel: UseBoundStore<StoreApi<AddonPanelState<P, R>>>;
  open: () => boolean;
  close: () => void;
  setParams: (patch: Partial<P>) => void;
  setBlocked: (blocked: boolean) => void;
  setHover: (hover: AddonHover | null) => void;
  flushHover: () => void;
  /** Con el panel abierto un clic en el visor coloca: la pieza real no se selecciona ni se mueve. */
  isActive: () => boolean;
  placeAt: (hostId: string, point: Vec3, normal: Vec3) => Promise<boolean>;
}

export function createAddonPanel<P extends object, R>(config: AddonPanelConfig<P, R>): AddonPanel<P, R> {
  const usePanel = create<AddonPanelState<P, R>>(() => ({
    open: false, params: { ...config.defaults }, hover: null, lastReport: null, lastObjectId: null, blocked: false,
  }));
  const hoverChannel = createHoverChannel(() => usePanel.getState().hover, (hover) => usePanel.setState({ hover }));
  const showPlacementToast = createPlacementToast();
  // El informe de la última colocación solo vale mientras esa pieza exista (deshacer o borrar lo descarta). La
  // suscripción al store vive solo mientras hay un informe que vigilar: se cancela al descartarlo.
  let unwatch: (() => void) | null = null;
  const forgetLast = () => {
    unwatch?.();
    unwatch = null;
  };
  const watchLastObject = (id: string) => {
    forgetLast();
    unwatch = useKuraStore.subscribe((state) => {
      if (state.objects.some((o) => o.id === id)) return;
      forgetLast();
      if (usePanel.getState().lastObjectId === id) usePanel.setState({ lastReport: null, lastObjectId: null });
    });
  };

  const panel: AddonPanel<P, R> = {
    usePanel,
    open: () => {
      if (!hasMagnetHost()) {
        const store = useKuraStore.getState();
        store.addToast(t(store.language, config.needSolidKey), 'info');
        return false;
      }
      forgetLast();
      usePanel.setState({ open: true, hover: null, lastReport: null, lastObjectId: null });
      return true;
    },
    close: () => {
      hoverChannel.set(null);
      forgetLast();
      usePanel.setState({ open: false, hover: null, lastReport: null, lastObjectId: null });
    },
    setParams: (patch) => usePanel.setState((s) => ({ params: { ...s.params, ...patch } })),
    setBlocked: (blocked) => {
      if (usePanel.getState().blocked !== blocked) usePanel.setState({ blocked });
    },
    setHover: (hover) => hoverChannel.set(hover),
    flushHover: () => hoverChannel.flush(),
    isActive: () => usePanel.getState().open,
    placeAt: async (hostId, point, normal) => {
      const { params, blocked } = usePanel.getState();
      if (blocked) return false;
      const result = await placeKeepingSelection(() => config.add({ hostId, params, point, normal, silent: true }), (r) => r.object.id);
      if (!result) return false;
      const { language } = useKuraStore.getState();
      const short = config.shortWarning(result.report, language);
      const placed = t(language, config.placedKey, { name: result.object.name });
      showPlacementToast(short ? `${placed} ${short}` : placed, short ? 'info' : 'success');
      usePanel.setState({ lastReport: result.report, lastObjectId: result.object.id });
      watchLastObject(result.object.id);
      return true;
    },
  };

  return panel;
}
