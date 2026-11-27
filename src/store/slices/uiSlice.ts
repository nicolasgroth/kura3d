/**
 * @file src/store/slices/uiSlice.ts
 * @description Slice de interfaz y preferencias: densidad y paneles, herramientas activas,
 * pincel y goma, cámara, plano de sección, informe de imprimibilidad, idioma, unidades, tema,
 * impresora, diálogos, paleta de comandos, vista previa de corte y toasts.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { TranslationKey } from '../../i18n';
import { makeId } from '../../core/scene/sceneObjects';
import { OPERATION_DEFAULTS } from '../../engine/operationLimits';
import { DEFAULT_PRINTER_PROFILES, PRINT_COLOR_PALETTE, THEME_PRESETS, type UiDensityMode } from '../../types/kura';
import {
  applyMetaColorScheme,
  applyThemePresetToDom,
  loadInitialColorScheme,
  loadInitialLanguage,
  loadInitialPrinterProfile,
  loadInitialThemePreset,
  loadInitialUiDensity,
  loadInitialUnits,
  STORAGE_COLOR_SCHEME_KEY,
  STORAGE_LANGUAGE_KEY,
  STORAGE_PRINTER_KEY,
  STORAGE_THEME_PRESET_KEY,
  STORAGE_UI_DENSITY_KEY,
  STORAGE_UNIT_KEY,
  writeStorage,
} from '../preferencesStorage';
import type { StoreContext } from '../storeContext';
import { takeSecondaryAction } from '../toastEnhancers';
import { findBedProfile, loadUserBedProfiles } from '../bedProfiles';
import type { KuraStoreState, ToastAction, ToastMessage } from '../storeTypes';
import { indexObjects, snapshotWatch, toastIsSticky } from '../toastActionState';
import { TOAST_HISTORY_MAX, toastBucket } from '../toastCenter';
import { projectPanelPinOf } from '../panelContext';
import { actionHasPanel } from '../actionsCatalog';
import { loadRightPanelCollapsed, saveRightPanelCollapsed } from '../rightPanelPrefs';

export function createUiSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr } = ctx;
  const initialScheme = loadInitialColorScheme();
  const initialThemePreset = loadInitialThemePreset();
  const initialDensity = loadInitialUiDensity();
  applyMetaColorScheme(initialScheme);
  applyThemePresetToDom(initialThemePreset);
  // Avisos con acción sobre objetos concretos que el usuario ya descartó: no vuelven a emerger por la misma causa
  // (quedan en el historial de «Avisos»). La clave incluye los objetos, así que un archivo nuevo sí avisa.
  const dismissedNoticeKeys = new Set<string>();
  const noticeKey = (x: Pick<ToastMessage, 'text' | 'kind' | 'action'>) =>
    x.kind !== 'error' && x.action?.targetIds?.length ? `${x.kind}|${x.text}|${[...x.action.targetIds].sort().join(',')}` : null;
  const sameObjects = (a?: readonly string[], b?: readonly string[]) => [...(a ?? [])].sort().join(',') === [...(b ?? [])].sort().join(',');
  const rememberDismissed = (list: readonly ToastMessage[]) => {
    for (const x of list) {
      const key = noticeKey(x);
      if (key) dismissedNoticeKeys.add(key);
    }
  };

  return {
    uiDensity: initialDensity,
    lastNonZenDensity: initialDensity === 'compact' ? 'compact' : 'full',
    rightCollapsed: loadRightPanelCollapsed(),

    activeTool: 'select',
    activeAction: null,
    transformMode: 'translate',
    transformFocus: null,
    proportionalScale: true,
    snapGridMm: 1,
    paintColor: PRINT_COLOR_PALETTE[1],
    paintRadiusMm: OPERATION_DEFAULTS.paint.brushRadiusMm,
    paintMode: 'brush',
    paintRefineEdge: true,
    eraseRadiusMm: 6,
    cameraRequest: null,

    sectionPlane: { enabled: false, heightMm: 25 },
    activePrintReport: null,
    printReportSource: null,
    showOverhangs: false,
    activeSegmentation: null,
    segmentationCreaseDeg: 28,
    hoveredRegionId: null,
    selectedRegionId: null,

    unitSystem: loadInitialUnits(),
    language: loadInitialLanguage(),
    colorScheme: initialScheme,
    themePreset: initialThemePreset,
    previewThemePreset: null,
    printerProfile: loadInitialPrinterProfile(loadUserBedProfiles()),
    customBedDimensions: null,

    activeDialog: null,
    settingsTab: 'ai',
    measuresRequest: null,
    commandPaletteOpen: false,
    cutPreview: {
      active: false,
      objectId: null,
      axis: 'y',
      offset: 0,
      connectorType: 'dowel',
      connectorSize: 4,
      connectorDepth: 6,
      connectorCount: 2,
      connectorCenters: [],
    },
    spawnedAtById: {},
    toasts: [],
    toastHistory: [],
    projectPanelPin: null,

    setUiDensity: (mode) => {
      if (mode !== 'zen') writeStorage(STORAGE_UI_DENSITY_KEY, mode);
      set((state) => ({ uiDensity: mode, lastNonZenDensity: mode === 'zen' ? state.lastNonZenDensity : mode }));
    },
    cycleUiDensity: () => {
      const current = get().uiDensity;
      const next: UiDensityMode = current === 'full' ? 'compact' : current === 'compact' ? 'zen' : 'full';
      get().setUiDensity(next);
    },
    toggleZenMode: () => {
      const { uiDensity, lastNonZenDensity } = get();
      get().setUiDensity(uiDensity === 'zen' ? lastNonZenDensity : 'zen');
    },
    toggleRightInspector: () => {
      const rightCollapsed = !get().rightCollapsed;
      saveRightPanelCollapsed(rightCollapsed);
      set({ rightCollapsed });
    },
    showProjectPanel: () => {
      if (get().rightCollapsed) saveRightPanelCollapsed(false);
      // La selección y la herramienta se conservan: el panel Proyecto queda fijado hasta que cambien.
      set({ projectPanelPin: projectPanelPinOf(get()), rightCollapsed: false });
    },
    setSectionPlane: (patch) => set((state) => ({ sectionPlane: { ...state.sectionPlane, ...patch } })),
    setShowOverhangs: (showOverhangs) => set({ showOverhangs }),
    clearPrintReport: () => set({ activePrintReport: null, printReportSource: null, showOverhangs: false }),

    setLanguage: (language) => {
      writeStorage(STORAGE_LANGUAGE_KEY, language);
      set({ language });
    },
    setUnitSystem: (unitSystem) => {
      writeStorage(STORAGE_UNIT_KEY, unitSystem);
      set({ unitSystem });
    },
    setColorScheme: (colorScheme) => {
      writeStorage(STORAGE_COLOR_SCHEME_KEY, colorScheme === 'system' ? null : colorScheme);
      applyMetaColorScheme(colorScheme);
      set({ colorScheme });
    },
    setThemePreset: (preset) => {
      if (!THEME_PRESETS.some((item) => item.id === preset)) return;
      writeStorage(STORAGE_THEME_PRESET_KEY, preset);
      applyThemePresetToDom(preset);
      set({ themePreset: preset, previewThemePreset: null });
      const themeName = tr(`theme.${preset}.name` as TranslationKey);
      get().addToast(tr('toast.themeApplied', { name: themeName }), 'success');
    },
    setPreviewThemePreset: (preset) => {
      applyThemePresetToDom(preset ?? get().themePreset);
      set({ previewThemePreset: preset });
    },
    syncColorSchemeFromDom: () => {
      const scheme = loadInitialColorScheme();
      const themePreset = loadInitialThemePreset();
      applyMetaColorScheme(scheme);
      applyThemePresetToDom(themePreset);
      set({ colorScheme: scheme, themePreset, previewThemePreset: null });
    },
    setPrinterProfile: (profileId) => {
      const found = findBedProfile(profileId, get().userBedProfiles ?? []);
      if (!found) return;
      writeStorage(STORAGE_PRINTER_KEY, found.id);
      set({ printerProfile: found });
    },

    setActiveTool: (activeTool) => {
      set({ activeTool, activeAction: null, transformFocus: null });
      if (activeTool === 'cut' && get().selectedIds.length > 0) set({ activeDialog: 'cut' });
    },
    setActiveAction: (activeAction) => {
      // Una acción con opciones propias abre el panel derecho si estaba plegado (lo recuerda así).
      if (activeAction && actionHasPanel(activeAction) && get().rightCollapsed) {
        saveRightPanelCollapsed(false);
        set({ activeAction, rightCollapsed: false });
        return;
      }
      set({ activeAction });
    },
    setTransformMode: (transformMode) => set({ transformMode }),
    setTransformFocus: (transformFocus) => set({ transformFocus }),
    setProportionalScale: (proportionalScale) => set({ proportionalScale }),
    toggleProportionalScale: () => set((state) => ({ proportionalScale: !state.proportionalScale })),
    setSnapGridMm: (snapGridMm) => set({ snapGridMm }),
    setSegmentationCreaseDeg: (segmentationCreaseDeg) => set({ segmentationCreaseDeg }),
    clearSegmentation: () => set({ activeSegmentation: null, hoveredRegionId: null, selectedRegionId: null }),
    setHoveredRegionId: (hoveredRegionId) => set({ hoveredRegionId }),
    setSelectedRegionId: (selectedRegionId) => set({ selectedRegionId }),
    setPaintSettings: (patch) => set((state) => ({ ...state, ...patch })),
    setEraseRadiusMm: (eraseRadiusMm) => set({ eraseRadiusMm }),
    requestCameraContain: (box) =>
      set((state) => ({ cameraRequest: { preset: 'ensure', nonce: (state.cameraRequest?.nonce ?? 0) + 1, box } })),
    requestCameraPreset: (preset, ids) =>
      set((state) => ({ cameraRequest: { preset, nonce: (state.cameraRequest?.nonce ?? 0) + 1, ...(ids ? { ids } : {}) } })),

    // Cerrar el panel de corte abierto desde la herramienta Cortar cierra también la herramienta: un solo nivel, un solo «Volver».
    setActiveDialog: (activeDialog) =>
      set((state) => (activeDialog === null && state.activeDialog === 'cut' && state.activeTool === 'cut' ? { activeDialog, activeTool: 'select' } : { activeDialog })),
    setSettingsTab: (settingsTab) => set({ settingsTab }),
    openSettings: (tab = 'appearance') => set({ settingsTab: tab, activeDialog: 'settings' }),
    requestMeasuresPopover: (focus = 'unit') =>
      set((state) => ({ measuresRequest: { nonce: (state.measuresRequest?.nonce ?? 0) + 1, focus } })),
    setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
    setCutPreview: (patch) => set((state) => ({ cutPreview: { ...state.cutPreview, ...patch } })),

    addToast: (text, kind = 'info', rawAction, options) => {
      const id = makeId('toast');
      const index = indexObjects(get().objects);
      const action = rawAction ? snapshotWatch(rawAction, index) : undefined;
      // Segunda acción: la pedida o la que un módulo dejó registrada para este texto (`toastEnhancers.ts`).
      const rawSecondary = options?.historyOnly ? options?.secondaryAction : options?.secondaryAction ?? takeSecondaryAction(text);
      const secondaryAction = rawSecondary ? snapshotWatch(rawSecondary, index) : undefined;
      const actions = [action, secondaryAction].filter((a): a is ToastAction => Boolean(a));
      // Histórico de la sesión (centro de mensajes): también lo que se mostró solo dentro de un diálogo, con sus
      // acciones operables. Un mensaje repetido (mismo texto y tipo) sube al más reciente en vez de duplicarse.
      const objectIds = options?.objectIds?.length ? options.objectIds : undefined;
      set((state) => ({
        toastHistory: [
          ...state.toastHistory.filter((x) => !(x.text === text && x.kind === kind && sameObjects(x.objectIds, objectIds))),
          { id, text, kind, at: Date.now(), ...(actions.length > 0 ? { actions } : {}), ...(objectIds ? { objectIds } : {}) },
        ].slice(-TOAST_HISTORY_MAX),
      }));
      if (options?.historyOnly) return null;
      const key = noticeKey({ text, kind, action });
      if (key && dismissedNoticeKeys.has(key)) return null;
      // Un solo emergente a la vista: el más reciente; el anterior ya está en el histórico. Excepción: un error o advertencia a la vista, y uno con una acción
      // vigente (Convertir en placas, Simplificar…) no lo desplaza un informativo o de éxito sin acción: ese va directo al
      // histórico. Sí lo desplazan errores, advertencias y otros mensajes con acción.
      const shown = get().toasts[0];
      const incomingPlain = kind !== 'error' && kind !== 'warning' && actions.length === 0;
      if (shown && incomingPlain && (shown.kind === 'error' || shown.kind === 'warning')) return id;
      if (shown && incomingPlain && toastIsSticky([shown.action, shown.secondaryAction].filter((a): a is ToastAction => Boolean(a)), indexObjects(get().objects))) return id;
      set({ toasts: [{ id, text, kind, ...(action ? { action } : {}), ...(secondaryAction ? { secondaryAction } : {}), ...(objectIds ? { objectIds } : {}) }] });
      // El cierre automático de los informativos lo temporiza `ToastItem` (con pausa al pasar el cursor o el foco);
      // errores y advertencias esperan a que el usuario los cierre.
      return id;
    },
    runToastAction: (id, action) => {
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
        toastHistory: state.toastHistory.map((x) => (x.id === id ? { ...x, applied: true } : x)),
      }));
      // Una acción que dejó de ser aplicable (p. ej. «Deshacer» de un paso que ya no es el último) no se ejecuta.
      if (action.applicable && !action.applicable()) return;
      action.run();
    },
    resetMessages: () => {
      dismissedNoticeKeys.clear();
      set({ toasts: [], toastHistory: [] });
    },
    dismissAllToasts: () => {
      rememberDismissed(get().toasts);
      set({ toasts: [] });
    },
    clearToastHistory: (bucket) =>
      set((state) => {
        const dropped = new Set(state.toastHistory.filter((x) => !bucket || toastBucket(x.kind) === bucket).map((x) => x.id));
        return { toastHistory: state.toastHistory.filter((x) => !dropped.has(x.id)), toasts: state.toasts.filter((x) => !dropped.has(x.id)) };
      }),
    removeToastHistoryEntry: (id) =>
      set((state) => ({ toastHistory: state.toastHistory.filter((x) => x.id !== id), toasts: state.toasts.filter((x) => x.id !== id) })),
    dismissErrorToasts: () => set((state) => (state.toasts.some((x) => x.kind === 'error') ? { toasts: state.toasts.filter((x) => x.kind !== 'error') } : state)),
    dismissToast: (id) => {
      rememberDismissed(get().toasts.filter((toast) => toast.id === id));
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    },
  };
}
