/**
 * @file src/engine/io/slicerProjectSample.ts
 * @description «Proyecto de ejemplo del laminador»: de un .3mf guardado por Bambu Studio / OrcaSlicer / Elegoo Slicer se
 * toman SOLO seis identificadores de perfil (versión, impresora, proceso, filamentos, modelo de impresora y proceso por
 * defecto) para que el 3MF que exporta Kurra Studio abra con sus placas en esa instalación. Los nombres de perfil
 * dependen de cada instalación: la app no los inventa.
 *
 * Seguridad: `Metadata/project_settings.config` trae cientos de claves, entre ellas datos de conexión de la impresora
 * (`print_host`, claves de API) y parámetros de laminado (fuera de alcance). Aquí se lee por lista blanca: ninguna otra
 * clave sale de esta función. Cada texto: 1..200 caracteres sin caracteres de control; 1..64 filamentos. La entrada
 * se descomprime con tope real de bytes (`unzipBounded`, el mismo del importador).
 *
 * Hechos del formato (archivos reales del laminador y prueba del autor en Elegoo Slicer 1.5): el laminador respeta las
 * placas si `project_settings.config` trae al menos `version`, `name` = "project_settings", `from` = "project",
 * `printer_settings_id`, `print_settings_id`, `filament_settings_id`, `printer_model`, `default_print_profile` y
 * `filament_colour` (lista "#RRGGBB"), en JSON con sangría de 4 espacios.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { strFromU8 } from 'fflate';
import { unzipBounded } from './boundedUnzip';

/** Identificadores de perfil tomados del proyecto de ejemplo (nombres de perfil, no secretos). */
export interface SlicerProjectSample {
  version: string;
  printerSettingsId: string;
  printSettingsId: string;
  filamentSettingsIds: string[];
  printerModel: string;
  defaultPrintProfile: string;
}

export type SlicerSampleError = 'not-3mf' | 'no-profile' | 'unreadable';
export type SlicerSampleResult = { ok: true; sample: SlicerProjectSample } | { ok: false; reason: SlicerSampleError };

export const SLICER_PROJECT_SETTINGS_PATH = 'Metadata/project_settings.config';
export const MAX_SAMPLE_TEXT = 200;
export const MAX_SAMPLE_FILAMENTS = 64;
/** Tope de bytes descomprimidos del perfil: uno real pesa ~35 KB. */
export const MAX_SAMPLE_SETTINGS_BYTES = 2 << 20;

/** true si hay un carácter de control (C0, DEL, C1) o un separador de línea Unicode. */
const hasControl = (v: string): boolean => {
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029) return true;
  }
  return false;
};

const text = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_SAMPLE_TEXT && !hasControl(v) ? v : null;

const textList = (v: unknown): string[] | null => {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_SAMPLE_FILAMENTS) return null;
  const out = v.map(text);
  return out.every((s): s is string => s !== null) ? out : null;
};

function build(fields: Record<keyof SlicerProjectSample, unknown>): SlicerProjectSample | null {
  const sample = {
    version: text(fields.version),
    printerSettingsId: text(fields.printerSettingsId),
    printSettingsId: text(fields.printSettingsId),
    filamentSettingsIds: textList(fields.filamentSettingsIds),
    printerModel: text(fields.printerModel),
    defaultPrintProfile: text(fields.defaultPrintProfile),
  };
  return Object.values(sample).every((v) => v !== null) ? (sample as SlicerProjectSample) : null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Valida un ejemplo ya guardado (preferencia local): solo las seis claves, con los mismos límites. */
export function parseSlicerProjectSample(raw: unknown): SlicerProjectSample | null {
  if (!isRecord(raw)) return null;
  return build({
    version: raw.version, printerSettingsId: raw.printerSettingsId, printSettingsId: raw.printSettingsId,
    filamentSettingsIds: raw.filamentSettingsIds, printerModel: raw.printerModel, defaultPrintProfile: raw.defaultPrintProfile,
  });
}

/** Lee el proyecto de ejemplo de los bytes de un .3mf del laminador (lista blanca; nada más sale de aquí). */
export function extractSlicerProjectSample(bytes: Uint8Array): SlicerSampleResult {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return { ok: false, reason: 'not-3mf' };
  const wanted = SLICER_PROJECT_SETTINGS_PATH.toLowerCase();
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipBounded(bytes, (name) => name.replace(/^\/+/, '').toLowerCase() === wanted, MAX_SAMPLE_SETTINGS_BYTES);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  const data = Object.values(entries)[0];
  if (!data) return { ok: false, reason: 'no-profile' };
  let json: unknown;
  try {
    json = JSON.parse(strFromU8(data));
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  if (!isRecord(json)) return { ok: false, reason: 'no-profile' };
  const sample = build({
    version: json.version, printerSettingsId: json.printer_settings_id, printSettingsId: json.print_settings_id,
    filamentSettingsIds: json.filament_settings_id, printerModel: json.printer_model, defaultPrintProfile: json.default_print_profile,
  });
  return sample ? { ok: true, sample } : { ok: false, reason: 'no-profile' };
}

/**
 * `Metadata/project_settings.config` de la exportación: las 9 claves, con `filament_colour` = colores de los filamentos
 * de la escena (en el orden de `extruder`) y `filament_settings_id` ajustado a esa cantidad (repite el primero si faltan,
 * recorta si sobran).
 */
export function slicerProjectSettingsJson(sample: SlicerProjectSample, filamentColors: readonly string[]): string {
  const ids = sample.filamentSettingsIds;
  const count = Math.max(1, filamentColors.length);
  const json = {
    version: sample.version,
    name: 'project_settings',
    from: 'project',
    printer_settings_id: sample.printerSettingsId,
    print_settings_id: sample.printSettingsId,
    filament_settings_id: Array.from({ length: count }, (_, i) => ids[i] ?? ids[0]),
    printer_model: sample.printerModel,
    default_print_profile: sample.defaultPrintProfile,
    filament_colour: filamentColors.map((c) => c.toUpperCase()),
  };
  return `${JSON.stringify(json, null, 4)}\n`;
}
