/**
 * @file src/engine/io/threeMfExport.ts
 * @description Escritor 3MF multicolor (ZIP + XML) compatible con Elegoo Slicer, OrcaSlicer,
 * Bambu Studio, Snapmaker Orca, FlashForge y PrusaSlicer. Cada objeto declara su color base
 * (`pid`/`pindex`) y los triángulos pintados su propio `p1`; el XML se genera por bloques
 * codificados directamente a bytes para no construir una cadena única gigante.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strToU8, zipSync } from 'fflate';
import type { SceneObject, SlicerTarget, UnitSystem } from '../../types/kura';
import { BRAND } from '../../brand';
import { applyTransformToMesh } from '../primitives';
import { normalizeHexColor } from './meshBuffers';
import { exportableObjects } from './stl';

/** Factores de conversión de milímetros hacia la unidad destino. */
const UNIT_TO_3MF: Record<UnitSystem, { xmlName: string; scaleFromMm: number }> = {
  mm: { xmlName: 'millimeter', scaleFromMm: 1 },
  cm: { xmlName: 'centimeter', scaleFromMm: 0.1 },
  m: { xmlName: 'meter', scaleFromMm: 0.001 },
  in: { xmlName: 'inch', scaleFromMm: 1 / 25.4 },
  ft: { xmlName: 'foot', scaleFromMm: 1 / 304.8 },
};

/** Escapa caracteres especiales para contenido y atributos XML. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Acumula bloques de texto ya codificados en UTF-8 y los concatena una sola vez. */
class ByteChunks {
  private chunks: Uint8Array[] = [];
  private pending: string[] = [];
  private pendingLength = 0;
  private size = 0;
  private readonly encoder = new TextEncoder();

  write(text: string) {
    this.pending.push(text);
    this.pendingLength += text.length;
    if (this.pendingLength > 1 << 20) this.flush();
  }
  private flush() {
    if (this.pending.length === 0) return;
    const bytes = this.encoder.encode(this.pending.join(''));
    this.chunks.push(bytes);
    this.size += bytes.length;
    this.pending = [];
    this.pendingLength = 0;
  }
  toBytes(): Uint8Array {
    this.flush();
    const out = new Uint8Array(this.size);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

const num = (n: number) => {
  const s = n.toFixed(5);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
};

/**
 * Genera un paquete `.3mf` (`[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model` y
 * `Metadata/model_settings.config`) con `<basematerials>` y colores por triángulo.
 */
export function exportSceneTo3MF(
  objects: SceneObject[],
  unit: UnitSystem = 'mm',
  slicerTarget: SlicerTarget = 'generic',
): Uint8Array {
  const solidObjects = exportableObjects(objects);
  const unitSpec = UNIT_TO_3MF[unit] ?? UNIT_TO_3MF.mm;

  // Paleta global única para <basematerials id="1">.
  const colorToIndex = new Map<string, number>();
  const palette: string[] = [];
  const registerColor = (hex: string | undefined, fallback = '#38bdf8'): number => {
    const norm = normalizeHexColor(hex, fallback);
    let idx = colorToIndex.get(norm);
    if (idx === undefined) {
      idx = palette.length;
      palette.push(norm);
      colorToIndex.set(norm, idx);
    }
    return idx;
  };
  for (const obj of solidObjects) {
    const base = normalizeHexColor(obj.color);
    registerColor(base);
    obj.mesh.faceColors?.forEach((c) => registerColor(c, base));
  }
  if (palette.length === 0) registerColor('#38bdf8');

  const model = new ByteChunks();
  model.write(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="${unitSpec.xmlName}" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n` +
    `  <metadata name="Application">${escapeXml(`${BRAND.name} by ${BRAND.author}`)}</metadata>\n` +
    `  <metadata name="Organization">${escapeXml(BRAND.organization)}</metadata>\n` +
    `  <metadata name="SlicerTarget">${escapeXml(slicerTarget)}</metadata>\n` +
    `  <resources>\n    <basematerials id="1">\n`,
  );
  palette.forEach((hex, idx) => {
    model.write(`      <base name="Filament_${idx + 1}" displaycolor="${hex.toUpperCase()}FF" />\n`);
  });
  model.write(`    </basematerials>\n`);

  const buildItems: string[] = [];
  const configObjects: string[] = [];
  const configInstances: string[] = [];

  solidObjects.forEach((obj, objIdx) => {
    const objId = objIdx + 2;
    const world = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
    const base = normalizeHexColor(obj.color);
    const baseIdx = registerColor(base);
    const name = escapeXml(obj.name);
    const s = unitSpec.scaleFromMm;
    model.write(`    <object id="${objId}" type="model" name="${name}" pid="1" pindex="${baseIdx}">\n      <mesh>\n        <vertices>\n`);
    const p = world.positions;
    for (let v = 0; v < p.length; v += 3) {
      // Conversión Y-up -> Z-up (x, -z, y) escalada a la unidad destino
      model.write(`          <vertex x="${num(p[v] * s)}" y="${num(-p[v + 2] * s)}" z="${num(p[v + 1] * s)}" />\n`);
    }
    model.write(`        </vertices>\n        <triangles>\n`);
    const slots = new Set<number>([baseIdx]);
    const idx = world.indices;
    for (let t = 0; t < idx.length / 3; t++) {
      const face = world.faceColors?.[t];
      const p1 = face ? registerColor(face, base) : baseIdx;
      slots.add(p1);
      // Solo los triángulos de color distinto al base declaran pid/p1 (el resto hereda del objeto).
      const props = p1 !== baseIdx ? ` pid="1" p1="${p1}"` : '';
      model.write(`          <triangle v1="${idx[t * 3]}" v2="${idx[t * 3 + 1]}" v3="${idx[t * 3 + 2]}"${props} />\n`);
    }
    model.write(`        </triangles>\n      </mesh>\n    </object>\n`);
    buildItems.push(`    <item objectid="${objId}" />`);

    // Mapeo de extrusores (base 1..N) para Bambu/Orca/Elegoo/FlashForge/Snapmaker.
    const extruder = baseIdx + 1;
    const slotList = [...slots].map((i) => i + 1);
    const slotsMeta = slotList.length > 1 ? `\n    <metadata key="filament_slots" value="${slotList.join(',')}"/>` : '';
    configObjects.push(
      `  <object id="${objId}">\n` +
      `    <metadata key="name" value="${name}"/>\n` +
      `    <metadata key="extruder" value="${extruder}"/>${slotsMeta}\n` +
      `    <part id="${objId}" subtype="normal_part">\n` +
      `      <metadata key="name" value="${name}"/>\n` +
      `      <metadata key="extruder" value="${extruder}"/>\n` +
      `    </part>\n  </object>`,
    );
    configInstances.push(
      `    <model_instance>\n      <metadata key="object_id" value="${objId}"/>\n` +
      `      <metadata key="instance_id" value="0"/>\n    </model_instance>`,
    );
  });
  model.write(`  </resources>\n  <build>\n${buildItems.join('\n')}\n  </build>\n</model>\n`);

  const settings =
    `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n` +
    `  <metadata key="slicer_target" value="${escapeXml(slicerTarget)}"/>\n` +
    `  <metadata key="filament_count" value="${palette.length}"/>\n` +
    `${configObjects.join('\n')}\n  <plate>\n` +
    `    <metadata key="plater_id" value="1"/>\n    <metadata key="plater_name" value="Kura3D_Bed"/>\n` +
    `${configInstances.join('\n')}\n  </plate>\n</config>\n`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n` +
    `  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />\n` +
    `  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />\n` +
    `  <Default Extension="config" ContentType="text/xml" />\n</Types>\n`;
  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
    `  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />\n` +
    `</Relationships>\n`;

  return zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rels),
    '3D/3dmodel.model': model.toBytes(),
    'Metadata/model_settings.config': strToU8(settings),
  });
}
