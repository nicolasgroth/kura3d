/**
 * @file src/core/recipes/__tests__/runTapaRoscada.test.ts
 * @description Receta incorporada «Recipiente con tapa roscada» (`kura.tapa-roscada`): con los valores por defecto crea
 * cuerpo y tapa cerrados, lado a lado y sin chocar, y el chequeo `screw_fit` informa que enrosca con su holgura mínima;
 * con holgura 0 avisa; las medidas frágiles salen como avisos o errores junto a su campo; y las entradas hostiles del
 * paso `create_screw_container` y del chequeo `screw_fit` (argumentos desconocidos, fuera de rango, referencias que no
 * son un cuerpo y una tapa, aridad) fallan con errores tipados sin tocar la escena.
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
const recipe = () => builtinRecipe('kura.tapa-roscada') as Record<string, unknown>;
const screwCheck = (checks: readonly { kind: string }[]) => checks.find((c) => c.kind === 'screw_fit') as RecipeScrewFitCheck | undefined;

describe('receta kura.tapa-roscada', () => {
  it('es válida y está entre las incorporadas', () => {
    expect(validateRecipe(recipe()).ok).toBe(true);
  });

  it('valores por defecto: cuerpo y tapa cerrados, lado a lado, y «enrosca» con holgura ≈ 0,3 mm', async () => {
    const result = expectOk(await runRecipe(testContext(), { recipe: recipe(), options: { bed: BED, language: 'es' } }));
    const [body, lid] = result.change.added;
    expect(result.change.added).toHaveLength(2);
    expect(body.name).toBe('Recipiente');
    expect(lid.name).toBe('Tapa roscada');
    expect(computeMeshStats(body.mesh).isManifold).toBe(true);
    expect(computeMeshStats(lid.mesh).isManifold).toBe(true);
    expect(userSize(body)[2]).toBeCloseTo(42, 1);
    // La tapa queda al lado (en X) sin solaparse con el cuerpo
    const bodyMaxX = body.position[0] + userSize(body)[0] / 2;
    const lidMinX = lid.position[0] - userSize(lid)[0] / 2;
    expect(lidMinX).toBeGreaterThan(bodyMaxX);
    const fit = screwCheck(result.checks);
    expect(fit?.status).toBe('ok');
    expect(fit?.minClearanceMm).toBeGreaterThan(0.25);
    expect(fit?.minClearanceMm).toBeLessThan(0.35);
  });

  it('holgura 0: crea igual pero el chequeo avisa que no enrosca', async () => {
    const result = expectOk(await runRecipe(testContext(), { recipe: recipe(), answers: { radialClearanceMm: 0, axialClearanceMm: 0 }, options: { language: 'es' } }));
    const fit = screwCheck(result.checks);
    expect(fit?.fits).toBe(false);
    expect(result.messages.some((m) => m.focus === 'radialClearanceMm' && m.level === 'warning')).toBe(true);
  });

  it('medidas frágiles: avisos y errores junto a su campo', () => {
    const validated = validateRecipe(recipe());
    if (!validated.ok) throw new Error('receta inválida');
    const r = resolveRecipe(validated.value.recipe, { innerHeightMm: 10, turns: 4, wallMm: 1.4, pitchMm: 2.5 }, { language: 'es' });
    expect(r.ok).toBe(false);
    const levels = new Map(r.messages.map((m) => [m.focus, m.level]));
    expect(levels.get('innerHeightMm')).toBe('error');
    expect(levels.get('wallMm')).toBe('warning');
    expect(levels.get('pitchMm')).toBe('warning');
    const r2 = resolveRecipe(validated.value.recipe, { axialClearanceMm: 1, radialClearanceMm: 0, pitchMm: 2 }, { language: 'es' });
    expect(r2.messages.some((m) => m.focus === 'axialClearanceMm' && m.level === 'error')).toBe(true);
  });

  it('dos entradas y base cuadrada con caras planas: enrosca', async () => {
    const result = expectOk(await runRecipe(testContext(), { recipe: recipe(), answers: { starts: 2, turns: 1.5, base: 'square', grip: 'flats' }, options: { language: 'es' } }));
    expect(screwCheck(result.checks)?.status).toBe('ok');
  });
});

describe('create_screw_container y screw_fit: entradas hostiles', () => {
  const withSteps = (mutate: (r: Record<string, unknown> & { steps: Record<string, unknown>[]; checks: Record<string, unknown>[] }) => void) => {
    const r = recipe() as Record<string, unknown> & { steps: Record<string, unknown>[]; checks: Record<string, unknown>[] };
    mutate(r);
    return r;
  };

  it('argumento desconocido en el paso: run.badArgs', async () => {
    const r = withSteps((x) => { (x.steps[0].args as Record<string, unknown>).evil = 1; });
    const result = await runRecipe(testContext(), { recipe: r });
    expect(errorCodes(result)[0]).toMatch(/^run\.badArgs @ steps\[0\]\.args/);
  });

  it.each([
    ['pitchMm', 100],
    ['starts', 1.5],
    ['grip', 'spikes'],
    ['part', 'cap'],
    ['innerDiameterMm', '50'],
  ])('%s = %j: error tipado del paso', async (key, value) => {
    const r = withSteps((x) => { (x.steps[0].args as Record<string, unknown>)[key] = value; });
    const result = await runRecipe(testContext(), { recipe: r });
    expect(result.ok).toBe(false);
    expect(errorCodes(result)[0]).toMatch(/^run\.(badArgs|engine) @ steps\[0\]\.args/);
  });

  it('screw_fit con referencias que no son cuerpo + tapa: run.badArgs en checks', async () => {
    const r = withSteps((x) => { x.checks[1] = { kind: 'screw_fit', refs: ['@lid', '@body'], onFail: 'warn' }; });
    const result = await runRecipe(testContext(), { recipe: r });
    expect(errorCodes(result)[0]).toMatch(/^run\.badArgs @ checks\[1\]\.refs/);
  });

  it('screw_fit con cuerpo y tapa de medidas distintas: run.badArgs', async () => {
    const r = withSteps((x) => { (x.steps[1].args as Record<string, unknown>).wallMm = 2.5; });
    const result = await runRecipe(testContext(), { recipe: r });
    expect(errorCodes(result)[0]).toMatch(/^run\.badArgs @ checks\[1\]\.refs/);
  });

  it.each([
    [{ kind: 'screw_fit', refs: ['@body'], onFail: 'warn' }],
    [{ kind: 'screw_fit', refs: ['@body', '@lid', '@lid'], onFail: 'warn' }],
    [{ kind: 'screw_fit', refs: ['@body', '@lid'], onFail: 'offer_split' }],
    [{ kind: 'screw_fit', refs: ['@body', '@nada'], onFail: 'warn' }],
    [{ kind: 'screw_fit', refs: ['@body', '@lid'], onFail: 'warn', extra: true }],
  ])('chequeo mal formado no valida: %j', (check) => {
    const r = withSteps((x) => { x.checks[1] = check; });
    expect(validateRecipe(r).ok).toBe(false);
  });
});
