/**
 * @file src/engine/generators.ts
 * @description Generadores paramétricos especializados de Kura3D:
 * 1) Roscas métricas ISO helicoidales de 60° (`bolt`, `nut`, `hole`) con cabeza hexagonal
 *    biselada y tolerancia de impresión 3D.
 * 2) Litofanías cilíndricas curvas completamente cerradas (watertight, 90°..360°).
 * 3) Siluetas y cortadores de galletas/sellos (`silhouette` / `cutter`) extraídos de
 *    imágenes RGBA mediante umbralización y operaciones 2D `CrossSection` de Manifold.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d';
import type { ImageTo3DOptions, MeshData, ThreadOptions } from '../types/kura';
import {
  computeVertexNormals,
  initManifoldEngine,
  manifoldToMeshData,
} from './manifoldKernel';
import { normalizeMeshToBed } from './primitives';

// ============================================================================
// 1. Generador de roscas métricas ISO helicoidales (60°)
// ============================================================================

/**
 * Evalúa el radio normalizado `r(phi)` de un perfil métrico ISO de 60°
 * para la fase `phi in [0, 1)`:
 * - `[0, 0.25]`: valle plano (`rMinor`)
 * - `[0.25, 0.5625]`: flanco ascendente de 60°
 * - `[0.5625, 0.6875]`: cresta truncada (`rMajor`)
 * - `[0.6875, 1.0]`: flanco descendente de 60°
 */
function evalIsoThreadRadius(
  phi: number,
  rMinor: number,
  rMajor: number
): number {
  const p = ((phi % 1) + 1) % 1;
  if (p <= 0.25) {
    return rMinor;
  }
  if (p <= 0.5625) {
    return rMinor + (rMajor - rMinor) * ((p - 0.25) / 0.3125);
  }
  if (p <= 0.6875) {
    return rMajor;
  }
  return rMajor - (rMajor - rMinor) * ((p - 0.6875) / 0.3125);
}

/**
 * Construye un cilindro roscado helicoidal cerrado (watertight) a lo largo del eje +Z
 * mediante extrusión torsionada de una sección transversal polar ISO de 60°.
 * Al usar `CrossSection.extrude(height, nDivisions, twistDegrees)`, Manifold-3D
 * garantiza tapas planas perfectas y ausencia total de auto-intersecciones.
 */
function buildHelicalThreadSolidZ(
  wasm: ManifoldToplevel,
  rMinor: number,
  rMajor: number,
  pitchMm: number,
  lengthMm: number
): Manifold {
  // Muestreamos densamente los 4 tramos del perfil + puntos intermedios en los flancos
  const samplesPerRev = 64;
  const poly: [number, number][] = [];
  for (let i = 0; i < samplesPerRev; i++) {
    const phi = i / samplesPerRev;
    const theta = phi * Math.PI * 2;
    const r = evalIsoThreadRadius(phi, rMinor, rMajor);
    poly.push([r * Math.cos(theta), r * Math.sin(theta)]);
  }

  const turns = Math.max(0.25, lengthMm / pitchMm);
  // Giro negativo para hélice derecha (rosca estándar ISO que aprieta en sentido horario)
  const twistDegrees = -360 * turns;
  const nDivisions = Math.min(600, Math.max(24, Math.ceil(turns * 24)));

  const cs = wasm.CrossSection.ofPolygons([poly], 'Positive');
  try {
    return cs.extrude(lengthMm, nDivisions, twistDegrees, [1, 1], false);
  } finally {
    cs.delete();
  }
}

/**
 * Construye una cabeza o cuerpo hexagonal con bisel cónico mecanizado en eje Z (`[0..height]`).
 */
function buildChamferedHexPrismZ(
  wasm: ManifoldToplevel,
  radius: number,
  height: number,
  chamferBothEnds: boolean
): Manifold {
  const handles: Manifold[] = [];
  try {
    const hex = wasm.Manifold.cylinder(height, radius, radius, 6, false);
    handles.push(hex);

    const chamferH = Math.min(height * 0.22, radius * 0.28);
    const outerR = radius * 1.12;
    const innerR = radius * 0.84;

    let envelope: Manifold;
    if (chamferBothEnds && height > chamferH * 2.5) {
      const midH = height - chamferH * 2;
      const botCone = wasm.Manifold.cylinder(chamferH, innerR, outerR, 36, false);
      const midCyl = wasm.Manifold.cylinder(midH, outerR, outerR, 36, false).translate([
        0,
        0,
        chamferH,
      ]);
      const topCone = wasm.Manifold.cylinder(chamferH, outerR, innerR, 36, false).translate([
        0,
        0,
        chamferH + midH,
      ]);
      handles.push(botCone, midCyl, topCone);
      envelope = wasm.Manifold.union([botCone, midCyl, topCone]);
    } else {
      const bodyH = Math.max(0.2, height - chamferH);
      const botCyl = wasm.Manifold.cylinder(bodyH, outerR, outerR, 36, false);
      const topCone = wasm.Manifold.cylinder(chamferH, outerR, innerR, 36, false).translate([
        0,
        0,
        bodyH,
      ]);
      handles.push(botCyl, topCone);
      envelope = botCyl.add(topCone);
    }
    handles.push(envelope);

    return hex.intersect(envelope);
  } finally {
    for (const h of handles) {
      h.delete();
    }
  }
}

/**
 * Genera una pieza roscada métrica ISO paramétrica de 60° (perno hexagonal `'bolt'`,
 * tuerca hexagonal `'nut'` o macho negativo `'hole'` para roscar otros sólidos),
 * apoyada sobre Y=0 y 100 % cerrada (watertight).
 *
 * @param options Parámetros métricos ISO de diámetro, paso, longitud y holgura.
 * @returns Malla `MeshData` lista para escena o booleana.
 */
export async function createMetricThread(
  options: ThreadOptions
): Promise<MeshData> {
  const wasm = await initManifoldEngine();

  const diameterMm = Math.max(2.0, options.diameterMm || 8);
  const pitchMm = Math.max(0.4, Math.min(options.pitchMm || 1.25, diameterMm * 0.45));
  const lengthMm = Math.max(2.0, options.lengthMm || 16);
  const clearance =
    options.kind === 'bolt' ? 0 : Math.max(0, options.clearanceMm ?? 0.25);

  // Profundidad normalizada del triángulo fundamental ISO de 60°: 5/8 * H
  const fundamentalH = (Math.sqrt(3) / 2) * pitchMm;
  const threadDepth = (5 / 8) * fundamentalH;

  const rMajor = diameterMm * 0.5 + clearance;
  const rMinor = Math.max(0.4, diameterMm * 0.5 - threadDepth + clearance);
  const hexRadius = (1.55 * diameterMm) / Math.sqrt(3);

  const handles: Manifold[] = [];

  try {
    let resultZ: Manifold;

    if (options.kind === 'hole') {
      resultZ = buildHelicalThreadSolidZ(wasm, rMinor, rMajor, pitchMm, lengthMm);
      handles.push(resultZ);
    } else if (options.kind === 'nut') {
      const hexBody = buildChamferedHexPrismZ(wasm, hexRadius, lengthMm, true);
      handles.push(hexBody);

      // Extendemos el cilindro roscado ±1 mm para perforar limpiamente ambas caras de la tuerca
      const threadTapRaw = buildHelicalThreadSolidZ(
        wasm,
        rMinor,
        rMajor,
        pitchMm,
        lengthMm + 2
      );
      handles.push(threadTapRaw);
      const threadTap = threadTapRaw.translate([0, 0, -1]);
      handles.push(threadTap);

      resultZ = hexBody.subtract(threadTap);
      handles.push(resultZ);
    } else {
      // 'bolt': vástago roscado con cabeza hexagonal opcional en la base
      const includeHead = options.includeHead !== false;
      if (!includeHead) {
        resultZ = buildHelicalThreadSolidZ(wasm, rMinor, rMajor, pitchMm, lengthMm);
        handles.push(resultZ);
      } else {
        const headH = Math.max(2.2, 0.65 * diameterMm);
        const hexHead = buildChamferedHexPrismZ(wasm, hexRadius, headH, false);
        handles.push(hexHead);

        const shaftRaw = buildHelicalThreadSolidZ(
          wasm,
          rMinor,
          rMajor,
          pitchMm,
          lengthMm + 0.5
        );
        handles.push(shaftRaw);
        const shaft = shaftRaw.translate([0, 0, headH - 0.5]);
        handles.push(shaft);

        resultZ = hexHead.add(shaft);
        handles.push(resultZ);
      }
    }

    const rotatedY = resultZ.rotate([-90, 0, 0]);
    handles.push(rotatedY);
    const mesh = manifoldToMeshData(rotatedY);
    return normalizeMeshToBed(mesh);
  } finally {
    for (const h of handles) {
      h.delete();
    }
  }
}

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
  const { grid, cols, rows } = sampleLuminanceGrid(options, 128);

  const arcDeg = Math.max(30, Math.min(360, options.arcDegrees ?? 180));
  const isFullCircle = arcDeg >= 359.9;
  const arcRad = (arcDeg * Math.PI) / 180;
  const rInner = Math.max(
    4,
    options.cylinderRadiusMm ?? Math.max(8, options.widthMm / Math.max(0.5, arcRad))
  );
  const heightMm = Math.max(4, options.depthMm || options.widthMm || 60);
  const baseMm = Math.max(0.6, options.baseThicknessMm || 1.2);
  const reliefMm = Math.max(0, options.reliefHeightMm ?? 2.4);

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
 * Extrae una silueta sólida (`silhouette`) o un cortador de galletas/arcilla con
 * pestaña de apoyo y cuchilla perimetral (`cutter`) a partir de una imagen RGBA.
 *
 * Convención de umbralización:
 * - Los píxeles transparentes (`alpha < 32`) siempre se consideran fondo vacío.
 * - Si `invert === false`, son sólidos los píxeles luminosos (`luminance >= threshold`).
 * - Si `invert === true`, son sólidos los píxeles oscuros (`luminance <= threshold`).
 *
 * @param options Parámetros de imagen RGBA, umbral, espesor base, altura y pared del cortador.
 * @returns Malla 3D cerrada (watertight) apoyada en Y=0.
 */
export async function generateSilhouetteOrCutterFromImage(
  options: ImageTo3DOptions
): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const srcW = Math.max(1, Math.floor(options.pixelWidth));
  const srcH = Math.max(1, Math.floor(options.pixelHeight));
  const maxGrid = 96;

  const cols = Math.max(2, Math.min(srcW, maxGrid));
  const rows = Math.max(2, Math.min(srcH, maxGrid));
  const threshold = Math.max(0, Math.min(255, options.threshold ?? 128));

  const widthMm = Math.max(2, options.widthMm || 50);
  const depthMm = Math.max(2, options.depthMm || 50);
  const pxW = widthMm / cols;
  const pxH = depthMm / rows;
  const overlap = Math.min(pxW, pxH) * 0.005;

  const rowRects: CrossSection[] = [];
  let rawUnion: CrossSection | null = null;
  let baseCs: CrossSection | null = null;
  let outerWallCs: CrossSection | null = null;
  let wallCs: CrossSection | null = null;
  let flangeOuterCs: CrossSection | null = null;
  let flangeCs: CrossSection | null = null;
  let wallManifold: Manifold | null = null;
  let flangeManifold: Manifold | null = null;
  let combinedZ: Manifold | null = null;
  let rotatedY: Manifold | null = null;

  try {
    // Agrupamos corridas horizontales (RLE) de píxeles activos en rectángulos 2D
    for (let r = 0; r < rows; r++) {
      const sy = Math.min(srcH - 1, Math.floor((r / (rows - 1)) * (srcH - 1)));
      let runStart = -1;

      const flushRun = (endCol: number): void => {
        if (runStart < 0) return;
        const x0 = runStart * pxW - overlap;
        const x1 = (endCol + 1) * pxW + overlap;
        const y0 = (rows - 1 - r) * pxH - overlap;
        const y1 = (rows - r) * pxH + overlap;
        rowRects.push(
          wasm.CrossSection.ofPolygons(
            [
              [
                [x0, y0],
                [x1, y0],
                [x1, y1],
                [x0, y1],
              ],
            ],
            'Positive'
          )
        );
        runStart = -1;
      };

      for (let c = 0; c < cols; c++) {
        const sx = Math.min(srcW - 1, Math.floor((c / (cols - 1)) * (srcW - 1)));
        const pIdx = (sy * srcW + sx) * 4;
        const red = options.rgba[pIdx] ?? 0;
        const green = options.rgba[pIdx + 1] ?? 0;
        const blue = options.rgba[pIdx + 2] ?? 0;
        const alpha = options.rgba[pIdx + 3] ?? 255;

        const lum = 0.299 * red + 0.587 * green + 0.114 * blue;
        const active =
          alpha >= 32 && (options.invert ? lum <= threshold : lum >= threshold);

        if (active) {
          if (runStart < 0) runStart = c;
        } else {
          flushRun(c - 1);
        }
      }
      flushRun(cols - 1);
    }

    if (rowRects.length === 0) {
      throw new Error(
        'No se detectaron píxeles activos en la imagen con el umbral especificado.'
      );
    }

    rawUnion =
      rowRects.length === 1 ? rowRects[0] : wasm.CrossSection.union(rowRects);
    baseCs = rawUnion.simplify(Math.min(pxW, pxH) * 0.25);

    if (baseCs.isEmpty()) {
      throw new Error('La silueta extraída de la imagen tiene área nula.');
    }

    const mode = options.shapeMode === 'cutter' ? 'cutter' : 'silhouette';
    if (mode === 'silhouette') {
      const totalH = Math.max(
        0.6,
        (options.baseThicknessMm || 2) + (options.reliefHeightMm || 2)
      );
      combinedZ = baseCs.extrude(totalH, 0, 0, [1, 1], false);
    } else {
      // Cortador de galletas / arcilla: pestaña exterior de agarre + cuchilla perimetral
      const wallW = Math.max(0.6, options.cutterWallMm ?? 1.2);
      const baseH = Math.max(0.6, options.baseThicknessMm || 2.0);
      const bladeH = Math.max(2.0, options.reliefHeightMm || 12.0);

      outerWallCs = baseCs.offset(wallW, 'Round');
      wallCs = outerWallCs.subtract(baseCs);

      flangeOuterCs = baseCs.offset(wallW + 3.0, 'Round');
      flangeCs = flangeOuterCs.subtract(baseCs);

      flangeManifold = flangeCs.extrude(baseH, 0, 0, [1, 1], false);
      wallManifold = wallCs.extrude(baseH + bladeH, 0, 0, [1, 1], false);
      combinedZ = flangeManifold.add(wallManifold);
    }

    rotatedY = combinedZ.rotate([-90, 0, 0]);
    const mesh = manifoldToMeshData(rotatedY);
    return normalizeMeshToBed(mesh);
  } finally {
    for (const r of rowRects) {
      r.delete();
    }
    if (rawUnion && !rowRects.includes(rawUnion)) {
      rawUnion.delete();
    }
    baseCs?.delete();
    outerWallCs?.delete();
    wallCs?.delete();
    flangeOuterCs?.delete();
    flangeCs?.delete();
    wallManifold?.delete();
    flangeManifold?.delete();
    combinedZ?.delete();
    rotatedY?.delete();
  }
}
