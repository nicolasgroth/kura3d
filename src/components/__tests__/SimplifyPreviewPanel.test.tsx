/**
 * @file src/components/__tests__/SimplifyPreviewPanel.test.tsx
 * @description Panel de Simplificar con vista previa y versión segura aplicada: «Vista previa» pide el informe al
 * store con los parámetros del panel y lo muestra como vista previa (sin «Deshacer» ni botones que apliquen);
 * mientras calcula se puede cancelar; el informe de la segura aplicada dice los dos números y «Aplicar de todos
 * modos» deshace la segura y aplica lo pedido; el panel bloqueado sin segura dice que no hay reducción segura y deja
 * los botones antes del detalle. (El motor no corre en jsdom: las acciones del store se sustituyen.)
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { uvSphere } from '../../engine/__tests__/smoothFixtures';
import type { SimplifyReport, SimplifyRequest } from '../../engine/simplify';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { t } from '../../i18n';
import { SIMPLIFY_GHOST_DEFAULTS, simplifySignature } from '../../store/slices/simplifyPreviewSlice';
import { useKuraStore } from '../../store/useKuraStore';
import { SimplifySection } from '../inspector/SimplifySection';
import { SimplifyReportView } from '../inspector/SimplifyReportView';
import { useInvalidFields } from '../useInvalidFields';

const Harness: React.FC<{ id: string }> = ({ id }) => {
  const invalid = useInvalidFields();
  const obj = useKuraStore((s) => s.objects.find((o) => o.id === id))!;
  return <SimplifySection primary={obj} toleranceMm={0.01} setToleranceMm={() => {}} invalid={invalid} />;
};

const SAFE_APPLIED: SimplifyReport = {
  mode: 'target', objectId: 'sph', applied: true, appliedVariant: 'safe', toleranceMm: 0.3, trianglesBefore: 512, trianglesAfter: 476,
  volumeBeforeMm3: 4000, volumeAfterMm3: 3990, volumeChangePct: -0.25, genusBefore: 0, genusAfter: 0, maxDeviationMm: 0.4,
  deviationSamples: 900, warnings: [], rejectedBy: [], target: { triangles: 256, reached: true, iterations: 4, stoppedBy: 'reached' },
  destructive: ['volume_changed'], destructiveLimitMm: 1,
  safe: { toleranceMm: 0.3, triangles: 476, volumeAfterMm3: 3990, volumeChangePct: -0.25, genusAfter: 0, maxDeviationMm: 0.4 },
  requested: { toleranceMm: 2, triangles: 256, volumeAfterMm3: 3784, volumeChangePct: -5.4, genusAfter: 0, maxDeviationMm: 1.7 },
  ms: 5,
};

async function mount() {
  const obj = buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh: uvSphere(10, 32, 16) });
  useKuraStore.setState({ objects: [obj], selectedIds: [obj.id], language: 'es', busyOperation: null, toasts: [], past: [], future: [], simplifyPreview: null });
  render(<Harness id={obj.id} />);
  return obj;
}

describe('Simplificar: vista previa en el panel', () => {
  beforeEach(() => useKuraStore.setState({ toasts: [], simplifyPreview: null }));

  it('«Vista previa» pide el informe con los parámetros del panel y lo muestra sin aplicar', async () => {
    await mount();
    const calls: SimplifyRequest[] = [];
    act(() => useKuraStore.setState({
      previewSimplify: async (id, request) => {
        calls.push(request);
        const report = { ...SAFE_APPLIED, objectId: id };
        useKuraStore.setState({ simplifyPreview: { objectId: id, status: 'ready', phase: null, signature: simplifySignature(request), report, error: null, ...SIMPLIFY_GHOST_DEFAULTS } });
        return report;
      },
    }));
    fireEvent.change(screen.getByLabelText(t('es', 'simplify.mode')), { target: { value: 'target' } });
    const btn = screen.getByTestId('simplify-preview');
    expect(btn.textContent).toBe(t('es', 'simplify.preview.btn'));
    expect(btn.getAttribute('title')).toBe(t('es', 'simplify.preview.btnHint'));
    fireEvent.click(btn);
    const report = await screen.findByTestId('simplify-report');
    expect(calls).toEqual([{ mode: 'target', targetPercent: 50 }]);
    expect(report.textContent).toContain(t('es', 'simplify.preview.title'));
    expect(screen.getByTestId('simplify-safe-applied-text').textContent).toContain('Al pulsar «Simplificar» se aplicaría la versión segura: 476 triángulos. Lo pedido dejaría 256 y cambiaría demasiado la forma.');
    expect(screen.queryByTestId('simplify-apply-anyway')).toBeNull();
    expect(screen.queryByTestId('simplify-report-undo')).toBeNull();
  });

  it('el informe de otros parámetros no se muestra como vista previa', async () => {
    await mount();
    act(() => useKuraStore.setState({
      simplifyPreview: { objectId: 'sph', status: 'ready', phase: null, signature: simplifySignature({ mode: 'target', targetPercent: 30 }), report: SAFE_APPLIED, error: null, ...SIMPLIFY_GHOST_DEFAULTS },
    }));
    expect(screen.queryByTestId('simplify-report')).toBeNull();
  });

  it('mientras calcula: «Vista previa» deshabilitado y «Cancelar» la cancela', async () => {
    await mount();
    let cancelled = 0;
    act(() => useKuraStore.setState({
      simplifyPreview: { objectId: 'sph', status: 'computing', phase: null, signature: simplifySignature({ mode: 'lossless' }), report: null, error: null, ...SIMPLIFY_GHOST_DEFAULTS },
      cancelSimplifyPreview: () => { cancelled++; },
    }));
    expect((screen.getByTestId('simplify-preview') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('simplify-preview-computing').textContent).toContain(t('es', 'simplify.preview.computing'));
    fireEvent.click(screen.getByTestId('simplify-preview-cancel'));
    expect(cancelled).toBe(1);
  });
});

describe('Simplificar: versión segura aplicada', () => {
  it('dice los dos números y «Aplicar de todos modos» deshace la segura y fuerza lo pedido', async () => {
    const steps: string[] = [];
    const calls: SimplifyRequest[] = [];
    useKuraStore.setState({ language: 'es', busyOperation: null, past: [{ label: 'simplify' } as never], undo: () => { steps.push('undo'); } });
    useKuraStore.setState({
      simplifySelectedMesh: async (_id, request, options) => {
        steps.push('apply');
        calls.push(request as SimplifyRequest);
        options?.onReport?.({ ...SAFE_APPLIED, appliedVariant: 'requested', trianglesAfter: 256, forced: true });
        return true;
      },
    });
    render(<SimplifyReportView report={SAFE_APPLIED} language="es" onUndo={() => useKuraStore.getState().undo()} />);
    expect(screen.getByTestId('simplify-safe-applied-text').textContent)
      .toContain('Se aplicó la versión segura: 476 triángulos. Lo pedido dejaba 256 y cambiaba demasiado la forma. El volumen cambia -5,4 %');
    fireEvent.click(screen.getByTestId('simplify-apply-anyway'));
    await waitFor(() => expect(steps).toEqual(['undo', 'apply']));
    expect(calls).toEqual([{ mode: 'target', targetTriangles: 256, onDestructive: 'force' }]);
  });

  it('sin segura útil: dice que no hay reducción segura y los botones van antes del detalle', () => {
    const blocked: SimplifyReport = { ...SAFE_APPLIED, applied: false, appliedVariant: 'none', safe: null, requested: undefined, trianglesAfter: 256 };
    render(<SimplifyReportView report={blocked} language="es" />);
    const box = screen.getByTestId('simplify-blocked');
    expect(screen.getByTestId('simplify-blocked-safe').textContent).toContain('No hay una reducción segura para esta pieza');
    expect(screen.queryByTestId('simplify-apply-safe')).toBeNull();
    const anyway = screen.getByTestId('simplify-apply-anyway');
    const detail = screen.getByTestId('simplify-blocked-aggressive');
    // El botón precede al detalle (visible sin desplazar).
    expect(anyway.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(box.contains(anyway)).toBe(true);
  });
});
