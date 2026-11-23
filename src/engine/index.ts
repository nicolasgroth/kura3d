/**
 * @file src/engine/index.ts
 * @description Punto de entrada único (barrel export) del núcleo geométrico de Kura3D.
 * Expone inicialización de Manifold-3D, primitivas paramétricas, operaciones CSG y
 * reparación/corte, geometría avanzada (SVG, relieve, texturas, pintado) y E/S STL/3MF/OBJ.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export {
  computeVertexNormals,
  createColorRegistry,
  getManifoldModule,
  initManifoldEngine,
  isManifoldReady,
  manifoldToMeshData,
  meshDataToManifold,
  takeImplicitWeldWarning,
  weldVertices,
} from './manifoldKernel';

export {
  applyTransformToMesh,
  computeMeshStats,
  createBufferGeometryFromMeshData,
  createPrimitiveMesh,
  normalizeMeshToBed,
} from './primitives';

export {
  eraseRegionWithSphere,
  hollowMesh,
  planeCutWithConnectors,
  runBooleanOperation,
  splitDisconnectedParts,
  splitMeshByColor,
} from './operations';

export {
  applyProceduralTexture,
  extractSvgElementGroups,
  extrudeSvgToMesh,
  generateReliefFromImage,
  svgCurveSegments,
  paintEntireMesh,
  paintFloodFillConnectedFaces,
  paintMeshFacesInSphere,
} from './advancedGeometry';
export { packSvgContours, unpackSvgContours, type PackedSvgContours, type SvgContourGroups } from './svgContourPack';

export {
  DEFAULT_IMPORT_LIMITS,
  MODEL_IMPORT_ACCEPT,
  MODEL_IMPORT_EXTENSIONS,
  ModelImportError,
  detectModelFormat,
  exportMeshToBinarySTL,
  exportMeshToOBJ,
  exportSceneTo3MF,
  exportSceneToBinarySTL,
  exportSceneToGLB,
  exportSceneToOBJ,
  exportSceneToPLY,
  stlBrandHeader,
  import3MFBuffer,
  importOBJText,
  importSTLBuffer,
  objMaterialLibraries,
  parseModelFile,
  parseModelFileAsync,
  createModelImportSession,
  sourceBytes,
  type ModelImportSession,
  type ModelSourceData,
  type MtlSource,
  clustersOf,
  findImportClusters,
  placeImportedModels,
  read3MF,
  readOBJ,
  readPLY,
  readSTL,
  type FootprintXZ,
  type ImportCluster,
  type ImportPlacementMode,
  type ImportedModel,
  type ImportedPart,
  type MeshImportOptions,
  type ModelImportErrorCode,
  type ModelParseOptions,
  type PlacedPart,
} from './ioFormats';

export { generateMold, generateMoldDetailed, safeSpoutRadius, type GeneratedMold, type GeneratedMoldPart } from './molds';

export { projectGraphicOntoSurface } from './surfaceProjection';
export {
  listProjectionFaces,
  suggestProjectionFace,
  suggestProjectionWidth,
  type PlanarProjectionAxis,
  type ProjectionFaceCandidate,
} from './projectionSuggest';
export { registerTextFont, registeredTextFonts, DEFAULT_TEXT_FONT_ID } from './text/fontRegistry';

export {
  analyzePrintability,
  computeConvexHull,
  refineMesh,
  simplifyMesh,
} from './analysis';

export { localizePrintWarning, PRINT_FILAMENT_DIAMETER_MM, PRINT_SHELL_FRACTION } from './printability';

export { flipTriangleWinding, orientationState, signedVolumeMm3, type OrientationState } from './meshOrientation';

export {
  createMetricThread,
  generateCylindricalLithophane,
  generateSilhouetteOrCutterFromImage,
} from './generators';
export {
  cylindricalLithophaneSize,
  IMAGE_RELIEF_APPLICABLE_PARAMS,
  type CylindricalLithophaneSize,
  type ImageReliefParam,
  type ImageShapeMode,
} from './imageReliefParams';

export { computeAlignmentPositions } from './alignment';

export {
  STRUCTURAL_COLOR_PALETTE,
  applyStructureColorsToMesh,
  detectStructuralRegions,
  extractStructuralRegion,
  mirrorMeshAxis,
  splitAllDetectedStructures,
} from './structuralSegmentation';

export {
  ENGINE_ERROR_CODES,
  ENGINE_WARNING_CODES,
  EngineError,
  isEngineError,
  localizeEngineError,
  localizeEngineWarning,
  type EngineErrorCode,
  type EngineWarning,
  type EngineWarningCode,
} from './engineErrors';

export { hollowMeshDetailed, type HollowResult } from './hollow';

export { computeWorldStats } from './worldStats';

export { refineMeshDetailed, type RefineResult } from './refine';

export { splitMeshByColorSolid, type ColorSplitOptions, type SolidColorPart, type SolidColorSplitResult } from './colorSplitSolid';

export { isClosedMesh } from './meshClosure';

export {
  diagnoseMesh,
  repairMeshData,
  repairMeshVerified,
  manifoldAccepts,
  isMeshClosed,
  closureCounts,
  CLOSURE_WELD_MM,
  DEFAULT_REPAIR_WELD_MM,
  type MeshDiagnosis,
  type MeshDiagnosisSummary,
  type MeshHole,
  type MeshRepairOptions,
  type MeshRepairReport,
  type VerifiedRepair,
} from './repair';

export {
  OPERATION_RANGES,
  TRANSFORM_LIMITS,
  TRANSFORM_RANGES,
  describeOperationRange,
  isInOperationRange,
  type OperationRange,
} from './operationLimits';
export * from './split';
