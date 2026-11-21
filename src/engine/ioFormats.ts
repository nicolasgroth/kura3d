/**
 * @file src/engine/ioFormats.ts
 * @description Importación y exportación determinista para impresión 3D:
 * STL binario IEEE-754 y ASCII, Wavefront OBJ y archivos 3MF multicolor (ZIP + XML)
 * compatibles con Elegoo Slicer, OrcaSlicer, Bambu Studio y PrusaSlicer.
 * Conversión automática entre el sistema Y-up de Kura3D y Z-up estándar de laminadores.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type {
  MeshData,
  SceneObject,
  SlicerTarget,
  UnitSystem,
} from '../types/kura';
import { computeVertexNormals, weldVertices } from './manifoldKernel';
import { applyTransformToMesh, normalizeMeshToBed } from './primitives';

/** Factores de conversión de milímetros hacia la unidad destino para exportación 3MF. */
const UNIT_TO_3MF: Record<UnitSystem, { xmlName: string; scaleFromMm: number }> = {
  mm: { xmlName: 'millimeter', scaleFromMm: 1 },
  cm: { xmlName: 'centimeter', scaleFromMm: 0.1 },
  m: { xmlName: 'meter', scaleFromMm: 0.001 },
  in: { xmlName: 'inch', scaleFromMm: 1 / 25.4 },
  ft: { xmlName: 'foot', scaleFromMm: 1 / 304.8 },
};

/** Factores de conversión de unidades 3MF importadas hacia milímetros internos. */
const MF3_UNIT_TO_MM: Record<string, number> = {
  millimeter: 1,
  centimeter: 10,
  meter: 1000,
  inch: 25.4,
  foot: 304.8,
  micron: 0.001,
};

/** Escapa caracteres especiales para contenido y atributos XML válidos. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Normaliza un color hex '#rrggbb' o '#rrggbbaa' a '#rrggbb' en minúsculas. */
function normalizeHexColor(raw: string | undefined, fallback = '#38bdf8'): string {
  if (!raw) return fallback;
  const clean = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(clean)) return clean;
  if (/^#[0-9a-f]{8}$/.test(clean)) return clean.slice(0, 7);
  if (/^#[0-9a-f]{3}$/.test(clean)) {
    return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
  }
  return fallback;
}

// ============================================================================
// Exportación STL binario (IEEE-754)
// ============================================================================

/**
 * Exporta una malla `MeshData` (Y-up en mm) a formato STL binario IEEE-754
 * estándar (80 bytes de cabecera + uint32 conteo + 50 bytes por triángulo),
 * convirtiendo las coordenadas a Z-up para laminadores de impresión 3D.
 *
 * @param mesh Malla a exportar.
 * @param headerText Texto opcional de cabecera ASCII (máx. 80 bytes).
 * @returns Buffer binario STL listo para guardar o descargar.
 */
export function exportMeshToBinarySTL(
  mesh: MeshData,
  headerText = 'Kura3D by Nicolas Groth'
): Uint8Array {
  const triCount = Math.floor(mesh.indices.length / 3);
  const byteLength = 84 + triCount * 50;
  const buffer = new ArrayBuffer(byteLength);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Cabecera de 80 bytes (no debe comenzar con "solid " para evitar confusiones con STL ASCII)
  const safeHeader = headerText.startsWith('solid')
    ? `Kura3D ${headerText}`
    : headerText;
  const headerBytes = strToU8(safeHeader);
  bytes.set(headerBytes.subarray(0, 80), 0);

  view.setUint32(80, triCount, true);

  let offset = 84;
  for (let t = 0; t < triCount; t++) {
    const i0 = mesh.indices[t * 3] * 3;
    const i1 = mesh.indices[t * 3 + 1] * 3;
    const i2 = mesh.indices[t * 3 + 2] * 3;

    // Conversión Y-up -> Z-up mediante rotación +90° en X: (x, y, z) -> (x, -z, y)
    const ax = mesh.positions[i0];
    const ay = -mesh.positions[i0 + 2];
    const az = mesh.positions[i0 + 1];

    const bx = mesh.positions[i1];
    const by = -mesh.positions[i1 + 2];
    const bz = mesh.positions[i1 + 1];

    const cx = mesh.positions[i2];
    const cy = -mesh.positions[i2 + 2];
    const cz = mesh.positions[i2 + 1];

    const e1x = bx - ax;
    const e1y = by - ay;
    const e1z = bz - az;
    const e2x = cx - ax;
    const e2y = cy - ay;
    const e2z = cz - az;

    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-12) {
      nx /= len;
      ny /= len;
      nz /= len;
    } else {
      nx = 0;
      ny = 0;
      nz = 1;
    }

    // Normal del triángulo
    view.setFloat32(offset, nx, true);
    view.setFloat32(offset + 4, ny, true);
    view.setFloat32(offset + 8, nz, true);

    // Vértice 0
    view.setFloat32(offset + 12, ax, true);
    view.setFloat32(offset + 16, ay, true);
    view.setFloat32(offset + 20, az, true);

    // Vértice 1
    view.setFloat32(offset + 24, bx, true);
    view.setFloat32(offset + 28, by, true);
    view.setFloat32(offset + 32, bz, true);

    // Vértice 2
    view.setFloat32(offset + 36, cx, true);
    view.setFloat32(offset + 40, cy, true);
    view.setFloat32(offset + 44, cz, true);

    // Attribute byte count = 0
    view.setUint16(offset + 48, 0, true);
    offset += 50;
  }

  return bytes;
}

/**
 * Fusiona todos los objetos visibles y sólidos (`!isHole`) de la escena con sus
 * transformaciones mundiales aplicadas en un único archivo STL binario.
 *
 * @param objects Lista de objetos de la escena.
 * @returns Buffer binario STL combinado.
 */
export function exportSceneToBinarySTL(objects: SceneObject[]): Uint8Array {
  const solidObjects = objects.filter((o) => o.visible && !o.isHole);
  const positionsList: number[] = [];
  const indicesList: number[] = [];
  let vertOffset = 0;

  for (const obj of solidObjects) {
    const world = applyTransformToMesh(
      obj.mesh,
      obj.position,
      obj.rotation,
      obj.scale
    );
    for (let i = 0; i < world.positions.length; i++) {
      positionsList.push(world.positions[i]);
    }
    for (let i = 0; i < world.indices.length; i++) {
      indicesList.push(world.indices[i] + vertOffset);
    }
    vertOffset += Math.floor(world.positions.length / 3);
  }

  return exportMeshToBinarySTL({
    positions: new Float32Array(positionsList),
    indices: new Uint32Array(indicesList),
  });
}

// ============================================================================
// Exportación 3MF multicolor (ZIP + XML estándar 3MF)
// ============================================================================

/**
 * Genera un paquete `.3mf` Multi-Slicer Pro válido (archivo ZIP con `[Content_Types].xml`,
 * `_rels/.rels`, `3D/3dmodel.model` y `Metadata/model_settings.config`) incluyendo
 * `<basematerials>` y atributos `pid`/`p1` por triángulo para compatibilidad multicolor
 * nativa con Bambu Studio, Elegoo Slicer, Snapmaker Orca, FlashForge Orca y PrusaSlicer.
 *
 * @param objects Objetos de la escena a exportar.
 * @param unit Unidad del modelo declarada en la cabecera 3MF (por defecto 'mm').
 * @param slicerTarget Slicer destino ('generic' | 'elegoo' | 'bambu' | 'snapmaker' | 'flashforge').
 * @returns Archivo `.3mf` comprimido en `Uint8Array`.
 */
export function exportSceneTo3MF(
  objects: SceneObject[],
  unit: UnitSystem = 'mm',
  slicerTarget: SlicerTarget = 'generic'
): Uint8Array {
  const solidObjects = objects.filter((o) => o.visible && !o.isHole);
  const unitSpec = UNIT_TO_3MF[unit] ?? UNIT_TO_3MF.mm;

  // Recolectar paleta global de colores única para <basematerials id="1">
  const colorToIndex = new Map<string, number>();
  const palette: string[] = [];

  const registerColor = (hex: string): number => {
    const norm = normalizeHexColor(hex);
    let idx = colorToIndex.get(norm);
    if (idx === undefined) {
      idx = palette.length;
      palette.push(norm);
      colorToIndex.set(norm, idx);
    }
    return idx;
  };

  for (const obj of solidObjects) {
    registerColor(obj.color);
    if (obj.mesh.faceColors) {
      for (const c of obj.mesh.faceColors) {
        registerColor(c);
      }
    }
  }

  if (palette.length === 0) {
    registerColor('#38bdf8');
  }

  const baseMaterialsXml = palette
    .map(
      (hex, idx) =>
        `      <base name="Filament_${idx + 1}" displaycolor="${hex.toUpperCase()}FF" />`
    )
    .join('\n');

  const objectsXml: string[] = [];
  const buildItemsXml: string[] = [];
  const configObjectsXml: string[] = [];
  const configPlateInstancesXml: string[] = [];

  solidObjects.forEach((obj, objIdx) => {
    const objId = objIdx + 2;
    const world = applyTransformToMesh(
      obj.mesh,
      obj.position,
      obj.rotation,
      obj.scale
    );

    const vertCount = Math.floor(world.positions.length / 3);
    const triCount = Math.floor(world.indices.length / 3);
    const defaultColorIdx = registerColor(obj.color);

    const verticesLines = new Array<string>(vertCount);
    for (let v = 0; v < vertCount; v++) {
      // Conversión Y-up -> Z-up (x, -z, y) escalado a la unidad destino
      const x = (world.positions[v * 3] * unitSpec.scaleFromMm).toFixed(5);
      const y = (-world.positions[v * 3 + 2] * unitSpec.scaleFromMm).toFixed(5);
      const z = (world.positions[v * 3 + 1] * unitSpec.scaleFromMm).toFixed(5);
      verticesLines[v] = `          <vertex x="${x}" y="${y}" z="${z}" />`;
    }

    const triLines = new Array<string>(triCount);
    const objectColorSlots = new Set<number>();
    for (let t = 0; t < triCount; t++) {
      const v1 = world.indices[t * 3];
      const v2 = world.indices[t * 3 + 1];
      const v3 = world.indices[t * 3 + 2];
      const p1 = world.faceColors?.[t]
        ? registerColor(world.faceColors[t])
        : defaultColorIdx;
      objectColorSlots.add(p1);
      triLines[t] =
        `          <triangle v1="${v1}" v2="${v2}" v3="${v3}" pid="1" p1="${p1}" />`;
    }

    objectsXml.push(
      `    <object id="${objId}" type="model" name="${escapeXml(obj.name)}">\n` +
        `      <mesh>\n` +
        `        <vertices>\n${verticesLines.join('\n')}\n        </vertices>\n` +
        `        <triangles>\n${triLines.join('\n')}\n        </triangles>\n` +
        `      </mesh>\n` +
        `    </object>`
    );

    buildItemsXml.push(`    <item objectid="${objId}" />`);

    // Mapeo de extrusores (base 1..N) en Metadata/model_settings.config para Bambu/Orca/Elegoo/FlashForge/Snapmaker
    const extruderSlot = defaultColorIdx + 1;
    const escapedName = escapeXml(obj.name);
    const slotList = Array.from(objectColorSlots).map((idx) => idx + 1);
    const paletteComment =
      slotList.length > 1
        ? `\n    <metadata key="filament_slots" value="${slotList.join(',')}"/>`
        : '';

    configObjectsXml.push(
      `  <object id="${objId}">\n` +
        `    <metadata key="name" value="${escapedName}"/>\n` +
        `    <metadata key="extruder" value="${extruderSlot}"/>${paletteComment}\n` +
        `    <part id="${objId}" subtype="normal_part">\n` +
        `      <metadata key="name" value="${escapedName}"/>\n` +
        `      <metadata key="extruder" value="${extruderSlot}"/>\n` +
        `    </part>\n` +
        `  </object>`
    );
    configPlateInstancesXml.push(
      `    <model_instance>\n` +
        `      <metadata key="object_id" value="${objId}"/>\n` +
        `      <metadata key="instance_id" value="0"/>\n` +
        `    </model_instance>`
    );
  });

  const modelXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="${unitSpec.xmlName}" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n` +
    `  <metadata name="Application">Kura3D by Nicolás Groth</metadata>\n` +
    `  <metadata name="Organization">ISGROTH — Innovación y Soluciones GROTH</metadata>\n` +
    `  <metadata name="SlicerTarget">${escapeXml(slicerTarget)}</metadata>\n` +
    `  <resources>\n` +
    `    <basematerials id="1">\n${baseMaterialsXml}\n    </basematerials>\n` +
    `${objectsXml.join('\n')}\n` +
    `  </resources>\n` +
    `  <build>\n${buildItemsXml.join('\n')}\n  </build>\n` +
    `</model>\n`;

  // Configuración estándar de objetos/extrusores compatible con Bambu Studio y derivados de OrcaSlicer
  const modelSettingsConfigXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<config>\n` +
    `  <metadata key="slicer_target" value="${escapeXml(slicerTarget)}"/>\n` +
    `  <metadata key="filament_count" value="${palette.length}"/>\n` +
    `${configObjectsXml.join('\n')}\n` +
    `  <plate>\n` +
    `    <metadata key="plater_id" value="1"/>\n` +
    `    <metadata key="plater_name" value="Kura3D_Bed"/>\n` +
    `${configPlateInstancesXml.join('\n')}\n` +
    `  </plate>\n` +
    `</config>\n`;

  const contentTypesXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n` +
    `  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />\n` +
    `  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />\n` +
    `  <Default Extension="config" ContentType="text/xml" />\n` +
    `</Types>\n`;

  const relsXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
    `  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />\n` +
    `</Relationships>\n`;

  return zipSync({
    '[Content_Types].xml': strToU8(contentTypesXml),
    '_rels/.rels': strToU8(relsXml),
    '3D/3dmodel.model': strToU8(modelXml),
    'Metadata/model_settings.config': strToU8(modelSettingsConfigXml),
  });
}

// ============================================================================
// Exportación Wavefront OBJ
// ============================================================================

/**
 * Exporta una malla `MeshData` (en milímetros) a texto Wavefront OBJ válido.
 */
export function exportMeshToOBJ(
  mesh: MeshData,
  name = 'Kura3D_Model'
): string {
  const lines: string[] = [
    '# Kura3D Wavefront OBJ Export (Units: mm, Y-up)',
    `o ${name.replace(/\s+/g, '_')}`,
  ];

  const vertCount = Math.floor(mesh.positions.length / 3);
  for (let v = 0; v < vertCount; v++) {
    const x = mesh.positions[v * 3].toFixed(5);
    const y = mesh.positions[v * 3 + 1].toFixed(5);
    const z = mesh.positions[v * 3 + 2].toFixed(5);
    lines.push(`v ${x} ${y} ${z}`);
  }

  const hasNormals = mesh.normals && mesh.normals.length === mesh.positions.length;
  if (hasNormals && mesh.normals) {
    for (let v = 0; v < vertCount; v++) {
      const nx = mesh.normals[v * 3].toFixed(5);
      const ny = mesh.normals[v * 3 + 1].toFixed(5);
      const nz = mesh.normals[v * 3 + 2].toFixed(5);
      lines.push(`vn ${nx} ${ny} ${nz}`);
    }
  }

  const triCount = Math.floor(mesh.indices.length / 3);
  for (let t = 0; t < triCount; t++) {
    const a = mesh.indices[t * 3] + 1;
    const b = mesh.indices[t * 3 + 1] + 1;
    const c = mesh.indices[t * 3 + 2] + 1;
    if (hasNormals) {
      lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
    } else {
      lines.push(`f ${a} ${b} ${c}`);
    }
  }

  return lines.join('\n') + '\n';
}

// ============================================================================
// Importación STL (Binario y ASCII), OBJ y 3MF
// ============================================================================

/**
 * Importa un archivo STL (detectando automáticamente formato binario o ASCII),
 * convierte de Z-up estándar a Y-up de Kura3D, suelda vértices coincidentes
 * para recuperar la topología cerrada y normaliza la malla sobre la cama (Y=0).
 */
export function importSTLBuffer(buffer: ArrayBuffer): MeshData {
  if (buffer.byteLength < 15) {
    throw new Error('El buffer STL está vacío o corrupto.');
  }

  const view = new DataView(buffer);
  let isBinary = false;
  if (buffer.byteLength >= 84) {
    const triCount = view.getUint32(80, true);
    if (triCount > 0 && 84 + triCount * 50 === buffer.byteLength) {
      isBinary = true;
    }
  }

  const rawPositions: number[] = [];
  const rawIndices: number[] = [];

  if (isBinary) {
    const triCount = view.getUint32(80, true);
    let offset = 84;
    for (let t = 0; t < triCount; t++) {
      // Saltamos la normal (12 bytes) y leemos los 3 vértices
      offset += 12;
      for (let c = 0; c < 3; c++) {
        const sx = view.getFloat32(offset, true);
        const sy = view.getFloat32(offset + 4, true);
        const sz = view.getFloat32(offset + 8, true);
        offset += 12;
        // Conversión Z-up -> Y-up mediante rotación -90° en X: (x, y, z) -> (x, z, -y)
        rawPositions.push(sx, sz, -sy);
        rawIndices.push(t * 3 + c);
      }
      offset += 2; // attribute byte count
    }
  } else {
    const text = strFromU8(new Uint8Array(buffer));
    const vertexRegex =
      /vertex\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/gi;
    let m: RegExpExecArray | null;
    let vertIdx = 0;
    while ((m = vertexRegex.exec(text)) !== null) {
      const sx = parseFloat(m[1]);
      const sy = parseFloat(m[2]);
      const sz = parseFloat(m[3]);
      rawPositions.push(sx, sz, -sy);
      rawIndices.push(vertIdx++);
    }
    const usableTris = Math.floor(rawIndices.length / 3) * 3;
    rawIndices.length = usableTris;
  }

  if (rawIndices.length === 0) {
    throw new Error('No se encontraron triángulos válidos en el archivo STL.');
  }

  const welded = weldVertices(
    new Float32Array(rawPositions),
    new Uint32Array(rawIndices),
    1e-5
  );
  const normals = computeVertexNormals(welded.positions, welded.indices);

  return normalizeMeshToBed({
    positions: welded.positions,
    indices: welded.indices,
    normals,
  });
}

/**
 * Parsea texto Wavefront OBJ (vértices `v` y caras `f` con triangulación en abanico
 * para quads/n-gonos), compacta vértices y normaliza la malla sobre Y=0.
 */
export function importOBJText(text: string): MeshData {
  const vertices: number[] = [];
  const rawIndices: number[] = [];

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('v ')) {
      const parts = line.slice(2).trim().split(/\s+/);
      if (parts.length >= 3) {
        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);
        const z = parseFloat(parts[2]);
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
          vertices.push(x, y, z);
        }
      }
    } else if (line.startsWith('f ')) {
      const parts = line.slice(2).trim().split(/\s+/);
      const faceVerts: number[] = [];
      const totalVerts = vertices.length / 3;

      for (const token of parts) {
        const vStr = token.split('/')[0];
        const parsed = parseInt(vStr, 10);
        if (!Number.isFinite(parsed) || parsed === 0) continue;
        const idx = parsed > 0 ? parsed - 1 : totalVerts + parsed;
        if (idx >= 0 && idx < totalVerts) {
          faceVerts.push(idx);
        }
      }

      // Triangulación en abanico para polígonos de 3 o más vértices
      for (let k = 1; k + 1 < faceVerts.length; k++) {
        rawIndices.push(faceVerts[0], faceVerts[k], faceVerts[k + 1]);
      }
    }
  }

  if (rawIndices.length === 0) {
    throw new Error('No se encontraron caras válidas en el archivo OBJ.');
  }

  const welded = weldVertices(
    new Float32Array(vertices),
    new Uint32Array(rawIndices),
    1e-5
  );
  const normals = computeVertexNormals(welded.positions, welded.indices);

  return normalizeMeshToBed({
    positions: welded.positions,
    indices: welded.indices,
    normals,
  });
}

/** Extrae atributos XML de una etiqueta sin depender de DOMParser. */
function parseXmlAttrs(attrString: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrString)) !== null) {
    result[m[1]] = m[2] ?? m[3] ?? '';
  }
  return result;
}

/**
 * Descomprime e importa un archivo `.3mf` usando `fflate`, leyendo `3D/3dmodel.model`
 * mediante un parser XML ligero compatible con Node y navegador. Reconstruye objetos,
 * transformaciones de `<build>`, colores de `<basematerials>`/`<colorgroup>` y `faceColors`.
 */
export function import3MFBuffer(
  buffer: ArrayBuffer
): Array<{ name: string; color: string; mesh: MeshData }> {
  const archive = unzipSync(new Uint8Array(buffer));
  const modelKey = Object.keys(archive).find((k) =>
    k.toLowerCase().endsWith('.model')
  );
  if (!modelKey) {
    throw new Error('El archivo 3MF no contiene un documento .model válido.');
  }

  const xml = strFromU8(archive[modelKey]);

  // Factor de escala a mm desde la unidad declarada en <model unit="...">
  const modelTagMatch = /<model\b([^>]*)>/i.exec(xml);
  const modelAttrs = modelTagMatch ? parseXmlAttrs(modelTagMatch[1]) : {};
  const unitScaleMm =
    MF3_UNIT_TO_MM[(modelAttrs.unit ?? 'millimeter').toLowerCase()] ?? 1;

  // 1) Parsear tablas de materiales (<basematerials> y <colorgroup>)
  const materialGroups = new Map<string, string[]>();

  const baseMatRegex = /<basematerials\b([^>]*)>([\s\S]*?)<\/basematerials>/gi;
  let bmMatch: RegExpExecArray | null;
  while ((bmMatch = baseMatRegex.exec(xml)) !== null) {
    const bmAttrs = parseXmlAttrs(bmMatch[1]);
    const id = bmAttrs.id ?? '1';
    const colors: string[] = [];
    const baseRegex = /<base\b([^>]*)\/?>/gi;
    let bMatch: RegExpExecArray | null;
    while ((bMatch = baseRegex.exec(bmMatch[2])) !== null) {
      const attrs = parseXmlAttrs(bMatch[1]);
      colors.push(normalizeHexColor(attrs.displaycolor, '#38bdf8'));
    }
    materialGroups.set(id, colors);
  }

  const colorGroupRegex = /<(?:m:)?colorgroup\b([^>]*)>([\s\S]*?)<\/(?:m:)?colorgroup>/gi;
  let cgMatch: RegExpExecArray | null;
  while ((cgMatch = colorGroupRegex.exec(xml)) !== null) {
    const cgAttrs = parseXmlAttrs(cgMatch[1]);
    const id = cgAttrs.id ?? '';
    const colors: string[] = [];
    const colRegex = /<(?:m:)?color\b([^>]*)\/?>/gi;
    let cMatch: RegExpExecArray | null;
    while ((cMatch = colRegex.exec(cgMatch[2])) !== null) {
      const attrs = parseXmlAttrs(cMatch[1]);
      colors.push(normalizeHexColor(attrs.color, '#38bdf8'));
    }
    if (id && colors.length > 0) {
      materialGroups.set(id, colors);
    }
  }

  // 2) Parsear <build> para obtener transformaciones por objectid si existen
  const buildTransforms = new Map<string, number[]>();
  const itemRegex = /<item\b([^>]*)\/?>/gi;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const attrs = parseXmlAttrs(itemMatch[1]);
    if (attrs.objectid && attrs.transform) {
      const nums = attrs.transform.trim().split(/\s+/).map(Number);
      if (nums.length === 12 && nums.every(Number.isFinite)) {
        buildTransforms.set(attrs.objectid, nums);
      }
    }
  }

  // 3) Parsear todos los <object ...><mesh>...</mesh></object>
  const results: Array<{ name: string; color: string; mesh: MeshData }> = [];
  const objRegex = /<object\b([^>]*)>([\s\S]*?)<\/object>/gi;
  let objMatch: RegExpExecArray | null;

  while ((objMatch = objRegex.exec(xml)) !== null) {
    const objAttrs = parseXmlAttrs(objMatch[1]);
    const objBody = objMatch[2];
    const meshMatch = /<mesh\b[^>]*>([\s\S]*?)<\/mesh>/i.exec(objBody);
    if (!meshMatch) continue;

    const meshBody = meshMatch[1];
    const objId = objAttrs.id ?? `${results.length + 1}`;
    const objName = objAttrs.name || `Parte_3MF_${objId}`;
    const defaultPid = objAttrs.pid;
    const defaultPIndex = objAttrs.pindex ? parseInt(objAttrs.pindex, 10) : 0;
    const objDefaultColor =
      (defaultPid && materialGroups.get(defaultPid)?.[defaultPIndex]) || '#38bdf8';

    const xf = buildTransforms.get(objId);

    const rawPositions: number[] = [];
    const vertexRegex = /<vertex\b([^>]*)\/?>/gi;
    let vMatch: RegExpExecArray | null;
    while ((vMatch = vertexRegex.exec(meshBody)) !== null) {
      const attrs = parseXmlAttrs(vMatch[1]);
      let x = (parseFloat(attrs.x ?? '0') || 0) * unitScaleMm;
      let y = (parseFloat(attrs.y ?? '0') || 0) * unitScaleMm;
      let z = (parseFloat(attrs.z ?? '0') || 0) * unitScaleMm;

      if (xf) {
        const tx = xf[0] * x + xf[3] * y + xf[6] * z + xf[9] * unitScaleMm;
        const ty = xf[1] * x + xf[4] * y + xf[7] * z + xf[10] * unitScaleMm;
        const tz = xf[2] * x + xf[5] * y + xf[8] * z + xf[11] * unitScaleMm;
        x = tx;
        y = ty;
        z = tz;
      }

      // Conversión 3MF Z-up -> Kura3D Y-up: (x, y, z) -> (x, z, -y)
      rawPositions.push(x, z, -y);
    }

    const rawIndices: number[] = [];
    const faceColors: string[] = [];
    const colorCounts = new Map<string, number>();

    const triRegex = /<triangle\b([^>]*)\/?>/gi;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = triRegex.exec(meshBody)) !== null) {
      const attrs = parseXmlAttrs(tMatch[1]);
      const v1 = parseInt(attrs.v1 ?? '-1', 10);
      const v2 = parseInt(attrs.v2 ?? '-1', 10);
      const v3 = parseInt(attrs.v3 ?? '-1', 10);
      if (v1 < 0 || v2 < 0 || v3 < 0) continue;

      rawIndices.push(v1, v2, v3);

      const pid = attrs.pid ?? defaultPid;
      const p1 = attrs.p1 !== undefined ? parseInt(attrs.p1, 10) : defaultPIndex;
      const triColor =
        (pid && materialGroups.get(pid)?.[p1]) || objDefaultColor;
      faceColors.push(triColor);
      colorCounts.set(triColor, (colorCounts.get(triColor) ?? 0) + 1);
    }

    if (rawIndices.length === 0) continue;

    // Color principal del objeto = color más frecuente entre sus triángulos
    let dominantColor = objDefaultColor;
    let bestCount = -1;
    for (const [col, cnt] of colorCounts.entries()) {
      if (cnt > bestCount) {
        bestCount = cnt;
        dominantColor = col;
      }
    }

    const posArr = new Float32Array(rawPositions);
    const idxArr = new Uint32Array(rawIndices);
    const normals = computeVertexNormals(posArr, idxArr);
    const hasMultipleColors = colorCounts.size > 1;

    results.push({
      name: objName,
      color: dominantColor,
      mesh: normalizeMeshToBed({
        positions: posArr,
        indices: idxArr,
        normals,
        ...(hasMultipleColors ? { faceColors } : {}),
      }),
    });
  }

  if (results.length === 0) {
    throw new Error('No se encontraron mallas válidas dentro del archivo 3MF.');
  }

  return results;
}
