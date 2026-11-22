/**
 * @file src/components/viewport/contextMenu/PieceShapeItems.tsx
 * @description Lista de formas del submenú "Agregar pieza" / "Agregar pieza negativa" (y de "Agregar forma"
 * del fondo del visor): Cubo, Cilindro, Esfera, Cono, Toroide, Prisma, Tubo hueco, Texto 3D, SVG e importar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Box, Circle, Cylinder, Donut, FileCode, FileUp, Hexagon, Triangle, Type, CircleDot } from 'lucide-react';
import type { PieceShape } from '../../../core/scene/pieceSizing';
import { t } from '../../../i18n';
import type { TranslationKey } from '../../../i18n';
import type { LanguageCode } from '../../../types/kura';
import { MenuItem } from './MenuKit';

export const PIECE_SHAPES: ReadonlyArray<{ shape: PieceShape; icon: React.ReactNode }> = [
  { shape: 'box', icon: <Box size={14} aria-hidden="true" /> },
  { shape: 'cylinder', icon: <Cylinder size={14} aria-hidden="true" /> },
  { shape: 'sphere', icon: <Circle size={14} aria-hidden="true" /> },
  { shape: 'cone', icon: <Triangle size={14} aria-hidden="true" /> },
  { shape: 'torus', icon: <Donut size={14} aria-hidden="true" /> },
  { shape: 'prism', icon: <Hexagon size={14} aria-hidden="true" /> },
  { shape: 'tube', icon: <CircleDot size={14} aria-hidden="true" /> },
  { shape: 'text', icon: <Type size={14} aria-hidden="true" /> },
  { shape: 'svg', icon: <FileCode size={14} aria-hidden="true" /> },
  { shape: 'import', icon: <FileUp size={14} aria-hidden="true" /> },
];

/** Etiqueta traducida de una forma. */
export const shapeLabel = (language: LanguageCode, shape: PieceShape): string =>
  t(language, `menu.shape.${shape}` as TranslationKey);

/** Ítems de formas; `shapes` limita cuáles se ofrecen. */
export const PieceShapeItems: React.FC<{
  language: LanguageCode;
  shapes?: readonly PieceShape[];
  onPick: (shape: PieceShape) => void;
}> = ({ language, shapes, onPick }) => (
  <>
    {PIECE_SHAPES.filter((s) => !shapes || shapes.includes(s.shape)).map(({ shape, icon }) => (
      <MenuItem key={shape} icon={icon} label={shapeLabel(language, shape)} onSelect={() => onPick(shape)} />
    ))}
  </>
);
