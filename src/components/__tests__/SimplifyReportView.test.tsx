/**
 * @file src/components/__tests__/SimplifyReportView.test.tsx
 * @description El informe de Simplificar no muestra filas sin significado cuando no se aplicó nada, y con un resultado
 * destructivo dice por qué y ofrece la versión segura y «Aplicar de todos modos» (cada una pide al store su comando).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SimplifyReport } from '../../engine/simplify';
import { useKuraStore } from '../../store/useKuraStore';
import { SimplifyReportView } from '../inspector/SimplifyReportView';

const BASE: SimplifyReport = {
  mode: 'lossless', applied: false, appliedVariant: 'none', toleranceMm: 0.001, trianglesBefore: 12, trianglesAfter: 12, volumeBeforeMm3: 1000,
  volumeAfterMm3: 1000, volumeChangePct: 0, genusBefore: 0, genusAfter: 0, maxDeviationMm: 0, deviationSamples: 0,
  warnings: ['no_reduction'], rejectedBy: [], ms: 1,
};

const BLOCKED: SimplifyReport = {
  ...BASE, mode: 'target', objectId: 't1', trianglesBefore: 2304, trianglesAfter: 40, volumeChangePct: -99.4, genusBefore: 1,
  genusAfter: 0, maxDeviationMm: 33, warnings: ['genus_changed'], target: { triangles: 40, reached: true, iterations: 5, stoppedBy: 'reached' },
  destructive: ['holes_lost', 'volume_changed'], destructiveLimitMm: 1,
  safe: { toleranceMm: 0.25, triangles: 300, volumeAfterMm3: 990, volumeChangePct: -1, genusAfter: 1, maxDeviationMm: 0.2 },
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

  it('destructivo: dice por qué, muestra las dos alternativas y aplica la elegida en el objeto', async () => {
    const calls: unknown[] = [];
    const prev = useKuraStore.getState().simplifySelectedMesh;
    useKuraStore.setState({
      simplifySelectedMesh: async (id, request, options) => {
        calls.push([id, request]);
        options?.onReport?.({ ...BLOCKED, applied: true, destructive: [], safe: undefined, trianglesAfter: 300 });
        return true;
      },
    });
    try {
      render(<SimplifyReportView report={BLOCKED} language="es" />);
      const text = screen.getByTestId('simplify-blocked').textContent ?? '';
      expect(text).toContain('No se aplicó porque');
      expect(text).toContain('se cierran agujeros pasantes (1 → 0)');
      expect(screen.getByTestId('simplify-blocked-aggressive').textContent).toContain('40');
      expect(screen.getByTestId('simplify-blocked-safe').textContent).toContain('300');
      expect(screen.getByTestId('simplify-apply-safe').textContent).toBe('Aplicar la versión segura (300 triángulos)');
      fireEvent.click(screen.getByTestId('simplify-apply-anyway'));
      expect(calls[0]).toEqual(['t1', { mode: 'target', targetTriangles: 40, onDestructive: 'force' }]);
      await act(async () => { await Promise.resolve(); });
      expect(screen.queryByTestId('simplify-blocked')).toBeNull();
    } finally {
      useKuraStore.setState({ simplifySelectedMesh: prev });
    }
  });

  it('destructivo: «Aplicar la versión segura» pide «Por tolerancia» con su tolerancia', () => {
    const calls: unknown[] = [];
    const prev = useKuraStore.getState().simplifySelectedMesh;
    useKuraStore.setState({ simplifySelectedMesh: async (id, request) => { calls.push([id, request]); return false; } });
    try {
      render(<SimplifyReportView report={BLOCKED} language="es" />);
      fireEvent.click(screen.getByTestId('simplify-apply-safe'));
      expect(calls[0]).toEqual(['t1', { mode: 'tolerance', toleranceMm: 0.25 }]);
    } finally {
      useKuraStore.setState({ simplifySelectedMesh: prev });
    }
  });

  it('aplicado: conserva todas las filas', () => {
    render(<SimplifyReportView report={{ ...BASE, applied: true, trianglesAfter: 6, warnings: [] }} language="es" />);
    const text = screen.getByTestId('simplify-report').textContent ?? '';
    expect(text).toContain('Tolerancia usada');
    expect(text).toContain('Volumen');
  });
});
