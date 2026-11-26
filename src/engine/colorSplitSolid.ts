/**
 * @file src/engine/colorSplitSolid.ts
 * @description Separación por colores en SÓLIDOS CERRADOS. Cada región de color de la superficie se
 * convierte en volumen dándole una profundidad hacia el interior ("profundidad del color"): la unión
 * de prismas por triángulo (cara desplazada `depthMm` hacia adentro por la normal media de cada vértice, con un margen
 * hacia afuera que luego recorta el propio sólido). Las piezas salen de booleanas de Manifold sobre
 * el sólido original, en orden fijo, así que forman una partición exacta: no se solapan y la suma de
 * volúmenes es el volumen original. Un cuerpo conexo de un solo color se lleva el cuerpo entero.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { MeshData, SceneObject, Vec3 } from '../types/kura';
import { engineWarning, requireOperationRange, type EngineWarning } from './engineErrors';
import { cleanColorPartMesh } from './colorSplitCleanup';
import { closeColorPart, concatMeshes, directPiecesValid, manifoldOfMesh } from './colorSplitFinish';
import { isMeshClosed } from './repair/meshTopology';
import { thickenColorRegions } from './colorSplitThicken';
import { checkerboardVertices, pinchPlug } from './colorSplitPinch';
import { initManifoldEngine, meshDataToManifold, weldVertices } from './manifoldKernel';
import { OPERATION_DEFAULTS, OPERATION_RANGES } from './operationLimits';
import { extractPositionAndNormalize } from './operations';
import { applyTransformToMesh, computeMeshStats } from './primitives';

/** Opciones de la separación por colores. */
export interface ColorSplitOptions {
  /** Profundidad hacia el interior que toma cada color no base (mm). */
  depthMm?: number;
}

/** Pieza de un color: sólido cerrado en coordenadas normalizadas a cama más su posición mundial. */
export interface SolidColorPart {
  color: string;
  mesh: MeshData;
  position: Vec3;
  volumeMm3: number;
  /** Cerrada según la definición única del inspector (`computeMeshStats().isManifold`). */
  closed: boolean;
}

export interface SolidColorSplitResult {
  parts: SolidColorPart[];
  warnings: EngineWarning[];
}

/** Margen hacia afuera de cada prisma: asegura que la cara pintada quede dentro y lo recorta el sólido. */
const OUTWARD_MARGIN_MM = 0.05;
/**
 * Holgura (mm) con que cada prisma y cada placa se agrandan hacia los lados: dos prismas que solo se
 * TOCAN por una pared quedan, tras la unión de Manifold, como sólidos que se tocan (paredes internas
 * duplicadas y aristas compartidas por 4 triángulos al soldar el STL). Con esta holgura se solapan.
 */
const PRISM_OVERLAP_MM = 5e-4;
/** Volumen bajo el cual una pieza se considera vacía (mm³). */
const EMPTY_VOLUME_MM3 = 1e-3;
/** Tope del factor de desplazamiento en vértices agudos (evita capas desmedidas en puntas). */
const MAX_OFFSET_SCALE = 3;

interface Body {
  /** Triángulos (índices en la malla soldada) del cuerpo conexo. */
  tris: number[];
  /** Área por color dentro del cuerpo. */
  areaByColor: Map<string, number>;
}

/**
 * Separa `obj` por sus colores de cara en sólidos cerrados. Con un solo color devuelve una pieza
 * (el objeto entero). Lanza `INVALID_PARAMETER` si la profundidad sale de rango.
 */
export async function splitMeshByColorSolid(
  obj: SceneObject,
  options: ColorSplitOptions = {},
): Promise<SolidColorSplitResult> {
  const depth = requireOperationRange('depthMm', options.depthMm, OPERATION_RANGES.colorSplit.depthMm, OPERATION_DEFAULTS.colorSplit.depthMm);
  const world = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
  const base = obj.color.toLowerCase();
  const welded = weldVertices(world.positions, world.indices, 1e-5);
  const P = welded.positions;
  const I = welded.indices;
  const triCount = I.length / 3;
  if (triCount === 0) return { parts: [], warnings: [] };
  const colors: string[] = new Array(triCount);
  for (let t = 0; t < triCount; t++) {
    colors[t] = (world.faceColors?.[welded.triangleSource[t]] ?? base).toLowerCase();
  }
  const distinct = new Set(colors);
  const wasm = await initManifoldEngine();
  if (distinct.size <= 1) {
    const only = [...distinct][0] ?? base;
    const solid = meshDataToManifold(wasm, { positions: P, indices: I });
    try {
      const unclean: string[] = [];
      const repaired: string[] = [];
      const part = toPart(wasm, solid, only, unclean, repaired);
      return { parts: [part], warnings: uncleanWarnings(unclean, repaired) };
    } finally {
      solid.delete();
    }
  }

  const byColor = new Map<string, Manifold[]>();
  const push = (color: string, m: Manifold) => {
    if (m.isEmpty() || m.volume() < EMPTY_VOLUME_MM3) { m.delete(); return; }
    const list = byColor.get(color) ?? [];
    list.push(m);
    byColor.set(color, list);
  };
  // Piezas del camino directo (mallas ya cerradas, sin booleanas) por color.
  const direct = new Map<string, MeshData[]>();
  const addDirect = (color: string, mesh: MeshData) => direct.set(color, [...(direct.get(color) ?? []), mesh]);

  const offsets = vertexOffsets(P, I);
  for (const body of connectedBodies(P, I, colors)) {
    const bodyMesh = subMesh(P, I, body.tris);
    if (body.areaByColor.size === 1 && isMeshClosed(bodyMesh.positions, bodyMesh.indices, 0)) {
      addDirect([...body.areaByColor.keys()][0], bodyMesh);
      continue;
    }
    const solid = meshDataToManifold(wasm, bodyMesh);
    if (body.areaByColor.size === 1) {
      push([...body.areaByColor.keys()][0], solid);
      continue;
    }
    // Color base del cuerpo: el de mayor área (empate: el color del objeto). Los demás, de menor a
    // mayor área, toman su capa; así un detalle chico no queda tapado por uno grande en un solape.
    const ranked = [...body.areaByColor.entries()].sort((a, b) => b[1] - a[1] || Number(b[0] === base) - Number(a[0] === base) || a[0].localeCompare(b[0]));
    const bodyBase = ranked[0][0];
    // Camino directo: engrosado construido a mano, lineal y cerrado por construcción.
    const thick = thickenColorRegions(P, I, body.tris, colors, bodyBase, offsets, depth);
    if (thick && directPiecesValid(wasm, solid, thick, bodyBase, EMPTY_VOLUME_MM3)) {
      solid.delete();
      for (const [color, mesh] of thick) addDirect(color, mesh);
      continue;
    }
    const layered = ranked.slice(1).reverse().map(([c]) => c);
    let remaining = solid;
    for (const color of layered) {
      const shell = regionShell(wasm, P, I, offsets, body.tris, body.tris.filter((t) => colors[t] === color), depth);
      const piece = remaining.intersect(shell);
      const rest = remaining.subtract(shell);
      shell.delete();
      remaining.delete();
      remaining = rest;
      push(color, piece);
    }
    push(bodyBase, remaining);
  }

  const parts: SolidColorPart[] = [];
  const unclean: string[] = [];
  const repaired: string[] = [];
  for (const color of [...distinct].sort((a, b) => Number(b === base) - Number(a === base) || a.localeCompare(b))) {
    const meshes = direct.get(color) ?? [];
    if (meshes.length > 0 && !byColor.has(color)) {
      // Cuerpos conexos distintos (letras de un texto): sus mallas cerradas se juntan sin booleanas.
      parts.push(finishPart(wasm, concatMeshes(meshes), color, unclean, repaired));
      continue;
    }
    // Si el mismo color además salió del camino con booleanas, se une todo con Manifold.
    for (const mesh of meshes) {
      const m = manifoldOfMesh(wasm, mesh);
      if (m) push(color, m);
    }
    const list = byColor.get(color);
    if (!list) continue;
    const merged = dropEmptyComponents(wasm, list.length === 1 ? list[0] : wasm.Manifold.union(list));
    if (list.length > 1) for (const m of list) m.delete();
    if (merged.isEmpty()) { merged.delete(); byColor.delete(color); continue; }
    parts.push(toPart(wasm, merged, color, unclean, repaired));
    merged.delete();
  }
  const lost = [...distinct].filter((c) => !byColor.has(c) && !direct.has(c));
  const warnings = lost.length > 0 ? [engineWarning('SPLIT_COLOR_ABSORBED', { colors: lost.join(', '), count: lost.length })] : [];
  return { parts, warnings: [...warnings, ...uncleanWarnings(unclean, repaired)] };
}

/**
 * Avisos tipados coherentes con el estado real: piezas que no cierran según la definición del
 * inspector (con sus colores, para ofrecer Reparar) y piezas que cerraron tras la reparación.
 */
function uncleanWarnings(colors: string[], repaired: string[] = []): EngineWarning[] {
  const out: EngineWarning[] = [];
  if (colors.length) out.push(engineWarning('SPLIT_COLOR_MESH_DEFECTS', { colors: colors.join(', '), count: colors.length }));
  if (repaired.length) out.push(engineWarning('SPLIT_COLOR_PART_REPAIRED', { colors: repaired.join(', '), count: repaired.length }));
  return out;
}

function toPart(wasm: ManifoldToplevel, m: Manifold, color: string, unclean: string[], repaired: string[]): SolidColorPart {
  return finishPart(wasm, cleanColorPartMesh(wasm, m).mesh, color, unclean, repaired);
}

/** Veredicto con la definición del inspector (con reparación si hace falta), normalizado a la cama. */
function finishPart(wasm: ManifoldToplevel, raw: MeshData, color: string, unclean: string[], repaired: string[]): SolidColorPart {
  const closed = closeColorPart(wasm, raw);
  const normalized = extractPositionAndNormalize({ ...closed.mesh, faceColors: new Array(closed.mesh.indices.length / 3).fill(color) });
  // El veredicto es el del inspector sobre la malla que se entrega (ya normalizada a la cama).
  const stats = computeMeshStats(normalized.mesh);
  if (!stats.isManifold) unclean.push(color);
  else if (closed.repaired) repaired.push(color);
  // Volumen de la malla entregada, no del sólido previo: así calza con lo que se exporta.
  return { color, mesh: normalized.mesh, position: normalized.position, volumeMm3: stats.volumeMm3, closed: stats.isManifold };
}

/** Quita de una pieza los componentes de volumen nulo (aletas degeneradas que dejan las booleanas). */
function dropEmptyComponents(wasm: ManifoldToplevel, m: Manifold): Manifold {
  if (m.genus() >= 0) return m;
  const comps = m.decompose();
  const kept = comps.filter((c) => c.volume() >= EMPTY_VOLUME_MM3);
  if (kept.length === comps.length) { for (const c of comps) c.delete(); return m; }
  const out = kept.length === 0 ? wasm.Manifold.compose([]) : wasm.Manifold.compose(kept);
  for (const c of comps) c.delete();
  m.delete();
  return out;
}

/**
 * Desplazamiento unitario por vértice: normal media ponderada por ángulo, escalada para que la capa
 * mida `depth` respecto de cada cara vecina (en una arista de 90° sale (1,1)·d, en una esquina (1,1,1)·d).
 * Al ser compartido por los triángulos vecinos, los prismas contiguos comparten pared y no dejan grietas.
 */
function vertexOffsets(P: Float32Array, I: Uint32Array): Float64Array {
  const nv = P.length / 3;
  const sum = new Float64Array(nv * 3);
  const faceN = new Float64Array(I.length);
  for (let t = 0; t < I.length / 3; t++) {
    const n = faceNormal(P, I, t);
    if (!n) continue;
    faceN.set(n, t * 3);
    for (let c = 0; c < 3; c++) {
      const v = I[t * 3 + c];
      const w = cornerAngle(P, v, I[t * 3 + ((c + 1) % 3)], I[t * 3 + ((c + 2) % 3)]);
      for (let a = 0; a < 3; a++) sum[v * 3 + a] += n[a] * w;
    }
  }
  const minDot = new Float64Array(nv).fill(1);
  const len = new Float64Array(nv);
  for (let v = 0; v < nv; v++) len[v] = Math.hypot(sum[v * 3], sum[v * 3 + 1], sum[v * 3 + 2]) || 1;
  for (let t = 0; t < I.length / 3; t++) {
    for (let c = 0; c < 3; c++) {
      const v = I[t * 3 + c];
      const d = (sum[v * 3] * faceN[t * 3] + sum[v * 3 + 1] * faceN[t * 3 + 1] + sum[v * 3 + 2] * faceN[t * 3 + 2]) / len[v];
      if (d < minDot[v]) minDot[v] = d;
    }
  }
  const out = new Float64Array(nv * 3);
  for (let v = 0; v < nv; v++) {
    const scale = 1 / Math.max(minDot[v], 1 / MAX_OFFSET_SCALE);
    for (let a = 0; a < 3; a++) out[v * 3 + a] = (sum[v * 3 + a] / len[v]) * scale;
  }
  return out;
}

/**
 * Une el volumen de una región: los triángulos interiores de una cara plana (sus tres vértices se
 * desplazan por la normal de la cara) se agrupan por plano y salen como una sola extrusión 2D; el
 * resto, como prismas por triángulo. Va de +margen a −`depth`. En los vértices donde la región entra y
 * sale más de una vez se agrega una columna delgada (ver `colorSplitPinch.ts`).
 */
function regionShell(wasm: ManifoldToplevel, P: Float32Array, I: Uint32Array, offsets: Float64Array, bodyTris: number[], tris: number[], depth: number): Manifold {
  const pieces: Manifold[] = [];
  const planes = new Map<string, { n: number[]; origin: number[]; tris: number[] }>();
  for (const t of tris) {
    const n = faceNormal(P, I, t);
    if (!n) continue;
    if (offsetsMatchNormal(I, offsets, t, n)) {
      const o = [P[I[t * 3] * 3], P[I[t * 3] * 3 + 1], P[I[t * 3] * 3 + 2]];
      const d = o[0] * n[0] + o[1] * n[1] + o[2] * n[2];
      const key = `${n.map((x) => Math.round(x * 1e6)).join(',')}|${Math.round(d * 1e4)}`;
      const plane = planes.get(key) ?? { n, origin: o, tris: [] };
      plane.tris.push(t);
      planes.set(key, plane);
      continue;
    }
    const prism = trianglePrism(wasm, P, I, offsets, t, depth);
    if (prism) pieces.push(prism);
  }
  for (const plane of planes.values()) {
    const slab = planarSlab(wasm, P, I, plane, depth);
    if (slab) pieces.push(slab);
  }
  // Vértices en tablero: una columna a lo largo de la arista desplazada evita el pellizco.
  const pinched = checkerboardVertices(I, bodyTris, tris);
  for (const v of pinched) {
    const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
    const o = [offsets[v * 3], offsets[v * 3 + 1], offsets[v * 3 + 2]];
    const plug = pinchPlug(wasm, p.map((x, a) => x + o[a] * OUTWARD_MARGIN_MM), p.map((x, a) => x - o[a] * depth));
    if (plug) pieces.push(plug);
  }
  if (pieces.length === 0) return wasm.Manifold.compose([]);
  const shell = pieces.length === 1 ? pieces[0] : wasm.Manifold.union(pieces);
  if (pieces.length > 1) for (const p of pieces) p.delete();
  return shell;
}

function offsetsMatchNormal(I: Uint32Array, offsets: Float64Array, t: number, n: number[]): boolean {
  for (let c = 0; c < 3; c++) {
    const v = I[t * 3 + c];
    if (Math.abs(offsets[v * 3] - n[0]) + Math.abs(offsets[v * 3 + 1] - n[1]) + Math.abs(offsets[v * 3 + 2] - n[2]) > 1e-6) return false;
  }
  return true;
}

/** Extruye la unión 2D de triángulos coplanares entre +margen y −`depth` por la normal del plano. */
function planarSlab(wasm: ManifoldToplevel, P: Float32Array, I: Uint32Array, plane: { n: number[]; origin: number[]; tris: number[] }, depth: number): Manifold | null {
  const { n, origin } = plane;
  const helper = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = normalOf([0, 0, 0], n, helper) ?? [1, 0, 0];
  const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  // (u, v, n) forma una base directa: u × v = n.
  const uu = [v[1] * n[2] - v[2] * n[1], v[2] * n[0] - v[0] * n[2], v[0] * n[1] - v[1] * n[0]];
  const to2d = (id: number): [number, number] => {
    const d = [P[id * 3] - origin[0], P[id * 3 + 1] - origin[1], P[id * 3 + 2] - origin[2]];
    return [d[0] * uu[0] + d[1] * uu[1] + d[2] * uu[2], d[0] * v[0] + d[1] * v[1] + d[2] * v[2]];
  };
  const polys = plane.tris.map((t) => [to2d(I[t * 3]), to2d(I[t * 3 + 1]), to2d(I[t * 3 + 2])]);
  const section = new wasm.CrossSection(polys, 'Positive');
  if (section.isEmpty()) { section.delete(); return null; }
  const grown = section.offset(PRISM_OVERLAP_MM, 'Miter');
  section.delete();
  const slab = grown.extrude(depth + OUTWARD_MARGIN_MM);
  grown.delete();
  const T = origin.map((x, a) => x - n[a] * depth);
  const placed = slab.transform([uu[0], uu[1], uu[2], 0, v[0], v[1], v[2], 0, n[0], n[1], n[2], 0, T[0], T[1], T[2], 1]);
  slab.delete();
  return placed;
}

/**
 * Prisma cerrado de un triángulo con desplazamiento por vértice. Si el desplazamiento lo tuerce (la
 * cara interior se da vuelta), usa la normal de la cara. Null si el triángulo es degenerado.
 */
function trianglePrism(wasm: ManifoldToplevel, P: Float32Array, I: Uint32Array, offsets: Float64Array, t: number, depth: number): Manifold | null {
  const n = faceNormal(P, I, t);
  if (!n) return null;
  const ids = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]];
  const v = ids.map((id) => [P[id * 3], P[id * 3 + 1], P[id * 3 + 2]]);
  const build = (dir: (k: number) => number[]) => {
    const out = v.map((p, k) => p.map((x, a) => x + dir(k)[a] * OUTWARD_MARGIN_MM));
    const inn = v.map((p, k) => p.map((x, a) => x - dir(k)[a] * depth));
    return { out, inn };
  };
  let { out, inn } = build((k) => [offsets[ids[k] * 3], offsets[ids[k] * 3 + 1], offsets[ids[k] * 3 + 2]]);
  const innN = normalOf(inn[0], inn[1], inn[2]);
  if (!innN || innN[0] * n[0] + innN[1] * n[1] + innN[2] * n[2] < 0.2) ({ out, inn } = build(() => n));
  const all = [...out, ...inn];
  const centroid = [0, 1, 2].map((a) => all.reduce((acc, p) => acc + p[a], 0) / all.length);
  const vert = new Float32Array(all.flatMap((p) => {
    const d = p.map((x, a) => x - centroid[a]);
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    return p.map((x, a) => x + (d[a] / l) * PRISM_OVERLAP_MM);
  }));
  // 0-2 cara exterior (misma orientación), 3-5 interior (invertida), tres caras laterales.
  const tri = new Uint32Array([0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0]);
  const m = new wasm.Manifold(new wasm.Mesh({ numProp: 3, vertProperties: vert, triVerts: tri }));
  if (m.status() !== 'NoError' || m.isEmpty() || m.volume() <= 0) { m.delete(); return null; }
  return m;
}

function normalOf(a: number[], b: number[], c: number[]): number[] | null {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const len = Math.hypot(n[0], n[1], n[2]);
  return len < 1e-12 ? null : n.map((x) => x / len);
}

function faceNormal(P: Float32Array, I: Uint32Array, t: number): number[] | null {
  const p = (k: number) => [P[I[t * 3 + k] * 3], P[I[t * 3 + k] * 3 + 1], P[I[t * 3 + k] * 3 + 2]];
  return normalOf(p(0), p(1), p(2));
}

function cornerAngle(P: Float32Array, v: number, a: number, b: number): number {
  const u = [P[a * 3] - P[v * 3], P[a * 3 + 1] - P[v * 3 + 1], P[a * 3 + 2] - P[v * 3 + 2]];
  const w = [P[b * 3] - P[v * 3], P[b * 3 + 1] - P[v * 3 + 1], P[b * 3 + 2] - P[v * 3 + 2]];
  const lu = Math.hypot(u[0], u[1], u[2]), lw = Math.hypot(w[0], w[1], w[2]);
  if (lu === 0 || lw === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (lu * lw))));
}

/** Cuerpos conexos por vértices compartidos (malla ya soldada), con el área de cada color. */
function connectedBodies(P: Float32Array, I: Uint32Array, colors: string[]): Body[] {
  const parent = new Int32Array(P.length / 3).map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  const triCount = I.length / 3;
  for (let t = 0; t < triCount; t++) {
    const a = find(I[t * 3]);
    parent[find(I[t * 3 + 1])] = a;
    parent[find(I[t * 3 + 2])] = a;
  }
  const bodies = new Map<number, Body>();
  for (let t = 0; t < triCount; t++) {
    const root = find(I[t * 3]);
    let body = bodies.get(root);
    if (!body) { body = { tris: [], areaByColor: new Map() }; bodies.set(root, body); }
    body.tris.push(t);
    body.areaByColor.set(colors[t], (body.areaByColor.get(colors[t]) ?? 0) + triangleArea(P, I, t));
  }
  return [...bodies.values()];
}

function triangleArea(P: Float32Array, I: Uint32Array, t: number): number {
  const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
  const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
  const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
  return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}

function subMesh(P: Float32Array, I: Uint32Array, tris: number[]): MeshData {
  const remap = new Map<number, number>();
  const pos: number[] = [];
  const idx = new Uint32Array(tris.length * 3);
  tris.forEach((t, k) => {
    for (let c = 0; c < 3; c++) {
      const old = I[t * 3 + c];
      let n = remap.get(old);
      if (n === undefined) { n = pos.length / 3; remap.set(old, n); pos.push(P[old * 3], P[old * 3 + 1], P[old * 3 + 2]); }
      idx[k * 3 + c] = n;
    }
  });
  return { positions: new Float32Array(pos), indices: idx };
}
