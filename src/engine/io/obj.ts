/**
 * @file src/engine/io/obj.ts
 * @description Lectura y escritura Wavefront OBJ + MTL. El lector separa objetos `o`, triangula
 * polígonos en abanico, valida índices (incluidos los negativos relativos), recupera colores de
 * `usemtl` + MTL `Kd` o colores por vértice, y suelda vértices. El escritor exporta la escena con
 * transformaciones mundiales y un material por color.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, SceneObject } from '../../types/kura';
import { weldVertices } from '../manifoldKernel';
import { applyTransformToMesh } from '../primitives';
import { ModelImportError, checkInputSize, resolveLimits, type ModelImportLimits } from './importErrors';
import type { ImportedModel, ImportedPart } from './importTypes';
import { GrowableFloat32, GrowableUint32, finishMesh, hexToRgb01, normalizeHexColor, rgbToHex } from './meshBuffers';
import { exportableObjects } from './stl';

/** Lee un MTL y devuelve el color `Kd` de cada material como '#rrggbb'. */
export function parseMtlColors(text: string): Map<string, string> {
  const colors = new Map<string, string>();
  let current: string | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('newmtl ')) {
      current = line.slice(7).trim();
    } else if (current && line.startsWith('Kd ')) {
      const [r, g, b] = line.slice(3).trim().split(/\s+/).map(Number);
      if ([r, g, b].every(Number.isFinite)) colors.set(current, rgbToHex(r, g, b));
    }
  }
  return colors;
}

/** Nombres de archivo MTL declarados con `mtllib` en un OBJ. */
export function objMaterialLibraries(text: string): string[] {
  const libs: string[] = [];
  const re = /^\s*mtllib\s+(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) libs.push(m[1].trim());
  return libs;
}

interface RawObjPart {
  name: string;
  faces: GrowableUint32;
  faceColors: (string | undefined)[];
}

/**
 * Lee texto OBJ en piezas (una por `o`), en coordenadas de escena (mm, Y-up) sin recentrar.
 */
export function readOBJ(
  text: string,
  fileName = 'model.obj',
  options: { mtlText?: string; limits?: Partial<ModelImportLimits> } = {},
): ImportedModel {
  const limits = resolveLimits(options.limits);
  checkInputSize(text.length, limits);
  const materials = options.mtlText ? parseMtlColors(options.mtlText) : new Map<string, string>();
  const baseName = fileName.replace(/\.obj$/i, '');

  const vertices = new GrowableFloat32(4096);
  const vertexColors: (string | undefined)[] = [];
  const parts: RawObjPart[] = [];
  let current: RawObjPart | null = null;
  let currentColor: string | undefined;
  let triangles = 0;

  const ensurePart = (name?: string) => {
    if (!current || (name !== undefined && current.faces.length > 0)) {
      current = { name: name ?? baseName, faces: new GrowableUint32(1024), faceColors: [] };
      parts.push(current);
    } else if (name !== undefined) {
      current.name = name;
    }
    return current;
  };

  const lines = text.split(/\r?\n/);
  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln].trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('v ')) {
      const parts3 = line.slice(2).trim().split(/\s+/);
      const x = Number(parts3[0]);
      const y = Number(parts3[1]);
      const z = Number(parts3[2]);
      if (parts3.length < 3 || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        throw new ModelImportError('non-finite', `línea ${ln + 1}`);
      }
      vertices.push3(x, y, z);
      if (parts3.length >= 6) {
        const [r, g, b] = parts3.slice(3, 6).map(Number);
        vertexColors.push([r, g, b].every(Number.isFinite) ? rgbToHex(r, g, b) : undefined);
      } else {
        vertexColors.push(undefined);
      }
    } else if (line.startsWith('o ')) {
      ensurePart(line.slice(2).trim() || baseName);
    } else if (line.startsWith('usemtl ')) {
      currentColor = materials.get(line.slice(7).trim());
    } else if (line.startsWith('f ')) {
      const part = ensurePart();
      const tokens = line.slice(2).trim().split(/\s+/);
      const total = vertices.length / 3;
      const face: number[] = [];
      for (const token of tokens) {
        const parsed = parseInt(token.split('/')[0], 10);
        const idx = parsed > 0 ? parsed - 1 : total + parsed;
        if (!Number.isFinite(parsed) || parsed === 0 || idx < 0 || idx >= total) {
          throw new ModelImportError('invalid-index', `línea ${ln + 1}`);
        }
        face.push(idx);
      }
      for (let k = 1; k + 1 < face.length; k++) {
        part.faces.push3(face[0], face[k], face[k + 1]);
        part.faceColors.push(currentColor ?? vertexColors[face[0]]);
        triangles++;
      }
      if (triangles > limits.maxTriangles) throw new ModelImportError('too-many-triangles');
    }
  }

  const allPositions = vertices.toArray();
  const result: ImportedPart[] = [];
  for (const part of parts) {
    if (part.faces.length === 0) continue;
    const faces = part.faces.toArray();
    // Compacta los vértices usados por esta pieza.
    const remap = new Map<number, number>();
    const local = new GrowableFloat32(faces.length);
    const localFaces = new Uint32Array(faces.length);
    for (let i = 0; i < faces.length; i++) {
      let mapped = remap.get(faces[i]);
      if (mapped === undefined) {
        mapped = remap.size;
        remap.set(faces[i], mapped);
        const v = faces[i] * 3;
        local.push3(allPositions[v], allPositions[v + 1], allPositions[v + 2]);
      }
      localFaces[i] = mapped;
    }
    const welded = weldVertices(local.toArray(), localFaces, 1e-5);
    if (welded.indices.length === 0) continue;
    const hasColors = part.faceColors.some(Boolean);
    const colorList = hasColors
      ? Array.from(welded.triangleSource, (src) => part.faceColors[src] ?? '#38bdf8')
      : undefined;
    const counts = new Map<string, number>();
    colorList?.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const finished = finishMesh(welded.positions, welded.indices, colorList, dominant);
    result.push({
      name: part.name,
      color: dominant,
      mesh: finished.mesh,
      group: 0,
      openEdges: finished.openEdges,
    });
  }
  if (result.length === 0) throw new ModelImportError('no-geometry');
  return { fileName, format: 'obj', hasPlacement: false, parts: result };
}

/** Decodifica un buffer OBJ (UTF-8) y lo lee. */
export function readOBJBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  options: { mtlText?: string; limits?: Partial<ModelImportLimits> } = {},
): ImportedModel {
  checkInputSize(buffer.byteLength, resolveLimits(options.limits));
  return readOBJ(new TextDecoder('utf-8').decode(buffer), fileName, options);
}

// ============================================================================
// Exportación OBJ + MTL
// ============================================================================

const fmt = (n: number) => (Math.abs(n) < 5e-6 ? '0' : n.toFixed(5).replace(/\.?0+$/, ''));
const safeName = (name: string) => name.replace(/\s+/g, '_') || 'Kura3D_Model';

/**
 * Exporta una malla `MeshData` (en milímetros, Y-up) a texto Wavefront OBJ válido.
 */
export function exportMeshToOBJ(mesh: MeshData, name = 'Kura3D_Model'): string {
  const lines: string[] = ['# Kura3D Wavefront OBJ Export (Units: mm, Y-up)', `o ${safeName(name)}`];
  const vertCount = Math.floor(mesh.positions.length / 3);
  for (let v = 0; v < vertCount; v++) {
    lines.push(`v ${fmt(mesh.positions[v * 3])} ${fmt(mesh.positions[v * 3 + 1])} ${fmt(mesh.positions[v * 3 + 2])}`);
  }
  const hasNormals = mesh.normals && mesh.normals.length === mesh.positions.length;
  if (hasNormals && mesh.normals) {
    for (let v = 0; v < vertCount; v++) {
      lines.push(`vn ${fmt(mesh.normals[v * 3])} ${fmt(mesh.normals[v * 3 + 1])} ${fmt(mesh.normals[v * 3 + 2])}`);
    }
  }
  const triCount = Math.floor(mesh.indices.length / 3);
  for (let t = 0; t < triCount; t++) {
    const a = mesh.indices[t * 3] + 1;
    const b = mesh.indices[t * 3 + 1] + 1;
    const c = mesh.indices[t * 3 + 2] + 1;
    lines.push(hasNormals ? `f ${a}//${a} ${b}//${b} ${c}//${c}` : `f ${a} ${b} ${c}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Exporta los objetos visibles y sólidos con transformaciones mundiales a OBJ + MTL.
 * Cada color (base o por cara) es un material `kura_rrggbb` del MTL.
 *
 * @param baseName Nombre base sin extensión; el OBJ referencia `<baseName>.mtl`.
 */
export function exportSceneToOBJ(objects: SceneObject[], baseName: string): { obj: string; mtl: string } {
  const mtlName = `${baseName}.mtl`;
  const lines: string[] = ['# Kura3D Wavefront OBJ Export (Units: mm, Y-up)', `mtllib ${mtlName}`];
  const palette = new Set<string>();
  let vertexBase = 1;

  for (const obj of exportableObjects(objects)) {
    const world = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
    const baseColor = normalizeHexColor(obj.color);
    lines.push(`o ${safeName(obj.name)}`);
    const vertCount = Math.floor(world.positions.length / 3);
    for (let v = 0; v < vertCount; v++) {
      lines.push(`v ${fmt(world.positions[v * 3])} ${fmt(world.positions[v * 3 + 1])} ${fmt(world.positions[v * 3 + 2])}`);
    }
    // Agrupa los triángulos por color para emitir un `usemtl` por grupo.
    const byColor = new Map<string, number[]>();
    const triCount = Math.floor(world.indices.length / 3);
    for (let t = 0; t < triCount; t++) {
      const color = normalizeHexColor(world.faceColors?.[t], baseColor);
      let list = byColor.get(color);
      if (!list) byColor.set(color, (list = []));
      list.push(t);
    }
    for (const [color, tris] of byColor) {
      palette.add(color);
      lines.push(`usemtl kura_${color.slice(1)}`);
      for (const t of tris) {
        const a = world.indices[t * 3] + vertexBase;
        const b = world.indices[t * 3 + 1] + vertexBase;
        const c = world.indices[t * 3 + 2] + vertexBase;
        lines.push(`f ${a} ${b} ${c}`);
      }
    }
    vertexBase += vertCount;
  }

  const mtl: string[] = ['# Kura3D MTL Export'];
  for (const color of palette) {
    const [r, g, b] = hexToRgb01(color);
    mtl.push(`newmtl kura_${color.slice(1)}`, `Kd ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`, 'Ka 0 0 0', 'Ks 0 0 0', 'd 1', 'illum 1', '');
  }
  return { obj: lines.join('\n') + '\n', mtl: mtl.join('\n') };
}
