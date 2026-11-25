/**
 * @file src/engine/simplify/simplifyTypes.ts
 * @description Tipos y umbrales de Simplificar con verificación: los tres modos («Sin pérdida», «Por
 * tolerancia», «Por cantidad»), el informe antes → después, los códigos de aviso tipados y las constantes con
 * nombre, justificadas con la medición del 25-nov-2026 (`docs/diseno/FORMAS_SIMPLES.md`, «Medición»).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Modo de Simplificar. */
export type SimplifyMode = 'lossless' | 'tolerance' | 'target';

export const SIMPLIFY_MODES: readonly SimplifyMode[] = ['lossless', 'tolerance', 'target'];

/** Petición serializable (cruza al Worker). En «Por cantidad» va `targetTriangles` o `targetPercent`. */
export type SimplifyRequest =
  | { mode: 'lossless' }
  | { mode: 'tolerance'; toleranceMm: number }
  | { mode: 'target'; targetTriangles?: number; targetPercent?: number };

/**
 * Avisos del informe (la interfaz los traduce con `simplify.warn.<código>`):
 * - `genus_changed`: se abrió o cerró un agujero (cambió la forma);
 * - `volume_changed`: el volumen cambió más que el umbral;
 * - `deviation_high`: la superficie se movió más que el umbral (muestreado);
 * - `target_not_reached`: «Por cantidad» no llegó al objetivo (se entrega lo logrado);
 * - `no_reduction`: no hubo triángulos que quitar (no se aplica).
 */
export type SimplifyWarningCode = 'genus_changed' | 'volume_changed' | 'deviation_high' | 'target_not_reached' | 'no_reduction';

export const SIMPLIFY_WARNING_CODES: readonly SimplifyWarningCode[] = [
  'genus_changed', 'volume_changed', 'deviation_high', 'target_not_reached', 'no_reduction',
];

/** Por qué terminó la búsqueda de «Por cantidad». */
export type SimplifyTargetStop = 'reached' | 'iterations' | 'time' | 'range';

export interface SimplifyTargetInfo {
  /** Triángulos pedidos (si llegó un %, ya convertido). */
  triangles: number;
  /** true si el resultado quedó en el objetivo o por debajo. */
  reached: boolean;
  /** Llamadas a `simplify` hechas en la búsqueda. */
  iterations: number;
  stoppedBy: SimplifyTargetStop;
}

/** Informe antes → después. Volúmenes en mm³ locales (la escala no cambia el %); desviación en mm de mundo. */
export interface SimplifyReport {
  mode: SimplifyMode;
  /** false si no se aplicó (sin reducción o «Sin pérdida» rechazado): el objeto queda intacto. */
  applied: boolean;
  /** Tolerancia usada en mm de mundo (en «Por cantidad», la hallada por la búsqueda). */
  toleranceMm: number;
  trianglesBefore: number;
  /** Triángulos del resultado calculado (aunque no se aplique). */
  trianglesAfter: number;
  volumeBeforeMm3: number;
  volumeAfterMm3: number;
  /** Cambio de volumen en % (positivo = creció). */
  volumeChangePct: number;
  genusBefore: number;
  genusAfter: number;
  /** Desviación máxima muestreada (cota inferior del máximo real), en mm de mundo. */
  maxDeviationMm: number;
  /** Puntos medidos para la desviación. */
  deviationSamples: number;
  warnings: SimplifyWarningCode[];
  /** Solo «Sin pérdida»: verificaciones que fallaron (vacío si pasó). */
  rejectedBy: SimplifyWarningCode[];
  /** Solo «Por cantidad». */
  target?: SimplifyTargetInfo;
  /** Duración total en ms (simplificar + verificar). */
  ms: number;
}

/**
 * «Sin pérdida»: simplifica a 0,001 mm y acepta solo si el género no cambia, |ΔV| < `maxVolumePct` y la
 * desviación muestreada < `maxDeviationMm`.
 * - 0,001 mm: a esta tolerancia la medición dejó la cota de lo plano en ≤ 0,13 % (las caras coplanares quedan
 *   limpias) sin perder forma visible; es la menor que se midió.
 * - 0,01 %: el recomendado por la medición; a 0,001 mm los cambios medidos están en ese orden o por debajo.
 * - 0,01 mm: en la sonda sobre el casco a 0,001 mm el peor centroide se movió 0,009 mm solo por cambios de
 *   diagonal; 0,01 mm lo admite y sigue diez veces bajo una capa de 0,1 mm. Es también la menor tolerancia del
 *   modo «Por tolerancia».
 * El género sí se exige igual: la medición mostró cambios de género ya a 0,001 mm en 2 modelos.
 */
export const LOSSLESS_LIMITS = {
  toleranceMm: 0.001,
  maxVolumePct: 0.01,
  maxDeviationMm: 0.01,
} as const;

export type LosslessLimits = { maxVolumePct: number; maxDeviationMm: number };

/**
 * Avisos de cualquier modo y topes de trabajo.
 * - `volumePct` 0,5 %: a 0,01 mm el peor modelo cambió 0,23 %; a 0,1 mm se llegó a −2,8 % con cilindros y texto
 *   achatados. Sobre 0,5 % el cambio ya no es del régimen «fiel».
 * - `deviationMm` 0,1 mm: el orden de una capa o de la precisión de una impresora FDM; a 0,1 mm de tolerancia
 *   las desviaciones medidas fueron 0,09–1,48 mm (deformación visible).
 * - `maxDeviationSamples`: vértices y centroides por sentido (el total es hasta 4×); la medición usó 150 000 y
 *   aquí se baja para que medir no cueste más que simplificar en mallas de millones.
 * - Búsqueda por cantidad: hasta 16 llamadas a `simplify` o 30 s; se acepta quedar hasta 2 % bajo el objetivo.
 */
export const SIMPLIFY_WARN_LIMITS = {
  volumePct: 0.5,
  deviationMm: 0.1,
  maxDeviationSamples: 25_000,
  targetMaxIterations: 16,
  targetMaxMs: 30_000,
  targetSlackRel: 0.02,
} as const;

/** Opciones de ejecución (no cruzan al Worker: allí cancelar termina el Worker). */
export interface SimplifyRunOptions {
  signal?: AbortSignal;
  /** Avance legible por máquina: `simplify:<paso>/<máximo>`. */
  onProgress?: (phase: string) => void;
  /** Solo pruebas: umbrales de «Sin pérdida». */
  losslessLimits?: LosslessLimits;
  /** Solo pruebas: reloj. */
  now?: () => number;
}
