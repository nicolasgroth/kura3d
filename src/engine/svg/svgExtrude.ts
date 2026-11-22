/**
 * @file src/engine/svg/svgExtrude.ts
 * @description Extrusión de los contornos de un SVG a un sólido watertight con Manifold, escalado
 * al ancho físico pedido y apoyado sobre la cama. Los contornos salen del lector único
 * (`svgContours.ts`) o llegan ya leídos y empaquetados desde otro hilo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { CrossSection, Manifold } from 'manifold-3d';
import type { MeshData, SvgImportOptions } from '../../types/kura';
import { EngineError } from '../engineErrors';
import { initManifoldEngine, manifoldToMeshData } from '../manifoldKernel';
import { normalizeMeshToBed } from '../primitives';
import type { SvgContourGroups } from '../svgContourPack';
import { extractSvgElementGroups, svgCurveSegments } from './svgContours';

/**
 * Importa y extruye un SVG en un sólido cerrado, escalado a `targetWidth` mm y apoyado en Y=0.
 *
 * @param options Opciones de importación y extrusión SVG.
 * @param preParsedGroups Contornos ya leídos con `extractSvgElementGroups` (mismo resultado).
 * @returns Malla `MeshData` extruida en milímetros.
 */
export async function extrudeSvgToMesh(
  options: SvgImportOptions,
  preParsedGroups?: SvgContourGroups
): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const groups = preParsedGroups ?? extractSvgElementGroups(options.svgContent, svgCurveSegments(options));

  if (groups.length === 0) {
    throw new EngineError('SVG_NO_CONTOURS');
  }

  const elementSections: CrossSection[] = [];
  let rawUnion: CrossSection | null = null;
  let csUnion: CrossSection | null = null;
  let csScaled: CrossSection | null = null;
  let extruded: Manifold | null = null;
  let rotated: Manifold | null = null;

  try {
    for (const group of groups) {
      // Regla EvenOdd dentro de cada elemento para cortar sus propios agujeros internos
      const elemCs = wasm.CrossSection.ofPolygons(group, 'EvenOdd');
      if (!elemCs.isEmpty()) {
        elementSections.push(elemCs);
      } else {
        elemCs.delete();
      }
    }

    if (elementSections.length === 0) {
      throw new EngineError('SVG_ZERO_AREA');
    }

    // Unimos todos los elementos SVG independientes (como hace el renderizador SVG estándar)
    rawUnion =
      elementSections.length === 1
        ? elementSections[0]
        : wasm.CrossSection.union(elementSections);
    csUnion = rawUnion.simplify(1e-4);

    if (csUnion.isEmpty()) {
      throw new EngineError('SVG_ZERO_AREA');
    }

    const bounds = csUnion.bounds();
    const width = bounds.max[0] - bounds.min[0];
    const height = bounds.max[1] - bounds.min[1];
    const refSpan = width > 1e-4 ? width : Math.max(height, 1e-4);
    const scaleFactor = Math.max(1, options.targetWidth) / refSpan;

    csScaled = csUnion.scale([scaleFactor, scaleFactor]);
    const depthMm = Math.max(0.4, options.depth);
    extruded = csScaled.extrude(depthMm, 0, 0, [1, 1], false);
    // Rotamos -90° en X para que la extrusión apunte hacia +Y sobre la cama XZ
    rotated = extruded.rotate([-90, 0, 0]);

    const mesh = manifoldToMeshData(rotated);
    return normalizeMeshToBed(mesh);
  } finally {
    for (const sec of elementSections) {
      sec.delete();
    }
    if (rawUnion && !elementSections.includes(rawUnion)) {
      rawUnion.delete();
    }
    csUnion?.delete();
    csScaled?.delete();
    extruded?.delete();
    rotated?.delete();
  }
}
