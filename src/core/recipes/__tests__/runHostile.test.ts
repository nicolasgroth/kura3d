/**
 * @file src/core/recipes/__tests__/runHostile.test.ts
 * @description Ejecutor ante recetas y entradas hostiles: `op` fuera de la lista blanca (también con la resolución
 * forjada), argumentos desconocidos, `$ref` a pasos inexistentes o posteriores, recursos embebidos corruptos,
 * gigantes o de otro tipo, topes de triángulos, objetos, memoria y tiempo, cancelación, miles de objetos y
 * respuestas fuera de rango. En todos: error tipado, ningún cambio, y los objetos del usuario intactos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { primitiveMesh } from '../../operations/creationOperations';
import { buildSceneObject, HEADLESS_BUILD_POLICY } from '../../scene/sceneObjects';
import { prepareRecipe } from '../resolve/resolveRecipe';
import { executeRecipe, runRecipe } from '../run/executeRecipe';
import { RECIPE_OP_TABLE } from '../run/opTable';
import { RECIPE_OPS } from '../schema/parts';
import { isKnownCommand } from '../../commands/commandPolicy';
import { minimal } from './fixtures';
import { errorCodes, testContext } from './runSupport';

type Mutable = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const b64 = (text: string) => btoa(text);
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

function withSvgAsset(data: string, kind = 'svg'): Mutable {
  const r = minimal() as Mutable;
  r.assets = [{ id: 'logo', kind, data }];
  r.steps.push({ id: 'icon', op: 'import_svg', args: { svgContent: '$asset:logo', depth: 2, targetWidth: 10 } });
  r.outputs = [{ ref: '@icon', name: 'Logo' }];
  return r;
}

/** Resolución válida con un paso alterado después de validar (simula un `ResolveResult` forjado). */
function forged(mutate: (step: Mutable) => void) {
  const prepared = prepareRecipe(minimal());
  mutate(prepared.result.steps[0] as unknown as Mutable);
  return prepared;
}

describe('tabla de operaciones', () => {
  it('cubre exactamente la lista blanca del formato y cada comando existe en el bus', () => {
    expect(Object.keys(RECIPE_OP_TABLE).sort()).toEqual([...RECIPE_OPS].sort());
    for (const [op, spec] of Object.entries(RECIPE_OP_TABLE)) {
      if (op.startsWith('recipe.')) expect(spec.command).toBeNull();
      else expect(spec.command !== null && isKnownCommand(spec.command)).toBe(true);
    }
  });
});

describe('ejecutor: recetas hostiles', () => {
  it('op fuera de la lista blanca: la valida el esquema y, si se forja, el ejecutor', async () => {
    const r = minimal() as Mutable;
    r.steps[0].op = 'export_stl';
    expect(errorCodes(await runRecipe(testContext(), { recipe: r }))).toEqual(['schema.invalid @ steps[0].op']);
    const forgedRun = await executeRecipe(testContext(), forged((s) => (s.op = 'delete_object')), {});
    expect(errorCodes(forgedRun)).toEqual(['run.unknownOp @ steps[0].op']);
  });

  it('argumento que la tabla no nombra', async () => {
    const r = minimal() as Mutable;
    r.steps[0].args.script = 'x';
    expect(errorCodes(await runRecipe(testContext(), { recipe: r }))).toEqual(['run.badArgs @ steps[0].args.script']);
  });

  it('argumento fuera del rango del bus', async () => {
    const r = minimal() as Mutable;
    r.steps[0].args.params.height = 1e9;
    const codes = errorCodes(await runRecipe(testContext(), { recipe: r }));
    expect(codes).toEqual(['run.badArgs @ steps[0].args']);
  });

  it('$ref a un paso inexistente o posterior', async () => {
    const r = minimal() as Mutable;
    r.steps.push({ id: 'b', op: 'boolean_operation', args: { op: 'union', target: '@nada', tools: [] } });
    expect(errorCodes(await runRecipe(testContext(), { recipe: r }))).toEqual(['ref.unknownStep @ steps[1].args.target']);
    r.steps[1].args.target = '@b';
    expect(errorCodes(await runRecipe(testContext(), { recipe: r }))[0]).toMatch(/^ref\.stepOrder/);
    const forgedRun = await executeRecipe(testContext(), forged((s) => (s.instances[0].args.target = { $ref: 'later' }, s.op = 'transform_object')), {});
    expect(errorCodes(forgedRun)[0]).toMatch(/^run\.(badArgs|refMissing)/);
  });

  it('booleana con un objetivo de varias piezas', async () => {
    const r = minimal() as Mutable;
    r.steps[0].pattern = { kind: 'linear', count: 2, step: [20, 0, 0], max: 2 };
    r.steps.push({ id: 'b', op: 'boolean_operation', args: { op: 'union', target: '@cube', tools: [] } });
    expect(errorCodes(await runRecipe(testContext(), { recipe: r }))).toEqual(['run.refArity @ steps[1].args.target']);
  });

  it('recurso embebido válido se importa con el lector SVG del motor', async () => {
    const result = await runRecipe(testContext(), { recipe: withSvgAsset(b64(SVG)) });
    expect(result.ok).toBe(true);
  });

  it('recursos corruptos, gigantes o de un tipo sin operación', async () => {
    expect(errorCodes(await runRecipe(testContext(), { recipe: withSvgAsset('***') }))).toEqual(['asset.badData @ assets[0].data']);
    // Bytes que no son UTF-8.
    expect(errorCodes(await runRecipe(testContext(), { recipe: withSvgAsset(btoa('\xff\xfe\xfd')) }))[0]).toMatch(/^run\.asset/);
    // UTF-8 válido pero no es un SVG: lo rechaza el lector del motor.
    expect(errorCodes(await runRecipe(testContext(), { recipe: withSvgAsset(b64('hola')) }))[0]).toMatch(/^run\.(engine|badArgs) @ steps\[1\]/);
    expect(errorCodes(await runRecipe(testContext(), { recipe: withSvgAsset(b64(SVG), 'png') }))[0]).toMatch(/^run\.asset/);
    const giant = b64(`<svg>${'x'.repeat(5_100_000)}</svg>`);
    expect(errorCodes(await runRecipe(testContext(), { recipe: withSvgAsset(giant) }))).toEqual(['asset.tooLarge @ assets[0].data']);
  });

  it('archivo de un parámetro que falta o pasa su tope', async () => {
    const r = withSvgAsset(b64(SVG));
    r.params.push({ id: 'logo', type: 'file', accept: ['svg'], maxBytes: 64, label: 'Logo' });
    r.steps[1].args.svgContent = '=p.logo';
    const answers = { logo: { kind: 'svg', bytes: 10 } };
    expect(errorCodes(await runRecipe(testContext(), { recipe: r, answers }))).toEqual(['run.file @ steps[1].args.svgContent']);
    const big = `<svg>${' '.repeat(100)}</svg>`;
    expect(errorCodes(await runRecipe(testContext(), { recipe: r, answers, files: { logo: big } }))[0]).toMatch(/^param\.fileTooLarge/);
  });

  it('topes de triángulos, objetos y memoria: error tipado y ningún cambio', async () => {
    for (const [limits, code] of [
      [{ maxTriangles: 10 }, 'run.triangles'],
      [{ maxObjects: 0.5 }, 'run.objects'],
      [{ maxMemoryBytes: 100 }, 'run.memory'],
    ] as const) {
      const result = await runRecipe(testContext(), { recipe: minimal(), limits });
      expect(result.ok).toBe(false);
      expect('change' in result).toBe(false);
      expect(errorCodes(result)[0]).toMatch(new RegExp(`^${code.replace('.', '\\.')} @`));
    }
  });

  it('los topes pedidos no pueden subir los duros', async () => {
    const result = await runRecipe(testContext(), { recipe: minimal(), limits: { maxObjects: 1e9, maxWallMs: Infinity } });
    expect(result.ok).toBe(true);
  });

  it('tiempo de pared agotado y cancelación: se corta y no deja nada', async () => {
    let clock = 0;
    const slow = await runRecipe(testContext(), { recipe: minimal(), limits: { maxWallMs: 5 }, now: () => (clock += 10) });
    expect(errorCodes(slow)[0]).toMatch(/^run\.timeout @ steps\[0\]/);
    const controller = new AbortController();
    controller.abort();
    expect(errorCodes(await runRecipe(testContext(), { recipe: minimal(), signal: controller.signal }))[0]).toMatch(/^run\.aborted/);
  });

  it('una receta que intenta crear miles de objetos: el resolvedor corta sobre 1 024 y el ejecutor sobre su tope', async () => {
    const grid = (id: string) => ({
      id, op: 'create_primitive', pattern: { kind: 'grid', nx: 16, ny: 16, dx: 2, dy: 2, max: 256 },
      args: { type: 'box', position: ['=x', '=y', 0], params: { width: 1, depth: 1, height: 1 } },
    });
    const r = minimal() as Mutable;
    r.steps = ['a', 'b', 'c', 'd'].map(grid);
    r.outputs = [{ ref: '@a', name: 'A' }];
    const result = await runRecipe(testContext(), { recipe: r });
    // 2 × 256 = 512 llenan el tope; el objeto 513 (tercer paso) lo pasa.
    expect(errorCodes(result)).toEqual(['run.objects @ steps[2].args']);
    r.steps.push(grid('e'));
    expect(errorCodes(await runRecipe(testContext(), { recipe: r }))[0]).toMatch(/^pattern\.total/);
  });

  it('respuestas fuera de rango o de otro tipo no llegan al motor', async () => {
    expect(errorCodes(await runRecipe(testContext(), { recipe: minimal(), answers: { w: 1000 } }))).toEqual(['param.outOfRange @ params[0]']);
    expect(errorCodes(await runRecipe(testContext(), { recipe: minimal(), answers: { w: 'diez' } }))[0]).toMatch(/^answer\.type/);
  });
});

describe('ejecutor: la escena del usuario queda intacta', () => {
  it('un objeto elegido se usa como copia y no cambia, salga bien o mal', async () => {
    const mesh = await primitiveMesh('box', { width: 30, depth: 30, height: 30 });
    const board = buildSceneObject({ id: 'user_1', name: 'Placa', source: 'primitive', mesh, position: [0, 0, 0] }, HEADLESS_BUILD_POLICY);
    const before = structuredClone(board);
    const r = minimal() as Mutable;
    r.params.push({ id: 'board', type: 'object', label: 'Placa' });
    r.steps.push({ id: 'cut', op: 'boolean_operation', args: { op: 'subtract', target: '=p.board', tools: ['@cube'] } });
    r.outputs = [{ ref: '@cut', name: 'Recorte' }];
    const answers = { board: { objectId: 'user_1', box: { min: [-15, -15, 0], max: [15, 15, 30] } } };
    const ok = await runRecipe(testContext(), { recipe: r, answers, sceneObjects: [board] });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.change.added.map((o) => o.id)).not.toContain('user_1');
    const failed = await runRecipe(testContext(), { recipe: r, answers, sceneObjects: [board], limits: { maxTriangles: 20 } });
    expect(failed.ok).toBe(false);
    expect(board).toEqual(before);
  });
});
