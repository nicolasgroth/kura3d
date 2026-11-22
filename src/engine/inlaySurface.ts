/**
 * @file src/engine/inlaySurface.ts
 * @description Incrustación a ras como UNA sola malla: en vez de unir cavidad y relleno (dos sólidos
 * que se tocan y dejan láminas y vértices coincidentes), se toma la superficie exterior de la pieza
 * tallada y la del relleno, se descartan las paredes de la cavidad y se sueldan por posición. El
 * resultado es la misma superficie de la pieza, cerrada, con las caras de la región incrustada
 * pintadas con el color del grabado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import type { MeshData } from '../types/kura';
import { computeVertexNormals, weldVertices } from './manifoldKernel';
import { splitTJunctions } from './tJunctions';

/** Tolerancia de soldadura (mm) para unir los bordes compartidos de ambas superficies. */
const INLAY_WELD_MM = 1e-5;

interface SurfacePart {
  positions: number[];
  indices: number[];
  colors: string[];
}

/** Agrega a `out` los triángulos de `solid` cuyo origen no es `skipId`, con su color. */
function appendSurface(
  out: SurfacePart,
  solid: Manifold,
  skipId: number,
  colorOf: (originalId: number) => string
): void {
  const raw = solid.getMesh();
  const base = out.positions.length / 3;
  const np = raw.numProp;
  for (let v = 0; v < raw.numVert; v++) {
    out.positions.push(raw.vertProperties[v * np], raw.vertProperties[v * np + 1], raw.vertProperties[v * np + 2]);
  }
  const runs = raw.runOriginalID ?? new Uint32Array([0]);
  const runIndex = raw.runIndex ?? new Uint32Array([0, raw.triVerts.length]);
  for (let r = 0; r < runs.length; r++) {
    if (runs[r] === skipId) continue;
    const color = colorOf(runs[r]);
    for (let i = runIndex[r]; i < runIndex[r + 1]; i += 3) {
      out.indices.push(base + raw.triVerts[i], base + raw.triVerts[i + 1], base + raw.triVerts[i + 2]);
      out.colors.push(color);
    }
  }
}

/**
 * Compone la incrustación a ras: superficie exterior de `carved` (pieza menos cavidad) con sus
 * colores originales más la superficie exterior de `fill` (pieza ∩ cavidad) pintada `inlayColor`.
 * `pocketId` es el `originalID` exclusivo de la cavidad: sus caras (paredes internas) se descartan.
 */
export function composeFlushInlaySurface(
  carved: Manifold,
  fill: Manifold,
  pocketId: number,
  idToColor: Map<number, string>,
  baseColor: string,
  inlayColor: string
): MeshData {
  const part: SurfacePart = { positions: [], indices: [], colors: [] };
  appendSurface(part, carved, pocketId, (id) => idToColor.get(id) ?? baseColor);
  appendSurface(part, fill, pocketId, () => inlayColor);
  const welded = weldVertices(new Float32Array(part.positions), new Uint32Array(part.indices), INLAY_WELD_MM);
  // Cada booleana simplifica su borde por separado: donde una dejó vértices que la otra no, se cosen.
  const sewn = splitTJunctions(welded.positions, welded.indices);
  const faceColors = Array.from(sewn.triangleSource, (t) => part.colors[welded.triangleSource[t]]);
  return {
    positions: welded.positions,
    indices: sewn.indices,
    normals: computeVertexNormals(welded.positions, sewn.indices),
    ...(new Set(faceColors).size > 1 ? { faceColors } : {}),
  };
}
