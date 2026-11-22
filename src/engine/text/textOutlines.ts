/**
 * @file src/engine/text/textOutlines.ts
 * @description Maquetación de texto con una fuente real y aplanado de sus contornos Bézier a
 * polígonos 2D en mm. "Tamaño" = alto de mayúscula (la "H" mide exactamente `size`). Aplica avance
 * y kerning de la fuente, espaciado extra entre letras, varias líneas (`\n`) y alineación. Los
 * agujeros (o, a, e, 8…) quedan como contornos de giro opuesto: se rellenan con la regla NonZero de
 * TrueType. Es puro (sin WASM): lo comparten la primitiva de texto y la proyección sobre superficies.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { PathCommand } from 'opentype.js';
import { EngineError } from '../engineErrors';
import type { TextFontFace } from './fontRegistry';

export type TextAlign = 'left' | 'center' | 'right';
/** Punto 2D en mm. */
export type Point2 = [number, number];
/** Contorno cerrado (sin repetir el primer punto al final). */
export type Contour = Point2[];

export interface TextLayoutOptions {
  /** Alto de mayúscula en mm. */
  size: number;
  /** Espacio extra entre letras consecutivas en mm (puede ser negativo). */
  letterSpacing?: number;
  /** Alineación de cada línea respecto de la más ancha. */
  align?: TextAlign;
  /** Desviación máxima de cuerda al aplanar curvas, en mm. */
  toleranceMm?: number;
}

export interface TextLineLayout {
  /** Desplazamiento X del inicio de la línea (mm). */
  x: number;
  /** Línea base (mm, Y hacia arriba; la primera línea en 0). */
  baseline: number;
  /** Avance total de la línea (mm). */
  width: number;
}

export interface TextOutlineLayout {
  /** Contornos de cada glifo con tinta, ya posicionados (mm). */
  glyphs: Contour[][];
  lines: TextLineLayout[];
  /** Avance de la línea más ancha (mm). */
  advanceWidth: number;
  /** Caja de la tinta (mm). */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/** Tolerancia de cuerda por defecto (mm). */
export const TEXT_CHORD_TOLERANCE_MM = 0.05;
const MAX_CURVE_SEGMENTS = 48;
const WHITESPACE = /^\s$/u;

/** Caracteres que la fuente no puede dibujar (sin repetir, en orden de aparición). */
export function findMissingGlyphs(face: TextFontFace, text: string): string[] {
  const missing = new Set<string>();
  for (const ch of Array.from(text)) {
    if (WHITESPACE.test(ch)) continue;
    if (face.font.charToGlyphIndex(ch) === 0) missing.add(ch);
  }
  return [...missing];
}

/** Lanza `TEXT_GLYPH_MISSING` si algún carácter no existe en la fuente. */
export function assertGlyphsAvailable(face: TextFontFace, text: string): void {
  const missing = findMissingGlyphs(face, text);
  if (missing.length > 0) {
    throw new EngineError('TEXT_GLYPH_MISSING', { chars: missing.join(' '), font: face.id });
  }
}

/** Segmentos para que una curva con "curvatura" `bend` (mm) no se desvíe más de `tol`. */
function segmentsFor(bend: number, factor: number, tol: number): number {
  const n = Math.ceil(Math.sqrt((factor * bend) / tol));
  return Math.max(1, Math.min(MAX_CURVE_SEGMENTS, Number.isFinite(n) ? n : 1));
}

/** Aplana los comandos de un glifo (unidades de fuente, Y arriba) a contornos en mm. */
function flattenGlyph(commands: PathCommand[], ox: number, oy: number, scale: number, tol: number): Contour[] {
  const contours: Contour[] = [];
  let current: Contour = [];
  let px = 0;
  let py = 0;
  const push = (x: number, y: number) => {
    const last = current[current.length - 1];
    if (!last || Math.abs(last[0] - x) > 1e-9 || Math.abs(last[1] - y) > 1e-9) current.push([x, y]);
  };
  const close = () => {
    if (current.length > 1) {
      const [fx, fy] = current[0];
      const [lx, ly] = current[current.length - 1];
      if (Math.abs(fx - lx) < 1e-9 && Math.abs(fy - ly) < 1e-9) current.pop();
    }
    if (current.length >= 3) contours.push(current);
    current = [];
  };
  const X = (x: number) => ox + x * scale;
  const Y = (y: number) => oy + y * scale;

  for (const c of commands) {
    switch (c.type) {
      case 'M':
        close();
        px = X(c.x); py = Y(c.y);
        push(px, py);
        break;
      case 'L':
        px = X(c.x); py = Y(c.y);
        push(px, py);
        break;
      case 'Q': {
        const x1 = X(c.x1), y1 = Y(c.y1), x2 = X(c.x), y2 = Y(c.y);
        // Error de cuerda de una cuadrática con paso 1/n: |P0 − 2P1 + P2| / (4n²).
        const n = segmentsFor(Math.hypot(px - 2 * x1 + x2, py - 2 * y1 + y2), 0.25, tol);
        for (let i = 1; i <= n; i++) {
          const t = i / n, mt = 1 - t;
          push(mt * mt * px + 2 * mt * t * x1 + t * t * x2, mt * mt * py + 2 * mt * t * y1 + t * t * y2);
        }
        px = x2; py = y2;
        break;
      }
      case 'C': {
        const x1 = X(c.x1), y1 = Y(c.y1), x2 = X(c.x2), y2 = Y(c.y2), x3 = X(c.x), y3 = Y(c.y);
        // Cúbica: |B''| ≤ 6·max(|P0 − 2P1 + P2|, |P1 − 2P2 + P3|) → error ≤ 3M / (4n²).
        const bend = Math.max(Math.hypot(px - 2 * x1 + x2, py - 2 * y1 + y2), Math.hypot(x1 - 2 * x2 + x3, y1 - 2 * y2 + y3));
        const n = segmentsFor(bend, 0.75, tol);
        for (let i = 1; i <= n; i++) {
          const t = i / n, mt = 1 - t;
          const a = mt * mt * mt, b = 3 * mt * mt * t, d = 3 * mt * t * t, e = t * t * t;
          push(a * px + b * x1 + d * x2 + e * x3, a * py + b * y1 + d * y2 + e * y3);
        }
        px = x3; py = y3;
        break;
      }
      case 'Z':
        close();
        break;
    }
  }
  close();
  return contours;
}

/**
 * Maqueta `text` con la fuente `face` y devuelve los contornos de cada glifo en mm (Y arriba,
 * primera línea base en Y = 0). Lanza `TEXT_GLYPH_MISSING` si falta algún carácter.
 */
export function layoutTextOutlines(face: TextFontFace, text: string, options: TextLayoutOptions): TextOutlineLayout {
  assertGlyphsAvailable(face, text);
  const { font } = face;
  const scale = options.size / face.capHeight;
  const spacing = options.letterSpacing ?? 0;
  const tol = Math.max(1e-4, options.toleranceMm ?? TEXT_CHORD_TOLERANCE_MM);
  const lineStep = face.lineHeight * scale;

  // 1) Avances por línea (unidades → mm), con kerning entre pares de la misma línea.
  const rawLines = text.replace(/\r\n?/g, '\n').split('\n');
  const placed: Array<{ line: number; x: number; commands: PathCommand[] }> = [];
  const widths: number[] = [];
  rawLines.forEach((line, li) => {
    let cursor = 0;
    let prev = -1;
    for (const ch of Array.from(line)) {
      const glyph = font.charToGlyph(ch);
      if (prev >= 0) cursor += font.getKerningValue(prev, glyph.index) * scale + spacing;
      const commands = glyph.path?.commands ?? [];
      if (commands.length > 0) placed.push({ line: li, x: cursor, commands });
      cursor += (glyph.advanceWidth ?? 0) * scale;
      prev = glyph.index;
    }
    widths.push(Math.max(0, cursor));
  });

  // 2) Alineación respecto de la línea más ancha.
  const maxWidth = Math.max(0, ...widths);
  const align = options.align ?? 'left';
  const lines: TextLineLayout[] = widths.map((w, li) => ({
    x: align === 'center' ? (maxWidth - w) / 2 : align === 'right' ? maxWidth - w : 0,
    baseline: -li * lineStep,
    width: w,
  }));

  // 3) Contornos aplanados.
  const glyphs: Contour[][] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const g of placed) {
    const contours = flattenGlyph(g.commands, lines[g.line].x + g.x, lines[g.line].baseline, scale, tol);
    if (contours.length === 0) continue;
    for (const contour of contours) {
      for (const [x, y] of contour) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    glyphs.push(contours);
  }
  if (glyphs.length === 0) minX = minY = maxX = maxY = 0;
  return { glyphs, lines, advanceWidth: maxWidth, bounds: { minX, minY, maxX, maxY } };
}
