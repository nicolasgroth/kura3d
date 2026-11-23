/**
 * @file src/i18n/genMotorKeys.test.ts
 * @description Textos del lote de motor de generadores: paridad en los 6 idiomas de `genMotor.ts` y
 * plural correcto del nombre de la envolvente convexa ("Hull of 1 part", no "1 parts").
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { t } from './index';
import { GEN_MOTOR_DE, GEN_MOTOR_EN, GEN_MOTOR_ES, GEN_MOTOR_FR, GEN_MOTOR_HI, GEN_MOTOR_ZH } from './locales/genMotor';

describe('textos de genMotor', () => {
  it('las 6 tablas tienen las mismas claves y ningún texto vacío', () => {
    const keys = Object.keys(GEN_MOTOR_ES).sort();
    for (const dict of [GEN_MOTOR_EN, GEN_MOTOR_DE, GEN_MOTOR_FR, GEN_MOTOR_HI, GEN_MOTOR_ZH]) {
      expect(Object.keys(dict).sort()).toEqual(keys);
      for (const v of Object.values(dict)) expect(v.trim().length).toBeGreaterThan(0);
    }
  });

  it('envolvente convexa con plural correcto', () => {
    expect(t('en', 'object.name.hull', { count: 1 })).toBe('Hull of 1 part');
    expect(t('en', 'object.name.hull', { count: 3 })).toBe('Hull of 3 parts');
    expect(t('es', 'object.name.hull', { count: 1 })).toBe('Envolvente de 1 pieza');
  });
});
