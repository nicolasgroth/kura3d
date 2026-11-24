/**
 * @file src/engine/smooth/index.ts
 * @description API pública de «Suavizar malla» (Taubin λ/μ con zona, protección de aristas vivas y
 * bordes, y detección de daño).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export { smoothMesh, signedVolume, trianglesWithColor, type SmoothReport, type SmoothResult } from './smoothMesh';
export {
  SMOOTH_DEFAULTS,
  SMOOTH_RANGES,
  resolveSmoothOptions,
  taubinCoefficients,
  type SmoothOptions,
  type SmoothZone,
} from './smoothOptions';
export { detectSmoothDamage, type SmoothDamage } from './smoothDamage';
