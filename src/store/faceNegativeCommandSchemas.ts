/**
 * @file src/store/faceNegativeCommandSchemas.ts
 * @description Esquemas de los comandos `add_keyhole` (ojo de cerradura para colgar en el muro) y `add_cable_pass`
 * (paso de cable): medidas con sus rangos y valores por defecto (la medida de tornillo elige el preajuste incluido;
 * la forma del paso elige el suyo), los bloqueos tipados y la forma de la respuesta (negativo creado, lugar, informe
 * y avisos con código y mensaje en inglés). Lo comparten el Command Bus de la app y el MCP sin interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { parseAddonPlacement, placementToUser, type AddonPlacementInput, type ResolvedPlacement } from '../core/addons/addonPlacement';
import { CABLE_PASS_RANGES, invalidCablePassFields, type CablePassParams } from '../core/addons/cablePass';
import type { CablePassReport } from '../core/addons/cablePassAnalysis';
import { CABLE_PASS_DEFAULTS, CABLE_SLOT_DEFAULTS } from '../core/addons/cablePassPresets';
import { invalidKeyholeFields, KEYHOLE_RANGES, type KeyholeParams } from '../core/addons/keyhole';
import type { KeyholeReport } from '../core/addons/keyholeAnalysis';
import { BUILTIN_KEYHOLE_PRESETS, KEYHOLE_DEFAULTS } from '../core/addons/keyholePresets';
import { CommandError } from '../core/bus/commandErrors';
import { readBoolean, readEnum, readRange, type RawParams } from '../core/bus/commandValidation';
import type { SceneObject } from '../types/kura';
import { addonBlockedError, warningsOf } from './addonCommandSchemas';
import { cablePassWarnings } from './cablePassWarnings';
import { keyholeWarnings } from './keyholeWarnings';

const invalid = (param: string, expected: string) => new CommandError('invalid-params', 'bus.error.invalidParam', { param, expected });
const r = (n: number, digits = 3) => Math.round(n * 10 ** digits) / 10 ** digits + 0;
const rn = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? null : r(n));

/** Bloqueos de estos negativos (`spansFace`: más ancho que la cara; `notRetained`: el labio del ojo no retiene). */
export type FaceNegativeBlock = 'spansFace' | 'notRetained';

/** Error `addon-blocked` con el texto propio del agregado (el mismo de la app). */
export function faceNegativeBlockedError(kind: 'keyhole' | 'cable_pass', reason: FaceNegativeBlock): CommandError {
  if (kind === 'cable_pass') return addonBlockedError('spansFace', 'cable.error.tooWide');
  return reason === 'notRetained' ? addonBlockedError('notRetained') : addonBlockedError('spansFace', 'keyhole.error.tooWide');
}

/**
 * Ojo de cerradura: `screwMm` elige el preajuste incluido de esa medida (3, 3,5, 4, 5 mm) como base, o el de 4 mm; las
 * medidas explícitas mandan. El cuello debe quedar al menos 0,5 mm más angosto que la cabeza y la ranura lo bastante
 * larga para que la cabeza quede bajo el labio.
 */
export function parseKeyholeCommand(p: RawParams): { params: KeyholeParams; placement: AddonPlacementInput } {
  const R = KEYHOLE_RANGES;
  const screwMm = readRange(p, R.screwMm, 'screwMm');
  const base = BUILTIN_KEYHOLE_PRESETS.find((b) => b.values.screwMm === screwMm)?.values ?? KEYHOLE_DEFAULTS;
  const params: KeyholeParams = {
    screwMm: screwMm ?? base.screwMm,
    headDiameterMm: readRange(p, R.headDiameterMm, 'headDiameterMm') ?? base.headDiameterMm,
    neckWidthMm: readRange(p, R.neckWidthMm, 'neckWidthMm') ?? base.neckWidthMm,
    slotLengthMm: readRange(p, R.slotLengthMm, 'slotLengthMm') ?? base.slotLengthMm,
    chamberDepthMm: readRange(p, R.chamberDepthMm, 'chamberDepthMm') ?? base.chamberDepthMm,
    lipMm: readRange(p, R.lipMm, 'lipMm') ?? base.lipMm,
    angleDeg: readRange(p, R.angleDeg, 'angleDeg') ?? base.angleDeg,
  };
  const [bad] = invalidKeyholeFields(params);
  if (bad === 'neckWidthMm') throw invalid(bad, 'at least 0.5 mm narrower than headDiameterMm');
  if (bad === 'slotLengthMm') throw invalid(bad, '≥ (headDiameterMm + neckWidthMm) / 2');
  if (bad) throw invalid(bad, `${R[bad].min}–${R[bad].max}`);
  return { params, placement: parseAddonPlacement(p) };
}

/** Paso de cable: `shape` (round por defecto, slot) elige sus valores por defecto; `autoDepth` mide la pared. */
export function parseCablePassCommand(p: RawParams): { params: CablePassParams; placement: AddonPlacementInput } {
  const R = CABLE_PASS_RANGES;
  const shape = readEnum(p, ['round', 'slot'] as const, 'shape') ?? CABLE_PASS_DEFAULTS.shape;
  const base = shape === 'slot' ? CABLE_SLOT_DEFAULTS : CABLE_PASS_DEFAULTS;
  const widthMm = readRange(p, R.widthMm, 'widthMm') ?? base.widthMm;
  const params: CablePassParams = {
    shape,
    widthMm,
    lengthMm: readRange(p, R.lengthMm, 'lengthMm') ?? (shape === 'slot' ? Math.max(base.lengthMm, widthMm) : widthMm),
    chamferMm: readRange(p, R.chamferMm, 'chamferMm') ?? base.chamferMm,
    angleDeg: readRange(p, R.angleDeg, 'angleDeg') ?? base.angleDeg,
    autoDepth: readBoolean(p, 'autoDepth') ?? base.autoDepth,
    depthMm: readRange(p, R.depthMm, 'depthMm') ?? base.depthMm,
  };
  const [bad] = invalidCablePassFields(params);
  if (bad === 'lengthMm' && shape === 'slot') throw invalid(bad, '≥ widthMm for a slot');
  if (bad) throw invalid(bad, `${R[bad].min}–${R[bad].max}`);
  return { params, placement: parseAddonPlacement(p) };
}

const brief = (o: Pick<SceneObject, 'id' | 'name'>) => ({ id: o.id, name: o.name });

/** Respuesta de `add_keyhole`. */
export function keyholeResultToUser(made: { object: SceneObject; report: KeyholeReport }, params: KeyholeParams, hostId: string, at: ResolvedPlacement) {
  const rep = made.report;
  return {
    ...brief(made.object),
    role: 'negative' as const,
    hostId,
    params,
    placement: placementToUser(at),
    report: {
      wallBehindMm: rn(rep.wallBehindMm),
      through: rep.through,
      edge: rep.edge,
      vertical: rep.vertical,
      levelOffsetMm: rn(rep.levelOffsetMm),
      retentionMm3: rn(rep.retentionMm3),
      retentionIdealMm3: rn(rep.retentionIdealMm3),
    },
    warnings: warningsOf(keyholeWarnings(rep, 'en'), 'KEYHOLE'),
    note: 'The keyhole is a pending negative: subtract it (Apply subtractions in the app, or kura_boolean_operation) to cut it.',
  };
}

/** Respuesta de `add_cable_pass`. */
export function cablePassResultToUser(made: { object: SceneObject; report: CablePassReport }, params: CablePassParams, hostId: string, at: ResolvedPlacement) {
  const rep = made.report;
  return {
    ...brief(made.object),
    role: 'negative' as const,
    hostId,
    params,
    placement: placementToUser(at),
    report: {
      thicknessMm: rn(rep.thicknessMm),
      boreMm: r(rep.boreMm),
      through: rep.through,
      noExit: rep.noExit,
      nearEdge: rep.nearEdge,
      nearAddon: rep.nearAddon,
    },
    warnings: warningsOf(cablePassWarnings(rep, 'en'), 'CABLE_PASS'),
    note: 'The cable pass is a pending negative: subtract it (Apply subtractions in the app, or kura_boolean_operation) to cut it.',
  };
}
