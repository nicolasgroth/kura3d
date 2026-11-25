/**
 * @file src/store/keyholePanel.ts
 * @description Panel «Colgar en el muro» (ojo de cerradura): instancia del estado común de paneles de agregado
 * (`createAddonPanel`) con las medidas por defecto del tornillo de 4 mm, y los preajustes propios del usuario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { KeyholeParams } from '../core/addons/keyhole';
import type { KeyholeReport } from '../core/addons/keyholeAnalysis';
import { KEYHOLE_DEFAULTS, KEYHOLE_PRESET_KIND } from '../core/addons/keyholePresets';
import { t } from '../i18n';
import { createAddonPanel } from './addonPanelStore';
import { keyholeWarnings } from './keyholeWarnings';
import { createUserPresetsStore } from './userPresets';
import { useKuraStore } from './useKuraStore';

export const keyholePanel = createAddonPanel<KeyholeParams, KeyholeReport>({
  defaults: KEYHOLE_DEFAULTS,
  needSolidKey: 'keyhole.needSolid',
  placedKey: 'keyhole.placed',
  add: (request) => useKuraStore.getState().addKeyhole(request),
  shortWarning: (report, language) => {
    const [w] = keyholeWarnings(report, language);
    return w ? t(language, w.short) : null;
  },
});

export const useKeyholePanel = keyholePanel.usePanel;
export const openKeyholePanel = keyholePanel.open;
export const closeKeyholePanel = keyholePanel.close;

/** Preajustes de ojo de cerradura del usuario (guardados en preferencias locales). */
export const useKeyholePresets = createUserPresetsStore(KEYHOLE_PRESET_KIND);
