/**
 * @file src/core/scene/plateFitBed.ts
 * @description Cama con margen para «Ajustar a la impresora» y «Orientar» (función pura, sin store): sin placas, la del
 * proyecto (perfil o medidas personalizadas); con placas, la de la placa de las piezas (o la activa), con el margen de
 * su cama propia si lo trae (P7, otra impresora). La usan el store, el bus y el MCP sin interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { fitBedOf } from '../operations/fitOperations';
import type { FitBed } from '../../engine/fitToBed';
import type { SceneObject } from '../../types/kura';
import type { PlateBedSource } from './activePlateBed';
import { plateFrameFor } from './plateFrame';

export function activeFitBed(s: PlateBedSource, targets?: ReadonlyArray<Pick<SceneObject, 'plateRef'>>): FitBed {
  if (!s.plates?.length) return fitBedOf(s.printerProfile, s.customBedDimensions);
  const { bed } = plateFrameFor(s, targets);
  return fitBedOf(s.printerProfile, { width: bed.widthMm, depth: bed.depthMm, height: bed.heightMm }, bed.marginMm);
}
