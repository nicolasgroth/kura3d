/**
 * @file src/engine/operations.ts
 * @description Operaciones CSG booleanas (unión, resta, intersección), ahuecado paramétrico,
 * corte por plano con conectores mecánicos automáticos (dowel, peg, dovetail), separación
 * de islas desconectadas, separación por color y borrado esférico sobre Manifold-3D.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type {
  BooleanOpType,
  CutConnectorType,
  MeshData,
  PlaneCutOptions,
  SceneObject,
  Vec3,
} from '../types/kura';
import {
  createColorRegistry,
  initManifoldEngine,
  manifoldToMeshData,
  meshDataToManifold,
} from './manifoldKernel';
import {
  assertConnectorDepth,
  assertConnectorsFit,
  CONNECTOR_MIN_WALL_MM,
  validateConnectorParams,
} from './cutConnectorChecks';
import { connectorFootprintRadius, layoutConnectorsOnSection } from './cutConnectorLayout';
import { EngineError, engineWarning, type EngineWarning } from './engineErrors';
import {
  applyTransformToMesh,
  computeMeshStats,
  normalizeMeshToBed,
} from './primitives';

/**
 * Extrae el centro-base mundial `[cx, minY, cz]` de una malla y devuelve la malla
 * normalizada con su centro horizontal en (0, 0) y su base en Y=0.
 */
function extractPositionAndNormalize(mesh: MeshData): {
  mesh: MeshData;
  position: Vec3;
} {
  const vertCount = Math.floor(mesh.positions.length / 3);
  if (vertCount === 0) {
    return { mesh, position: [0, 0, 0] };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < vertCount; i++) {
    const x = mesh.positions[i * 3];
    const y = mesh.positions[i * 3 + 1];
    const z = mesh.positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (z > maxZ) maxZ = z;
  }

  return {
    mesh: normalizeMeshToBed(mesh),
    position: [(minX + maxX) * 0.5, minY, (minZ + maxZ) * 0.5],
  };
}

/**
 * Ejecuta una operación booleana CSG watertight (`union`, `subtract` o `intersect`)
 * entre dos objetos de la escena aplicando previamente sus transformaciones mundiales.
 * Preserva colores por cara cuando los objetos tienen colores distintos o pintado previo.
 *
 * @param targetObj Objeto base/destino.
 * @param toolObj Objeto herramienta/operador.
 * @param op Tipo de operación booleana.
 * @returns Nueva malla normalizada a cama y su posición mundial `[cx, minY, cz]`.
 */
export async function runBooleanOperation(
  targetObj: SceneObject,
  toolObj: SceneObject,
  op: BooleanOpType
): Promise<{ mesh: MeshData; position: Vec3 }> {
  const wasm = await initManifoldEngine();

  const targetWorld = applyTransformToMesh(
    targetObj.mesh,
    targetObj.position,
    targetObj.rotation,
    targetObj.scale
  );
  const toolWorld = applyTransformToMesh(
    toolObj.mesh,
    toolObj.position,
    toolObj.rotation,
    toolObj.scale
  );

  const trackColors =
    Boolean(targetObj.mesh.faceColors?.length) ||
    Boolean(toolObj.mesh.faceColors?.length) ||
    targetObj.color.toLowerCase() !== toolObj.color.toLowerCase();

  const registry = trackColors
    ? createColorRegistry(wasm, [
        { color: targetObj.color, faceColors: targetWorld.faceColors },
        { color: toolObj.color, faceColors: toolWorld.faceColors },
      ])
    : null;

  let targetManifold: Manifold | null = null;
  let toolManifold: Manifold | null = null;
  let resultManifold: Manifold | null = null;

  try {
    targetManifold = meshDataToManifold(
      wasm,
      targetWorld,
      registry?.colorToId,
      targetObj.color
    );
    toolManifold = meshDataToManifold(
      wasm,
      toolWorld,
      registry?.colorToId,
      toolObj.color
    );

    if (op === 'union') {
      resultManifold = targetManifold.add(toolManifold);
    } else if (op === 'subtract') {
      resultManifold = targetManifold.subtract(toolManifold);
    } else {
      resultManifold = targetManifold.intersect(toolManifold);
    }

    if (resultManifold.isEmpty() || resultManifold.numTri() === 0) {
      throw new EngineError('BOOLEAN_EMPTY_RESULT', { op });
    }

    const outMesh = manifoldToMeshData(resultManifold, registry?.idToColor);
    return extractPositionAndNormalize(outMesh);
  } finally {
    targetManifold?.delete();
    toolManifold?.delete();
    resultManifold?.delete();
  }
}

export { hollowMesh, hollowMeshDetailed, type HollowResult } from './hollow';

/**
 * Construye una pieza conectora individual orientada según el eje de corte.
 * El conector sobresale hacia +normal desde `cutCoord` hasta `cutCoord + depth`
 * con un anclaje de -0.5 mm embebido dentro de la mitad negativa para evitar caras coplanares.
 */
function buildConnectorSolid(
  wasm: ManifoldToplevel,
  type: Exclude<CutConnectorType, 'none'>,
  axis: 'x' | 'y' | 'z',
  worldCenter: Vec3,
  size: number,
  depth: number,
  expandTolerance: number
): Manifold {
  const r = Math.max(0.4, size + expandTolerance);
  const h = Math.max(0.8, depth + expandTolerance);
  const embed = 0.5;
  const totalLen = h + embed;

  const tempHandles: Array<{ delete: () => void }> = [];
  try {
    let localZ: Manifold;

    if (type === 'dowel') {
      const raw = wasm.Manifold.cylinder(totalLen, r, r, 24, false);
      tempHandles.push(raw);
      localZ = raw.translate([0, 0, -embed]);
      tempHandles.push(localZ);
    } else if (type === 'peg') {
      // Clavija cuadrada ligeramente cónica en la punta para facilitar el encastre manual
      const cs = wasm.CrossSection.square([r * 1.8, r * 1.8], true);
      tempHandles.push(cs);
      const extruded = cs.extrude(totalLen, 0, 0, [0.85, 0.85], false);
      tempHandles.push(extruded);
      localZ = extruded.translate([0, 0, -embed]);
      tempHandles.push(localZ);
    } else {
      // Dovetail (cola de milano): trapecio en XZ extruido en espesor Y y reorientado al eje de corte
      const neckHalf = Math.max(0.35, size * 0.55) + expandTolerance;
      const headHalf = Math.max(0.55, size * 0.95) + expandTolerance;
      const thick = Math.max(0.8, size * 1.3 + expandTolerance * 2);

      const profile: [number, number][] = [
        [-neckHalf, -embed],
        [neckHalf, -embed],
        [neckHalf, 0],
        [headHalf, h],
        [-headHalf, h],
        [-neckHalf, 0],
      ];
      const cs = wasm.CrossSection.ofPolygons([profile], 'Positive');
      tempHandles.push(cs);
      const extruded = cs.extrude(thick, 0, 0, [1, 1], true);
      tempHandles.push(extruded);
      // El perfil tiene su profundidad en el eje 2D +Y, así que rotamos +90° en X para que apunte a +Z
      localZ = extruded.rotate([90, 0, 0]);
      tempHandles.push(localZ);
    }

    let oriented: Manifold;
    if (axis === 'z') {
      oriented = localZ;
    } else if (axis === 'y') {
      // Rotar -90° en X lleva +Z a +Y
      oriented = localZ.rotate([-90, 0, 0]);
      tempHandles.push(oriented);
    } else {
      // Rotar +90° en Y lleva +Z a +X
      oriented = localZ.rotate([0, 90, 0]);
      tempHandles.push(oriented);
    }

    return oriented.translate(worldCenter);
  } finally {
    for (const handle of tempHandles) {
      handle.delete();
    }
  }
}

/**
 * Corta un objeto por un plano ortogonal (X, Y o Z) y genera conectores mecánicos
 * automáticos (`dowel`, `peg`, `dovetail`) macho en la mitad negativa y hembra con
 * tolerancia de impresión (`options.tolerance`) en la mitad positiva.
 *
 * @param obj Objeto de escena a dividir.
 * @param options Configuración de eje, desplazamiento, conectores y modo de conservación.
 * Los conectores se ubican por isla de la sección real (ver `cutConnectorLayout.ts`); una isla
 * sin espacio para ninguno queda sin conector y se avisa con `CUT_CONNECTOR_ISLAND_SKIPPED`.
 *
 * @returns Mitades `positive` y `negative` normalizadas a cama con su posición mundial, y avisos.
 */
export async function planeCutWithConnectors(
  obj: SceneObject,
  options: PlaneCutOptions
): Promise<{
  positive: { mesh: MeshData; position: Vec3 } | null;
  negative: { mesh: MeshData; position: Vec3 } | null;
  warnings: EngineWarning[];
}> {
  const wasm = await initManifoldEngine();
  const worldMesh = applyTransformToMesh(
    obj.mesh,
    obj.position,
    obj.rotation,
    obj.scale
  );

  const registry = obj.mesh.faceColors?.length
    ? createColorRegistry(wasm, [
        { color: obj.color, faceColors: worldMesh.faceColors },
      ])
    : null;

  let manifold: Manifold | null = null;
  let posHalf: Manifold | null = null;
  let negHalf: Manifold | null = null;
  const cleanupHandles: Manifold[] = [];
  const warnings: EngineWarning[] = [];

  try {
    manifold = meshDataToManifold(
      wasm,
      worldMesh,
      registry?.colorToId,
      obj.color
    );

    const bbox = manifold.boundingBox();
    const axisIdx = options.axis === 'x' ? 0 : options.axis === 'y' ? 1 : 2;
    const normal: Vec3 =
      options.axis === 'x' ? [1, 0, 0] : options.axis === 'y' ? [0, 1, 0] : [0, 0, 1];

    const cutCoord =
      (bbox.min[axisIdx] + bbox.max[axisIdx]) * 0.5 + options.offset;

    const [splitPos, splitNeg] = manifold.splitByPlane(normal, cutCoord);
    posHalf = splitPos;
    negHalf = splitNeg;

    const bothNonEmpty =
      !posHalf.isEmpty() &&
      posHalf.numTri() > 0 &&
      !negHalf.isEmpty() &&
      negHalf.numTri() > 0;
    // Un plano fuera del objeto o en su borde no corta nada: error tipado en vez de "ok" con una pieza.
    if (!bothNonEmpty) {
      throw new EngineError('CUT_PLANE_OUTSIDE', {
        axis: options.axis,
        offset: options.offset,
        min: bbox.min[axisIdx] - (bbox.min[axisIdx] + bbox.max[axisIdx]) * 0.5,
        max: bbox.max[axisIdx] - (bbox.min[axisIdx] + bbox.max[axisIdx]) * 0.5,
      });
    }

    if (options.connectorType !== 'none') {
      const { size, depth, tolerance: tol, count } = validateConnectorParams(options);
      const type = options.connectorType;
      const depthWithWall = Math.max(0.8, depth + tol) + CONNECTOR_MIN_WALL_MM;
      assertConnectorDepth(posHalf, normal, cutCoord, depthWithWall);
      // Margen al borde: huella del alojamiento con pared (+0.02 mm por el facetado del offset);
      // separación: dos huellas con media pared cada una.
      const layout = layoutConnectorsOnSection(manifold, {
        axis: options.axis,
        cutCoord,
        count,
        margin: connectorFootprintRadius(type, size, tol + CONNECTOR_MIN_WALL_MM) + 0.02,
        separation: 2 * connectorFootprintRadius(type, size, tol + CONNECTOR_MIN_WALL_MM * 0.5),
        depth: depthWithWall,
      });
      if (layout.skippedIslands === layout.islands) {
        throw new EngineError('CUT_CONNECTOR_TOO_LARGE', { size, count, wall: CONNECTOR_MIN_WALL_MM });
      }
      if (!layout.enoughRoom) {
        throw new EngineError('CUT_CONNECTORS_OVERLAP', { size, count });
      }
      if (layout.skippedIslands > 0) {
        warnings.push(
          engineWarning('CUT_CONNECTOR_ISLAND_SKIPPED', {
            skipped: layout.skippedIslands,
            islands: layout.islands,
            size,
          })
        );
      }
      const centers = layout.centers;

      if (centers.length > 0) {
        const males: Manifold[] = [];
        const females: Manifold[] = [];

        for (const center of centers) {
          const male = buildConnectorSolid(
            wasm,
            options.connectorType,
            options.axis,
            center,
            size,
            depth,
            0
          );
          const female = buildConnectorSolid(
            wasm,
            options.connectorType,
            options.axis,
            center,
            size,
            depth,
            tol
          );
          males.push(male);
          females.push(female);
          cleanupHandles.push(male, female);
        }

        // Alojamiento + pared mínima: debe caber en la mitad que lo recibe y no solaparse
        const shells = centers.map((center) =>
          buildConnectorSolid(
            wasm,
            options.connectorType as Exclude<CutConnectorType, 'none'>,
            options.axis,
            center,
            size,
            depth,
            tol + CONNECTOR_MIN_WALL_MM
          )
        );
        // Para el solape basta media pared por lado: entre alojamientos quedan ≥ CONNECTOR_MIN_WALL_MM
        const spacers = centers.map((center) =>
          buildConnectorSolid(
            wasm,
            options.connectorType as Exclude<CutConnectorType, 'none'>,
            options.axis,
            center,
            size,
            depth,
            tol + CONNECTOR_MIN_WALL_MM * 0.5
          )
        );
        cleanupHandles.push(...shells, ...spacers);
        assertConnectorsFit(
          posHalf,
          shells,
          spacers,
          normal,
          cutCoord,
          depthWithWall,
          size
        );

        const maleUnion = wasm.Manifold.union(males);
        const femaleUnion = wasm.Manifold.union(females);
        cleanupHandles.push(maleUnion, femaleUnion);

        const nextNeg = negHalf.add(maleUnion);
        const nextPos = posHalf.subtract(femaleUnion);

        negHalf.delete();
        posHalf.delete();
        negHalf = nextNeg;
        posHalf = nextPos;
      }
    }

    const keepPos = options.keepMode === 'both' || options.keepMode === 'positive';
    const keepNeg = options.keepMode === 'both' || options.keepMode === 'negative';

    const positive =
      keepPos && posHalf && !posHalf.isEmpty() && posHalf.numTri() > 0
        ? extractPositionAndNormalize(
            manifoldToMeshData(posHalf, registry?.idToColor)
          )
        : null;

    const negative =
      keepNeg && negHalf && !negHalf.isEmpty() && negHalf.numTri() > 0
        ? extractPositionAndNormalize(
            manifoldToMeshData(negHalf, registry?.idToColor)
          )
        : null;

    return { positive, negative, warnings };
  } finally {
    for (const h of cleanupHandles) {
      h.delete();
    }
    posHalf?.delete();
    negHalf?.delete();
    manifold?.delete();
  }
}

/**
 * Separa un objeto compuesto por múltiples islas topológicamente desconectadas
 * en mallas independientes usando `manifold.decompose()`.
 *
 * @param obj Objeto de escena origen.
 * @returns Arreglo de partes independientes normalizadas a cama con su posición mundial.
 */
export async function splitDisconnectedParts(
  obj: SceneObject
): Promise<Array<{ mesh: MeshData; position: Vec3 }>> {
  const wasm = await initManifoldEngine();
  const worldMesh = applyTransformToMesh(
    obj.mesh,
    obj.position,
    obj.rotation,
    obj.scale
  );
  const registry = obj.mesh.faceColors?.length
    ? createColorRegistry(wasm, [
        { color: obj.color, faceColors: worldMesh.faceColors },
      ])
    : null;

  let manifold: Manifold | null = null;
  let parts: Manifold[] = [];

  try {
    manifold = meshDataToManifold(
      wasm,
      worldMesh,
      registry?.colorToId,
      obj.color
    );
    parts = manifold.decompose();
    return parts
      .filter((p) => !p.isEmpty() && p.numTri() > 0)
      .map((p) =>
        extractPositionAndNormalize(manifoldToMeshData(p, registry?.idToColor))
      );
  } finally {
    for (const p of parts) {
      p.delete();
    }
    manifold?.delete();
  }
}

/**
 * Separa una malla multicolor en sub-mallas independientes agrupadas por cada color
 * presente en `faceColors` (útil para exportar piezas separadas para impresión multicolor).
 *
 * @param obj Objeto de escena con regiones pintadas.
 * @returns Lista de objetos `{ color, mesh, position }` compactados y normalizados.
 */
export function splitMeshByColor(
  obj: SceneObject
): Array<{ color: string; mesh: MeshData; position: Vec3 }> {
  const worldMesh = applyTransformToMesh(
    obj.mesh,
    obj.position,
    obj.rotation,
    obj.scale
  );
  const triCount = Math.floor(worldMesh.indices.length / 3);
  if (triCount === 0) {
    return [];
  }

  const baseColor = obj.color.toLowerCase();
  const groups = new Map<string, number[]>();

  for (let t = 0; t < triCount; t++) {
    const color = (worldMesh.faceColors?.[t] ?? baseColor).toLowerCase();
    let list = groups.get(color);
    if (!list) {
      list = [];
      groups.set(color, list);
    }
    list.push(t);
  }

  const results: Array<{ color: string; mesh: MeshData; position: Vec3 }> = [];

  for (const [color, tris] of groups.entries()) {
    const vertRemap = new Map<number, number>();
    const newPositions: number[] = [];
    const newIndices = new Uint32Array(tris.length * 3);

    for (let k = 0; k < tris.length; k++) {
      const t = tris[k];
      for (let corner = 0; corner < 3; corner++) {
        const oldIdx = worldMesh.indices[t * 3 + corner];
        let newIdx = vertRemap.get(oldIdx);
        if (newIdx === undefined) {
          newIdx = newPositions.length / 3;
          vertRemap.set(oldIdx, newIdx);
          newPositions.push(
            worldMesh.positions[oldIdx * 3],
            worldMesh.positions[oldIdx * 3 + 1],
            worldMesh.positions[oldIdx * 3 + 2]
          );
        }
        newIndices[k * 3 + corner] = newIdx;
      }
    }

    const subMesh: MeshData = {
      positions: new Float32Array(newPositions),
      indices: newIndices,
      faceColors: new Array(tris.length).fill(color),
    };
    const normalized = extractPositionAndNormalize(subMesh);
    // Recalcular normales tras compactado
    const stats = computeMeshStats(normalized.mesh);
    if (stats.triangles > 0) {
      results.push({
        color,
        mesh: normalized.mesh,
        position: normalized.position,
      });
    }
  }

  return results;
}

/**
 * Esculpe/borra una región esférica de un modelo mediante sustracción booleana
 * directa con Manifold-3D, ideal para limpiar artefactos en modelos STL/3MF importados.
 *
 * @param obj Objeto de escena sobre el que se borra.
 * @param worldCenter Centro de la esfera de borrado en coordenadas mundiales (mm).
 * @param radiusMm Radio de borrado en milímetros.
 * @returns Malla resultante normalizada a cama y su nueva posición mundial.
 */
export async function eraseRegionWithSphere(
  obj: SceneObject,
  worldCenter: Vec3,
  radiusMm: number
): Promise<{ mesh: MeshData; position: Vec3 }> {
  const wasm = await initManifoldEngine();
  const worldMesh = applyTransformToMesh(
    obj.mesh,
    obj.position,
    obj.rotation,
    obj.scale
  );
  const registry = obj.mesh.faceColors?.length
    ? createColorRegistry(wasm, [
        { color: obj.color, faceColors: worldMesh.faceColors },
      ])
    : null;

  let target: Manifold | null = null;
  let sphereRaw: Manifold | null = null;
  let sphere: Manifold | null = null;
  let result: Manifold | null = null;

  try {
    target = meshDataToManifold(
      wasm,
      worldMesh,
      registry?.colorToId,
      obj.color
    );
    sphereRaw = wasm.Manifold.sphere(Math.max(0.2, radiusMm), 24);
    sphere = sphereRaw.translate(worldCenter);
    result = target.subtract(sphere);

    if (result.isEmpty() || result.numTri() === 0) {
      throw new EngineError('ERASE_REMOVED_ALL');
    }

    const outMesh = manifoldToMeshData(result, registry?.idToColor);
    return extractPositionAndNormalize(outMesh);
  } finally {
    target?.delete();
    sphereRaw?.delete();
    sphere?.delete();
    result?.delete();
  }
}
