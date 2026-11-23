/**
 * @file src/engine/alignment.ts
 * @description Algoritmos deterministas de alineación inteligente por envolvente mundial
 * (min/centro/max en X, Y, Z) y distribución automática en grilla sobre la cama de
 * impresión (`arrange_grid`) con espaciado de 8 mm libre de solapamientos; los huecos viajan con
 * el sólido que perforan y se avisa cuando la distribución no cabe en la cama.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { AlignMode, PrinterProfile, SceneObject, Vec3 } from '../types/kura';
import { applyTransformToMesh } from './primitives';
import { isNegative } from '../core/scene/objectRole';

/** Límites AABB en espacio mundial de un objeto de escena. */
interface WorldBoundsEntry {
  obj: SceneObject;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  cx: number;
  cy: number;
  cz: number;
  width: number;
  depth: number;
}

/**
 * Calcula los límites AABB en coordenadas mundiales reales aplicando posición, rotación
 * y escala sobre los vértices locales del objeto.
 */
function computeObjectWorldBounds(obj: SceneObject): WorldBoundsEntry {
  const worldMesh = applyTransformToMesh(
    obj.mesh,
    obj.position,
    obj.rotation,
    obj.scale
  );
  const vertCount = Math.floor(worldMesh.positions.length / 3);
  if (vertCount === 0) {
    return {
      obj,
      minX: obj.position[0],
      minY: obj.position[1],
      minZ: obj.position[2],
      maxX: obj.position[0],
      maxY: obj.position[1],
      maxZ: obj.position[2],
      cx: obj.position[0],
      cy: obj.position[1],
      cz: obj.position[2],
      width: 0,
      depth: 0,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < vertCount; i++) {
    const x = worldMesh.positions[i * 3];
    const y = worldMesh.positions[i * 3 + 1];
    const z = worldMesh.positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  return {
    obj,
    minX,
    minY,
    minZ,
    maxX,
    maxY,
    maxZ,
    cx: (minX + maxX) * 0.5,
    cy: (minY + maxY) * 0.5,
    cz: (minZ + maxZ) * 0.5,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}

/**
 * Calcula las nuevas posiciones mundiales (`Record<objectId, Vec3>`) para todos los
 * objetos recibidos según el modo de alineación `mode`:
 * - `minX` / `centerX` / `maxX`: alinea respecto a la envolvente global en X.
 * - `minY` / `centerY` / `maxY`: alinea respecto a la envolvente global en Y.
 * - `minZ` / `centerZ` / `maxZ`: alinea respecto a la envolvente global en Z.
 * - `arrange_grid`: distribuye todas las piezas en filas ordenadas sobre la cama
 *   de la impresora con separación de 8 mm sin solapamientos y apoyadas en Y=0.
 *
 * @param objects Lista de objetos seleccionados o de escena.
 * @param mode Modo de alineación o distribución.
 * @param bed Perfil opcional de impresora para acotar el ancho de fila en `arrange_grid`.
 * @returns Diccionario `id -> [x, y, z]` con las nuevas posiciones mundiales.
 */
export function computeAlignmentPositions(
  objects: SceneObject[],
  mode: AlignMode,
  bed?: PrinterProfile
): Record<string, Vec3> {
  const result: Record<string, Vec3> = {};
  if (objects.length === 0) {
    return result;
  }

  if (mode === 'arrange_grid') {
    return computeArrangeLayout(objects, bed).positions;
  }

  const entries = objects.map(computeObjectWorldBounds);

  // Alineación por eje respecto a la envolvente global del grupo
  let gMinX = Infinity;
  let gMinY = Infinity;
  let gMinZ = Infinity;
  let gMaxX = -Infinity;
  let gMaxY = -Infinity;
  let gMaxZ = -Infinity;

  for (const e of entries) {
    if (e.minX < gMinX) gMinX = e.minX;
    if (e.minY < gMinY) gMinY = e.minY;
    if (e.minZ < gMinZ) gMinZ = e.minZ;
    if (e.maxX > gMaxX) gMaxX = e.maxX;
    if (e.maxY > gMaxY) gMaxY = e.maxY;
    if (e.maxZ > gMaxZ) gMaxZ = e.maxZ;
  }

  const gCenterX = (gMinX + gMaxX) * 0.5;
  const gCenterY = (gMinY + gMaxY) * 0.5;
  const gCenterZ = (gMinZ + gMaxZ) * 0.5;

  for (const e of entries) {
    let dx = 0;
    let dy = 0;
    let dz = 0;

    switch (mode) {
      case 'minX':
        dx = gMinX - e.minX;
        break;
      case 'centerX':
        dx = gCenterX - e.cx;
        break;
      case 'maxX':
        dx = gMaxX - e.maxX;
        break;
      case 'minY':
        dy = gMinY - e.minY;
        break;
      case 'centerY':
        dy = gCenterY - e.cy;
        break;
      case 'maxY':
        dy = gMaxY - e.maxY;
        break;
      case 'minZ':
        dz = gMinZ - e.minZ;
        break;
      case 'centerZ':
        dz = gCenterZ - e.cz;
        break;
      case 'maxZ':
        dz = gMaxZ - e.maxZ;
        break;
    }

    result[e.obj.id] = [
      e.obj.position[0] + dx,
      e.obj.position[1] + dy,
      e.obj.position[2] + dz,
    ];
  }

  return result;
}

/** Resultado de distribuir piezas en grilla sobre la cama. */
export interface ArrangeLayout {
  /** Nuevas posiciones mundiales por ID (incluye huecos acompañantes). */
  positions: Record<string, Vec3>;
  /** Huella total ocupada [ancho X, fondo Z] en mm. */
  footprintMm: [number, number];
  /** false si la huella o la pieza más alta exceden la cama/altura de la impresora. */
  fitsBed: boolean;
}

/** Pieza a colocar: un sólido (o hueco suelto) y los huecos que lo perforan. */
interface ArrangeGroup {
  anchor: WorldBoundsEntry;
  members: WorldBoundsEntry[];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function overlapVolume(a: WorldBoundsEntry, b: WorldBoundsEntry): number {
  const dx = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const dy = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  const dz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
  return dx < 0 || dy < 0 || dz < 0 ? -1 : dx * dy * dz;
}

/** Sólido con mayor solape de envolvente con el hueco, o null si no toca ninguno. */
function hostFor(hole: WorldBoundsEntry, solids: WorldBoundsEntry[]): WorldBoundsEntry | null {
  let best: WorldBoundsEntry | null = null;
  let bestVolume = -1;
  for (const solid of solids) {
    const volume = overlapVolume(hole, solid);
    if (volume > bestVolume) {
      best = solid;
      bestVolume = volume;
    }
  }
  return bestVolume >= 0 ? best : null;
}

function makeGroup(anchor: WorldBoundsEntry): ArrangeGroup {
  return {
    anchor,
    members: [anchor],
    minX: anchor.minX,
    maxX: anchor.maxX,
    minZ: anchor.minZ,
    maxZ: anchor.maxZ,
  };
}

function addMember(group: ArrangeGroup, entry: WorldBoundsEntry): void {
  group.members.push(entry);
  group.minX = Math.min(group.minX, entry.minX);
  group.maxX = Math.max(group.maxX, entry.maxX);
  group.minZ = Math.min(group.minZ, entry.minZ);
  group.maxZ = Math.max(group.maxZ, entry.maxZ);
}

/**
 * Distribuye piezas en filas sobre la cama con 8 mm de separación y sin solapes. Los modificadores
 * negativos que tocan un sólido se mueven junto a él (mismo desplazamiento) en vez de colocarse por
 * separado; `companions` son huecos fuera de la selección que solo se mueven si perforan una pieza
 * distribuida. Informa si la huella resultante no cabe en la cama.
 */
export function computeArrangeLayout(
  objects: SceneObject[],
  bed?: PrinterProfile,
  companions: SceneObject[] = []
): ArrangeLayout {
  const positions: Record<string, Vec3> = {};
  if (objects.length === 0) return { positions, footprintMm: [0, 0], fitsBed: true };

  const spacing = 8;
  const entries = objects.map(computeObjectWorldBounds);
  const solids = entries.filter((e) => !isNegative(e.obj));
  const groups = new Map<string, ArrangeGroup>(solids.map((s) => [s.obj.id, makeGroup(s)]));
  for (const hole of entries.filter((e) => isNegative(e.obj))) {
    const host = hostFor(hole, solids);
    if (host) addMember(groups.get(host.obj.id)!, hole);
    else groups.set(hole.obj.id, makeGroup(hole));
  }
  for (const hole of companions.filter(isNegative).map(computeObjectWorldBounds)) {
    const host = hostFor(hole, solids);
    if (host) addMember(groups.get(host.obj.id)!, hole);
  }

  const items = [...groups.values()];
  const width = (g: ArrangeGroup) => g.maxX - g.minX;
  const depth = (g: ArrangeGroup) => g.maxZ - g.minZ;
  const bedWidth = bed?.bedWidthMm ?? 256;
  const maxObjW = items.reduce((acc, g) => Math.max(acc, width(g)), 0);
  const maxRowWidth = Math.max(bedWidth - spacing * 2, maxObjW);

  // Orden determinista por profundidad descendente para empaquetado por estantes compacto
  const sorted = items.sort((a, b) => {
    if (Math.abs(depth(b) - depth(a)) > 0.5) return depth(b) - depth(a);
    return a.anchor.obj.id.localeCompare(b.anchor.obj.id);
  });

  const placed: Array<{ group: ArrangeGroup; x: number; z: number }> = [];
  let cursorX = 0;
  let cursorZ = 0;
  let rowMaxDepth = 0;
  let totalMaxX = 0;
  for (const group of sorted) {
    if (cursorX > 0 && cursorX + width(group) > maxRowWidth) {
      cursorX = 0;
      cursorZ += rowMaxDepth + spacing;
      rowMaxDepth = 0;
    }
    placed.push({ group, x: cursorX, z: cursorZ });
    cursorX += width(group);
    totalMaxX = Math.max(totalMaxX, cursorX);
    cursorX += spacing;
    rowMaxDepth = Math.max(rowMaxDepth, depth(group));
  }

  const totalMaxZ = cursorZ + rowMaxDepth;
  const shiftX = -totalMaxX * 0.5;
  const shiftZ = -totalMaxZ * 0.5;
  let tallest = 0;
  for (const { group, x, z } of placed) {
    const dx = x + shiftX - group.minX;
    const dy = -group.anchor.minY; // Apoya el sólido (no el hueco) exactamente sobre Y=0
    const dz = z + shiftZ - group.minZ;
    tallest = Math.max(tallest, group.anchor.maxY - group.anchor.minY);
    for (const member of group.members) {
      const p = member.obj.position;
      positions[member.obj.id] = [p[0] + dx, p[1] + dy, p[2] + dz];
    }
  }

  const tolerance = 1e-6;
  const fitsBed = !bed || (
    totalMaxX <= bed.bedWidthMm + tolerance &&
    totalMaxZ <= bed.bedDepthMm + tolerance &&
    tallest <= bed.maxHeightMm + tolerance
  );
  return { positions, footprintMm: [totalMaxX, totalMaxZ], fitsBed };
}
