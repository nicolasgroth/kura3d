/**
 * @file src/components/__tests__/topbarFit.test.ts
 * @description Pruebas del algoritmo de niveles de la barra superior adaptativa: sube y baja de nivel
 * según el ancho, mide niveles faltantes e invalida mediciones cuando cambia el contenido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { pickTopbarLevel, recordTopbarWidth } from '../topbarFit';

/** Simula el ciclo render → medir → elegir hasta estabilizar. */
function settle(available: number, natural: (level: number) => number, start: {
  level: number;
  widths: Array<number | undefined>;
}, maxLevel = 10) {
  let { level, widths } = start;
  for (let i = 0; i < 50; i += 1) {
    widths = recordTopbarWidth(widths, level, natural(level));
    const next = pickTopbarLevel(available, widths, maxLevel);
    if (next === level) return { level, widths };
    level = next;
  }
  throw new Error('no converge');
}

const natural = (level: number) => Math.max(300, 1100 - level * 90);

describe('pickTopbarLevel', () => {
  it('devuelve el primer nivel sin medir', () => {
    expect(pickTopbarLevel(500, [900], 10)).toBe(1);
  });
  it('elige el nivel más bajo que cabe', () => {
    expect(pickTopbarLevel(800, [1000, 900, 790, 700], 10)).toBe(2);
  });
  it('usa el máximo si nada cabe', () => {
    expect(pickTopbarLevel(100, [500, 400, 300], 2)).toBe(2);
  });
});

describe('ciclo completo de ajuste', () => {
  it('1440 → 390 → 1440 sube y vuelve a bajar a nivel 0', () => {
    let state = settle(1440, natural, { level: 0, widths: [] });
    expect(state.level).toBe(0);
    state = settle(390, natural, state);
    expect(natural(state.level)).toBeLessThanOrEqual(391);
    expect(state.level).toBeGreaterThan(0);
    state = settle(1440, natural, state);
    expect(state.level).toBe(0);
  });

  it('un ancho intermedio baja solo hasta el nivel que cabe', () => {
    let state = settle(390, natural, { level: 0, widths: [] });
    state = settle(930, natural, state);
    expect(state.level).toBe(2);
  });

  it('si el contenido crece en el nivel actual, se descartan las mediciones y se re-mide', () => {
    let state = settle(1440, natural, { level: 0, widths: [] });
    // Un título largo de proyecto agrega 200 px a todos los niveles.
    const wider = (level: number) => natural(level) + 200;
    state = settle(1200, wider, state);
    expect(state.level).toBe(2);
    // Al volver al título corto, se recupera el nivel 0 sin recargar.
    state = settle(1200, natural, state);
    expect(state.level).toBe(0);
  });
});
