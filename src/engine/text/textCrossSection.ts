/**
 * @file src/engine/text/textCrossSection.ts
 * @description Convierte los contornos maquetados de un texto en una `CrossSection` de Manifold:
 * cada glifo con regla NonZero (respeta sus agujeros) y unión booleana entre glifos (por si el
 * kerning o un espaciado negativo los solapa). Lo usan la primitiva de texto y la proyección.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { CrossSection, ManifoldToplevel } from 'manifold-3d';
import { EngineError } from '../engineErrors';
import { loadTextFont, DEFAULT_TEXT_FONT_ID } from './fontRegistry';
import { layoutTextOutlines, type TextAlign, type TextOutlineLayout } from './textOutlines';

export interface TextShapeOptions {
  /** Alto de mayúscula en mm. */
  size: number;
  letterSpacing?: number;
  align?: TextAlign;
  fontId?: string;
}

/** Une los glifos de un layout en una sola sección 2D (el llamador libera el resultado). */
export function outlinesToCrossSection(wasm: ManifoldToplevel, layout: TextOutlineLayout): CrossSection {
  const parts: CrossSection[] = [];
  try {
    for (const contours of layout.glyphs) {
      parts.push(wasm.CrossSection.ofPolygons(contours, 'NonZero'));
    }
    if (parts.length === 0) {
      throw new EngineError('INVALID_PARAMETER', { name: 'text', value: '""', min: 1, max: 0 });
    }
    return parts.length === 1 ? parts[0].translate([0, 0]) : wasm.CrossSection.union(parts);
  } finally {
    for (const p of parts) p.delete();
  }
}

/** Carga la fuente (diferida) y construye la sección 2D del texto en mm. */
export async function buildTextCrossSection(
  wasm: ManifoldToplevel,
  text: string,
  options: TextShapeOptions
): Promise<CrossSection> {
  const face = await loadTextFont(options.fontId ?? DEFAULT_TEXT_FONT_ID);
  const layout = layoutTextOutlines(face, text, {
    size: options.size,
    letterSpacing: options.letterSpacing,
    align: options.align,
  });
  return outlinesToCrossSection(wasm, layout);
}
