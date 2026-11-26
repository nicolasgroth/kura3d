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
  | { mode: 'tolerance'; toleranceMm: number; allowDestructive?: boolean }
  | { mode: 'target'; targetTriangles?: number; targetPercent?: number; allowDestructive?: boolean };

/**
 * Por qué un resultado es destructivo (no se aplica sin `allowDestructive`):
 * - `holes_lost`: se cerró algún agujero pasante (el género bajó) y la desviación supera
 *   `SIMPLIFY_HOLE_LOSS_MIN_DEVIATION_MM` (si no, eran túneles que no se imprimen: solo se avisa);
 * - `volume_changed`: |ΔV| supera `SIMPLIFY_DESTRUCTIVE_LIMITS.volumePct`;
 * - `deviation_high`: la desviación supera el tope relativo al tamaño de la pieza.
 */
export type SimplifyDestructiveReason = 'holes_lost' | 'volume_changed' | 'deviation_high';

export const SIMPLIFY_DESTRUCTIVE_REASONS: readonly SimplifyDestructiveReason[] = ['holes_lost', 'volume_changed', 'deviation_high'];

/** Alternativa segura: el candidato con menos triángulos que no es destructivo (se aplica con «Por tolerancia»). */
export interface SimplifySafeAlternative {
  /** Tolerancia en mm de mundo que la reproduce (≥ el mínimo de «Por tolerancia»). */
  toleranceMm: number;
  triangles: number;
  volumeAfterMm3: number;
  volumeChangePct: number;
  genusAfter: number;
  maxDeviationMm: number;
}

/**
 * Tope de lo «destructivo» (criterio delegado por el autor, 25-nov-2026). Sobre esto el resultado no se aplica en
 * silencio: se ofrece la alternativa segura y, aparte, aplicarlo igual.
 * - `volumePct` 5 %: diez veces el umbral de aviso (0,5 %); los casos medidos que destruyen la pieza (placa de 3 mm
 *   que queda de 1 mm, −66,6 %; toro al 2 %, −99,4 %) están muy por encima, y una esfera de 64 lados a 2 mm de
 *   tolerancia (deformación visible pero reconocible) queda en el orden de 1–3 %.
 * - Desviación: el mayor de `deviationMinMm` (1 mm, unas 5 capas de 0,2 mm: deja de ser la misma pieza al
 *   ensamblar) y `deviationRelDiag` (1 % de la diagonal de la caja: en una pieza de 300 mm, 1 mm es ruido).
 * - `safeSearchIterations`: llamadas a `simplify` de la bisección que busca la alternativa segura (la razón entre
 *   la tolerancia mínima y la destructiva suele ser ≤ 10⁴: 8 pasos la acotan a ~±8 %).
 */
/**
 * Perder agujeros pasantes (`holes_lost`) es destructivo solo si la desviación medida supera este valor (mm de
 * mundo). Por debajo los túneles que se cerraron eran más finos que lo que una impresora FDM resuelve (boquilla de
 * 0,4 mm: un túnel de ~0,2 mm no se imprime abierto), así que se aplica y se avisa con `genus_changed`.
 * Caso que lo motivó: figura real de 478 mil triángulos y género 58 al 50 %: género 58 → 56 con −0,07 % de volumen
 * y 0,11 mm de desviación quedaba bloqueada sin versión segura. Propuesta pendiente de confirmación del autor:
 * cambiar aquí si decide otro valor.
 */
export const SIMPLIFY_HOLE_LOSS_MIN_DEVIATION_MM = 0.2;

/**
 * Reducción mínima (fracción de los triángulos de partida) para ofrecer una «versión segura». Bajo esto no sirve:
 * en tinker reparado al 50 % la única segura bajaba 1,1 % (183 306 → 181 348) y ofrecerla como alternativa confunde.
 * Sin una segura útil se dice «no hay una reducción segura para esta pieza» y queda solo «Aplicar de todos modos».
 */
export const SIMPLIFY_SAFE_MIN_REDUCTION_REL = 0.1;

export const SIMPLIFY_DESTRUCTIVE_LIMITS = {
  volumePct: 5,
  deviationMinMm: 1,
  deviationRelDiag: 0.01,
  safeSearchIterations: 8,
} as const;

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
/** `genus`: se quedó sobre el objetivo para no perder agujeros pasantes. */
export type SimplifyTargetStop = 'reached' | 'iterations' | 'time' | 'range' | 'genus';

export interface SimplifyTargetInfo {
  /** Triángulos pedidos (si llegó un %, ya convertido). */
  triangles: number;
  /** true si el resultado quedó en el objetivo o por debajo. */
  reached: boolean;
  /** Llamadas a `simplify` hechas en la búsqueda. */
  iterations: number;
  stoppedBy: SimplifyTargetStop;
  /**
   * true si se eligió un candidato que conserva los agujeros pasantes en vez del más cercano al objetivo (que
   * los perdía); queda dentro de `genusSlackRel` sobre el objetivo.
   */
  genusPreserved?: boolean;
}

/** Informe antes → después. Volúmenes en mm³ locales (la escala no cambia el %); desviación en mm de mundo. */
export interface SimplifyReport {
  mode: SimplifyMode;
  /** Objeto al que corresponde (lo agrega la app; el motor no lo conoce). */
  objectId?: string;
  /** false si no se aplicó (sin reducción, «Sin pérdida» rechazado o resultado destructivo): el objeto queda intacto. */
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
  /**
   * Motivos por los que el resultado calculado es destructivo (vacío si no lo es). Si no viene `allowDestructive`,
   * un resultado destructivo no se aplica (`applied: false`).
   */
  destructive?: SimplifyDestructiveReason[];
  /** Tope de desviación destructiva para esta pieza (mm de mundo); viene junto con `destructive` no vacío. */
  destructiveLimitMm?: number;
  /** Solo si `destructive` no está vacío: la mejor alternativa segura hallada, o null si no hay ninguna. */
  safe?: SimplifySafeAlternative | null;
  /** true si se aplicó un resultado destructivo porque se pidió `allowDestructive`. */
  forced?: boolean;
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
 * - `genusSlackRel` 25 %: en «Por cantidad», si el resultado más cercano pierde agujeros pasantes, se prefiere el
 *   mejor que los conserva con hasta 25 % más triángulos que el objetivo (la forma manda sobre el número); se
 *   buscan hasta `genusExtraIterations` tolerancias más en el borde donde cambia el género.
 */
export const SIMPLIFY_WARN_LIMITS = {
  volumePct: 0.5,
  deviationMm: 0.1,
  maxDeviationSamples: 25_000,
  targetMaxIterations: 16,
  targetMaxMs: 30_000,
  targetSlackRel: 0.02,
  genusSlackRel: 0.25,
  genusExtraIterations: 6,
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
