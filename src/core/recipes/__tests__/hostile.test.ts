/**
 * @file src/core/recipes/__tests__/hostile.test.ts
 * @description Pruebas hostiles del formato de recetas: claves de prototipo en el JSON y en las respuestas,
 * expresiones con llamadas o miembros prohibidos, expresiones gigantes y anidadas, patrones sin `max` o con `max`
 * enorme, recursos sobre el tope, números no finitos, caracteres de control, recetas de 5 MB, objetos con
 * accesores, y costo lineal medido por conteo de trabajo (no por reloj).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, describe, expect, it } from 'vitest';
import { RECIPE_LIMITS, EXPRESSION_LIMITS } from '../limits';
import { resolveRecipe } from '../resolve/resolveRecipe';
import { parseRecipeText, validateRecipe } from '../validate/validateRecipe';
import { scanJson } from '../scan';
import { minimal } from './fixtures';

const codesOf = (issues: readonly { code: string; path: string }[]) => issues.map((i) => `${i.code} @ ${i.path}`);
const textWith = (mutate: (r: Record<string, any>) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const r = minimal();
  mutate(r);
  return JSON.stringify(r);
};

afterEach(() => {
  // Ninguna prueba debe haber contaminado el prototipo global.
  expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(false);
});

describe('hostil: prototipos', () => {
  it.each([
    ['arriba', (t: string) => t.replace('{"format"', '{"__proto__":{"polluted":1},"format"'), '__proto__'],
    ['en derive', (t: string) => t.replace('"derive":{', '"derive":{"__proto__":"=1",'), 'derive.__proto__'],
    ['constructor en derive', (t: string) => t.replace('"derive":{', '"derive":{"constructor":"=1",'), 'derive.constructor'],
    ['prototype en args', (t: string) => t.replace('"args":{', '"args":{"prototype":{"polluted":1},'), 'steps[0].args.prototype'],
    ['__proto__ en strings', (t: string) => t.replace('"outputs"', '"strings":{"es":{"__proto__":"x"}},"outputs"'), 'strings.es.__proto__'],
  ])('clave prohibida %s', (_label, edit, path) => {
    const result = parseRecipeText(edit(JSON.stringify(minimal())));
    expect(codesOf(result.issues)).toEqual([`format.forbiddenKey @ ${path}`]);
  });

  it('claves prohibidas en las respuestas', () => {
    const answers = JSON.parse('{"__proto__":{"polluted":1}}');
    expect(codesOf(resolveRecipe(minimal(), answers).errors)).toEqual(['format.forbiddenKey @ answers.__proto__']);
    expect(codesOf(resolveRecipe(minimal(), { constructor: 1 }).errors)).toEqual(['format.forbiddenKey @ answers.constructor']);
  });

  it('ids y referencias con nombres de prototipo', () => {
    expect(codesOf(validateRecipe({ ...minimal(), derive: { half: '=p.constructor' } }).issues)).toEqual(['expr.forbiddenIdentifier @ derive.half']);
    expect(codesOf(validateRecipe({ ...minimal(), derive: { half: '=d.__proto__' } }).issues)).toEqual(['expr.forbiddenIdentifier @ derive.half']);
    const steps = [{ id: '__proto__', op: 'create_primitive', args: {} }];
    expect(codesOf(validateRecipe({ ...minimal(), steps }).issues)).toContain('schema.invalid @ steps[0].id');
    expect(codesOf(validateRecipe({ ...minimal(), title: '$t:__proto__', strings: { es: {}, en: {} } }).issues)).toContain('ref.unknownString @ title');
  });

  it('objetos con accesores o clases no se aceptan (ni se ejecutan sus getters)', () => {
    let called = false;
    const tricky = minimal();
    Object.defineProperty(tricky, 'description', { enumerable: true, get: () => ((called = true), 'x') });
    expect(codesOf(validateRecipe(tricky).issues)).toEqual(['format.json @ description']);
    expect(called).toBe(false);
    class Fake {
      format = 'kura.recipe/1';
    }
    expect(validateRecipe(new Fake()).issues.map((i) => i.code)).toEqual(['format.json']);
  });
});

describe('hostil: expresiones en la receta', () => {
  it.each([
    ['llamada no permitida', '=alert(1)', 'expr.forbiddenFunction'],
    ['llamada a miembro', '=p.w.toFixed(2)', 'expr.forbiddenNode'],
    ['índice calculado', "=p['w']", 'expr.forbiddenNode'],
    ['this', '=this', 'expr.forbiddenNode'],
    ['asignación', '=p.w = 1', 'expr.syntax'],
    ['secuencia', '=(1, 2)', 'expr.forbiddenNode'],
  ])('%s se rechaza con código y ruta', (_label, source, code) => {
    expect(codesOf(validateRecipe({ ...minimal(), derive: { half: source } }).issues)).toEqual([`${code} @ derive.half`]);
  });

  it('expresión más larga que el tope y anidada hasta el tope', () => {
    const long = '=' + '1+'.repeat(300) + '1';
    expect(codesOf(validateRecipe({ ...minimal(), derive: { half: long } }).issues)).toEqual(['expr.tooLong @ derive.half']);
    const ok = '=' + '-'.repeat(EXPRESSION_LIMITS.maxDepth - 1) + '1';
    expect(validateRecipe({ ...minimal(), derive: { half: ok } }).ok).toBe(true);
    const deep = '=' + '-'.repeat(EXPRESSION_LIMITS.maxDepth) + '1';
    expect(codesOf(validateRecipe({ ...minimal(), derive: { half: deep } }).issues)).toEqual(['expr.tooDeep @ derive.half']);
  });

  it('el presupuesto de evaluaciones corta una receta que repite expresiones caras', () => {
    // Ancha y poco profunda: max() de 16 grupos de 4 sumandos (≈ 113 nodos por expresión).
    const heavy = '=max(' + Array.from({ length: 16 }, () => '(p.w+p.w+p.w+p.w)').join(',') + ')';
    const steps = [
      { id: 'cube', op: 'create_primitive', args: { type: 'box' } },
      { id: 'rep', op: 'create_primitive', pattern: { kind: 'linear', count: 256, step: [1, 0, 0], max: 256 }, args: { type: 'box', params: { width: heavy, depth: heavy } } },
    ];
    const result = resolveRecipe({ ...minimal(), steps });
    expect(result.errors.map((e) => e.code)).toEqual(['expr.budget']);
    expect(result.work).toBeLessThanOrEqual(EXPRESSION_LIMITS.maxEvaluations + 10_000);
  });
});

describe('hostil: patrones', () => {
  const step = (pattern: unknown) => [{ id: 'cube', op: 'create_primitive', pattern, args: { type: 'box' } }];
  it('sin max, con max enorme o cero', () => {
    expect(codesOf(validateRecipe({ ...minimal(), steps: step({ kind: 'linear', count: 3, step: [1, 0, 0] }) }).issues)).toContain('schema.invalid @ steps[0].pattern.max');
    expect(codesOf(validateRecipe({ ...minimal(), steps: step({ kind: 'linear', count: 3, step: [1, 0, 0], max: 1e9 }) }).issues)).toContain('schema.invalid @ steps[0].pattern.max');
    expect(codesOf(validateRecipe({ ...minimal(), steps: step({ kind: 'linear', count: 3, step: [1, 0, 0], max: 0 }) }).issues)).toContain('schema.invalid @ steps[0].pattern.max');
  });

  it('la suma de max de todos los patrones tiene tope', () => {
    const steps = Array.from({ length: 5 }, (_, k) => ({ id: `s${k}`, op: 'create_primitive', pattern: { kind: 'linear', count: 1, step: [1, 0, 0], max: 256 }, args: { type: 'box' } }));
    const result = validateRecipe({ ...minimal(), steps, outputs: [{ ref: '@s0', name: 'x' }] });
    expect(codesOf(result.issues)).toEqual(['pattern.total @ steps']);
  });

  it('points con más de 64 puntos', () => {
    const points = Array.from({ length: 65 }, () => [0, 0, 0]);
    expect(codesOf(validateRecipe({ ...minimal(), steps: step({ kind: 'points', points, max: 100 }) }).issues)).toContain('schema.invalid @ steps[0].pattern.points');
  });
});

describe('hostil: recursos embebidos', () => {
  const b64 = (bytes: number) => 'A'.repeat(Math.ceil(bytes / 3) * 4);
  it('SVG sobre el tope del importador, total sobre el tope y base64 inválido', () => {
    expect(codesOf(validateRecipe({ ...minimal(), assets: [{ id: 'logo', kind: 'svg', data: b64(5_000_001) }] }).issues)).toEqual(['asset.tooLarge @ assets[0].data']);
    const big = b64(9 * 1024 * 1024);
    expect(codesOf(validateRecipe({ ...minimal(), assets: [{ id: 'a', kind: 'png', data: big }, { id: 'b', kind: 'png', data: big }] }).issues)).toEqual(['asset.totalTooLarge @ assets']);
    expect(codesOf(validateRecipe({ ...minimal(), assets: [{ id: 'a', kind: 'png', data: 'no es base64!' }] }).issues)).toEqual(['asset.badData @ assets[0].data']);
  });

  it('un recurso válido se acepta y se referencia como $asset', () => {
    const recipe = minimal();
    (recipe.steps as Array<Record<string, any>>)[0].args.svg = '$asset:logo'; // eslint-disable-line @typescript-eslint/no-explicit-any
    const result = resolveRecipe({ ...recipe, assets: [{ id: 'logo', kind: 'svg', data: btoa('<svg/>') }] });
    expect(result.errors).toEqual([]);
    expect(result.steps[0].instances[0].args.svg).toEqual({ $asset: 'logo' });
  });
});

describe('hostil: valores', () => {
  it('números no finitos en la receta y en las respuestas', () => {
    expect(codesOf(validateRecipe({ ...minimal(), derive: { half: NaN } }).issues)).toEqual(['format.notFinite @ derive.half']);
    expect(codesOf(resolveRecipe(minimal(), { w: Infinity }).errors)).toEqual(['format.notFinite @ answers.w']);
    expect(codesOf(resolveRecipe(minimal(), {}, { bed: { w: NaN, d: 1, h: 1 } }).errors)).toEqual(['format.notFinite @ bed']);
  });

  it('caracteres de control y de dirección en textos', () => {
    expect(codesOf(validateRecipe({ ...minimal(), title: 'Caja\u0000' }).issues)).toEqual(['format.controlChar @ title']);
    expect(codesOf(validateRecipe({ ...minimal(), title: 'Caja‮txt.exe' }).issues)).toEqual(['format.controlChar @ title']);
    const recipe = { ...minimal(), params: [{ id: 'w', type: 'text', maxLength: 20, default: 'a', label: 'T' }], derive: {}, rules: [], steps: [{ id: 'cube', op: 'create_primitive', args: { text: '=p.w' } }] };
    expect(codesOf(resolveRecipe(recipe, { w: 'a\u0007b' }).errors)).toEqual(['format.controlChar @ answers.w']);
    expect(resolveRecipe(recipe, { w: 'a\nb' }).errors).toEqual([]);
  });

  it('receta de 5 MB: rechazo por tamaño con trabajo acotado', () => {
    const text = textWith((r) => (r.description = 'x'.repeat(5 * 1024 * 1024)));
    const result = parseRecipeText(text);
    expect(codesOf(result.issues)).toEqual(['format.tooLarge @ description']);
    expect(result.work).toBeLessThan(100);
  });

  it('archivo gigante: rechazo antes de leer el JSON', () => {
    const text = '[' + '0,'.repeat(12 * 1024 * 1024) + '0]';
    const result = parseRecipeText(text);
    expect(codesOf(result.issues)).toEqual(['format.tooLarge @ ']);
    expect(result.work).toBe(1);
  });

  it('JSON muy anidado o con demasiados nodos', () => {
    expect(validateRecipe(parseNested(5000)).issues.map((i) => i.code)).toEqual(['format.depth']);
    const many = { ...minimal(), tags: Array.from({ length: RECIPE_LIMITS.maxJsonNodes + 1 }, () => 'a') };
    expect(validateRecipe(many).issues.map((i) => i.code)).toEqual(['format.nodes']);
  });

  it('una lista o un objeto enormes se rechazan antes de recorrerlos (el tope se revisa antes de apilar)', () => {
    // Un `Proxy` cuenta los accesos: si el lector apilara todos los elementos antes de comprobar el tope,
    // leería cada índice. Debe rechazar leyendo solo la longitud.
    let reads = 0;
    const huge = new Proxy(new Array(5_000_000).fill('a'), { get: (t, k, r) => { if (typeof k === 'string' && /^\d+$/.test(k)) reads += 1; return Reflect.get(t, k, r); } });
    expect(() => scanJson({ tags: huge })).toThrow();
    expect(reads).toBe(0);
    const wide: Record<string, number> = {};
    for (let i = 0; i <= RECIPE_LIMITS.maxJsonNodes; i++) wide['k' + i] = 1;
    expect(() => scanJson(wide)).toThrow();
    expect(validateRecipe(wide).issues.map((i) => i.code)).toEqual(['format.nodes']);
  });

  it('JSON inválido y formato ajeno', () => {
    expect(codesOf(parseRecipeText('{"format":').issues)).toEqual(['format.json @ ']);
    expect(codesOf(parseRecipeText('{"format":"kura.recipe/9"}').issues)).toEqual(['format.version @ format']);
  });
});

function parseNested(depth: number): unknown {
  return JSON.parse('{"format":"kura.recipe/1","x":' + '['.repeat(depth) + ']'.repeat(depth) + '}');
}

describe('costo lineal (conteo de trabajo)', () => {
  function withRules(n: number) {
    const rules = Array.from({ length: n }, (_, k) => ({ level: 'info', when: `=p.w > ${k} && d.half < ${k + 100}`, message: `Regla ${k}` }));
    return { ...minimal(), rules };
  }
  function withPattern(n: number) {
    const steps = [{ id: 'cube', op: 'create_primitive', pattern: { kind: 'linear', count: n, step: ['=p.w', 0, 0], max: 256 }, args: { type: 'box', position: ['=x + d.half', '=y', 0] } }];
    return { ...minimal(), steps };
  }

  it('validar el doble de reglas cuesta el doble (± 15 %)', () => {
    const base = validateRecipe(withRules(0)).work;
    const w16 = validateRecipe(withRules(16)).work - base;
    const w32 = validateRecipe(withRules(32)).work - base;
    const w64 = validateRecipe(withRules(64)).work - base;
    expect(w32 / w16).toBeGreaterThan(1.7);
    expect(w32 / w16).toBeLessThan(2.3);
    expect(w64 / w32).toBeGreaterThan(1.7);
    expect(w64 / w32).toBeLessThan(2.3);
  });

  it('resolver el doble de instancias cuesta el doble (± 15 %)', () => {
    const base = resolveRecipe(withPattern(0)).work;
    const w64 = resolveRecipe(withPattern(64)).work - base;
    const w128 = resolveRecipe(withPattern(128)).work - base;
    const w256 = resolveRecipe(withPattern(256)).work - base;
    expect(w128 / w64).toBeGreaterThan(1.7);
    expect(w128 / w64).toBeLessThan(2.3);
    expect(w256 / w128).toBeGreaterThan(1.7);
    expect(w256 / w128).toBeLessThan(2.3);
  });

  it('barrer un JSON el doble de grande cuesta el doble (± 15 %)', () => {
    const sized = (n: number) => ({ ...minimal(), tags: Array.from({ length: n }, () => 'a') });
    const base = validateRecipe(sized(0)).work;
    const w = (n: number) => validateRecipe(sized(n)).work - base;
    // tags admite hasta 16: la forma falla, pero el barrido previo ya midió el trabajo.
    expect(w(2000) / w(1000)).toBeGreaterThan(1.7);
    expect(w(2000) / w(1000)).toBeLessThan(2.3);
  });
});
