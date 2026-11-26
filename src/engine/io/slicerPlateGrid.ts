/**
 * @file src/engine/io/slicerPlateGrid.ts
 * @description Rejilla de placas de los laminadores derivados de Bambu Studio / OrcaSlicer (Elegoo Slicer, Snapmaker
 * Orca…): en su 3MF de proyecto todas las placas comparten un solo espacio de coordenadas, con el origen en la
 * esquina de la cama de la placa 1 y cada placa siguiente desplazada en una rejilla.
 *
 * Hechos observados en archivos reales de Elegoo Slicer 1.5 (cama de 256 × 256): la placa 1 ocupa X 0..256 e Y 0..256;
 * la 2 está desplazada +307,2 en X (1,2 × 256); con 3 placas la 3 va en la segunda fila, desplazada −307,2 en Y.
 * Supuesto (no observado): columnas = techo(raíz(N)) para cualquier N, y en una cama rectangular el paso en X sigue el
 * ancho y el paso en Y el fondo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Cama que el laminador supone para todas las placas (la del proyecto), en mm. */
export interface SlicerBed {
  widthMm: number;
  depthMm: number;
}

/** Separación entre placas como fracción del lado de la cama (paso = 1,2 × lado). */
export const SLICER_PLATE_STRIDE = 1.2;

/** Columnas de la rejilla para `count` placas: techo(raíz(N)), al menos 1. */
export function slicerPlateColumns(count: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(Math.max(1, count))));
}

/** Esquina [X, Y] (mm, Z arriba, coordenadas del archivo) de la cama de la placa `index` (desde 0) de `count`. */
export function slicerPlateCorner(index: number, count: number, bed: SlicerBed): [number, number] {
  const cols = slicerPlateColumns(count);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = col * SLICER_PLATE_STRIDE * bed.widthMm;
  const y = -row * SLICER_PLATE_STRIDE * bed.depthMm;
  return [x === 0 ? 0 : x, y === 0 ? 0 : y];
}

/**
 * Traslación [X, Y] (mm, coordenadas del archivo) que lleva una pieza medida desde el centro de su cama (como la
 * exporta Kurra Studio) a su lugar en la placa `index` del laminador: esquina de la celda + medio lado de la cama.
 */
export function slicerPlateShift(index: number, count: number, bed: SlicerBed): [number, number] {
  const [x, y] = slicerPlateCorner(index, count, bed);
  return [x + bed.widthMm / 2, y + bed.depthMm / 2];
}

/** true si la cama sirve para la rejilla: lados finitos y positivos. */
export function validSlicerBed(bed: SlicerBed | undefined): bed is SlicerBed {
  return !!bed && Number.isFinite(bed.widthMm) && Number.isFinite(bed.depthMm) && bed.widthMm > 0 && bed.depthMm > 0;
}
