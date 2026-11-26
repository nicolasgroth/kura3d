/**
 * @file src/store/addonCommandSchemas.ts
 * @description Esquemas de los comandos de agregados: `add_magnet_pocket` (forma, medidas, holguras, oculto) y
 * `add_screw_boss` (tipo, medida nominal con su tabla o medidas explícitas, alto, diámetro exterior), más el lugar
 * (`addonPlacement`), el error tipado de bloqueo y la forma de la respuesta (objetos creados, pared medida o informe,
 * avisos con código y mensaje en inglés). Lo comparten el Command Bus de la app y el MCP sin interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { ADDON_BLOCK_KEY, type AddonBlockReason } from '../core/addons/addonBlock';
import { parseAddonPlacement, placementToUser, type AddonPlacementInput, type ResolvedPlacement } from '../core/addons/addonPlacement';
import { invalidMagnetFields, MAGNET_DEFAULTS, MAGNET_RANGES, pocketDims, type MagnetParams } from '../core/addons/magnetPocket';
import type { PocketWallReport } from '../core/addons/pocketWall';
import { defaultOuterDiameter, invalidScrewBossFields, SCREW_BOSS_RANGES, type ScrewBossParams } from '../core/addons/screwBoss';
import type { ScrewBossReport } from '../core/addons/screwBossAnalysis';
import { BUILTIN_SCREW_BOSS_PRESETS, SCREW_BOSS_DEFAULTS } from '../core/addons/screwBossPresets';
import { CommandError } from '../core/bus/commandErrors';
import { readBoolean, readEnum, readRange, type RawParams } from '../core/bus/commandValidation';
import { t, type TranslationKey } from '../i18n';
import type { SceneObject } from '../types/kura';
import { magnetWarnings } from './magnetWarnings';
import { screwBossWarnings } from './screwBossWarnings';

const invalid = (param: string, expected: string) => new CommandError('invalid-params', 'bus.error.invalidParam', { param, expected });
const round2 = (n: number) => Math.round(n * 100) / 100;
const r = (n: number, digits = 3) => Math.round(n * 10 ** digits) / 10 ** digits + 0;

/** Alias del parámetro de la pieza anfitriona. */
export const ADDON_HOST_KEYS = ['hostId', 'objectId', 'id'];

/** Error tipado de un agregado que no se coloca (`addon-blocked`, con el motivo y el mismo texto que la app). */
export const addonBlockedError = (reason: AddonBlockReason, key: TranslationKey = ADDON_BLOCK_KEY[reason] as TranslationKey) =>
  new CommandError('addon-blocked', key, { reason });

export function parseMagnetPocketCommand(p: RawParams): { params: MagnetParams; placement: AddonPlacementInput } {
  const D = MAGNET_DEFAULTS;
  const shape = readEnum(p, ['round', 'square', 'rect'] as const, 'shape') ?? D.shape;
  const params: MagnetParams = {
    shape,
    sizeMm: readRange(p, MAGNET_RANGES.sizeMm, 'sizeMm') ?? D.sizeMm,
    heightMm: readRange(p, MAGNET_RANGES.heightMm, 'heightMm') ?? D.heightMm,
    clearanceMm: readRange(p, MAGNET_RANGES.clearanceMm, 'clearanceMm') ?? D.clearanceMm,
    depthClearanceMm: readRange(p, MAGNET_RANGES.depthClearanceMm, 'depthClearanceMm') ?? D.depthClearanceMm,
    hidden: readBoolean(p, 'hidden') ?? D.hidden,
  };
  if (shape === 'rect') {
    // Rectangular: largo = sizeMm y ancho obligatorio; turn90 gira el largo 90° respecto del «arriba» de la cara.
    const widthMm = readRange(p, MAGNET_RANGES.widthMm, 'widthMm');
    if (widthMm === undefined) throw invalid('widthMm', `${MAGNET_RANGES.widthMm.min}–${MAGNET_RANGES.widthMm.max}`);
    params.widthMm = widthMm;
    if (readBoolean(p, 'turn90') === true) params.turn90 = true;
  }
  const [bad] = invalidMagnetFields(params);
  if (bad) throw invalid(bad, `${MAGNET_RANGES[bad].min}–${MAGNET_RANGES[bad].max}`);
  return { params, placement: parseAddonPlacement(p) };
}

/**
 * Medidas de la torreta: con tipo y medida nominal de la tabla (M2–M5) basta; las medidas explícitas mandan. Sin
 * tabla para esa medida, el agujero (diámetro y profundidad) es obligatorio. Alto por defecto: profundidad + 2 mm
 * (como la tabla); diámetro exterior por defecto: 2,5 × nominal sin bajar de agujero + 2 paredes mínimas.
 */
export function parseScrewBossCommand(p: RawParams): { params: ScrewBossParams; placement: AddonPlacementInput } {
  const R = SCREW_BOSS_RANGES;
  const type = readEnum(p, ['screw', 'insert'] as const, 'type') ?? SCREW_BOSS_DEFAULTS.type;
  const nominalMm = readRange(p, R.nominalMm, 'nominalMm') ?? SCREW_BOSS_DEFAULTS.nominalMm;
  const preset = BUILTIN_SCREW_BOSS_PRESETS.find((b) => b.values.type === type && b.values.nominalMm === nominalMm)?.values;
  const holeDiameterMm = readRange(p, R.holeDiameterMm, 'holeDiameterMm') ?? preset?.holeDiameterMm;
  const holeDepthMm = readRange(p, R.holeDepthMm, 'holeDepthMm') ?? preset?.holeDepthMm;
  if (holeDiameterMm === undefined) throw invalid('holeDiameterMm', `required: no built-in ${type} size for M${nominalMm}`);
  if (holeDepthMm === undefined) throw invalid('holeDepthMm', `required: no built-in ${type} size for M${nominalMm}`);
  const params: ScrewBossParams = {
    type,
    nominalMm,
    holeDiameterMm,
    holeDepthMm,
    heightMm: readRange(p, R.heightMm, 'heightMm') ?? round2(holeDepthMm + 2),
    outerDiameterMm: readRange(p, R.outerDiameterMm, 'outerDiameterMm') ?? defaultOuterDiameter(nominalMm, holeDiameterMm),
  };
  const [bad] = invalidScrewBossFields(params);
  if (bad) {
    const expected = bad === 'outerDiameterMm' ? 'larger than the hole diameter + 1 mm' : `${R[bad].min}–${R[bad].max}`;
    throw invalid(bad, expected);
  }
  return { params, placement: parseAddonPlacement(p) };
}

/** `magnet.warn.thinCover` → `MAGNET_THIN_COVER` (código estable del aviso). */
const warningCode = (prefix: string, key: string) => `${prefix}_${key.slice(key.lastIndexOf('.') + 1).replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`;

/** Avisos con código, parámetros y mensaje en inglés (misma forma que los avisos del motor). */
export function warningsOf(list: ReadonlyArray<{ key: TranslationKey; params: Record<string, string> }>, prefix: string) {
  return list.map((w) => ({ code: warningCode(prefix, w.key), params: w.params, message: t('en', w.key, w.params) }));
}

const brief = (o: Pick<SceneObject, 'id' | 'name'>) => ({ id: o.id, name: o.name });

/** Respuesta de `add_magnet_pocket`. */
export function magnetResultToUser(
  made: { obj: SceneObject; wall: PocketWallReport; fill: number },
  params: MagnetParams,
  hostId: string,
  at: ResolvedPlacement,
) {
  const dims = pocketDims(params);
  const w = made.wall;
  return {
    ...brief(made.obj),
    role: 'negative' as const,
    hostId,
    params,
    pocket: { shape: dims.shape, widthMm: r(dims.widthMm), ...(dims.shape === 'rect' ? { crossMm: r(dims.crossMm) } : {}), depthMm: r(dims.depthMm) },
    placement: placementToUser(at),
    wall: {
      minWallMm: r(w.minWallMm),
      side: w.side,
      through: w.through,
      protrudeMm: r(w.protrudeMm),
      coverMm: w.coverMm === undefined || w.coverMm === null ? null : r(w.coverMm),
      neighbor: w.neighbor ? { gapMm: r(w.neighbor.gapMm), overlap: w.neighbor.overlap } : null,
    },
    fill: r(made.fill, 4),
    warnings: warningsOf(magnetWarnings(w, 'en'), 'MAGNET'),
    note: 'The pocket is a pending negative: subtract it (Apply subtractions in the app, or kura_boolean_operation) to cut it.',
  };
}

/** Respuesta de `add_screw_boss`. */
export function screwBossResultToUser(
  made: { post: SceneObject; hole: SceneObject; report: ScrewBossReport },
  params: ScrewBossParams,
  hostId: string,
  at: ResolvedPlacement,
) {
  const rep = made.report;
  return {
    post: brief(made.post),
    hole: brief(made.hole),
    hostId,
    params,
    placement: placementToUser(at),
    report: { wallMm: r(rep.wallMm), intoHostMm: r(rep.intoHostMm), exits: rep.exits, collides: rep.collides, seatMm: r(rep.seatMm) },
    warnings: warningsOf(screwBossWarnings(rep, 'en'), 'SCREW_BOSS'),
    note: 'The post is a solid that merges with the part and the hole a negative: Apply subtractions in the app joins and cuts them.',
  };
}
