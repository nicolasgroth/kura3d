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
  exportMeshToBinarySTL,
  exportMeshToOBJ,
  exportSceneTo3MF,
  exportSceneToBinarySTL,
  import3MFBuffer,
  importOBJText,
  importSTLBuffer,
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
