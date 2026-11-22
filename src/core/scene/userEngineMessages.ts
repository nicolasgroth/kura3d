/**
 * @file src/core/scene/userEngineMessages.ts
 * @description Localiza errores y avisos del motor mostrando los ejes del usuario (Z = altura). El motor
 * habla en ejes internos (Y arriba); aquí, en el punto donde se arma el texto, se convierten el eje, el
 * signo del desplazamiento y los rangos (CUT_PLANE_OUTSIDE, SPLIT_AXIS_BLOCKED, SPLIT_PLANE_THIN_SECTION).
 * Lo usan el store de la app (idioma activo) y el servidor MCP sin interfaz (inglés).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import {
  EngineError,
  isEngineError,
  localizeEngineError,
  localizeEngineWarning,
  type EngineMessageParams,
  type EngineWarning,
} from '../../engine/engineErrors';
import { userAxisOfInternal, type AxisName } from './displayAxes';
import type { LanguageCode } from '../../types/kura';

/**
 * Códigos cuyo texto nombra un eje ({axis}, {plane} o {planes}) y que se convierten a ejes del usuario aquí.
 * Una prueba exige que todo código del motor con esos parámetros esté en estas listas.
 */
export const AXIS_ERROR_CODES: readonly string[] = ['CUT_PLANE_OUTSIDE', 'SPLIT_AXIS_BLOCKED'];
export const AXIS_WARNING_CODES: readonly string[] = ['SPLIT_PLANE_THIN_SECTION'];

/** Eje interno (cualquier caja) → rótulo de eje de usuario en mayúscula (como en el resto de la interfaz). */
function userAxisText(axis: unknown): { text: unknown; sign: 1 | -1 } {
  if (typeof axis !== 'string' || !/^[xyzXYZ]$/.test(axis)) return { text: axis, sign: 1 };
  const { axis: user, sign } = userAxisOfInternal(axis.toLowerCase() as AxisName);
  return { text: user.toUpperCase(), sign };
}

/** Parámetros de un error del motor en ejes del usuario. */
export function userErrorParams(code: string, params: EngineMessageParams): EngineMessageParams {
  if (code === 'CUT_PLANE_OUTSIDE') {
    const { text, sign } = userAxisText(params.axis);
    const out: EngineMessageParams = { ...params, axis: text as string };
    if (typeof params.offset === 'number') out.offset = params.offset * sign + 0;
    if (sign < 0 && typeof params.min === 'number' && typeof params.max === 'number') {
      out.min = -params.max + 0;
      out.max = -params.min + 0;
    }
    return out;
  }
  if (code === 'SPLIT_AXIS_BLOCKED') return { ...params, axis: userAxisText(params.axis).text as string };
  return params;
}

/** Mensaje localizado de un error del motor, con los ejes que ve el usuario. */
export function localizeEngineErrorForUser(lang: LanguageCode, err: unknown): string {
  if (isEngineError(err)) return localizeEngineError(lang, new EngineError(err.code, userErrorParams(err.code, err.params)));
  return localizeEngineError(lang, err);
}

/** Aviso del motor con los ejes del usuario en sus parámetros (p. ej. plano "Y2" interno → "Z2"). */
export function userWarning(warning: EngineWarning): EngineWarning {
  if (warning.code !== 'SPLIT_PLANE_THIN_SECTION' || typeof warning.params.planes !== 'string') return warning;
  const planes = warning.params.planes.replace(
    /(^|, )([XYZ])(\d+)/g,
    (_m, pre: string, a: string, n: string) => `${pre}${userAxisText(a).text}${n}`,
  );
  return { ...warning, params: { ...warning.params, planes } };
}

/** Mensaje localizado de un aviso del motor, con los ejes que ve el usuario. */
export function localizeEngineWarningForUser(lang: LanguageCode, warning: EngineWarning): string {
  return localizeEngineWarning(lang, userWarning(warning));
}
