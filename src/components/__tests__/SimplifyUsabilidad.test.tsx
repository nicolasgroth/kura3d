/**
 * @file src/components/__tests__/SimplifyUsabilidad.test.tsx
 * @description Usabilidad del panel Simplificar: Tab sigue a los controles propios (los botones con valor inválido quedan
 * en el orden de Tab con `aria-disabled`), Enter en un campo pide la vista previa y nunca aplica ni refina, el foco va
 * al informe tras «Aplicar de todos modos», el informe de la versión segura separa lo aplicado de lo pedido, los avisos
 * de la vista previa van en condicional, el avance por pasos aparece también al aplicar, la malla abierta se avisa al
 * abrir el panel, el mensaje dice que se aplicó la versión segura y los números siguen una sola regla de decimales.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { uvSphere } from '../../engine/__tests__/smoothFixtures';
import type { SimplifyReport } from '../../engine/simplify';
import { t } from '../../i18n';
import { simplifyMm, simplifyPct } from '../../i18n/simplifyNumbers';
import { useKuraStore } from '../../store/useKuraStore';
import { MeshRefinePanel } from '../inspector/MeshRefinePanel';
import type { InspectorSectionProps } from '../inspector/inspectorTypes';
import { SimplifyReportView } from '../inspector/SimplifyReportView';
import { SimplifySection } from '../inspector/SimplifySection';
import { parseSimplifyStep, simplifyStepLabel } from '../viewport/simplifyProgress';
import { useInvalidFields } from '../useInvalidFields';

// jsdom no calcula diseño: todo elemento conectado cuenta como visible.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    return (this.isConnected ? [{}] : []) as unknown as DOMRectList;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useKuraStore.setState({ simplifyPreview: null, busyOperation: null, busyProgress: null });
});

const Harness: React.FC<{ id: string }> = ({ id }) => {
  const invalid = useInvalidFields();
  const obj = useKuraStore((s) => s.objects.find((o) => o.id === id))!;
  return <SimplifySection primary={obj} toleranceMm={0.01} setToleranceMm={() => {}} invalid={invalid} />;
};

const PanelHarness: React.FC<{ id: string }> = ({ id }) => {
  const obj = useKuraStore((s) => s.objects.find((o) => o.id === id))!;
  const ui = { simplifyTolMm: 0.01, setSimplifyTolMm: () => {}, refineEdgeMm: 1.5, setRefineEdgeMm: () => {}, refineSmooth: false, setRefineSmooth: () => {} };
  return <MeshRefinePanel primary={obj} ui={ui as unknown as InspectorSectionProps['ui']} {...({} as Record<string, never>)} />;
};

function mount(opts: { manifold?: boolean; panel?: boolean } = {}) {
  const base = buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh: uvSphere(10, 32, 16) });
  const obj = { ...base, stats: { ...base.stats, isManifold: opts.manifold ?? true } };
  useKuraStore.setState({ objects: [obj], selectedIds: [obj.id], language: 'es', busyOperation: null, toasts: [], past: [], future: [], simplifyPreview: null });
  render(opts.panel ? <PanelHarness id={obj.id} /> : <Harness id={obj.id} />);
  return obj;
}

const SAFE_APPLIED: SimplifyReport = {
  mode: 'tolerance', objectId: 'sph', applied: true, appliedVariant: 'safe', toleranceMm: 0.25, askedToleranceMm: 2,
  trianglesBefore: 1000, trianglesAfter: 476, volumeBeforeMm3: 4000, volumeAfterMm3: 3990, volumeChangePct: -0.25,
  genusBefore: 1, genusAfter: 1, maxDeviationMm: 0.2, deviationSamples: 900, warnings: [], rejectedBy: [],
  destructive: ['volume_changed'], ms: 4,
  requested: { toleranceMm: 2, triangles: 256, volumeAfterMm3: 3780, volumeChangePct: -5.4, genusAfter: 0, maxDeviationMm: 1.7 },
  limits: { noticeVolumePct: 5, noticeDeviationMm: 1, destructiveVolumePct: 5, destructiveDeviationMm: 12.5, minSideMm: 50, minTriangles: 4 },
} as SimplifyReport;

describe('Simplificar: Tab y Enter', () => {
  it('con un valor inválido, «Vista previa» y «Simplificar» siguen en el orden de Tab (aria-disabled) y no actúan', () => {
    mount();
    fireEvent.change(screen.getByLabelText(t('es', 'simplify.mode')), { target: { value: 'target' } });
    const input = screen.getByLabelText(t('es', 'simplify.target.percent'));
    const preview = vi.fn(async () => null);
    useKuraStore.setState({ previewSimplify: preview as never });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.blur(input);
    const btn = screen.getByTestId('simplify-preview') as HTMLButtonElement;
    const run = screen.getByTestId('simplify-run') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(run.disabled).toBe(false);
    expect(run.getAttribute('aria-disabled')).toBe('true');
    expect(btn.getAttribute('aria-describedby')).toBe(screen.getByTestId('simplify-invalid-hint').id);
    fireEvent.click(btn);
    fireEvent.click(run);
    expect(preview).not.toHaveBeenCalled();
  });

  it('Enter en un campo de Simplificar pide la vista previa y nunca aplica ni refina', async () => {
    mount({ panel: true });
    const preview = vi.fn(async () => null);
    const apply = vi.fn(async () => true);
    const refine = vi.fn(async () => true);
    useKuraStore.setState({ previewSimplify: preview as never, simplifySelectedMesh: apply as never, refineSelectedMesh: refine as never });
    fireEvent.change(screen.getByLabelText(t('es', 'simplify.mode')), { target: { value: 'target' } });
    const input = screen.getByLabelText(t('es', 'simplify.target.percent'));
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(preview).toHaveBeenCalledTimes(1));
    expect(apply).not.toHaveBeenCalled();
    expect(refine).not.toHaveBeenCalled();
  });

  it('Enter en «Arista objetivo» de Refinar no refina ni pide nada de Simplificar', async () => {
    mount({ panel: true });
    const preview = vi.fn(async () => null);
    const refine = vi.fn(async () => true);
    useKuraStore.setState({ previewSimplify: preview as never, refineSelectedMesh: refine as never });
    const edge = screen.getByLabelText(t('es', 'inspector.pro.refineEdge'));
    fireEvent.focus(edge);
    fireEvent.keyDown(edge, { key: 'Enter' });
    await new Promise((r) => setTimeout(r, 20));
    expect(refine).not.toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
  });

  it('un campo inválido de Simplificar no bloquea «Refinar» (cada uno con sus campos)', () => {
    mount({ panel: true });
    fireEvent.change(screen.getByLabelText(t('es', 'simplify.mode')), { target: { value: 'target' } });
    const input = screen.getByLabelText(t('es', 'simplify.target.percent'));
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.blur(input);
    expect(screen.getByTestId('simplify-preview').getAttribute('aria-disabled')).toBe('true');
    const refineBtn = screen.getByRole('button', { name: t('es', 'inspector.pro.refineBtn') });
    expect(refineBtn.getAttribute('aria-disabled')).toBeNull();
  });
});

describe('Simplificar: foco', () => {
  it('«Aplicar de todos modos» deja el foco en el informe del resultado, no en <body>', async () => {
    mount();
    const forcedReport: SimplifyReport = { ...SAFE_APPLIED, appliedVariant: 'requested', requested: undefined, destructive: [], forced: true, trianglesAfter: 256, toleranceMm: 2 };
    // Primero el resultado con la versión segura aplicada (con su «Deshacer»), ya en el panel.
    act(() => useKuraStore.setState({
      past: [{} as never], undo: (() => {}) as never,
      simplifySelectedMesh: (async (_id: string, _req: unknown, o: { onReport?: (r: SimplifyReport) => void }) => { o.onReport?.(SAFE_APPLIED); return true; }) as never,
    }));
    fireEvent.click(screen.getByTestId('simplify-run'));
    await screen.findByTestId('simplify-report');
    const anyway = await screen.findByTestId('simplify-apply-anyway');
    // «Aplicar de todos modos» tarda: el foco queda en «Cancelar» del panel (no en <body>) hasta que termina.
    let resolveApply: (ok: boolean) => void = () => {};
    act(() => useKuraStore.setState({
      simplifySelectedMesh: ((_id: string, _req: unknown, o: { onReport?: (r: SimplifyReport) => void }) => new Promise<boolean>((resolve) => {
        resolveApply = (ok) => { o.onReport?.(forcedReport); resolve(ok); };
      })) as never,
    }));
    anyway.focus();
    fireEvent.click(anyway);
    // Mientras calcula, el foco está en «Cancelar» del panel (no en <body>).
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('simplify-apply-cancel')));
    await act(async () => { resolveApply(true); });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('simplify-report')));
  });
});

describe('Simplificar: informe de la versión segura', () => {
  it('separa «Se aplicó (versión segura)» de «Lo pedido daría…», cada número en su bloque', () => {
    render(<SimplifyReportView report={SAFE_APPLIED} language="es" />);
    const applied = screen.getByTestId('simplify-block-applied');
    const asked = screen.getByTestId('simplify-block-requested');
    expect(applied.textContent).toContain('Se aplicó (versión segura)');
    expect(applied.textContent).toContain('Triángulos: 1.000 → 476');
    expect(applied.textContent).toContain('Desviación medida: 0,20 mm');
    expect(applied.textContent).toContain('Tolerancia usada: 0,25 mm');
    expect(asked.textContent).toContain('Lo pedido daría…');
    expect(asked.textContent).toContain('Triángulos: 1.000 → 256');
    expect(asked.textContent).toContain('Volumen: -5,4 %');
    expect(asked.textContent).toContain('Desviación medida: 1,70 mm');
    expect(asked.textContent).toContain('Tolerancia pedida: 2,00 mm');
    // Ningún número suelto fuera de los dos bloques: la lista genérica no se repite.
    const loose = Array.from(document.querySelectorAll('.kura-simplify-report-list')).filter((ul) => !ul.closest('.kura-simplify-result-block'));
    expect(loose).toHaveLength(0);
  });

  it('en la vista previa los encabezados van en condicional', () => {
    render(<SimplifyReportView report={SAFE_APPLIED} language="es" preview />);
    expect(screen.getByTestId('simplify-block-applied').textContent).toContain('Se aplicaría (versión segura)');
  });

  it('los avisos de la vista previa van en condicional y los de lo ya aplicado en pasado', () => {
    const notice = { ...SAFE_APPLIED, appliedVariant: 'requested', requested: undefined, destructive: [], volumeChangePct: -5.4, maxDeviationMm: 1.7, warnings: ['volume_changed', 'deviation_high'] } as SimplifyReport;
    const { unmount } = render(<SimplifyReportView report={notice} language="es" preview />);
    const preview = screen.getByTestId('simplify-report-warnings').textContent ?? '';
    expect(preview).toContain('El volumen cambiaría -5,4 %');
    expect(preview).toContain('La superficie se movería hasta 1,70 mm');
    unmount();
    render(<SimplifyReportView report={notice} language="es" />);
    const applied = screen.getByTestId('simplify-report-warnings').textContent ?? '';
    expect(applied).toContain('El volumen cambió -5,4 %');
    expect(applied).toContain('La superficie se movió hasta 1,70 mm');
  });

  it('sin aplicar, la vista previa dice que no se aplicaría', () => {
    const none = { ...SAFE_APPLIED, applied: false, appliedVariant: 'none', requested: undefined, destructive: [], warnings: ['no_reduction'] } as SimplifyReport;
    render(<SimplifyReportView report={none} language="es" preview />);
    expect(screen.getByTestId('simplify-report').textContent).toContain(t('es', 'simplify.preview.notApplied'));
    expect(screen.getByTestId('simplify-report-warnings').textContent).toContain('No habría triángulos que quitar.');
  });
});

describe('Simplificar: avance durante el cálculo', () => {
  it('al aplicar muestra «paso i de n» con barra de avance real (peldaños de la escalera de tolerancias)', () => {
    mount();
    fireEvent.change(screen.getByLabelText(t('es', 'simplify.mode')), { target: { value: 'tolerance' } });
    const apply = vi.fn(() => new Promise<boolean>(() => {}));
    useKuraStore.setState({ simplifySelectedMesh: apply as never });
    fireEvent.click(screen.getByTestId('simplify-run'));
    act(() => useKuraStore.setState({ busyProgress: { name: 'simplify', phase: 'simplify:3/13', startedAt: Date.now(), cancellable: true } }));
    const bar = screen.getByTestId('simplify-apply-steps') as HTMLProgressElement;
    expect(bar.max).toBe(13);
    expect(bar.value).toBe(3);
    expect(bar.getAttribute('aria-valuetext')).toBe('Probando tolerancias: paso 3 de 13');
    expect(screen.getByTestId('simplify-apply-phase').textContent).toBe('Probando tolerancias: paso 3 de 13');
    expect(document.activeElement).toBe(screen.getByTestId('simplify-apply-cancel'));
  });

  it('las etapas «intento» y «versión segura» conservan su texto', () => {
    expect(simplifyStepLabel('es', parseSimplifyStep('simplify:3/12')!)).toBe('Ajustando al objetivo: intento 3 de 12');
    expect(simplifyStepLabel('es', parseSimplifyStep('simplify:safe:2/8')!, 'tolerance')).toBe('Buscando la versión segura: paso 2 de 8');
  });
});

describe('Simplificar: malla abierta', () => {
  it('el aviso con «Reparar malla» aparece al abrir el panel si la pieza no es un sólido cerrado', () => {
    mount({ manifold: false });
    expect(screen.getByTestId('simplify-open-mesh')).toBeTruthy();
    expect(screen.getByTestId('simplify-open-mesh-repair')).toBeTruthy();
  });

  it('con una malla cerrada no hay aviso', () => {
    mount({ manifold: true });
    expect(screen.queryByTestId('simplify-open-mesh')).toBeNull();
  });

  it('mientras repara, el botón conserva el foco y dice «Reparando…»; al terminar, el foco vuelve a «Vista previa»', async () => {
    mount({ manifold: false });
    let done: () => void = () => {};
    act(() => useKuraStore.setState({
      repairObjectMesh: (() => new Promise((resolve) => {
        done = () => {
          useKuraStore.setState((st) => ({ objects: st.objects.map((o) => ({ ...o, mesh: { ...o.mesh }, stats: { ...o.stats, isManifold: true } })) }));
          resolve(null);
        };
      })) as never,
    }));
    const repair = screen.getByTestId('simplify-open-mesh-repair');
    repair.focus();
    fireEvent.click(repair);
    expect(screen.getByTestId('simplify-open-mesh-repairing').textContent).toBe(t('es', 'simplify.error.repairing'));
    expect(document.activeElement).toBe(repair);
    await act(async () => { done(); });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('simplify-preview')));
  });
});

describe('Simplificar: mensaje y números', () => {
  it('el texto del mensaje de la versión segura (el flujo completo está en store/__tests__/simplifyToastSafe)', () => {
    expect(t('es', 'simplify.toast.shortSafe', { before: '1.000', after: '476' })).toBe('Se aplicó la versión segura: 1.000 → 476 triángulos');
  });

  it('una sola regla: mm con 2 decimales, % con 1, coma decimal, y nunca un valor real como cero', () => {
    expect(simplifyMm('es', 0.2)).toBe('0,20');
    expect(simplifyMm('en', 1.7)).toBe('1.70');
    expect(simplifyMm('es', 0.001)).toBe('0,001');
    expect(simplifyPct('es', 12.345)).toBe('12,3');
    expect(simplifyPct('es', -5.4, true)).toBe('-5,4');
    expect(simplifyPct('es', 0.02, true)).toBe('+0,02');
    expect(simplifyPct('es', 0, true)).toBe('0,0');
  });
});
