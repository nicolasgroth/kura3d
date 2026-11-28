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
    expect(asked.textContent).toContain('Volumen: −5,4 %');
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
    expect(preview).toContain('El volumen cambiaría −5,4 %');
    expect(preview).toContain('La superficie se movería hasta 1,70 mm');
    unmount();
    render(<SimplifyReportView report={notice} language="es" />);
    const applied = screen.getByTestId('simplify-report-warnings').textContent ?? '';
    expect(applied).toContain('El volumen cambió −5,4 %');
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
    expect(simplifyPct('es', -5.4, true)).toBe('−5,4');
    expect(simplifyPct('es', 0.02, true)).toBe('+0,02');
    expect(simplifyPct('es', 0, true)).toBe('0,0');
  });
});

describe('Simplificar: ronda 2', () => {
  it('malla abierta al abrir: advertencia honesta que deja seguir', () => {
    mount({ manifold: false });
    const text = screen.getByTestId('simplify-open-mesh-text').textContent ?? '';
    expect(text).toBe(t('es', 'simplify.error.meshOpenWarn'));
    expect(text).toContain('Si simplificas sin reparar');
    expect(text).not.toContain('repárala antes');
    expect((screen.getByTestId('simplify-run') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('simplify-run').getAttribute('aria-disabled')).toBeNull();
  });

  it('la ayuda de la tolerancia no promete un máximo y el informe advierte si la desviación la supera', () => {
    expect(t('es', 'simplify.mode.tolerance.help')).not.toMatch(/cuánto puede moverse/i);
    const rep = { ...SAFE_APPLIED, appliedVariant: 'requested', requested: undefined, destructive: [], askedToleranceMm: 0.1, toleranceMm: 0.02, maxDeviationMm: 1.48, warnings: [] } as SimplifyReport;
    const { unmount } = render(<SimplifyReportView report={rep} language="es" />);
    expect(screen.getByTestId('simplify-deviation-over').textContent).toBe('La desviación medida (1,48 mm) supera la tolerancia pedida (0,10 mm).');
    unmount();
    render(<SimplifyReportView report={rep} language="es" preview />);
    expect(screen.getByTestId('simplify-deviation-over').textContent).toContain('superaría la tolerancia pedida');
  });

  it('en el bloque de la versión segura, la desviación sobre la tolerancia usada también se advierte', () => {
    const rep = { ...SAFE_APPLIED, maxDeviationMm: 0.9 } as SimplifyReport;
    render(<SimplifyReportView report={rep} language="es" />);
    expect(screen.getByTestId('simplify-block-applied').textContent).toContain('supera la tolerancia usada (0,25 mm)');
  });

  it('Esc en un campo inválido restaura el valor y el foco se queda en el campo', async () => {
    mount();
    fireEvent.change(screen.getByLabelText(t('es', 'simplify.mode')), { target: { value: 'target' } });
    const input = screen.getByLabelText(t('es', 'simplify.target.percent')) as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(input.value).toBe('50');
  });

  it('Enter con un valor inválido deja el foco en el campo (no salta a «Vista previa»)', async () => {
    mount();
    fireEvent.change(screen.getByLabelText(t('es', 'simplify.mode')), { target: { value: 'target' } });
    const input = screen.getByLabelText(t('es', 'simplify.target.percent')) as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it('«Por cantidad»: un objetivo mayor que los triángulos actuales se marca en el campo y no deja avanzar', () => {
    const obj = mount();
    fireEvent.change(screen.getByLabelText(t('es', 'simplify.mode')), { target: { value: 'target' } });
    fireEvent.change(screen.getByLabelText(t('es', 'simplify.target.kind')), { target: { value: 'count' } });
    const field = screen.getByLabelText(t('es', 'simplify.target.count')) as HTMLInputElement;
    const preview = vi.fn(async () => null);
    useKuraStore.setState({ previewSimplify: preview as never });
    field.focus();
    fireEvent.change(field, { target: { value: String(obj.stats.triangles + 100) } });
    fireEvent.blur(field);
    const msg = screen.getByTestId('simplify-target-exceeds');
    expect(msg.textContent).toContain('supera los triángulos actuales');
    expect(field.getAttribute('aria-describedby')).toContain(msg.id);
    expect(screen.getByTestId('simplify-preview').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByTestId('simplify-preview'));
    expect(preview).not.toHaveBeenCalled();
  });

  it('«Por cantidad»: el informe dice si no se alcanzó el objetivo o si quedó por debajo', () => {
    const base = { ...SAFE_APPLIED, mode: 'target', appliedVariant: 'requested', requested: undefined, destructive: [], warnings: ['target_not_reached'], trianglesBefore: 100000, trianglesAfter: 47290, target: { triangles: 20000, reached: false, iterations: 8, stoppedBy: 'iterations' } } as SimplifyReport;
    const { unmount } = render(<SimplifyReportView report={base} language="es" />);
    expect(screen.getByTestId('simplify-target-result').textContent).toBe('No se alcanzó el objetivo: quedan 47.290 triángulos, pedías 20.000.');
    // La advertencia del motor dice lo mismo: no se repite.
    expect(screen.queryByTestId('simplify-report-warnings')).toBeNull();
    unmount();
    const below = { ...base, trianglesAfter: 80, warnings: [], target: { triangles: 100, reached: true, iterations: 3, stoppedBy: 'reached' } } as SimplifyReport;
    render(<SimplifyReportView report={below} language="es" preview />);
    expect(screen.getByTestId('simplify-target-result').textContent).toBe('Quedarían 80 triángulos, menos que los 100 pedidos.');
  });

  it('cambiar el modo retira el informe anterior; cancelar deja «Vista previa cancelada»', async () => {
    mount();
    const run = vi.fn(async (_id: string, _req: unknown, o: { onReport?: (r: SimplifyReport) => void }) => { o.onReport?.({ ...SAFE_APPLIED, appliedVariant: 'requested', requested: undefined, destructive: [], mode: 'lossless' } as SimplifyReport); return true; });
    act(() => useKuraStore.setState({ simplifySelectedMesh: run as never }));
    fireEvent.click(screen.getByTestId('simplify-run'));
    await screen.findByTestId('simplify-report');
    fireEvent.change(screen.getByLabelText(t('es', 'simplify.mode')), { target: { value: 'target' } });
    expect(screen.queryByTestId('simplify-report')).toBeNull();
    act(() => useKuraStore.setState({
      previewSimplify: (async (id: string) => {
        useKuraStore.setState({ simplifyPreview: { objectId: id, status: 'computing', phase: null, signature: 'x', report: null, error: null, comparing: false, edges: true, ghost: 'none', ghostTriangles: 0, variant: 'applied', hasRequested: false } });
        return null;
      }) as never,
    }));
    fireEvent.click(screen.getByTestId('simplify-preview'));
    fireEvent.click(await screen.findByTestId('simplify-preview-cancel'));
    expect(screen.getByTestId('simplify-preview-cancelled').textContent).toBe('Vista previa cancelada.');
  });

  it('números del informe: volumen muy chico es «menos de 0,1 %», cero es «sin cambio»; sin tolerancia en Sin pérdida', () => {
    const tiny = { ...SAFE_APPLIED, mode: 'lossless', appliedVariant: 'requested', requested: undefined, destructive: [], warnings: [], volumeChangePct: -0.00001, askedToleranceMm: undefined, toleranceMm: 0.001 } as SimplifyReport;
    const { unmount } = render(<SimplifyReportView report={tiny} language="es" />);
    let txt = screen.getByTestId('simplify-report').textContent ?? '';
    expect(txt).toContain('Volumen: menos de 0,1 %');
    expect(txt).not.toContain('Tolerancia');
    unmount();
    render(<SimplifyReportView report={{ ...tiny, volumeChangePct: 0 }} language="es" />);
    txt = screen.getByTestId('simplify-report').textContent ?? '';
    expect(txt).toContain('Volumen: sin cambio');
  });

  it('bloqueo en la vista previa: todo el bloque en condicional; tras aplicar, en pasado', () => {
    const blocked = { ...SAFE_APPLIED, applied: false, appliedVariant: 'none', requested: undefined, destructive: ['holes_lost', 'volume_changed'], safe: null, genusAfter: 0, volumeChangePct: -32.9 } as SimplifyReport;
    const { unmount } = render(<SimplifyReportView report={blocked} language="es" preview />);
    const p = screen.getByTestId('simplify-blocked').textContent ?? '';
    expect(p).toContain('Se cerrarían agujeros pasantes');
    expect(p).toContain('El volumen cambiaría');
    expect(p).not.toContain('Se cierran');
    unmount();
    render(<SimplifyReportView report={blocked} language="es" />);
    expect(screen.getByTestId('simplify-blocked').textContent).toContain('Se cerraban agujeros pasantes');
  });

  it('la barra de acciones es una pieza fija (pie) que contiene los botones y el estado', () => {
    mount();
    const footer = document.querySelector('.kura-simplify-footer')!;
    expect(footer.contains(screen.getByTestId('simplify-preview'))).toBe(true);
    expect(footer.contains(screen.getByTestId('simplify-run'))).toBe(true);
  });
});
