/**
 * @file src/components/inspector/inspectorTypes.ts
 * @description Tipos compartidos por las secciones del inspector: estado local del contenedor y props de sección.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type React from 'react';
import { type PrimitiveType, type SceneObject, type TexturePatternType } from '../../types/kura';

/** Estado local del inspector que vive en el contenedor (sobrevive a cambios de selección). */
export interface InspectorLocalState {
  wallThicknessMm: number;
  setWallThicknessMm: React.Dispatch<React.SetStateAction<number>>;
  drainHole: boolean;
  setDrainHole: React.Dispatch<React.SetStateAction<boolean>>;
  drainRadiusMm: number;
  setDrainRadiusMm: React.Dispatch<React.SetStateAction<number>>;
  texturePattern: TexturePatternType;
  setTexturePattern: React.Dispatch<React.SetStateAction<TexturePatternType>>;
  textureDepthMm: number;
  setTextureDepthMm: React.Dispatch<React.SetStateAction<number>>;
  textureScaleMm: number;
  setTextureScaleMm: React.Dispatch<React.SetStateAction<number>>;
  positionRelative: boolean;
  setPositionRelative: React.Dispatch<React.SetStateAction<boolean>>;
  rotationRelative: boolean;
  setRotationRelative: React.Dispatch<React.SetStateAction<boolean>>;
  scaleBySize: boolean;
  setScaleBySize: React.Dispatch<React.SetStateAction<boolean>>;
  modularShape: PrimitiveType;
  setModularShape: React.Dispatch<React.SetStateAction<PrimitiveType>>;
  simplifyTolMm: number;
  setSimplifyTolMm: React.Dispatch<React.SetStateAction<number>>;
  refineEdgeMm: number;
  setRefineEdgeMm: React.Dispatch<React.SetStateAction<number>>;
  refineSmooth: boolean;
  setRefineSmooth: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface InspectorSectionProps {
  primary: SceneObject;
  ui: InspectorLocalState;
}
