/**
 * @file src/engine/io/threeMfPackage.ts
 * @description Apertura segura de paquetes 3MF (ZIP): límite de tamaño descomprimido declarado
 * (protección contra zip bomb), selección de partes útiles, localización del modelo raíz vía
 * `_rels/.rels` y lectura de la configuración de Bambu Studio / OrcaSlicer (nombres, extrusores,
 * subtipos de pieza y colores de filamento; las placas se leen en `threeMfPlates.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strFromU8 } from 'fflate';
import { unzipBounded } from './boundedUnzip';
import { ModelImportError, type ModelImportLimits } from './importErrors';
import { normalizeHexColor } from './meshBuffers';
import { KURA_SCENE_MAX_BYTES, KURA_SCENE_PATH } from './kuraSceneMeta';
import { parseXmlAttrs } from './xmlAttrs';
import { forEachElement, forEachLeaf } from './xmlScan';

export { decodeXmlEntities, parseXmlAttrs } from './xmlAttrs';

/** Normaliza una ruta de parte OPC a clave de archivo ZIP (sin '/' inicial). */
export function normalizePartPath(path: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(path.trim());
  } catch {
    // Un escape URI inválido en una referencia del paquete es un archivo dañado, no un error sin tipar
    throw new ModelImportError('corrupt', `ruta de parte inválida: ${path.slice(0, 120)}`);
  }
  return decoded.replace(/\\/g, '/').replace(/^\/+/, '');
}

/** Configuración de laminador asociada a un objeto raíz o a una pieza (componente). */
export interface SlicerPartConfig {
  name?: string;
  extruder?: number;
  subtype?: string;
}

/** Paquete 3MF abierto. */
export interface ThreeMfPackage {
  /** Ruta (clave ZIP) del modelo raíz. */
  rootPath: string;
  /** Devuelve el XML de una parte .model o null si no existe. */
  readModel(path: string): string | null;
  /** Configuración por id de objeto raíz (`objects`) y por id de pieza (`parts`, clave `objeto/pieza`). */
  config: {
    objects: Map<string, SlicerPartConfig>;
    parts: Map<string, SlicerPartConfig>;
    filamentColors: string[];
    /** XML de `Metadata/model_settings.config` (placas, ver `threeMfPlates.ts`), o null si falta. */
    settingsXml: string | null;
  };
  /** Texto de `Metadata/Kura3D_scene.json` (escena exportada por Kura3D), o null si falta o excede su tope. */
  kuraSceneText: string | null;
}

const USEFUL_PART = /(\.model|\.rels|model_settings\.config|project_settings\.config|Kura3D_scene\.json)$/i;

/** Abre un paquete 3MF con límites de tamaño. */
export function open3MFPackage(buffer: ArrayBuffer, limits: ModelImportLimits): ThreeMfPackage {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new ModelImportError('corrupt', 'no es un archivo ZIP');
  }
  let archive: Record<string, Uint8Array>;
  try {
    // Tope sobre los bytes descomprimidos REALES, no solo sobre el tamaño declarado de cada entrada.
    archive = unzipBounded(bytes, (name) => USEFUL_PART.test(name), limits.maxUncompressedBytes);
  } catch (error) {
    if (error instanceof ModelImportError) throw error;
    throw new ModelImportError('corrupt', error instanceof Error ? error.message : String(error));
  }

  const lowerIndex = new Map<string, string>();
  for (const key of Object.keys(archive)) lowerIndex.set(key.toLowerCase(), key);
  const find = (path: string) => lowerIndex.get(normalizePartPath(path).toLowerCase());

  let rootPath: string | undefined;
  const relsKey = find('_rels/.rels');
  if (relsKey) {
    const rels = strFromU8(archive[relsKey]);
    forEachLeaf(rels, 'Relationship', (raw) => {
      const attrs = parseXmlAttrs(raw);
      if ((attrs.Type ?? '').toLowerCase().endsWith('/3dmodel') && attrs.Target) {
        rootPath = find(attrs.Target);
        if (rootPath) return false;
      }
    });
  }
  rootPath ??= find('3D/3dmodel.model') ?? Object.keys(archive).find((k) => k.toLowerCase().endsWith('.model'));
  if (!rootPath) throw new ModelImportError('missing-model');

  const config = readSlicerConfig(archive, find);
  const kuraKey = find(KURA_SCENE_PATH);
  const kuraBytes = kuraKey ? archive[kuraKey] : undefined;
  return {
    rootPath,
    kuraSceneText: kuraBytes && kuraBytes.length <= KURA_SCENE_MAX_BYTES ? strFromU8(kuraBytes) : null,
    readModel(path) {
      const key = find(path);
      return key ? strFromU8(archive[key]) : null;
    },
    config,
  };
}

function readSlicerConfig(
  archive: Record<string, Uint8Array>,
  find: (path: string) => string | undefined,
): ThreeMfPackage['config'] {
  const objects = new Map<string, SlicerPartConfig>();
  const parts = new Map<string, SlicerPartConfig>();
  const filamentColors: string[] = [];
  let settingsXml: string | null = null;

  const settingsKey = find('Metadata/model_settings.config');
  if (settingsKey) {
    const xml = strFromU8(archive[settingsKey]);
    forEachElement(xml, 'object', ({ attrs: rawAttrs, body: rawBody }) => {
      const objId = parseXmlAttrs(rawAttrs).id;
      if (!objId) return;
      const body = rawBody ?? '';
      // Metadatos propios del objeto: el cuerpo sin los tramos de sus <part>.
      let own = '';
      let cursor = 0;
      forEachElement(body, 'part', ({ attrs: partAttrs, body: partBody, start, end }) => {
        const attrs = parseXmlAttrs(partAttrs);
        if (attrs.id) parts.set(`${objId}/${attrs.id}`, { ...readMetadata(partBody ?? ''), subtype: attrs.subtype });
        own += body.slice(cursor, start);
        cursor = end;
      });
      objects.set(objId, readMetadata(own + body.slice(cursor)));
    });
    settingsXml = xml;
  }

  const projectKey = find('Metadata/project_settings.config');
  if (projectKey) {
    try {
      const json = JSON.parse(strFromU8(archive[projectKey])) as { filament_colour?: unknown };
      if (Array.isArray(json.filament_colour)) {
        for (const c of json.filament_colour) filamentColors.push(normalizeHexColor(String(c), '#38bdf8'));
      }
    } catch {
      // Configuración ilegible: se ignora (los colores son opcionales).
    }
  }
  return { objects, parts, filamentColors, settingsXml };
}

function readMetadata(body: string): SlicerPartConfig {
  const out: SlicerPartConfig = {};
  forEachLeaf(body, 'metadata', (raw) => {
    const attrs = parseXmlAttrs(raw);
    if (attrs.key === 'name' && attrs.value) out.name = attrs.value;
    if (attrs.key === 'extruder') {
      const n = parseInt(attrs.value ?? '', 10);
      if (Number.isInteger(n) && n > 0) out.extruder = n;
    }
  }, { skipOversized: true });
  return out;
}
