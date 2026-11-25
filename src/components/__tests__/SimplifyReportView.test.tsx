/**
 * @file src/components/__tests__/SimplifyReportView.test.tsx
 * @description El informe de Simplificar no muestra filas sin significado (volumen, tolerancia, desviación) cuando no se aplicó nada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SimplifyReport } from '../../engine/simplify';
import { SimplifyReportView } from '../inspector/SimplifyReportView';

const BASE: SimplifyReport = {
  mode: 'lossless', applied: false, toleranceMm: 0.001, trianglesBefore: 12, trianglesAfter: 12, volumeBeforeMm3: 1000,
  volumeAfterMm3: 1000, volumeChangePct: 0, genusBefore: 0, genusAfter: 0, maxDeviationMm: 0, deviationSamples: 0,
  warnings: ['no_reduction'], rejectedBy: [], ms: 1,
};

describe('SimplifyReportView', () => {
  it('sin aplicar: solo triángulos y el aviso, sin volumen ni tolerancia', () => {
    render(<SimplifyReportView report={BASE} language="es" />);
    const text = screen.getByTestId('simplify-report').textContent ?? '';
    expect(text).toContain('No se aplicó');
    expect(text).toContain('12');
    expect(text).not.toContain('Tolerancia usada');
    expect(text).not.toContain('Volumen');
  });

  it('aplicado: conserva todas las filas', () => {
    render(<SimplifyReportView report={{ ...BASE, applied: true, trianglesAfter: 6, warnings: [] }} language="es" />);
    const text = screen.getByTestId('simplify-report').textContent ?? '';
    expect(text).toContain('Tolerancia usada');
    expect(text).toContain('Volumen');
  });
});
