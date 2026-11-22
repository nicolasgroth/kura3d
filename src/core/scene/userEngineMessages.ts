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

/** Parámetros en radio (mm) de los avisos de conectores, que se muestran como diámetro. */
const DIAMETER_PARAMS: Partial<Record<EngineWarning['code'], string[]>> = {
  ASSEMBLY_WEAK_JOINT: ['measured', 'recommended'],
  SPLIT_CONNECTOR_REDUCED: ['size'],
  SPLIT_CONNECTOR_REINFORCED: ['requested', 'size'],
};

/** Aviso del motor con los ejes del usuario en sus parámetros (p. ej. plano "Y2" interno → "Z2"). */
export function userWarning(warning: EngineWarning): EngineWarning {
  // El motor mide los conectores en radio; el usuario los ve siempre en diámetro Ø (una sola forma de nombrarlos).
  if (DIAMETER_PARAMS[warning.code]) {
    const params = { ...warning.params };
    for (const key of DIAMETER_PARAMS[warning.code]!) {
      const radius = Number(params[key]);
      if (Number.isFinite(radius)) params[key] = Math.round(2 * radius * 10) / 10;
    }
    return { ...warning, params };
  }
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
