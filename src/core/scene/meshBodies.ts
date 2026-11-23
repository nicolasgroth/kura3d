/**
 * @file src/core/scene/meshBodies.ts
 * @description Conteo de cuerpos sueltos de una malla. La implementación vive en el motor
 * (`src/engine/io/meshBodies.ts`) para que el Worker de importación la use sin depender de `core`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export { cachedMeshBodies, countMeshBodies, MAX_BODY_COUNT_TRIANGLES } from '../../engine/io/meshBodies';
