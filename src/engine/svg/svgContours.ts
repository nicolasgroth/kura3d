/**
 * @file src/engine/svg/svgContours.ts
 * @description Lector único de contornos SVG del motor: `THREE.SVGLoader` sobre el árbol de
 * `svgDocument.ts`, con la misma semántica en el hilo principal, el Worker y el MCP sin interfaz
 * (Node). Aplica `transform`, hereda estilos de `<g>`, resuelve `<use>` hacia `<defs>`, respeta
 * `fill-rule` y deja fuera lo que no tiene relleno (`fill="none"`): solo las regiones rellenas
 * se convierten en sólido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import type { SvgImportOptions } from '../../types/kura';
import type { SvgContourGroups } from '../svgContourPack';
import { SvgSyntaxError, withSvgDomParser } from './svgDocument';

/** Pasos por curva efectivos de una importación SVG. */
export function svgCurveSegments(options: Pick<SvgImportOptions, 'curveSegments'>): number {
  return Math.max(4, Math.round(options.curveSegments || 12));
}

/** Un elemento sin relleno visible no aporta sólido (el trazo no se convierte en volumen). */
function isFilled(style: { fill?: string; fillOpacity?: number } | undefined): boolean {
  const fill = style?.fill?.trim().toLowerCase();
  return fill !== 'none' && fill !== 'transparent' && style?.fillOpacity !== 0;
}

/**
 * Lee los contornos rellenos de un SVG. Cada grupo conserva su anillo exterior y sus agujeros
 * (regla par-impar dentro del grupo); los grupos distintos se unen luego con `CrossSection.union`.
 * La Y del SVG (hacia abajo) se invierte para que el diseño no quede espejado en la cama.
 * Un XML mal formado devuelve una lista vacía (el llamador lanza `SVG_NO_CONTOURS`).
 */
export function extractSvgElementGroups(svgContent: string, curveSegments: number): SvgContourGroups {
  let parsed: ReturnType<SVGLoader['parse']>;
  try {
    parsed = withSvgDomParser(() => new SVGLoader().parse(svgContent));
  } catch (err) {
    if (err instanceof SvgSyntaxError) return [];
    throw err;
  }

  const groups: SvgContourGroups = [];
  for (const path of parsed.paths) {
    if (!isFilled(path.userData?.style)) continue;
    for (const shape of SVGLoader.createShapes(path)) {
      const pts = shape.extractPoints(curveSegments);
      const group: [number, number][][] = [];
      if (pts.shape.length >= 3) group.push(pts.shape.map((p) => [p.x, -p.y]));
      for (const hole of pts.holes) {
        if (hole.length >= 3) group.push(hole.map((p) => [p.x, -p.y]));
      }
      if (group.length > 0) groups.push(group);
    }
  }
  return groups;
}
