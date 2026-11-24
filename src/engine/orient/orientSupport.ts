/**
 * @file src/engine/orient/orientSupport.ts
 * @description Volumen APROXIMADO de soporte por proyección en grilla: en el marco ya orientado
 * (altura = coordenada `h`), cada triángulo en voladizo se rasteriza en una grilla horizontal por
 * centro de celda; la columna de cada celda baja desde el voladizo hasta la superficie más cercana
 * debajo (la propia pieza) o hasta la cama. Volumen = Σ largo × área de celda. El origen de la grilla
 * se desplaza una fracción irracional de celda para que ningún centro caiga sobre aristas compartidas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Marco orientado: x, h (altura), z por vértice, intercalados. */
export interface OrientedFrame {
  coords: Float64Array;
  indices: ArrayLike<number>;
  minX: number; maxX: number; minZ: number; maxZ: number; minH: number;
}

/** Recorre los centros de celda dentro del triángulo proyectado y entrega (celda, altura interpolada). */
function rasterize(
  f: OrientedFrame, t: number, cell: number, x0: number, z0: number, nx: number, nz: number,
  visit: (cellIndex: number, h: number) => void,
): void {
  const c = f.coords, idx = f.indices;
  const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, d = idx[t * 3 + 2] * 3;
  const ax = c[a], ah = c[a + 1], az = c[a + 2];
  const bx = c[b], bh = c[b + 1], bz = c[b + 2];
  const cx = c[d], ch = c[d + 1], cz = c[d + 2];
  const area = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  if (Math.abs(area) < 1e-12) return;
  const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - x0) / cell - 0.5));
  const i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - x0) / cell - 0.5));
  const k0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - z0) / cell - 0.5));
  const k1 = Math.min(nz - 1, Math.floor((Math.max(az, bz, cz) - z0) / cell - 0.5));
  const inv = 1 / area;
  for (let k = k0; k <= k1; k++) {
    const pz = z0 + (k + 0.5) * cell;
    for (let i = i0; i <= i1; i++) {
      const px = x0 + (i + 0.5) * cell;
      const w0 = ((bx - px) * (cz - pz) - (bz - pz) * (cx - px)) * inv;
      const w1 = ((cx - px) * (az - pz) - (cz - pz) * (ax - px)) * inv;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      visit(k * nx + i, w0 * ah + w1 * bh + w2 * ch);
    }
  }
}

/**
 * Volumen de soporte (mm³) bajo los triángulos marcados en `overhang`. `cells` = celdas por lado del
 * lado mayor de la huella. Devuelve también el tamaño de celda usado.
 */
export function supportVolume(f: OrientedFrame, overhang: Uint8Array, cells: number): { volumeMm3: number; cellMm: number } {
  const span = Math.max(f.maxX - f.minX, f.maxZ - f.minZ);
  const cell = Math.max(span / Math.max(8, cells), 1e-3);
  const x0 = f.minX - cell * 0.31830988618, z0 = f.minZ - cell * 0.31830988618;
  const nx = Math.ceil((f.maxX - x0) / cell) + 1, nz = Math.ceil((f.maxZ - z0) / cell) + 1;
  const triCount = overhang.length;

  // Fase 1: alturas de voladizo por celda.
  const ohCell: number[] = [], ohH: number[] = [];
  const mask = new Uint8Array(nx * nz);
  for (let t = 0; t < triCount; t++) {
    if (!overhang[t]) continue;
    rasterize(f, t, cell, x0, z0, nx, nz, (ci, h) => { ohCell.push(ci); ohH.push(h); mask[ci] = 1; });
  }
  if (ohCell.length === 0) return { volumeMm3: 0, cellMm: cell };

  // Fase 2: la superficie más alta bajo cada voladizo (solo celdas marcadas). Se guardan todas las
  // alturas de esas celdas y se resuelve por celda.
  const hits = new Map<number, number[]>();
  for (let t = 0; t < triCount; t++) {
    rasterize(f, t, cell, x0, z0, nx, nz, (ci, h) => {
      if (!mask[ci]) return;
      const list = hits.get(ci);
      if (list) list.push(h); else hits.set(ci, [h]);
    });
  }
  const eps = Math.max(1e-6, cell * 1e-3);
  let volume = 0;
  for (let r = 0; r < ohCell.length; r++) {
    const top = ohH[r];
    let below = f.minH;
    for (const h of hits.get(ohCell[r]) ?? []) if (h < top - eps && h > below) below = h;
    volume += top - below;
  }
  return { volumeMm3: volume * cell * cell, cellMm: cell };
}
