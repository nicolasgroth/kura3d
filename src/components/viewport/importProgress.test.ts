/**
 * @file src/components/viewport/importProgress.test.ts
 * @description Textos de las fases de importación en la barra de progreso (etapas y piezas).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { importPartsPhase, importStagePhase } from '../../store/importPhase';
import { importPhaseLabel, parseImportParts } from './importProgress';

describe('fases de importación', () => {
  it('etapas en lenguaje claro', () => {
    expect(importPhaseLabel('es', importStagePhase('read'))).toBe('Leyendo archivo…');
    expect(importPhaseLabel('es', importStagePhase('parse'))).toBe('Interpretando…');
    expect(importPhaseLabel('es', importStagePhase('place'))).toBe('Colocando en la escena…');
    expect(importPhaseLabel('es', 'cut:1/3')).toBeNull();
  });

  it('avance por piezas con cifras del idioma y barra determinada', () => {
    expect(parseImportParts(importPartsPhase(7, 19))).toEqual({ done: 7, total: 19 });
    expect(importPhaseLabel('es', importPartsPhase(7, 19))).toBe('7 de 19 piezas');
    expect(importPhaseLabel('de', importPartsPhase(1200, 2000))).toBe('1.200 von 2.000 Teilen');
    expect(parseImportParts('import:parts:5/0')).toBeNull();
  });
});
