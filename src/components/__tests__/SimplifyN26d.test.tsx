/**
 * @file src/components/__tests__/SimplifyN26d.test.tsx
 * @description Panel de Simplificar, ronda N26d: la malla abierta se muestra como aviso (sin el término en inglés a
 * la vista) con «Reparar malla» que lanza la reparación de esa pieza; el informe abre con un resumen antes → después y
 * dice qué muestra el fantasma; mientras calcula la vista previa el foco queda en «Cancelar» y al cancelar vuelve a
 * «Vista previa»; el informe nuevo se desplaza hasta quedar a la vista.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uvSphere } from '../../engine/__tests__/smoothFixtures';
import type { SimplifyReport } from '../../engine/simplify';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { t } from '../../i18n';
import { SIMPLIFY_GHOST_DEFAULTS, simplifySignature } from '../../store/slices/simplifyPreviewSlice';
import { useKuraStore } from '../../store/useKuraStore';
import { SimplifyReportView } from '../inspector/SimplifyReportView';
import { SimplifySection } from '../inspector/SimplifySection';
import { useInvalidFields } from '../useInvalidFields';

const Harness: React.FC<{ id: string }> = ({ id }) => {
  const invalid = useInvalidFields();
  const obj = useKuraStore((s) => s.objects.find((o) => o.id === id))!;
  return <SimplifySection primary={obj} toleranceMm={0.01} setToleranceMm={() => {}} invalid={invalid} />;
};

const REPORT: SimplifyReport = {
  mode: 'lossless', objectId: 'sph', applied: true, appliedVariant: 'requested', toleranceMm: 0.01, trianglesBefore: 325648, trianglesAfter: 164244,
  volumeBeforeMm3: 4000, volumeAfterMm3: 3999, volumeChangePct: -0.02, genusBefore: 0, genusAfter: 0, maxDeviationMm: 0.001,
  deviationSamples: 900, warnings: [], rejectedBy: [], ms: 5,
} as unknown as SimplifyReport;

function mount() {
  const obj = buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh: uvSphere(10, 32, 16) });
  useKuraStore.setState({ objects: [obj], selectedIds: [obj.id], language: 'es', busyOperation: null, toasts: [], past: [], future: [], simplifyPreview: null });
  render(<Harness id={obj.id} />);
  return obj;
}

describe('Simplificar: malla abierta', () => {
  beforeEach(() => useKuraStore.setState({ toasts: [], simplifyPreview: null }));

  it('aviso con «Reparar malla» que repara esa pieza; el término técnico queda plegado', async () => {
    const obj = mount();
    const repair = vi.fn(async () => null);
    act(() => useKuraStore.setState({
      repairObjectMesh: repair as never,
      previewSimplify: async (id, request) => {
        useKuraStore.setState({
          simplifyPreview: {
            objectId: id, status: 'error', phase: null, signature: simplifySignature(request), report: null, error: 'La malla no es un sólido cerrado válido (NotManifold): usa «Reparar malla».',
            errorCode: 'MESH_INVALID', errorDetail: 'NotManifold', ...SIMPLIFY_GHOST_DEFAULTS,
          },
        });
        return null;
      },
    }));
    fireEvent.click(screen.getByTestId('simplify-preview'));
    const notice = await screen.findByTestId('simplify-open-mesh');
    const text = screen.getByTestId('simplify-open-mesh-text');
    expect(text.textContent).toBe(t('es', 'simplify.error.meshInvalid'));
    expect(text.textContent).not.toMatch(/manifold/i);
    expect(screen.queryByTestId('simplify-preview-error')).toBeNull();
    // El detalle técnico está en un <details> cerrado.
    const details = notice.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain('NotManifold');
    fireEvent.click(screen.getByTestId('simplify-open-mesh-repair'));
    expect(repair).toHaveBeenCalledExactlyOnceWith(obj.id);
  });
});

describe('Simplificar: informe a la vista', () => {
  it('abre con el resumen antes → después y dice qué muestra el fantasma; se desplaza hasta quedar visible', () => {
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    const { container } = render(<SimplifyReportView report={REPORT} language="es" preview ghost="requested" />);
    const summary = container.querySelector('[data-testid="simplify-report-summary"]')!;
    expect(summary.textContent).toContain('325.648 a 164.244');
    expect(summary.textContent).toContain(t('es', 'simplify.preview.ghostRequested'));
    // El resumen va antes que la lista de detalle.
    const list = container.querySelector('.kura-simplify-report-list')!;
    expect(summary.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: 'nearest' }));
  });

  it('con la versión segura lo dice en el resumen y el fantasma lo nombra', () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const safe = { ...REPORT, appliedVariant: 'safe', requested: { toleranceMm: 1, triangles: 100, volumeAfterMm3: 1, volumeChangePct: -3, genusAfter: 0, maxDeviationMm: 1 }, destructive: ['volume_changed'], safe: { toleranceMm: 0.1, triangles: 164244, volumeAfterMm3: 1, volumeChangePct: 0, genusAfter: 0, maxDeviationMm: 0.1 } } as unknown as SimplifyReport;
    const { container } = render(<SimplifyReportView report={safe} language="es" preview ghost="safe" />);
    const summary = container.querySelector('[data-testid="simplify-report-summary"]')!;
    expect(summary.textContent).toContain(t('es', 'simplify.preview.summarySafe', { before: '325.648', after: '164.244' }));
    expect(summary.textContent).toContain(t('es', 'simplify.preview.ghostSafe'));
  });
});

describe('Simplificar: foco durante el cálculo', () => {
  it('queda en «Cancelar» mientras calcula y vuelve a «Vista previa» al cancelar', async () => {
    mount();
    act(() => useKuraStore.setState({
      previewSimplify: async (id, request) => {
        useKuraStore.setState({ simplifyPreview: { objectId: id, status: 'computing', phase: null, signature: simplifySignature(request), report: null, error: null, ...SIMPLIFY_GHOST_DEFAULTS } });
        return null;
      },
    }));
    fireEvent.click(screen.getByTestId('simplify-preview'));
    const cancel = await screen.findByTestId('simplify-preview-cancel');
    expect(document.activeElement).toBe(cancel);
    act(() => useKuraStore.setState({ simplifyPreview: null }));
    expect(document.activeElement).toBe(screen.getByTestId('simplify-preview'));
  });
});
