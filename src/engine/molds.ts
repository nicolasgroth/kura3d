/**
 * @file src/engine/molds.ts
 * @description Generador automático paramétrico de moldes y contra-moldes watertight
 * para colado de silicona, velas, resinas y termoconformado en Kura3D.
 * Soporta cuatro modos deterministas: molde directo de 1 parte, molde bivalvo de 2 partes
 * con llaves de registro y tolerancia, caja madre contenedora + positivo maestro,
 * y sistema núcleo/cavidad para piezas huecas (núcleo por offset interior real).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type {
  MaterialPresetId,
  MeshData,
  MoldOptions,
  SceneObject,
  Vec3,
} from '../types/kura';
import {
  initManifoldEngine,
  manifoldToMeshData,
  meshDataToManifold,
} from './manifoldKernel';
import { EngineError, engineWarning, requireOperationRange, type EngineWarning } from './engineErrors';
import { OPERATION_DEFAULTS, OPERATION_RANGES } from './operationLimits';
import { buildPourChannels, countSealedVoids, type AxisBox } from './moldChannels';
import { applyTransformToMesh, normalizeMeshToBed } from './primitives';
import { inwardOffset } from './solidOffset';

/** Resultado individual de cada pieza generada por el generador de moldes. */
export type MoldPartLabel = 'single' | 'halfA' | 'halfB' | 'motherBox' | 'positive' | 'outer' | 'core';

export interface GeneratedMoldPart {
  /** Rótulo en español para consumidores sin i18n (MCP headless); la interfaz usa `label`. */
  nameSuffix: string;
  /** Identificador del rótulo traducible (`mold.part.<label>`). */
  label: MoldPartLabel;
  color: string;
  materialPreset: MaterialPresetId;
  mesh: MeshData;
  position: Vec3;
}

/**
 * Extrae el centro-base mundial `[cx, minY, cz]` de una malla y normaliza sus
 * coordenadas locales para que descanse en Y=0 centrado en (X=0, Z=0).
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
 * Crea una caja ortogonal alineada con los ejes mundiales entre `[minX, minY, minZ]`
 * y `[maxX, maxY, maxZ]` en el sistema Y-up de Kura3D.
 */
function createBoxBounds(
  wasm: ManifoldToplevel,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number
): Manifold {
  const w = Math.max(0.5, maxX - minX);
  const h = Math.max(0.5, maxY - minY);
  const d = Math.max(0.5, maxZ - minZ);
  const raw = wasm.Manifold.cube([w, h, d], false);
  try {
    return raw.translate([minX, minY, minZ]);
  } finally {
    raw.delete();
  }
}

/** Lanza `MOLD_SEALED_CAVITY` si el molde deja cavidades sin salida al exterior. */
function assertMoldFillable(
  wasm: ManifoldToplevel,
  mold: Manifold,
  box: AxisBox
): void {
  const sealed = countSealedVoids(wasm, mold, box);
  if (sealed.count > 0) {
    throw new EngineError('MOLD_SEALED_CAVITY', {
      count: sealed.count,
      volume: sealed.volumeMm3,
    });
  }
}

/**
 * Construye un bloque de molde directo restando el sólido maestro `master` (y
 * opcionalmente un embudo cónico por cuerpo del maestro, sobre su cara superior real).
 * Verifica que no queden cavidades selladas imposibles de llenar.
 */
function buildDirectMoldSolid(
  wasm: ManifoldToplevel,
  master: Manifold,
  bounds: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  },
  wallMargin: number,
  pourSpout: boolean,
  pourSpoutRadius: number
): Manifold {
  const { minX, minY, minZ, maxX, maxY, maxZ } = bounds;
  const dx = maxX - minX;
  const dz = maxZ - minZ;

  // Si hay embudo superior, expandimos también la tapa +Y; si no, queda abierto arriba.
  const boxMaxY = pourSpout ? maxY + wallMargin : maxY;
  const handles: Manifold[] = [];
  const moldBox: AxisBox = {
    minX: minX - wallMargin,
    minY: minY - wallMargin,
    minZ: minZ - wallMargin,
    maxX: maxX + wallMargin,
    maxY: boxMaxY,
    maxZ: maxZ + wallMargin,
  };

  try {
    const outerBox = createBoxBounds(
      wasm,
      minX - wallMargin,
      minY - wallMargin,
      minZ - wallMargin,
      maxX + wallMargin,
      boxMaxY,
      maxZ + wallMargin
    );
    handles.push(outerBox);

    // Devuelve el molde solo si no deja cavidades selladas (si no, lo libera y lanza)
    const verified = (mold: Manifold): Manifold => {
      try {
        assertMoldFillable(wasm, mold, moldBox);
        return mold;
      } catch (err) {
        mold.delete();
        throw err;
      }
    };

    const cavity = outerBox.subtract(master);
    if (!pourSpout) {
      return verified(cavity);
    }
    handles.push(cavity);

    // Un embudo por cuerpo del maestro, sobre su cara superior real (no el centro del bbox). El radio
    // ya viene ajustado por `safeSpoutRadius` (y avisado) desde `generateMoldDetailed`.
    void dx;
    void dz;
    const channels = buildPourChannels(wasm, master, boxMaxY, pourSpoutRadius);
    if (!channels) {
      handles.pop();
      return verified(cavity);
    }
    handles.push(channels);
    return verified(cavity.subtract(channels));
  } finally {
    for (const h of handles) {
      h.delete();
    }
  }
}

/**
 * Construye una llave de registro cónica/cilíndrica (dowel con punta redondeada/chaflanada)
 * orientada a lo largo de `+splitAxis` en la coordenada de corte, con un anclaje de 0.6 mm
 * dentro de la mitad negativa para garantizar una unión CSG libre de caras coplanares.
 */
function buildRegistrationKey(
  wasm: ManifoldToplevel,
  splitAxis: 'x' | 'z',
  center: Vec3,
  radius: number,
  depth: number,
  toleranceExpand: number
): Manifold {
  const r = Math.max(0.5, radius + toleranceExpand);
  const d = Math.max(0.8, depth + toleranceExpand);
  const embed = 0.6;
  const handles: Manifold[] = [];

  try {
    // Clavija ligeramente cónica para facilitar el alineado físico de ambas mitades del molde
    const pegRaw = wasm.Manifold.cylinder(d + embed, r, r * 0.82, 20, false);
    handles.push(pegRaw);
    const pegZ = pegRaw.translate([0, 0, -embed]);
    handles.push(pegZ);

    const oriented =
      splitAxis === 'z' ? pegZ : pegZ.rotate([0, 90, 0]);
    if (oriented !== pegZ) {
      handles.push(oriented);
    }

    return oriented.translate(center);
  } finally {
    for (const h of handles) {
      h.delete();
    }
  }
}

/**
 * Genera piezas de molde y contra-molde 100 % cerradas (watertight) a partir de un
 * objeto de escena `obj` aplicando previamente su transformación mundial.
 *
 * Modos soportados:
 * - `'direct_1part'`: bloque envolvente directo menos la pieza (con embudo opcional).
 * - `'direct_2part'`: molde bivalvo dividido por `splitAxis` con 2 a 4 llaves de registro
 *   macho/hembra con holgura `keyToleranceMm` y separación visual de ±8 mm.
 * - `'silicone_master'`: caja madre abierta arriba con espesor `boxWallMm` y holgura
 *   `wallMarginMm` para colado de silicona + positivo maestro centrado en su interior.
 * - `'core_cavity'`: molde exterior + núcleo interior (offset real con pared uniforme `cavityWallMm`).
 *
 * @param obj Objeto maestro origen en la escena.
 * @param options Parámetros geométricos del molde en milímetros.
 * @returns Lista de piezas generadas listas para insertar en la escena.
 */
/** Radio máximo del embudo para un maestro de `dx` × `dz` mm (45 % del lado menor, mínimo 1,5 mm). */
export function safeSpoutRadius(dx: number, dz: number): number {
  return Math.max(OPERATION_RANGES.mold.pourSpoutRadiusMm.min, Math.min(dx, dz) * 0.45);
}

/** Piezas de molde y avisos de los ajustes que impuso la geometría. */
export interface GeneratedMold {
  parts: GeneratedMoldPart[];
  warnings: EngineWarning[];
}

/** Igual que `generateMoldDetailed` pero solo devuelve las piezas. */
export async function generateMold(obj: SceneObject, options: MoldOptions): Promise<GeneratedMoldPart[]> {
  return (await generateMoldDetailed(obj, options)).parts;
}

/**
 * Genera las piezas del molde. Si el embudo pedido no cabe sobre el maestro, se reduce al radio
 * seguro y se devuelve el aviso `MOLD_SPOUT_REDUCED` (nunca un ajuste silencioso).
 */
export async function generateMoldDetailed(obj: SceneObject, options: MoldOptions): Promise<GeneratedMold> {
  const warnings: EngineWarning[] = [];
  const parts = await generateMoldParts(obj, options, (requested, dx, dz) => {
    const safe = safeSpoutRadius(dx, dz);
    if (requested <= safe) return requested;
    if (options.pourSpout) warnings.push(engineWarning('MOLD_SPOUT_REDUCED', { requested, applied: safe }));
    return safe;
  });
  return { parts, warnings };
}

async function generateMoldParts(
  obj: SceneObject,
  options: MoldOptions,
  fitSpout: (requested: number, dx: number, dz: number) => number
): Promise<GeneratedMoldPart[]> {
  const wasm = await initManifoldEngine();
  const worldMesh = applyTransformToMesh(
    obj.mesh,
    obj.position,
    obj.rotation,
    obj.scale
  );

  // Rangos de la fuente única: fuera de rango es error tipado, no un valor acotado en silencio.
  const R = OPERATION_RANGES.mold;
  const D = OPERATION_DEFAULTS.mold;
  const wallMargin = requireOperationRange('wallMarginMm', options.wallMarginMm, R.wallMarginMm, D.wallMarginMm);
  const boxWall = requireOperationRange('boxWallMm', options.boxWallMm, R.boxWallMm, D.boxWallMm);
  const requestedSpout = requireOperationRange('pourSpoutRadiusMm', options.pourSpoutRadiusMm, R.pourSpoutRadiusMm, D.pourSpoutRadiusMm);
  const keyTolerance = requireOperationRange('keyToleranceMm', options.keyToleranceMm, R.keyToleranceMm, D.keyToleranceMm);
  const cavityWall = requireOperationRange('cavityWallMm', options.cavityWallMm, R.cavityWallMm, D.cavityWallMm);

  let master: Manifold | null = null;
  const handles: Manifold[] = [];

  try {
    master = meshDataToManifold(wasm, worldMesh, undefined, obj.color);
    const bbox = master.boundingBox();
    const minX = bbox.min[0];
    const minY = bbox.min[1];
    const minZ = bbox.min[2];
    const maxX = bbox.max[0];
    const maxY = bbox.max[1];
    const maxZ = bbox.max[2];

    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;

    const bounds = { minX, minY, minZ, maxX, maxY, maxZ };
    const pourSpoutRadius = fitSpout(requestedSpout, maxX - minX, maxZ - minZ);

    // ------------------------------------------------------------------------
    // Modo 1: Molde directo en 1 parte
    // ------------------------------------------------------------------------
    if (options.mode === 'direct_1part') {
      const mold = buildDirectMoldSolid(
        wasm,
        master,
        bounds,
        wallMargin,
        options.pourSpout,
        pourSpoutRadius
      );
      handles.push(mold);
      const norm = extractPositionAndNormalize(manifoldToMeshData(mold));
      const liftY = Math.max(0, -norm.position[1]);
      return [
        {
          nameSuffix: 'Molde (1 Parte)',
          label: 'single',
          color: '#22c55e',
          materialPreset: 'silicone',
          mesh: norm.mesh,
          position: [norm.position[0], norm.position[1] + liftY, norm.position[2]],
        },
      ];
    }

    // ------------------------------------------------------------------------
    // Modo 2: Molde bivalvo en 2 partes con llaves de registro macho/hembra
    // ------------------------------------------------------------------------
    if (options.mode === 'direct_2part') {
      const fullMold = buildDirectMoldSolid(
        wasm,
        master,
        bounds,
        wallMargin,
        options.pourSpout,
        pourSpoutRadius
      );
      handles.push(fullMold);

      const splitAxis = options.splitAxis === 'z' ? 'z' : 'x';
      const normal: Vec3 = splitAxis === 'x' ? [1, 0, 0] : [0, 0, 1];
      const cutCoord = splitAxis === 'x' ? cx : cz;

      let [posHalf, negHalf] = fullMold.splitByPlane(normal, cutCoord);
      handles.push(posHalf, negHalf);

      // Calculamos entre 2 y 4 puntos sobre los márgenes sólidos de la pared del molde
      // (fuera de la cavidad de la pieza maestra) para ubicar las llaves de registro.
      const boxMaxY = options.pourSpout ? maxY + wallMargin : maxY;
      const boxMinY = minY - wallMargin;
      const uMin = (splitAxis === 'x' ? minZ : minX) - wallMargin;
      const uMax = (splitAxis === 'x' ? maxZ : maxX) + wallMargin;

      const keyRadius = Math.max(0.8, Math.min(2.6, wallMargin * 0.34));
      const keyDepth = Math.max(1.2, Math.min(3.2, wallMargin * 0.65));
      const uLeft = uMin + wallMargin * 0.5;
      const uRight = uMax - wallMargin * 0.5;
      const vBot = boxMinY + wallMargin * 0.5;
      const vTop = boxMaxY - Math.max(keyRadius + 0.6, wallMargin * 0.45);

      const uvPairs: [number, number][] =
        vTop - vBot >= keyRadius * 3.2
          ? [
              [uLeft, vBot],
              [uRight, vBot],
              [uLeft, vTop],
              [uRight, vTop],
            ]
          : [
              [uLeft, (boxMinY + boxMaxY) * 0.5],
              [uRight, (boxMinY + boxMaxY) * 0.5],
            ];

      const keyCenters: Vec3[] = uvPairs.map(([u, v]) =>
        splitAxis === 'x' ? [cutCoord, v, u] : [u, v, cutCoord]
      );

      const males: Manifold[] = [];
      const sockets: Manifold[] = [];
      for (const center of keyCenters) {
        const male = buildRegistrationKey(
          wasm,
          splitAxis,
          center,
          keyRadius,
          keyDepth,
          0
        );
        const socket = buildRegistrationKey(
          wasm,
          splitAxis,
          center,
          keyRadius,
          keyDepth,
          keyTolerance
        );
        males.push(male);
        sockets.push(socket);
        handles.push(male, socket);
      }

      const maleUnion = wasm.Manifold.union(males);
      const socketUnion = wasm.Manifold.union(sockets);
      handles.push(maleUnion, socketUnion);

      const halfA = negHalf.add(maleUnion);
      const halfB = posHalf.subtract(socketUnion);
      handles.push(halfA, halfB);

      const normA = extractPositionAndNormalize(manifoldToMeshData(halfA));
      const normB = extractPositionAndNormalize(manifoldToMeshData(halfB));

      // Desplazamiento visual de ±8 mm sobre el eje de partición y apoyo en Y >= 0
      const visualOffset = 8;
      const offX = splitAxis === 'x' ? visualOffset : 0;
      const offZ = splitAxis === 'z' ? visualOffset : 0;
      const liftY = Math.max(0, -Math.min(normA.position[1], normB.position[1]));

      return [
        {
          nameSuffix: 'Molde Mitad A',
          label: 'halfA',
          color: '#22c55e',
          materialPreset: 'silicone',
          mesh: normA.mesh,
          position: [
            normA.position[0] - offX,
            normA.position[1] + liftY,
            normA.position[2] - offZ,
          ],
        },
        {
          nameSuffix: 'Molde Mitad B',
          label: 'halfB',
          color: '#10b981',
          materialPreset: 'silicone',
          mesh: normB.mesh,
          position: [
            normB.position[0] + offX,
            normB.position[1] + liftY,
            normB.position[2] + offZ,
          ],
        },
      ];
    }

    // ------------------------------------------------------------------------
    // Modo 3: Caja Madre para colado de silicona + Positivo Maestro
    // ------------------------------------------------------------------------
    if (options.mode === 'silicone_master') {
      const innerMinX = minX - wallMargin;
      const innerMaxX = maxX + wallMargin;
      const innerMinZ = minZ - wallMargin;
      const innerMaxZ = maxZ + wallMargin;
      const innerMinY = minY;
      const innerMaxY = maxY + wallMargin;

      const outerBox = createBoxBounds(
        wasm,
        innerMinX - boxWall,
        innerMinY - boxWall,
        innerMinZ - boxWall,
        innerMaxX + boxWall,
        innerMaxY,
        innerMaxZ + boxWall
      );
      handles.push(outerBox);

      // Pestaña/reborde sutil inferior de alineación alrededor de la base de la caja madre
      const rimExpand = 1.6;
      const baseRim = createBoxBounds(
        wasm,
        innerMinX - boxWall - rimExpand,
        innerMinY - boxWall,
        innerMinZ - boxWall - rimExpand,
        innerMaxX + boxWall + rimExpand,
        innerMinY,
        innerMaxZ + boxWall + rimExpand
      );
      handles.push(baseRim);

      const outerWithRim = outerBox.add(baseRim);
      handles.push(outerWithRim);

      // Cavidad interior abierta por arriba (+1 mm extra arriba para corte limpio)
      const innerCavity = createBoxBounds(
        wasm,
        innerMinX,
        innerMinY,
        innerMinZ,
        innerMaxX,
        innerMaxY + 1,
        innerMaxZ
      );
      handles.push(innerCavity);

      const motherBox = outerWithRim.subtract(innerCavity);
      handles.push(motherBox);

      const normBox = extractPositionAndNormalize(manifoldToMeshData(motherBox));
      const normMaster = extractPositionAndNormalize(
        manifoldToMeshData(master)
      );
      // Eleva el conjunto para que la base de la caja madre apoye exactamente en Y = 0
      const liftY = Math.max(0, -normBox.position[1]);

      return [
        {
          nameSuffix: 'Caja Madre (Silicona)',
          label: 'motherBox',
          color: '#38bdf8',
          materialPreset: 'petg_clear',
          mesh: normBox.mesh,
          position: [normBox.position[0], normBox.position[1] + liftY, normBox.position[2]],
        },
        {
          nameSuffix: 'Positivo Maestro',
          label: 'positive',
          color: '#f97316',
          materialPreset: 'wax_candle',
          mesh: normMaster.mesh,
          position: [normMaster.position[0], normMaster.position[1] + liftY, normMaster.position[2]],
        },
      ];
    }

    // ------------------------------------------------------------------------
    // Modo 4: Núcleo y Cavidad (Core & Cavity) para piezas/velas huecas
    // ------------------------------------------------------------------------
    const outerMold = buildDirectMoldSolid(
      wasm,
      master,
      bounds,
      wallMargin,
      options.pourSpout,
      pourSpoutRadius
    );
    handles.push(outerMold);

    // Núcleo = offset interior real del maestro: la pieza colada queda con pared uniforme
    const core = inwardOffset(wasm, master, cavityWall).inner;
    handles.push(core);
    if (core.isEmpty() || core.volume() < 1e-6) {
      throw new EngineError('MOLD_CORE_EMPTY', { wall: cavityWall });
    }
    const escaped = core.subtract(master);
    handles.push(escaped);
    if (escaped.volume() > 1e-6 * Math.max(1, master.volume())) {
      throw new EngineError('MOLD_CORE_OUTSIDE', { volume: escaped.volume() });
    }

    const normOuter = extractPositionAndNormalize(manifoldToMeshData(outerMold));
    const normCore = extractPositionAndNormalize(manifoldToMeshData(core));
    const liftY = Math.max(0, -Math.min(normOuter.position[1], normCore.position[1]));

    return [
      {
        nameSuffix: 'Molde Exterior',
          label: 'outer',
        color: '#22c55e',
        materialPreset: 'silicone',
        mesh: normOuter.mesh,
        position: [normOuter.position[0], normOuter.position[1] + liftY, normOuter.position[2]],
      },
      {
        nameSuffix: 'Núcleo Interior',
          label: 'core',
        color: '#38bdf8',
        materialPreset: 'petg_clear',
        mesh: normCore.mesh,
        position: [normCore.position[0], normCore.position[1] + liftY, normCore.position[2]],
      },
    ];
  } finally {
    for (const h of handles) {
      h.delete();
    }
    master?.delete();
  }
}
