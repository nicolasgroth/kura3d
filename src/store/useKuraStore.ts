/**
 * @file src/store/useKuraStore.ts
 * @description Store central Zustand de Kura3D Pro v3.0: escena 3D, historial Undo/Redo (40 pasos),
 * densidad adaptativa (Full/Compact/Zen), herramientas activas, materiales PBR, moldes, proyección
 * en superficies, roscas ISO, validador estructural, plano de sección en vivo, perfil de impresora
 * multi-marca, preferencias persistentes y Command Bus unificado para UI, Servidor MCP y Chat IA.
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
  type AlignMode,
  type BooleanOpType,
  type ColorSchemePreference,
  type CutPreviewState,
  type HollowOptions,
  type ImageTo3DOptions,
  type KuraCommandRequest,
  type KuraCommandResponse,
  type LanguageCode,
  type MaterialPresetId,
  type McpConfig,
  type MeshData,
  type MoldOptions,
  type ObjectSourceType,
  type PlaneCutOptions,
  type PrimitiveParams,
  type PrimitiveType,
  type PrintabilityReport,
  type PrinterProfile,
  type SceneObject,
  type SlicerTarget,
  type StructuralSegmentationResult,
  type SurfaceProjectionOptions,
  type SvgImportOptions,
  type TextureOptions,
  type ThreadOptions,
  type TransformMode,
  type UiDensityMode,
  type UnitSystem,
  type Vec3,
} from '../types/kura';
import { captureViewportPng } from '../utils/mcpBridgeClient';
import { openLocalFile, saveBinaryFile } from '../utils/platformBridge';

const MAX_UNDO_HISTORY = 40;
const STORAGE_AI_CONFIG_KEY = 'kura3d-ai-config';
const STORAGE_MCP_CONFIG_KEY = 'kura3d-mcp-config';
const STORAGE_COLOR_SCHEME_KEY = 'kura3d-color-scheme';
const STORAGE_LANGUAGE_KEY = 'kura3d-language';
const STORAGE_UNIT_KEY = 'kura3d-unit-system';
const STORAGE_PRINTER_KEY = 'kura3d-printer-id';
const STORAGE_UI_DENSITY_KEY = 'kura3d-ui-density';

export type ActiveDialogType =
  | 'svg'
  | 'image'
  | 'cut'
  | 'mold'
  | 'project'
  | 'thread'
  | 'export3mf'
  | 'settings'
  | 'shortcuts'
  | null;
export type SettingsTabType = 'ai' | 'mcp' | 'about';
export type CommandSourceType = 'ui' | 'mcp' | 'ai';
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

  // Densidad adaptativa de interfaz y visibilidad de paneles
  uiDensity: UiDensityMode;
  lastNonZenDensity: 'full' | 'compact';
  leftCollapsed: boolean;
  rightCollapsed: boolean;

  // Herramientas y viewport
  activeTool: ActiveTool;
  transformMode: TransformMode;
  proportionalScale: boolean;
  snapGridMm: number;
  paintColor: string;
  paintRadiusMm: number;
  paintMode: PaintBrushMode;
  eraseRadiusMm: number;
  cameraRequest: { preset: CameraPresetType; nonce: number } | null;

  // Plano de corte visual (Rayos X / Sección), Validador y Segmentación Estructural Local
  sectionPlane: { enabled: boolean; heightMm: number };
  activePrintReport: PrintabilityReport | null;
  showOverhangs: boolean;
  activeSegmentation: StructuralSegmentationResult | null;
  segmentationCreaseDeg: number;

  // Preferencias globales
  unitSystem: UnitSystem;
  language: LanguageCode;
  colorScheme: ColorSchemePreference;
  printerProfile: PrinterProfile;
  customBedDimensions: { width: number; depth: number; height: number } | null;

  // Puente MCP & Chat IA
  mcpConnected: boolean;
  mcpConfig: McpConfig;
  aiDrawerOpen: boolean;
  aiConfig: AiConfig;
  aiMessages: AiChatMessage[];
  aiBusy: boolean;

  // UI auxiliar, vista previa de corte y animaciones de creación
  activeDialog: ActiveDialogType;
  settingsTab: SettingsTabType;
  commandPaletteOpen: boolean;
  cutPreview: CutPreviewState;
  spawnedAtById: Record<string, number>;
  toasts: ToastMessage[];

  // Acciones de inicialización, densidad y preferencias
  initEngine: () => Promise<void>;
  setUiDensity: (mode: UiDensityMode) => void;
  cycleUiDensity: () => void;
  toggleZenMode: () => void;
  toggleLeftSidebar: () => void;
  toggleRightInspector: () => void;
  setSectionPlane: (patch: Partial<{ enabled: boolean; heightMm: number }>) => void;
  setShowOverhangs: (show: boolean) => void;
  clearPrintReport: () => void;
  setLanguage: (lang: LanguageCode) => void;
  setUnitSystem: (unit: UnitSystem) => void;
  setColorScheme: (scheme: ColorSchemePreference) => void;
  syncColorSchemeFromDom: () => void;
  setPrinterProfile: (profileId: string) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setTransformMode: (mode: TransformMode) => void;
  setProportionalScale: (locked: boolean) => void;
  toggleProportionalScale: () => void;
  setSnapGridMm: (snapMm: number) => void;
  setSegmentationCreaseDeg: (deg: number) => void;
  clearSegmentation: () => void;
  setPaintSettings: (
    patch: Partial<{ paintColor: string; paintRadiusMm: number; paintMode: PaintBrushMode }>,
  ) => void;
  setEraseRadiusMm: (radiusMm: number) => void;
  requestCameraPreset: (preset: CameraPresetType) => void;
  setActiveDialog: (dialog: ActiveDialogType) => void;
  setSettingsTab: (tab: SettingsTabType) => void;
  openSettings: (tab?: SettingsTabType) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setCutPreview: (patch: Partial<CutPreviewState>) => void;
  setAiDrawerOpen: (open: boolean) => void;
  setAiConfig: (patch: Partial<AiConfig>) => void;
  setMcpConfig: (patch: Partial<McpConfig>) => void;
  regenerateMcpToken: () => void;
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
    options?: {
      name?: string;
      color?: string;
      position?: Vec3;
      isHole?: boolean;
      materialPreset?: MaterialPresetId;
    },
  ) => Promise<SceneObject | null>;
  addSubtractHelperPrimitive: (
    type: 'sphere' | 'cylinder' | 'box',
    targetId?: string,
  ) => Promise<SceneObject | null>;
  addModularPrimitive: (
    type: PrimitiveType,
    mode: 'positive' | 'negative',
    targetId?: string,
  ) => Promise<SceneObject | null>;
  importModelAsModule: (
    file: { name: string; buffer: ArrayBuffer },
    mode: 'positive' | 'negative',
    targetId?: string,
  ) => Promise<SceneObject | null>;
  importModelAsModuleFromDialog: (
    mode: 'positive' | 'negative',
    targetId?: string,
  ) => Promise<SceneObject | null>;
  createStarterCube: () => Promise<void>;
  clearScene: () => void;
  updateObjectMeta: (
    id: string,
    patch: Partial<
      Pick<SceneObject, 'name' | 'color' | 'isHole' | 'visible' | 'locked' | 'materialPreset'>
    >,
  ) => void;
  setObjectMaterial: (id: string, materialPreset: MaterialPresetId) => void;
  setObjectTransform: (
    id: string,
    patch: Partial<Pick<SceneObject, 'position' | 'rotation' | 'scale'>>,
    recordHistory?: boolean,
  ) => void;
  commitTransformSnapshot: () => void;
  dropObjectToBed: (id: string) => void;
  centerObjectOnBed: (id: string) => void;
  resetObjectOrientation: (id: string) => void;
  nudgeSelectedObjects: (deltaMm: Vec3) => void;
  altCloneForDrag: (id: string) => SceneObject | null;
  mirrorObject: (id: string, axis: 'x' | 'y' | 'z') => boolean;
  duplicateObjects: (ids?: string[]) => SceneObject[];
  deleteObjects: (ids?: string[]) => void;

  // Operaciones Manifold, Pro Maker & Pintado
  runBooleanOnSelection: (
    op: BooleanOpType,
    targetId?: string,
    toolId?: string,
  ) => Promise<SceneObject | null>;
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

  // Nuevas capacidades Pro v3.0
  generateMoldForObject: (id: string, options: MoldOptions) => Promise<SceneObject[]>;
  projectOnObjectSurface: (
    id: string,
    options: SurfaceProjectionOptions,
  ) => Promise<SceneObject | null>;
  runPrintabilityCheck: (
    id: string,
    infillPercent?: number,
    overhangAngleDeg?: number,
  ) => PrintabilityReport | null;
  simplifySelectedMesh: (id: string, toleranceMm: number) => Promise<boolean>;
  refineSelectedMesh: (
    id: string,
    targetEdgeLengthMm: number,
    smooth?: boolean,
  ) => Promise<boolean>;
  runConvexHull: (ids?: string[]) => Promise<SceneObject | null>;
  createThreadObject: (options: ThreadOptions) => Promise<SceneObject | null>;
  alignSelectedObjects: (mode: AlignMode) => void;

  // Detección estructural local y separación de sub-partes (v4.0)
  detectObjectStructures: (
    id?: string,
    creaseAngleDeg?: number,
  ) => Promise<StructuralSegmentationResult | null>;
  colorizeDetectedStructures: (id?: string) => Promise<boolean>;
  extractDetectedStructure: (
    regionId: string,
    removeFromSource?: boolean,
  ) => Promise<SceneObject | null>;
  splitAllDetectedObjectStructures: (id?: string) => Promise<SceneObject[]>;

  // Importación / Exportación
  importSvgModel: (options: SvgImportOptions) => Promise<SceneObject | null>;
  generateImageRelief: (options: ImageTo3DOptions) => Promise<SceneObject | null>;
  importMeshFromDialog: () => Promise<void>;
  exportSceneStl: (onlySelected?: boolean) => Promise<boolean>;
  exportScene3mf: (onlySelected?: boolean, slicerTarget?: SlicerTarget) => Promise<boolean>;
  export3MFForSlicer: (slicerTarget?: SlicerTarget, onlySelected?: boolean) => Promise<boolean>;
  exportSelectedObj: () => Promise<boolean>;

  // Command Bus Unificado (UI, MCP y Chat IA)
  executeCommand: (
    req: KuraCommandRequest,
    source?: CommandSourceType,
  ) => Promise<KuraCommandResponse>;
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
  const globalBuf = (
    globalThis as { Buffer?: { from: (arr: Uint8Array) => { toString: (enc: string) => string } } }
  ).Buffer;
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
  materialPreset?: MaterialPresetId;
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
    materialPreset: params.materialPreset ?? 'pla_matte',
    isHole: params.isHole ?? false,
    visible: true,
    locked: false,
    mesh: params.mesh,
    stats,
  };
}

/** Calcula el centro geométrico local [cx, cy, cz] de una malla. */
function computeLocalMeshCenter(mesh: MeshData): Vec3 {
  const pos = mesh.positions;
  if (pos.length < 3) return [0, 0, 0];
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i];
    const y = pos[i + 1];
    const z = pos[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return [(minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5];
}

/** Calcula el centro mundial real de un objeto para posicionar módulos sobre él. */
function computeObjectWorldCenter(targetObj: SceneObject): Vec3 {
  const targetLocalCenter = computeLocalMeshCenter(targetObj.mesh);
  const targetVec = new THREE.Vector3(
    targetLocalCenter[0] * targetObj.scale[0],
    targetLocalCenter[1] * targetObj.scale[1],
    targetLocalCenter[2] * targetObj.scale[2],
  );
  const euler = new THREE.Euler(
    targetObj.rotation[0],
    targetObj.rotation[1],
    targetObj.rotation[2],
    'XYZ',
  );
  targetVec.applyEuler(euler);
  return [
    targetObj.position[0] + targetVec.x,
    targetObj.position[1] + targetVec.y,
    targetObj.position[2] + targetVec.z,
  ];
}

/** Parsea un archivo STL, 3MF u OBJ en mallas normalizadas listas para insertar en la escena. */
function parseModelBufferToMeshes(file: {
  name: string;
  buffer: ArrayBuffer;
}): Array<{ name: string; mesh: MeshData; color?: string }> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.3mf')) {
    const parts = engine.import3MFBuffer(file.buffer);
    return parts.map((part) => ({
      name: part.name || file.name.replace(/\.3mf$/i, ''),
      mesh: engine.normalizeMeshToBed(part.mesh),
      color: part.color,
    }));
  }
  if (lower.endsWith('.obj')) {
    const text = new TextDecoder('utf-8').decode(file.buffer);
    const mesh = engine.importOBJText(text);
    return [
      {
        name: file.name.replace(/\.obj$/i, ''),
        mesh: engine.normalizeMeshToBed(mesh),
      },
    ];
  }
  const mesh = engine.importSTLBuffer(file.buffer);
  return [
    {
      name: file.name.replace(/\.stl$/i, ''),
      mesh: engine.normalizeMeshToBed(mesh),
    },
  ];
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

/** Genera un token hexadecimal aleatorio seguro usando crypto.getRandomValues con fallback. */
export function generateRandomTokenHex(length = 32): string {
  const byteCount = Math.max(8, Math.ceil(length / 2));
  const bytes = new Uint8Array(byteCount);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteCount; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length);
}

/** Carga configuración MCP local persistida (desactivada y protegida por defecto). */
function loadInitialMcpConfig(): McpConfig {
  const defaults: McpConfig = {
    enabled: false,
    port: 17432,
    requireAuth: true,
    authToken: generateRandomTokenHex(32),
    readOnly: false,
  };
  const raw = readStorage(STORAGE_MCP_CONFIG_KEY);
  if (!raw) {
    writeStorage(STORAGE_MCP_CONFIG_KEY, JSON.stringify(defaults));
    return defaults;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<McpConfig>;
    const port =
      typeof parsed.port === 'number' && parsed.port >= 1024 && parsed.port <= 65535
        ? Math.round(parsed.port)
        : defaults.port;
    const token =
      typeof parsed.authToken === 'string' && parsed.authToken.trim().length >= 8
        ? parsed.authToken.trim()
        : defaults.authToken;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaults.enabled,
      port,
      requireAuth:
        typeof parsed.requireAuth === 'boolean' ? parsed.requireAuth : defaults.requireAuth,
      authToken: token,
      readOnly: typeof parsed.readOnly === 'boolean' ? parsed.readOnly : defaults.readOnly,
    };
  } catch {
    return defaults;
  }
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

function loadInitialUiDensity(): UiDensityMode {
  const stored = readStorage(STORAGE_UI_DENSITY_KEY);
  // Nunca restaurar en Zen tras recargar la página para que la interfaz sea siempre visible al abrir
  if (stored === 'compact') {
    return 'compact';
  }
  return 'full';
}

/** Bandera para evitar doble inicialización concurrente del módulo WASM en React StrictMode. */
let engineInitPromise: Promise<void> | null = null;
/** Marca temporal para evitar guardar decenas de snapshots por segundo al pintar con arrastre. */
let lastPaintSnapshotAt = 0;
let transformSnapshotBeforeDrag: SceneSnapshot | null = null;

export const useKuraStore = create<KuraStoreState>((set, get) => {
  const initialLang = loadInitialLanguage();
  const initialScheme = loadInitialColorScheme();
  const initialDensity = loadInitialUiDensity();
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

    uiDensity: initialDensity,
    lastNonZenDensity: initialDensity === 'compact' ? 'compact' : 'full',
    leftCollapsed: false,
    rightCollapsed: false,

    activeTool: 'select',
    transformMode: 'translate',
    proportionalScale: true,
    snapGridMm: 1,
    paintColor: PRINT_COLOR_PALETTE[1],
    paintRadiusMm: 5,
    paintMode: 'brush',
    eraseRadiusMm: 6,
    cameraRequest: null,

    sectionPlane: { enabled: false, heightMm: 25 },
    activePrintReport: null,
    showOverhangs: false,
    activeSegmentation: null,
    segmentationCreaseDeg: 28,

    unitSystem: loadInitialUnits(),
    language: initialLang,
    colorScheme: initialScheme,
    printerProfile: loadInitialPrinterProfile(),
    customBedDimensions: null,

    mcpConnected: false,
    mcpConfig: loadInitialMcpConfig(),
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
    settingsTab: 'ai',
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
    },
    spawnedAtById: {},
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

    setUiDensity: (mode) => {
      if (mode !== 'zen') {
        writeStorage(STORAGE_UI_DENSITY_KEY, mode);
      }
      set((state) => ({
        uiDensity: mode,
        lastNonZenDensity: mode === 'zen' ? state.lastNonZenDensity : mode,
      }));
    },

    cycleUiDensity: () => {
      const current = get().uiDensity;
      const next: UiDensityMode =
        current === 'full' ? 'compact' : current === 'compact' ? 'zen' : 'full';
      get().setUiDensity(next);
    },

    toggleZenMode: () => {
      const { uiDensity, lastNonZenDensity } = get();
      if (uiDensity === 'zen') {
        get().setUiDensity(lastNonZenDensity);
      } else {
        get().setUiDensity('zen');
      }
    },

    toggleLeftSidebar: () =>
      set((state) => ({ leftCollapsed: !state.leftCollapsed })),

    toggleRightInspector: () =>
      set((state) => ({ rightCollapsed: !state.rightCollapsed })),

    setSectionPlane: (patch) =>
      set((state) => ({
        sectionPlane: { ...state.sectionPlane, ...patch },
      })),

    setShowOverhangs: (showOverhangs) => set({ showOverhangs }),

    clearPrintReport: () => set({ activePrintReport: null, showOverhangs: false }),

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
    setProportionalScale: (proportionalScale) => set({ proportionalScale }),
    toggleProportionalScale: () =>
      set((state) => ({ proportionalScale: !state.proportionalScale })),
    setSnapGridMm: (snapGridMm) => set({ snapGridMm }),
    setSegmentationCreaseDeg: (segmentationCreaseDeg) => set({ segmentationCreaseDeg }),
    clearSegmentation: () => set({ activeSegmentation: null }),
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
    setSettingsTab: (settingsTab) => set({ settingsTab }),
    openSettings: (tab = 'ai') => set({ settingsTab: tab, activeDialog: 'settings' }),
    setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
    setCutPreview: (patch) =>
      set((state) => ({
        cutPreview: { ...state.cutPreview, ...patch },
      })),
    setAiDrawerOpen: (aiDrawerOpen) => set({ aiDrawerOpen }),

    setAiConfig: (patch) =>
      set((state) => {
        const next: AiConfig = { ...state.aiConfig, ...patch };
        writeStorage(STORAGE_AI_CONFIG_KEY, JSON.stringify(next));
        return { aiConfig: next };
      }),

    setMcpConfig: (patch) =>
      set((state) => {
        const nextPort =
          typeof patch.port === 'number' && Number.isFinite(patch.port)
            ? Math.min(65535, Math.max(1024, Math.round(patch.port)))
            : state.mcpConfig.port;
        const next: McpConfig = {
          ...state.mcpConfig,
          ...patch,
          port: nextPort,
        };
        writeStorage(STORAGE_MCP_CONFIG_KEY, JSON.stringify(next));
        return { mcpConfig: next };
      }),

    regenerateMcpToken: () =>
      set((state) => {
        const next: McpConfig = {
          ...state.mcpConfig,
          authToken: generateRandomTokenHex(32),
        };
        writeStorage(STORAGE_MCP_CONFIG_KEY, JSON.stringify(next));
        return { mcpConfig: next };
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
          materialPreset: options?.materialPreset,
          isHole: options?.isHole,
          primitiveType: type,
          primitiveParams: params,
        });

        pushHistory();
        const now = Date.now();
        set((state) => ({
          objects: [...state.objects, obj],
          selectedIds: [obj.id],
          spawnedAtById: { ...state.spawnedAtById, [obj.id]: now },
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

    addSubtractHelperPrimitive: async (type, targetId) => {
      return get().addModularPrimitive(type, 'negative', targetId);
    },

    addModularPrimitive: async (type, mode, targetId) => {
      const state = get();
      const targetObj =
        state.objects.find((o) => o.id === targetId) ??
        state.objects.find((o) => state.selectedIds.includes(o.id) && !o.isHole) ??
        state.objects.find((o) => !o.isHole) ??
        state.objects[0];

      const isHole = mode === 'negative';
      if (!targetObj) {
        return get().createPrimitive(type, undefined, { isHole });
      }

      set({ busyOperation: `modular_${mode}_${type}` });
      try {
        await get().initEngine();
        const scaledX = Math.max(4, targetObj.stats.dimensionsMm[0] * targetObj.scale[0]);
        const scaledY = Math.max(4, targetObj.stats.dimensionsMm[1] * targetObj.scale[1]);
        const scaledZ = Math.max(4, targetObj.stats.dimensionsMm[2] * targetObj.scale[2]);

        let params: PrimitiveParams;
        if (type === 'sphere') {
          const diameter = Math.max(4, Math.min(scaledX, scaledY, scaledZ) * 0.65);
          params = { radius: diameter * 0.5, segments: 28 };
        } else if (type === 'cylinder' || type === 'cone' || type === 'prism') {
          const diameter = Math.max(4, Math.min(scaledX, scaledZ) * 0.6);
          params = {
            radius: diameter * 0.5,
            height: Math.max(4, scaledY * 0.65),
            segments: 32,
            sides: 6,
          };
        } else if (type === 'tube') {
          const outer = Math.max(4, Math.min(scaledX, scaledZ) * 0.35);
          params = {
            outerRadius: outer,
            innerRadius: Math.max(1.5, outer * 0.6),
            height: Math.max(4, scaledY * 0.65),
            segments: 32,
          };
        } else if (type === 'torus') {
          const outer = Math.max(4, Math.min(scaledX, scaledZ) * 0.35);
          params = {
            outerRadius: outer,
            tubeRadius: Math.max(1.5, outer * 0.3),
            segments: 28,
          };
        } else if (type === 'text') {
          params = { text: 'KURA', fontSize: Math.max(6, scaledX * 0.32), height: Math.max(3, scaledY * 0.25) };
        } else {
          params = {
            width: Math.max(4, scaledX * 0.62),
            height: Math.max(4, scaledY * 0.62),
            depth: Math.max(4, scaledZ * 0.62),
          };
        }

        const rawMesh = await engine.createPrimitiveMesh(type, params);
        const normalized = engine.normalizeMeshToBed(rawMesh);

        const worldCenter = computeObjectWorldCenter(targetObj);
        const helperLocalCenter = computeLocalMeshCenter(normalized);
        // En modo positivo, apoyamos ligeramente encima o desplazado en Y para unirse al sólido
        const yOffset = mode === 'positive' ? scaledY * 0.35 : 0;
        const helperPos: Vec3 = [
          worldCenter[0] - helperLocalCenter[0],
          Math.max(0, worldCenter[1] - helperLocalCenter[1] + yOffset),
          worldCenter[2] - helperLocalCenter[2],
        ];

        const labelBase = tr(`sidebar.primitive.${type}` as TranslationKey);
        const prefix = isHole ? '−' : '+';
        const modObj = buildSceneObject({
          name: `${prefix} ${labelBase}`,
          source: 'primitive',
          mesh: normalized,
          position: helperPos,
          color: isHole ? '#f97316' : targetObj.color,
          materialPreset: targetObj.materialPreset,
          isHole,
          primitiveType: type,
          primitiveParams: params,
        });

        pushHistory();
        const now = Date.now();
        set((prev) => ({
          objects: [...prev.objects, modObj],
          selectedIds: isHole ? [modObj.id] : [targetObj.id, modObj.id],
          spawnedAtById: { ...prev.spawnedAtById, [modObj.id]: now },
        }));

        get().addToast(
          isHole
            ? tr('toast.subtractHelperCreated')
            : tr('toast.modularHelperCreated', { mode: '+', name: labelBase }),
          'info',
        );
        return modObj;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return null;
      } finally {
        set({ busyOperation: null });
      }
    },

    importModelAsModule: async (file, mode, targetId) => {
      set({ busyOperation: `import_module_${mode}` });
      try {
        await get().initEngine();
        const parsedParts = parseModelBufferToMeshes(file);
        if (parsedParts.length === 0) return null;

        const state = get();
        const targetObj =
          state.objects.find((o) => o.id === targetId) ??
          state.objects.find((o) => state.selectedIds.includes(o.id) && !o.isHole) ??
          state.objects.find((o) => !o.isHole) ??
          null;

        const isHole = mode === 'negative';
        const prefix = isHole ? '−' : '+';
        const created: SceneObject[] = [];

        for (const part of parsedParts) {
          let position: Vec3 | undefined;
          if (targetObj) {
            const worldCenter = computeObjectWorldCenter(targetObj);
            const modLocalCenter = computeLocalMeshCenter(part.mesh);
            position = [
              worldCenter[0] - modLocalCenter[0],
              Math.max(0, worldCenter[1] - modLocalCenter[1]),
              worldCenter[2] - modLocalCenter[2],
            ];
          }
          created.push(
            buildSceneObject({
              name: `${prefix} ${part.name}`,
              source: 'imported',
              mesh: part.mesh,
              position,
              color: isHole ? '#f97316' : part.color || PRINT_COLOR_PALETTE[0],
              isHole,
            }),
          );
        }

        pushHistory();
        const now = Date.now();
        const spawnedPatch: Record<string, number> = {};
        for (const c of created) spawnedPatch[c.id] = now;

        set((prev) => ({
          objects: [...prev.objects, ...created],
          selectedIds: isHole || !targetObj
            ? created.map((c) => c.id)
            : [targetObj.id, ...created.map((c) => c.id)],
          spawnedAtById: { ...prev.spawnedAtById, ...spawnedPatch },
        }));

        get().addToast(
          tr('toast.modularHelperCreated', {
            mode: prefix,
            name: created[0].name,
          }),
          'success',
        );
        return created[0];
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return null;
      } finally {
        set({ busyOperation: null });
      }
    },

    importModelAsModuleFromDialog: async (mode, targetId) => {
      const file = await openLocalFile('.stl,.3mf,.obj');
      if (!file) return null;
      return get().importModelAsModule(file, mode, targetId);
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
          materialPreset: 'pla_matte',
        });
        set({
          objects: [cube],
          selectedIds: [cube.id],
          past: [],
          future: [],
          activePrintReport: null,
          showOverhangs: false,
          activeSegmentation: null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set({ engineError: message });
      }
    },

    clearScene: () => {
      if (get().objects.length === 0) return;
      pushHistory();
      set({
        objects: [],
        selectedIds: [],
        activePrintReport: null,
        showOverhangs: false,
        activeSegmentation: null,
      });
    },

    updateObjectMeta: (id, patch) => {
      pushHistory();
      set((state) => ({
        objects: state.objects.map((obj) => (obj.id === id ? { ...obj, ...patch } : obj)),
      }));
    },

    setObjectMaterial: (id, materialPreset) => {
      pushHistory();
      set((state) => ({
        objects: state.objects.map((obj) =>
          obj.id === id ? { ...obj, materialPreset } : obj,
        ),
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
        activePrintReport:
          state.activePrintReport && removableIds.has(state.activePrintReport.objectId)
            ? null
            : state.activePrintReport,
        activeSegmentation:
          state.activeSegmentation && removableIds.has(state.activeSegmentation.objectId)
            ? null
            : state.activeSegmentation,
      }));
      get().addToast(tr('toast.deleted'), 'info');
    },

    nudgeSelectedObjects: (deltaMm) => {
      const { objects, selectedIds } = get();
      const targets = objects.filter((o) => selectedIds.includes(o.id) && !o.locked);
      if (targets.length === 0) return;
      const targetSet = new Set(targets.map((tObj) => tObj.id));
      pushHistory();
      set((state) => ({
        objects: state.objects.map((item) =>
          targetSet.has(item.id)
            ? {
                ...item,
                position: [
                  item.position[0] + deltaMm[0],
                  item.position[1] + deltaMm[1],
                  item.position[2] + deltaMm[2],
                ],
              }
            : item,
        ),
      }));
    },

    altCloneForDrag: (id) => {
      const s = get();
      const src = s.objects.find((o) => o.id === id);
      if (!src || src.locked) return null;

      // Guarda el estado previo al Alt-arrastre para que Ctrl+Z deshaga clonación y movimiento en un paso
      if (!transformSnapshotBeforeDrag) {
        transformSnapshotBeforeDrag = cloneSnapshot(s.objects, s.selectedIds);
      }

      // Inserta una copia estacionaria idéntica en su posición original y renombra la malla arrastrada como copia
      // Así TransformControls mantiene el puntero enganchado sin interrupciones a 60fps
      const stationaryOriginal: SceneObject = {
        ...src,
        id: makeId('mesh'),
        position: [...src.position] as Vec3,
        rotation: [...src.rotation] as Vec3,
        scale: [...src.scale] as Vec3,
        stats: {
          ...src.stats,
          dimensionsMm: [...src.stats.dimensionsMm] as Vec3,
        },
      };

      const cloneLabel = s.language === 'en' ? '(copy)' : '(copia)';
      const now = Date.now();
      set((state) => ({
        objects: [
          ...state.objects.map((o) =>
            o.id === id ? { ...o, name: `${src.name} ${cloneLabel}` } : o,
          ),
          stationaryOriginal,
        ],
        spawnedAtById: { ...state.spawnedAtById, [stationaryOriginal.id]: now },
      }));

      return get().objects.find((o) => o.id === id) ?? null;
    },

    mirrorObject: (id, axis) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked) return false;

      try {
        const mirroredMesh = engine.mirrorMeshAxis(obj.mesh, axis);
        const stats = engine.computeMeshStats(mirroredMesh);
        pushHistory();
        set((state) => ({
          objects: state.objects.map((item) =>
            item.id === id ? { ...item, mesh: mirroredMesh, stats } : item,
          ),
          activeSegmentation:
            state.activeSegmentation?.objectId === id ? null : state.activeSegmentation,
        }));
        get().addToast(tr('toast.mirrored', { axis: axis.toUpperCase() }), 'success');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return false;
      }
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
          materialPreset: targetObj.materialPreset,
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
            materialPreset: currentTarget.materialPreset,
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
          let current: SceneObject | null = solid;
          for (const hole of holes) {
            if (!current) break;
            try {
              const res = await engine.runBooleanOperation(current, hole, 'subtract');
              current = buildSceneObject({
                id: solid.id,
                name: solid.name,
                source: 'boolean',
                mesh: res.mesh,
                position: res.position,
                color: solid.color,
                materialPreset: solid.materialPreset,
              });
            } catch (subErr) {
              // Si un sólido queda totalmente contenido dentro de un hueco (malla vacía),
              // se elimina limpiamente sin abortar el resto del lote de sólidos.
              const msg = subErr instanceof Error ? subErr.message : String(subErr);
              if (/vac[ií]a|empty/i.test(msg)) {
                current = null;
                break;
              }
              throw subErr;
            }
          }
          if (current) {
            updatedSolids.push(current);
          }
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
              materialPreset: obj.materialPreset,
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
              materialPreset: obj.materialPreset,
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
            materialPreset: obj.materialPreset,
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
            materialPreset: obj.materialPreset,
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

    generateMoldForObject: async (id, options) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj) return [];

      set({ busyOperation: 'generate_mold' });
      try {
        await get().initEngine();
        const parts = await engine.generateMold(obj, options);
        if (parts.length === 0) return [];

        const created = parts.map((part) =>
          buildSceneObject({
            name: `${obj.name}${part.nameSuffix}`,
            source: 'mold',
            mesh: part.mesh,
            position: part.position,
            color: part.color,
            materialPreset: part.materialPreset,
          }),
        );

        pushHistory();
        const now = Date.now();
        const spawnedPatch: Record<string, number> = {};
        for (const c of created) spawnedPatch[c.id] = now;

        set((state) => ({
          objects: [...state.objects, ...created],
          selectedIds: created.map((c) => c.id),
          spawnedAtById: { ...state.spawnedAtById, ...spawnedPatch },
        }));
        get().addToast(tr('toast.moldDone', { count: created.length }), 'success');
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return [];
      } finally {
        set({ busyOperation: null });
      }
    },

    projectOnObjectSurface: async (id, options) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked) return null;

      set({ busyOperation: 'project_surface' });
      try {
        await get().initEngine();
        const res = await engine.projectGraphicOntoSurface(obj, options);
        const stats = engine.computeMeshStats(res.mesh);

        pushHistory();
        const updated: SceneObject = {
          ...obj,
          source: 'projected',
          mesh: res.mesh,
          position: res.position,
          stats,
        };

        set((state) => ({
          objects: state.objects.map((item) => (item.id === id ? updated : item)),
          selectedIds: [id],
        }));
        get().addToast(tr('toast.projectDone'), 'success');
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return null;
      } finally {
        set({ busyOperation: null });
      }
    },

    runPrintabilityCheck: (id, infillPercent = 18, overhangAngleDeg = 45) => {
      const { objects, printerProfile } = get();
      const obj = objects.find((o) => o.id === id);
      if (!obj) return null;

      try {
        const report = engine.analyzePrintability(
          obj,
          printerProfile,
          obj.materialPreset ?? 'pla_matte',
          infillPercent,
          overhangAngleDeg,
        );
        set({
          activePrintReport: report,
          showOverhangs: report.overhangFaceCount > 0,
        });
        get().addToast(
          tr('toast.printabilityDone', {
            score: report.score,
            weight: report.estimatedWeightGrams.toFixed(1),
          }),
          report.score >= 70 ? 'success' : 'info',
        );
        return report;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return null;
      }
    },

    simplifySelectedMesh: async (id, toleranceMm) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked) return false;

      set({ busyOperation: 'simplify' });
      try {
        await get().initEngine();
        const nextMesh = await engine.simplifyMesh(obj, toleranceMm);
        const stats = engine.computeMeshStats(nextMesh);

        pushHistory();
        set((state) => ({
          objects: state.objects.map((item) =>
            item.id === id ? { ...item, mesh: nextMesh, stats } : item,
          ),
        }));
        get().addToast(
          tr('toast.simplifyDone', { tris: stats.triangles.toLocaleString() }),
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

    refineSelectedMesh: async (id, targetEdgeLengthMm, smooth = false) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked) return false;

      set({ busyOperation: 'refine' });
      try {
        await get().initEngine();
        const nextMesh = await engine.refineMesh(obj, targetEdgeLengthMm, smooth);
        const stats = engine.computeMeshStats(nextMesh);

        pushHistory();
        set((state) => ({
          objects: state.objects.map((item) =>
            item.id === id ? { ...item, mesh: nextMesh, stats } : item,
          ),
        }));
        get().addToast(
          tr('toast.refineDone', { tris: stats.triangles.toLocaleString() }),
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

    runConvexHull: async (ids) => {
      const { objects, selectedIds } = get();
      const targetIds = ids && ids.length >= 2 ? ids : selectedIds;
      const targetObjs = objects.filter((o) => targetIds.includes(o.id));
      if (targetObjs.length === 0) return null;

      set({ busyOperation: 'convex_hull' });
      try {
        await get().initEngine();
        const res = await engine.computeConvexHull(targetObjs);
        const created = buildSceneObject({
          name: `Hull (${targetObjs.length})`,
          source: 'hull',
          mesh: res.mesh,
          position: res.position,
          color: targetObjs[0].color,
          materialPreset: targetObjs[0].materialPreset,
        });

        pushHistory();
        const now = Date.now();
        set((state) => ({
          objects: [...state.objects, created],
          selectedIds: [created.id],
          spawnedAtById: { ...state.spawnedAtById, [created.id]: now },
        }));
        get().addToast(tr('toast.hullDone'), 'success');
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return null;
      } finally {
        set({ busyOperation: null });
      }
    },

    createThreadObject: async (options) => {
      set({ busyOperation: 'create_thread' });
      try {
        await get().initEngine();
        const rawMesh = await engine.createMetricThread(options);
        const normalized = engine.normalizeMeshToBed(rawMesh);
        const isHole = options.kind === 'hole';
        const kindLabel =
          options.kind === 'bolt' ? 'Perno' : options.kind === 'nut' ? 'Tuerca' : '− Rosca';

        const existingCount = get().objects.length;
        const spawnX = existingCount > 0 ? Math.min(90, existingCount * 28) : 0;
        const obj = buildSceneObject({
          name: `${kindLabel} M${options.diameterMm}×${options.pitchMm}`,
          source: 'thread',
          mesh: normalized,
          position: [spawnX, 0, 0],
          color: isHole ? '#f97316' : '#94a3b8',
          materialPreset: isHole ? 'pla_matte' : 'metallic',
          isHole,
        });

        pushHistory();
        const now = Date.now();
        set((state) => ({
          objects: [...state.objects, obj],
          selectedIds: [obj.id],
          spawnedAtById: { ...state.spawnedAtById, [obj.id]: now },
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

    alignSelectedObjects: (mode) => {
      const { objects, selectedIds, printerProfile } = get();
      const targetObjs =
        mode === 'arrange_grid' && selectedIds.length < 2
          ? objects.filter((o) => o.visible && !o.locked)
          : objects.filter((o) => selectedIds.includes(o.id) && !o.locked);

      if (targetObjs.length === 0) return;

      const positions = engine.computeAlignmentPositions(
        targetObjs,
        mode,
        printerProfile,
      );
      pushHistory();
      set((state) => ({
        objects: state.objects.map((item) =>
          positions[item.id] ? { ...item, position: positions[item.id] } : item,
        ),
      }));
      get().addToast(tr('toast.alignedDone', { mode }), 'success');
    },

    detectObjectStructures: async (id, creaseAngleDeg) => {
      const state = get();
      const targetId = id ?? state.selectedIds[0] ?? state.objects[0]?.id;
      const obj = state.objects.find((o) => o.id === targetId);
      if (!obj) return null;

      const angle =
        typeof creaseAngleDeg === 'number' && Number.isFinite(creaseAngleDeg)
          ? creaseAngleDeg
          : state.segmentationCreaseDeg;

      set({ busyOperation: 'detect_structures', segmentationCreaseDeg: angle });
      try {
        await get().initEngine();
        const result = await engine.detectStructuralRegions(obj, {
          creaseAngleDeg: angle,
        });
        set({ activeSegmentation: result });
        get().addToast(
          tr('toast.structuresDetected', { count: result.regions.length }),
          'success',
        );
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return null;
      } finally {
        set({ busyOperation: null });
      }
    },

    colorizeDetectedStructures: async (id) => {
      const state = get();
      const targetId =
        id ?? state.activeSegmentation?.objectId ?? state.selectedIds[0] ?? state.objects[0]?.id;
      const obj = state.objects.find((o) => o.id === targetId);
      if (!obj || obj.locked) return false;

      let segmentation =
        state.activeSegmentation && state.activeSegmentation.objectId === obj.id
          ? state.activeSegmentation
          : null;
      if (!segmentation) {
        segmentation = await get().detectObjectStructures(obj.id);
      }
      if (!segmentation || segmentation.regions.length === 0) return false;

      try {
        const colorizedMesh = engine.applyStructureColorsToMesh(obj.mesh, segmentation);
        const stats = engine.computeMeshStats(colorizedMesh);
        pushHistory();
        set((prev) => ({
          objects: prev.objects.map((item) =>
            item.id === obj.id ? { ...item, mesh: colorizedMesh, stats } : item,
          ),
        }));
        get().addToast(
          tr('toast.structuresColorized', { count: segmentation.regions.length }),
          'success',
        );
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return false;
      }
    },

    extractDetectedStructure: async (regionId, removeFromSource = false) => {
      const state = get();
      const seg = state.activeSegmentation;
      if (!seg) return null;
      const obj = state.objects.find((o) => o.id === seg.objectId);
      if (!obj) return null;
      if (removeFromSource && obj.locked) return null;

      const region = seg.regions.find((r) => r.id === regionId);
      if (!region) return null;

      set({ busyOperation: 'extract_structure' });
      try {
        await get().initEngine();
        const res = await engine.extractStructuralRegion(obj, region, removeFromSource);
        const regionLabel = state.language === 'en' ? region.labelEn : region.labelEs;
        const extractedObj = buildSceneObject({
          name: `${obj.name} · ${regionLabel}`,
          source: 'segmented_part',
          mesh: res.extracted.mesh,
          position: res.extracted.position,
          color: region.color,
          materialPreset: obj.materialPreset,
        });

        pushHistory();
        const now = Date.now();

        if (removeFromSource) {
          if (res.remainder) {
            const remStats = engine.computeMeshStats(res.remainder.mesh);
            set((prev) => ({
              objects: [
                ...prev.objects.map((item) =>
                  item.id === obj.id
                    ? {
                        ...item,
                        mesh: res.remainder!.mesh,
                        position: res.remainder!.position,
                        stats: remStats,
                      }
                    : item,
                ),
                extractedObj,
              ],
              selectedIds: [extractedObj.id],
              activeSegmentation: null,
              spawnedAtById: { ...prev.spawnedAtById, [extractedObj.id]: now },
            }));
          } else {
            set((prev) => ({
              objects: [
                ...prev.objects.filter((item) => item.id !== obj.id),
                extractedObj,
              ],
              selectedIds: [extractedObj.id],
              activeSegmentation: null,
              spawnedAtById: { ...prev.spawnedAtById, [extractedObj.id]: now },
            }));
          }
        } else {
          set((prev) => ({
            objects: [...prev.objects, extractedObj],
            selectedIds: [extractedObj.id],
            spawnedAtById: { ...prev.spawnedAtById, [extractedObj.id]: now },
          }));
        }

        get().addToast(
          tr('toast.structureExtracted', { name: extractedObj.name }),
          'success',
        );
        return extractedObj;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return null;
      } finally {
        set({ busyOperation: null });
      }
    },

    splitAllDetectedObjectStructures: async (id) => {
      const state = get();
      const targetId =
        id ?? state.activeSegmentation?.objectId ?? state.selectedIds[0] ?? state.objects[0]?.id;
      const obj = state.objects.find((o) => o.id === targetId);
      if (!obj || obj.locked) return [];

      let segmentation =
        state.activeSegmentation && state.activeSegmentation.objectId === obj.id
          ? state.activeSegmentation
          : null;
      if (!segmentation) {
        segmentation = await get().detectObjectStructures(obj.id);
      }
      if (!segmentation || segmentation.regions.length === 0) return [];

      set({ busyOperation: 'split_structures' });
      try {
        await get().initEngine();
        const parts = await engine.splitAllDetectedStructures(obj, segmentation);
        if (parts.length === 0) return [];

        const created = parts.map((part) => {
          const label = get().language === 'en' ? part.labelEn : part.labelEs;
          return buildSceneObject({
            name: `${obj.name} · ${label}`,
            source: 'segmented_part',
            mesh: part.mesh,
            position: part.position,
            color: part.color,
            materialPreset: obj.materialPreset,
          });
        });

        pushHistory();
        const now = Date.now();
        const spawnedPatch: Record<string, number> = {};
        for (const c of created) spawnedPatch[c.id] = now;

        set((prev) => ({
          objects: [...prev.objects.filter((o) => o.id !== obj.id), ...created],
          selectedIds: created.map((c) => c.id),
          activeSegmentation: null,
          spawnedAtById: { ...prev.spawnedAtById, ...spawnedPatch },
        }));

        get().addToast(
          tr('toast.structuresSplitAll', { count: created.length }),
          'success',
        );
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(tr('toast.errorPrefix', { message }), 'error');
        return [];
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
        let mesh: MeshData;
        if (options.shapeMode === 'cylindrical') {
          mesh = engine.generateCylindricalLithophane(options);
        } else if (options.shapeMode === 'silhouette' || options.shapeMode === 'cutter') {
          mesh = await engine.generateSilhouetteOrCutterFromImage(options);
        } else {
          mesh = engine.generateReliefFromImage(options);
        }

        const normalized = engine.normalizeMeshToBed(mesh);
        const obj = buildSceneObject({
          name: options.name || 'Relieve 3D',
          source: 'image',
          mesh: normalized,
          color: PRINT_COLOR_PALETTE[6],
          materialPreset: options.shapeMode === 'cylindrical' || options.invert ? 'pla_matte' : 'pla_matte',
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
        const parsedParts = parseModelBufferToMeshes(file);
        const created = parsedParts.map((part) =>
          buildSceneObject({
            name: part.name,
            source: 'imported',
            mesh: part.mesh,
            color: part.color || PRINT_COLOR_PALETTE[0],
          }),
        );

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

    exportScene3mf: async (onlySelected = false, slicerTarget) => {
      const { objects, selectedIds, unitSystem, printerProfile } = get();
      const targetObjs =
        onlySelected && selectedIds.length > 0
          ? objects.filter((o) => selectedIds.includes(o.id) && o.visible)
          : objects.filter((o) => o.visible && !o.isHole);

      if (targetObjs.length === 0) {
        get().addToast(tr('toast.nothingToExport'), 'error');
        return false;
      }

      const resolvedSlicer = slicerTarget ?? printerProfile.brand;
      const bytes = engine.exportSceneTo3MF(targetObjs, unitSystem, resolvedSlicer);
      const fileName =
        targetObjs.length === 1
          ? `${targetObjs[0].name.replace(/[^\w\-]+/g, '_')}_${resolvedSlicer}.3mf`
          : `kura3d_escena_${resolvedSlicer}.3mf`;

      const saved = await saveBinaryFile(fileName, bytes, [
        { name: '3D Manufacturing Format', extensions: ['3mf'] },
      ]);
      if (saved) {
        get().addToast(tr('toast.exported', { name: fileName }), 'success');
      }
      return saved;
    },

    export3MFForSlicer: async (slicerTarget, onlySelected = false) => {
      return get().exportScene3mf(onlySelected, slicerTarget);
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

    executeCommand: async (req, source = 'ui'): Promise<KuraCommandResponse> => {
      if (
        source === 'mcp' &&
        get().mcpConfig.readOnly &&
        req.command !== 'get_scene_state' &&
        req.command !== 'capture_viewport' &&
        req.command !== 'analyze_printability' &&
        req.command !== 'detect_structures'
      ) {
        return {
          id: req.id,
          ok: false,
          error: 'MCP en modo solo lectura.',
        };
      }
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
                uiDensity: s.uiDensity,
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
                  materialPreset: o.materialPreset ?? 'pla_matte',
                  isHole: o.isHole,
                  visible: o.visible,
                  locked: o.locked,
                  stats: o.stats,
                })),
              },
            };
          }

          case 'create_primitive': {
            const type = (p.type ?? p.primitiveType ?? 'box') as PrimitiveType;
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
              materialPreset:
                typeof p.materialPreset === 'string'
                  ? (p.materialPreset as MaterialPresetId)
                  : undefined,
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
            const op = (p.op ?? p.operation ?? 'union') as BooleanOpType;
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

          case 'set_material': {
            const rawId = p.id ?? p.objectId;
            const targetId =
              (typeof rawId === 'string' && rawId) || get().selectedIds[0] || get().objects[0]?.id;
            if (!targetId) {
              return { id: req.id, ok: false, error: 'No hay objeto seleccionado para asignar material.' };
            }
            const materialPreset = (p.materialPreset ?? p.material ?? 'pla_matte') as MaterialPresetId;
            get().setObjectMaterial(targetId, materialPreset);
            return { id: req.id, ok: true, result: { id: targetId, materialPreset } };
          }

          case 'generate_mold': {
            const rawId = p.id ?? p.objectId;
            const targetId =
              (typeof rawId === 'string' && rawId) || get().selectedIds[0] || get().objects[0]?.id;
            if (!targetId) {
              return { id: req.id, ok: false, error: 'No hay objeto seleccionado para generar molde.' };
            }
            const created = await get().generateMoldForObject(targetId, {
              mode: (p.mode as MoldOptions['mode']) || 'silicone_master',
              wallMarginMm: typeof p.wallMarginMm === 'number' ? p.wallMarginMm : 6,
              boxWallMm: typeof p.boxWallMm === 'number' ? p.boxWallMm : 3,
              splitAxis: p.splitAxis === 'z' ? 'z' : 'x',
              pourSpout: typeof p.pourSpout === 'boolean' ? p.pourSpout : true,
              pourSpoutRadiusMm: typeof p.pourSpoutRadiusMm === 'number' ? p.pourSpoutRadiusMm : 5,
              keyToleranceMm: typeof p.keyToleranceMm === 'number' ? p.keyToleranceMm : 0.25,
              cavityWallMm: typeof p.cavityWallMm === 'number' ? p.cavityWallMm : 3,
            });
            return {
              id: req.id,
              ok: created.length > 0,
              result: created.map((c) => ({ id: c.id, name: c.name })),
            };
          }

          case 'project_on_surface': {
            const rawId = p.id ?? p.objectId;
            const targetId =
              (typeof rawId === 'string' && rawId) || get().selectedIds[0] || get().objects[0]?.id;
            if (!targetId) {
              return { id: req.id, ok: false, error: 'No hay objeto seleccionado para proyectar.' };
            }
            const updated = await get().projectOnObjectSurface(targetId, {
              kind: p.kind === 'svg' ? 'svg' : 'text',
              text: typeof p.text === 'string' ? p.text : 'KURA3D',
              svgContent: typeof p.svgContent === 'string' ? p.svgContent : undefined,
              mode: (p.mode as SurfaceProjectionOptions['mode']) || 'emboss',
              axis: (p.axis as SurfaceProjectionOptions['axis']) || '+z',
              widthMm: typeof p.widthMm === 'number' ? p.widthMm : 18,
              depthMm: typeof p.depthMm === 'number' ? p.depthMm : 1.2,
              colorHex: typeof p.colorHex === 'string' ? p.colorHex : '#f97316',
              offsetU: typeof p.offsetU === 'number' ? p.offsetU : 0,
              offsetV: typeof p.offsetV === 'number' ? p.offsetV : 0,
            });
            return {
              id: req.id,
              ok: Boolean(updated),
              result: updated ? { id: updated.id, name: updated.name, stats: updated.stats } : null,
            };
          }

          case 'analyze_printability': {
            const rawId = p.id ?? p.objectId;
            const targetId =
              (typeof rawId === 'string' && rawId) || get().selectedIds[0] || get().objects[0]?.id;
            if (!targetId) {
              return { id: req.id, ok: false, error: 'No hay objeto seleccionado para analizar.' };
            }
            const report = get().runPrintabilityCheck(
              targetId,
              typeof p.infillPercent === 'number' ? p.infillPercent : 18,
              typeof p.overhangAngleDeg === 'number' ? p.overhangAngleDeg : 45,
            );
            return {
              id: req.id,
              ok: Boolean(report),
              result: report,
            };
          }

          case 'simplify_mesh': {
            const rawId = p.id ?? p.objectId;
            const targetId =
              (typeof rawId === 'string' && rawId) || get().selectedIds[0] || get().objects[0]?.id;
            if (!targetId) {
              return { id: req.id, ok: false, error: 'No hay objeto seleccionado para simplificar.' };
            }
            const ok = await get().simplifySelectedMesh(
              targetId,
              typeof p.toleranceMm === 'number' ? p.toleranceMm : 0.15,
            );
            const updated = get().objects.find((o) => o.id === targetId);
            return { id: req.id, ok, result: updated ? updated.stats : null };
          }

          case 'refine_mesh': {
            const rawId = p.id ?? p.objectId;
            const targetId =
              (typeof rawId === 'string' && rawId) || get().selectedIds[0] || get().objects[0]?.id;
            if (!targetId) {
              return { id: req.id, ok: false, error: 'No hay objeto seleccionado para refinar.' };
            }
            const ok = await get().refineSelectedMesh(
              targetId,
              typeof p.targetEdgeLengthMm === 'number' ? p.targetEdgeLengthMm : 1.5,
              Boolean(p.smooth),
            );
            const updated = get().objects.find((o) => o.id === targetId);
            return { id: req.id, ok, result: updated ? updated.stats : null };
          }

          case 'create_thread': {
            const created = await get().createThreadObject({
              kind: (p.kind as ThreadOptions['kind']) || 'bolt',
              diameterMm: typeof p.diameterMm === 'number' ? p.diameterMm : 8,
              pitchMm: typeof p.pitchMm === 'number' ? p.pitchMm : 1.25,
              lengthMm: typeof p.lengthMm === 'number' ? p.lengthMm : 20,
              clearanceMm: typeof p.clearanceMm === 'number' ? p.clearanceMm : 0.25,
              includeHead: typeof p.includeHead === 'boolean' ? p.includeHead : true,
            });
            return {
              id: req.id,
              ok: Boolean(created),
              result: created ? { id: created.id, name: created.name, stats: created.stats } : null,
            };
          }

          case 'convex_hull': {
            const ids = Array.isArray(p.ids) ? (p.ids as string[]) : undefined;
            const created = await get().runConvexHull(ids);
            return {
              id: req.id,
              ok: Boolean(created),
              result: created ? { id: created.id, name: created.name, stats: created.stats } : null,
            };
          }

          case 'align_objects': {
            const mode = (p.mode as AlignMode) || 'arrange_grid';
            get().alignSelectedObjects(mode);
            return { id: req.id, ok: true, result: { mode } };
          }

          case 'detect_structures': {
            const rawId = p.id ?? p.objectId;
            const targetId =
              (typeof rawId === 'string' && rawId) || get().selectedIds[0] || get().objects[0]?.id;
            if (!targetId) {
              return { id: req.id, ok: false, error: 'No hay objeto seleccionado para analizar.' };
            }
            const creaseAngleDeg =
              typeof p.creaseAngleDeg === 'number' ? p.creaseAngleDeg : undefined;
            const seg = await get().detectObjectStructures(targetId, creaseAngleDeg);
            return {
              id: req.id,
              ok: Boolean(seg),
              result: seg
                ? {
                    objectId: seg.objectId,
                    method: seg.method,
                    totalTriangles: seg.totalTriangles,
                    regions: seg.regions.map((r) => ({
                      id: r.id,
                      labelEs: r.labelEs,
                      labelEn: r.labelEn,
                      archetype: r.archetype,
                      color: r.color,
                      triangleCount: r.triangleCount,
                      percentOfModel: r.percentOfModel,
                      dimensionsMm: r.dimensionsMm,
                      centerMm: r.centerMm,
                      confidence: r.confidence,
                      isDisconnectedShell: r.isDisconnectedShell,
                    })),
                  }
                : null,
            };
          }

          case 'colorize_structures': {
            const rawId = p.id ?? p.objectId;
            const targetId =
              (typeof rawId === 'string' && rawId) ||
              get().activeSegmentation?.objectId ||
              get().selectedIds[0] ||
              get().objects[0]?.id;
            if (!targetId) {
              return { id: req.id, ok: false, error: 'No hay objeto seleccionado para colorear.' };
            }
            const ok = await get().colorizeDetectedStructures(targetId);
            return {
              id: req.id,
              ok,
              result: {
                objectId: targetId,
                regionsCount: get().activeSegmentation?.regions.length ?? 0,
              },
            };
          }

          case 'extract_structure': {
            const rawObjId = p.objectId;
            const regionId =
              typeof p.regionId === 'string'
                ? p.regionId
                : typeof p.id === 'string'
                  ? p.id
                  : '';
            if (typeof rawObjId === 'string' && rawObjId) {
              const curSeg = get().activeSegmentation;
              if (!curSeg || curSeg.objectId !== rawObjId) {
                await get().detectObjectStructures(rawObjId);
              }
            }
            const seg = get().activeSegmentation;
            if (!seg) {
              return { id: req.id, ok: false, error: 'Ejecuta detect_structures primero.' };
            }
            const resolvedRegion =
              seg.regions.find((r) => r.id === regionId) ??
              (typeof p.regionIndex === 'number' ? seg.regions[p.regionIndex] : undefined);
            if (!resolvedRegion) {
              return { id: req.id, ok: false, error: 'Sub-estructura no encontrada.' };
            }
            const created = await get().extractDetectedStructure(
              resolvedRegion.id,
              Boolean(p.removeFromSource),
            );
            return {
              id: req.id,
              ok: Boolean(created),
              result: created ? { id: created.id, name: created.name, stats: created.stats } : null,
            };
          }

          case 'mirror_object': {
            const rawId = p.id ?? p.objectId;
            const targetId =
              (typeof rawId === 'string' && rawId) || get().selectedIds[0] || get().objects[0]?.id;
            if (!targetId) {
              return { id: req.id, ok: false, error: 'No hay objeto seleccionado para espejar.' };
            }
            const axis: 'x' | 'y' | 'z' =
              p.axis === 'y' || p.axis === 'z' ? p.axis : 'x';
            const ok = get().mirrorObject(targetId, axis);
            return { id: req.id, ok, result: { id: targetId, axis } };
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
            const slicerTarget =
              typeof p.slicerTarget === 'string'
                ? (p.slicerTarget as SlicerTarget)
                : get().printerProfile.brand;
            if (p.returnBytes || p.outputPath || typeof document === 'undefined') {
              const { objects, selectedIds, unitSystem } = get();
              const targetObjs =
                onlySelected && selectedIds.length > 0
                  ? objects.filter((o) => selectedIds.includes(o.id) && o.visible)
                  : objects.filter((o) => o.visible && !o.isHole);
              if (targetObjs.length === 0) {
                return { id: req.id, ok: false, error: tr('toast.nothingToExport') };
              }
              const bytes = engine.exportSceneTo3MF(targetObjs, unitSystem, slicerTarget);
              const triangleCount = targetObjs.reduce((acc, o) => acc + o.stats.triangles, 0);
              return {
                id: req.id,
                ok: true,
                result: {
                  format: '3mf',
                  slicerTarget,
                  bytesBase64: uint8ToBase64(bytes),
                  triangleCount,
                },
              };
            }
            const ok = await get().exportScene3mf(onlySelected, slicerTarget);
            return { id: req.id, ok, result: { format: '3mf', slicerTarget } };
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
