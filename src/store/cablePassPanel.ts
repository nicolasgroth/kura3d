/**
 * @file src/store/cablePassPanel.ts
 * @description Panel «Paso de cable»: instancia del estado común de paneles de agregado (`createAddonPanel`) con el
 * redondo de 5 mm por defecto, y los preajustes propios del usuario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { CablePassParams } from '../core/addons/cablePass';
import type { CablePassReport } from '../core/addons/cablePassAnalysis';
import { CABLE_PASS_DEFAULTS, CABLE_PASS_PRESET_KIND } from '../core/addons/cablePassPresets';
import { t } from '../i18n';
import { createAddonPanel } from './addonPanelStore';
import { cablePassWarnings } from './cablePassWarnings';
import { createUserPresetsStore } from './userPresets';
import { useKuraStore } from './useKuraStore';

export const cablePassPanel = createAddonPanel<CablePassParams, CablePassReport>({
  defaults: CABLE_PASS_DEFAULTS,
  needSolidKey: 'cable.needSolid',
  placedKey: 'cable.placed',
  add: (request) => useKuraStore.getState().addCablePass(request),
  shortWarning: (report, language) => {
    const [w] = cablePassWarnings(report, language);
    return w ? t(language, w.short) : null;
  },
});

export const useCablePassPanel = cablePassPanel.usePanel;
export const openCablePassPanel = cablePassPanel.open;
export const closeCablePassPanel = cablePassPanel.close;

/** Preajustes de paso de cable del usuario (guardados en preferencias locales). */
export const useCablePassPresets = createUserPresetsStore(CABLE_PASS_PRESET_KIND);
