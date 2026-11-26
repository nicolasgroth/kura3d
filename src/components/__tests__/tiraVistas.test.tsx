/**
 * @file src/components/__tests__/tiraVistas.test.tsx
 * @description Lote «tira de vistas»: el selector de vista ya no vive en la barra del visor; el texto de la tira
 * cumple contraste >= 4,5:1 en los dos temas y la tira no se atenúa con opacidad; el consejo del visor es una línea con
 * un control expandible (`aria-expanded`); Simplificar, tras deshacer, reemplaza el informe por un «se deshizo»,
 * cierra el aviso y deja el foco en un control del panel; el informe rotula la tolerancia pedida.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { uvSphere } from '../../engine/__tests__/smoothFixtures';
import type { SimplifyReport } from '../../engine/simplify';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { SimplifyReportView } from '../inspector/SimplifyReportView';
import { SimplifySection } from '../inspector/SimplifySection';
import { ViewBar } from '../shell/ViewBar';
import { ViewportProTip } from '../viewport/ViewportProTip';
import { useInvalidFields } from '../useInvalidFields';

const ROOT = resolve(__dirname, '../../..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf-8');

afterEach(() => cleanup());

/** Luminancia relativa y contraste WCAG de dos colores #rrggbb. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('selector de vista fuera de la barra del visor', () => {
  it('la barra no trae el grupo «Modo de vista» aunque haya placas', () => {
    useKuraStore.setState({ language: 'es', plates: [{ id: 'p1', name: 'Placa 1', origin: [0, 0] }, { id: 'p2', name: 'Placa 2', origin: [300, 0] }] } as never);
    render(<ViewBar />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByTestId('viewmode-selector')).toBeNull();
  });
});

describe('contraste de la tira de placas', () => {
  const tokens = read('src/styles/studio-tokens.css');
  const token = (name: string) => tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))![1];
  const TEXT = ['text-primary', 'text-secondary', 'text-muted', 'accent-green', 'accent-red'];

  it('todo color de texto de la tira pasa 4,5:1 sobre el panel, en claro y en oscuro', () => {
    for (const theme of ['light', 'dark']) {
      const bg = token(`bg-panel-${theme}`);
      for (const name of TEXT) expect(contrast(token(`${name}-${theme}`), bg), `${name} ${theme}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('la tira no se atenúa con opacidad en Armado ni en Libre', () => {
    const css = `${read('src/styles/viewMode.css')}\n${read('src/styles/plateStrip.css')}`;
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) => /plate-strip|viewmode/.test(m[1]) && !/:disabled|bedchip/.test(m[1]));
    for (const [, selector, body] of rules) expect(body, selector).not.toMatch(/opacity\s*:/);
  });
});

describe('consejo del visor', () => {
  beforeEach(() => useKuraStore.setState({ language: 'es', activeTool: 'select' } as never));

  it('es una línea truncada con un control que lo expande (aria-expanded)', () => {
    render(<ViewportProTip />);
    const text = document.querySelector('.kura-protip-text')!;
    const toggle = screen.getByTestId('protip-expand');
    expect(text.classList.contains('is-clamped')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(text.id);
    expect(toggle.getAttribute('aria-label')).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(text.classList.contains('is-expanded')).toBe(true);
  });
});

describe('Simplificar: informe, deshacer y foco', () => {
  const REPORT: SimplifyReport = {
    mode: 'tolerance', applied: true, appliedVariant: 'requested', toleranceMm: 0.25, trianglesBefore: 1000, trianglesAfter: 495, volumeBeforeMm3: 4000,
    volumeAfterMm3: 3960, volumeChangePct: -1, genusBefore: 0, genusAfter: 0, maxDeviationMm: 0.1, deviationSamples: 2000,
    warnings: [], rejectedBy: [], ms: 10,
  };

  const Harness: React.FC<{ id: string }> = ({ id }) => {
    const invalid = useInvalidFields();
    const obj = useKuraStore((s) => s.objects.find((o) => o.id === id))!;
    return <SimplifySection primary={obj} toleranceMm={0.01} setToleranceMm={() => {}} invalid={invalid} />;
  };

  it('rotula lo pedido y lo medido por separado', () => {
    render(<SimplifyReportView report={REPORT} language="es" />);
    const text = screen.getByTestId('simplify-report').textContent ?? '';
    expect(text).toContain('Tolerancia pedida: 0,25 mm');
    expect(text).toContain('Desviación medida: 0,1 mm');
    cleanup();
    render(<SimplifyReportView report={{ ...REPORT, mode: 'target' }} language="es" />);
    expect(screen.getByTestId('simplify-report').textContent).toContain('Tolerancia usada');
  });

  it('tras deshacer: el informe dice que se deshizo, el aviso se cierra y el foco va a «Vista previa»', async () => {
    const obj = buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh: uvSphere(10, 32, 16) });
    useKuraStore.setState({ objects: [obj], selectedIds: [obj.id], language: 'es', busyOperation: null, toasts: [], past: [], future: [] });
    render(<Harness id={obj.id} />);
    act(() => useKuraStore.setState({
      simplifySelectedMesh: async (_id, _request, options) => {
        useKuraStore.setState({ past: [{ label: 'simplify' } as never] });
        options?.onReport?.(REPORT);
        useKuraStore.getState().addToast('Se aplicó…', 'success', {
          label: 'Deshacer', run: () => {}, closeOnUndo: true, applicable: () => useKuraStore.getState().past.length === 1,
        });
        return true;
      },
    }));
    fireEvent.click(screen.getByRole('button', { name: t('es', 'inspector.pro.simplifyBtn') }));
    const undo = await screen.findByTestId('simplify-report-undo');
    expect(useKuraStore.getState().toasts).toHaveLength(1);
    // El botón pulsado desaparece con el informe; el foco no puede quedar en `document.body`.
    undo.focus();
    act(() => {
      useKuraStore.setState({ past: [] });
      useKuraStore.getState().undo();
    });
    await waitFor(() => expect(screen.getByTestId('simplify-undone').textContent).toBe(t('es', 'simplify.report.undone')));
    expect(screen.queryByTestId('simplify-report')).toBeNull();
    expect(screen.queryByText('Se aplicó…')).toBeNull();
    expect(useKuraStore.getState().toasts).toHaveLength(0);
    expect(document.activeElement).toBe(screen.getByTestId('simplify-preview'));
  });
});
