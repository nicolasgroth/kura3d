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
  extrudeSvgToMesh,
  generateReliefFromImage,
  paintEntireMesh,
  paintFloodFillConnectedFaces,
  paintMeshFacesInSphere,
} from './advancedGeometry';

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
  import3MFBuffer,
  importOBJText,
  importSTLBuffer,
  objMaterialLibraries,
  parseModelFile,
  parseModelFileAsync,
  placeImportedModels,
  read3MF,
  readOBJ,
  readPLY,
  readSTL,
  type FootprintXZ,
  type ImportPlacementMode,
  type ImportedModel,
  type ImportedPart,
  type MeshImportOptions,
  type ModelImportErrorCode,
  type ModelParseOptions,
  type PlacedPart,
} from './ioFormats';

export { generateMold, type GeneratedMoldPart } from './molds';

export { projectGraphicOntoSurface } from './surfaceProjection';

export {
  analyzePrintability,
  computeConvexHull,
  refineMesh,
  simplifyMesh,
} from './analysis';

export {
  createMetricThread,
  generateCylindricalLithophane,
  generateSilhouetteOrCutterFromImage,
} from './generators';

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

export { splitMeshByColorDetailed, type ColorSplitResult } from './colorSplit';

export { isClosedMesh } from './meshClosure';

export {
  OPERATION_RANGES,
  TRANSFORM_LIMITS,
  TRANSFORM_RANGES,
  describeOperationRange,
  isInOperationRange,
  type OperationRange,
} from './operationLimits';
