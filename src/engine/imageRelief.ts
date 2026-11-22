/**
 * @file src/engine/imageRelief.ts
 * @description Relieve y litofanía watertight desde una imagen RGBA: muestreo de luminancia,
 * suavizado opcional y malla cerrada con base plana y paredes cosidas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ImageTo3DOptions, MeshData } from '../types/kura';
import { computeVertexNormals } from './manifoldKernel';
import { validateImageBuffer } from './imageInput';
/**
 * Genera una malla 3D sólida, completamente cerrada (watertight) y libre de T-junctions
 * a partir de una imagen RGBA (modo relieve o litofanía invertida), descansando sobre Y=0.
 *
 * @param options Parámetros físicos, buffer RGBA y nivel de suavizado.
 * @returns Malla sólida `MeshData` con base plana y paredes laterales cosidas.
 */
export function generateReliefFromImage(options: ImageTo3DOptions): MeshData {
  // Rechaza buffers incoherentes (antes se leían ceros fuera de rango sin aviso)
  const { w: srcW, h: srcH } = validateImageBuffer(options);
  const maxGrid = 220;

  const cols = Math.max(2, Math.min(srcW, maxGrid));
  const rows = Math.max(2, Math.min(srcH, maxGrid));

  // Muestreo de luminancia normalizada [0..1]
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

  // Pasadas deterministas de suavizado 3x3 si se solicita
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

  const widthMm = Math.max(1, options.widthMm);
  const depthMm = Math.max(1, options.depthMm);
  const baseMm = Math.max(0.4, options.baseThicknessMm);
  const reliefMm = Math.max(0, options.reliefHeightMm);

  const positions: number[] = [];
  const indices: number[] = [];

  // 1) Vértices de la superficie superior (índices 0 .. cols*rows - 1)
  for (let r = 0; r < rows; r++) {
    const z = -depthMm * 0.5 + (r / (rows - 1)) * depthMm;
    for (let c = 0; c < cols; c++) {
      const x = -widthMm * 0.5 + (c / (cols - 1)) * widthMm;
      const y = baseMm + grid[r * cols + c] * reliefMm;
      positions.push(x, y, z);
    }
  }

  // Triángulos de la superficie superior (normal saliente +Y)
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const tl = r * cols + c;
      const tr = tl + 1;
      const bl = (r + 1) * cols + c;
      const br = bl + 1;
      indices.push(tl, bl, br);
      indices.push(tl, br, tr);
    }
  }

  // 2) Anillo perimetral en sentido horario visto desde +Y para coser paredes y base
  const topPerimeter: number[] = [];
  for (let c = 0; c < cols; c++) topPerimeter.push(c); // Borde superior (r=0)
  for (let r = 1; r < rows; r++) topPerimeter.push(r * cols + (cols - 1)); // Borde derecho
  for (let c = cols - 2; c >= 0; c--) topPerimeter.push((rows - 1) * cols + c); // Borde inferior
  for (let r = rows - 2; r >= 1; r--) topPerimeter.push(r * cols); // Borde izquierdo

  // Vértices perimetrales inferiores a Y=0 emparejados 1-a-1 con el perímetro superior
  const botPerimeter: number[] = [];
  for (const topIdx of topPerimeter) {
    const botIdx = positions.length / 3;
    positions.push(positions[topIdx * 3], 0, positions[topIdx * 3 + 2]);
    botPerimeter.push(botIdx);
  }

  // Vértice central inferior para triangular toda la base sin T-junctions
  const botCenterIdx = positions.length / 3;
  positions.push(0, 0, 0);

  const perimCount = topPerimeter.length;
  for (let k = 0; k < perimCount; k++) {
    const next = (k + 1) % perimCount;
    const t0 = topPerimeter[k];
    const t1 = topPerimeter[next];
    const b0 = botPerimeter[k];
    const b1 = botPerimeter[next];

    // Pared lateral con normal hacia afuera
    indices.push(t0, t1, b0);
    indices.push(t1, b1, b0);

    // Tapa inferior con normal hacia -Y
    indices.push(botCenterIdx, b0, b1);
  }

  const posArr = new Float32Array(positions);
  const idxArr = new Uint32Array(indices);
  const normals = computeVertexNormals(posArr, idxArr);

  return {
    positions: posArr,
    indices: idxArr,
    normals,
  };
}
