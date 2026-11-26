/**
 * @file src/components/__tests__/orientNoBaseView.test.ts
 * @description Presentación del estado «sin base estable» de «Orientar para imprimir» en la app y en el
 * resultado del comando (el que ve el MCP): nunca «ya es la mejor», sin recomendada si la primera es la actual,
 * y el aviso en el idioma pedido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { analyzeOrientations } from '../../engine/orient';
import { createPrimitiveMesh } from '../../engine/primitives';
import { input } from '../../engine/__tests__/orientShapes';
import { t } from '../../i18n';
import { orientAnalysisToUser } from '../../store/orientCommandSchemas';
import { recommendedId, showBaseWarning, summaryText } from '../orient/orientView';

describe('Orientar: aviso «sin base estable»', () => {
  it('esfera: equivalentes, sin «ya es la mejor» y con el aviso en app y comando', async () => {
    const a = analyzeOrientations(input(await createPrimitiveMesh('sphere', { radius: 20, segments: 48 })));
    expect(a.baseStatus).toBe('noStableBase');
    expect(summaryText('es', a)).not.toBe(t('es', 'orient.ui.summary.best'));
    expect(showBaseWarning(a)).toBe(true);
    const user = orientAnalysisToUser(a, 'en');
    expect(user.currentIsBest).toBe(false);
    expect(user.baseStatus).toBe('noStableBase');
    expect(user.warnings).toEqual([{ key: 'noStableBase', text: t('en', 'orient.ui.noStableBase') }]);
  });

  it('la primera es la actual sin base: no hay recomendada y el resumen es el aviso', async () => {
    const a = analyzeOrientations(input(await createPrimitiveMesh('sphere', { radius: 20, segments: 48 })));
    const forced = { ...a, allEquivalent: false };
    expect(forced.candidates[0].id).toBe(forced.currentId);
    expect(recommendedId(forced)).toBeNull();
    expect(summaryText('es', forced)).toBe(t('es', 'orient.ui.noStableBase'));
    expect(showBaseWarning(forced)).toBe(false);
    expect(orientAnalysisToUser(forced, 'es').recommendedId).toBeNull();
  });

  it('una caja apoyada: estado normal, sin aviso', async () => {
    const a = analyzeOrientations(input(await createPrimitiveMesh('box', { width: 20, height: 10, depth: 20 })));
    expect(a.baseStatus).toBe('ok');
    expect(showBaseWarning(a)).toBe(false);
    expect(orientAnalysisToUser(a, 'es').warnings).toEqual([]);
  });
});
