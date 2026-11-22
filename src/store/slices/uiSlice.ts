/**
 * @file src/store/slices/uiSlice.ts
 * @description Slice de interfaz y preferencias: densidad y paneles, herramientas activas,
 * pincel y goma, cámara, plano de sección, informe de imprimibilidad, idioma, unidades, tema,
 * impresora, diálogos, paleta de comandos, vista previa de corte y toasts.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
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
import type { KuraStoreState } from '../storeTypes';

export function createUiSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr } = ctx;
  const initialScheme = loadInitialColorScheme();
  const initialThemePreset = loadInitialThemePreset();
  const initialDensity = loadInitialUiDensity();
  applyMetaColorScheme(initialScheme);
  applyThemePresetToDom(initialThemePreset);

  return {
    uiDensity: initialDensity,
    lastNonZenDensity: initialDensity === 'compact' ? 'compact' : 'full',
    leftCollapsed: false,
    rightCollapsed: false,

    activeTool: 'select',
    transformMode: 'translate',
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
    printerProfile: loadInitialPrinterProfile(),
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
    toggleLeftSidebar: () => set((state) => ({ leftCollapsed: !state.leftCollapsed })),
    toggleRightInspector: () => set((state) => ({ rightCollapsed: !state.rightCollapsed })),
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
      const found = DEFAULT_PRINTER_PROFILES.find((p) => p.id === profileId);
      if (!found) return;
      writeStorage(STORAGE_PRINTER_KEY, found.id);
      set({ printerProfile: found });
    },

    setActiveTool: (activeTool) => {
      set({ activeTool });
      if (activeTool === 'cut' && get().selectedIds.length > 0) set({ activeDialog: 'cut' });
    },
    setTransformMode: (transformMode) => set({ transformMode }),
    setProportionalScale: (proportionalScale) => set({ proportionalScale }),
    toggleProportionalScale: () => set((state) => ({ proportionalScale: !state.proportionalScale })),
    setSnapGridMm: (snapGridMm) => set({ snapGridMm }),
    setSegmentationCreaseDeg: (segmentationCreaseDeg) => set({ segmentationCreaseDeg }),
    clearSegmentation: () => set({ activeSegmentation: null, hoveredRegionId: null, selectedRegionId: null }),
    setHoveredRegionId: (hoveredRegionId) => set({ hoveredRegionId }),
    setSelectedRegionId: (selectedRegionId) => set({ selectedRegionId }),
    setPaintSettings: (patch) => set((state) => ({ ...state, ...patch })),
    setEraseRadiusMm: (eraseRadiusMm) => set({ eraseRadiusMm }),
    requestCameraPreset: (preset, ids) =>
      set((state) => ({ cameraRequest: { preset, nonce: (state.cameraRequest?.nonce ?? 0) + 1, ...(ids ? { ids } : {}) } })),

    setActiveDialog: (activeDialog) => set({ activeDialog }),
    setSettingsTab: (settingsTab) => set({ settingsTab }),
    openSettings: (tab = 'appearance') => set({ settingsTab: tab, activeDialog: 'settings' }),
    requestMeasuresPopover: (focus = 'unit') =>
      set((state) => ({ measuresRequest: { nonce: (state.measuresRequest?.nonce ?? 0) + 1, focus } })),
    setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
    setCutPreview: (patch) => set((state) => ({ cutPreview: { ...state.cutPreview, ...patch } })),

    addToast: (text, kind = 'info', action) => {
      const id = makeId('toast');
      set((state) => ({ toasts: [...state.toasts.slice(-4), { id, text, kind, ...(action ? { action } : {}) }] }));
      // Los errores y los avisos con acción permanecen más tiempo para poder leerse o usarse.
      setTimeout(() => get().dismissToast(id), kind === 'error' ? 12000 : action ? 9000 : 4200);
    },
    dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  };
}
