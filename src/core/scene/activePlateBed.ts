/**
 * @file src/core/scene/activePlateBed.ts
 * @description Punto único de la cama activa: cama del proyecto (medidas personalizadas o perfil de impresora)
 * y, si la escena tiene placas, la cama y el origen de la placa activa. `activeBed()` (Dividir y comandos) y
 * `activeBedSize()` (colocar piezas) derivan de aquí. Sin placas, o con placas que usan la cama del proyecto, las
 * medidas son idénticas a las de antes y el origen es [0, 0] para la placa implícita.
 *
 * Lectores con origen (P2): `placementBedSize` (colocar lo nuevo), `plateFrameFor` (centrar, acomodar, ajustar a la
 * impresora, orientar) y el estado de volumen por placa (`components/viewport/plateBedStatus.ts`). El resto de los
 * lectores de la cama usa solo las medidas, que equivale a trabajar sobre la placa del origen.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { ScenePlate } from '../../types/plates';
import { plateBed, resolveActivePlate, type ProjectBed } from './plates';

/** Lo mínimo del estado que define la cama: perfil, medidas personalizadas y, opcionalmente, placas. */
export interface PlateBedSource {
  printerProfile: { bedWidthMm: number; bedDepthMm: number; maxHeightMm: number; marginMm?: number };
  customBedDimensions: { width: number; depth: number; height: number } | null;
  plates?: readonly ScenePlate[];
  activePlateId?: string | null;
}

/** Cama de la placa activa con su ubicación en el mundo. */
export interface ActivePlateBed {
  bed: ProjectBed;
  /** Centro de la cama [X, Z] en mm de mundo. */
  origin: [number, number];
  /** Placa activa; null = placa implícita (escena sin placas). */
  plateId: string | null;
}

/** Cama del proyecto: medidas personalizadas si las hay, si no las del perfil. */
export function projectBed(source: Pick<PlateBedSource, 'printerProfile' | 'customBedDimensions'>): ProjectBed {
  const c = source.customBedDimensions;
  if (c) return { widthMm: c.width, depthMm: c.depth, heightMm: c.height };
  const p = source.printerProfile;
  return { widthMm: p.bedWidthMm, depthMm: p.bedDepthMm, heightMm: p.maxHeightMm };
}

/** Cama, origen e id de la placa activa (la implícita en el origen si no hay placas). */
export function activePlateBed(source: PlateBedSource): ActivePlateBed {
  const base = projectBed(source);
  const plate = resolveActivePlate(source.plates ?? [], source.activePlateId);
  if (!plate) return { bed: base, origin: [0, 0], plateId: null };
  return { bed: plateBed(plate, base), origin: [plate.origin[0], plate.origin[1]], plateId: plate.id };
}
