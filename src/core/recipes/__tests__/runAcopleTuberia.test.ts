/**
 * @file src/core/recipes/__tests__/runAcopleTuberia.test.ts
 * @description Receta incorporada «Acople de tubería» (`kura.acople-tuberia`): roscado y a presión crean macho y hembra
 * cerrados, lado a lado y sin chocar, y el chequeo `screw_fit` informa la unión con su holgura medida; holgura 0 avisa;
 * las medidas frágiles salen como avisos junto a su campo; y las entradas hostiles del paso `create_pipe_coupling` y del
 * chequeo (argumentos desconocidos, fuera de rango, referencias al revés o con medidas distintas) son errores tipados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { computeMeshStats } from '../../../engine';
import { builtinRecipe } from '../builtin';
import { resolveRecipe } from '../resolve/resolveRecipe';
import { runRecipe } from '../run/executeRecipe';
import type { RecipeScrewFitCheck } from '../run/types';
import { validateRecipe } from '../validate/validateRecipe';
import { errorCodes, expectOk, testContext, userSize } from './runSupport';

const BED = { w: 256, d: 256, h: 256 };
type R = Record<string, unknown> & { steps: Record<string, unknown>[]; checks: Record<string, unknown>[] };
const recipe = () => builtinRecipe('kura.acople-tuberia') as R;
const fitOf = (checks: readonly { kind: string }[]) => checks.find((c) => c.kind === 'screw_fit') as RecipeScrewFitCheck | undefined;

describe('receta kura.acople-tuberia', () => {
  it('es válida', () => {
    expect(validateRecipe(recipe()).ok).toBe(true);
  });

  it.each([
    ['thread', 0.3, 'Acople macho', 'Acople hembra'],
    ['press', 0.15, 'Acople macho', 'Acople hembra'],
  ] as const)('%s por defecto: dos mitades cerradas, lado a lado, holgura medida ≈ %f mm', async (joint, clearance, maleName, femaleName) => {
    const result = expectOk(await runRecipe(testContext(), { recipe: recipe(), answers: { joint }, options: { bed: BED, language: 'es' } }));
    const [male, female] = result.change.added;
    expect(result.change.added).toHaveLength(2);
    expect([male.name, female.name]).toEqual([maleName, femaleName]);
    expect(computeMeshStats(male.mesh).isManifold).toBe(true);
    expect(computeMeshStats(female.mesh).isManifold).toBe(true);
    expect(female.position[0] - userSize(female)[0] / 2).toBeGreaterThan(male.position[0] + userSize(male)[0] / 2);
    const fit = fitOf(result.checks);
    expect(fit?.status).toBe('ok');
    expect(fit?.joint).toBe(joint);
    expect(fit?.minClearanceMm).toBeGreaterThan(clearance - 0.06);
    expect(fit?.minClearanceMm).toBeLessThan(clearance + 0.06);
    expect(fit?.thinWall).toBe(false);
    // Solo avisos informativos con los valores por defecto.
    expect(result.messages.filter((m) => m.level !== 'info')).toEqual([]);
  }, 30_000);

  it('la estimación del diámetro exterior para colocar la hembra no se queda corta', async () => {
    for (const joint of ['thread', 'press'] as const) {
      const result = expectOk(await runRecipe(testContext(), { recipe: recipe(), answers: { joint, boreDiameterMm: 60, wallMm: 4 }, options: { language: 'es' } }));
      const [male, female] = result.change.added;
      expect(female.position[0] - male.position[0]).toBeGreaterThan(userSize(male)[0] + 5);
    }
  }, 30_000);

  it('holgura 0 (a presión): crea igual pero el chequeo avisa', async () => {
    const result = expectOk(await runRecipe(testContext(), { recipe: recipe(), answers: { joint: 'press', pressClearanceMm: 0 }, options: { language: 'es' } }));
    expect(fitOf(result.checks)?.fits).toBe(false);
    expect(result.messages.some((m) => m.focus === 'pressClearanceMm' && m.level === 'warning')).toBe(true);
  });

  it('medidas frágiles: avisos junto a su campo', () => {
    const validated = validateRecipe(recipe());
    if (!validated.ok) throw new Error('receta inválida');
    const r = resolveRecipe(validated.value.recipe, { wallMm: 1, turns: 1, pitchMm: 2, threadClearanceMm: 0.1 }, { language: 'es' });
    const levels = new Map(r.messages.map((m) => [m.focus, m.level]));
    expect(levels.get('wallMm')).toBe('warning');
    expect(levels.get('turns')).toBe('warning');
    expect(levels.get('pitchMm')).toBe('warning');
    expect(levels.get('threadClearanceMm')).toBe('warning');
    const p = resolveRecipe(validated.value.recipe, { joint: 'press', engageMm: 5, pressClearanceMm: 0.5 }, { language: 'es' });
    const pl = new Map(p.messages.map((m) => [m.focus, m.level]));
    expect(pl.get('engageMm')).toBe('warning');
    expect(pl.get('pressClearanceMm')).toBe('warning');
  });

  it('pared bajo el mínimo imprimible: el chequeo lo marca', async () => {
    const result = expectOk(await runRecipe(testContext(), { recipe: recipe(), answers: { joint: 'press', wallMm: 1 }, options: { language: 'es' } }));
    expect(fitOf(result.checks)?.thinWall).toBe(true);
  });
});

describe('create_pipe_coupling y screw_fit: entradas hostiles', () => {
  const withSteps = (mutate: (r: R) => void) => {
    const r = recipe();
    mutate(r);
    return r;
  };

  it('argumento desconocido en el paso: run.badArgs', async () => {
    const r = withSteps((x) => { (x.steps[0].args as Record<string, unknown>).evil = 1; });
    expect(errorCodes(await runRecipe(testContext(), { recipe: r }))[0]).toMatch(/^run\.badArgs @ steps\[0\]\.args/);
  });

  it.each([
    ['boreDiameterMm', 1000],
    ['starts', 1.5],
    ['joint', 'glue'],
    ['part', 'cap'],
    ['wallMm', '2'],
    ['clearanceMm', -1],
  ])('%s = %j: error tipado del paso', async (key, value) => {
    const r = withSteps((x) => { (x.steps[0].args as Record<string, unknown>)[key] = value; });
    const result = await runRecipe(testContext(), { recipe: r });
    expect(result.ok).toBe(false);
    expect(errorCodes(result)[0]).toMatch(/^run\.(badArgs|engine) @ steps\[0\]\.args/);
  });

  it('screw_fit al revés (hembra, macho): run.badArgs en checks', async () => {
    const r = withSteps((x) => { x.checks[1] = { kind: 'screw_fit', refs: ['@female', '@male'], onFail: 'warn' }; });
    expect(errorCodes(await runRecipe(testContext(), { recipe: r }))[0]).toMatch(/^run\.badArgs @ checks\[1\]\.refs/);
  });

  it('screw_fit con mitades de medidas distintas: run.badArgs', async () => {
    const r = withSteps((x) => { (x.steps[1].args as Record<string, unknown>).wallMm = 2.5; });
    expect(errorCodes(await runRecipe(testContext(), { recipe: r }))[0]).toMatch(/^run\.badArgs @ checks\[1\]\.refs/);
  });
});
