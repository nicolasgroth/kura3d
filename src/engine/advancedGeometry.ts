/**
 * @file src/engine/advancedGeometry.ts
 * @description Fachada de compatibilidad de las herramientas geométricas avanzadas. Cada una vive
 * en su módulo: lector y extrusión SVG en `./svg/`, relieve de imagen en `./imageRelief`,
 * texturas procedurales en `./proceduralTexture` y pintado por cara en `./paint/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export { extractSvgElementGroups, svgCurveSegments } from './svg/svgContours';
export { extrudeSvgToMesh } from './svg/svgExtrude';
export { generateReliefFromImage } from './imageRelief';
export { applyProceduralTexture } from './proceduralTexture';
export {
  DEFAULT_UNPAINTED_COLOR,
  paintEntireMesh,
  paintFloodFillConnectedFaces,
  paintMeshFacesInSphere,
} from './paint';
