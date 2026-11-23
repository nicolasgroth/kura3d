/**
 * @file src/core/recipes/__tests__/validate.test.ts
 * @description Validador de recetas: los tres ejemplos del diseño pasan; campos desconocidos, ids repetidos,
 * referencias inexistentes o a pasos posteriores, ciclos en `derive` y en parámetros, textos `$t:` sin traducción y
 * versiones de formato ajenas se rechazan con código y ruta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { validateRecipe } from '../validate/validateRecipe';
import { EXAMPLES, clone, minimal } from './fixtures';

type Mutator = (r: Record<string, any>) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

function issuesOf(mutate: Mutator) {
  const recipe = minimal();
  mutate(recipe);
  const result = validateRecipe(recipe);
  return result.issues.map((i) => `${i.code} @ ${i.path}`);
}

describe('validador: ruta feliz', () => {
  it.each(Object.entries(EXAMPLES))('el ejemplo %s del diseño es válido', (_name, recipe) => {
    const result = validateRecipe(clone(recipe));
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('la receta mínima es válida y ordena derive', () => {
    const result = validateRecipe(minimal());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.deriveOrder).toEqual(['half']);
  });

  it('caja: derive queda en orden de dependencias (pr antes que cw y cd)', () => {
    const result = validateRecipe(clone(EXAMPLES.caja));
    if (!result.ok) throw new Error('inválida');
    const order = result.value.deriveOrder;
    expect(order.indexOf('pr')).toBeLessThan(order.indexOf('cw'));
    expect(order.indexOf('pr')).toBeLessThan(order.indexOf('cd'));
  });
});

describe('validador: rechazos con código y ruta', () => {
  const cases: Array<[string, Mutator, string]> = [
    ['campo desconocido arriba', (r) => (r.entry = 'main.js'), 'schema.unknownField @ entry'],
    ['campo desconocido en un parámetro', (r) => (r.params[0].onChange = '=1'), 'schema.unknownField @ params[0].onChange'],
    ['campo desconocido en un paso', (r) => (r.steps[0].script = 'x'), 'schema.unknownField @ steps[0].script'],
    ['op fuera de la lista blanca', (r) => (r.steps[0].op = 'export_stl'), 'schema.invalid @ steps[0].op'],
    ['op que borra objetos', (r) => (r.steps[0].op = 'delete_object'), 'schema.invalid @ steps[0].op'],
    ['licencia no permisiva', (r) => (r.license = 'GPL-3.0'), 'schema.invalid @ license'],
    ['id con mayúsculas', (r) => (r.id = 'Test.Mal'), 'schema.invalid @ id'],
    ['id de parámetro prohibido', (r) => (r.params[0].id = 'constructor'), 'schema.invalid @ params[0].id'],
    ['ids de pasos repetidos', (r) => r.steps.push({ ...r.steps[0] }), 'id.duplicate @ steps[1]'],
    ['parámetro inexistente', (r) => (r.derive.half = '=p.nada / 2'), 'ref.unknownParam @ derive.half'],
    ['derivado inexistente', (r) => (r.steps[0].args.params.depth = '=d.nada'), 'ref.unknownDerive @ steps[0].args.params.depth'],
    ['@paso inexistente', (r) => (r.outputs[0].ref = '@nada'), 'ref.unknownStep @ outputs[0].ref'],
    ['@paso posterior', (r) => (r.steps[0].args.target = '@cube'), 'ref.stepOrder @ steps[0].args.target'],
    ['s.paso posterior', (r) => (r.steps[0].args.params.height = '=s.cube.size.x'), 'ref.stepOrder @ steps[0].args.params.height'],
    ['s.paso con forma inválida', (r) => {
      r.steps.push({ id: 'b', op: 'create_primitive', args: { type: 'box', params: { width: '=s.cube.volume.x' } } });
    }, 'ref.badPath @ steps[1].args.params.width'],
    ['bed con campo inválido', (r) => (r.derive.half = '=bed.x'), 'ref.badPath @ derive.half'],
    ['derive no puede leer pasos', (r) => (r.derive.half = '=s.cube.size.x'), 'expr.scope @ derive.half'],
    ['parámetro no puede leer derive', (r) => (r.params[0].max = '=d.half'), 'expr.scope @ params[0].max'],
    ['variables de patrón fuera de un patrón', (r) => (r.steps[0].args.params.height = '=x'), 'expr.scope @ steps[0].args.params.height'],
    ['recurso inexistente', (r) => (r.steps[0].args.svg = '$asset:logo'), 'ref.unknownAsset @ steps[0].args.svg'],
    ['tabla inexistente', (r) => (r.derive.half = "=lookup('m', p.w)"), 'ref.unknownTable @ derive.half'],
    ['texto $t: sin traducción', (r) => (r.title = '$t:title'), 'ref.unknownString @ title'],
    ['preset con parámetro inexistente', (r) => (r.presets = [{ id: 'a', label: 'A', verified: true, values: { nada: 1 } }]), 'ref.unknownParam @ presets[0].values.nada'],
    ['preset con expresión', (r) => (r.presets = [{ id: 'a', label: 'A', verified: true, values: { w: '=1' } }]), 'schema.invalid @ presets[0].values.w'],
    ['choice con default fuera de opciones', (r) => r.params.push({ id: 'c', type: 'choice', label: 'C', default: 'z', options: [{ value: 'a', label: 'A' }] }), 'param.notOption @ params[1].default'],
    ['sin pasos', (r) => delete r.steps, 'schema.invalid @ steps'],
    ['overrides sin extends', (r) => (r.overrides = { w: { default: 3 } }), 'schema.invalid @ overrides'],
    ['receta derivada con pasos propios', (r) => (r.extends = 'kura.base@^1'), 'schema.invalid @ params'],
  ];
  it.each(cases)('%s', (_label, mutate, expected) => {
    expect(issuesOf(mutate)).toContain(expected);
  });

  it('ciclo en derive: error con la ruta y el ciclo completo', () => {
    const result = validateRecipe({ ...minimal(), derive: { a: '=d.b + 1', b: '=d.c * 2', c: '=d.a' } });
    expect(result.ok).toBe(false);
    const cycle = result.issues.find((i) => i.code === 'graph.cycle');
    expect(cycle?.path).toBe('derive.a');
    expect(cycle?.params.cycle).toBe('d.a → d.b → d.c → d.a');
  });

  it('autorreferencia en derive y ciclo entre parámetros por default/visibleWhen', () => {
    expect(validateRecipe({ ...minimal(), derive: { a: '=d.a' } }).issues.map((i) => i.code)).toContain('graph.cycle');
    const recipe = minimal();
    (recipe.params as unknown[]).push(
      { id: 'a', type: 'number', default: '=p.b', label: 'A' },
      { id: 'b', type: 'boolean', default: true, visibleWhen: '=p.a > 1', label: 'B' },
    );
    const issue = validateRecipe(recipe).issues.find((i) => i.code === 'graph.cycle');
    expect(issue?.params.cycle).toMatch(/p\.a → p\.b → p\.a|p\.b → p\.a → p\.b/);
  });

  it('derive largo en cadena se ordena sin recursión', () => {
    const derive: Record<string, string> = { half: '=d.v62 / 2', v0: '=p.w' };
    for (let k = 1; k < 63; k++) derive[`v${k}`] = `=d.v${k - 1} + 1`;
    const result = validateRecipe({ ...minimal(), derive });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.deriveOrder).toEqual([...Array.from({ length: 63 }, (_, k) => `v${k}`), 'half']);
  });

  it('versión de formato ajena: error propio, no de esquema', () => {
    const result = validateRecipe({ ...minimal(), format: 'kura.recipe/2' });
    expect(result.issues.map((i) => i.code)).toEqual(['format.version']);
  });

  it('cada problema trae clave i18n y la ruta como valor interpolable', () => {
    const [first] = validateRecipe({ ...minimal(), entry: 'x' }).issues;
    expect(first.key).toBe('recipe.error.schema.unknownField');
    expect(first.params.path).toBe('entry');
  });
});
