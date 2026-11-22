/**
 * @file src/engine/structuralSegmentation.ts
 * @description Índice del motor determinístico 100 % local de segmentación estructural (módulo
 * `./segmentation/`) y de la simetría especular (`./mirror`). Re-exporta la API pública.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export { STRUCTURAL_COLOR_PALETTE } from './segmentation/constants';
export { detectStructuralRegions } from './segmentation/detection';
export { applyStructureColorsToMesh } from './segmentation/coloring';
export { extractStructuralRegion } from './segmentation/extraction';
export { splitAllDetectedStructures } from './segmentation/separation';
export { mirrorMeshAxis } from './mirror';
