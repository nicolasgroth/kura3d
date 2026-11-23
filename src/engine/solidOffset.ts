/**
 * @file src/engine/solidOffset.ts
 * @description Offset interior real (erosión) de sólidos Manifold con pared uniforme:
 * se evalúa la distancia con signo exacta a la malla (`meshDistance.ts`) y se extrae la
 * isosuperficie `d = espesor` con `Manifold.levelSet` (tetraedros marchantes sobre grilla BCC), con
 * los vértices proyectados al nivel exacto (`hollowLevelProjection.ts`) para que la rejilla gruesa de
 * una pieza grande no engruese la pared.
 * Incluye la medición del espesor mínimo/máximo de pared resultante para detectar
 * perforaciones. Usado por el ahuecado y por el núcleo de los moldes.
 *
 * Alternativa evaluada: `Manifold.minkowskiDifference` con una esfera poliédrica es exacta
 * pero tardó 5–9 s en un toro de 1 536 triángulos (manifold-3d 3.5.5), inviable en el hilo
 * principal; el level-set tarda una fracción y su error está acotado por la grilla.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import { buildMeshDistanceField, type MeshDistanceField } from './meshDistance';
import { snapToLevel } from './hollowLevelProjection';
import { consistentSignField } from './distanceSignCheck';
import { deleteOnThrow, useThenDelete } from './wasmScope';

/** Resultado del offset interior. */
export interface InwardOffsetResult {
  /** Sólido erosionado (puede ser vacío si la pieza es más delgada que 2·espesor en todas partes). */
  inner: Manifold;
  /** Longitud de arista de la grilla usada (mm, mismas unidades que la malla). */
  gridEdgeMm: number;
  /** Margen extra aplicado al nivel para compensar el error de cuerda de la grilla (mm). */
  levelMarginMm: number;
  /** Pared medida de `inner` si ya se midió al ajustar el margen (evita medir dos veces). */
  wall?: WallThicknessStats;
  /** Campo usado (puede ser la variante por número de vueltas del recibido); medir con este. */
  field?: MeshDistanceField;
  /** true si la malla se autointerseca y se usó el signo por número de vueltas (unión de lo encerrado). */
  selfIntersecting?: boolean;
}

/** Fracción del espesor que la pared mínima puede quedar por debajo del pedido (0,5 %). */
export const WALL_UNDERSHOOT_REL = 0.005;
/** Intentos de ajuste del nivel antes de caer al margen fijo del peor caso. */
const MAX_LEVEL_TRIES = 3;

/** Estadística de espesor entre la superficie de una cavidad y la superficie exterior. */
export interface WallThicknessStats {
  minMm: number;
  maxMm: number;
  meanMm: number;
  samples: number;
}

/** Presupuesto de evaluaciones de la SDF (≈ puntos de la grilla BCC). */
const DEFAULT_SAMPLE_BUDGET = 250_000;

/** Lee posiciones e índices planos de un Manifold. */
function manifoldBuffers(m: Manifold): { positions: Float32Array; indices: Uint32Array } {
  const raw = m.getMesh();
  const numProp = raw.numProp;
  const positions = new Float32Array(raw.numVert * 3);
  for (let v = 0; v < raw.numVert; v++) {
    positions[v * 3] = raw.vertProperties[v * numProp];
    positions[v * 3 + 1] = raw.vertProperties[v * numProp + 1];
    positions[v * 3 + 2] = raw.vertProperties[v * numProp + 2];
  }
  return { positions, indices: new Uint32Array(raw.triVerts) };
}

/** Construye el campo de distancia de un Manifold. */
export function distanceFieldOfManifold(m: Manifold): MeshDistanceField {
  return buildMeshDistanceField(manifoldBuffers(m));
}

/** Máximo de planos distintos para la vía exacta convexa. */
const MAX_CONVEX_PLANES = 512;

/**
 * Offset interior exacto de un sólido convexo: la erosión de un poliedro convexo por una bola
 * es la intersección de sus semiespacios desplazados `t` hacia adentro. Devuelve `null` si el
 * sólido no es convexo o tiene demasiadas caras distintas.
 */
export function convexInwardOffset(
  wasm: ManifoldToplevel,
  solid: Manifold,
  thickness: number
): Manifold | null {
  // Primero se cuentan los planos (barato, corta al pasar el máximo); la envolvente es cara.
  const { positions, indices } = manifoldBuffers(solid);
  const planes = new Map<string, [number, number, number, number]>();
  for (let t = 0; t < indices.length / 3; t++) {
    const a = indices[t * 3] * 3, b = indices[t * 3 + 1] * 3, c = indices[t * 3 + 2] * 3;
    const e1x = positions[b] - positions[a], e1y = positions[b + 1] - positions[a + 1], e1z = positions[b + 2] - positions[a + 2];
    const e2x = positions[c] - positions[a], e2y = positions[c + 1] - positions[a + 1], e2z = positions[c + 2] - positions[a + 2];
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) continue;
    nx /= len;
    ny /= len;
    nz /= len;
    const d = nx * positions[a] + ny * positions[a + 1] + nz * positions[a + 2];
    const key = `${Math.round(nx * 1e5)},${Math.round(ny * 1e5)},${Math.round(nz * 1e5)},${Math.round(d * 1e4)}`;
    if (!planes.has(key)) planes.set(key, [nx, ny, nz, d]);
    if (planes.size > MAX_CONVEX_PLANES) return null;
  }
  const vol = solid.volume();
  const hullVol = useThenDelete(solid.hull(), (hull) => hull.volume());
  if (Math.abs(hullVol - vol) > 1e-6 * Math.max(1, vol)) return null;

  const bbox = solid.boundingBox();
  const size: [number, number, number] = [
    bbox.max[0] - bbox.min[0] + 2,
    bbox.max[1] - bbox.min[1] + 2,
    bbox.max[2] - bbox.min[2] + 2,
  ];
  let current = useThenDelete(wasm.Manifold.cube(size, false), (cube) =>
    cube.translate([bbox.min[0] - 1, bbox.min[1] - 1, bbox.min[2] - 1])
  );
  try {
    for (const [nx, ny, nz, d] of planes.values()) {
      // Conserva n·x ≤ d − t  ⇔  (−n)·x ≥ t − d
      const next = current.trimByPlane([-nx, -ny, -nz], thickness - d);
      current.delete();
      current = next;
      if (current.isEmpty()) break;
    }
    return current;
  } catch (err) {
    current.delete();
    throw err;
  }
}

/**
 * Rejilla del offset para una caja de lados `size` (mm) y pared `thickness`: arista de la grilla BCC
 * según el presupuesto de muestras, tolerancia de simplificación y margen del peor caso. Fuente única
 * del cálculo y de la estimación previa de la pared real (`estimateHollowWall`).
 */
export function offsetGridFor(size: readonly number[], thickness: number, sampleBudget = DEFAULT_SAMPLE_BUDGET) {
  // La cavidad solo existe a ≥ thickness del borde: acotamos la grilla a la caja contraída
  const pad = thickness * 0.5;
  const [bx, by, bz] = size.map((s) => Math.max(0, s - 2 * pad));
  // Grilla BCC: ~2 puntos por celda cúbica de lado `edge`
  const volume = Math.max(1e-9, (bx + thickness) * (by + thickness) * (bz + thickness));
  const budgetEdge = Math.cbrt((2 * volume) / Math.max(10_000, sampleBudget));
  const gridEdgeMm = Math.max(thickness / 4, budgetEdge);
  // La simplificación posterior puede mover la superficie hasta `simplifyTol`.
  const simplifyTolMm = Math.min(0.03, thickness * 0.02);
  const worstMarginMm = Math.min(thickness * 0.5, (gridEdgeMm * gridEdgeMm) / (6 * thickness)) + simplifyTolMm;
  // Con los vértices proyectados al nivel exacto sobre la malla refinada ×4 (`hollowLevelProjection.ts`)
  // solo queda la flecha de cuerda de media arista: (arista/2)²/(8·espesor)
  const expectedMarginMm = Math.min(thickness * 0.5, (gridEdgeMm * gridEdgeMm) / (32 * thickness)) + simplifyTolMm;
  return { gridEdgeMm, simplifyTolMm, worstMarginMm, expectedMarginMm };
}

/**
 * Pared que puede salir al ahuecar una pieza no convexa de caja `size` (mm), antes de aplicar: con
 * rejilla gruesa crece hasta `thickness + expectedMarginMm`. `coarse` si supera el pedido en más de 10 %.
 */
export function estimateHollowWall(size: readonly number[], thickness: number) {
  const g = offsetGridFor(size, thickness);
  const maxWallMm = thickness + g.expectedMarginMm;
  return { gridEdgeMm: g.gridEdgeMm, maxWallMm, coarse: maxWallMm > thickness * 1.1 };
}

/**
 * Erosiona `solid` una distancia `thickness` hacia adentro con pared uniforme.
 * El resultado queda siempre contenido en `solid` y a una distancia ≥ `thickness`
 * de su superficie (salvo el error residual que mide `measureWallThickness`).
 *
 * @param wasm Módulo Manifold.
 * @param solid Sólido origen (no se modifica ni libera).
 * @param thickness Espesor de pared en las unidades de la malla.
 * @param sampleBudget Máximo aproximado de evaluaciones de la SDF.
 * @param solidField Campo de distancia ya construido de `solid` (se reutiliza si llega).
 */
export function inwardOffset(
  wasm: ManifoldToplevel,
  solid: Manifold,
  thickness: number,
  sampleBudget = DEFAULT_SAMPLE_BUDGET,
  solidField?: MeshDistanceField
): InwardOffsetResult {
  const exact = convexInwardOffset(wasm, solid, thickness);
  if (exact) {
    return { inner: exact, gridEdgeMm: 0, levelMarginMm: 0 };
  }
  // Una malla que se cruza a sí misma tiene regiones de signo contradictorio por pseudo-normales: el
  // level-set crea superficies espurias, la pared "medida" sale negativa y el margen adaptativo se dispara
  // hasta dejar una cavidad de volumen ~0 (busto real de 325 k triángulos). Se usa el número de vueltas.
  let field = consistentSignField(solidField ?? distanceFieldOfManifold(solid));
  const bbox = solid.boundingBox();
  const sx = bbox.max[0] - bbox.min[0];
  const sy = bbox.max[1] - bbox.min[1];
  const sz = bbox.max[2] - bbox.min[2];

  const pad = thickness * 0.5;
  const { gridEdgeMm: gridEdge, simplifyTolMm: simplifyTol, worstMarginMm: worstCase } = offsetGridFor([sx, sy, sz], thickness, sampleBudget);
  const extract = (level: number): Manifold => {
    // Lipschitz: si |d − nivel| > arista de grilla, ninguna arista que toque ese punto cruza el
    // nivel, así que basta el lado correcto. Con el tope se evita recorrer todo el BVH en puntos
    // hondos (el centro de una esfera equidista de todos sus triángulos).
    const cap = level + 2 * gridEdge;
    const raw = wasm.Manifold.levelSet(
      (p) => field.boundedSignedDistance(p[0], p[1], p[2], cap),
      {
        min: [bbox.min[0] + pad, bbox.min[1] + pad, bbox.min[2] + pad],
        max: [bbox.max[0] - pad, bbox.max[1] - pad, bbox.max[2] - pad],
      },
      gridEdge,
      level
    );
    // Lleva los vértices a la isosuperficie exacta (la interpolación lineal de la grilla gruesa los deja corto o largo)
    // Solo con rejilla gruesa (flecha del peor caso > 5 % de la pared): en piezas chicas la grilla ya es fina
    const coarse = (gridEdge * gridEdge) / (6 * thickness) > 0.05 * thickness;
    const snapped = coarse ? useThenDelete(raw, (m) => snapToLevel(m, field, level, gridEdge)) : raw;
    // Funde triángulos coplanares de la grilla sin mover la superficie más que una fracción del espesor
    return useThenDelete(snapped, (m) => m.simplify(simplifyTol));
  };

  // Margen adaptativo: un margen fijo para el peor caso (cuerdas sobre zonas cóncavas de la
  // cavidad, ~edge²/(8·t)) engrosaba la pared en curvas convexas hasta ~19 % (esfera de 50 mm,
  // pared 2 mm). Se parte del margen de simplificación, se mide la pared real y solo se sube el
  // nivel lo que falte, hasta `MAX_LEVEL_TRIES` intentos; si no alcanza, se usa el margen fijo.
  const minAccepted = thickness * (1 - WALL_UNDERSHOOT_REL);
  let margin = simplifyTol;
  const done = (r: Omit<InwardOffsetResult, 'gridEdgeMm' | 'field' | 'selfIntersecting'>): InwardOffsetResult => ({
    ...r, gridEdgeMm: gridEdge, field, selfIntersecting: field.signMode === 'winding',
  });
  for (let attempt = 0; attempt < MAX_LEVEL_TRIES; attempt++) {
    const inner = extract(thickness + margin);
    if (inner.isEmpty()) return done({ inner, levelMarginMm: margin });
    const wall = deleteOnThrow(inner, (m) => measureWallThickness(field, m));
    if (wall.minMm >= minAccepted) return done({ inner, levelMarginMm: margin, wall });
    inner.delete();
    // La cavidad sale del nivel `d = espesor > 0`: una pared medida negativa solo es posible con signo
    // contradictorio (autointersección que el muestreo no vio). Se cambia el signo y se reintenta.
    if (wall.minMm < 0 && field.signMode !== 'winding') {
      field = field.withSignMode('winding');
      attempt = -1;
      margin = simplifyTol;
      continue;
    }
    margin += (thickness - wall.minMm) * 1.15 + thickness * 0.002;
  }
  const levelMargin = Math.max(worstCase, margin);
  return done({ inner: extract(thickness + levelMargin), levelMarginMm: levelMargin });
}

/**
 * Mide el espesor entre la superficie de `cavity` y la superficie de `outer`
 * (distancia de cada vértice y centroide de la cavidad a la superficie exterior).
 */
export function measureWallThickness(
  outer: Manifold | MeshDistanceField,
  cavity: Manifold
): WallThicknessStats {
  const field = 'signedDistance' in outer ? outer : distanceFieldOfManifold(outer);
  const { positions, indices } = manifoldBuffers(cavity);
  let min = Infinity;
  let max = 0;
  let sum = 0;
  let n = 0;
  const visit = (x: number, y: number, z: number): void => {
    const d = field.signedDistance(x, y, z);
    if (d < min) min = d;
    if (d > max) max = d;
    sum += d;
    n++;
  };
  const vertCount = positions.length / 3;
  for (let v = 0; v < vertCount; v++) {
    visit(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
  }
  for (let t = 0; t < indices.length / 3; t++) {
    const a = indices[t * 3] * 3, b = indices[t * 3 + 1] * 3, c = indices[t * 3 + 2] * 3;
    visit(
      (positions[a] + positions[b] + positions[c]) / 3,
      (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3,
      (positions[a + 2] + positions[b + 2] + positions[c + 2]) / 3
    );
  }
  return n === 0
    ? { minMm: 0, maxMm: 0, meanMm: 0, samples: 0 }
    : { minMm: min, maxMm: max, meanMm: sum / n, samples: n };
}

/** Punto más bajo (mínimo en el eje `axis`) de un Manifold. */
export function lowestPoint(m: Manifold, axis: 0 | 1 | 2): [number, number, number] | null {
  const { positions } = manifoldBuffers(m);
  let best = -1;
  for (let v = 0; v < positions.length / 3; v++) {
    if (best < 0 || positions[v * 3 + axis] < positions[best * 3 + axis]) best = v;
  }
  return best < 0 ? null : [positions[best * 3], positions[best * 3 + 1], positions[best * 3 + 2]];
}

/** Punto más alto (máximo en el eje `axis`) de un Manifold. */
export function highestPoint(m: Manifold, axis: 0 | 1 | 2): [number, number, number] | null {
  const { positions } = manifoldBuffers(m);
  let best = -1;
  for (let v = 0; v < positions.length / 3; v++) {
    if (best < 0 || positions[v * 3 + axis] > positions[best * 3 + axis]) best = v;
  }
  return best < 0 ? null : [positions[best * 3], positions[best * 3 + 1], positions[best * 3 + 2]];
}
