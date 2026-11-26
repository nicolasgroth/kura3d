/**
 * @file src/engine/generators.ts
 * @description Generadores paramétricos especializados de Kurra Studio:
 * 1) Roscas métricas ISO (reexportadas desde `threads.ts`).
 * 2) Litofanías cilíndricas curvas completamente cerradas (watertight, 90°..360°).
 * 3) Siluetas y cortadores de galletas/sellos (`silhouette` / `cutter`) extraídos de
 *    imágenes RGBA con detección automática del fondo y tamaño final exacto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { CrossSection, Manifold } from 'manifold-3d';
import type { ImageTo3DOptions, MeshData } from '../types/kura';
import {
  computeVertexNormals,
  initManifoldEngine,
  manifoldToMeshData,
} from './manifoldKernel';
import { EngineError, requireOperationRange } from './engineErrors';
import { OPERATION_RANGES } from './operationLimits';
import { cylindricalLithophaneSize, preserveLuminanceRange } from './imageReliefParams';
import { detectForeground, validateImageBuffer } from './imageInput';
import { normalizeMeshToBed } from './primitives';

// ============================================================================
// 1. Roscas métricas ISO: implementadas en `threads.ts` (tabla ISO 261, malla helicoidal exacta)
// ============================================================================

export {
  ISO_COARSE_THREADS,
  createMetricThread,
  isoCoarsePitch,
  resolveThreadOptions,
  type ThreadRequest,
} from './threads';

// ============================================================================
// 2. Litofanía cilíndrica curva cerrada (watertight)
// ============================================================================

/**
 * Muestrea y suaviza la matriz de luminancia normalizada `[0..1]` de una imagen RGBA.
 */
function sampleLuminanceGrid(
  options: ImageTo3DOptions,
  maxGrid: number
): { grid: Float32Array; cols: number; rows: number } {
  const srcW = Math.max(1, Math.floor(options.pixelWidth));
  const srcH = Math.max(1, Math.floor(options.pixelHeight));
  const cols = Math.max(4, Math.min(srcW, maxGrid));
  const rows = Math.max(4, Math.min(srcH, maxGrid));

  let grid = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const sy = Math.min(srcH - 1, Math.floor((r / (rows - 1)) * (srcH - 1)));
    for (let c = 0; c < cols; c++) {
      const sx = Math.min(srcW - 1, Math.floor((c / (cols - 1)) * (srcW - 1)));
      const pIdx = (sy * srcW + sx) * 4;
      const red = options.rgba[pIdx] ?? 0;
      const green = options.rgba[pIdx + 1] ?? 0;
      const blue = options.rgba[pIdx + 2] ?? 0;
      const alpha = (options.rgba[pIdx + 3] ?? 255) / 255;

      const lum = ((0.299 * red + 0.587 * green + 0.114 * blue) / 255) * alpha;
      grid[r * cols + c] = options.invert ? 1 - lum : lum;
    }
  }

  const passes = Math.max(0, Math.min(5, Math.round(options.smoothing)));
  const unsmoothed = grid;
  for (let pass = 0; pass < passes; pass++) {
    const next = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let sum = 0;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          const rr = r + dr;
          if (rr < 0 || rr >= rows) continue;
          for (let dc = -1; dc <= 1; dc++) {
            const cc = c + dc;
            if (cc < 0 || cc >= cols) continue;
            sum += grid[rr * cols + cc];
            count++;
          }
        }
        next[r * cols + c] = sum / count;
      }
    }
    grid = next;
  }
  // El suavizado no debe bajar el alto pedido: se conserva el rango de luminancia original.
  if (passes > 0) preserveLuminanceRange(unsmoothed, grid);

  return { grid, cols, rows };
}

/**
 * Genera una litofanía cilíndrica o curva 100 % cerrada (watertight) descansando sobre
 * Y=0: pared exterior con relieve por luminancia, pared interior cilíndrica lisa, anillos
 * de cierre superior/inferior y tapas laterales cuando `arcDegrees < 360` (o tubo continuo
 * sin costuras cuando `arcDegrees >= 360`).
 *
 * @param options Opciones físicas, imagen RGBA, radio cilíndrico y ángulo de arco.
 * @returns Malla sólida `MeshData` lista para imprimir sin soportes.
 */
export function generateCylindricalLithophane(
  options: ImageTo3DOptions
): MeshData {
  validateImageBuffer(options);
  const { grid, cols, rows } = sampleLuminanceGrid(options, 256);

  // Fuente única del tamaño (`cylindricalLithophaneSize`): mandan radio y arco; el ancho físico no
  // aplica en este modo. Fuera de rango es un error tipado (nunca se acota en silencio).
  const size = cylindricalLithophaneSize(options);
  const arcDeg = size.arcDegrees;
  const isFullCircle = arcDeg >= 359.9;
  const arcRad = (arcDeg * Math.PI) / 180;
  const rInner = size.radiusMm;
  const heightMm = size.heightMm;
  const baseMm = size.baseThicknessMm;
  const reliefMm = size.reliefHeightMm;

  const positions: number[] = [];
  const indices: number[] = [];

  // 1) Vértices de pared exterior [0 .. rows*cols - 1] y pared interior [rows*cols .. 2*rows*cols - 1]
  // r = 0 está arriba (y = heightMm) para que la imagen quede derecha en +Y.
  const thetaAt = (c: number): number =>
    isFullCircle
      ? (c / cols) * Math.PI * 2
      : -arcRad * 0.5 + (c / (cols - 1)) * arcRad;

  for (let r = 0; r < rows; r++) {
    const y = ((rows - 1 - r) / (rows - 1)) * heightMm;
    for (let c = 0; c < cols; c++) {
      const theta = thetaAt(c);
      const rOut = rInner + baseMm + grid[r * cols + c] * reliefMm;
      positions.push(rOut * Math.sin(theta), y, rOut * Math.cos(theta));
    }
  }

  const innerOffset = rows * cols;
  for (let r = 0; r < rows; r++) {
    const y = ((rows - 1 - r) / (rows - 1)) * heightMm;
    for (let c = 0; c < cols; c++) {
      const theta = thetaAt(c);
      positions.push(rInner * Math.sin(theta), y, rInner * Math.cos(theta));
    }
  }

  const outIdx = (r: number, c: number): number => r * cols + c;
  const inIdx = (r: number, c: number): number => innerOffset + r * cols + c;
  const colSegs = isFullCircle ? cols : cols - 1;

  // 2) Pared exterior (normal saliente +radial) e interior (normal saliente -radial)
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < colSegs; c++) {
      const cNext = (c + 1) % cols;

      const oTL = outIdx(r, c);
      const oTR = outIdx(r, cNext);
      const oBL = outIdx(r + 1, c);
      const oBR = outIdx(r + 1, cNext);
      indices.push(oTL, oBL, oBR);
      indices.push(oTL, oBR, oTR);

      const iTL = inIdx(r, c);
      const iTR = inIdx(r, cNext);
      const iBL = inIdx(r + 1, c);
      const iBR = inIdx(r + 1, cNext);
      indices.push(iTL, iBR, iBL);
      indices.push(iTL, iTR, iBR);
    }
  }

  // 3) Anillos superior (r=0, normal +Y) e inferior (r=rows-1, normal -Y)
  const lastR = rows - 1;
  for (let c = 0; c < colSegs; c++) {
    const cNext = (c + 1) % cols;

    // Tapa superior
    indices.push(inIdx(0, c), outIdx(0, c), outIdx(0, cNext));
    indices.push(inIdx(0, c), outIdx(0, cNext), inIdx(0, cNext));

    // Tapa inferior
    indices.push(inIdx(lastR, c), outIdx(lastR, cNext), outIdx(lastR, c));
    indices.push(inIdx(lastR, c), inIdx(lastR, cNext), outIdx(lastR, cNext));
  }

  // 4) Tapas laterales en arco abierto (< 360°) para cerrar completamente el sólido
  if (!isFullCircle) {
    const lastC = cols - 1;
    for (let r = 0; r < rows - 1; r++) {
      // Tapa izquierda (c = 0, normal -theta)
      indices.push(outIdx(r, 0), inIdx(r, 0), inIdx(r + 1, 0));
      indices.push(outIdx(r, 0), inIdx(r + 1, 0), outIdx(r + 1, 0));

      // Tapa derecha (c = lastC, normal +theta)
      indices.push(outIdx(r, lastC), inIdx(r + 1, lastC), inIdx(r, lastC));
      indices.push(outIdx(r, lastC), outIdx(r + 1, lastC), inIdx(r + 1, lastC));
    }
  }

  const posArr = new Float32Array(positions);
  const idxArr = new Uint32Array(indices);
  const normals = computeVertexNormals(posArr, idxArr);

  return normalizeMeshToBed({
    positions: posArr,
    indices: idxArr,
    normals,
  });
}

// ============================================================================
// 3. Siluetas sólidas y cortadores de galletas/sellos desde imagen RGBA
// ============================================================================

/**
 * Suaviza un contorno escalonado: cierre (rellena las muescas de la escalera) y apertura
 * (recorta sus esquinas) con unión redonda de radio `r` (mm), y vuelve a simplificar.
 * Si el resultado se vacía (figura más fina que `2r`) devuelve el contorno original.
 */
/** Radios de cierre y apertura en múltiplos de 0,75 px: el cierre alisa; la apertura es mínima para no romper trazos finos. */
const CLOSE_K = 4;
const OPEN_K = 1;
function smoothStaircase(
  cs: CrossSection,
  r: number,
  own: <T extends { delete: () => void }>(m: T) => T
): CrossSection {
  const closeR = r * CLOSE_K;
  const openR = r * OPEN_K;
  const closed = own(own(cs.offset(closeR, 'Round', 2, 16)).offset(-closeR, 'Round', 2, 16));
  const opened = own(own(closed.offset(-openR, 'Round', 2, 16)).offset(openR, 'Round', 2, 16));
  if (opened.isEmpty()) return closed.isEmpty() ? cs : closed;
  return own(opened.simplify(r * 0.1));
}

/** Resolución máxima de la grilla de muestreo de siluetas y cortadores (celdas por lado). */
export const CUTTER_MAX_GRID = 256;

/**
 * Extrae una silueta sólida (`silhouette`) o un cortador de galletas/arcilla con
 * pestaña de apoyo y cuchilla perimetral (`cutter`) a partir de una imagen RGBA.
 *
 * - El fondo se detecta automáticamente por el borde de la imagen (transparente, claro u
 *   oscuro): un logo oscuro sobre blanco se extrae como logo. `invert` invierte esa decisión.
 * - La pieza final mide exactamente lo pedido en la dimensión limitante (`widthMm` × `depthMm`
 *   incluye la pestaña del cortador) y nunca lo excede en la otra, conservando la proporción.
 *
 * @throws EngineError `IMAGE_BUFFER_INVALID`, `IMAGE_NO_FOREGROUND`, `IMAGE_SIZE_TOO_SMALL`.
 */
export async function generateSilhouetteOrCutterFromImage(
  options: ImageTo3DOptions
): Promise<MeshData> {
  const { w: srcW, h: srcH } = validateImageBuffer(options);
  const IR = OPERATION_RANGES.imageShape;
  const threshold = requireOperationRange('threshold', options.threshold, IR.threshold, 128);
  const widthMm = requireOperationRange('widthMm', options.widthMm, IR.widthMm, 50);
  const depthMm = requireOperationRange('depthMm', options.depthMm, IR.depthMm, 50);
  const mode = options.shapeMode === 'cutter' ? 'cutter' : 'silhouette';
  const wallW = mode === 'cutter' ? requireOperationRange('cutterWallMm', options.cutterWallMm, IR.cutterWallMm, 1.2) : 0;
  const flangeExtra = 3.0;
  const margin = mode === 'cutter' ? wallW + flangeExtra : 0;
  const foreground = detectForeground(options, threshold);

  const wasm = await initManifoldEngine();
  const cols = Math.max(2, Math.min(srcW, CUTTER_MAX_GRID));
  const rows = Math.max(2, Math.min(srcH, CUTTER_MAX_GRID));
  // Grilla en mm provisorios (la imagen ocupa widthMm × depthMm); luego se ajusta al tamaño final
  const pxW = widthMm / cols;
  const pxH = depthMm / rows;
  const overlap = Math.min(pxW, pxH) * 0.005;

  const handles: Array<{ delete: () => void }> = [];
  const own = <T extends { delete: () => void }>(m: T): T => {
    handles.push(m);
    return m;
  };

  try {
    // Corridas horizontales (RLE) de píxeles de primer plano como rectángulos 2D
    const quads: [number, number][][] = [];
    for (let r = 0; r < rows; r++) {
      const sy = Math.min(srcH - 1, Math.floor(((r + 0.5) / rows) * srcH));
      let runStart = -1;
      const flushRun = (endCol: number): void => {
        if (runStart < 0) return;
        const x0 = runStart * pxW - overlap;
        const x1 = (endCol + 1) * pxW + overlap;
        const y0 = (rows - 1 - r) * pxH - overlap;
        const y1 = (rows - r) * pxH + overlap;
        quads.push([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
        runStart = -1;
      };
      for (let c = 0; c < cols; c++) {
        const sx = Math.min(srcW - 1, Math.floor(((c + 0.5) / cols) * srcW));
        if (foreground.isForeground(sx, sy)) {
          if (runStart < 0) runStart = c;
        } else {
          flushRun(c - 1);
        }
      }
      flushRun(cols - 1);
    }

    if (quads.length === 0) {
      throw new EngineError('IMAGE_NO_FOREGROUND', { threshold });
    }

    const rawUnion = own(wasm.CrossSection.ofPolygons(quads, 'Positive'));
    const staircase = own(rawUnion.simplify(Math.min(pxW, pxH) * 0.25));
    // El muestreo por píxeles deja el contorno en dientes de sierra (infla el perímetro ~27 % en un
    // círculo): cierre y apertura redondeados con radio sub-píxel lo suavizan sin mover el tamaño.
    const simplified = staircase.isEmpty() ? staircase : smoothStaircase(staircase, Math.min(pxW, pxH) * 0.75, own);
    if (simplified.isEmpty()) {
      throw new EngineError('IMAGE_NO_FOREGROUND', { threshold });
    }

    // Ajuste al tamaño pedido: s·b + 2·margen = tamaño en la dimensión limitante
    const b = simplified.bounds();
    const bw = b.max[0] - b.min[0];
    const bd = b.max[1] - b.min[1];
    const availW = widthMm - 2 * margin;
    const availD = depthMm - 2 * margin;
    if (availW < 1 || availD < 1 || bw <= 0 || bd <= 0) {
      throw new EngineError('IMAGE_SIZE_TOO_SMALL', { width: widthMm, depth: depthMm, margin });
    }
    const s = Math.min(availW / bw, availD / bd);
    const baseCs = own(simplified.scale([s, s]));

    let combinedZ: Manifold;
    if (mode === 'silhouette') {
      const totalH = requireOperationRange(
        'height',
        (options.baseThicknessMm ?? 2) + (options.reliefHeightMm ?? 2),
        IR.silhouetteHeightMm
      );
      combinedZ = own(baseCs.extrude(totalH, 0, 0, [1, 1], false));
    } else {
      // Cortador: pestaña exterior de agarre + cuchilla perimetral
      const baseH = requireOperationRange('baseThicknessMm', options.baseThicknessMm, IR.cutterBaseMm, 2);
      const bladeH = requireOperationRange('reliefHeightMm', options.reliefHeightMm, IR.cutterBladeMm, 12);
      // Un solo sólido tallado: bloque exterior menos el hueco de la figura menos el anillo sobre
      // la pestaña. Las herramientas sobresalen de las caras del bloque, así ninguna cara queda
      // coincidente (unir pestaña y cuchilla dejaba vértices duplicados en la pared interior).
      const totalH = baseH + bladeH;
      const outerWallCs = own(baseCs.offset(wallW, 'Round'));
      const flangeOuterCs = own(baseCs.offset(margin, 'Round'));
      const block = own(flangeOuterCs.extrude(totalH, 0, 0, [1, 1], false));
      const hole = own(own(baseCs.extrude(totalH + 2, 0, 0, [1, 1], false)).translate([0, 0, -1]));
      const aboveFlangeCs = own(own(flangeOuterCs.offset(1, 'Round')).subtract(outerWallCs));
      const aboveFlange = own(own(aboveFlangeCs.extrude(bladeH + 1, 0, 0, [1, 1], false)).translate([0, 0, baseH]));
      combinedZ = own(own(block.subtract(hole)).subtract(aboveFlange));
    }

    const rotatedY = own(combinedZ.rotate([-90, 0, 0]));
    return normalizeMeshToBed(manifoldToMeshData(rotatedY));
  } finally {
    for (const h of handles) h.delete();
  }
}
