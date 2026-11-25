/**
 * @file src/store/storeTypes.ts
 * @description Tipos públicos del store de Kura3D: estado completo (`KuraStoreState`), diálogos,
 * pestañas, origen de comandos, modo de pincel, presets de cámara y toasts. `useKuraStore.ts` los
 * reexporta para que los componentes no cambien sus imports.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ActionId } from './actionsCatalog';
import type * as engine from '../engine';
import type { ParametricEdit } from '../core/operations/creationOperations';
import type { SplitForBedOutcome, SplitForBedRequest } from './splitCommandSchemas';
import type { openProjectFile } from '../project/projectFiles';
import type { RecoveryDraftInfo } from '../project/projectRecoveryStorage';
import type { HistoryLimits } from '../project/historyBudget';
import type { ProjectDocument, ProjectSceneSnapshot } from '../project/projectSchema';
import type { HistoryStep } from './historySteps';
import type { BrushView } from '../engine/paint/brushSelect';
import type { QuickActionsSliceState } from './quickActionsTypes';
import type { MenuIdeasSliceState } from './menuIdeasTypes';
import type { GroupsSliceState } from './groupsTypes';
import type { RepairSliceState } from './repairTypes';
import type { ViewPrefsSliceState } from './slices/viewPrefsSlice';
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
import type { ObjectRole } from '../types/kura';
import type { ExportRequest, ModelImportOptions, ModelImportSource } from './modelIoActions';
import type { PreviewSliceState } from './slices/previewSlice';
import type { SmoothSliceState } from './slices/smoothSlice';
import type { SplitSliceState } from './slices/splitSlice';
import type { SplitJointsSliceState } from './slices/splitJointsSlice';
import type { SplitPrefsSliceState } from './slices/splitPrefsSlice';
import type { FitToBedSliceState } from './slices/fitToBedSlice';
import type { FitCheckSliceState } from './slices/fitCheckSlice';
import type { OrientSliceState } from './slices/orientSlice';
import type { RecipesSliceState } from './slices/recipesSlice';
import type { BedProfilesSliceState } from './slices/bedProfilesSlice';
import type { MagnetSliceState } from './slices/magnetSlice';
import type { ScrewBossSliceState } from './slices/screwBossSlice';
import type { KeyholeSliceState } from './slices/keyholeSlice';
import type { CablePassSliceState } from './slices/cablePassSlice';

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
  | 'about'
  | null;
export type SettingsTabType = 'appearance' | 'project' | 'ai' | 'mcp' | 'about';
export type MeasuresFocus = 'unit' | 'printer';
export type CommandSourceType = 'ui' | 'mcp' | 'ai';
export type PaintBrushMode = 'brush' | 'smart_fill' | 'whole';
/**
 * 'fit': selección o escena; 'scene': toda la escena (abrir/recuperar); 'ensure': mostrar `ids` solo
 * si no están a la vista; 'focus': encuadrar siempre `ids` desde una vista que otros objetos no tapen.
 */
export type CameraPresetType = 'iso' | 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right' | 'fit' | 'scene' | 'ensure' | 'focus';

export interface ToastMessage {
  id: string;
  text: string;
  kind: 'info' | 'success' | 'error';
  /** Acción opcional del aviso (p. ej. «Deshacer»); al ejecutarla el aviso se cierra. */
  action?: ToastAction;
  /** Segunda acción, secundaria (p. ej. «Otra unidad…»); también cierra el aviso. */
  secondaryAction?: ToastAction;
}

/** Entrada del historial corto de avisos (consultable desde la barra de estado). */
export interface ToastHistoryEntry {
  id: string;
  text: string;
  kind: ToastMessage['kind'];
  at: number;
  /** Acciones del aviso: siguen operables desde el historial mientras sean válidas. */
  actions?: ToastAction[];
  /** La acción ya se ejecutó (desde el aviso o el historial). */
  applied?: boolean;
}

export interface ToastAction {
  label: string;
  /** Nombre accesible propio cuando el texto visible es corto y se repetiría en otro control (p. ej. «Deshacer»). */
  ariaLabel?: string;
  run: () => void;
  /** Objetos sobre los que actúa: si ya no existe ninguno, la acción deja de ser aplicable. */
  targetIds?: readonly string[];
  /**
   * Deja de aplicar cuando cambia la malla (reparar, simplificar, separar) o la escala (unidades) de todos los
   * `targetIds`: `addToast` guarda el valor de partida en `watched`.
   */
  watch?: 'mesh' | 'scale';
  watched?: ReadonlyMap<string, unknown>;
  /** Validez propia además de `targetIds` (p. ej. Deshacer: nada cambió desde el aviso). */
  applicable?: () => boolean;
  /** Acción de conveniencia (Deshacer): el aviso caduca solo como uno informativo. */
  transient?: boolean;
}

export type SceneSnapshot = ProjectSceneSnapshot;
export type { HistoryStep } from './historySteps';

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
  /** Avance contable si se conoce (p. ej. pieza 7 de 19 al construir lo importado). */
  done?: number;
  total?: number;
}

/** Vista previa de operaciones (declarada en `slices/previewSlice.ts`), fusionada al estado. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface KuraStoreState extends PreviewSliceState, SplitSliceState, SplitJointsSliceState, SplitPrefsSliceState, FitToBedSliceState, FitCheckSliceState, OrientSliceState, RecipesSliceState, BedProfilesSliceState, MagnetSliceState, QuickActionsSliceState, MenuIdeasSliceState, GroupsSliceState, RepairSliceState, ViewPrefsSliceState, SmoothSliceState, ScrewBossSliceState, KeyholeSliceState, CablePassSliceState {}

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
  /** Pasos de deshacer/rehacer: instantáneas o deltas de pintura (ver `historySteps.ts`). */
  past: HistoryStep[];
  future: HistoryStep[];
  projectName: string | null;
  projectLocation?: string;
  projectDraftId: string;
  projectRecovered: boolean;
  /** El nombre cambió desde el último guardado (no se guarda en el `.kura`: es el nombre del archivo). */
  projectRenamed: boolean;
  /** Cambia el nombre del proyecto (se usa al guardar); vacío no se acepta. Marca cambios sin guardar. */
  renameProject: (name: string) => boolean;
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
  /** Acción del menú «Acciones» elegida en último lugar (`null` = ninguna; elegir una herramienta la limpia).
   * Junto con `activeTool` dice qué está activo (`activeContextOf` en `actionsCatalog.ts`). */
  activeAction: ActionId | null;
  transformMode: TransformMode;
  /** Mover, Rotar o Escalar elegidos a propósito en la barra o con su atajo (`null` = Seleccionar u otra
   * herramienta): el panel derecho pone arriba solo esa parte de la transformación (`panelContextOf`). */
  transformFocus: TransformMode | null;
  proportionalScale: boolean;
  snapGridMm: number;
  paintColor: string;
  paintRadiusMm: number;
  paintMode: PaintBrushMode;
  /** El pincel subdivide los triángulos del borde del trazo para que el color siga el círculo. */
  paintRefineEdge: boolean;
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
  /** Últimos avisos y errores (aunque ya se hayan cerrado o se hayan mostrado dentro de un diálogo). */
  toastHistory: ToastHistoryEntry[];
  /** Panel «Proyecto» fijado desde la barra superior sin tocar la selección; vale mientras no cambie el contexto. */
  projectPanelPin: import('./panelContext').ProjectPanelPin | null;

  // Acciones de inicialización, densidad y preferencias
  initEngine: () => Promise<void>;
  setUiDensity: (mode: UiDensityMode) => void;
  cycleUiDensity: () => void;
  toggleZenMode: () => void;
  toggleLeftSidebar: () => void;
  toggleRightInspector: () => void;
  /** Muestra el contexto «Proyecto» del panel derecho: lo fija sin quitar la selección ni la herramienta y abre el panel. */
  showProjectPanel: () => void;
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
  setActiveAction: (action: ActionId | null) => void;
  setTransformMode: (mode: TransformMode) => void;
  setTransformFocus: (mode: TransformMode | null) => void;
  setProportionalScale: (locked: boolean) => void;
  toggleProportionalScale: () => void;
  setSnapGridMm: (snapMm: number) => void;
  setSegmentationCreaseDeg: (deg: number) => void;
  clearSegmentation: () => void;
  setHoveredRegionId: (id: string | null) => void;
  setSelectedRegionId: (id: string | null) => void;
  setPaintSettings: (
    patch: Partial<{ paintColor: string; paintRadiusMm: number; paintMode: PaintBrushMode; paintRefineEdge: boolean }>,
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
  addToast: (text: string, kind?: ToastMessage['kind'], action?: ToastAction, options?: { historyOnly?: boolean; secondaryAction?: ToastAction }) => void;
  clearToastHistory: () => void;
  dismissErrorToasts: () => void;
  dismissToast: (id: string) => void;
  /** Ejecuta una acción de un aviso (visible o del historial): lo cierra y la marca como aplicada. */
  runToastAction: (id: string, action: ToastAction) => void;
  dismissAllToasts: () => void;

  // Selección e historial
  selectObject: (id: string, additive?: boolean) => void;
  /** Reemplaza la selección (lista de escena con Shift/Ctrl); ignora IDs que no existen. */
  setSelection: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  undo: () => void;
  redo: () => void;
  /** Vuelve a la posición `position` del historial (0 = inicio, `past.length` = actual) en un solo cambio. */
  jumpToHistory: (position: number) => void;
  /** Límites del historial de deshacer (presupuesto de memoria y máximo de pasos); preferencia global. */
  historyLimits: HistoryLimits;
  setHistoryLimits: (limits: Partial<HistoryLimits>) => void;
  /** Descarta todos los pasos de deshacer y rehacer (la escena actual no cambia). */
  clearHistory: () => void;

  // Operaciones sobre escena y geometría
  createPrimitive: (
    type: PrimitiveType,
    params?: PrimitiveParams,
    options?: {
      name?: string;
      /** Etiqueta del tipo cuando no es la de `type` (p. ej. «Disco»): se numera igual («Disco 3»). */
      label?: string;
      color?: string;
      position?: Vec3;
      /** Giro (radianes, Euler XYZ) y escala en ejes internos; el bus los convierte desde los del usuario. */
      rotation?: Vec3;
      scale?: Vec3;
      role?: ObjectRole;
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
      Pick<SceneObject, 'name' | 'color' | 'role' | 'referenceOpacity' | 'visible' | 'locked' | 'materialPreset'>
    >,
  ) => void;
  /**
   * Cambia metadatos de varios objetos en UN solo paso de deshacer. `recordHistory: false` aplica sin guardar paso
   * (vista en vivo mientras se arrastra un selector; el primer cambio del gesto sí lo guarda).
   */
  updateObjectsMeta: (
    ids: readonly string[],
    patch: Partial<Pick<SceneObject, 'color' | 'visible' | 'locked'>>,
    recordHistory?: boolean,
  ) => void;
  /**
   * Mayús+H en el visor: oculta la selección (o la muestra si ya estaba toda oculta); sin selección,
   * muestra todo lo oculto. Un solo paso de deshacer; devuelve los ids cambiados.
   */
  toggleSelectionVisibility: () => string[];
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
  /** Revalida el armado de piezas divididas (solo lectura, en el Worker); `null` si falló. */
  validateSplitAssembly: (targets: SceneObject[]) => Promise<ReturnType<typeof import('../engine').storedAssemblyResponse> | null>;
  /** Separa por colores en sólidos cerrados; `depthMm` es la capa que toma cada color hacia adentro. */
  splitObjectByColor: (id: string, options?: { depthMm?: number }) => Promise<SceneObject[]>;
  applyTextureToObject: (id: string, options: TextureOptions) => boolean;
  paintObjectSurface: (
    id: string,
    localPoint: Vec3 | null,
    faceIndex: number | null,
    modeOverride?: PaintBrushMode,
    /** Cámara o dirección de vista del pincel; sin ella se usa la normal de la cara más cercana. */
    view?: BrushView,
  ) => void;
  /** Abre un trazo de pincel: las muestras siguientes comparten un único paso de historial. */
  beginPaintStroke: () => void;
  endPaintStroke: () => void;
  /** true mientras haya un trazo de pincel abierto (entre beginPaintStroke y endPaintStroke). */
  isPaintStrokeOpen: () => boolean;
  /**
   * Trazo en vivo del visor: deja la malla lista para pintar (con colores por cara, sin historial)
   * y devuelve esa malla; `null` si el objeto no se puede pintar ahora.
   */
  preparePaintStroke: (id: string) => MeshData | null;
  /** Cierra el trazo en vivo: guarda la malla final y UN paso de historial (delta); `null` lo descarta. */
  commitPaintStroke: (id: string, result: import('../engine/paint/strokeSession').StrokeResult | null) => void;
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
  /**
   * Simplifica con verificación: un número es «Por tolerancia» (mm); si no, la petición con su modo. `true` si se
   * aplicó (un paso de deshacer). `onReport` recibe el informe aunque no se aplique (sin reducción o «Sin pérdida»
   * rechazado).
   */
  simplifySelectedMesh: (
    id: string,
    request: number | engine.SimplifyRequest,
    options?: { onReport?: (report: engine.SimplifyReport) => void },
  ) => Promise<boolean>;
  refineSelectedMesh: (
    id: string,
    targetEdgeLengthMm: number,
    smooth?: boolean,
  ) => Promise<boolean>;
  runConvexHull: (ids?: string[]) => Promise<SceneObject | null>;
  /**
   * Crea una pieza roscada. Un agujero (`kind: 'hole'`) con `targetId` (o con un único objeto
   * seleccionado) se coloca centrado en la cara superior de ese objeto, entrando hacia abajo, y queda
   * agrupado con él; sin objeto, va a un hueco libre.
   */
  createThreadObject: (options: ThreadOptions, extra?: { targetId?: string }) => Promise<SceneObject | null>;
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
  /** `asReference`: lo importado entra como referencia (se ve y se mide, no se imprime). */
  importMeshFromDialog: (placement?: engine.ImportPlacementMode, options?: { asReference?: boolean }) => Promise<void>;
  importModelFiles: (files: ModelImportSource[], options?: ModelImportOptions) => Promise<boolean>;
  /** Reescala unos objetos ×factor como bloque, en un paso deshacible (corrección de unidades al importar). */
  rescaleObjects: (ids: readonly string[], factor: number) => boolean;
  /** Exportación única (STL, 3MF, OBJ+MTL, GLB, PLY) de la selección o la escena. */
  exportModel: (request: ExportRequest) => Promise<boolean>;
  exportSceneStl: (onlySelected?: boolean) => Promise<boolean>;
  exportScene3mf: (onlySelected?: boolean) => Promise<boolean>;
  exportSelectedObj: () => Promise<boolean>;

  // Command Bus Unificado (UI, MCP y Chat IA)
  executeCommand: (
    req: KuraCommandRequest,
    source?: CommandSourceType,
  ) => Promise<KuraCommandResponse>;
}
