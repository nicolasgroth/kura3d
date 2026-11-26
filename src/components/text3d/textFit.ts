/**
 * @file src/components/text3d/textFit.ts
 * @description Estimación del ancho de un texto 3D antes de crearlo (con la misma fuente y maquetación del motor)
 * y comprobación contra la cama: ancho resultante, si cabe y el alto de letra sugerido para que quepa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { useEffect, useState } from 'react';
import { DEFAULT_TEXT_FONT_ID, loadTextFont } from '../../engine/text/fontRegistry';
import { layoutTextOutlines } from '../../engine/text/textOutlines';
import { activeBedSize } from '../../store/bedSize';
import { useKuraStore } from '../../store/useKuraStore';

/** Nombre mostrado de la fuente del texto 3D (única incluida: Roboto Bold, subconjunto latino). */
export const TEXT_FONT_LABEL = 'Roboto Bold';

/** Margen que se deja a cada lado de la cama al sugerir un tamaño (mm). */
const BED_MARGIN_MM = 2;

/** Ancho de tinta (mm) del texto con ese alto de letra, o null si no se puede medir (vacío, glifos que faltan). */
export async function measureTextWidthMm(text: string, sizeMm: number, letterSpacingMm = 0): Promise<number | null> {
  const trimmed = text.replace(/\r/g, '').trim();
  if (!trimmed || !(sizeMm > 0)) return null;
  try {
    const face = await loadTextFont(DEFAULT_TEXT_FONT_ID);
    const { bounds } = layoutTextOutlines(face, trimmed, { size: sizeMm, letterSpacing: letterSpacingMm, toleranceMm: 0.5 });
    const width = bounds.maxX - bounds.minX;
    return width > 0 ? width : null;
  } catch {
    return null;
  }
}

export interface TextFit {
  widthMm: number | null;
  /** Lado mayor de la cama (mm), o null si no hay medidas. */
  bedMm: number | null;
  fits: boolean;
  /** Alto de letra (mm) con el que cabría, redondeado hacia abajo a 0,5 mm; null si ya cabe o no se sabe. */
  suggestedSizeMm: number | null;
}

/** Pura: decide si cabe y qué tamaño sugerir a partir del ancho medido. */
export function evaluateTextFit(widthMm: number | null, sizeMm: number, bedMm: number | null): TextFit {
  if (widthMm === null || bedMm === null) return { widthMm, bedMm, fits: true, suggestedSizeMm: null };
  const fits = widthMm <= bedMm - BED_MARGIN_MM;
  if (fits) return { widthMm, bedMm, fits, suggestedSizeMm: null };
  const scaled = Math.floor(((sizeMm * (bedMm - BED_MARGIN_MM * 2)) / widthMm) * 2) / 2;
  return { widthMm, bedMm, fits, suggestedSizeMm: scaled >= 1 ? scaled : null };
}

/** Hook: mide el texto tras una pausa corta y lo compara con la cama activa. */
export function useTextFit(text: string, sizeMm: number, letterSpacingMm = 0): TextFit {
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const customBedDimensions = useKuraStore((s) => s.customBedDimensions);
  const bed = activeBedSize({ printerProfile, customBedDimensions });
  const bedMm = bed ? Math.max(bed.width, bed.depth) : null;
  const [widthMm, setWidthMm] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void measureTextWidthMm(text, sizeMm, letterSpacingMm).then((w) => {
        if (!cancelled) setWidthMm(w);
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [text, sizeMm, letterSpacingMm]);

  return evaluateTextFit(widthMm, sizeMm, bedMm);
}
