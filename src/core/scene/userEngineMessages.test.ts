/**
 * @file src/core/scene/userEngineMessages.test.ts
 * @description Todo error o aviso del motor cuyo texto (en cualquiera de los 6 idiomas) nombra un eje
 * ({axis}, {plane}, {planes}) está cubierto por la conversión a ejes del usuario (Z = altura).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { ENGINE_ERROR_CODES, ENGINE_WARNING_CODES } from '../../engine/engineErrors';
import { TRANSLATIONS } from '../../i18n/translations';
import {
  AXIS_ERROR_CODES,
  AXIS_WARNING_CODES,
  userErrorParams,
  userWarning,
} from './userEngineMessages';

const AXIS_PARAM = /\{(axis|plane|planes)\}/;
const LANGS = Object.keys(TRANSLATIONS) as (keyof typeof TRANSLATIONS)[];

function usesAxis(prefix: 'engineError' | 'engineWarning', code: string): boolean {
  return LANGS.some((lang) => AXIS_PARAM.test((TRANSLATIONS[lang] as Record<string, string>)[`${prefix}.${code}`] ?? ''));
}

describe('conversión de ejes en mensajes del motor', () => {
  it('todo error con parámetro de eje está en AXIS_ERROR_CODES', () => {
    const withAxis = ENGINE_ERROR_CODES.filter((code) => usesAxis('engineError', code));
    expect(withAxis.length).toBeGreaterThan(0);
    expect(withAxis.filter((code) => !AXIS_ERROR_CODES.includes(code))).toEqual([]);
  });

  it('todo aviso con parámetro de eje está en AXIS_WARNING_CODES', () => {
    const withAxis = ENGINE_WARNING_CODES.filter((code) => usesAxis('engineWarning', code));
    expect(withAxis.length).toBeGreaterThan(0);
    expect(withAxis.filter((code) => !AXIS_WARNING_CODES.includes(code))).toEqual([]);
  });

  it('las listas no nombran códigos que ya no existen', () => {
    expect(AXIS_ERROR_CODES.filter((c) => !(ENGINE_ERROR_CODES as readonly string[]).includes(c))).toEqual([]);
    expect(AXIS_WARNING_CODES.filter((c) => !(ENGINE_WARNING_CODES as readonly string[]).includes(c))).toEqual([]);
  });

  it('los códigos listados convierten de verdad el eje interno Y al Z del usuario', () => {
    for (const code of AXIS_ERROR_CODES) {
      expect(userErrorParams(code, { axis: 'y' }).axis, code).toBe('Z');
    }
    for (const code of AXIS_WARNING_CODES) {
      const out = userWarning({ code: code as (typeof ENGINE_WARNING_CODES)[number], params: { planes: 'Y1, X2', count: 2 } });
      expect(out.params.planes, code).toBe('Z1, X2');
    }
  });
});
