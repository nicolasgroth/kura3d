/**
 * @file src/store/splitMagnetParams.ts
 * @description Parámetros de la unión con imanes del comando `split_for_bed` (`connectorType: 'magnet'`): diámetro y
 * alto del imán, holguras (las del alojamiento de imán) y cantidad por unión (`'auto'` o un número). Mismos rangos
 * que el alojamiento de imán (`MAGNET_RANGES`); por defecto el imán de fábrica (Ø5 × 2, holgura +0,2 / +0,2).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { MAGNET_DEFAULTS, MAGNET_RANGES } from '../core/addons/magnetPocket';
import type { SplitConnectorOptions } from '../engine';
import { OPERATION_RANGES as OR } from '../engine/operationLimits';
import { magnetConnector } from '../engine/split/splitMagnet';
import { pick, readRange, type RawParams } from './commandValidation';

/** Conector de imanes a partir de los parámetros del comando (valida rangos; lanza si alguno no sirve). */
export function readMagnetConnector(p: RawParams): SplitConnectorOptions {
  const count = pick(p, 'magnetCount');
  return magnetConnector(
    {
      shape: 'round',
      sizeMm: readRange(p, MAGNET_RANGES.sizeMm, 'magnetDiameterMm') ?? MAGNET_DEFAULTS.sizeMm,
      heightMm: readRange(p, MAGNET_RANGES.heightMm, 'magnetHeightMm') ?? MAGNET_DEFAULTS.heightMm,
      clearanceMm: readRange(p, MAGNET_RANGES.clearanceMm, 'magnetClearanceMm') ?? MAGNET_DEFAULTS.clearanceMm,
      depthClearanceMm: readRange(p, MAGNET_RANGES.depthClearanceMm, 'magnetDepthClearanceMm') ?? MAGNET_DEFAULTS.depthClearanceMm,
      hidden: false,
    },
    !count || count[1] === 'auto' ? 'auto' : (readRange(p, OR.cut.connectorCount, 'magnetCount') ?? 2),
  );
}
