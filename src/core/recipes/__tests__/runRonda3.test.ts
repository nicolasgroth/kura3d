/**
 * @file src/core/recipes/__tests__/runRonda3.test.ts
 * @description Casos reales de la tercera ronda de recetas, medidos con el motor real: postes que tapan la caja,
 * pared fina junto al piloto, altura útil con tapa a presión, caracteres y logos que el motor no puede generar (error
 * junto al campo), logo alto escalado dentro de una caja, avellanado que no atraviesa la placa, distancia por
 * defecto acotada y chequeo de cama de la placa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { ManifoldToplevel } from 'manifold-3d';
import { computeMeshStats } from '../../../engine';
import type { SceneObject } from '../../../types/kura';
import { runRecipe } from '../run/executeRecipe';
import type { RecipeRunResult } from '../run/types';
import { validateRecipe } from '../validate/validateRecipe';
import { EXAMPLES, clone } from './fixtures';
import { expectOk, manifoldModule, testContext, userSize, worldManifold } from './runSupport';

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await manifoldModule();
});

const BED = { w: 256, d: 256, h: 256 };

function solid(obj: SceneObject) {
  const m = worldManifold(wasm, obj);
  return { status: m.status(), pieces: m.decompose().length, manifold: computeMeshStats(obj.mesh).isManifold };
}

const byLevel = (result: RecipeRunResult, level: string) => result.messages.filter((m) => m.level === level);

type Lang = 'es' | 'en';
const run = (recipe: keyof typeof EXAMPLES, answers: Record<string, unknown>, extra: { files?: Record<string, string>; bed?: boolean; language?: Lang } = {}) =>
  runRecipe(testContext(), {
    recipe: clone(EXAMPLES[recipe]),
    answers,
    options: { language: extra.language ?? 'es', ...(extra.bed ? { bed: BED } : {}) },
    ...(extra.files ? { files: extra.files } : {}),
  });

describe('caja: espacio útil y pared junto al piloto', () => {
  it('12×12 con M2: los postes taparían la caja → error claro en el campo tornillo', async () => {
    const result = await run('caja', { w: 12, dp: 12, screw: 2 });
    expect(result.ok).toBe(false);
    const [err] = byLevel(result, 'error');
    expect(err).toMatchObject({ focus: 'screw' });
    expect(err.text).toMatch(/postes/);
  });

  it('20×20 con M2 se puede crear pero avisa que los postes ocupan mucho; 80×60 con M3 no avisa', async () => {
    const tight = expectOk(await run('caja', { w: 20, dp: 20, screw: 2 }));
    expect(byLevel(tight, 'warning').map((m) => m.focus)).toContain('screw');
    expect(byLevel(expectOk(await run('caja', {})), 'warning')).toHaveLength(0);
  });

  it('radio 15 con M3 deja ~1 mm junto al piloto → aviso de pared mínima en el radio; la caja sigue cerrada', async () => {
    const result = expectOk(await run('caja', { r: 15, screw: 3 }));
    const warn = byLevel(result, 'warning').find((m) => m.focus === 'r');
    expect(warn?.text).toMatch(/quedan 1 mm de pared.*13 mm/);
    const [box] = result.change.added;
    expect(solid(box)).toMatchObject({ status: 'NoError', pieces: 1, manifold: true });
    // Radio 6 con M3 no avisa.
    expect(byLevel(expectOk(await run('caja', { r: 6, screw: 3 })), 'warning').filter((m) => m.focus === 'r')).toHaveLength(0);
  });
});

describe('caja: tapa a presión', () => {
  it('nota informativa con la altura útil (alto − pestaña) en es y en', async () => {
    for (const language of ['es', 'en'] as const) {
      const result = expectOk(await run('caja', { fix: 'press', h: 40 }, { language }));
      const info = byLevel(result, 'info').find((m) => m.focus === 'h');
      expect(info?.text).toMatch(/37 mm/);
      const [box, lid] = result.change.added;
      expect(solid(lid)).toMatchObject({ pieces: 1, manifold: true });
      // La pestaña de 3 mm es lo que resta: tapa = grosor (2) + pestaña (3).
      expect(userSize(lid)[2]).toBeCloseTo(5, 4);
      expect(userSize(box)[2]).toBeCloseTo(42, 4);
    }
    // Con tornillos no hay nota de pestaña.
    expect(byLevel(expectOk(await run('caja', { h: 40 })), 'info')).toHaveLength(0);
  });

  it('alto 7 a presión deja 4 mm útiles → error en el alto', async () => {
    const result = await run('caja', { fix: 'press', h: 7 });
    expect(result.ok).toBe(false);
    expect(byLevel(result, 'error')[0]).toMatchObject({ focus: 'h' });
    expect(expectOk(await run('caja', { fix: 'press', h: 8 })).ok).toBe(true);
  });
});

describe('llavero: lo que la fuente o el SVG no permiten', () => {
  const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${body}</svg>`;
  const withLogo = (content: string, language: Lang = 'es') =>
    run('llavero', { logo: { kind: 'svg', bytes: content.length } }, { files: { logo: content }, language });

  it('un emoji en el texto → error junto al campo texto que nombra el carácter (no run.engine)', async () => {
    for (const language of ['es', 'en'] as const) {
      const result = await run('llavero', { text: 'Hola 😀' }, { language });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.map((e) => e.code)).toEqual(['run.input']);
      expect(result.errors[0].params.focus).toBe('text');
      const [msg] = byLevel(result, 'error');
      expect(msg).toMatchObject({ focus: 'text' });
      expect(msg.text).toContain('😀');
      expect(msg.text).toMatch(language === 'es' ? /caracteres que la fuente no incluye/ : /characters the font does not include/);
    }
  });

  it('logo solo de trazo o vacío → «el logo no tiene áreas rellenas» junto al campo logo', async () => {
    const stroke = svg('<path d="M0 0 L10 10" stroke="black" fill="none"/>');
    for (const content of [stroke, svg('')]) {
      const result = await withLogo(content);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]).toMatchObject({ code: 'run.input', path: 'params[6]' });
      expect(byLevel(result, 'error')[0]).toMatchObject({ focus: 'logo' });
      expect(byLevel(result, 'error')[0].text).toMatch(/no tiene áreas rellenas/);
    }
    expect(byLevel(await withLogo(stroke, 'en'), 'error')[0].text).toMatch(/no filled areas/);
  });

  it('un logo de 2×40 se escala dentro de la caja (alto máximo), proporcional, y el llavero no se dispara', async () => {
    const tall = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 40"><rect width="2" height="40"/></svg>';
    const result = expectOk(await run('llavero', { text: '', logo: { kind: 'svg', bytes: tall.length } }, { files: { logo: tall } }));
    const [key] = result.change.added;
    expect(solid(key)).toMatchObject({ pieces: 1, manifold: true });
    // Letra 10: logo en una caja de 14 × 14 → 0,7 × 14; la placa queda en su fondo mínimo (17).
    expect(userSize(key)[1]).toBeLessThanOrEqual(24 + 1e-6);
    // Un logo cuadrado sigue en 14 mm (sin cambio).
    const square = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
    const sq = expectOk(await run('llavero', { text: '', logo: { kind: 'svg', bytes: square.length } }, { files: { logo: square } }));
    expect(userSize(sq.change.added[0])[1]).toBeCloseTo(24, 3);
  });
});

describe('formato: onError', () => {
  it('un focus que no es parámetro es error de validación; un código desconocido en codes también', () => {
    const bad = clone(EXAMPLES.llavero) as { steps: { onError?: unknown }[] };
    bad.steps[0].onError = { focus: 'nada' };
    expect(validateRecipe(bad).issues.map((i) => `${i.code} @ ${i.path}`)).toEqual(['ref.unknownParam @ steps[0].onError.focus']);
    bad.steps[0].onError = { focus: 'text', codes: ['no-valido'] };
    expect(validateRecipe(bad).ok).toBe(false);
  });

  it('con un código fuera de codes se muestra el texto del motor, igual junto al campo', async () => {
    const recipe = clone(EXAMPLES.llavero) as { steps: { onError?: { codes?: string[] } }[] };
    recipe.steps[0].onError!.codes = ['SVG_NO_CONTOURS'];
    const result = await runRecipe(testContext(), { recipe, answers: { text: 'A😀' }, options: { language: 'es' } });
    expect(result.ok).toBe(false);
    const [msg] = byLevel(result, 'error');
    expect(msg.focus).toBe('text');
    expect(msg.text).toMatch(/La fuente no tiene estos caracteres: 😀/);
  });
});

describe('placa: avellanado, distancia por defecto y cama', () => {
  /** Volumen de la franja inferior (0,05–0,75 mm) de la placa: con el agujero recto debe ser el mismo. */
  function bottomSlab(obj: SceneObject): number {
    const m = worldManifold(wasm, obj);
    const box = m.boundingBox();
    const slab = wasm.Manifold.cube([2000, 0.7, 2000], true).translate([0, box.min[1] + 0.4, 0]);
    return m.intersect(slab).volume();
  }

  it('grosor 1,6 con tornillo de 4: el avellanado deja 0,8 mm de agujero recto abajo y avisa', async () => {
    const thin = expectOk(await run('placa', { t: 1.6, screw: 4, spacing: 60 }));
    const thick = expectOk(await run('placa', { t: 6, screw: 4, spacing: 60 }));
    expect(solid(thin.change.added[0])).toMatchObject({ status: 'NoError', pieces: 1, manifold: true });
    expect(bottomSlab(thin.change.added[0])).toBeCloseTo(bottomSlab(thick.change.added[0]), 1);
    expect(byLevel(thin, 'warning').find((m) => m.focus === 't')?.text).toMatch(/avellanado/);
    expect(byLevel(thick, 'warning')).toHaveLength(0);
  });

  it('3 módulos de 80: la distancia por defecto queda en su máximo (250) y la placa se crea', async () => {
    const result = expectOk(await run('placa', { modules: 3, mw: 80, winw: 70 }));
    expect(result.params.find((p) => p.id === 'spacing')?.value).toBe(250);
  });

  it('una placa más ancha que la cama avisa con el chequeo de cama', async () => {
    const wide = expectOk(await run('placa', { modules: 3, mw: 80, winw: 70 }, { bed: true }));
    expect(userSize(wide.change.added[0])[0]).toBeGreaterThan(256);
    expect(wide.checks).toEqual([expect.objectContaining({ kind: 'fits_bed', ref: 'out' })]);
    expect(expectOk(await run('placa', {}, { bed: true })).checks).toEqual([]);
  });

  it('en inglés se llama «Outlet / switch plate»', async () => {
    expect((EXAMPLES.placa.strings.en as Record<string, string>).title).toBe('Outlet / switch plate');
  });
});
