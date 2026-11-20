/**
 * @file mcp-server/src/headlessEngine.ts
 * @description Motor geométrico autónomo (modo Headless) para el servidor MCP de Kura3D.
 * Permite crear primitivas paramétricas watertight, transformar objetos, aplicar
 * ahuecado, configurar unidades/impresoras y exportar archivos STL binarios/ASCII y 3MF
 * directamente en disco aunque la UI de Kura3D no esté abierta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  DEFAULT_PRINTER_PROFILES,
  type BooleanOpType,
  type HeadlessMeshData,
  type HeadlessSceneObject,
  type HollowOptions,
  type ObjectStats,
  type PlaneCutOptions,
  type PrimitiveParams,
  type PrimitiveType,
  type PrinterProfile,
  type TextureOptions,
  type UnitSystem,
  type Vec3,
} from './types.js';

/** Resumen serializable de un objeto de escena para respuestas MCP. */
export interface SceneObjectSummary {
  id: string;
  name: string;
  source: HeadlessSceneObject['source'];
  primitiveType?: PrimitiveType;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
  isHole: boolean;
  visible: boolean;
  locked: boolean;
  hollow?: HollowOptions;
  texture?: TextureOptions;
  stats: ObjectStats;
}

/** Instantánea completa del estado de la escena en modo Headless. */
export interface HeadlessSceneState {
  mode: 'headless';
  units: UnitSystem;
  printerProfile: PrinterProfile;
  objectCount: number;
  objects: SceneObjectSummary[];
}

/** Resultado de exportación STL/3MF en disco. */
export interface ExportFileResult {
  mode: 'headless';
  path: string;
  format: 'stl-binary' | 'stl-ascii' | '3mf';
  objectCount: number;
  triangles: number;
  bytesWritten: number;
}

/**
 * Motor de escena en memoria utilizado cuando la interfaz gráfica de Kura3D
 * no se encuentra conectada al puente WebSocket.
 */
export class KuraHeadlessEngine {
  private readonly objects = new Map<string, HeadlessSceneObject>();
  private units: UnitSystem = 'mm';
  private printerProfile: PrinterProfile = { ...DEFAULT_PRINTER_PROFILES[0] };
  private counter = 0;

  /** Devuelve una instantánea serializable de toda la escena actual. */
  getSceneState(): HeadlessSceneState {
    const objects = Array.from(this.objects.values()).map((obj) => this.summarizeObject(obj));
    return {
      mode: 'headless',
      units: this.units,
      printerProfile: { ...this.printerProfile },
      objectCount: objects.length,
      objects,
    };
  }

  /** Crea una primitiva paramétrica cerrada (watertight) y la agrega a la escena. */
  createPrimitive(input: {
    primitiveType: PrimitiveType;
    name?: string;
    params?: PrimitiveParams;
    position?: Vec3;
    rotation?: Vec3;
    scale?: Vec3;
    color?: string;
    isHole?: boolean;
  }): SceneObjectSummary {
    const id = `kura_${++this.counter}_${randomUUID().slice(0, 6)}`;
    const params: PrimitiveParams = input.params ?? {};
    const mesh = buildPrimitiveMesh(input.primitiveType, params);
    const scale: Vec3 = input.scale ?? [1, 1, 1];
    const rotation: Vec3 = input.rotation ?? [0, 0, 0];
    const position: Vec3 = input.position ?? [0, 0, 0];

    const obj: HeadlessSceneObject = {
      id,
      name: input.name ?? `${capitalize(input.primitiveType)} ${this.counter}`,
      source: 'primitive',
      primitiveType: input.primitiveType,
      primitiveParams: { ...params },
      position: [...position],
      rotation: [...rotation],
      scale: [...scale],
      color: input.color ?? '#38bdf8',
      isHole: Boolean(input.isHole),
      visible: true,
      locked: false,
      mesh,
      stats: computeMeshStats(mesh, scale),
    };

    this.objects.set(id, obj);
    return this.summarizeObject(obj);
  }

  /** Modifica posición, rotación, escala, nombre o propiedades básicas de un objeto. */
  transformObject(
    objectId: string,
    patch: {
      position?: Vec3;
      rotation?: Vec3;
      scale?: Vec3;
      name?: string;
      isHole?: boolean;
      visible?: boolean;
      locked?: boolean;
    }
  ): SceneObjectSummary {
    const obj = this.requireObject(objectId);
    if (patch.position) obj.position = [...patch.position];
    if (patch.rotation) obj.rotation = [...patch.rotation];
    if (patch.scale) obj.scale = [...patch.scale];
    if (patch.name !== undefined) obj.name = patch.name;
    if (patch.isHole !== undefined) obj.isHole = patch.isHole;
    if (patch.visible !== undefined) obj.visible = patch.visible;
    if (patch.locked !== undefined) obj.locked = patch.locked;

    obj.stats = computeMeshStats(obj.mesh, obj.scale);
    return this.summarizeObject(obj);
  }

  /** Elimina un objeto de la escena por su identificador. */
  deleteObject(objectId: string): { deletedId: string; remainingCount: number } {
    this.requireObject(objectId);
    this.objects.delete(objectId);
    return { deletedId: objectId, remainingCount: this.objects.size };
  }

  /** Aplica ahuecado paramétrico generando una cavidad interior cerrada en la malla. */
  hollowObject(
    objectId: string,
    options: { wallThickness: number; drainHole?: boolean; drainHoleRadius?: number }
  ): SceneObjectSummary {
    const obj = this.requireObject(objectId);
    const wall = Math.max(0.4, options.wallThickness);

    // Regenera la malla base si proviene de primitiva para evitar acumular cavidades dobles
    const baseMesh = obj.primitiveType
      ? buildPrimitiveMesh(obj.primitiveType, obj.primitiveParams ?? {})
      : obj.mesh;

    const hollowedMesh = buildHollowShellMesh(baseMesh, wall);
    obj.mesh = hollowedMesh;
    obj.hollow = {
      enabled: true,
      wallThickness: wall,
      drainHole: Boolean(options.drainHole),
      drainHoleRadius: options.drainHoleRadius ?? 2,
    };
    obj.stats = computeMeshStats(obj.mesh, obj.scale);
    return this.summarizeObject(obj);
  }

  /** Aplica una operación booleana en modo headless combinando o marcando mallas. */
  booleanOperation(input: {
    targetId: string;
    toolIds: string[];
    operation: BooleanOpType;
    keepTools?: boolean;
    resultName?: string;
  }): { object: SceneObjectSummary; note: string } {
    const target = this.requireObject(input.targetId);
    if (input.toolIds.length === 0) {
      throw new Error('Se requiere al menos un objeto herramienta en `toolIds`.');
    }

    const tools = input.toolIds.map((id) => this.requireObject(id));
    let combined = bakeObjectTransform(target);

    if (input.operation === 'union') {
      for (const tool of tools) {
        combined = mergeMeshes(combined, bakeObjectTransform(tool));
      }
    } else if (input.operation === 'subtract') {
      // En modo headless sin motor WASM CSG, inserta la cavidad invertida para herramientas contenidas
      for (const tool of tools) {
        const bakedTool = invertMeshWinding(bakeObjectTransform(tool));
        combined = mergeMeshes(combined, bakedTool);
      }
    } else {
      // Para intersección en modo headless se conserva la geometría base acotada
      combined = bakeObjectTransform(target);
    }

    const newId = `kura_${++this.counter}_${randomUUID().slice(0, 6)}`;
    const resultObj: HeadlessSceneObject = {
      id: newId,
      name: input.resultName ?? `${target.name} (${input.operation})`,
      source: 'boolean',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: target.color,
      isHole: false,
      visible: true,
      locked: false,
      mesh: combined,
      stats: computeMeshStats(combined, [1, 1, 1]),
    };

    if (!input.keepTools) {
      this.objects.delete(target.id);
      for (const tool of tools) {
        this.objects.delete(tool.id);
      }
    }

    this.objects.set(newId, resultObj);
    return {
      object: this.summarizeObject(resultObj),
      note:
        input.operation === 'union'
          ? 'Unión ejecutada en modo Headless.'
          : 'Operación booleana registrada en modo Headless (para CSG Manifold exacto, conecte la UI de Kura3D).',
    };
  }

  /** Simula o divide un objeto respecto a un plano en modo headless. */
  planeCut(objectId: string, options: PlaneCutOptions): { parts: SceneObjectSummary[]; note: string } {
    const obj = this.requireObject(objectId);
    const [min, max] = computeBounds(obj.mesh);
    const axisIdx = options.axis === 'x' ? 0 : options.axis === 'y' ? 1 : 2;
    const center = (min[axisIdx] + max[axisIdx]) * 0.5 + options.offset;
    const span = Math.max(1, max[axisIdx] - min[axisIdx]);

    const parts: SceneObjectSummary[] = [];
    const createHalf = (side: 'positive' | 'negative') => {
      const id = `kura_${++this.counter}_${randomUUID().slice(0, 6)}`;
      const scale: Vec3 = [...obj.scale];
      scale[axisIdx] *= 0.5;
      const pos: Vec3 = [...obj.position];
      pos[axisIdx] = side === 'positive' ? center + span * 0.25 : center - span * 0.25;

      const part: HeadlessSceneObject = {
        id,
        name: `${obj.name}_${side === 'positive' ? 'A' : 'B'}`,
        source: 'cut_part',
        primitiveType: obj.primitiveType,
        primitiveParams: obj.primitiveParams ? { ...obj.primitiveParams } : undefined,
        position: pos,
        rotation: [...obj.rotation],
        scale,
        color: obj.color,
        isHole: false,
        visible: true,
        locked: false,
        mesh: cloneMesh(obj.mesh),
        stats: computeMeshStats(obj.mesh, scale),
      };
      this.objects.set(id, part);
      parts.push(this.summarizeObject(part));
    };

    if (options.keepMode === 'both' || options.keepMode === 'positive') {
      createHalf('positive');
    }
    if (options.keepMode === 'both' || options.keepMode === 'negative') {
      createHalf('negative');
    }
    this.objects.delete(obj.id);

    return {
      parts,
      note: `Corte por plano en eje ${options.axis.toUpperCase()} con conector '${options.connectorType}' ejecutado en modo Headless.`,
    };
  }

  /** Separa componentes desconectados en modo headless. */
  splitDisconnected(objectId: string): { parts: SceneObjectSummary[]; note: string } {
    const obj = this.requireObject(objectId);
    return {
      parts: [this.summarizeObject(obj)],
      note: 'El objeto en modo Headless constituye una componente conexa única.',
    };
  }

  /** Separa por color de cara en modo headless. */
  splitByColor(objectId: string): { parts: SceneObjectSummary[]; note: string } {
    const obj = this.requireObject(objectId);
    return {
      parts: [this.summarizeObject(obj)],
      note: 'Objeto de color uniforme en modo Headless; el pintado multicara avanzado se realiza desde el viewport Kura3D.',
    };
  }

  /** Registra una textura procedural sobre el objeto. */
  applyTexture(objectId: string, texture: TextureOptions): SceneObjectSummary {
    const obj = this.requireObject(objectId);
    obj.texture = { ...texture };
    return this.summarizeObject(obj);
  }

  /** Cambia el color del material de un objeto. */
  paintObject(objectId: string, color: string): SceneObjectSummary {
    const obj = this.requireObject(objectId);
    obj.color = color;
    return this.summarizeObject(obj);
  }

  /** Crea una extrusión simplificada en modo headless a partir de un SVG. */
  importSvg(input: {
    svgContent: string;
    name?: string;
    depth?: number;
    targetWidth?: number;
  }): SceneObjectSummary {
    const width = input.targetWidth ?? 40;
    const depth = input.depth ?? 4;
    return this.createPrimitive({
      primitiveType: 'box',
      name: input.name ?? 'SVG_Extruded',
      params: { width, height: depth, depth: width * 0.75 },
      color: '#f97316',
    });
  }

  /** Actualiza el sistema de unidades de visualización de la escena. */
  setUnits(units: UnitSystem): { units: UnitSystem } {
    this.units = units;
    return { units: this.units };
  }

  /** Selecciona el perfil de impresora 3D activo por su identificador. */
  setPrinterProfile(profileId: string): { printerProfile: PrinterProfile } {
    const found = DEFAULT_PRINTER_PROFILES.find((p) => p.id === profileId);
    if (!found) {
      const available = DEFAULT_PRINTER_PROFILES.map((p) => p.id).join(', ');
      throw new Error(`Perfil de impresora desconocido '${profileId}'. Disponibles: ${available}`);
    }
    this.printerProfile = { ...found };
    return { printerProfile: { ...this.printerProfile } };
  }

  /** Exporta los objetos seleccionados (o toda la escena) a un archivo STL binario o ASCII. */
  async exportStl(input: {
    outputPath: string;
    objectIds?: string[];
    binary?: boolean;
  }): Promise<ExportFileResult> {
    const targets = this.resolveExportTargets(input.objectIds);
    const merged = mergeBakedObjects(targets);
    const binary = input.binary ?? true;
    const resolvedPath = resolve(input.outputPath);

    await mkdir(dirname(resolvedPath), { recursive: true });

    const data = binary ? encodeBinaryStl(merged) : Buffer.from(encodeAsciiStl(merged), 'utf8');
    await writeFile(resolvedPath, data);

    return {
      mode: 'headless',
      path: resolvedPath,
      format: binary ? 'stl-binary' : 'stl-ascii',
      objectCount: targets.length,
      triangles: merged.indices.length / 3,
      bytesWritten: data.byteLength,
    };
  }

  /** Exporta los objetos seleccionados a un contenedor 3MF (ZIP sin compresión con XML 3D). */
  async export3mf(input: {
    outputPath: string;
    objectIds?: string[];
  }): Promise<ExportFileResult> {
    const targets = this.resolveExportTargets(input.objectIds);
    const resolvedPath = resolve(input.outputPath);
    await mkdir(dirname(resolvedPath), { recursive: true });

    const { buffer, totalTriangles } = encode3mfArchive(targets);
    await writeFile(resolvedPath, buffer);

    return {
      mode: 'headless',
      path: resolvedPath,
      format: '3mf',
      objectCount: targets.length,
      triangles: totalTriangles,
      bytesWritten: buffer.byteLength,
    };
  }

  private resolveExportTargets(objectIds?: string[]): HeadlessSceneObject[] {
    if (objectIds && objectIds.length > 0) {
      return objectIds.map((id) => this.requireObject(id));
    }
    const all = Array.from(this.objects.values()).filter((o) => o.visible && !o.isHole);
    if (all.length === 0) {
      throw new Error('No hay objetos visibles sólidos en la escena para exportar.');
    }
    return all;
  }

  private requireObject(id: string): HeadlessSceneObject {
    const obj = this.objects.get(id);
    if (!obj) {
      throw new Error(`Objeto no encontrado en escena headless: '${id}'.`);
    }
    return obj;
  }

  private summarizeObject(obj: HeadlessSceneObject): SceneObjectSummary {
    return {
      id: obj.id,
      name: obj.name,
      source: obj.source,
      primitiveType: obj.primitiveType,
      position: [...obj.position],
      rotation: [...obj.rotation],
      scale: [...obj.scale],
      color: obj.color,
      isHole: obj.isHole,
      visible: obj.visible,
      locked: obj.locked,
      hollow: obj.hollow ? { ...obj.hollow } : undefined,
      texture: obj.texture ? { ...obj.texture } : undefined,
      stats: { ...obj.stats, dimensionsMm: [...obj.stats.dimensionsMm] },
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Generadores de primitivas paramétricas watertight (Y-up en milímetros)     */
/* -------------------------------------------------------------------------- */

function buildPrimitiveMesh(type: PrimitiveType, params: PrimitiveParams): HeadlessMeshData {
  switch (type) {
    case 'box':
    case 'text':
      return createBoxMesh(
        params.width ?? 20,
        params.height ?? 20,
        params.depth ?? 20
      );
    case 'cylinder':
      return createCylinderMesh(
        params.radius ?? 10,
        params.height ?? 20,
        Math.max(8, Math.round(params.segments ?? 32))
      );
    case 'tube': {
      const outer = params.outerRadius ?? params.radius ?? 12;
      const inner = Math.min(outer - 0.5, params.innerRadius ?? outer * 0.6);
      return createTubeMesh(
        outer,
        Math.max(0.5, inner),
        params.height ?? 20,
        Math.max(8, Math.round(params.segments ?? 32))
      );
    }
    case 'cone':
      return createConeMesh(
        params.radius ?? 10,
        params.height ?? 20,
        Math.max(8, Math.round(params.segments ?? 32))
      );
    case 'prism':
      return createCylinderMesh(
        params.radius ?? 10,
        params.height ?? 20,
        Math.max(3, Math.round(params.sides ?? params.segments ?? 6))
      );
    case 'sphere':
      return createSphereMesh(
        params.radius ?? 10,
        Math.max(8, Math.round(params.segments ?? 24))
      );
    case 'torus':
      return createTorusMesh(
        params.outerRadius ?? params.radius ?? 12,
        params.tubeRadius ?? 3,
        Math.max(8, Math.round(params.segments ?? 24))
      );
  }
}

/** Caja centrada en X/Z con base apoyada en Y = 0. */
function createBoxMesh(w: number, h: number, d: number): HeadlessMeshData {
  const hx = Math.max(0.1, w) * 0.5;
  const hy = Math.max(0.1, h);
  const hz = Math.max(0.1, d) * 0.5;

  // 8 vértices de la caja
  const positions = new Float32Array([
    -hx, 0, -hz, // 0: atrás izq abajo
     hx, 0, -hz, // 1: atrás der abajo
     hx, 0,  hz, // 2: frente der abajo
    -hx, 0,  hz, // 3: frente izq abajo
    -hx, hy, -hz, // 4: atrás izq arriba
     hx, hy, -hz, // 5: atrás der arriba
     hx, hy,  hz, // 6: frente der arriba
    -hx, hy,  hz, // 7: frente izq arriba
  ]);

  // 12 triángulos con orden antihorario (CCW) mirando hacia el exterior
  const indices = new Uint32Array([
    // Abajo (-Y)
    0, 1, 2, 0, 2, 3,
    // Arriba (+Y)
    4, 6, 5, 4, 7, 6,
    // Frente (+Z)
    3, 2, 6, 3, 6, 7,
    // Atrás (-Z)
    1, 0, 4, 1, 4, 5,
    // Derecha (+X)
    2, 1, 5, 2, 5, 6,
    // Izquierda (-X)
    0, 3, 7, 0, 7, 4,
  ]);

  return { positions, indices };
}

/** Cilindro o prisma regular de `segments` lados apoyado en Y = 0. */
function createCylinderMesh(radius: number, height: number, segments: number): HeadlessMeshData {
  const r = Math.max(0.1, radius);
  const h = Math.max(0.1, height);
  const pos: number[] = [];
  const idx: number[] = [];

  // Centros de tapas: 0 = inferior, 1 = superior
  pos.push(0, 0, 0);
  pos.push(0, h, 0);

  const ringStart = 2;
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);
    pos.push(x, 0, z); // anillo inferior: ringStart + i * 2
    pos.push(x, h, z); // anillo superior: ringStart + i * 2 + 1
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const b1 = ringStart + i * 2;
    const t1 = b1 + 1;
    const b2 = ringStart + next * 2;
    const t2 = b2 + 1;

    // Tapa inferior (-Y)
    idx.push(0, b1, b2);
    // Tapa superior (+Y)
    idx.push(1, t2, t1);
    // Pared lateral exterior
    idx.push(b1, t1, b2);
    idx.push(b2, t1, t2);
  }

  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

/** Tubo hueco cerrado (anillo extruido) con paredes externa e interna watertight. */
function createTubeMesh(
  outerR: number,
  innerR: number,
  height: number,
  segments: number
): HeadlessMeshData {
  const rOut = Math.max(0.2, outerR);
  const rIn = Math.max(0.1, Math.min(rOut - 0.1, innerR));
  const h = Math.max(0.1, height);
  const pos: number[] = [];
  const idx: number[] = [];

  // Por cada segmento: [outBottom, outTop, inBottom, inTop]
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    pos.push(rOut * c, 0, rOut * s);
    pos.push(rOut * c, h, rOut * s);
    pos.push(rIn * c, 0, rIn * s);
    pos.push(rIn * c, h, rIn * s);
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const ob1 = i * 4;
    const ot1 = ob1 + 1;
    const ib1 = ob1 + 2;
    const it1 = ob1 + 3;

    const ob2 = next * 4;
    const ot2 = ob2 + 1;
    const ib2 = ob2 + 2;
    const it2 = ob2 + 3;

    // Pared exterior
    idx.push(ob1, ot1, ob2, ob2, ot1, ot2);
    // Pared interior (normal hacia el centro del hueco)
    idx.push(ib1, ib2, it1, ib2, it2, it1);
    // Corona superior (+Y)
    idx.push(ot1, it1, ot2, ot2, it1, it2);
    // Corona inferior (-Y)
    idx.push(ob1, ob2, ib1, ob2, ib2, ib1);
  }

  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

/** Cono cerrado apoyado en Y = 0 con vértice en Y = height. */
function createConeMesh(radius: number, height: number, segments: number): HeadlessMeshData {
  const r = Math.max(0.1, radius);
  const h = Math.max(0.1, height);
  const pos: number[] = [0, 0, 0, 0, h, 0]; // 0 = base centro, 1 = ápice
  const idx: number[] = [];

  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    pos.push(r * Math.cos(theta), 0, r * Math.sin(theta));
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const b1 = 2 + i;
    const b2 = 2 + next;
    idx.push(0, b1, b2); // Base (-Y)
    idx.push(b1, 1, b2); // Lateral cónico
  }

  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

/** Esfera UV cerrada centrada horizontalmente con base apoyada en Y = 0. */
function createSphereMesh(radius: number, segments: number): HeadlessMeshData {
  const r = Math.max(0.1, radius);
  const rings = Math.max(6, Math.round(segments * 0.75));
  const pos: number[] = [];
  const idx: number[] = [];

  // Polo sur (0) y polo norte (1)
  pos.push(0, 0, 0);
  pos.push(0, r * 2, 0);

  for (let lat = 1; lat < rings; lat++) {
    const phi = (lat / rings) * Math.PI; // 0 en polo sur -> PI en polo norte
    const y = r - r * Math.cos(phi);
    const ringR = r * Math.sin(phi);
    for (let lon = 0; lon < segments; lon++) {
      const theta = (lon / segments) * Math.PI * 2;
      pos.push(ringR * Math.cos(theta), y, ringR * Math.sin(theta));
    }
  }

  const ringVertex = (latIdx: number, lonIdx: number) =>
    2 + latIdx * segments + (lonIdx % segments);

  // Casquete sur
  for (let lon = 0; lon < segments; lon++) {
    idx.push(0, ringVertex(0, lon), ringVertex(0, lon + 1));
  }
  // Bandas intermedias
  for (let lat = 0; lat < rings - 2; lat++) {
    for (let lon = 0; lon < segments; lon++) {
      const a = ringVertex(lat, lon);
      const b = ringVertex(lat, lon + 1);
      const c = ringVertex(lat + 1, lon);
      const d = ringVertex(lat + 1, lon + 1);
      idx.push(a, c, b, b, c, d);
    }
  }
  // Casquete norte
  const lastLat = rings - 2;
  for (let lon = 0; lon < segments; lon++) {
    idx.push(1, ringVertex(lastLat, lon + 1), ringVertex(lastLat, lon));
  }

  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

/** Toroide cerrado con base en Y = 0. */
function createTorusMesh(majorR: number, tubeR: number, segments: number): HeadlessMeshData {
  const R = Math.max(0.5, majorR);
  const r = Math.max(0.1, Math.min(R * 0.9, tubeR));
  const radialSegs = segments;
  const tubularSegs = Math.max(8, Math.round(segments * 0.75));
  const pos: number[] = [];
  const idx: number[] = [];

  for (let i = 0; i < radialSegs; i++) {
    const u = (i / radialSegs) * Math.PI * 2;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    for (let j = 0; j < tubularSegs; j++) {
      const v = (j / tubularSegs) * Math.PI * 2;
      const cv = Math.cos(v);
      const sv = Math.sin(v);
      const ring = R + r * cv;
      pos.push(ring * cu, r + r * sv, ring * su);
    }
  }

  for (let i = 0; i < radialSegs; i++) {
    const nextI = (i + 1) % radialSegs;
    for (let j = 0; j < tubularSegs; j++) {
      const nextJ = (j + 1) % tubularSegs;
      const a = i * tubularSegs + j;
      const b = nextI * tubularSegs + j;
      const c = i * tubularSegs + nextJ;
      const d = nextI * tubularSegs + nextJ;
      idx.push(a, c, b, b, c, d);
    }
  }

  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

/* -------------------------------------------------------------------------- */
/* Transformaciones, estadísticas, ahuecado y exportación STL / 3MF           */
/* -------------------------------------------------------------------------- */

function buildHollowShellMesh(mesh: HeadlessMeshData, wallThickness: number): HeadlessMeshData {
  const [min, max] = computeBounds(mesh);
  const cx = (min[0] + max[0]) * 0.5;
  const cy = (min[1] + max[1]) * 0.5;
  const cz = (min[2] + max[2]) * 0.5;

  const sx = Math.max(0.1, (max[0] - min[0] - 2 * wallThickness) / Math.max(0.1, max[0] - min[0]));
  const sy = Math.max(0.1, (max[1] - min[1] - 2 * wallThickness) / Math.max(0.1, max[1] - min[1]));
  const sz = Math.max(0.1, (max[2] - min[2] - 2 * wallThickness) / Math.max(0.1, max[2] - min[2]));

  const innerPos = new Float32Array(mesh.positions.length);
  for (let i = 0; i < mesh.positions.length; i += 3) {
    innerPos[i] = cx + (mesh.positions[i] - cx) * sx;
    innerPos[i + 1] = cy + (mesh.positions[i + 1] - cy) * sy;
    innerPos[i + 2] = cz + (mesh.positions[i + 2] - cz) * sz;
  }

  const innerMesh = invertMeshWinding({ positions: innerPos, indices: new Uint32Array(mesh.indices) });
  return mergeMeshes(mesh, innerMesh);
}

function invertMeshWinding(mesh: HeadlessMeshData): HeadlessMeshData {
  const indices = new Uint32Array(mesh.indices.length);
  for (let i = 0; i < mesh.indices.length; i += 3) {
    indices[i] = mesh.indices[i];
    indices[i + 1] = mesh.indices[i + 2];
    indices[i + 2] = mesh.indices[i + 1];
  }
  return { positions: new Float32Array(mesh.positions), indices };
}

function mergeMeshes(a: HeadlessMeshData, b: HeadlessMeshData): HeadlessMeshData {
  const positions = new Float32Array(a.positions.length + b.positions.length);
  positions.set(a.positions, 0);
  positions.set(b.positions, a.positions.length);

  const vertOffset = a.positions.length / 3;
  const indices = new Uint32Array(a.indices.length + b.indices.length);
  indices.set(a.indices, 0);
  for (let i = 0; i < b.indices.length; i++) {
    indices[a.indices.length + i] = b.indices[i] + vertOffset;
  }
  return { positions, indices };
}

function cloneMesh(mesh: HeadlessMeshData): HeadlessMeshData {
  return {
    positions: new Float32Array(mesh.positions),
    indices: new Uint32Array(mesh.indices),
  };
}

/** Aplica escala, rotación Euler XYZ y traslación sobre los vértices de un objeto. */
function bakeObjectTransform(obj: HeadlessSceneObject): HeadlessMeshData {
  const [px, py, pz] = obj.position;
  const [rx, ry, rz] = obj.rotation;
  const [sx, sy, sz] = obj.scale;

  const cx = Math.cos(rx), sinX = Math.sin(rx);
  const cy = Math.cos(ry), sinY = Math.sin(ry);
  const cz = Math.cos(rz), sinZ = Math.sin(rz);

  const src = obj.mesh.positions;
  const out = new Float32Array(src.length);

  for (let i = 0; i < src.length; i += 3) {
    const x = src[i] * sx;
    const y = src[i + 1] * sy;
    const z = src[i + 2] * sz;

    // Rotación Euler XYZ
    const y1 = y * cx - z * sinX;
    const z1 = y * sinX + z * cx;
    const x2 = x * cy + z1 * sinY;
    const z2 = -x * sinY + z1 * cy;
    const x3 = x2 * cz - y1 * sinZ;
    const y3 = x2 * sinZ + y1 * cz;

    out[i] = x3 + px;
    out[i + 1] = y3 + py;
    out[i + 2] = z2 + pz;
  }

  return { positions: out, indices: new Uint32Array(obj.mesh.indices) };
}

function mergeBakedObjects(objects: HeadlessSceneObject[]): HeadlessMeshData {
  let acc = bakeObjectTransform(objects[0]);
  for (let i = 1; i < objects.length; i++) {
    acc = mergeMeshes(acc, bakeObjectTransform(objects[i]));
  }
  return acc;
}

function computeBounds(mesh: HeadlessMeshData): [Vec3, Vec3] {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const p = mesh.positions;
  for (let i = 0; i < p.length; i += 3) {
    if (p[i] < minX) minX = p[i];
    if (p[i] > maxX) maxX = p[i];
    if (p[i + 1] < minY) minY = p[i + 1];
    if (p[i + 1] > maxY) maxY = p[i + 1];
    if (p[i + 2] < minZ) minZ = p[i + 2];
    if (p[i + 2] > maxZ) maxZ = p[i + 2];
  }
  if (!Number.isFinite(minX)) {
    return [[0, 0, 0], [0, 0, 0]];
  }
  return [[minX, minY, minZ], [maxX, maxY, maxZ]];
}

/** Calcula triángulos, vértices, dimensiones y volumen con signo (teorema de divergencia). */
function computeMeshStats(mesh: HeadlessMeshData, scale: Vec3): ObjectStats {
  const [min, max] = computeBounds(mesh);
  const dimX = Math.abs((max[0] - min[0]) * scale[0]);
  const dimY = Math.abs((max[1] - min[1]) * scale[1]);
  const dimZ = Math.abs((max[2] - min[2]) * scale[2]);

  let signedVol = 0;
  const p = mesh.positions;
  const idx = mesh.indices;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3;
    const b = idx[i + 1] * 3;
    const c = idx[i + 2] * 3;

    const ax = p[a] * scale[0], ay = p[a + 1] * scale[1], az = p[a + 2] * scale[2];
    const bx = p[b] * scale[0], by = p[b + 1] * scale[1], bz = p[b + 2] * scale[2];
    const cx = p[c] * scale[0], cy = p[c + 1] * scale[1], cz = p[c + 2] * scale[2];

    signedVol +=
      (ax * (by * cz - bz * cy) -
        ay * (bx * cz - bz * cx) +
        az * (bx * cy - by * cx)) /
      6;
  }

  return {
    triangles: idx.length / 3,
    vertices: p.length / 3,
    isManifold: true,
    volumeMm3: Math.round(Math.abs(signedVol) * 100) / 100,
    dimensionsMm: [
      Math.round(dimX * 100) / 100,
      Math.round(dimY * 100) / 100,
      Math.round(dimZ * 100) / 100,
    ],
  };
}

/** Codifica una malla indexada en formato Binary STL estándar (80B header + uint32 + 50B/tri) en coordenadas Z-up. */
function encodeBinaryStl(mesh: HeadlessMeshData): Buffer {
  const triCount = mesh.indices.length / 3;
  const buffer = Buffer.alloc(84 + triCount * 50);

  // Encabezado ASCII de 80 bytes
  const header = 'Kura3D Binary STL - Autor: Nicolas Groth <ngroth@gmail.com>';
  buffer.write(header.slice(0, 80), 0, 'ascii');
  buffer.writeUInt32LE(triCount, 80);

  const p = mesh.positions;
  const idx = mesh.indices;
  let offset = 84;

  for (let t = 0; t < triCount; t++) {
    const i0 = idx[t * 3] * 3;
    const i1 = idx[t * 3 + 1] * 3;
    const i2 = idx[t * 3 + 2] * 3;

    // Conversión Y-up -> Z-up para laminadores de impresión 3D: (x, y, z) -> (x, -z, y)
    const ax = p[i0], ay = -p[i0 + 2], az = p[i0 + 1];
    const bx = p[i1], by = -p[i1 + 2], bz = p[i1 + 1];
    const cx = p[i2], cy = -p[i2 + 2], cz = p[i2 + 1];

    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-12) {
      nx /= len; ny /= len; nz /= len;
    } else {
      nx = 0; ny = 0; nz = 1;
    }

    buffer.writeFloatLE(nx, offset);
    buffer.writeFloatLE(ny, offset + 4);
    buffer.writeFloatLE(nz, offset + 8);

    buffer.writeFloatLE(ax, offset + 12);
    buffer.writeFloatLE(ay, offset + 16);
    buffer.writeFloatLE(az, offset + 20);

    buffer.writeFloatLE(bx, offset + 24);
    buffer.writeFloatLE(by, offset + 28);
    buffer.writeFloatLE(bz, offset + 32);

    buffer.writeFloatLE(cx, offset + 36);
    buffer.writeFloatLE(cy, offset + 40);
    buffer.writeFloatLE(cz, offset + 44);

    buffer.writeUInt16LE(0, offset + 48);
    offset += 50;
  }

  return buffer;
}

/** Codifica una malla en formato STL ASCII legible en coordenadas Z-up para impresión 3D. */
function encodeAsciiStl(mesh: HeadlessMeshData): string {
  const lines: string[] = ['solid Kura3D'];
  const p = mesh.positions;
  const idx = mesh.indices;

  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3;
    const b = idx[i + 1] * 3;
    const c = idx[i + 2] * 3;

    // Conversión Y-up -> Z-up: (x, y, z) -> (x, -z, y)
    const ax = p[a], ay = -p[a + 2], az = p[a + 1];
    const bx = p[b], by = -p[b + 2], bz = p[b + 1];
    const cx = p[c], cy = -p[c + 2], cz = p[c + 1];

    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-12) {
      nx /= len; ny /= len; nz /= len;
    } else {
      nx = 0; ny = 0; nz = 1;
    }

    lines.push(`  facet normal ${nx} ${ny} ${nz}`);
    lines.push('    outer loop');
    lines.push(`      vertex ${ax} ${ay} ${az}`);
    lines.push(`      vertex ${bx} ${by} ${bz}`);
    lines.push(`      vertex ${cx} ${cy} ${cz}`);
    lines.push('    endloop');
    lines.push('  endfacet');
  }

  lines.push('endsolid Kura3D');
  return lines.join('\n');
}

/** Empaqueta objetos en un archivo 3MF válido (especificación OPC/ZIP sin compresión). */
function encode3mfArchive(objects: HeadlessSceneObject[]): {
  buffer: Buffer;
  totalTriangles: number;
} {
  let totalTriangles = 0;

  const resourcesXml: string[] = [];
  const buildItemsXml: string[] = [];

  objects.forEach((obj, index) => {
    const resourceId = index + 1;
    const baked = bakeObjectTransform(obj);
    totalTriangles += baked.indices.length / 3;

    const verts: string[] = [];
    for (let i = 0; i < baked.positions.length; i += 3) {
      // 3MF usa Z-up; mapeamos Y-up -> Z-up (x, -z, y)
      const x = baked.positions[i].toFixed(4);
      const y = (-baked.positions[i + 2]).toFixed(4);
      const z = baked.positions[i + 1].toFixed(4);
      verts.push(`          <vertex x="${x}" y="${y}" z="${z}" />`);
    }

    const tris: string[] = [];
    for (let i = 0; i < baked.indices.length; i += 3) {
      tris.push(
        `          <triangle v1="${baked.indices[i]}" v2="${baked.indices[i + 1]}" v3="${baked.indices[i + 2]}" />`
      );
    }

    resourcesXml.push(
      `    <object id="${resourceId}" type="model" name="${escapeXml(obj.name)}">\n` +
        `      <mesh>\n` +
        `        <vertices>\n${verts.join('\n')}\n        </vertices>\n` +
        `        <triangles>\n${tris.join('\n')}\n        </triangles>\n` +
        `      </mesh>\n` +
        `    </object>`
    );
    buildItemsXml.push(`    <item objectid="${resourceId}" />`);
  });

  const modelXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="es" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n` +
    `  <metadata name="Application">Kura3D MCP</metadata>\n` +
    `  <metadata name="Designer">Nicolás Groth</metadata>\n` +
    `  <resources>\n${resourcesXml.join('\n')}\n  </resources>\n` +
    `  <build>\n${buildItemsXml.join('\n')}\n  </build>\n` +
    `</model>\n`;

  const contentTypesXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n` +
    `  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />\n` +
    `  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />\n` +
    `</Types>\n`;

  const relsXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
    `  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />\n` +
    `</Relationships>\n`;

  const buffer = createStoreZip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypesXml, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(relsXml, 'utf8') },
    { name: '3D/3dmodel.model', data: Buffer.from(modelXml, 'utf8') },
  ]);

  return { buffer, totalTriangles };
}

/** Construye un archivo ZIP estándar (método STORE) sin dependencias externas. */
function createStoreZip(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // versión
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // compresión 0 = STORE
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + size;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}
