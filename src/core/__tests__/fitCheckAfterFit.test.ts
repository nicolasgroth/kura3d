/**
 * @file src/core/__tests__/fitCheckAfterFit.test.ts
 * @description Chequeo de consistencia tras "Ajustar a la impresora": la comprobación de encaje corre sobre
 * el bloque con la transformación del ajuste aplicada en copia (la escena no cambia) y devuelve las medidas
 * funcionales del análisis. Además, el alcance por defecto y la vigencia del informe.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { checkFitAfterFitToBed, fitCheckInputRefs, fitCheckIsCurrent, fitCheckScope } from '../operations/fitCheckOperations';
import { runFitToBed } from '../operations/fitOperations';
import { createPrimitiveMesh } from '../../engine/primitives';
import { makeObject } from '../../engine/__tests__/geometryTestUtils';
import { change } from '../operations/operationTypes';

describe('Comprobar encaje tras Ajustar a la impresora', () => {
  it('usa la transformación del ajuste en copia y devuelve el informe y lo funcional', async () => {
    const m = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
    const a = makeObject('A', m, { position: [0, 0, 0] });
    const b = makeObject('B', m, { position: [20, 0, 0] });
    const outcome = { analysis: { objectIds: ['A', 'B'], functional: [] }, change: change({ patches: [{ id: 'B', patch: { position: [8, 0, 0] } }] }) };
    const { report, functional } = await checkFitAfterFitToBed([a, b], outcome);
    expect(report.summary.interferes).toBe(1);
    expect(report.pairs[0].interference!.volumeMm3).toBeCloseTo(200, 3);
    expect(functional).toEqual([]);
    expect(b.position).toEqual([20, 0, 0]);
  });

  it('con el resultado real de runFitToBed (escalar), el bloque sigue sin choques', async () => {
    const m = await createPrimitiveMesh('box', { width: 150, height: 10, depth: 10 });
    const a = makeObject('A', m, { position: [0, 0, 0] });
    const b = makeObject('B', m, { position: [0, 0, 11] });
    const res = runFitToBed({ objects: [a, b], bed: { widthMm: 100, depthMm: 100, heightMm: 100, marginMm: 5 }, apply: 'scale' });
    const { report } = await checkFitAfterFitToBed([a, b], res);
    expect(report.summary.interferes).toBe(0);
    expect(report.pairs[0].clearanceMm!).toBeGreaterThan(0);
  });
});

describe('alcance y vigencia', () => {
  it('sin ids ni selección toma lo visible; los negativos van aparte', async () => {
    const m = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
    const objs = [makeObject('s', m), makeObject('n', m, { role: 'negative' }), makeObject('h', m, { visible: false }), makeObject('r', m, { role: 'reference' })];
    const scope = fitCheckScope(objs, []);
    expect(scope.objects.map((o) => o.id)).toEqual(['s', 'r']);
    expect(scope.negatives.map((o) => o.id)).toEqual(['n']);
    expect(fitCheckScope(objs, ['s', 'h']).objects.map((o) => o.id)).toEqual(['s', 'h']);
    const refs = fitCheckInputRefs(scope, objs);
    expect(fitCheckIsCurrent(refs, objs)).toBe(true);
    expect(fitCheckIsCurrent(refs, objs.map((o) => (o.id === 'n' ? { ...o, position: [1, 0, 0] as [number, number, number] } : o)))).toBe(false);
    expect(fitCheckIsCurrent(refs, [...objs, makeObject('n2', m, { role: 'negative' })])).toBe(false);
  });
});
