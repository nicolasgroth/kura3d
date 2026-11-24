/**
 * @file src/core/recipes/__tests__/runCasosReales.test.ts
 * @description Combinaciones válidas de parámetros que antes daban piezas inútiles sin avisar, medidas con el motor
 * real: placa con tornillos arriba y abajo (agujeros dentro de la ventana o fuera de la placa), llavero con argolla
 * que parte la placa, logo junto al texto en UNA pieza cerrada, trazo fino, cama chica y texto en blanco.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { ManifoldToplevel } from 'manifold-3d';
import { computeMeshStats } from '../../../engine';
import type { SceneObject } from '../../../types/kura';
import { runRecipe } from '../run/executeRecipe';
import type { RecipeRunResult } from '../run/types';
import { EXAMPLES, clone } from './fixtures';
import { expectOk, manifoldModule, testContext, userSize, worldManifold } from './runSupport';

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await manifoldModule();
});

const SQUARE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10"/></svg>';
const BED = { w: 256, d: 256, h: 256 };

/** Piezas sueltas, género y estado de la malla de una salida. */
function solid(obj: SceneObject) {
  const m = worldManifold(wasm, obj);
  return { status: m.status(), pieces: m.decompose().length, genus: m.genus(), manifold: computeMeshStats(obj.mesh).isManifold };
}

function ruleMessages(result: RecipeRunResult, level: string) {
  return result.messages.filter((m) => m.level === level);
}

const placa = (answers: Record<string, unknown>, language: 'es' | 'en' = 'es') =>
  runRecipe(testContext(), { recipe: clone(EXAMPLES.placa), answers, options: { language } });
const llavero = (answers: Record<string, unknown>, extra: { files?: Record<string, string>; bed?: boolean; language?: 'es' | 'en' } = {}) =>
  runRecipe(testContext(), {
    recipe: clone(EXAMPLES.llavero),
    answers,
    options: { language: extra.language ?? 'es', ...(extra.bed ? { bed: BED } : {}) },
    ...(extra.files ? { files: extra.files } : {}),
  });

describe('placa: tornillos arriba y abajo', () => {
  it('distancia 40: los tornillos caerían en la ventana → error claro en el campo distancia', async () => {
    for (const language of ['es', 'en'] as const) {
      const result = await placa({ screwAxis: 'y', spacing: 40 }, language);
      expect(result.ok).toBe(false);
      const [err] = ruleMessages(result, 'error');
      expect(err.focus).toBe('spacing');
      expect(err.text).toMatch(language === 'es' ? /ventana.*entre \d+ y \d+ mm/ : /window.*between \d+ and \d+ mm/);
    }
  });

  it('distancia 200: los tornillos quedarían fuera de la placa → error', async () => {
    const result = await placa({ screwAxis: 'y', spacing: 200 });
    expect(result.ok).toBe(false);
    expect(ruleMessages(result, 'error')[0]).toMatchObject({ focus: 'spacing' });
    expect(ruleMessages(result, 'error')[0].text).toMatch(/fuera de la placa/);
  });

  it('una distancia del rango que sugiere el error da la placa con ventana y dos agujeros pasantes', async () => {
    const bad = await placa({ screwAxis: 'y', spacing: 40 });
    const [, lo, hi] = /entre (\d+) y (\d+)/.exec(ruleMessages(bad, 'error')[0].text)!.map(Number);
    for (const spacing of [lo, hi]) {
      const [plate] = expectOk(await placa({ screwAxis: 'y', spacing })).change.added;
      expect(solid(plate)).toMatchObject({ status: 'NoError', pieces: 1, genus: 3, manifold: true });
      userSize(plate).forEach((v, k) => expect(v).toBeCloseTo([81, 80, 3][k], 4));
    }
  });

  it('a los lados siguen valiendo las mismas reglas (distancia 50 cae en la ventana)', async () => {
    expect((await placa({ spacing: 50 })).ok).toBe(false);
    expect((await placa({ spacing: 80 })).ok).toBe(false); // pw = 81: fuera de la placa
  });
});

describe('llavero: argolla contra placa', () => {
  it('argolla de 10 con letra de 4 → error que dice qué cambiar', async () => {
    for (const language of ['es', 'en'] as const) {
      const result = await llavero({ ring: 10, size: 4 }, { language });
      expect(result.ok).toBe(false);
      const [err] = ruleMessages(result, 'error');
      expect(err.focus).toBe('ring');
      expect(err.text).toMatch(language === 'es' ? /argolla.*\d+ mm/ : /ring.*\d+ mm/);
    }
  });

  it('en el borde de la regla la placa deja 2 mm alrededor del agujero y es UNA pieza con la argolla', async () => {
    const [key] = expectOk(await llavero({ ring: 10, size: 9 })).change.added;
    expect(solid(key)).toMatchObject({ status: 'NoError', pieces: 1, genus: 1, manifold: true });
    expect(userSize(key)[1]).toBeGreaterThanOrEqual(10 + 4 - 1e-6);
  });

  it('con logo ancho y bajo la placa crece para dejar material alrededor de la argolla', async () => {
    const wide = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 4"><rect width="40" height="4"/></svg>';
    const [key] = expectOk(await llavero({ text: '', ring: 10, size: 9, logo: { kind: 'svg', bytes: wide.length } }, { files: { logo: wide } })).change.added;
    expect(solid(key)).toMatchObject({ pieces: 1, genus: 1 });
    expect(userSize(key)[1]).toBeGreaterThanOrEqual(14 - 1e-6);
  });
});

describe('llavero: logo y texto', () => {
  const files = { logo: SQUARE_SVG };
  const logo = { kind: 'svg', bytes: SQUARE_SVG.length };

  it('en relieve: logo a la izquierda del texto, separados, y UNA pieza cerrada', async () => {
    const both = expectOk(await llavero({ logo }, { files }));
    const textOnly = expectOk(await llavero({}));
    const [key] = both.change.added;
    expect(solid(key)).toMatchObject({ status: 'NoError', pieces: 1, genus: 1, manifold: true });
    // El logo (14 mm) más la separación se suman al ancho del texto solo.
    expect(userSize(key)[0] - userSize(textOnly.change.added[0])[0]).toBeGreaterThan(14 + 2 - 1e-6);
    expect(userSize(key)[2]).toBeCloseTo(4.01, 3);
  });

  it('grabado: también UNA pieza cerrada', async () => {
    const [key] = expectOk(await llavero({ logo, mode: 'engrave' }, { files })).change.added;
    expect(solid(key)).toMatchObject({ status: 'NoError', pieces: 1, genus: 1 });
    expect(userSize(key)[2]).toBeCloseTo(3, 4);
  });
});

describe('llavero: imprimibilidad', () => {
  it('letra de 5 mm: aviso de trazo fino para boquilla de 0,4 (no error); 6 mm ya no avisa', async () => {
    const thin = expectOk(await llavero({ size: 5, ring: 3 }));
    const warn = ruleMessages(thin, 'warning');
    expect(warn).toHaveLength(1);
    expect(warn[0]).toMatchObject({ focus: 'size' });
    expect(warn[0].text).toMatch(/0,4/);
    expect(ruleMessages(expectOk(await llavero({ size: 6 })), 'warning')).toHaveLength(0);
  });

  it('20 letras a 30 mm no caben en una cama de 256: el chequeo de cama avisa', async () => {
    const result = expectOk(await llavero({ text: 'ABCDEFGHIJKLMNOPQRST', size: 30 }, { bed: true }));
    expect(userSize(result.change.added[0])[0]).toBeGreaterThan(256);
    expect(result.checks).toEqual([expect.objectContaining({ kind: 'fits_bed', ref: 'out', onFail: 'warn' })]);
    expect(expectOk(await llavero({}, { bed: true })).checks).toEqual([]);
  });

  it('texto en blanco sin logo: el mensaje «empty» junto al campo, no un error del motor', async () => {
    const result = await llavero({ text: '   ' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.code)).toEqual(['rule.failed']);
    expect(ruleMessages(result, 'error')[0]).toMatchObject({ focus: 'text', text: 'Escribe un texto o elige un logo.' });
  });

  it('texto en blanco con logo: sale solo el logo, una pieza', async () => {
    const result = expectOk(await llavero({ text: '  ', logo: { kind: 'svg', bytes: SQUARE_SVG.length } }, { files: { logo: SQUARE_SVG } }));
    expect(result.stats.produced).toMatchObject({ label: 0, icon: 1 });
    expect(solid(result.change.added[0])).toMatchObject({ pieces: 1, genus: 1 });
  });
});
