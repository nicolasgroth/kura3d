/**
 * @file src/core/scene/bedLabel.ts
 * @description Cama que nombra el rótulo «Cama: …» del visor: la de la placa activa si esa placa tiene cama propia
 * (su nombre y sus medidas); si no, la del proyecto (impresora y medidas del perfil). Se apoya en `activePlateBed`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { activePlateBed, type PlateBedSource } from './activePlateBed';
import { resolveActivePlate } from './plates';

export interface HudBed {
  /** Nombre propio de la cama de la placa activa; null = la del proyecto (el llamador pone el nombre de la impresora). */
  ownName: string | null;
  widthMm: number;
  depthMm: number;
  heightMm: number;
}

/** Cama de la placa activa para el rótulo del visor. */
export function hudBed(source: PlateBedSource): HudBed {
  const { bed } = activePlateBed(source);
  const plate = resolveActivePlate(source.plates ?? [], source.activePlateId);
  const ownName = plate?.bed ? plate.bed.name : null;
  return { ownName, widthMm: bed.widthMm, depthMm: bed.depthMm, heightMm: bed.heightMm };
}
