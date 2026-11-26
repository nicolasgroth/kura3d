/**
 * @file src/engine/paint/index.ts
 * @description Módulo de pintura por caras: pincel esférico (con borde fino opcional), relleno por
 * región, pintar todo y capa de acceso a los colores por cara.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export { paintMeshFacesInSphere, type BrushOptions } from './brush';
export { paintEntireMesh, paintFloodFillConnectedFaces } from './fill';
export { DEFAULT_MAX_NEW_TRIANGLES, refineBrushEdge } from './edgeRefine';
export {
  DEFAULT_UNPAINTED_COLOR,
  FaceColorWriter,
  faceColorAt,
  fromFaceColorPalette,
  hasFaceColors,
  toFaceColorPalette,
  type FaceColorPalette,
} from './faceColors';
