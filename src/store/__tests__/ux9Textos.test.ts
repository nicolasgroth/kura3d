/**
 * @file src/store/__tests__/ux9Textos.test.ts
 * @description Lote ux9: avisos de dividir y reparar en lenguaje claro (sin «umbral de fragmento» ni cifras
 * sueltas), y botones apagados de la barra de herramientas sin diagonal sobre la etiqueta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { SUPPORTED_LANGUAGES } from '../../types/kura';

describe('avisos en lenguaje claro', () => {
  it('el aviso de fragmento absorbido no habla de umbrales en ningún idioma', () => {
    for (const { code } of SUPPORTED_LANGUAGES) {
      const text = t(code, 'engineWarning.SPLIT_FRAGMENT_MERGED', { code: 'A1', volume: 3, protrusion: 0.4 });
      expect(text, code).not.toMatch(/umbral|threshold|Schwelle|seuil|सीमा|阈值/i);
    }
  });

  it('el resumen de reparar dice qué son las mallas y las piezas', () => {
    expect(t('es', 'realesMotor.repairAllDone', { closed: 4, total: 4, pieces: 60 })).toBe('Se repararon y cerraron 4 mallas (las usan 60 piezas).');
    expect(t('es', 'realesMotor.repairAllDone', { closed: 4, total: 4, pieces: 60 })).not.toMatch(/\b4 de 4\b/);
  });
});

describe('herramientas apagadas', () => {
  const css = readFileSync('src/styles/toolAvailability.css', 'utf8');
  it('la diagonal va solo sobre el icono, no sobre la etiqueta', () => {
    expect(css).not.toMatch(/is-unavailable::after/);
    expect(css).toMatch(/is-unavailable > svg/);
    expect(css).not.toMatch(/is-unavailable\s*\{[^}]*opacity/);
  });
});
