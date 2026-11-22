/**
 * @file src/store/useKuraStore.ts
 * @description Store central Zustand de Kura3D v0.5.0: escena 3D, historial Undo/Redo (40 pasos),
 * densidad adaptativa (Full/Compact/Zen), temas WCAG AA/AAA con previsualización en caliente,
 * soporte nativo de 6 idiomas, herramientas activas, materiales PBR, moldes, proyección en
 * superficies, roscas ISO, validador estructural, plano de sección en vivo, perfil de impresora
 * multi-marca, preferencias persistentes y Command Bus unificado para UI, Servidor MCP y Chat IA.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { create } from 'zustand';
import * as engine from '../engine';
import { t, type TranslationKey } from '../i18n';
import { decodeProjectAsync, encodeProjectAsync } from '../project/projectCodecClient';
import { openProjectFile, saveProjectFile } from '../project/projectFiles';
import { moveRecoveryDraft, readRecoveryDraft, type RecoveryDraftInfo } from '../project/projectRecoveryStorage';
import { ProjectCodecError, type ProjectDocument, type ProjectSceneSnapshot } from '../project/projectSchema';
import {
  DEFAULT_PRINTER_PROFILES,
  PRINT_COLOR_PALETTE,
  THEME_PRESETS,
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
  type ThemePresetId,
  type ThreadOptions,
  type TransformMode,
  type UiDensityMode,
  type UnitSystem,
  type Vec3,
} from '../types/kura';
import { captureViewportPng, isMcpCommandAllowed } from '../utils/mcpBridgeClient';
import { openLocalFile, openLocalFiles } from '../utils/platformBridge';
import {
  createModelIoActions,
  type ExportRequest,
  type ModelImportOptions,
  type ModelImportSource,
} from './modelIoActions';
import { browserLocalStorage, getApiKeyStore, migrateLegacyApiKey } from '../ai/apiKeyStore';
import { MAX_UNDO_HISTORY } from '../project/projectCodec';
import { createCommandBus } from './commandBus';
import { createOperationErrorTracker, localizeWarnings } from './operationErrors';
import { hydrateMcpToken, parseStoredMcpConfig, persistableMcpConfig } from './mcpConfigState';
import {
  generateRandomTokenHex,
  getMcpTokenStore,
  forgetLegacyMcpToken,
  readLegacyMcpToken,
  validateMcpToken,
} from '../utils/mcpTokenStore';
import { computeArrangeLayout } from '../engine/alignment';
import { assertInputsCurrent, subtractOrEmpty, worldBaked } from './sceneOperationGuards';
import { sanitizeTransformPatch } from './transformLimits';
import { loadKeyState, parseStoredAiConfig, persistableAiConfig } from '../ai/aiConfigState';
import { loadAllowedHosts } from '../ai/allowedHosts';
import { keySlotFor } from '../ai/providerCatalog';

const STORAGE_AI_CONFIG_KEY = 'kura3d-ai-config';
const STORAGE_MCP_CONFIG_KEY = 'kura3d-mcp-config';
const STORAGE_COLOR_SCHEME_KEY = 'kura3d-color-scheme';
const STORAGE_THEME_PRESET_KEY = 'kura3d-theme-preset';
const STORAGE_LANGUAGE_KEY = 'kura3d-language';
const STORAGE_UNIT_KEY = 'kura3d-unit-system';
const STORAGE_PRINTER_KEY = 'kura3d-printer-id';
const STORAGE_UI_DENSITY_KEY = 'kura3d-ui-density';
const STORAGE_IMPORT_PLACEMENT_KEY = 'kura3d-import-placement';

export type ActiveDialogType =
  | 'svg'
  | 'image'
  | 'cut'
  | 'mold'
  | 'project'
  | 'thread'
  | 'export3mf'
  | 'export'
  | 'settings'
  | 'shortcuts'
  | null;
export type SettingsTabType = 'appearance' | 'ai' | 'mcp' | 'about';
export type CommandSourceType = 'ui' | 'mcp' | 'ai';
export type PaintBrushMode = 'brush' | 'smart_fill' | 'whole';
export type CameraPresetType = 'iso' | 'top' | 'front' | 'right' | 'fit';

export interface ToastMessage {
  id: string;
  text: string;
  kind: 'info' | 'success' | 'error';
}

type SceneSnapshot = ProjectSceneSnapshot;
const sceneRevisions = new WeakMap<SceneObject[], symbol>();

function sceneRevision(objects: SceneObject[]): symbol {
  const current = sceneRevisions.get(objects);
  if (current) return current;
  const revision = Symbol();
  sceneRevisions.set(objects, revision);
  return revision;
}

function sameHistory(a: SceneSnapshot[], b: SceneSnapshot[]): boolean {
  return a === b || (a.length === b.length && a.every((snapshot, i) =>
    sceneRevision(snapshot.objects) === sceneRevision(b[i].objects),
  ));
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
  projectName: string | null;
  projectLocation?: string;
  projectDraftId: string;
  projectRecovered: boolean;
  savedProject: ProjectDocument | null;
  projectBusy: boolean;
  newProject: () => boolean;
  openProject: (loadFile?: typeof openProjectFile) => Promise<boolean>;
  recoverProject: (draft: RecoveryDraftInfo) => Promise<boolean>;
  saveProject: (saveAs?: boolean) => Promise<boolean>;

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
  themePreset: ThemePresetId;
  previewThemePreset: ThemePresetId | null;
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
  setThemePreset: (preset: ThemePresetId) => void;
  setPreviewThemePreset: (preset: ThemePresetId | null) => void;
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
  /** Reemplaza la selección (lista de escena con Shift/Ctrl); ignora IDs que no existen. */
  setSelection: (ids: string[]) => void;
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
    toolId?: string | string[],
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
  /** Abre un trazo de pincel: las muestras siguientes comparten un único paso de historial. */
  beginPaintStroke: () => void;
  endPaintStroke: () => void;
  eraseSphereOnObject: (id: string, worldCenter: Vec3, radiusMm?: number) => Promise<void>;

  // Nuevas capacidades
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
  alignSelectedObjects: (mode: AlignMode) => { moved: number; fitsBed: boolean } | null;

  // Detección estructural local y separación de sub-partes
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
  /** Colocación de importaciones: conjunto apoyado en la cama o posición original del archivo. */
  importPlacementMode: engine.ImportPlacementMode;
  setImportPlacementMode: (mode: engine.ImportPlacementMode) => void;
  importMeshFromDialog: (placement?: engine.ImportPlacementMode) => Promise<void>;
  importModelFiles: (files: ModelImportSource[], options?: ModelImportOptions) => Promise<boolean>;
  /** Exportación única (STL, 3MF, OBJ+MTL, GLB, PLY) de la selección o la escena. */
  exportModel: (request: ExportRequest) => Promise<boolean>;
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

export function captureProject(state: KuraStoreState): ProjectDocument {
  return {
    objects: state.objects,
    selectedIds: state.selectedIds,
    past: state.past,
    future: state.future,
    unitSystem: state.unitSystem,
    printerProfile: state.printerProfile,
    customBedDimensions: state.customBedDimensions,
    sectionPlane: state.sectionPlane,
    snapGridMm: state.snapGridMm,
  };
}

function hasProjectChanged(saved: ProjectDocument, state: KuraStoreState): boolean {
  // Selection is written with a save, but moving focus around the scene does not require one.
  return sceneRevision(saved.objects) !== sceneRevision(state.objects) ||
    !sameHistory(saved.past, state.past) || !sameHistory(saved.future, state.future) ||
    saved.unitSystem !== state.unitSystem || saved.printerProfile !== state.printerProfile ||
    saved.customBedDimensions !== state.customBedDimensions || saved.sectionPlane !== state.sectionPlane ||
    saved.snapGridMm !== state.snapGridMm;
}

export function isProjectDirty(state: KuraStoreState): boolean {
  if (state.projectRecovered) return true;
  return state.savedProject ? hasProjectChanged(state.savedProject, state) : state.objects.length > 0;
}

/** Generador de IDs cortos y únicos sin dependencias externas. */
function makeId(prefix = 'obj'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeProjectDraftId(): string {
  return globalThis.crypto?.randomUUID?.() ?? makeId('draft');
}

/** Clona un arreglo de objetos para instantáneas Undo/Redo compartiendo referencias inmutables de MeshData. */
function cloneSnapshot(objects: SceneObject[], selectedIds: string[]): SceneSnapshot {
  const copies = objects.map((obj) => ({
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
  }));
  // Undo and redo copy the immutable scene layout without creating a new revision.
  sceneRevisions.set(copies, sceneRevision(objects));
  return { objects: copies, selectedIds: [...selectedIds] };
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
function parseModelBufferToMeshes(
  file: { name: string; buffer: ArrayBuffer },
  invalidGeometryMessage: string,
): Array<{ name: string; mesh: MeshData; color?: string }> {
  const normalize = (mesh: MeshData) => {
    const normalized = engine.normalizeMeshToBed(mesh);
    const vertexCount = normalized.positions.length / 3;
    if (!Number.isInteger(vertexCount) || vertexCount < 3 ||
        normalized.indices.length < 3 || normalized.indices.length % 3 !== 0 ||
        normalized.indices.some((index) => index >= vertexCount) ||
        !normalized.positions.every(Number.isFinite) ||
        (normalized.normals && (normalized.normals.length !== normalized.positions.length ||
          !normalized.normals.every(Number.isFinite)))) {
      throw new Error(invalidGeometryMessage);
    }
    return normalized;
  };

  // Lectores validados (índices, NaN, límites); cada pieza se centra para anclarla al objetivo.
  return engine.parseModelFile(file.name, file.buffer).parts.map((part) => ({
    name: part.name || file.name.replace(/\.[^.]+$/, ''),
    mesh: normalize(part.mesh),
    color: part.color,
  }));
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

/** Sincroniza el atributo `data-theme` en `<html>` para conmutar paletas WCAG AA/AAA en caliente. */
function applyThemePresetToDom(preset: ThemePresetId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = preset;
}

/** Genera un token hexadecimal aleatorio seguro (re-exportado desde `utils/mcpTokenStore`). */
export { generateRandomTokenHex };

/**
 * Token MCP antiguo guardado en claro en localStorage: se retira al iniciar y se migra al almacén
 * seguro (llavero en escritorio, sessionStorage en web) durante la hidratación.
 */
const legacyMcpToken = readLegacyMcpToken(browserLocalStorage());

/** Configuración MCP inicial sin token (desactivada y protegida por defecto). */
function loadInitialMcpConfig(): McpConfig {
  const config = parseStoredMcpConfig(readStorage(STORAGE_MCP_CONFIG_KEY));
  return { ...config, authToken: legacyMcpToken ?? '' };
}

/** Clave antigua retirada de localStorage al iniciar (TRUST-03); null si no había. */
const legacyAiKey = migrateLegacyApiKey(browserLocalStorage(), STORAGE_AI_CONFIG_KEY, getApiKeyStore());

/**
 * Carga configuración IA persistida localmente. La clave API vive en `ai/apiKeyStore`, nunca aquí; en
 * escritorio ni siquiera llega al webview (la adjunta el proxy nativo).
 */
function loadInitialAiConfig(): AiConfig {
  const legacy = getApiKeyStore().desktop ? '' : legacyAiKey?.apiKey ?? '';
  return parseStoredAiConfig(readStorage(STORAGE_AI_CONFIG_KEY), legacy);
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
  if (
    stored === 'es' ||
    stored === 'en' ||
    stored === 'de' ||
    stored === 'fr' ||
    stored === 'hi' ||
    stored === 'zh'
  ) {
    return stored;
  }
  return 'es';
}

function loadInitialThemePreset(): ThemePresetId {
  const stored = readStorage(STORAGE_THEME_PRESET_KEY);
  if (stored && THEME_PRESETS.some((preset) => preset.id === stored)) {
    return stored as ThemePresetId;
  }
  return 'obsidian';
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

function loadInitialImportPlacement(): engine.ImportPlacementMode {
  return readStorage(STORAGE_IMPORT_PLACEMENT_KEY) === 'original' ? 'original' : 'bed';
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
/**
 * Trazo de pincel en curso: el historial guarda un solo snapshot por trazo (al primer cambio),
 * no uno por muestra. Fuera de un trazo (clic suelto, IA, MCP) cada pintado es un paso de historial.
 */
let paintStroke: { open: boolean; recorded: boolean } = { open: false, recorded: false };
let transformSnapshotBeforeDrag: SceneSnapshot | null = null;

export const useKuraStore = create<KuraStoreState>((set, get) => {
  const initialLang = loadInitialLanguage();
  const initialScheme = loadInitialColorScheme();
  const initialThemePreset = loadInitialThemePreset();
  const initialDensity = loadInitialUiDensity();
  applyMetaColorScheme(initialScheme);
  applyThemePresetToDom(initialThemePreset);

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

  /** Guarda el token MCP en su almacén seguro (nunca en localStorage); avisa si falla. */
  const saveMcpToken = (token: string) => {
    getMcpTokenStore().save(token).catch(() => {
      get().addToast(t(get().language, 'dialog.settings.mcpTokenSaveFailed'), 'error');
    });
  };

  /** Último error de operación (para el `errorCode` del Command Bus) y su toast localizado. */
  const operationErrors = createOperationErrorTracker();
  const reportOperationError = (err: unknown) => {
    const message = operationErrors.record(err, get().language);
    get().addToast(tr('toast.errorPrefix', { message }), 'error');
  };
  /** Muestra los avisos del motor (la operación se completó con un ajuste). */
  const reportEngineWarnings = (warnings: readonly engine.EngineWarning[] | undefined) => {
    for (const text of localizeWarnings(get().language, warnings)) get().addToast(text, 'info');
  };

  /** Historial y borrado quedan bloqueados durante una operación asíncrona o un arrastre sin confirmar. */
  const isHistoryLocked = () => Boolean(get().busyOperation) || transformSnapshotBeforeDrag !== null;
  const rejectWhileLocked = () => {
    if (!isHistoryLocked()) return false;
    get().addToast(tr('store.error.busy'), 'info');
    return true;
  };

  const projectErrorMessage = (error: unknown) => {
    if (error instanceof ProjectCodecError) {
      return tr(error.code === 'too-large' ? 'fileProject.tooLarge' : `fileProject.${error.code}`);
    }
    return error instanceof Error ? error.message : String(error);
  };

  const modelIo = createModelIoActions({
    get: () => get(),
    set: (updater) => set((state) => updater(state) as Partial<KuraStoreState>),
    tr,
    pushHistory: () => pushHistory(),
    buildObject: ({ name, mesh, position, color, isHole }) =>
      buildSceneObject({
        name,
        source: 'imported',
        mesh,
        position,
        color: color || PRINT_COLOR_PALETTE[0],
        isHole,
      }),
  });

  const canChangeDocument = () => {
    const state = get();
    return state.engineReady && !state.busyOperation && !state.aiBusy && !transformSnapshotBeforeDrag;
  };

  const confirmReplacement = () =>
    !isProjectDirty(get()) ||
    (typeof window !== 'undefined' && window.confirm(tr('fileProject.discard')));

  const replaceProject = (
    document: ProjectDocument,
    name: string | null,
    { location, recoveredDraftId }: { location?: string; recoveredDraftId?: string } = {},
  ) => {
    paintStroke = { open: false, recorded: false };
    set((state) => ({
      ...document,
      projectName: name,
      projectLocation: location,
      projectDraftId: recoveredDraftId ?? makeProjectDraftId(),
      projectRecovered: Boolean(recoveredDraftId),
      savedProject: document,
      activeTool: 'select',
      transformMode: 'translate',
      activePrintReport: null,
      showOverhangs: false,
      activeSegmentation: null,
      activeDialog: null,
      commandPaletteOpen: false,
      cutPreview: { ...state.cutPreview, active: false, objectId: null },
      spawnedAtById: {},
      cameraRequest: { preset: 'fit', nonce: (state.cameraRequest?.nonce ?? 0) + 1 },
    }));
  };

  return {
    engineReady: false,
    engineError: null,
    busyOperation: null,

    objects: [],
    selectedIds: [],
    past: [],
    future: [],
    projectName: null,
    projectDraftId: makeProjectDraftId(),
    projectRecovered: false,
    savedProject: null,
    projectBusy: false,

    newProject: () => {
      if (get().projectBusy || !canChangeDocument() || !confirmReplacement()) return false;
      replaceProject({
        ...captureProject(get()),
        objects: [],
        selectedIds: [],
        past: [],
        future: [],
        sectionPlane: { enabled: false, heightMm: 25 },
      }, null);
      return true;
    },

    openProject: async (loadFile = openProjectFile) => {
      if (get().projectBusy || !canChangeDocument()) return false;
      set({ projectBusy: true });
      try {
        const file = await loadFile();
        if (!file) return false;
        const document = await decodeProjectAsync(file.bytes);
        if (!canChangeDocument()) throw new Error(tr('fileProject.busy'));
        if (!confirmReplacement()) return false;
        replaceProject(document, file.name, { location: file.location });
        get().addToast(tr('fileProject.opened', { name: file.name }), 'success');
        return true;
      } catch (error) {
        get().addToast(tr('fileProject.openError', { message: projectErrorMessage(error) }), 'error');
        return false;
      } finally {
        set({ projectBusy: false });
      }
    },

    recoverProject: async (draft) => {
      if (get().projectBusy || !canChangeDocument()) return false;
      set({ projectBusy: true });
      try {
        const stored = await readRecoveryDraft(draft.id);
        if (!stored || stored.updatedAt !== draft.updatedAt) {
          throw new Error(tr('recovery.status.changedElsewhere'));
        }
        const document = await decodeProjectAsync(stored.bytes);
        if (!canChangeDocument()) throw new Error(tr('fileProject.busy'));
        if (!confirmReplacement()) return false;

        const previousState = get();
        const previousDocument = captureProject(previousState);
        const recoveredDraftId = makeProjectDraftId();
        if (!(await moveRecoveryDraft(draft, recoveredDraftId))) {
          throw new Error(tr('recovery.status.changedElsewhere'));
        }
        const state = get();
        if (state.projectDraftId !== previousState.projectDraftId ||
            hasProjectChanged(previousDocument, state) || !canChangeDocument()) {
          // The moved draft retains its bytes if the scene received a concurrent edit.
          throw new Error(tr('recovery.status.sceneChanged'));
        }
        replaceProject(document, stored.name, { recoveredDraftId });
        get().addToast(tr('recovery.status.restored'), 'success');
        return true;
      } catch (error) {
        get().addToast(tr('recovery.status.restoreFailed', { message: projectErrorMessage(error) }), 'error');
        return false;
      } finally {
        set({ projectBusy: false });
      }
    },

    saveProject: async (saveAs = false) => {
      if (get().projectBusy || !canChangeDocument()) return false;
      set({ projectBusy: true });
      try {
        const state = get();
        const document = captureProject(state);
        const name = state.projectName ?? `${tr('app.untitled')}.kura`;
        const saved = await saveProjectFile(
          name,
          () => encodeProjectAsync(document),
          saveAs ? undefined : state.projectLocation,
        );
        if (!saved) return false;
        if (saved.viaDownload) {
          get().addToast(tr('fileProject.downloadRequested', { name: saved.name }), 'info');
          return true;
        }
        set({ projectName: saved.name, projectLocation: saved.location, savedProject: document, projectRecovered: false });
        get().addToast(tr('fileProject.saved', { name: saved.name }), 'success');
        return true;
      } catch (error) {
        get().addToast(tr('fileProject.saveError', { message: projectErrorMessage(error) }), 'error');
        return false;
      } finally {
        set({ projectBusy: false });
      }
    },

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
    themePreset: initialThemePreset,
    previewThemePreset: null,
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
          set({ engineReady: true, engineError: null, savedProject: captureProject(get()) });
          get().addToast(tr('toast.engineReady'), 'success');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          // Libera la promesa para que la próxima llamada reintente en vez de reutilizar el fallo.
          engineInitPromise = null;
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

    setThemePreset: (preset) => {
      if (!THEME_PRESETS.some((item) => item.id === preset)) return;
      writeStorage(STORAGE_THEME_PRESET_KEY, preset);
      applyThemePresetToDom(preset);
      set({ themePreset: preset, previewThemePreset: null });
      const themeName = tr(`theme.${preset}.name` as TranslationKey);
      get().addToast(tr('toast.themeApplied', { name: themeName }), 'success');
    },

    setPreviewThemePreset: (preset) => {
      const effective = preset ?? get().themePreset;
      applyThemePresetToDom(effective);
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
        let next: AiConfig = { ...state.aiConfig, ...patch };
        writeStorage(STORAGE_AI_CONFIG_KEY, JSON.stringify(persistableAiConfig(next)));
        if ('apiKey' in patch) {
          const keyStore = getApiKeyStore();
          const value = next.apiKey.trim();
          void keyStore.save(keySlotFor(next), value).catch(() => {
            if (keyStore.desktop) set((s) => ({ aiConfig: { ...s.aiConfig, keyStored: false } }));
            get().addToast(t(get().language, 'ai.error.keySaveFailed'), 'error');
          });
          // En escritorio la clave pasa al llavero y no queda en el webview.
          if (keyStore.desktop) next = { ...next, apiKey: '', keyStored: Boolean(value) };
        }
        return { aiConfig: next };
      }),

    setMcpConfig: (patch) => {
      const { authToken, ...rest } = patch;
      // Un token escrito a mano solo se acepta si el servidor lo aceptará (≥16 caracteres, sin espacios).
      const nextToken = authToken !== undefined && validateMcpToken(authToken.trim()) === 'ok'
        ? authToken.trim()
        : undefined;
      set((state) => {
        const nextPort =
          typeof rest.port === 'number' && Number.isFinite(rest.port)
            ? Math.min(65535, Math.max(1024, Math.round(rest.port)))
            : state.mcpConfig.port;
        const next: McpConfig = {
          ...state.mcpConfig,
          ...rest,
          ...(nextToken !== undefined ? { authToken: nextToken } : {}),
          port: nextPort,
          requireAuth: true,
        };
        writeStorage(STORAGE_MCP_CONFIG_KEY, persistableMcpConfig(next));
        return { mcpConfig: next };
      });
      if (nextToken !== undefined) saveMcpToken(nextToken);
    },

    regenerateMcpToken: () => {
      const token = generateRandomTokenHex(32);
      set((state) => ({ mcpConfig: { ...state.mcpConfig, authToken: token } }));
      saveMcpToken(token);
    },

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

    setSelection: (ids) =>
      set((state) => {
        const known = new Set(state.objects.map((o) => o.id));
        return { selectedIds: [...new Set(ids)].filter((id) => known.has(id)) };
      }),

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
      rejectWhileLocked() ||
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
      rejectWhileLocked() ||
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
        reportOperationError(err);
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
        reportOperationError(err);
        return null;
      } finally {
        set({ busyOperation: null });
      }
    },

    importModelAsModule: async (file, mode, targetId) => {
      set({ busyOperation: `import_module_${mode}` });
      try {
        await get().initEngine();
        const parsedParts = parseModelBufferToMeshes(file, tr('dropProject.invalidGeometry', { name: file.name }));
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
        reportOperationError(err);
        return null;
      } finally {
        set({ busyOperation: null });
      }
    },

    importModelAsModuleFromDialog: async (mode, targetId) => {
      const file = await openLocalFile('.stl,.3mf,.obj,.ply');
      if (!file) return null;
      return get().importModelAsModule(file, mode, targetId);
    },

    createStarterCube: async () => {
      if (get().busyOperation || get().projectBusy) return;
      const wasEmpty = get().objects.length === 0;
      const cube = await get().createPrimitive('box', { width: 30, height: 30, depth: 30 }, {
        name: `${tr('sidebar.primitive.box')} Kura3D 30 mm`,
        color: PRINT_COLOR_PALETTE[0],
        materialPreset: 'pla_matte',
      });
      if (cube && wasEmpty) get().requestCameraPreset('fit');
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

    setObjectTransform: (id, rawPatch, recordHistory = false) => {
      // Ni NaN ni vectores mal formados llegan a la escena; durante una operación no se edita.
      const patch = sanitizeTransformPatch(rawPatch);
      const target = get().objects.find((o) => o.id === id);
      if (!patch || !target || target.locked || get().busyOperation) return;
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
      if (sourceObjs.length === 0 || rejectWhileLocked()) return [];

      pushHistory();
      const copySuffix = tr('store.copySuffix');
      const created: SceneObject[] = sourceObjs.map((src) => ({
        ...src,
        id: makeId('mesh'),
        name: `${src.name} ${copySuffix}`,
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
      if (targetIds.length === 0 || rejectWhileLocked()) return;

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

      const cloneLabel = tr('store.copySuffix');
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
        reportOperationError(err);
        return false;
      }
    },

    runBooleanOnSelection: async (op, explicitTargetId, explicitToolId) => {
      const { objects, selectedIds } = get();
      const explicitTools =
        explicitToolId === undefined ? [] : Array.isArray(explicitToolId) ? explicitToolId : [explicitToolId];
      const firstId = explicitTargetId ?? selectedIds[0];
      const secondId = explicitTools[0] ?? selectedIds[1];

      const targetObj = objects.find((o) => o.id === firstId);
      const toolObj = objects.find((o) => o.id === secondId);
      if (!targetObj || !toolObj || targetObj.id === toolObj.id || rejectWhileLocked()) return null;

      const extraIds =
        !explicitTargetId && explicitTools.length === 0 ? selectedIds.slice(2) : explicitTools.slice(1);
      const inputs = [targetObj, toolObj, ...objects.filter((o) => extraIds.includes(o.id))];
      // Los objetos bloqueados no se consumen ni se modifican.
      if (inputs.some((o) => o.locked)) {
        get().addToast(tr('store.error.locked'), 'error');
        return null;
      }

      set({ busyOperation: `boolean:${op}` });
      try {

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

        assertInputsCurrent(get().objects, inputs, tr);
        pushHistory();
        set((state) => ({
          objects: [...state.objects.filter((o) => !consumedIds.has(o.id)), currentTarget],
          selectedIds: [currentTarget.id],
        }));

        get().addToast(tr('toast.booleanDone', { op }), 'success');
        return currentTarget;
      } catch (err) {
        reportOperationError(err);
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

      // Los objetos bloqueados ni se recortan ni se consumen.
      const solids = scope.filter((o) => !o.isHole && o.visible && !o.locked);
      const holes = scope.filter((o) => o.isHole && o.visible && !o.locked);
      if (solids.length === 0 || holes.length === 0 || rejectWhileLocked()) return;

      set({ busyOperation: 'apply_holes' });
      try {
        const updatedSolids: SceneObject[] = [];
        for (const solid of solids) {
          let current: SceneObject | null = solid;
          for (const hole of holes) {
            if (!current) break;
            // Un sólido totalmente contenido en un hueco (resultado vacío, detectado por geometría
            // y no por el texto del error) se elimina sin abortar el resto del lote.
            const res = await subtractOrEmpty(current, hole);
            current = res && buildSceneObject({
              id: solid.id,
              name: solid.name,
              source: 'boolean',
              mesh: res.mesh,
              position: res.position,
              color: solid.color,
              materialPreset: solid.materialPreset,
            });
          }
          if (current) {
            updatedSolids.push(current);
          }
        }

        const solidIds = new Set(solids.map((s) => s.id));
        const holeIds = new Set(holes.map((h) => h.id));

        assertInputsCurrent(get().objects, [...solids, ...holes], tr);
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
        reportOperationError(err);
      } finally {
        set({ busyOperation: null });
      }
    },

    hollowObject: async (id, options) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked) return false;

      set({ busyOperation: 'hollow' });
      try {
        const detailed = options.enabled && options.wallThickness !== 0
          ? await engine.hollowMeshDetailed(obj, options)
          : { mesh: await engine.hollowMesh(obj, options), warnings: [] };
        const nextMesh = detailed.mesh;
        const stats = engine.computeMeshStats(nextMesh);

        assertInputsCurrent(get().objects, [obj], tr);
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
        reportEngineWarnings(detailed.warnings);
        return true;
      } catch (err) {
        reportOperationError(err);
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

        assertInputsCurrent(get().objects, [obj], tr);
        pushHistory();
        set((state) => ({
          objects: [...state.objects.filter((o) => o.id !== id), ...created],
          selectedIds: created.map((c) => c.id),
        }));
        get().addToast(tr('toast.cutDone'), 'success');
        return created;
      } catch (err) {
        reportOperationError(err);
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

        assertInputsCurrent(get().objects, [obj], tr);
        pushHistory();
        set((state) => ({
          objects: [...state.objects.filter((o) => o.id !== id), ...created],
          selectedIds: created.map((c) => c.id),
        }));
        get().addToast(tr('toast.splitPartsDone', { count: created.length }), 'success');
        return created;
      } catch (err) {
        reportOperationError(err);
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
        reportOperationError(err);
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
        reportOperationError(err);
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
          obj.color,
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

      // Sin cambios de color (pasar el pincel sobre caras ya pintadas): ni historial ni render.
      if (nextMesh === obj.mesh) return;
      if (!paintStroke.open || !paintStroke.recorded) {
        pushHistory();
        paintStroke.recorded = true;
      }

      set((prev) => ({
        objects: prev.objects.map((item) =>
          item.id === id ? { ...item, mesh: nextMesh } : item,
        ),
      }));
    },

    beginPaintStroke: () => {
      paintStroke = { open: true, recorded: false };
    },

    endPaintStroke: () => {
      paintStroke = { open: false, recorded: false };
    },

    eraseSphereOnObject: async (id, worldCenter, radiusMm) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj || obj.locked) return;

      set({ busyOperation: 'erase' });
      try {
        const radius = radiusMm ?? get().eraseRadiusMm;
        const result = await engine.eraseRegionWithSphere(obj, worldCenter, radius);
        const stats = engine.computeMeshStats(result.mesh);

        assertInputsCurrent(get().objects, [obj], tr);
        pushHistory();
        set((state) => ({
          objects: state.objects.map((item) =>
            item.id === id
              ? {
                  ...item,
                  // La malla del motor ya está en espacio mundial: se hornea la transformación.
                  ...worldBaked(),
                  mesh: result.mesh,
                  position: result.position,
                  stats,
                }
              : item,
          ),
        }));
        get().addToast(tr('toast.erased'), 'success');
      } catch (err) {
        reportOperationError(err);
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
        reportOperationError(err);
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

        assertInputsCurrent(get().objects, [obj], tr);
        pushHistory();
        const updated: SceneObject = {
          ...obj,
          source: 'projected',
          // La malla del motor ya está en espacio mundial: se hornea la transformación.
          ...worldBaked(),
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
        reportOperationError(err);
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
        reportOperationError(err);
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

        assertInputsCurrent(get().objects, [obj], tr);
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
        reportOperationError(err);
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
        const refined = await engine.refineMeshDetailed(obj, targetEdgeLengthMm, smooth);
        const nextMesh = refined.mesh;
        const stats = engine.computeMeshStats(nextMesh);

        assertInputsCurrent(get().objects, [obj], tr);
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
        reportEngineWarnings(refined.warnings);
        return true;
      } catch (err) {
        reportOperationError(err);
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

        assertInputsCurrent(get().objects, [...targetObjs], tr);
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
        reportOperationError(err);
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
        const kindLabel = tr(`store.thread.${options.kind}`);

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
        reportOperationError(err);
        return null;
      } finally {
        set({ busyOperation: null });
      }
    },

    alignSelectedObjects: (mode) => {
      const { objects, selectedIds, printerProfile } = get();
      if (rejectWhileLocked()) return null;
      const targetObjs =
        mode === 'arrange_grid' && selectedIds.length < 2
          ? objects.filter((o) => o.visible && !o.locked)
          : objects.filter((o) => selectedIds.includes(o.id) && !o.locked);

      if (targetObjs.length === 0) return null;

      let positions: Record<string, Vec3>;
      let fitsBed = true;
      if (mode === 'arrange_grid') {
        // Los huecos viajan con el sólido que perforan, aunque no estén seleccionados.
        const targetIds = new Set(targetObjs.map((o) => o.id));
        const companions = objects.filter((o) => o.isHole && o.visible && !o.locked && !targetIds.has(o.id));
        const layout = computeArrangeLayout(targetObjs, printerProfile, companions);
        positions = layout.positions;
        fitsBed = layout.fitsBed;
      } else {
        positions = engine.computeAlignmentPositions(targetObjs, mode, printerProfile);
      }
      pushHistory();
      set((state) => ({
        objects: state.objects.map((item) =>
          positions[item.id] ? { ...item, position: positions[item.id] } : item,
        ),
      }));
      get().addToast(tr('toast.alignedDone', { mode }), 'success');
      if (!fitsBed) {
        get().addToast(
          tr('store.align.overflow', { width: printerProfile.bedWidthMm, depth: printerProfile.bedDepthMm }),
          'error',
        );
      }
      return { moved: Object.keys(positions).length, fitsBed };
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
        reportOperationError(err);
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
        reportOperationError(err);
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
                        // El remanente ya está en espacio mundial: se hornea la transformación.
                        ...worldBaked(),
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
        reportOperationError(err);
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
        reportOperationError(err);
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
        reportOperationError(err);
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
        reportOperationError(err);
        return null;
      } finally {
        set({ busyOperation: null });
      }
    },

    importPlacementMode: loadInitialImportPlacement(),
    setImportPlacementMode: (mode) => {
      writeStorage(STORAGE_IMPORT_PLACEMENT_KEY, mode);
      set({ importPlacementMode: mode });
    },

    importMeshFromDialog: async (placement) => {
      let files: ModelImportSource[];
      try {
        files = await openLocalFiles(engine.MODEL_IMPORT_ACCEPT);
      } catch (err) {
        get().addToast(tr('toast.errorPrefix', { message: projectErrorMessage(err) }), 'error');
        return;
      }
      if (files.length > 0) await get().importModelFiles(files, { placement });
    },

    importModelFiles: async (files, options) => {
      if (files.length === 0) return false;
      const state = get();
      if (state.projectBusy || state.busyOperation || state.aiBusy || transformSnapshotBeforeDrag) {
        state.addToast(tr('fileProject.busy'), 'info');
        return false;
      }
      set({ busyOperation: 'import_mesh' });
      try {
        await get().initEngine();
        return await modelIo.importModelFiles(files, options);
      } catch (err) {
        get().addToast(tr('toast.errorPrefix', { message: projectErrorMessage(err) }), 'error');
        return false;
      } finally {
        set({ busyOperation: null });
      }
    },

    exportModel: (request) => modelIo.exportModel(request),

    exportSceneStl: async (onlySelected = false) =>
      modelIo.exportModel({ format: 'stl', scope: onlySelected ? 'selection' : 'scene' }),

    exportScene3mf: async (onlySelected = false, slicerTarget) =>
      modelIo.exportModel({ format: '3mf', scope: onlySelected ? 'selection' : 'scene', slicerTarget }),

    export3MFForSlicer: async (slicerTarget, onlySelected = false) => {
      return get().exportScene3mf(onlySelected, slicerTarget);
    },

    exportSelectedObj: async () =>
      modelIo.exportModel({ format: 'obj', scope: get().selectedIds.length > 0 ? 'selection' : 'scene' }),

    executeCommand: createCommandBus({
      get,
      setSelectedIds: (ids) => set({ selectedIds: ids }),
      isInteractionLocked: () => isHistoryLocked(),
      tr,
      toBase64: uint8ToBase64,
      operationErrors,
    }),
  };
});

/** Carga el token MCP desde su almacén seguro (migrando el antiguo de localStorage). */
void (async () => {
  const { token, saved } = await hydrateMcpToken(getMcpTokenStore(), legacyMcpToken);
  // El token antiguo en claro se borra de localStorage solo cuando ya quedó en el almacén seguro.
  if (saved) forgetLegacyMcpToken(browserLocalStorage());
  const state = useKuraStore.getState();
  // Si el usuario ya fijó un token en esta sesión, no se pisa.
  if (state.mcpConfig.authToken && state.mcpConfig.authToken !== (legacyMcpToken ?? '')) return;
  useKuraStore.setState({ mcpConfig: { ...state.mcpConfig, authToken: token } });
  if (!saved) state.addToast(t(state.language, 'dialog.settings.mcpTokenSaveFailed'), 'error');
})();

/** Carga la clave del proveedor activo desde el almacén seguro y avisa si la migración no pudo guardarla. */
void (async () => {
  if (legacyAiKey && !(await legacyAiKey.saved)) {
    const { addToast, language } = useKuraStore.getState();
    addToast(t(language, 'ai.error.keySaveFailed'), 'error');
  }
  const keyStore = getApiKeyStore();
  if (keyStore.desktop) void loadAllowedHosts().catch(() => undefined);
  const initial = useKuraStore.getState().aiConfig;
  if (initial.apiKey) return;
  const keyState = await loadKeyState(initial, keyStore);
  const current = useKuraStore.getState().aiConfig;
  if (keySlotFor(current) === keySlotFor(initial) && !current.apiKey) {
    useKuraStore.setState({ aiConfig: { ...current, ...keyState } });
  }
})();
