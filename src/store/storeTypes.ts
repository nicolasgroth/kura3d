/**
 * @file src/store/storeTypes.ts
 * @description Tipos públicos del store de Kura3D: estado completo (`KuraStoreState`), diálogos,
 * pestañas, origen de comandos, modo de pincel, presets de cámara y toasts. `useKuraStore.ts` los
 * reexporta para que los componentes no cambien sus imports.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type * as engine from '../engine';
import type { ParametricEdit } from '../core/operations/creationOperations';
import type { SplitForBedOutcome, SplitForBedRequest } from './splitCommandSchemas';
import type { openProjectFile } from '../project/projectFiles';
import type { RecoveryDraftInfo } from '../project/projectRecoveryStorage';
import type { ProjectDocument, ProjectSceneSnapshot } from '../project/projectSchema';
import type {
  ActiveTool,
  AiChatMessage,
  AiConfig,
  AiProviderType,
  AlignMode,
  BooleanOpType,
  ColorSchemePreference,
  CutPreviewState,
  HollowOptions,
  ImageTo3DOptions,
  KuraCommandRequest,
  KuraCommandResponse,
  LanguageCode,
  MaterialPresetId,
  McpConfig,
  MeshData,
  MoldOptions,
  ObjectSourceType,
  PlaneCutOptions,
  PrimitiveParams,
  PrimitiveType,
  PrintabilityReport,
  PrinterProfile,
  SceneObject,
  SlicerTarget,
  StructuralSegmentationResult,
  SurfaceProjectionOptions,
  SvgImportOptions,
  TextureOptions,
  ThemePresetId,
  ThreadOptions,
  TransformMode,
  UiDensityMode,
  UnitSystem,
  Vec3,
} from '../types/kura';
import type { ExportRequest, ModelImportOptions, ModelImportSource } from './modelIoActions';
import type { PreviewSliceState } from './slices/previewSlice';
import type { SplitSliceState } from './slices/splitSlice';

export type ActiveDialogType =
  | 'svg'
  | 'image'
  | 'cut'
  | 'splitForBed'
  | 'mold'
  | 'project'
  | 'thread'
  | 'export3mf'
  | 'export'
  | 'settings'
  | 'shortcuts'
  | null;
export type SettingsTabType = 'appearance' | 'project' | 'ai' | 'mcp' | 'about';
export type MeasuresFocus = 'unit' | 'printer';
export type CommandSourceType = 'ui' | 'mcp' | 'ai';
export type PaintBrushMode = 'brush' | 'smart_fill' | 'whole';
/**
 * 'fit': selección o escena; 'scene': toda la escena (abrir/recuperar); 'ensure': mostrar `ids` solo
 * si no están a la vista; 'focus': encuadrar siempre `ids` desde una vista que otros objetos no tapen.
 */
export type CameraPresetType = 'iso' | 'top' | 'front' | 'right' | 'fit' | 'scene' | 'ensure' | 'focus';

export interface ToastMessage {
  id: string;
  text: string;
  kind: 'info' | 'success' | 'error';
}

export type SceneSnapshot = ProjectSceneSnapshot;

/** Progreso de la operación en curso (para la barra con Cancelar). */
export interface BusyProgress {
  /** Nombre de la operación (igual a `busyOperation`). */
  name: string;
  /** Fase informada por el motor (`init`, `compute`…) o null si no se conoce. */
  phase: string | null;
  /** `Date.now()` al empezar; el tiempo transcurrido lo da `selectBusyElapsedMs`. */
  startedAt: number;
  /** true mientras una tarea del motor puede cancelarse con `cancelBusyOperation`. */
  cancellable: boolean;
}

/** Vista previa de operaciones (declarada en `slices/previewSlice.ts`), fusionada al estado. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface KuraStoreState extends PreviewSliceState, SplitSliceState {}

export interface KuraStoreState {
  // Estado del motor geométrico
  engineReady: boolean;
  engineError: string | null;
  busyOperation: string | null;
  busyProgress: BusyProgress | null;
  /** Cancela la tarea del motor en curso (descarta su resultado). false si no hay nada cancelable. */
  cancelBusyOperation: () => boolean;
  /** Mensaje del último fallo de una operación (los diálogos lo muestran sin cerrarse). */
  lastOperationError: string | null;

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
  /** Descarga de `.kura` iniciada sin confirmación del navegador; el proyecto sigue con cambios pendientes. */
  pendingDownloadSave: { name: string; document: ProjectDocument } | null;
  /** El usuario confirma que el archivo descargado se guardó: limpia la marca de cambios. */
  acknowledgeDownloadSave: () => void;

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
  cameraRequest: { preset: CameraPresetType; nonce: number; ids?: string[] } | null;

  // Plano de corte visual (Rayos X / Sección), Validador y Segmentación Estructural Local
  sectionPlane: { enabled: boolean; heightMm: number };
  activePrintReport: PrintabilityReport | null;
  /** Objeto exacto analizado: si la pieza cambia (editar, deshacer), el informe deja de valer. */
  printReportSource: SceneObject | null;
  showOverhangs: boolean;
  activeSegmentation: StructuralSegmentationResult | null;
  segmentationCreaseDeg: number;
  /** Estructura bajo el cursor o foco en la lista (resaltado temporal en el visor). */
  hoveredRegionId: string | null;
  /** Estructura elegida en la lista o con clic en el visor. */
  selectedRegionId: string | null;

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
  /** Petición de abrir el popover de unidad e impresora de la barra de estado (paleta de comandos). */
  measuresRequest: { nonce: number; focus: MeasuresFocus } | null;
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
  setHoveredRegionId: (id: string | null) => void;
  setSelectedRegionId: (id: string | null) => void;
  setPaintSettings: (
    patch: Partial<{ paintColor: string; paintRadiusMm: number; paintMode: PaintBrushMode }>,
  ) => void;
  setEraseRadiusMm: (radiusMm: number) => void;
  requestCameraPreset: (preset: CameraPresetType, ids?: string[]) => void;
  setActiveDialog: (dialog: ActiveDialogType) => void;
  setSettingsTab: (tab: SettingsTabType) => void;
  openSettings: (tab?: SettingsTabType) => void;
  requestMeasuresPopover: (focus?: MeasuresFocus) => void;
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
      /** `free`: primer hueco libre de la cama; `origin` (por defecto): centro de la cama. */
      placement?: 'free' | 'origin';
    },
  ) => Promise<SceneObject | null>;
  /** Regenera una primitiva o rosca con parámetros nuevos (un paso de deshacer). */
  updatePrimitiveParams: (id: string, edit: ParametricEdit) => Promise<SceneObject | null>;
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
  /** Cancela un arrastre en curso: restaura la escena previa y no deja paso en el historial. */
  cancelTransformSnapshot: () => void;
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
  /**
   * Dividir para imprimir: plan por cama y, salvo `dryRun` o si ya cabe, ejecución que reemplaza el
   * objeto por sus piezas armadas en su lugar (`metadata.split`). `null` si falló o está bloqueado.
   */
  splitObjectForBed: (id: string, request: Omit<SplitForBedRequest, 'target'>) => Promise<SplitForBedOutcome | null>;
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
    minWallMm?: number,
  ) => Promise<PrintabilityReport | null>;
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
