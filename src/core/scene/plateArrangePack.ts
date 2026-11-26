/**
 * @file src/core/scene/plateArrangePack.ts
 * @description Empaquetado rectangular 2D de «Repartir en placas»: un contenedor MaxRects (J. Jylänki, «A Thousand
 * Ways to Pack the Bin», 2010) con la heurística «Best Short Side Fit» y desempates fijos (sobra larga, luego Z, luego
 * X), así el resultado es determinista. Sin giros: la orientación de las piezas no se toca. Admite obstáculos (piezas
 * que ya están en la placa) restándolos de los rectángulos libres. Coordenadas locales desde (0, 0) hasta (ancho,
 * fondo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export interface PackedRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

const EPS = 1e-9;

const contains = (a: PackedRect, b: PackedRect) =>
  b.x >= a.x - EPS && b.z >= a.z - EPS && b.x + b.w <= a.x + a.w + EPS && b.z + b.d <= a.z + a.d + EPS;

const intersects = (a: PackedRect, b: PackedRect) =>
  a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.z < b.z + b.d - EPS && b.z < a.z + a.d - EPS;

/** Contenedor MaxRects de ancho X por fondo Z. */
export class MaxRectsBin {
  private free: PackedRect[];

  constructor(readonly width: number, readonly depth: number) {
    this.free = width > EPS && depth > EPS ? [{ x: 0, z: 0, w: width, d: depth }] : [];
  }

  /** true si un rectángulo de esa medida cabe en el contenedor vacío. */
  static fitsEmpty(width: number, depth: number, w: number, d: number): boolean {
    return w <= width + EPS && d <= depth + EPS;
  }

  /** Esquina mínima donde quedaría el rectángulo, o null si no cabe (no cambia el contenedor). */
  find(w: number, d: number): { x: number; z: number } | null {
    let best: PackedRect | null = null;
    let bestShort = Infinity;
    let bestLong = Infinity;
    for (const f of this.free) {
      if (w > f.w + EPS || d > f.d + EPS) continue;
      const short = Math.min(f.w - w, f.d - d);
      const long = Math.max(f.w - w, f.d - d);
      const better = short < bestShort - EPS
        || (Math.abs(short - bestShort) <= EPS && (long < bestLong - EPS
          || (Math.abs(long - bestLong) <= EPS && best !== null && (f.z < best.z - EPS || (Math.abs(f.z - best.z) <= EPS && f.x < best.x - EPS)))));
      if (best === null || better) {
        best = f;
        bestShort = short;
        bestLong = long;
      }
    }
    return best ? { x: best.x, z: best.z } : null;
  }

  /** Coloca el rectángulo y devuelve su esquina mínima, o null si no cabe. */
  insert(w: number, d: number): { x: number; z: number } | null {
    const at = this.find(w, d);
    if (at) this.occupy({ x: at.x, z: at.z, w, d });
    return at;
  }

  /** Marca ocupado un rectángulo (pieza colocada u obstáculo); lo que cae fuera del contenedor se ignora. */
  occupy(used: PackedRect): void {
    const next: PackedRect[] = [];
    for (const f of this.free) {
      if (!intersects(f, used)) {
        next.push(f);
        continue;
      }
      // Hasta cuatro rectángulos máximos que quedan alrededor del usado.
      if (used.x > f.x + EPS) next.push({ x: f.x, z: f.z, w: used.x - f.x, d: f.d });
      if (used.x + used.w < f.x + f.w - EPS) next.push({ x: used.x + used.w, z: f.z, w: f.x + f.w - used.x - used.w, d: f.d });
      if (used.z > f.z + EPS) next.push({ x: f.x, z: f.z, w: f.w, d: used.z - f.z });
      if (used.z + used.d < f.z + f.d - EPS) next.push({ x: f.x, z: used.z + used.d, w: f.w, d: f.z + f.d - used.z - used.d });
    }
    // Poda: fuera los rectángulos contenidos en otro (el primero gana si son iguales: orden estable).
    this.free = next.filter((r, i) => !next.some((o, j) => j !== i && contains(o, r) && (!contains(r, o) || j < i)));
  }
}
