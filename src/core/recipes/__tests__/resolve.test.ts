/**
 * @file src/core/recipes/__tests__/resolve.test.ts
 * @description `resolveRecipe` con los tres ejemplos del diseño: parámetros efectivos, variantes, reglas y lista de
 * pasos estable (snapshot), más los casos de error de respuestas, rangos, visibilidad y patrones.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { resolveRecipe } from '../resolve/resolveRecipe';
import type { ResolveResult } from '../resolve/types';
import { EXAMPLES, clone, minimal } from './fixtures';

const codes = (result: ResolveResult) => result.errors.map((e) => `${e.code} @ ${e.path}`);
const value = (result: ResolveResult, id: string) => result.params.find((p) => p.id === id)?.value;

describe('resolveRecipe: caja con tapa', () => {
  it('valores por defecto: pasos estables', () => {
    const result = resolveRecipe(clone(EXAMPLES.caja));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.derived).toEqual({ ow: 84, od: 64, lid: 2, pr: 4, cw: 72, cd: 52, vn: 0 });
    expect(result.steps.filter((s) => s.skipped).map((s) => s.id)).toEqual(['slots', 'lip']);
    const posts = result.steps.find((s) => s.id === 'posts');
    expect(posts?.instances.map((i) => i.args.position)).toEqual([[-36, -26, 2], [36, -26, 2], [36, 26, 2], [-36, 26, 2]]);
    expect(result.steps).toMatchSnapshot();
    expect(result.outputs).toEqual([{ ref: 'box', name: 'Caja' }, { ref: 'lidout', name: 'Tapa' }]);
  });

  it('con ventilación y tapa a presión: ranuras centradas y tornillo oculto', () => {
    const result = resolveRecipe(clone(EXAMPLES.caja), { vents: true, fix: 'press', screw: 99 }, { language: 'en' });
    expect(result.errors).toEqual([]);
    // `screw` está oculto: toma su valor por defecto y su respuesta (fuera de opciones) no se valida.
    expect(result.params.find((p) => p.id === 'screw')).toMatchObject({ visible: false, value: 3, source: 'default' });
    const slots = result.steps.find((s) => s.id === 'slots');
    expect(slots?.pattern).toEqual({ kind: 'linear', count: 12 });
    const xs = slots?.instances.map((i) => (i.args.position as number[])[0]) ?? [];
    expect(xs[0]).toBeCloseTo(-xs[xs.length - 1], 12);
    expect(result.steps.find((s) => s.id === 'posts')?.skipped).toBe(true);
    expect(result.outputs[0].name).toBe('Box');
    expect(result.steps).toMatchSnapshot();
  });

  it('regla de advertencia y regla de error', () => {
    const warn = resolveRecipe(clone(EXAMPLES.caja), { wall: 1.4 });
    expect(warn.ok).toBe(true);
    expect(warn.messages).toEqual([expect.objectContaining({ level: 'warning', text: 'Pared bajo 1,6 mm: puede quedar frágil.', focus: 'wall' })]);
    const error = resolveRecipe(clone(EXAMPLES.caja), { w: 12, dp: 12 });
    expect(error.ok).toBe(false);
    expect(codes(error)).toContain('rule.failed @ rules[1]');
    expect(error.steps).toEqual([]);
  });

  it('rango que depende de otro parámetro (r ≤ min(w, dp)/4)', () => {
    const result = resolveRecipe(clone(EXAMPLES.caja), { r: 16 });
    expect(codes(result)).toEqual(['param.outOfRange @ params[4]']);
    expect(result.errors[0].params).toMatchObject({ value: 16, min: 0, max: 15 });
  });
});

describe('resolveRecipe: placa de enchufe (medidas por verificar)', () => {
  it('por defecto: un módulo, tornillos a los lados y aviso de medidas', () => {
    const result = resolveRecipe(clone(EXAMPLES.placa));
    expect(result.errors).toEqual([]);
    expect(value(result, 'spacing')).toBe(60);
    expect(result.messages.map((m) => m.text)).toEqual(['Medidas de ejemplo: mide tu caja antes de imprimir.']);
    expect(result.steps).toMatchSnapshot();
  });

  it('variantes: Chile y EE. UU. resuelven; las respuestas mandan sobre la variante', () => {
    const cl = resolveRecipe(clone(EXAMPLES.placa), { modules: 3 }, { variant: 'cl' });
    expect(cl.errors).toEqual([]);
    expect(cl.params.find((p) => p.id === 'modules')).toMatchObject({ value: 3, source: 'answer' });
    expect(cl.params.find((p) => p.id === 'mw')).toMatchObject({ value: 45, source: 'variant' });
    expect(cl.steps.find((s) => s.id === 'win')?.instances.map((i) => (i.args.position as number[])[0])).toEqual([-45, 0, 45]);
    const us = resolveRecipe(clone(EXAMPLES.placa), {}, { variant: 'us' });
    expect(us.errors).toEqual([]);
    expect(us.steps.find((s) => s.id === 'holes')?.instances.map((i) => i.args.position)).toEqual([[0, -48.5, -1], [0, 48.5, -1]]);
    expect(us.steps).toMatchSnapshot();
  });

  it('las variantes de Italia y España del diseño no calzan con su propio rango de ventana (winw ≤ mw − 2)', () => {
    for (const variant of ['it', 'es']) {
      const result = resolveRecipe(clone(EXAMPLES.placa), {}, { variant });
      expect(codes(result)).toEqual(['param.outOfRange @ params[2]']);
    }
  });

  it('variante inexistente', () => {
    expect(codes(resolveRecipe(clone(EXAMPLES.placa), {}, { variant: 'xx' }))).toEqual(['variant.unknown @ variant']);
  });
});

describe('resolveRecipe: llavero', () => {
  it('por defecto: sin logo, el paso del SVG se salta y la caja del arte queda diferida', () => {
    const result = resolveRecipe(clone(EXAMPLES.llavero));
    expect(result.errors).toEqual([]);
    expect(result.steps.find((s) => s.id === 'icon')?.skipped).toBe(true);
    const plate = result.steps.find((s) => s.id === 'plate');
    expect((plate?.instances[0].args.params as Record<string, unknown>).width).toEqual({
      $deferred: '=s.art2.size.x + p.size + p.ring + 3',
      path: 'steps[4].args.params.width',
    });
    expect(result.outputs).toEqual([{ ref: 'out', name: 'Kura' }]);
    expect(result.steps).toMatchSnapshot();
  });

  it('con logo SVG: el contenido es una referencia al archivo elegido, no texto', () => {
    const result = resolveRecipe(clone(EXAMPLES.llavero), { text: '', logo: { kind: 'svg', bytes: 1200 }, mode: 'engrave' });
    expect(result.errors).toEqual([]);
    const icon = result.steps.find((s) => s.id === 'icon');
    expect(icon?.instances[0].args.svgContent).toEqual({ $file: 'logo' });
    expect(result.steps.find((s) => s.id === 'label')?.skipped).toBe(true);
    expect(result.steps.find((s) => s.id === 'out')?.instances[0].args.op).toBe('subtract');
  });

  it('archivo de tipo o tamaño no aceptado, y regla de texto vacío', () => {
    expect(codes(resolveRecipe(clone(EXAMPLES.llavero), { logo: { kind: 'png', bytes: 10 } }))).toEqual(['param.fileType @ params[6]']);
    expect(codes(resolveRecipe(clone(EXAMPLES.llavero), { logo: { kind: 'svg', bytes: 262145 } }))).toEqual(['param.fileTooLarge @ params[6]']);
    expect(codes(resolveRecipe(clone(EXAMPLES.llavero), { text: '' }))).toEqual(['rule.failed @ rules[0]']);
    expect(codes(resolveRecipe(clone(EXAMPLES.llavero), { text: 'x'.repeat(21) }))).toEqual(['param.textTooLong @ params[0]']);
  });
});

describe('resolveRecipe: respuestas y patrones', () => {
  it('respuesta a un parámetro inexistente o de otro tipo', () => {
    expect(codes(resolveRecipe(minimal(), { nada: 1 }))).toEqual(['answer.unknown @ answers.nada']);
    expect(codes(resolveRecipe(minimal(), { w: '10' }))).toEqual(['answer.type @ answers.w']);
    expect(codes(resolveRecipe(minimal(), { w: 0.5 }))).toEqual(['param.outOfRange @ params[0]']);
  });

  it('entero y opción', () => {
    expect(codes(resolveRecipe(clone(EXAMPLES.placa), { modules: 1.5 }))).toContain('param.notInteger @ params[0]');
    expect(codes(resolveRecipe(clone(EXAMPLES.caja), { fix: 'glue' }))).toEqual(['param.notOption @ params[5]']);
  });

  it('pattern: la cantidad evaluada no puede pasar su max', () => {
    const recipe = minimal();
    (recipe.steps as unknown[]).push({ id: 'many', op: 'create_primitive', pattern: { kind: 'linear', count: '=p.w', step: [1, 0, 0], max: 5 }, args: { type: 'box', position: ['=x', 0, 0] } });
    expect(codes(resolveRecipe(recipe, { w: 6 }))).toEqual(['pattern.overMax @ steps[1].pattern.count']);
    expect(resolveRecipe(recipe, { w: 5 }).steps[1].instances).toHaveLength(5);
  });

  it('pattern: cantidad no entera o negativa', () => {
    const recipe = minimal();
    (recipe.steps as unknown[]).push({ id: 'g', op: 'create_primitive', pattern: { kind: 'grid', nx: '=p.w / 4', ny: 2, dx: 1, dy: 1, max: 10 }, args: { type: 'box' } });
    expect(codes(resolveRecipe(recipe, { w: 10 }))).toEqual(['pattern.count @ steps[1].pattern.nx']);
    expect(resolveRecipe(recipe, { w: 8 }).steps[1].instances).toHaveLength(4);
  });

  it('pattern circular con ángulo inicial', () => {
    const recipe = minimal();
    (recipe.steps as unknown[]).push({ id: 'c', op: 'create_primitive', pattern: { kind: 'circular', count: 4, radius: 10, startDeg: 90, max: 4 }, args: { type: 'box', position: ['=x', '=y', '=i'] } });
    expect(resolveRecipe(recipe).steps[1].instances.map((i) => i.args.position)).toEqual([[0, 10, 0], [-10, 0, 1], [0, -10, 2], [10, 0, 3]]);
  });

  it('bed: con cama se evalúa; sin cama queda diferido en los pasos y es error en derive', () => {
    const recipe = minimal();
    (recipe.steps as Array<Record<string, any>>)[0].args.params.height = '=bed.h / 2'; // eslint-disable-line @typescript-eslint/no-explicit-any
    const withBed = resolveRecipe(recipe, {}, { bed: { w: 220, d: 220, h: 250 } });
    expect((withBed.steps[0].instances[0].args.params as Record<string, unknown>).height).toBe(125);
    const without = resolveRecipe(recipe);
    expect((without.steps[0].instances[0].args.params as Record<string, unknown>).height).toEqual({ $deferred: '=bed.h / 2', path: 'steps[0].args.params.height' });
    expect(codes(resolveRecipe({ ...minimal(), derive: { half: '=bed.w' } }))).toEqual(['expr.scope @ derive.half']);
  });

  it('es pura: la misma entrada da la misma salida y no modifica la receta', () => {
    const recipe = clone(EXAMPLES.caja);
    const before = JSON.stringify(recipe);
    const a = resolveRecipe(recipe, { vents: true });
    const b = resolveRecipe(recipe, { vents: true });
    expect(a).toEqual(b);
    expect(JSON.stringify(recipe)).toBe(before);
  });
});
