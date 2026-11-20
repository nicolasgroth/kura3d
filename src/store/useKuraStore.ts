/**
 * @file src/store/useKuraStore.ts
 * @description Store central Zustand de Kura3D: escena 3D, historial Undo/Redo (40 pasos),
 * herramientas activas, perfil de impresora, preferencias persistentes y Command Bus unificado
 * para UI, Servidor MCP y Chat IA.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { create } from 'zustand';
import * as engine from '../engine';
import { t, type TranslationKey } from '../i18n';
import {
  DEFAULT_PRINTER_PROFILES,
  PRINT_COLOR_PALETTE,
  type ActiveTool,
  type AiChatMessage,
  type AiConfig,
  type AiProviderType,
  type BooleanOpType,
  type ColorSchemePreference,
  type HollowOptions,
  type ImageTo3DOptions,
  type KuraCommandRequest,
  type KuraCommandResponse,
  type LanguageCode,
  type MeshData,
  type ObjectSourceType,
  type PlaneCutOptions,
  type PrimitiveParams,
  type PrimitiveType,
  type PrinterProfile,
  type SceneObject,
  type SvgImportOptions,
  type TextureOptions,
  type TransformMode,
  type UnitSystem,
  type Vec3,
} from '../types/kura';
import { captureViewportPng } from '../utils/mcpBridgeClient';
import { openLocalFile, saveBinaryFile } from '../utils/platformBridge';

const MAX_UNDO_HISTORY = 40;
const STORAGE_AI_CONFIG_KEY = 'kura3d-ai-config';
const STORAGE_COLOR_SCHEME_KEY = 'kura3d-color-scheme';
const STORAGE_LANGUAGE_KEY = 'kura3d-language';
const STORAGE_UNIT_KEY = 'kura3d-unit-system';
const STORAGE_PRINTER_KEY = 'kura3d-printer-id';

export type ActiveDialogType = 'svg' | 'image' | 'cut' | 'settings' | null;
export type PaintBrushMode = 'brush' | 'smart_fill' | 'whole';
export type CameraPresetType = 'iso' | 'top' | 'front' | 'right' | 'fit';

export interface ToastMessage {
  id: string;
  text: string;
  kind: 'info' | 'success' | 'error';
}

interface SceneSnapshot {
  objects: SceneObject[];
  selectedIds: string[];
}

export interface KuraStoreState {
  // Estado del motor geométrico
  engineReady: boolean;
  engineError: string | null;
  busyOperation: string | null;

  // Escena y selección
  objects: SceneObject[];
  selectedIds: string[];
  past: SceneSnapshot[];
  future: SceneSnapshot[];

  // Herramientas y viewport
  activeTool: ActiveTool;
  transformMode: TransformMode;
  snapGridMm: number;
  paintColor: string;
  paintRadiusMm: number;
  paintMode: PaintBrushMode;
  eraseRadiusMm: number;
  cameraRequest: { preset: CameraPresetType; nonce: number } | null;

  // Preferencias globales
  unitSystem: UnitSystem;
  language: LanguageCode;
  colorScheme: ColorSchemePreference;
  printerProfile: PrinterProfile;
  customBedDimensions: { width: number; depth: number; height: number } | null;

  // Puente MCP & Chat IA
  mcpConnected: boolean;
  aiDrawerOpen: boolean;
  aiConfig: AiConfig;
  aiMessages: AiChatMessage[];
  aiBusy: boolean;

  // UI auxiliar
  activeDialog: ActiveDialogType;
  toasts: ToastMessage[];

  // Acciones de inicialización y preferencias
  initEngine: () => Promise<void>;
  setLanguage: (lang: LanguageCode) => void;
  setUnitSystem: (unit: UnitSystem) => void;
  setColorScheme: (scheme: ColorSchemePreference) => void;
  syncColorSchemeFromDom: () => void;
  setPrinterProfile: (profileId: string) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setTransformMode: (mode: TransformMode) => void;
  setSnapGridMm: (snapMm: number) => void;
  setPaintSettings: (
    patch: Partial<{ paintColor: string; paintRadiusMm: number; paintMode: PaintBrushMode }>,
  ) => void;
  setEraseRadiusMm: (radiusMm: number) => void;
  requestCameraPreset: (preset: CameraPresetType) => void;
  setActiveDialog: (dialog: ActiveDialogType) => void;
  setAiDrawerOpen: (open: boolean) => void;
  setAiConfig: (patch: Partial<AiConfig>) => void;
  addAiMessage: (msg: Omit<AiChatMessage, 'id' | 'timestamp'>) => void;
  clearAiMessages: () => void;
  setAiBusy: (busy: boolean) => void;
  setMcpConnected: (connected: boolean) => void;
  addToast: (text: string, kind?: ToastMessage['kind']) => void;
  dismissToast: (id: string) => void;

  // Selección e historial
  selectObject: (id: string, additive?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  undo: () => void;
  redo: () => void;

  // Operaciones sobre escena y geometría
  createPrimitive: (
    type: PrimitiveType,
    params?: PrimitiveParams,
    options?: { name?: string; color?: string; position?: Vec3; isHole?: boolean },
  ) => Promise<SceneObject | null>;
  createStarterCube: () => Promise<void>;
  clearScene: () => void;
  updateObjectMeta: (
    id: string,
    patch: Partial<Pick<SceneObject, 'name' | 'color' | 'isHole' | 'visible' | 'locked'>>,
  ) => void;
  setObjectTransform: (
    id: string,
    patch: Partial<Pick<SceneObject, 'position' | 'rotation' | 'scale'>>,
    recordHistory?: boolean,
  ) => void;
  commitTransformSnapshot: () => void;
  dropObjectToBed: (id: string) => void;
  centerObjectOnBed: (id: string) => void;
  resetObjectOrientation: (id: string) => void;
  duplicateObjects: (ids?: string[]) => SceneObject[];
  deleteObjects: (ids?: string[]) => void;

  // Operaciones Manifold & Pintado
  runBooleanOnSelection: (op: BooleanOpType, targetId?: string, toolId?: string) => Promise<SceneObject | null>;
  applyHolesOnSolids: () => Promise<void>;
  hollowObject: (id: string, options: HollowOptions) => Promise<boolean>;
  planeCutObject: (id: string, options: PlaneCutOptions) => Promise<SceneObject[]>;
  splitDisconnectedObject: (id: string) => Promise<SceneObject[]>;
  splitObjectByColor: (id: string) => SceneObject[];
  applyTextureToObject: (id: string, options: TextureOptions) => boolean;
  paintObjectSurface: (
    id: string,
    localPoint: Vec3 | null,
    faceIndex: number | null,
    modeOverride?: PaintBrushMode,
  ) => void;
  eraseSphereOnObject: (id: string, worldCenter: Vec3, radiusMm?: number) => Promise<void>;

  // Importación / Exportación
  importSvgModel: (options: SvgImportOptions) => Promise<SceneObject | null>;
  generateImageRelief: (options: ImageTo3DOptions) => Promise<SceneObject | null>;
  importMeshFromDialog: () => Promise<void>;
  exportSceneStl: (onlySelected?: boolean) => Promise<boolean>;
  exportScene3mf: (onlySelected?: boolean) => Promise<boolean>;
  exportSelectedObj: () => Promise<boolean>;

  // Command Bus Unificado (UI, MCP y Chat IA)
  executeCommand: (req: KuraCommandRequest) => Promise<KuraCommandResponse>;
}

/** Generador de IDs cortos y únicos sin dependencias externas. */
function makeId(prefix = 'obj'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Clona un arreglo de objetos para instantáneas Undo/Redo compartiendo referencias inmutables de MeshData. */
function cloneSnapshot(objects: SceneObject[], selectedIds: string[]): SceneSnapshot {
  return {
    objects: objects.map((obj) => ({
      ...obj,
      position: [...obj.position] as Vec3,
      rotation: [...obj.rotation] as Vec3,
      scale: [...obj.scale] as Vec3,
      hollow: obj.hollow ? { ...obj.hollow } : undefined,
      texture: obj.texture ? { ...obj.texture } : undefined,
      stats: {
        ...obj.stats,
        dimensionsMm: [...obj.stats.dimensionsMm] as Vec3,
      },
    })),
    selectedIds: [...selectedIds],
  };
}

/** Calcula la altura mínima (minY) real de una malla en espacio de mundo aplicando rotación y escala. */
function computeTransformedMinY(
  mesh: MeshData,
  rotation: Vec3,
  scale: Vec3,
): number {
  const pos = mesh.positions;
  if (pos.length < 3) return 0;

  const euler = new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ');
  const quat = new THREE.Quaternion().setFromEuler(euler);
  const vec = new THREE.Vector3();

  let minY = Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    vec.set(pos[i] * scale[0], pos[i + 1] * scale[1], pos[i + 2] * scale[2]);
    vec.applyQuaternion(quat);
    if (vec.y < minY) minY = vec.y;
  }
  return Number.isFinite(minY) ? minY : 0;
}

/** Calcula la posición Y para apoyar el objeto exactamente sobre Y = 0 (evita -0). */
function computeBedPositionY(mesh: MeshData, rotation: Vec3, scale: Vec3): number {
  const minY = computeTransformedMinY(mesh, rotation, scale);
  return minY === 0 || Math.abs(minY) < 1e-12 ? 0 : -minY;
}

/** Convierte un Uint8Array a Base64 de forma segura tanto en navegador como en Node.js. */
function uint8ToBase64(bytes: Uint8Array): string {
  const globalBuf = (globalThis as { Buffer?: { from: (arr: Uint8Array) => { toString: (enc: string) => string } } }).Buffer;
  if (globalBuf) {
    return globalBuf.from(bytes).toString('base64');
  }
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/** Construye un SceneObject válido a partir de una malla calculando sus métricas Manifold. */
function buildSceneObject(params: {
  id?: string;
  name: string;
  source: ObjectSourceType;
  mesh: MeshData;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  color?: string;
  isHole?: boolean;
  primitiveType?: PrimitiveType;
  primitiveParams?: PrimitiveParams;
}): SceneObject {
  const rotation: Vec3 = params.rotation ?? [0, 0, 0];
  const scale: Vec3 = params.scale ?? [1, 1, 1];
  const stats = engine.computeMeshStats(params.mesh);
  const defaultY = computeBedPositionY(params.mesh, rotation, scale);

  return {
    id: params.id ?? makeId('mesh'),
    name: params.name,
    source: params.source,
    primitiveType: params.primitiveType,
    primitiveParams: params.primitiveParams,
    position: params.position ?? [0, defaultY, 0],
    rotation,
    scale,
    color: params.color ?? PRINT_COLOR_PALETTE[0],
    isHole: params.isHole ?? false,
    visible: true,
    locked: false,
    mesh: params.mesh,
    stats,
  };
}

/** Lee de forma segura preferencias desde localStorage sin lanzar errores en entornos restringidos. */
function readStorage(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Silenciar si el almacenamiento está bloqueado.
  }
}

/** Sincroniza el `<meta name="color-scheme">` del documento con la preferencia del usuario. */
function applyMetaColorScheme(scheme: ColorSchemePreference): void {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (!meta) return;
  meta.setAttribute('content', scheme === 'system' ? 'light dark' : scheme);
}

/** Carga configuración IA persistida localmente (nunca incluye claves precargadas). */
function loadInitialAiConfig(): AiConfig {
  const defaults: AiConfig = {
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-2.5-flash',
    baseUrl: '',
    temperature: 0.2,
  };
  const raw = readStorage(STORAGE_AI_CONFIG_KEY);
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    return {
      provider: parsed.provider ?? defaults.provider,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' && parsed.model ? parsed.model : defaults.model,
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
      temperature: typeof parsed.temperature === 'number' ? parsed.temperature : defaults.temperature,
    };
  } catch {
    return defaults;
  }
}

function loadInitialColorScheme(): ColorSchemePreference {
  const stored = readStorage(STORAGE_COLOR_SCHEME_KEY);
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return 'system';
}

function loadInitialLanguage(): LanguageCode {
  const stored = readStorage(STORAGE_LANGUAGE_KEY);
  return stored === 'en' ? 'en' : 'es';
}

function loadInitialUnits(): UnitSystem {
  const stored = readStorage(STORAGE_UNIT_KEY);
  if (stored === 'mm' || stored === 'cm' || stored === 'm' || stored === 'in' || stored === 'ft') {
    return stored;
  }
  return 'mm';
}

function loadInitialPrinterProfile(): PrinterProfile {
  const storedId = readStorage(STORAGE_PRINTER_KEY);
  const found = DEFAULT_PRINTER_PROFILES.find((p) => p.id === storedId);
  return found ?? DEFAULT_PRINTER_PROFILES[0];
}

/** Bandera para evitar doble inicialización concurrente del módulo WASM en React StrictMode. */
let engineInitPromise: Promise<void> | null = null;
/** Marca temporal para evitar guardar decenas de snapshots por segundo al pintar con arrastre. */
let lastPaintSnapshotAt = 0;
let transformSnapshotBeforeDrag: SceneSnapshot | null = null;

export const useKuraStore = create<KuraStoreState>((set, get) => {
  const initialLang = loadInitialLanguage();
  const initialScheme = loadInitialColorScheme();
  applyMetaColorScheme(initialScheme);

  /** Helper interno para registrar un paso Undo antes de mutar `objects`. */
  const pushHistory = () => {
    const state = get();
    const snap = cloneSnapshot(state.objects, state.selectedIds);
    const nextPast = [...state.past, snap].slice(-MAX_UNDO_HISTORY);
    set({ past: nextPast, future: [] });
  };

  /** Helper interno para traducir mensajes usando el idioma activo del store. */
  const tr = (key: TranslationKey, params?: Record<string, string | number>) =>
    t(get().language, key, params);

  return {
    engineReady: false,
    engineError: null,
    busyOperation: null,

    objects: [],
    selectedIds: [],
    past: [],
    future: [],

    activeTool: 'select',
    transformMode: 'translate',
    snapGridMm: 1,
    paintColor: PRINT_COLOR_PALETTE[1],
    paintRadiusMm: 5,
    paintMode: 'brush',
    eraseRadiusMm: 6,
    cameraRequest: null,

    unitSystem: loadInitialUnits(),
    language: initialLang,
    colorScheme: initialScheme,
    printerProfile: loadInitialPrinterProfile(),
    customBedDimensions: null,

    mcpConnected: false,
    aiDrawerOpen: false,
    aiConfig: loadInitialAiConfig(),
    aiMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: t(initialLang, 'ai.welcome'),
        timestamp: Date.now(),
      },
    ],
    aiBusy: false,

    activeDialog: null,
    toasts: [],

    initEngine: async () => {
      if (get().engineReady) return;
      if (engineInitPromise) return engineInitPromise;

      engineInitPromise = (async () => {
        try {
          await engine.initManifoldEngine();
          set({ engineReady: true, engineError: null });

          // Cargar un cubo de calibración Kura3D de 30×30×30 mm al iniciar si la escena está vacía
          if (get().objects.length === 0) {
            await get().createStarterCube();
          }
          get().addToast(tr('toast.engineReady'), 'success');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          set({ engineReady: false, engineError: message });
          get().addToast(tr('toast.errorPrefix', { message }), 'error');
        }
      })();

      return engineInitPromise;
    },

    setLanguage: (language) => {
      writeStorage(STORAGE_LANGUAGE_KEY, language);
      set({ language });
    },

    setUnitSystem: (unitSystem) => {
      writeStorage(STORAGE_UNIT_KEY, unitSystem);
      set({ unitSystem });
    },

    setColorScheme: (colorScheme) => {
      writeStorage(
        STORAGE_COLOR_SCHEME_KEY,
        colorScheme === 'system' ? null : colorScheme,
      );
      applyMetaColorScheme(colorScheme);
      set({ colorScheme });
    },

    syncColorSchemeFromDom: () => {
      const scheme = loadInitialColorScheme();
      applyMetaColorScheme(scheme);
      set({ colorScheme: scheme });
    },

    setPrinterProfile: (profileId) => {
      const found = DEFAULT_PRINTER_PROFILES.find((p) => p.id === profileId);
      if (!found) return;
      writeStorage(STORAGE_PRINTER_KEY, found.id);
      set({ printerProfile: found });
    },

    setActiveTool: (activeTool) => {
      set({ activeTool });
      if (activeTool === 'cut') {
        const selected = get().selectedIds;
        if (selected.length > 0) {
          set({ activeDialog: 'cut' });
        }
      }
    },

    setTransformMode: (transformMode) => set({ transformMode }),
    setSnapGridMm: (snapGridMm) => set({ snapGridMm }),
    setPaintSettings: (patch) => set((state) => ({ ...state, ...patch })),
    setEraseRadiusMm: (eraseRadiusMm) => set({ eraseRadiusMm }),

    requestCameraPreset: (preset) =>
      set((state) => ({
        cameraRequest: {
          preset,
          nonce: (state.cameraRequest?.nonce ?? 0) + 1,
        },
      })),

    setActiveDialog: (activeDialog) => set({ activeDialog }),
    setAiDrawerOpen: (aiDrawerOpen) => set({ aiDrawerOpen }),

    setAiConfig: (patch) =>
      set((state) => {
        const next: AiConfig = { ...state.aiConfig, ...patch };
        writeStorage(STORAGE_AI_CONFIG_KEY, JSON.stringify(next));
        return { aiConfig: next };
      }),

    addAiMessage: (msg) =>
      set((state) => ({
        aiMessages: [
          ...state.aiMessages,
          {
            ...msg,
            id: makeId('msg'),
            timestamp: Date.now(),
          },
        ],
      })),

    clearAiMessages: () =>
      set((state) => ({
        aiMessages: [
          {
            id: makeId('msg'),
            role: 'assistant',
            content: t(state.language, 'ai.welcome'),
            timestamp: Date.now(),
          },
        ],
      })),

    setAiBusy: (aiBusy) => set({ aiBusy }),
    setMcpConnected: (mcpConnected) => set({ mcpConnected }),

    addToast: (text, kind = 'info') => {
      const id = makeId('toast');
      set((state) => ({
        toasts: [...state.toasts.slice(-4), { id, text, kind }],
      }));
      setTimeout(() => {
        get().dismissToast(id);
      }, 4200);
    },

    dismissToast: (id) =>
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      })),

    selectObject: (id, additive = false) =>
      set((state) => {
        if (!additive) {
          return { selectedIds: [id] };
        }
        const exists = state.selectedIds.includes(id);
        return {
          selectedIds: exists
            ? state.selectedIds.filter((item) => item !== id)
            : [...state.selectedIds, id],
        };
      }),

    selectAll: () =>
      set((state) => ({
        selectedIds: state.objects.map((o) => o.id),
      })),

    clearSelection: () => set({ selectedIds: [] }),

    undo: () =>
      set((state) => {
        if (state.past.length === 0) return state;
        const previous = state.past[state.past.length - 1];
        const current = cloneSnapshot(state.objects, state.selectedIds);
        return {
          objects: previous.objects,
          selectedIds: previous.selectedIds,
          past: state.past.slice(0, -1),
          future: [current, ...state.future].slice(0, MAX_UNDO_HISTORY),
        };
      }),

    redo: () =>
      set((state) => {
        if (state.future.length === 0) return state;
        const next = state.future[0];
        const current = cloneSnapshot(state.objects, state.selectedIds);
        return {
          objects: next.objects,
          selectedIds: next.selectedIds,
          past: [...state.past, current].slice(-MAX_UNDO_HISTORY),
          future: state.future.slice(1),
        };
      }),

    createPrimitive: async (type, params, options) => {
      set({ busyOperation: type });
      try {
        await get().initEngine();
        const rawMesh = await engine.createPrimitiveMesh(type, params);
        const normalized = engine.normalizeMeshToBed(rawMesh);

        // Desplazar ligeramente cada nuevo objeto si ya hay otros en el origen
        const count = get().objects.length;
        const defaultColor =
          options?.color ?? PRINT_COLOR_PALETTE[count % PRINT_COLOR_PALETTE.length];
        const labelBase = tr(`sidebar.primitive.${type}` as TranslationKey);
        const name = options?.name ?? `${labelBase} ${count + 1}`;

        const obj = buildSceneObject({
          name,
          source: 'primitive',
          mesh: normalized,
          position: options?.position,
          color: defaultColor,
          isHole: options?.isHole,
          primitiveType: type,
          primitiveParams: params,
        });

        pushHistory();
        set((state) => ({
          objects: [...state.objects, obj],
          selectedIds: [obj.id],
        }));

        get().addToast(tr('toast.created', { name: obj.name }), 'success');
        return obj;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return null;
      } finally {
        set({ busyOperation: null });
      }
    },

    createStarterCube: async () => {
      try {
        const rawMesh = await engine.createPrimitiveMesh('box', {
          width: 30,
          height: 30,
          depth: 30,
        });
        const normalized = engine.normalizeMeshToBed(rawMesh);
        const cube = buildSceneObject({
          name: 'Cubo Kura3D 30mm',
          source: 'primitive',
          primitiveType: 'box',
          primitiveParams: { width: 30, height: 30, depth: 30 },
          mesh: normalized,
          color: PRINT_COLOR_PALETTE[0],
        });
        set({
          objects: [cube],
          selectedIds: [cube.id],
          past: [],
          future: [],
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set({ engineError: message });
      }
    },

    clearScene: () => {
      if (get().objects.length === 0) return;
      pushHistory();
      set({ objects: [], selectedIds: [] });
    },

    updateObjectMeta: (id, patch) => {
      pushHistory();
      set((state) => ({
        objects: state.objects.map((obj) => (obj.id === id ? { ...obj, ...patch } : obj)),
      }));
    },

    setObjectTransform: (id, patch, recordHistory = false) => {
      if (recordHistory) {
        pushHistory();
      } else if (!transformSnapshotBeforeDrag) {
        const s = get();
        transformSnapshotBeforeDrag = cloneSnapshot(s.objects, s.selectedIds);
      }

      set((state) => ({
        objects: state.objects.map((obj) => {
          if (obj.id !== id || obj.locked) return obj;
          return {
            ...obj,
            position: patch.position ?? obj.position,
            rotation: patch.rotation ?? obj.rotation,
            scale: patch.scale ?? obj.scale,
          };
        }),
      }));
    },

    commitTransformSnapshot: () => {
      if (!transformSnapshotBeforeDrag) return;
      const snap = transformSnapshotBeforeDrag;
      transformSnapshotBeforeDrag = null;
      set((state) => ({
        past: [...state.past, snap].slice(-MAX_UNDO_HISTORY),
        future: [],
      }));
    },

    dropObjectToBed: (id) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked) return;
      pushHistory();
      const targetY = computeBedPositionY(obj.mesh, obj.rotation, obj.scale);
      set((state) => ({
        objects: state.objects.map((item) =>
          item.id === id
            ? { ...item, position: [item.position[0], targetY, item.position[2]] }
            : item,
        ),
      }));
    },

    centerObjectOnBed: (id) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked) return;
      pushHistory();
      const targetY = computeBedPositionY(obj.mesh, obj.rotation, obj.scale);
      set((state) => ({
        objects: state.objects.map((item) =>
          item.id === id ? { ...item, position: [0, targetY, 0] } : item,
        ),
      }));
    },

    resetObjectOrientation: (id) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked) return;
      pushHistory();
      const rotation: Vec3 = [0, 0, 0];
      const scale: Vec3 = [1, 1, 1];
      const targetY = computeBedPositionY(obj.mesh, rotation, scale);
      set((state) => ({
        objects: state.objects.map((item) =>
          item.id === id
            ? {
                ...item,
                rotation,
                scale,
                position: [item.position[0], targetY, item.position[2]],
              }
            : item,
        ),
      }));
    },

    duplicateObjects: (ids) => {
      const targetIds = ids && ids.length > 0 ? ids : get().selectedIds;
      const sourceObjs = get().objects.filter((o) => targetIds.includes(o.id));
      if (sourceObjs.length === 0) return [];

      pushHistory();
      const created: SceneObject[] = sourceObjs.map((src) => ({
        ...src,
        id: makeId('mesh'),
        name: `${src.name} (copia)`,
        position: [src.position[0] + 15, src.position[1], src.position[2] + 15],
        rotation: [...src.rotation] as Vec3,
        scale: [...src.scale] as Vec3,
        stats: {
          ...src.stats,
          dimensionsMm: [...src.stats.dimensionsMm] as Vec3,
        },
      }));

      set((state) => ({
        objects: [...state.objects, ...created],
        selectedIds: created.map((c) => c.id),
      }));
      get().addToast(tr('toast.duplicated'), 'info');
      return created;
    },

    deleteObjects: (ids) => {
      const targetIds = ids && ids.length > 0 ? ids : get().selectedIds;
      if (targetIds.length === 0) return;

      const removableIds = new Set(
        get()
          .objects.filter((o) => targetIds.includes(o.id) && !o.locked)
          .map((o) => o.id),
      );
      if (removableIds.size === 0) return;

      pushHistory();
      set((state) => ({
        objects: state.objects.filter((o) => !removableIds.has(o.id)),
        selectedIds: state.selectedIds.filter((sid) => !removableIds.has(sid)),
      }));
      get().addToast(tr('toast.deleted'), 'info');
    },

    runBooleanOnSelection: async (op, explicitTargetId, explicitToolId) => {
      const { objects, selectedIds } = get();
      const firstId = explicitTargetId ?? selectedIds[0];
      const secondId = explicitToolId ?? selectedIds[1];

      const targetObj = objects.find((o) => o.id === firstId);
      const toolObj = objects.find((o) => o.id === secondId);
      if (!targetObj || !toolObj) return null;

      set({ busyOperation: `boolean:${op}` });
      try {
        // Si hay más de 2 seleccionados para unión o resta secuencial, encadenamos pares
        const extraIds =
          !explicitTargetId && !explicitToolId ? selectedIds.slice(2) : [];

        let currentTarget: SceneObject = targetObj;
        const firstRes = await engine.runBooleanOperation(currentTarget, toolObj, op);
        currentTarget = buildSceneObject({
          name: `${targetObj.name} [${op}]`,
          source: 'boolean',
          mesh: firstRes.mesh,
          position: firstRes.position,
          color: targetObj.color,
        });

        const consumedIds = new Set([targetObj.id, toolObj.id]);
        for (const nextId of extraIds) {
          const nextTool = objects.find((o) => o.id === nextId);
          if (!nextTool) continue;
          const stepRes = await engine.runBooleanOperation(currentTarget, nextTool, op);
          currentTarget = buildSceneObject({
            name: currentTarget.name,
            source: 'boolean',
            mesh: stepRes.mesh,
            position: stepRes.position,
            color: currentTarget.color,
          });
          consumedIds.add(nextTool.id);
        }

        pushHistory();
        set((state) => ({
          objects: [...state.objects.filter((o) => !consumedIds.has(o.id)), currentTarget],
          selectedIds: [currentTarget.id],
        }));

        get().addToast(tr('toast.booleanDone', { op }), 'success');
        return currentTarget;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return null;
      } finally {
        set({ busyOperation: null });
      }
    },

    applyHolesOnSolids: async () => {
      const { objects, selectedIds } = get();
      const scope =
        selectedIds.length >= 2
          ? objects.filter((o) => selectedIds.includes(o.id))
          : objects;

      const solids = scope.filter((o) => !o.isHole && o.visible);
      const holes = scope.filter((o) => o.isHole && o.visible);
      if (solids.length === 0 || holes.length === 0) return;

      set({ busyOperation: 'apply_holes' });
      try {
        const updatedSolids: SceneObject[] = [];
        for (const solid of solids) {
          let current = solid;
          for (const hole of holes) {
            const res = await engine.runBooleanOperation(current, hole, 'subtract');
            current = buildSceneObject({
              id: solid.id,
              name: solid.name,
              source: 'boolean',
              mesh: res.mesh,
              position: res.position,
              color: solid.color,
            });
          }
          updatedSolids.push(current);
        }

        const solidIds = new Set(solids.map((s) => s.id));
        const holeIds = new Set(holes.map((h) => h.id));

        pushHistory();
        set((state) => ({
          objects: [
            ...state.objects.filter((o) => !solidIds.has(o.id) && !holeIds.has(o.id)),
            ...updatedSolids,
          ],
          selectedIds: updatedSolids.map((s) => s.id),
        }));
        get().addToast(tr('toast.booleanDone', { op: 'subtract' }), 'success');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
      } finally {
        set({ busyOperation: null });
      }
    },

    hollowObject: async (id, options) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked) return false;

      set({ busyOperation: 'hollow' });
      try {
        const nextMesh = await engine.hollowMesh(obj, options);
        const stats = engine.computeMeshStats(nextMesh);

        pushHistory();
        set((state) => ({
          objects: state.objects.map((item) =>
            item.id === id
              ? {
                  ...item,
                  mesh: nextMesh,
                  hollow: { ...options },
                  stats,
                }
              : item,
          ),
        }));
        get().addToast(
          tr('toast.hollowDone', { thickness: options.wallThickness }),
          'success',
        );
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return false;
      } finally {
        set({ busyOperation: null });
      }
    },

    planeCutObject: async (id, options) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked) return [];

      set({ busyOperation: 'plane_cut' });
      try {
        const result = await engine.planeCutWithConnectors(obj, options);
        const created: SceneObject[] = [];

        if (result.positive) {
          created.push(
            buildSceneObject({
              name: `${obj.name} (+)`,
              source: 'cut_part',
              mesh: result.positive.mesh,
              position: result.positive.position,
              color: obj.color,
            }),
          );
        }

        if (result.negative) {
          created.push(
            buildSceneObject({
              name: `${obj.name} (-)`,
              source: 'cut_part',
              mesh: result.negative.mesh,
              position: result.negative.position,
              color: obj.color,
            }),
          );
        }

        if (created.length === 0) {
          return [];
        }

        pushHistory();
        set((state) => ({
          objects: [...state.objects.filter((o) => o.id !== id), ...created],
          selectedIds: created.map((c) => c.id),
        }));
        get().addToast(tr('toast.cutDone'), 'success');
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return [];
      } finally {
        set({ busyOperation: null });
      }
    },

    splitDisconnectedObject: async (id) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked) return [];

      set({ busyOperation: 'split_parts' });
      try {
        const parts = await engine.splitDisconnectedParts(obj);
        if (parts.length <= 1) {
          get().addToast(tr('toast.splitPartsDone', { count: parts.length }), 'info');
          return [obj];
        }

        const created = parts.map((part, idx) =>
          buildSceneObject({
            name: `${obj.name} #${idx + 1}`,
            source: 'cut_part',
            mesh: part.mesh,
            position: part.position,
            color: obj.color,
          }),
        );

        pushHistory();
        set((state) => ({
          objects: [...state.objects.filter((o) => o.id !== id), ...created],
          selectedIds: created.map((c) => c.id),
        }));
        get().addToast(tr('toast.splitPartsDone', { count: created.length }), 'success');
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return [];
      } finally {
        set({ busyOperation: null });
      }
    },

    splitObjectByColor: (id) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked) return [];

      try {
        const parts = engine.splitMeshByColor(obj);
        if (parts.length === 0) return [];

        const created = parts.map((part, idx) =>
          buildSceneObject({
            name: `${obj.name} (${part.color}) #${idx + 1}`,
            source: 'color_split',
            mesh: part.mesh,
            position: part.position,
            color: part.color,
          }),
        );

        pushHistory();
        set((state) => ({
          objects: [...state.objects.filter((o) => o.id !== id), ...created],
          selectedIds: created.map((c) => c.id),
        }));
        get().addToast(tr('toast.splitColorsDone', { count: created.length }), 'success');
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return [];
      }
    },

    applyTextureToObject: (id, options) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked) return false;

      try {
        const nextMesh = engine.applyProceduralTexture(obj.mesh, options);
        const stats = engine.computeMeshStats(nextMesh);

        pushHistory();
        set((state) => ({
          objects: state.objects.map((item) =>
            item.id === id
              ? {
                  ...item,
                  mesh: nextMesh,
                  texture: { ...options },
                  stats,
                }
              : item,
          ),
        }));
        get().addToast(
          tr('toast.textureDone', { pattern: options.pattern }),
          'success',
        );
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return false;
      }
    },

    paintObjectSurface: (id, localPoint, faceIndex, modeOverride) => {
      const state = get();
      const obj = state.objects.find((o) => o.id === id);
      if (!obj || obj.locked) return;

      const mode = modeOverride ?? state.paintMode;
      let nextMesh: MeshData;

      if (mode === 'whole') {
        nextMesh = engine.paintEntireMesh(obj.mesh, state.paintColor);
      } else if (mode === 'smart_fill' && faceIndex !== null) {
        nextMesh = engine.paintFloodFillConnectedFaces(
          obj.mesh,
          faceIndex,
          state.paintColor,
          35,
        );
      } else if (localPoint) {
        nextMesh = engine.paintMeshFacesInSphere(
          obj,
          localPoint,
          state.paintRadiusMm,
          state.paintColor,
        );
      } else {
        return;
      }

      // Agrupa trazos continuos de pincel dentro de 600ms para no saturar la pila Undo
      const now = Date.now();
      if (now - lastPaintSnapshotAt > 600) {
        lastPaintSnapshotAt = now;
        pushHistory();
      }

      set((prev) => ({
        objects: prev.objects.map((item) =>
          item.id === id ? { ...item, mesh: nextMesh } : item,
        ),
      }));
    },

    eraseSphereOnObject: async (id, worldCenter, radiusMm) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked) return;

      set({ busyOperation: 'erase' });
      try {
        const radius = radiusMm ?? get().eraseRadiusMm;
        const result = await engine.eraseRegionWithSphere(obj, worldCenter, radius);
        const stats = engine.computeMeshStats(result.mesh);

        pushHistory();
        set((state) => ({
          objects: state.objects.map((item) =>
            item.id === id
              ? {
                  ...item,
                  mesh: result.mesh,
                  position: result.position,
                  stats,
                }
              : item,
          ),
        }));
        get().addToast(tr('toast.erased'), 'success');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
      } finally {
        set({ busyOperation: null });
      }
    },

    importSvgModel: async (options) => {
      set({ busyOperation: 'import_svg' });
      try {
        await get().initEngine();
        const mesh = await engine.extrudeSvgToMesh(options);
        const normalized = engine.normalizeMeshToBed(mesh);
        const obj = buildSceneObject({
          name: options.name || 'SVG Extruido',
          source: 'svg',
          mesh: normalized,
          color: PRINT_COLOR_PALETTE[0],
        });

        pushHistory();
        set((state) => ({
          objects: [...state.objects, obj],
          selectedIds: [obj.id],
        }));
        get().addToast(tr('toast.imported', { name: obj.name }), 'success');
        return obj;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return null;
      } finally {
        set({ busyOperation: null });
      }
    },

    generateImageRelief: async (options) => {
      set({ busyOperation: 'image_to_3d' });
      try {
        await get().initEngine();
        const mesh = engine.generateReliefFromImage(options);
        const normalized = engine.normalizeMeshToBed(mesh);
        const obj = buildSceneObject({
          name: options.name || 'Relieve 3D',
          source: 'image',
          mesh: normalized,
          color: PRINT_COLOR_PALETTE[6],
        });

        pushHistory();
        set((state) => ({
          objects: [...state.objects, obj],
          selectedIds: [obj.id],
        }));
        get().addToast(tr('toast.created', { name: obj.name }), 'success');
        return obj;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return null;
      } finally {
        set({ busyOperation: null });
      }
    },

    importMeshFromDialog: async () => {
      const file = await openLocalFile('.stl,.3mf,.obj');
      if (!file) return;

      set({ busyOperation: 'import_mesh' });
      try {
        await get().initEngine();
        const lower = file.name.toLowerCase();
        const created: SceneObject[] = [];

        if (lower.endsWith('.3mf')) {
          const parts = engine.import3MFBuffer(file.buffer);
          for (const part of parts) {
            const normalized = engine.normalizeMeshToBed(part.mesh);
            created.push(
              buildSceneObject({
                name: part.name || file.name,
                source: 'imported',
                mesh: normalized,
                color: part.color || PRINT_COLOR_PALETTE[0],
              }),
            );
          }
        } else if (lower.endsWith('.obj')) {
          const text = new TextDecoder('utf-8').decode(file.buffer);
          const mesh = engine.importOBJText(text);
          const normalized = engine.normalizeMeshToBed(mesh);
          created.push(
            buildSceneObject({
              name: file.name.replace(/\.obj$/i, ''),
              source: 'imported',
              mesh: normalized,
              color: PRINT_COLOR_PALETTE[0],
            }),
          );
        } else {
          const mesh = engine.importSTLBuffer(file.buffer);
          const normalized = engine.normalizeMeshToBed(mesh);
          created.push(
            buildSceneObject({
              name: file.name.replace(/\.stl$/i, ''),
              source: 'imported',
              mesh: normalized,
              color: PRINT_COLOR_PALETTE[0],
            }),
          );
        }

        if (created.length > 0) {
          pushHistory();
          set((state) => ({
            objects: [...state.objects, ...created],
            selectedIds: created.map((c) => c.id),
          }));
          get().addToast(tr('toast.imported', { name: file.name }), 'success');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
      } finally {
        set({ busyOperation: null });
      }
    },

    exportSceneStl: async (onlySelected = false) => {
      const { objects, selectedIds } = get();
      const targetObjs =
        onlySelected && selectedIds.length > 0
          ? objects.filter((o) => selectedIds.includes(o.id) && o.visible)
          : objects.filter((o) => o.visible && !o.isHole);

      if (targetObjs.length === 0) {
        get().addToast(tr('toast.nothingToExport'), 'error');
        return false;
      }

      const bytes = engine.exportSceneToBinarySTL(targetObjs);
      const fileName =
        targetObjs.length === 1
          ? `${targetObjs[0].name.replace(/[^\w\-]+/g, '_')}.stl`
          : 'kura3d_escena.stl';

      const saved = await saveBinaryFile(fileName, bytes, [
        { name: 'STL Binary', extensions: ['stl'] },
      ]);
      if (saved) {
        get().addToast(tr('toast.exported', { name: fileName }), 'success');
      }
      return saved;
    },

    exportScene3mf: async (onlySelected = false) => {
      const { objects, selectedIds, unitSystem } = get();
      const targetObjs =
        onlySelected && selectedIds.length > 0
          ? objects.filter((o) => selectedIds.includes(o.id) && o.visible)
          : objects.filter((o) => o.visible && !o.isHole);

      if (targetObjs.length === 0) {
        get().addToast(tr('toast.nothingToExport'), 'error');
        return false;
      }

      const bytes = engine.exportSceneTo3MF(targetObjs, unitSystem);
      const fileName =
        targetObjs.length === 1
          ? `${targetObjs[0].name.replace(/[^\w\-]+/g, '_')}.3mf`
          : 'kura3d_escena.3mf';

      const saved = await saveBinaryFile(fileName, bytes, [
        { name: '3D Manufacturing Format', extensions: ['3mf'] },
      ]);
      if (saved) {
        get().addToast(tr('toast.exported', { name: fileName }), 'success');
      }
      return saved;
    },

    exportSelectedObj: async () => {
      const { objects, selectedIds } = get();
      const obj = objects.find((o) => o.id === selectedIds[0]) ?? objects[0];
      if (!obj) {
        get().addToast(tr('toast.nothingToExport'), 'error');
        return false;
      }
      const text = engine.exportMeshToOBJ(obj.mesh, obj.name);
      const bytes = new TextEncoder().encode(text);
      const fileName = `${obj.name.replace(/[^\w\-]+/g, '_')}.obj`;

      const saved = await saveBinaryFile(fileName, bytes, [
        { name: 'Wavefront OBJ', extensions: ['obj'] },
      ]);
      if (saved) {
        get().addToast(tr('toast.exported', { name: fileName }), 'success');
      }
      return saved;
    },

    executeCommand: async (req): Promise<KuraCommandResponse> => {
      const p = req.params ?? {};
      try {
        switch (req.command) {
          case 'get_scene_state': {
            const s = get();
            return {
              id: req.id,
              ok: true,
              result: {
                engineReady: s.engineReady,
                unitSystem: s.unitSystem,
                language: s.language,
                printerProfile: s.printerProfile,
                selectedIds: s.selectedIds,
                objects: s.objects.map((o) => ({
                  id: o.id,
                  name: o.name,
                  source: o.source,
                  primitiveType: o.primitiveType,
                  position: o.position,
                  rotation: o.rotation,
                  scale: o.scale,
                  color: o.color,
                  isHole: o.isHole,
                  visible: o.visible,
                  locked: o.locked,
                  stats: o.stats,
                })),
              },
            };
          }

          case 'create_primitive': {
            const type = ((p.type ?? p.primitiveType ?? 'box') as PrimitiveType);
            const nestedParams =
              p.params && typeof p.params === 'object'
                ? (p.params as PrimitiveParams)
                : {};
            const flatParams: PrimitiveParams = {
              ...(typeof p.width === 'number' ? { width: p.width } : {}),
              ...(typeof p.height === 'number' ? { height: p.height } : {}),
              ...(typeof p.depth === 'number' ? { depth: p.depth } : {}),
              ...(typeof p.radius === 'number' ? { radius: p.radius } : {}),
              ...(typeof p.outerRadius === 'number' ? { outerRadius: p.outerRadius } : {}),
              ...(typeof p.innerRadius === 'number' ? { innerRadius: p.innerRadius } : {}),
              ...(typeof p.tubeRadius === 'number' ? { tubeRadius: p.tubeRadius } : {}),
              ...(typeof p.segments === 'number' ? { segments: p.segments } : {}),
              ...(typeof p.sides === 'number' ? { sides: p.sides } : {}),
              ...(typeof p.text === 'string' ? { text: p.text } : {}),
              ...(typeof p.fontSize === 'number' ? { fontSize: p.fontSize } : {}),
              ...(typeof p.bevel === 'number' ? { bevel: p.bevel } : {}),
            };
            const params: PrimitiveParams = { ...nestedParams, ...flatParams };
            const created = await get().createPrimitive(type, params, {
              name: typeof p.name === 'string' ? p.name : undefined,
              color: typeof p.color === 'string' ? p.color : undefined,
              position: Array.isArray(p.position) ? (p.position as Vec3) : undefined,
              isHole: typeof p.isHole === 'boolean' ? p.isHole : undefined,
            });
            return {
              id: req.id,
              ok: Boolean(created),
              result: created ? { id: created.id, name: created.name, stats: created.stats } : null,
              error: created ? undefined : 'No se pudo crear la primitiva.',
            };
          }

          case 'transform_object': {
            const rawId = p.id ?? p.objectId;
            const targetId =
              (typeof rawId === 'string' && rawId) || get().selectedIds[0] || get().objects[0]?.id;
            if (!targetId) {
              return { id: req.id, ok: false, error: 'No hay objeto objetivo para transformar.' };
            }
            if (p.dropToBed === true) {
              get().dropObjectToBed(targetId);
            } else if (p.centerOnBed === true) {
              get().centerObjectOnBed(targetId);
            } else {
              get().setObjectTransform(
                targetId,
                {
                  position: Array.isArray(p.position) ? (p.position as Vec3) : undefined,
                  rotation: Array.isArray(p.rotation) ? (p.rotation as Vec3) : undefined,
                  scale: Array.isArray(p.scale) ? (p.scale as Vec3) : undefined,
                },
                true,
              );
            }
            const updated = get().objects.find((o) => o.id === targetId);
            return {
              id: req.id,
              ok: Boolean(updated),
              result: updated
                ? { id: updated.id, position: updated.position, rotation: updated.rotation, scale: updated.scale }
                : null,
            };
          }

          case 'delete_object': {
            const rawId = p.id ?? p.objectId;
            const ids = Array.isArray(p.ids)
              ? (p.ids as string[])
              : typeof rawId === 'string' && rawId
                ? [rawId]
                : undefined;
            get().deleteObjects(ids);
            return { id: req.id, ok: true, result: { deleted: ids ?? get().selectedIds } };
          }

          case 'duplicate_object': {
            const rawId = p.id ?? p.objectId;
            const ids = typeof rawId === 'string' && rawId ? [rawId] : undefined;
            const created = get().duplicateObjects(ids);
            return {
              id: req.id,
              ok: created.length > 0,
              result: created.map((c) => ({ id: c.id, name: c.name })),
            };
          }

          case 'boolean_operation': {
            const op = ((p.op ?? p.operation ?? 'union') as BooleanOpType);
            const rawTarget = p.targetId ?? p.id ?? p.objectId;
            const targetId = typeof rawTarget === 'string' && rawTarget ? rawTarget : undefined;
            const toolId =
              typeof p.toolId === 'string' && p.toolId
                ? p.toolId
                : Array.isArray(p.toolIds) && typeof p.toolIds[0] === 'string'
                  ? p.toolIds[0]
                  : undefined;
            const res = await get().runBooleanOnSelection(op, targetId, toolId);
            return {
              id: req.id,
              ok: Boolean(res),
              result: res ? { id: res.id, name: res.name, stats: res.stats } : null,
              error: res ? undefined : 'Se requieren al menos 2 objetos válidos para operación booleana.',
            };
          }

          case 'hollow_object': {
            const rawId = p.id ?? p.objectId;
            const targetId =
              (typeof rawId === 'string' && rawId) || get().selectedIds[0] || get().objects[0]?.id;
            if (!targetId) {
              return { id: req.id, ok: false, error: 'Selecciona o especifica un objeto para ahuecar.' };
            }
            const ok = await get().hollowObject(targetId, {
              enabled: true,
              wallThickness: typeof p.wallThickness === 'number' ? p.wallThickness : 2,
              drainHole: typeof p.drainHole === 'boolean' ? p.drainHole : false,
              drainHoleRadius: typeof p.drainHoleRadius === 'number' ? p.drainHoleRadius : 4,
            });
            return { id: req.id, ok, result: { id: targetId } };
          }

          case 'plane_cut': {
            const rawId = p.id ?? p.objectId;
            const targetId =
              (typeof rawId === 'string' && rawId) || get().selectedIds[0] || get().objects[0]?.id;
            if (!targetId) {
              return { id: req.id, ok: false, error: 'No hay objeto seleccionado para cortar.' };
            }
            const parts = await get().planeCutObject(targetId, {
              axis: (p.axis as 'x' | 'y' | 'z') || 'y',
              offset: typeof p.offset === 'number' ? p.offset : 0,
              connectorType: (p.connectorType as PlaneCutOptions['connectorType']) || 'dowel',
              connectorSize: typeof p.connectorSize === 'number' ? p.connectorSize : 4,
              connectorDepth: typeof p.connectorDepth === 'number' ? p.connectorDepth : 6,
              tolerance: typeof p.tolerance === 'number' ? p.tolerance : 0.25,
              connectorCount: typeof p.connectorCount === 'number' ? p.connectorCount : 2,
              keepMode: (p.keepMode as PlaneCutOptions['keepMode']) || 'both',
            });
            return {
              id: req.id,
              ok: parts.length > 0,
              result: parts.map((item) => ({ id: item.id, name: item.name })),
            };
          }

          case 'split_disconnected': {
            const rawId = p.id ?? p.objectId;
            const targetId =
              (typeof rawId === 'string' && rawId) || get().selectedIds[0] || get().objects[0]?.id;
            if (!targetId) {
              return { id: req.id, ok: false, error: 'No hay objeto seleccionado para separar.' };
            }
            const parts = await get().splitDisconnectedObject(targetId);
            return {
              id: req.id,
              ok: parts.length > 0,
              result: parts.map((item) => ({ id: item.id, name: item.name })),
            };
          }

          case 'split_by_color': {
            const rawId = p.id ?? p.objectId;
            const targetId =
              (typeof rawId === 'string' && rawId) || get().selectedIds[0] || get().objects[0]?.id;
            if (!targetId) {
              return { id: req.id, ok: false, error: 'No hay objeto seleccionado para separar por colores.' };
            }
            const parts = get().splitObjectByColor(targetId);
            return {
              id: req.id,
              ok: parts.length > 0,
              result: parts.map((item) => ({ id: item.id, name: item.name, color: item.color })),
            };
          }

          case 'apply_texture': {
            const rawId = p.id ?? p.objectId;
            const targetId =
              (typeof rawId === 'string' && rawId) || get().selectedIds[0] || get().objects[0]?.id;
            if (!targetId) {
              return { id: req.id, ok: false, error: 'No hay objeto seleccionado para texturizar.' };
            }
            const ok = get().applyTextureToObject(targetId, {
              pattern: (p.pattern as TextureOptions['pattern']) || 'fuzzy',
              depth: typeof p.depth === 'number' ? p.depth : 0.4,
              scale: typeof p.scale === 'number' ? p.scale : 4,
            });
            return { id: req.id, ok, result: { id: targetId } };
          }

          case 'paint_object': {
            const rawId = p.id ?? p.objectId;
            const targetId =
              (typeof rawId === 'string' && rawId) || get().selectedIds[0] || get().objects[0]?.id;
            if (!targetId) {
              return { id: req.id, ok: false, error: 'No hay objeto seleccionado para pintar.' };
            }
            const color = typeof p.color === 'string' ? p.color : get().paintColor;
            get().setPaintSettings({ paintColor: color });
            if (Array.isArray(p.localPoint)) {
              get().paintObjectSurface(targetId, p.localPoint as Vec3, null, 'brush');
            } else {
              get().paintObjectSurface(targetId, null, null, 'whole');
            }
            return { id: req.id, ok: true, result: { id: targetId, color } };
          }

          case 'import_svg': {
            const svgContent = typeof p.svgContent === 'string' ? p.svgContent : '';
            if (!svgContent.trim()) {
              return { id: req.id, ok: false, error: 'Falta svgContent.' };
            }
            const created = await get().importSvgModel({
              svgContent,
              name: typeof p.name === 'string' ? p.name : 'SVG',
              depth: typeof p.depth === 'number' ? p.depth : 6,
              targetWidth: typeof p.targetWidth === 'number' ? p.targetWidth : 60,
              curveSegments: typeof p.curveSegments === 'number' ? p.curveSegments : 12,
            });
            return {
              id: req.id,
              ok: Boolean(created),
              result: created ? { id: created.id, name: created.name } : null,
            };
          }

          case 'set_printer_profile': {
            const profileId = typeof p.profileId === 'string' ? p.profileId : '';
            get().setPrinterProfile(profileId);
            return { id: req.id, ok: true, result: get().printerProfile };
          }

          case 'set_unit_system': {
            const unit = (p.unit ?? p.unitSystem ?? p.units) as UnitSystem;
            if (unit === 'mm' || unit === 'cm' || unit === 'm' || unit === 'in' || unit === 'ft') {
              get().setUnitSystem(unit);
              return { id: req.id, ok: true, result: { unit } };
            }
            return { id: req.id, ok: false, error: 'Unidad inválida.' };
          }

          case 'export_stl': {
            const onlySelected = Boolean(p.onlySelected);
            if (p.returnBytes || p.outputPath || typeof document === 'undefined') {
              const { objects, selectedIds } = get();
              const targetObjs =
                onlySelected && selectedIds.length > 0
                  ? objects.filter((o) => selectedIds.includes(o.id) && o.visible)
                  : objects.filter((o) => o.visible && !o.isHole);
              if (targetObjs.length === 0) {
                return { id: req.id, ok: false, error: tr('toast.nothingToExport') };
              }
              const bytes = engine.exportSceneToBinarySTL(targetObjs);
              const triangleCount = targetObjs.reduce((acc, o) => acc + o.stats.triangles, 0);
              return {
                id: req.id,
                ok: true,
                result: {
                  format: 'stl',
                  bytesBase64: uint8ToBase64(bytes),
                  triangleCount,
                },
              };
            }
            const ok = await get().exportSceneStl(onlySelected);
            return { id: req.id, ok, result: { format: 'stl' } };
          }

          case 'export_3mf': {
            const onlySelected = Boolean(p.onlySelected);
            if (p.returnBytes || p.outputPath || typeof document === 'undefined') {
              const { objects, selectedIds, unitSystem } = get();
              const targetObjs =
                onlySelected && selectedIds.length > 0
                  ? objects.filter((o) => selectedIds.includes(o.id) && o.visible)
                  : objects.filter((o) => o.visible && !o.isHole);
              if (targetObjs.length === 0) {
                return { id: req.id, ok: false, error: tr('toast.nothingToExport') };
              }
              const bytes = engine.exportSceneTo3MF(targetObjs, unitSystem);
              const triangleCount = targetObjs.reduce((acc, o) => acc + o.stats.triangles, 0);
              return {
                id: req.id,
                ok: true,
                result: {
                  format: '3mf',
                  bytesBase64: uint8ToBase64(bytes),
                  triangleCount,
                },
              };
            }
            const ok = await get().exportScene3mf(onlySelected);
            return { id: req.id, ok, result: { format: '3mf' } };
          }

          case 'capture_viewport': {
            const dataUrl = captureViewportPng();
            if (!dataUrl) {
              return {
                id: req.id,
                ok: false,
                error: 'El visor WebGL aún no está listo para capturar.',
              };
            }
            const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            return {
              id: req.id,
              ok: true,
              result: {
                mimeType: 'image/png',
                base64,
                dataUrl,
              },
            };
          }

          default:
            return {
              id: req.id,
              ok: false,
              error: `Comando no soportado: ${String(req.command)}`,
            };
        }
      } catch (err) {
        return {
          id: req.id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
});
