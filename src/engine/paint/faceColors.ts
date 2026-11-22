/**
 * @file src/engine/paint/faceColors.ts
 * @description Capa de acceso a los colores por cara de una malla: lectura con color base, escritor
 * con copia diferida (no copia nada si ningún color cambia) y conversión a paleta compacta
 * (`Uint16Array` de índices + `string[]`) para consumidores que quieran evitar un string por cara.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';

/** Color de las caras sin pintar cuando quien llama no indica el color base del objeto. */
export const DEFAULT_UNPAINTED_COLOR = '#94a3b8';

export const triangleCount = (mesh: Pick<MeshData, 'indices'>): number => Math.floor(mesh.indices.length / 3);

/** La malla tiene un color por cara válido (longitud = triángulos). */
export function hasFaceColors(mesh: MeshData): boolean {
  return Boolean(mesh.faceColors && mesh.faceColors.length === triangleCount(mesh));
}

/** Color efectivo de la cara `t` (el base si la malla no está pintada). */
export function faceColorAt(mesh: MeshData, t: number, baseHex: string): string {
  return hasFaceColors(mesh) ? (mesh.faceColors![t] ?? baseHex) : baseHex;
}

/**
 * Escritor de colores por cara con copia diferida: la primera escritura que cambia un color copia
 * (o crea) el arreglo; si nada cambia, `result()` es `null` y quien llama devuelve la misma malla.
 */
export class FaceColorWriter {
  private readonly source: readonly string[] | null;
  private copy: string[] | null = null;

  constructor(
    mesh: MeshData,
    private readonly baseHex: string,
  ) {
    this.source = hasFaceColors(mesh) ? mesh.faceColors! : null;
    this.count = triangleCount(mesh);
  }

  private readonly count: number;

  get(t: number): string {
    if (this.copy) return this.copy[t];
    return this.source ? this.source[t] : this.baseHex;
  }

  /** Asigna `hex` (ya normalizado) a la cara `t`; devuelve si cambió. */
  set(t: number, hex: string): boolean {
    if (this.get(t) === hex) return false;
    if (!this.copy) {
      this.copy = this.source ? this.source.slice() : new Array<string>(this.count).fill(this.baseHex);
    }
    this.copy[t] = hex;
    return true;
  }

  /** Arreglo nuevo si hubo cambios; `null` si no. */
  result(): string[] | null {
    return this.copy;
  }
}

/** Malla con nuevos colores (comparte posiciones, índices y normales) o la misma si no cambió nada. */
export function withFaceColors(mesh: MeshData, colors: string[] | null): MeshData {
  return colors ? { ...mesh, faceColors: colors } : mesh;
}

/** Paleta compacta: índices por cara + colores únicos. Hasta 65 535 colores distintos. */
export interface FaceColorPalette {
  palette: string[];
  indices: Uint16Array;
}

export function toFaceColorPalette(mesh: MeshData, baseHex: string): FaceColorPalette {
  const n = triangleCount(mesh);
  const palette: string[] = [];
  const lookup = new Map<string, number>();
  const indices = new Uint16Array(n);
  for (let t = 0; t < n; t++) {
    const hex = faceColorAt(mesh, t, baseHex);
    let id = lookup.get(hex);
    if (id === undefined) {
      id = palette.length;
      if (id > 0xffff) throw new RangeError('too many face colors');
      palette.push(hex);
      lookup.set(hex, id);
    }
    indices[t] = id;
  }
  return { palette, indices };
}

export function fromFaceColorPalette({ palette, indices }: FaceColorPalette): string[] {
  return Array.from(indices, (i) => palette[i]);
}
