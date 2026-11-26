/**
 * @file src/engine/io/threeMfExport.ts
 * @description Escritor 3MF multicolor (ZIP + XML) compatible con Elegoo Slicer, OrcaSlicer,
 * Bambu Studio, Snapmaker Orca, FlashForge y PrusaSlicer. Cada objeto declara su color base
 * (`pid`/`pindex`) y los triángulos pintados su propio `p1`; el XML se genera por bloques
 * codificados directamente a bytes para no construir una cadena única gigante. Con la cama del proyecto, cada ítem
 * va en la celda de su placa de la rejilla de Bambu Studio / OrcaSlicer (`slicerPlateGrid.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strToU8, zipSync } from 'fflate';
import type { SceneGroup, SceneObject, SlicerTarget, UnitSystem } from '../../types/kura';
import { applyTransformToMesh } from '../primitives';
import { brandSignature, type ExportBrand } from './exportBrand';
import { normalizeHexColor } from './meshBuffers';
import { buildKuraSceneMeta, KURA_SCENE_PATH, type KuraScenePlates } from './kuraSceneMeta';
import { exportableObjects } from './stl';
import { isReference } from '../../core/scene/objectRole';
import { slicerPlateShift, validSlicerBed, type SlicerBed } from './slicerPlateGrid';
import { SLICER_PROJECT_SETTINGS_PATH, slicerProjectSettingsJson, type SlicerProjectSample } from './slicerProjectSample';

/**
 * Opciones para los laminadores derivados de Bambu Studio / OrcaSlicer. `bed`: cama del proyecto (rejilla de placas).
 * `project`: proyecto de ejemplo del laminador; con él se escribe `Metadata/project_settings.config` (9 claves) y el
 * laminador respeta placas, nombres, filamentos y colores. Sin él ese archivo no se escribe.
 */
export interface ThreeMfSlicerOptions {
  bed?: SlicerBed;
  project?: SlicerProjectSample;
}

/** Opciones de la exportación de escena completa (ida y vuelta exacta con Kurra Studio). */
export interface ThreeMfSceneOptions {
  /**
   * Árbol de grupos de la escena. Si se pasa, `objects` es la escena entera: lo visible y sólido va al
   * `<build>` (lo que imprimen los laminadores); lo oculto y los huecos quedan como recursos sin ítem
   * de build, y `Metadata/kura_scene.json` guarda transformaciones, estado y grupos para restaurarla.
   */
  groups: readonly SceneGroup[];
}

/** Placas reales de la escena (lote P6): mandan sobre los grupos raíz como placas del laminador. */
export interface ThreeMfPlateLayout {
  /** Nombre de cada placa y los ids de sus objetos, ya colocados respecto de su cama. */
  plates: ReadonlyArray<{ name: string; objectIds: readonly string[] }>;
  /** Desplazamiento [X, Z] restado a cada objeto (por id); viaja en los metadatos de escena para restaurarla. */
  offsets?: Readonly<Record<string, readonly [number, number]>>;
  /** Placas reales de la escena completa (P7): viajan en los metadatos para volver como placas al abrir el 3MF. */
  scenePlates?: KuraScenePlates;
  /** Nombre de la única placa del archivo cuando es una placa creada por la persona (p. ej. exportar una placa). */
  singlePlateName?: string;
}

/**
 * Placas del laminador desde las placas reales, en su orden y con las vacías incluidas (el laminador guarda una placa
 * vacía como `<plate>` sin `<model_instance>`): así la numeración y la celda de la rejilla calzan con la app. null si
 * quedan menos de dos placas o ninguna con piezas.
 */
function realPlates(printed: readonly SceneObject[], layout: ThreeMfPlateLayout): Array<{ name: string; members: Set<number> }> | null {
  const index = new Map(printed.map((o, i) => [o.id, i]));
  const owned = new Set<number>();
  const plates: Array<{ name: string; members: Set<number> }> = [];
  for (const plate of layout.plates) {
    const members = new Set<number>();
    for (const id of plate.objectIds) {
      const i = index.get(id);
      if (i === undefined || owned.has(i)) continue;
      members.add(i);
      owned.add(i);
    }
    plates.push({ name: plate.name, members });
  }
  // Lo impreso que no nombra ninguna placa (no debería pasar) va con la primera: nunca queda fuera del archivo.
  if (plates.length > 0) for (let i = 0; i < printed.length; i++) if (!owned.has(i)) plates[0].members.add(i);
  return plates.length >= 2 && owned.size > 0 ? plates : null;
}

/** Placas del laminador: una por grupo raíz si hay dos o más y cada objeto impreso cae en alguno. */
function scenePlates(printed: readonly SceneObject[], groups: readonly SceneGroup[]): Array<{ name: string; members: Set<number> }> | null {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const rootOf = (id: string | undefined): SceneGroup | undefined => {
    let g = id !== undefined ? byId.get(id) : undefined;
    for (let steps = 0; g?.parentId !== undefined && byId.has(g.parentId) && steps < groups.length; steps++) g = byId.get(g.parentId);
    return g;
  };
  const plates = new Map<string, { name: string; members: Set<number> }>();
  for (let i = 0; i < printed.length; i++) {
    const root = rootOf(printed[i].groupRef);
    if (!root) return null;
    let plate = plates.get(root.id);
    if (!plate) plates.set(root.id, (plate = { name: root.name, members: new Set() }));
    plate.members.add(i);
  }
  return plates.size >= 2 ? [...plates.values()] : null;
}

/** Datos del proyecto que viajan como metadatos estándar del 3MF (`Title`, `Description`, `Designer`). */
export interface ThreeMfProjectMeta {
  /** Nombre del proyecto. */
  title?: string | null;
  description?: string | null;
  /** Autor escrito por la persona. */
  designer?: string | null;
}

/**
 * Líneas `<metadata name="…">` del modelo para los datos del proyecto, escapadas. Un campo vacío (o solo espacios)
 * no se escribe: sin datos, el archivo queda byte a byte igual que antes.
 */
export function projectMetadataXml(meta: ThreeMfProjectMeta | undefined): string {
  if (!meta) return '';
  const rows: Array<[string, string | null | undefined]> = [['Title', meta.title], ['Description', meta.description], ['Designer', meta.designer]];
  let out = '';
  for (const [name, value] of rows) {
    const text = value?.trim();
    if (text) out += `  <metadata name="${name}">${escapeXml(text)}</metadata>\n`;
  }
  return out;
}

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

/** Número con hasta 5 decimales, sin ceros finales (sin expresiones regulares: va por cada coordenada). */
export const num = (n: number) => {
  const s = n.toFixed(5);
  if (s.indexOf('.') < 0) return s;
  let end = s.length;
  while (s.charCodeAt(end - 1) === 48) end--; // '0'
  if (s.charCodeAt(end - 1) === 46) end--; // '.'
  return end === s.length ? s : s.slice(0, end);
};

/**
 * Genera un paquete `.3mf` (`[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model` y
 * `Metadata/model_settings.config`) con `<basematerials>` y colores por triángulo. Es un único 3MF estándar:
 * `_deprecatedSlicerTarget` se acepta e ignora para no romper a quienes aún lo pasan (p. ej. el servidor MCP).
 * `brand` (la marca de la app, desde quien llama) firma los metadatos `Application`/`Organization`; sin ella se
 * omiten. La placa implícita (sin placas creadas) va sin nombre. `plateLayout` (placas reales) reparte lo impreso en las placas del
 * laminador (Bambu Studio / OrcaSlicer) y manda sobre los grupos. `projectMeta` (nombre, descripción y autor del
 * proyecto) va como metadatos estándar `Title` / `Description` / `Designer`; los vacíos se omiten.
 *
 * `slicer.bed` (la cama del proyecto) coloca el archivo para Bambu Studio / OrcaSlicer y derivados: cada `<item>` lleva
 * un `transform` que traslada la pieza, medida desde el centro de su cama, a la celda de su placa en la rejilla del
 * laminador (`slicerPlateGrid.ts`; los vértices no cambian), y el modelo declara `BambuStudio:3mfVersion`. Sin ella el
 * archivo queda como antes, sin transformaciones.
 */
export function exportSceneTo3MF(
  objects: SceneObject[],
  unit: UnitSystem = 'mm',
  _deprecatedSlicerTarget?: SlicerTarget,
  brand?: ExportBrand,
  sceneOptions?: ThreeMfSceneOptions,
  plateLayout?: ThreeMfPlateLayout,
  projectMeta?: ThreeMfProjectMeta,
  slicer?: ThreeMfSlicerOptions,
): Uint8Array {
  const solidObjects = exportableObjects(objects);
  // Escena completa: lo no impreso (oculto, negativos) se escribe después, sin ítem de build. Las
  // referencias se omiten siempre: solo viven en el `.kura` (una versión vieja las leería como sólidos).
  const extraObjects = sceneOptions ? objects.filter((o) => !solidObjects.includes(o) && !isReference(o)) : [];
  const written = [...solidObjects, ...extraObjects];
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
  const registerObject = (obj: SceneObject) => {
    const base = normalizeHexColor(obj.color);
    registerColor(base);
    obj.mesh.faceColors?.forEach((c) => registerColor(c, base));
  };
  solidObjects.forEach(registerObject);
  if (palette.length === 0) registerColor('#38bdf8');
  // Filamentos que ven los laminadores: solo los de lo impreso (los colores de huecos/ocultos van después). No se escribe
  // `filament_count` en model_settings.config: Elegoo Slicer / OrcaSlicer descartan el archivo entero al verlo.
  const filamentCount = palette.length;
  extraObjects.forEach(registerObject);

  const signature = brandSignature(brand);
  const bed = slicer && validSlicerBed(slicer.bed) ? slicer.bed : undefined;
  const model = new ByteChunks();
  model.write(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="${unitSpec.xmlName}" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"` +
    (bed ? ` xmlns:BambuStudio="${BAMBU_NS}"` : '') + `>\n` +
    (signature ? `  <metadata name="Application">${escapeXml(signature)}</metadata>\n` : '') +
    // Versión del formato de proyecto del laminador (la declaran los 3MF de proyecto de Bambu Studio / OrcaSlicer).
    (bed ? `  <metadata name="BambuStudio:3mfVersion">1</metadata>\n` : '') +
    (brand?.organization ? `  <metadata name="Organization">${escapeXml(brand.organization)}</metadata>\n` : '') +
    projectMetadataXml(projectMeta) +
    `  <resources>\n    <basematerials id="1">\n`,
  );
  palette.forEach((hex, idx) => {
    model.write(`      <base name="Filament_${idx + 1}" displaycolor="${hex.toUpperCase()}FF" />\n`);
  });
  model.write(`    </basematerials>\n`);

  const buildItems: string[] = [];
  const configObjects: string[] = [];
  const configInstances: string[] = [];
  // Con placas reales, ellas definen las placas del laminador; sin ellas, los grupos raíz de la escena completa.
  // Un `plateLayout` que solo trae `scenePlates` (una placa en el origen) no cambia las placas del laminador.
  const realLayout = plateLayout && (plateLayout.plates.length > 0 || plateLayout.offsets) ? plateLayout : undefined;
  const plates = realLayout ? realPlates(solidObjects, realLayout) : sceneOptions ? scenePlates(solidObjects, sceneOptions.groups) : null;
  // Placa (desde 0) de cada objeto impreso, para su celda en la rejilla del laminador.
  const plateIndex = new Array<number>(solidObjects.length).fill(0);
  plates?.forEach((p, i) => p.members.forEach((m) => { plateIndex[m] = i; }));
  const plateCount = plates?.length ?? 1;

  written.forEach((obj, objIdx) => {
    const objId = objIdx + 2;
    const printed = objIdx < solidObjects.length;
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
    if (!printed) return; // oculto o hueco: solo Kurra Studio lo restaura (los laminadores no lo ven)
    if (bed) {
      const [tx, ty] = slicerPlateShift(plateIndex[objIdx], plateCount, bed);
      buildItems.push(`    <item objectid="${objId}" transform="1 0 0 0 1 0 0 0 1 ${num(tx * s)} ${num(ty * s)} 0" />`);
    } else buildItems.push(`    <item objectid="${objId}" />`);

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
    configInstances[objIdx] =
      `    <model_instance>\n      <metadata key="object_id" value="${objId}"/>\n` +
      `      <metadata key="instance_id" value="0"/>\n      <metadata key="identify_id" value="${objId}"/>\n    </model_instance>`;
  });
  model.write(`  </resources>\n  <build>\n${buildItems.join('\n')}\n  </build>\n</model>\n`);

  const plateXml = (id: number, name: string, members: number[]) =>
    `  <plate>\n    <metadata key="plater_id" value="${id}"/>\n    <metadata key="plater_name" value="${escapeXml(name)}"/>\n    <metadata key="locked" value="false"/>\n` +
    members.map((i) => `${configInstances[i]}\n`).join('') + '  </plate>';
  const platesXml = plates
    ? plates.map((p, i) => plateXml(i + 1, p.name, [...p.members])).join('\n')
    // Placa implícita (proyecto sin placas): nombre vacío, para que el laminador muestre el suyo por defecto.
    : plateXml(1, plateLayout?.singlePlateName ?? '', solidObjects.map((_, i) => i));
  const settings =
    `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n` +
    `${configObjects.join('\n')}\n${platesXml}\n</config>\n`;
  const sceneMeta: Record<string, Uint8Array> = sceneOptions
    ? { [KURA_SCENE_PATH]: strToU8(JSON.stringify(buildKuraSceneMeta(written, written.map((_, i) => String(i + 2)), sceneOptions.groups, plateLayout?.offsets, plateLayout?.scenePlates))) }
    : {};

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n` +
    `  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />\n` +
    `  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />\n` +
    `  <Default Extension="config" ContentType="text/xml" />\n` +
    (sceneOptions ? `  <Default Extension="json" ContentType="application/json" />\n` : '') +
    `</Types>\n`;
  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
    `  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />\n` +
    `</Relationships>\n`;

  // Fecha fija en las entradas del ZIP: la misma escena produce siempre los mismos bytes.
  return zipSync(
    {
      '[Content_Types].xml': strToU8(contentTypes),
      '_rels/.rels': strToU8(rels),
      '3D/3dmodel.model': model.toBytes(),
      'Metadata/model_settings.config': strToU8(settings),
      ...(slicer?.project ? { [SLICER_PROJECT_SETTINGS_PATH]: strToU8(slicerProjectSettingsJson(slicer.project, palette.slice(0, filamentCount))) } : {}),
      ...sceneMeta,
    },
    { mtime: ZIP_FIXED_MTIME, level: ZIP_LEVEL },
  );
}

/**
 * Nivel de deflate. Con DAFFY (290 MB de XML) el nivel 6 de fflate tardaba 23,7 s y daba 52,8 MB; el
 * nivel 1 tarda 5,9 s y da 57,5 MB (+9 %). El 3MF sigue siendo ZIP/deflate estándar para los laminadores.
 */
const ZIP_LEVEL = 1;

/** Espacio de nombres de los metadatos de proyecto de Bambu Studio (lo usan también OrcaSlicer y derivados). */
const BAMBU_NS = 'http://schemas.bambulab.com/package/2021';

/** Fecha de las entradas del ZIP (la mínima del formato DOS): salida determinista. */
const ZIP_FIXED_MTIME = new Date(1980, 0, 1, 0, 0, 0);
