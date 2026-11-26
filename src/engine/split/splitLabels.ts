/**
 * @file src/engine/split/splitLabels.ts
 * @description Marcas de pareja de "dividir para imprimir": graba (bajorrelieve) la etiqueta de cada
 * unión en las dos caras que se tocan, en la zona maciza de la sección lejos del borde y de los
 * conectores. La sección se toma de la pieza del lado positivo, se contrae por un margen al borde,
 * se le restan círculos alrededor de los conectores y se busca el punto más hondo (contracción por
 * bisección); el texto (fuente real, `buildTextCrossSection`) se escala hasta caber. En la pieza del
 * lado positivo el texto va reflejado para leerse de frente a su cara. Queda dentro de la unión.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import { buildTextCrossSection } from '../text/textCrossSection';
import { orientForAxis } from './splitSections';
import type { SplitAxis } from './splitTypes';

/** Distancia mínima de la marca al borde de la sección (mm). */
const BORDER_MM = 1.5;
/** Separación mínima de la marca a cada alojamiento (mm). */
const CONNECTOR_GAP_MM = 1.5;
/** Alto máximo de letra (mm). */
const MAX_HEIGHT_MM = 20;

/** Pasa un punto de mundo a (u, v) del plano orientado (ver `cutConnectorLayout.ts`). */
export function worldToPlaneUV(axis: SplitAxis, p: Vec3): [number, number] {
  if (axis === 'z') return [p[0], p[1]];
  if (axis === 'y') return [p[0], -p[2]];
  return [-p[2], p[1]];
}

/** Pasa (u, v) del plano orientado a mundo en la coordenada `coord` del eje. */
export function planeUVToWorld(axis: SplitAxis, u: number, v: number, coord: number): Vec3 {
  if (axis === 'z') return [u, v, coord];
  if (axis === 'y') return [u, coord, -v];
  return [coord, v, -u];
}

/** Lleva un sólido del marco orientado (z' = eje) al mundo. */
export function orientedToWorld(m: Manifold, axis: SplitAxis): Manifold {
  if (axis === 'z') return m.translate([0, 0, 0]);
  return axis === 'y' ? m.rotate([-90, 0, 0]) : m.rotate([0, 90, 0]);
}

export interface JointLabelInput {
  text: string;
  axis: SplitAxis;
  /** Coordenada del plano de la unión. */
  coord: number;
  /** Pieza del lado positivo (ya recortada a la cara de la unión). */
  high: Manifold;
  connectorCenters: Vec3[];
  /** Radio de la huella de cada alojamiento (con holgura). */
  connectorRadius: number;
  depthMm: number;
  minHeightMm: number;
  /** Zona a evitar en (u, v) (p. ej. islas con solape); no se libera. */
  exclude?: CrossSection;
}

export interface JointLabelSolids {
  /** Sólido a restar a la pieza del lado negativo (cara `+eje`). */
  forLow: Manifold;
  /** Sólido a restar a la pieza del lado positivo (cara `-eje`, texto reflejado). */
  forHigh: Manifold;
  heightMm: number;
  /** Centro de la marca en el plano (mundo) y radio que la contiene. */
  center: Vec3;
  radiusMm: number;
}

/** Zona donde puede ir la marca, en (u, v). El llamador libera. */
function labelZone(wasm: ManifoldToplevel, input: JointLabelInput): CrossSection {
  const { oriented, owned } = orientForAxis(input.high, input.axis);
  const section = oriented.slice(input.coord + 0.01);
  if (owned) oriented.delete();
  let inner = section.offset(-BORDER_MM, 'Round');
  section.delete();
  if (input.exclude && !input.exclude.isEmpty()) {
    const grown = input.exclude.offset(CONNECTOR_GAP_MM, 'Round');
    const rest = inner.subtract(grown);
    grown.delete();
    inner.delete();
    inner = rest;
  }
  if (input.connectorCenters.length === 0) return inner;
  const holes = input.connectorCenters.map((c) => {
    const [u, v] = worldToPlaneUV(input.axis, c);
    return wasm.CrossSection.circle(input.connectorRadius + CONNECTOR_GAP_MM, 32).translate([u, v]);
  });
  const holeUnion = wasm.CrossSection.union(holes);
  for (const h of holes) h.delete();
  const zone = inner.subtract(holeUnion);
  inner.delete();
  holeUnion.delete();
  return zone;
}

/** Punto más hondo de la zona y su distancia al borde (bisección sobre la contracción). */
function deepestPoint(zone: CrossSection): { uv: [number, number]; depth: number } | null {
  if (zone.isEmpty()) return null;
  const b = zone.bounds();
  let lo = 0;
  let hi = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]) / 2;
  let best: CrossSection | null = null;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const shrunk = zone.offset(-mid, 'Round');
    if (shrunk.isEmpty()) {
      shrunk.delete();
      hi = mid;
    } else {
      best?.delete();
      best = shrunk;
      lo = mid;
    }
  }
  const region = best ?? zone.offset(0, 'Round');
  const polys = region.toPolygons() as Array<Array<[number, number]>>;
  region.delete();
  const pts = polys.flat();
  if (pts.length === 0) return null;
  const uv: [number, number] = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  return { uv, depth: lo };
}

/**
 * Sólidos de grabado de la etiqueta de una unión, o `null` si no cabe una marca legible
 * (`minHeightMm`). Ninguno toca los alojamientos ni el borde de la sección.
 */
export async function buildJointLabel(wasm: ManifoldToplevel, input: JointLabelInput): Promise<JointLabelSolids | null> {
  const zone = labelZone(wasm, input);
  const handles: Array<{ delete: () => void }> = [zone];
  try {
    const deep = deepestPoint(zone);
    if (!deep) return null;
    const unit = await buildTextCrossSection(wasm, input.text, { size: 1, align: 'center' });
    handles.push(unit);
    const ub = unit.bounds();
    const halfW = (ub.max[0] - ub.min[0]) / 2;
    const halfH = (ub.max[1] - ub.min[1]) / 2;
    const cx = (ub.max[0] + ub.min[0]) / 2;
    const cy = (ub.max[1] + ub.min[1]) / 2;
    // Escala inicial: el rectángulo del texto cabe en el círculo de la zona; luego se ajusta a la zona real.
    let scale = Math.min(MAX_HEIGHT_MM / (2 * halfH), deep.depth / Math.hypot(halfW, halfH));
    let placed: CrossSection | null = null;
    for (let tries = 0; tries < 8 && scale * 2 * halfH >= input.minHeightMm; tries++) {
      const candidate = unit.translate([-cx, -cy]).scale([scale, scale]).translate(deep.uv);
      const outside = candidate.subtract(zone);
      const fits = outside.area() < 1e-6;
      outside.delete();
      if (fits) {
        placed = candidate;
        break;
      }
      candidate.delete();
      scale *= 0.85;
    }
    if (!placed) return null;
    handles.push(placed);
    const heightMm = scale * 2 * halfH;
    const total = input.depthMm + 0.5;
    const lowLocal = placed.extrude(total).translate([0, 0, input.coord - input.depthMm]);
    // Reflejo en u alrededor del centro de la marca: se lee de frente a la cara −eje
    const mirrored = placed.translate([-deep.uv[0], 0]).mirror([1, 0]).translate([deep.uv[0], 0]);
    handles.push(lowLocal, mirrored);
    const highLocal = mirrored.extrude(total).translate([0, 0, input.coord - 0.5]);
    handles.push(highLocal);
    return {
      forLow: orientedToWorld(lowLocal, input.axis),
      forHigh: orientedToWorld(highLocal, input.axis),
      heightMm,
      center: planeUVToWorld(input.axis, deep.uv[0], deep.uv[1], input.coord),
      radiusMm: scale * Math.hypot(halfW, halfH),
    };
  } finally {
    for (const h of handles) h.delete();
  }
}
