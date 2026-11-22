/**
 * @file src/engine/io/threeMfImport.ts
 * @description Lector 3MF completo para archivos de Bambu Studio, OrcaSlicer y PrusaSlicer:
 * resuelve `<components>` anidados (incluidas referencias `p:path` de la extensión de producción),
 * instancias repetidas en `<build>`, transformaciones de ítem y componente, unidades, materiales
 * (`basematerials`, `colorgroup`), extrusores y colores de filamento de la configuración del
 * laminador. Devuelve piezas en coordenadas de escena (mm, Y-up) sin recentrar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { ModelImportError, checkInputSize, resolveLimits, type ModelImportLimits } from './importErrors';
import type { ImportedModel, ImportedPart } from './importTypes';
import { GrowableFloat32, GrowableUint32, finishMesh, normalizeHexColor } from './meshBuffers';
import { normalizePartPath, open3MFPackage, parseXmlAttrs, type ThreeMfPackage } from './threeMfPackage';
import { findElement, forEachElement, forEachLeaf } from './xmlScan';

/** Atributos crudos del primer elemento hoja con ese nombre local, o null. */
function findLeaf(xml: string, local: string): string | null {
  let found: string | null = null;
  forEachLeaf(xml, local, (attrs) => {
    found = attrs;
    return false;
  });
  return found;
}

/** Factores de conversión de unidades 3MF hacia milímetros internos. */
export const MF3_UNIT_TO_MM: Record<string, number> = {
  micron: 0.001,
  millimeter: 1,
  centimeter: 10,
  inch: 25.4,
  foot: 304.8,
  meter: 1000,
};

/** Matriz afín 3MF "m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32" (vector fila). */
type Affine = Float64Array;
const IDENTITY: Affine = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);

function parseTransform(raw: string | undefined): Affine | null {
  if (!raw) return null;
  const nums = raw.trim().split(/\s+/).map(Number);
  if (nums.length !== 12 || !nums.every(Number.isFinite)) {
    throw new ModelImportError('corrupt', `transform="${raw.slice(0, 60)}"`);
  }
  return new Float64Array(nums);
}

/** Compone `child` seguido de `parent` (v' = v·child·parent). */
function compose(child: Affine, parent: Affine): Affine {
  const out = new Float64Array(12);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      let sum = r === 3 ? parent[9 + c] : 0;
      for (let k = 0; k < 3; k++) sum += child[r * 3 + k] * parent[k * 3 + c];
      out[r * 3 + c] = sum;
    }
  }
  return out;
}

function determinant(m: Affine): number {
  return (
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6])
  );
}

interface ComponentRef {
  objectId: string;
  path?: string;
  transform: Affine;
}

interface ObjectDef {
  id: string;
  name?: string;
  type: string;
  pid?: string;
  pindex: number;
  meshBody?: string;
  components: ComponentRef[];
}

interface ModelDoc {
  path: string;
  unitScale: number;
  objects: Map<string, ObjectDef>;
  materials: Map<string, string[]>;
  build: Array<{ objectId: string; path?: string; transform: Affine | null }>;
}

interface CachedGeometry {
  positions: Float32Array;
  indices: Uint32Array;
  colors: (string | undefined)[];
  baseColor?: string;
}

/** Busca un atributo por nombre local ignorando el prefijo de espacio de nombres (p:path). */
function attrLocal(attrs: Record<string, string>, local: string): string | undefined {
  if (attrs[local] !== undefined) return attrs[local];
  for (const key of Object.keys(attrs)) {
    if (key.endsWith(`:${local}`)) return attrs[key];
  }
  return undefined;
}

function parseModelDoc(xml: string, path: string): ModelDoc {
  const modelTag = findLeaf(xml, 'model');
  if (modelTag === null) throw new ModelImportError('corrupt', `${path}: falta <model>`);
  const unit = (parseXmlAttrs(modelTag).unit ?? 'millimeter').toLowerCase();
  const unitScale = MF3_UNIT_TO_MM[unit] ?? 1;

  const materials = new Map<string, string[]>();
  forEachElement(xml, 'basematerials', ({ attrs, body }) => {
    const id = parseXmlAttrs(attrs).id;
    const colors: string[] = [];
    forEachLeaf(body ?? '', 'base', (a) => { colors.push(normalizeHexColor(parseXmlAttrs(a).displaycolor)); });
    if (id) materials.set(id, colors);
  });
  forEachElement(xml, 'colorgroup', ({ attrs, body }) => {
    const id = parseXmlAttrs(attrs).id;
    const colors: string[] = [];
    forEachLeaf(body ?? '', 'color', (a) => { colors.push(normalizeHexColor(parseXmlAttrs(a).color)); });
    if (id) materials.set(id, colors);
  });

  const objects = new Map<string, ObjectDef>();
  forEachElement(xml, 'object', ({ attrs: rawAttrs, body: rawBody }) => {
    const attrs = parseXmlAttrs(rawAttrs);
    if (!attrs.id) return;
    const body = rawBody ?? '';
    const meshMatch = findElement(body, 'mesh');
    const components: ComponentRef[] = [];
    forEachLeaf(body, 'component', (raw) => {
      const ca = parseXmlAttrs(raw);
      if (!ca.objectid) return;
      const compPath = attrLocal(ca, 'path');
      components.push({
        objectId: ca.objectid,
        path: compPath ? normalizePartPath(compPath) : undefined,
        transform: parseTransform(ca.transform) ?? IDENTITY,
      });
    });
    objects.set(attrs.id, {
      id: attrs.id,
      name: attrs.name || undefined,
      type: (attrs.type ?? 'model').toLowerCase(),
      pid: attrs.pid,
      pindex: attrs.pindex ? parseInt(attrs.pindex, 10) || 0 : 0,
      meshBody: meshMatch ? meshMatch.body ?? '' : undefined,
      components,
    });
  });

  const build: ModelDoc['build'] = [];
  const buildMatch = findElement(xml, 'build');
  if (buildMatch) {
    forEachLeaf(buildMatch.body ?? '', 'item', (raw) => {
      const attrs = parseXmlAttrs(raw);
      if (!attrs.objectid) return;
      const itemPath = attrLocal(attrs, 'path');
      build.push({
        objectId: attrs.objectid,
        path: itemPath ? normalizePartPath(itemPath) : undefined,
        transform: parseTransform(attrs.transform),
      });
    });
  }
  return { path, unitScale, objects, materials, build };
}

const COORD_RE = /\b([xyz])\s*=\s*"([^"]*)"/g;

function parseGeometry(doc: ModelDoc, obj: ObjectDef): CachedGeometry {
  const body = obj.meshBody ?? '';
  const vertBlock = findElement(body, 'vertices')?.body ?? '';
  const triBlock = findElement(body, 'triangles')?.body ?? '';

  const coords = new GrowableFloat32(4096);
  let vertexCount = 0;
  forEachLeaf(vertBlock, 'vertex', (raw) => {
    let x = NaN, y = NaN, z = NaN;
    COORD_RE.lastIndex = 0;
    let c: RegExpExecArray | null;
    while ((c = COORD_RE.exec(raw)) !== null) {
      const v = Number(c[2]);
      if (c[1] === 'x') x = v;
      else if (c[1] === 'y') y = v;
      else z = v;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new ModelImportError('non-finite', `objeto ${obj.id}, vértice ${vertexCount}`);
    }
    coords.push3(x, y, z);
    vertexCount++;
  });

  const baseColor = obj.pid ? doc.materials.get(obj.pid)?.[obj.pindex] : undefined;
  const indices = new GrowableUint32(4096);
  const colors: (string | undefined)[] = [];
  forEachLeaf(triBlock, 'triangle', (raw) => {
    const attrs = parseXmlAttrs(raw);
    const v1 = Number(attrs.v1), v2 = Number(attrs.v2), v3 = Number(attrs.v3);
    for (const v of [v1, v2, v3]) {
      if (!Number.isInteger(v) || v < 0 || v >= vertexCount) {
        throw new ModelImportError('invalid-index', `objeto ${obj.id}: ${attrs.v1},${attrs.v2},${attrs.v3} (${vertexCount} vértices)`);
      }
    }
    indices.push3(v1, v2, v3);
    const pid = attrs.pid ?? obj.pid;
    const p1 = attrs.p1 !== undefined ? parseInt(attrs.p1, 10) : obj.pindex;
    colors.push(pid ? doc.materials.get(pid)?.[p1] : undefined);
  });
  return { positions: coords.toArray(), indices: indices.toArray(), colors, baseColor };
}

interface Instance {
  doc: ModelDoc;
  obj: ObjectDef;
  transform: Affine;
  rootId: string;
  rootName?: string;
  group: number;
}

/**
 * Lee un 3MF y devuelve sus piezas (una por malla instanciada) en coordenadas de escena.
 */
export function read3MF(
  buffer: ArrayBuffer,
  fileName = 'model.3mf',
  limitsInput?: Partial<ModelImportLimits>,
): ImportedModel {
  const limits = resolveLimits(limitsInput);
  checkInputSize(buffer.byteLength, limits);
  const pkg: ThreeMfPackage = open3MFPackage(buffer, limits);
  const docs = new Map<string, ModelDoc>();
  const loadDoc = (path: string): ModelDoc => {
    const key = normalizePartPath(path).toLowerCase();
    let doc = docs.get(key);
    if (!doc) {
      const xml = pkg.readModel(path);
      if (xml === null) throw new ModelImportError('missing-model', path);
      doc = parseModelDoc(xml, path);
      docs.set(key, doc);
    }
    return doc;
  };

  const root = loadDoc(pkg.rootPath);
  const instances: Instance[] = [];
  let triangleBudget = 0;
  let visitedNodes = 0;
  const geometryCache = new Map<string, CachedGeometry>();
  const geometryOf = (doc: ModelDoc, obj: ObjectDef) => {
    const key = `${doc.path}#${obj.id}`;
    let geometry = geometryCache.get(key);
    if (!geometry) {
      geometry = parseGeometry(doc, obj);
      geometryCache.set(key, geometry);
    }
    return geometry;
  };

  const walk = (
    doc: ModelDoc, objectId: string, transform: Affine, depth: number, stack: string[],
    rootId: string, rootName: string | undefined, group: number,
  ) => {
    // Presupuesto global: cuenta cada nodo visitado (con o sin malla) para cortar árboles de
    // componentes vacíos que se expanden combinatoriamente.
    visitedNodes++;
    if (visitedNodes > limits.maxSceneNodes) throw new ModelImportError('too-many-parts', `${visitedNodes} nodos de componentes`);
    const obj = doc.objects.get(objectId);
    if (!obj) throw new ModelImportError('corrupt', `objeto ${objectId} inexistente en ${doc.path}`);
    if (obj.type === 'support' || obj.type === 'solidsupport' || obj.type === 'other') return;
    const key = `${doc.path}#${objectId}`;
    if (depth > limits.maxComponentDepth || stack.includes(key)) throw new ModelImportError('component-cycle');
    if (obj.meshBody !== undefined) {
      const geometry = geometryOf(doc, obj);
      triangleBudget += geometry.indices.length / 3;
      if (triangleBudget > limits.maxTriangles) throw new ModelImportError('too-many-triangles');
      if (instances.length >= limits.maxParts) throw new ModelImportError('too-many-parts');
      instances.push({ doc, obj, transform, rootId, rootName, group });
    }
    for (const comp of obj.components) {
      const childDoc = comp.path ? loadDoc(comp.path) : doc;
      walk(childDoc, comp.objectId, compose(comp.transform, transform), depth + 1, [...stack, key], rootId, rootName, group);
    }
  };

  // Sin <build>, se usa cada objeto raíz no referenciado como componente (archivos mínimos).
  const referenced = new Set<string>();
  for (const o of root.objects.values()) for (const c of o.components) if (!c.path) referenced.add(c.objectId);
  const items = root.build.length > 0
    ? root.build
    : [...root.objects.values()]
        .filter((obj) => !referenced.has(obj.id))
        .map((obj) => ({ objectId: obj.id, path: undefined as string | undefined, transform: null as Affine | null }));
  items.forEach((item, group) => {
    const doc = item.path ? loadDoc(item.path) : root;
    const obj = doc.objects.get(item.objectId);
    walk(doc, item.objectId, item.transform ?? IDENTITY, 0, [], item.objectId, obj?.name, group);
  });

  const { objects: cfgObjects, parts: cfgParts, filamentColors } = pkg.config;
  const extruderColor = (n?: number) => (n && filamentColors[n - 1]) || undefined;
  const baseName = fileName.replace(/\.3mf$/i, '');
  const multiInRoot = new Map<string, number>();
  for (const inst of instances) multiInRoot.set(`${inst.group}`, (multiInRoot.get(`${inst.group}`) ?? 0) + 1);

  const parts: ImportedPart[] = [];
  for (const inst of instances) {
    const partCfg = cfgParts.get(`${inst.rootId}/${inst.obj.id}`);
    const objCfg = cfgObjects.get(inst.rootId);
    const subtype = partCfg?.subtype ?? 'normal_part';
    if (subtype !== 'normal_part' && subtype !== 'negative_part') continue; // modificadores y soportes

    const geometry = geometryOf(inst.doc, inst.obj);
    const scale = inst.doc.unitScale;
    const t = inst.transform;
    const src = geometry.positions;
    const positions = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 3) {
      const x = src[i], y = src[i + 1], z = src[i + 2];
      const tx = (x * t[0] + y * t[3] + z * t[6] + t[9]) * scale;
      const ty = (x * t[1] + y * t[4] + z * t[7] + t[10]) * scale;
      const tz = (x * t[2] + y * t[5] + z * t[8] + t[11]) * scale;
      // 3MF Z-up -> Kura3D Y-up: (x, y, z) -> (x, z, -y)
      positions[i] = tx;
      positions[i + 1] = tz;
      positions[i + 2] = -ty;
    }
    const indices = new Uint32Array(geometry.indices);
    if (determinant(t) < 0) {
      for (let i = 0; i < indices.length; i += 3) {
        const tmp = indices[i + 1];
        indices[i + 1] = indices[i + 2];
        indices[i + 2] = tmp;
      }
    }

    // Color: material declarado > extrusor de la pieza/objeto > color dominante de los triángulos.
    const cfgColor = extruderColor(partCfg?.extruder) ?? extruderColor(objCfg?.extruder);
    const counts = new Map<string, number>();
    for (const c of geometry.colors) if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const color = geometry.baseColor ?? (counts.size > 0 ? dominant : cfgColor);
    const faceColors = counts.size > 0 ? geometry.colors.map((c) => c ?? color ?? '#38bdf8') : undefined;

    const finished = finishMesh(positions, indices, faceColors, color);
    const single = (multiInRoot.get(`${inst.group}`) ?? 1) === 1;
    const name =
      partCfg?.name ??
      (single ? objCfg?.name : undefined) ??
      inst.obj.name ??
      objCfg?.name ??
      inst.rootName ??
      `${baseName} ${parts.length + 1}`;
    parts.push({
      name,
      color,
      mesh: finished.mesh,
      isHole: subtype === 'negative_part' || undefined,
      group: inst.group,
      openEdges: finished.openEdges,
    });
  }
  if (parts.length === 0) throw new ModelImportError('no-geometry');

  // Nombres únicos para instancias repetidas.
  const seen = new Map<string, number>();
  for (const part of parts) {
    const n = (seen.get(part.name) ?? 0) + 1;
    seen.set(part.name, n);
    if (n > 1) part.name = `${part.name} (${n})`;
  }
  const explicit = root.build.some((item) => item.transform !== null);
  return { fileName, format: '3mf', parts, hasPlacement: explicit || items.length <= 1 };
}
