/**
 * @file src/engine/simplify/simplifyTypes.ts
 * @description Tipos y umbrales de Simplificar con verificación: los tres modos («Sin pérdida», «Por
 * tolerancia», «Por cantidad»), el informe antes → después, los códigos de aviso tipados y las constantes con
 * nombre, justificadas con la medición del 25-nov-2026 (`docs/diseno/FORMAS_SIMPLES.md`, «Medición»).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Modo de Simplificar. */
export type SimplifyMode = 'lossless' | 'tolerance' | 'target';

export const SIMPLIFY_MODES: readonly SimplifyMode[] = ['lossless', 'tolerance', 'target'];

/**
 * Qué hacer si lo pedido es destructivo (no aplica a «Sin pérdida»):
 * - `safe` (por defecto, `SIMPLIFY_DEFAULT_ON_DESTRUCTIVE`): aplicar la versión segura útil si existe; si no, no aplicar;
 * - `block`: no aplicar nada (solo el informe con la segura y lo pedido);
 * - `force`: aplicar lo pedido igual (`allowDestructive: true` es su alias).
 */
export type SimplifyOnDestructive = 'safe' | 'block' | 'force';

export const SIMPLIFY_ON_DESTRUCTIVE: readonly SimplifyOnDestructive[] = ['safe', 'block', 'force'];

/** Decisión del orquestador (25-nov-2026): pedir «50 %» a una primitiva gruesa aplica la versión segura, sin bloqueo. */
export const SIMPLIFY_DEFAULT_ON_DESTRUCTIVE: SimplifyOnDestructive = 'safe';

interface DestructiveChoice {
  onDestructive?: SimplifyOnDestructive;
  /** Alias de `onDestructive: 'force'` (compatibilidad). */
  allowDestructive?: boolean;
}

/** Petición serializable (cruza al Worker). En «Por cantidad» va `targetTriangles` o `targetPercent`. */
export type SimplifyRequest =
  | { mode: 'lossless' }
  | ({ mode: 'tolerance'; toleranceMm: number } & DestructiveChoice)
  | ({ mode: 'target'; targetTriangles?: number; targetPercent?: number } & DestructiveChoice);

/** Qué se aplicó: lo pedido, la versión segura en su lugar, o nada. */
export type SimplifyAppliedVariant = 'requested' | 'safe' | 'none';

/** Política efectiva de una petición (`allowDestructive` manda como `force`). */
export function onDestructiveOf(request: SimplifyRequest): SimplifyOnDestructive {
  if (request.mode === 'lossless') return 'block';
  if (request.allowDestructive === true) return 'force';
  return request.onDestructive ?? SIMPLIFY_DEFAULT_ON_DESTRUCTIVE;
}

/** Medidas del resultado pedido cuando era destructivo y se aplicó la segura (o nada) en su lugar. */
export interface SimplifyRequestedResult {
  /** Tolerancia en mm de mundo que lo reproduce. */
  toleranceMm: number;
  triangles: number;
  volumeAfterMm3: number;
  volumeChangePct: number;
  genusAfter: number;
  maxDeviationMm: number;
}

/**
 * Por qué un resultado es destructivo (no se aplica sin `allowDestructive`):
 * - `holes_lost`: se cerró algún agujero pasante (el género bajó) y la desviación supera
 *   `SIMPLIFY_HOLE_LOSS_MIN_DEVIATION_MM` (si no, eran túneles que no se imprimen: solo se avisa);
 * - `volume_changed`: |ΔV| supera `SIMPLIFY_DESTRUCTIVE_LIMITS.volumePct`;
 * - `deviation_high`: la desviación supera `SIMPLIFY_DESTRUCTIVE_LIMITS.deviationRelMinSide` del lado menor de la caja;
 * - `too_few_triangles`: quedan menos triángulos que `simplifyMinTriangles(género del resultado)`.
 */
export type SimplifyDestructiveReason = 'holes_lost' | 'volume_changed' | 'deviation_high' | 'too_few_triangles';

export const SIMPLIFY_DESTRUCTIVE_REASONS: readonly SimplifyDestructiveReason[] = ['holes_lost', 'volume_changed', 'deviation_high', 'too_few_triangles'];

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

/**
 * Simplificar tiene DOS niveles (decisión del orquestador, 26-nov-2026, QA 25-h): en «Por cantidad» y «Por
 * tolerancia», pedir pocos triángulos a una malla gruesa cambia la forma de manera visible y eso es lo que el usuario
 * pidió. Eso solo se AVISA (`SIMPLIFY_NOTICE_LIMITS`); lo que se BLOQUEA (o se cambia por la versión segura) es lo que
 * estropea la pieza (`SIMPLIFY_DESTRUCTIVE_LIMITS`).
 *
 * Aviso (se aplica lo pedido y el informe lo advierte con `volume_changed` / `deviation_high`):
 * - `volumePct` 5 %: una esfera de 64 lados a 2 mm de tolerancia (deformación visible pero reconocible) queda en
 *   1–3 %; sobre 5 % el cambio ya se nota en la pieza impresa.
 * - Desviación: el mayor de `deviationMinMm` (1 mm, unas 5 capas de 0,2 mm) y `deviationRelDiag` (1 % de la
 *   diagonal de la caja: en una pieza de 300 mm, 1 mm es ruido).
 */
export const SIMPLIFY_NOTICE_LIMITS = {
  volumePct: 5,
  deviationMinMm: 1,
  deviationRelDiag: 0.01,
} as const;

/**
 * Destructivo (no se aplica lo pedido: versión segura útil o bloqueo, según `onDestructive`). Medido el 26-nov-2026
 * con el motor real (`simplifyDestructive.test.ts`), «desv./lado menor» = desviación sobre el menor lado de la caja:
 *
 * | pieza                        | pedido   | volumen | desviación | desv./lado menor | resultado          |
 * |------------------------------|----------|---------|------------|------------------|--------------------|
 * | esfera r25 (512)             | 50 %     | −5,4 %  | 1,70 mm    | 3,4 %            | se aplica con aviso |
 * | esfera r25 (512)             | 25 %     | −15 %   | 2,94 mm    | 5,9 %            | se aplica con aviso |
 * | cilindro r20 h40 (QA)        | 25 %     | −16 %   | 4,4 mm     | 11 %             | se aplica con aviso |
 * | toro 14/4 (3456)             | 25 %     | −2,5 %  | 0,48 mm    | 6,1 %            | se aplica           |
 * | placa 60×40×3, 3 agujeros    | 12–72 t. | +3,1 %  | 2,19 mm    | 73 %             | destructivo        |
 * | toro 14/4 (3456)             | 2 %      | −53 %   | 3,80 mm    | 48 %             | destructivo        |
 * | esfera r25 (512)             | 10 %     | −48 %   | 7,70 mm    | 15 %             | destructivo        |
 *
 * - `volumePct` 25 %: los casos que se aplican llegan a −16 %; los que destruyen la pieza (toro al 2 %, esfera al
 *   10 %, placa a 12 triángulos sin conservar agujeros: −66 %) pasan de −45 %. 25 % deja margen a los dos lados.
 * - `deviationRelMinSide` 25 %: la desviación respecto del lado menor de la caja (el espesor) es lo que separa la
 *   placa de 3 mm que queda deformada (2,19 mm, 73 %) de la esfera o el cilindro reducidos (≤ 11 %). La diagonal no
 *   sirve: la placa (3,1 %) y la esfera al 25 % (3,4 %) quedan iguales. Mover la superficie más de un cuarto del
 *   espesor cambia ese espesor hasta la mitad (las dos caras se mueven).
 * - `minTrianglesBase` 4 y `minTrianglesPerHole` 20 (con agujeros: `minTrianglesHoledBase` 12 + 20 por agujero): un
 *   tetraedro es el sólido cerrado más simple; una caja con un agujero cuadrado pasante necesita 32 triángulos (8 de
 *   paredes de fuera, 8 de dentro y dos coronas de 8), y cada agujero más agrega del orden de 20. Menos que eso ya no
 *   es la pieza con sus agujeros (ver `simplifyMinTriangles`).
 * - `safeSearchIterations`: llamadas a `simplify` de la bisección que busca la alternativa segura (la razón entre
 *   la tolerancia mínima y la destructiva suele ser ≤ 10⁴: 8 pasos la acotan a ~±8 %).
 */
export const SIMPLIFY_DESTRUCTIVE_LIMITS = {
  volumePct: 25,
  deviationRelMinSide: 0.25,
  minTrianglesBase: 4,
  minTrianglesHoledBase: 12,
  minTrianglesPerHole: 20,
  safeSearchIterations: 8,
} as const;

/** Mínimo geométrico de triángulos para un sólido de género `genus` (ver `SIMPLIFY_DESTRUCTIVE_LIMITS`). */
export function simplifyMinTriangles(genus: number): number {
  const D = SIMPLIFY_DESTRUCTIVE_LIMITS;
  return genus > 0 ? D.minTrianglesHoledBase + D.minTrianglesPerHole * genus : D.minTrianglesBase;
}

/**
 * Avisos del informe (la interfaz los traduce con `simplify.warn.<código>`):
 * - `genus_changed`: se abrió o cerró un agujero (cambió la forma);
 * - `volume_changed`: el volumen cambió más que `SIMPLIFY_NOTICE_LIMITS.volumePct` (en «Sin pérdida», su límite);
 * - `deviation_high`: la superficie se movió más que el tope de aviso de la pieza (muestreado);
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

/** Topes de aviso y de bloqueo calculados para una pieza (mm de mundo). */
export interface SimplifyPartLimits {
  noticeVolumePct: number;
  noticeDeviationMm: number;
  destructiveVolumePct: number;
  destructiveDeviationMm: number;
  minSideMm: number;
  minTriangles: number;
}

/** Informe antes → después. Volúmenes en mm³ locales (la escala no cambia el %); desviación en mm de mundo. */
export interface SimplifyReport {
  mode: SimplifyMode;
  /** Objeto al que corresponde (lo agrega la app; el motor no lo conoce). */
  objectId?: string;
  /** false si no se aplicó (sin reducción, «Sin pérdida» rechazado o resultado destructivo): el objeto queda intacto. */
  applied: boolean;
  /**
   * Qué se aplicó. Con `safe`, las medidas de arriba (tolerancia, triángulos, volumen, género, desviación) son las de
   * la versión segura aplicada y `requested` trae las de lo pedido.
   */
  appliedVariant: SimplifyAppliedVariant;
  /** Solo si lo pedido era destructivo y se aplicó la segura: las medidas de lo pedido. */
  requested?: SimplifyRequestedResult;
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
  /**
   * Topes de esta pieza (mm de mundo), la única fuente de los números que muestra el informe: `notice` es el de aviso
   * (`deviation_high` en `warnings`), `destructive` el de bloqueo (`deviation_high` en `destructive`), `minSideMm` el
   * lado menor de la caja del que sale, y `minTriangles` el mínimo geométrico. No viene en «Sin pérdida».
   */
  limits?: SimplifyPartLimits;
  /** Tope de desviación destructiva para esta pieza (mm de mundo) = `limits.destructiveDeviationMm` (compatibilidad). */
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
 * Topes de trabajo de la verificación y de la búsqueda (los umbrales de aviso están en `SIMPLIFY_NOTICE_LIMITS`; los
 * de 0,5 % y 0,1 mm que hubo aquí se quitaron el 26-nov-2026: daban un segundo juego de límites en el mismo informe).
 * - `maxDeviationSamples`: vértices y centroides por sentido (el total es hasta 4×); la medición usó 150 000 y
 *   aquí se baja para que medir no cueste más que simplificar en mallas de millones.
 * - Búsqueda por cantidad: hasta 16 llamadas a `simplify` o 30 s; se acepta quedar hasta 2 % bajo el objetivo.
 * - `genusSlackRel` 25 %: en «Por cantidad», si el resultado más cercano pierde agujeros pasantes, se prefiere el
 *   mejor que los conserva con hasta 25 % más triángulos que el objetivo (la forma manda sobre el número); se
 *   buscan hasta `genusExtraIterations` tolerancias más en el borde donde cambia el género.
 */
export const SIMPLIFY_WARN_LIMITS = {
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
