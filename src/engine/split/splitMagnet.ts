/**
 * @file src/engine/split/splitMagnet.ts
 * @description Imanes como unión del corte en "dividir para imprimir": el conector `magnet` a partir de un imán
 * (`core/addons/magnetPocket`: medidas con holgura y negativo circunscrito), la escalera de cantidades (automática:
 * una por isla y al menos dos por unión si caben; fija: la pedida y menos si no caben), el alojamiento enfrentado
 * en cada pieza (coaxial con la normal del plano, boca en la cara del corte, profundidad = alto + holgura), la
 * comprobación de material con rayos en las dos piezas y la regla de fuerza propia de los imanes (por verificar). Los
 * cuadrados y rectangulares (`splitMagnetBlock`) se orientan por la sección y se comprueban con su huella real.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import { magnetBaseArea, magnetFootprint, POCKET_SEGMENTS, pocketDims, pocketPrimitive, pocketSectionArea, type MagnetParams } from '../../core/addons/magnetPocket';
import { engineWarning, type EngineWarning } from '../engineErrors';
import { AxisRayMesh, materialAlongAxis } from '../jointRays';
import { JOINT_RULES } from '../jointRules';
import { AXIS_INDEX } from './splitSections';
import { blockAngles, blockDepthFits, blockHalves, blocksFit, buildBlockPockets } from './splitMagnetBlock';
import type { SplitAxis, SplitConnectorOptions, SplitJointIsland, SplitJointMagnets, SplitJointStrength } from './splitTypes';

/** Clave i18n del texto de polaridad que acompaña a toda unión con imanes. */
export const MAGNET_POLARITY_NOTE = 'splitMagnet.polarity';

/** Cuánto cruza el negativo el plano del corte hacia la otra pieza (sin caras coplanares), mm. */
const MOUTH_CROSS_MM = 0.5;

/**
 * Regla de fuerza de una unión con imanes (criterio de diseño, POR VERIFICAR: la fuerza real depende del grado y
 * del tamaño del imán). `areaRatio` = área de los imanes / área de la sección.
 * - `weak`: área < `minAreaRatio`, o un solo imán con área < `singleMaxAreaRatio` (sección grande: gira y se suelta).
 * - `firm`: ≥ 2 imanes (no gira), área ≥ `firmAreaRatio` y todas las islas con imán.
 * - `fair`: el resto (un imán en sección chica, área entre los dos umbrales o islas sin imán).
 */
export const MAGNET_RULES = { minAreaRatio: 0.01, firmAreaRatio: 0.02, singleMaxAreaRatio: 0.05 } as const;

export const isMagnet = (c: Pick<SplitConnectorOptions, 'type'> | null | undefined): boolean => c?.type === 'magnet';

/** Imán cuadrado o rectangular (huella de caja, no de círculo). */
export const isBlockMagnet = (m: MagnetParams | undefined): m is MagnetParams & { shape: 'square' | 'rect' } => m !== undefined && m.shape !== 'round';

/**
 * Conector de imanes: `size` = radio del imán, `tolerance` = holgura radial (la mitad de la del diámetro) y
 * `depth` = profundidad de cada alojamiento. Cuadrado y rectangular: `size` = semidiagonal del imán y `size +
 * tolerance` = semidiagonal del hueco (el círculo que lo contiene: zona de la marca de pareja y de los conectores de
 * otras uniones). Siempre abierto (la boca va en la cara del corte) y sin el mínimo de espesor de los conectores
 * (`minWallForConnectorMm: 0`): manda la pared alrededor de cada imán. El giro del alojamiento suelto no aplica: en
 * la unión el rectángulo se orienta por la sección.
 */
export function magnetConnector(m: MagnetParams, count: number | 'auto'): SplitConnectorOptions {
  const { turn90: _turn, ...rest } = m;
  const magnet: MagnetParams = { ...rest, hidden: false };
  const dims = pocketDims(magnet);
  const foot = magnetFootprint(magnet);
  const size = magnet.shape === 'round' ? magnet.sizeMm / 2 : Math.hypot(foot.lengthMm, foot.widthMm) / 2;
  const reach = magnet.shape === 'round' ? size + magnet.clearanceMm / 2 : Math.hypot(dims.widthMm, dims.crossMm) / 2;
  return {
    type: 'magnet',
    size,
    tolerance: reach - size,
    depth: dims.depthMm,
    count: count === 'auto' ? 2 : Math.max(1, Math.round(count)),
    ...(count === 'auto' ? { countAuto: true } : {}),
    minWallForConnectorMm: 0,
    magnet,
  };
}

/** Profundidad del agujero a cada lado del plano en las uniones de dos lados (tarugo suelto e imanes). */
export function twoSidedHoleDepth(c: Pick<SplitConnectorOptions, 'type' | 'depth' | 'tolerance'>): number {
  return c.type === 'magnet' ? c.depth : c.depth + c.tolerance;
}

/**
 * Cantidades a probar, de mayor a menor. Automática: max(2, islas aptas, los que dan una unión firme en el área de la
 * sección: `firmAreaRatio` × área / área de un imán), hasta `JOINT_RULES.maxCount`, y luego menos (se queda con la
 * mayor que cabe con sus márgenes); fija: la pedida y menos.
 */
export function magnetLadder(c: SplitConnectorOptions, eligibleIslands: number, sectionAreaMm2 = 0): SplitConnectorOptions[] {
  const magnetArea = c.magnet ? magnetBaseArea(c.magnet) : Math.PI * c.size * c.size;
  const firm = magnetArea > 0 ? Math.ceil((MAGNET_RULES.firmAreaRatio * sectionAreaMm2) / magnetArea) : 0;
  const top = c.countAuto ? Math.min(JOINT_RULES.maxCount, Math.max(2, eligibleIslands, firm)) : c.count;
  const out: SplitConnectorOptions[] = [];
  for (let n = top; n >= 1; n--) out.push({ ...c, count: n });
  return out;
}

/** Datos del imán de la unión (para la guía de armado, Comprobar encaje y la polaridad). */
export function magnetJointInfo(c: SplitConnectorOptions, count: number): SplitJointMagnets | undefined {
  if (!c.magnet) return undefined;
  const dims = pocketDims(c.magnet);
  return { magnet: { ...c.magnet }, count, pocketDiameterMm: dims.widthMm, pocketDepthMm: dims.depthMm, polarity: 'opposite' };
}

/** Lleva un sólido construido a lo largo de +Z local al eje de la unión (misma convención que el tarugo suelto). */
function orient(m: Manifold, axis: SplitAxis): Manifold {
  if (axis === 'z') return m;
  const r = axis === 'y' ? m.rotate([-90, 0, 0]) : m.rotate([0, 90, 0]);
  m.delete();
  return r;
}

/**
 * Los dos alojamientos de un imán en el plano `center[eje]`: `low` (de plano − profundidad a plano + 0,5) y `high`
 * (de plano − 0,5 a plano + profundidad). Polígono de `POCKET_SEGMENTS` lados circunscrito al círculo del hueco
 * (como el alojamiento de imán suelto): su ancho mínimo es el diámetro con holgura, el imán siempre entra.
 */
export function buildMagnetPockets(wasm: ManifoldToplevel, axis: SplitAxis, center: Vec3, c: SplitConnectorOptions, angle = 0): { low: Manifold; high: Manifold } {
  if (isBlockMagnet(c.magnet)) return buildBlockPockets(wasm, axis, center, c.magnet, c.depth, angle);
  const dims = pocketDims(c.magnet ?? { shape: 'round', sizeMm: 2 * c.size, heightMm: c.depth, clearanceMm: 2 * c.tolerance, depthClearanceMm: 0, hidden: false });
  const r = Number(pocketPrimitive({ ...dims, shape: 'round' }).params.radius);
  const d = c.depth;
  const cyl = (from: number, len: number) => {
    const raw = wasm.Manifold.cylinder(len, r, r, POCKET_SEGMENTS, false);
    const moved = raw.translate([0, 0, from]);
    raw.delete();
    const o = orient(moved, axis);
    const t = o.translate(center);
    o.delete();
    return t;
  };
  return { low: cyl(-d, d + MOUTH_CROSS_MM), high: cyl(-MOUTH_CROSS_MM, d + MOUTH_CROSS_MM) };
}

/** Volumen de un alojamiento (sección del polígono real × profundidad). */
export function magnetPocketVolume(c: SplitConnectorOptions): number {
  if (!c.magnet) return 0;
  const dims = pocketDims(c.magnet);
  return pocketSectionArea(dims) * dims.depthMm;
}

/**
 * Si cada alojamiento deja `wall` de material bajo su fondo en las dos piezas (rayos paralelos al eje desde el
 * centro y desde el anillo hueco + pared). El alto del imán es fijo: si no cabe, no se acorta, se descarta.
 */
export function magnetDepthFits(low: Manifold, high: Manifold, axis: SplitAxis, centers: Vec3[], c: SplitConnectorOptions, wall = JOINT_RULES.minWallMm): boolean {
  return depthFitsWith({ lo: new AxisRayMesh(low), hi: new AxisRayMesh(high) }, axis, centers, c, wall);
}

/** Lo mismo con las mallas de rayos ya armadas (una vez por unión, no por peldaño de la escalera). */
function depthFitsWith(rays: { lo: AxisRayMesh; hi: AxisRayMesh }, axis: SplitAxis, centers: Vec3[], c: SplitConnectorOptions, wall = JOINT_RULES.minWallMm): boolean {
  const a = AXIS_INDEX[axis];
  const ring = c.size + c.tolerance + wall;
  const need = c.depth + wall;
  return centers.every((p) => materialAlongAxis(rays.hi, p, a, 1, ring) >= need && materialAlongAxis(rays.lo, p, a, -1, ring) >= need);
}

/** Islas que admiten un imán con su pared: la zona segura (isla encogida por hueco + pared) no queda vacía. */
export function magnetEligibleIslands(islands: CrossSection[], c: SplitConnectorOptions, wall = JOINT_RULES.minWallMm): number {
  // Cuadrado y rectangular: basta que quepa su ancho (la comprobación exacta de la huella viene después).
  const reach = isBlockMagnet(c.magnet) ? blockHalves(c.magnet).halfW : c.size + c.tolerance;
  const margin = reach + wall + JOINT_RULES.facetMarginMm;
  let n = 0;
  for (const isl of islands) {
    const safe = isl.offset(-margin, 'Round');
    if (!safe.isEmpty()) n++;
    safe.delete();
  }
  return n;
}

/** Lo que `placeMagnets` necesita de la unión (subconjunto de `JointInput`). */
export interface MagnetJointInput {
  low: { m: Manifold };
  high: { m: Manifold };
  axis: SplitAxis;
  /** Motor: lo necesitan los imanes cuadrados y rectangulares para comprobar su huella con polígonos. */
  wasm?: ManifoldToplevel;
}

/**
 * Ubica los imanes de una unión: prueba la escalera de cantidades con `place` (la misma ubicación de los conectores:
 * pared 1,2 mm alrededor y hacia el exterior, lejos de los conectores de otras uniones) y exige material bajo cada
 * alojamiento en las dos piezas. Cuadrados y rectangulares (requieren `wasm`): cada peldaño se ubica primero con el
 * ancho del hueco (`layoutSize`, caben más) y si no con su semidiagonal; el rectángulo se orienta por la isla y se
 * comprueba exacto (huella + pared dentro de la sección, sin solaparse, material bajo las esquinas). Avisa si no cupo
 * ninguno (`SPLIT_MAGNET_NO_ROOM` o `SPLIT_MAGNET_NO_ROOM_BLOCK`) o si cupieron menos de los pedidos
 * (`SPLIT_MAGNET_REDUCED`). `angles` = orientación de cada alojamiento en el plano (0 en los redondos).
 */
export function placeMagnets<C>(
  j: MagnetJointInput, islands: CrossSection[], c: SplitConnectorOptions,
  place: (c: SplitConnectorOptions, layoutSize?: number) => { centers: Vec3[]; caps: C[] } | null,
  addCaps: (caps: C[]) => void, warnings: EngineWarning[], pair: { label: string; a: string; b: string },
): { used: SplitConnectorOptions | null; centers: Vec3[]; angles: number[]; requested: SplitConnectorOptions } {
  const m = c.magnet;
  const block = isBlockMagnet(m) && j.wasm ? { m, wasm: j.wasm } : null;
  const eligible = magnetEligibleIslands(islands, c);
  const ladder = magnetLadder(c, eligible, islands.reduce((s, isl) => s + Math.abs(isl.area()), 0));
  // Automática: el aviso de «menos de los pedidos» compara con la base de siempre (2 o uno por isla), no con los
  // extra que se intentan para una unión firme en secciones grandes.
  const requested = c.countAuto ? { ...c, count: Math.min(ladder[0].count, Math.max(2, eligible)) } : ladder[0];
  // Las mallas de rayos (copia de la malla de cada pieza) se arman una vez, al primer peldaño que ubica imanes.
  let rays: { lo: AxisRayMesh; hi: AxisRayMesh } | null = null;
  const wall = JOINT_RULES.minWallMm;
  for (const rung of eligible > 0 ? ladder : []) {
    const sizes = block ? [blockHalves(block.m).halfW, undefined] : [undefined];
    for (const layoutSize of sizes) {
      const found = place(rung, layoutSize);
      if (!found) continue;
      const angles = block ? blockAngles(islands, j.axis, found.centers) : found.centers.map(() => 0);
      if (block && !blocksFit(block.wasm, islands, j.axis, found.centers, angles, block.m, wall)) continue;
      rays ??= { lo: new AxisRayMesh(j.low.m), hi: new AxisRayMesh(j.high.m) };
      const deep = block
        ? blockDepthFits(rays, j.axis, found.centers, angles, block.m, rung.depth, wall)
        : depthFitsWith(rays, j.axis, found.centers, rung);
      if (!deep) continue;
      addCaps(found.caps);
      if (rung.count < requested.count) warnings.push(engineWarning('SPLIT_MAGNET_REDUCED', { ...pair, count: rung.count, requested: requested.count }));
      return { used: rung, centers: found.centers, angles, requested };
    }
  }
  if (isBlockMagnet(m)) {
    const foot = magnetFootprint(m);
    warnings.push(engineWarning('SPLIT_MAGNET_NO_ROOM_BLOCK', { ...pair, length: foot.lengthMm, width: foot.widthMm, height: m.heightMm, wall }));
  } else {
    warnings.push(engineWarning('SPLIT_MAGNET_NO_ROOM', {
      ...pair, diameter: m?.sizeMm ?? 2 * c.size, height: m?.heightMm ?? c.depth, wall,
    }));
  }
  return { used: null, centers: [], angles: [], requested };
}

/** Informe de fuerza de una unión con imanes (`MAGNET_RULES`). */
export function magnetStrength(
  used: SplitConnectorOptions | null, requested: SplitConnectorOptions | null, centers: Vec3[], contactAreaMm2: number, islands: SplitJointIsland[],
): SplitJointStrength {
  const covered = islands.filter((i) => i.kind !== 'glue').length;
  const discarded = islands
    .map((isl, island) => ({ isl, island }))
    .filter(({ isl }) => isl.kind === 'glue')
    .map(({ isl, island }) => ({ island, reason: 'section-narrow' as const, measuredMm: isl.minWidthMm }));
  const base = { islands: islands.length, islandsCovered: covered, discarded, basis: 'magnet' as const };
  if (!used || centers.length === 0) {
    return { ...base, level: 'glue', reasons: ['no-connector'], count: 0, sizeMm: 0, depthMm: 0, areaRatio: 0, shrunk: [] };
  }
  const count = centers.length;
  const magnetArea = used.magnet ? magnetBaseArea(used.magnet) : Math.PI * used.size * used.size;
  const areaRatio = contactAreaMm2 > 0 ? (count * magnetArea) / contactAreaMm2 : 0;
  const shrunk: SplitJointStrength['shrunk'] = [];
  if (requested && count < requested.count) shrunk.push({ reason: 'count', fromMm: requested.count, toMm: count });
  const out = { ...base, count, sizeMm: used.size, depthMm: used.depth, areaRatio, shrunk };
  const weak: SplitJointStrength['reasons'] = [];
  if (areaRatio < MAGNET_RULES.minAreaRatio) weak.push('low-area');
  if (count === 1 && areaRatio < MAGNET_RULES.singleMaxAreaRatio) weak.push('single-magnet');
  if (weak.length > 0) return { ...out, level: 'weak', reasons: weak };
  const fair: SplitJointStrength['reasons'] = [];
  if (count < 2) fair.push('single-connector');
  if (areaRatio < MAGNET_RULES.firmAreaRatio) fair.push('low-area');
  if (covered < islands.length) fair.push('islands-uncovered');
  return fair.length > 0 ? { ...out, level: 'fair', reasons: fair } : { ...out, level: 'firm', reasons: [] };
}
