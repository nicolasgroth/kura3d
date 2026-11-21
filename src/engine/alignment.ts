/**
 * @file src/engine/alignment.ts
 * @description Algoritmos deterministas de alineación inteligente por envolvente mundial
 * (min/centro/max en X, Y, Z) y distribución automática en grilla sobre la cama de
 * impresión (`arrange_grid`) con espaciado de 8 mm libre de solapamientos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { AlignMode, PrinterProfile, SceneObject, Vec3 } from '../types/kura';
import { applyTransformToMesh } from './primitives';

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

  const entries = objects.map(computeObjectWorldBounds);

  if (mode === 'arrange_grid') {
    const spacing = 8;
    const bedWidth = bed?.bedWidthMm ?? 256;
    const maxObjW = entries.reduce((acc, e) => Math.max(acc, e.width), 0);
    const maxRowWidth = Math.max(bedWidth - spacing * 2, maxObjW);

    // Orden determinista por profundidad descendente para empaquetado por estantes compacto
    const sorted = [...entries].sort((a, b) => {
      if (Math.abs(b.depth - a.depth) > 0.5) return b.depth - a.depth;
      return a.obj.id.localeCompare(b.obj.id);
    });

    interface PlacedBox {
      entry: WorldBoundsEntry;
      targetCenterX: number;
      targetCenterZ: number;
    }

    const placed: PlacedBox[] = [];
    let cursorX = 0;
    let cursorZ = 0;
    let rowMaxDepth = 0;
    let totalMaxX = 0;

    for (const entry of sorted) {
      if (cursorX > 0 && cursorX + entry.width > maxRowWidth) {
        cursorX = 0;
        cursorZ += rowMaxDepth + spacing;
        rowMaxDepth = 0;
      }

      const targetCenterX = cursorX + entry.width * 0.5;
      const targetCenterZ = cursorZ + entry.depth * 0.5;
      placed.push({ entry, targetCenterX, targetCenterZ });

      cursorX += entry.width;
      if (cursorX > totalMaxX) totalMaxX = cursorX;
      cursorX += spacing;
      if (entry.depth > rowMaxDepth) rowMaxDepth = entry.depth;
    }

    const totalMaxZ = cursorZ + rowMaxDepth;
    const shiftX = -totalMaxX * 0.5;
    const shiftZ = -totalMaxZ * 0.5;

    for (const item of placed) {
      const { entry, targetCenterX, targetCenterZ } = item;
      const dx = targetCenterX + shiftX - entry.cx;
      const dy = -entry.minY; // Apoyar exactamente sobre la cama (Y=0)
      const dz = targetCenterZ + shiftZ - entry.cz;

      result[entry.obj.id] = [
        entry.obj.position[0] + dx,
        entry.obj.position[1] + dy,
        entry.obj.position[2] + dz,
      ];
    }

    return result;
  }

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
