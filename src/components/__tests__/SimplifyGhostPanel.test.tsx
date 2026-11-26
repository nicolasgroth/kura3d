/**
 * @file src/components/__tests__/SimplifyGhostPanel.test.tsx
 * @description Controles del fantasma de Simplificar en el panel: «Ocultar la vista previa», aristas (se bloquean en
 * el modo liviano), conmutador «Ver lo pedido» / «Ver la versión segura» (solo si la malla pedida se guardó), aviso de
 * resultado demasiado grande o sin malla, y la barra por pasos («intento i de n», «paso i de n» de la segura) mientras
 * se calcula.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { uvSphere } from '../../engine/__tests__/smoothFixtures';
import type { SimplifyReport } from '../../engine/simplify';
import { t } from '../../i18n';
import { SIMPLIFY_GHOST_WIRE_MAX_TRIANGLES } from '../../store/simplifyGhostLimits';
import { SIMPLIFY_GHOST_DEFAULTS, simplifySignature, type SimplifyPreviewSession } from '../../store/slices/simplifyPreviewSlice';
import { useKuraStore } from '../../store/useKuraStore';
import { SimplifySection } from '../inspector/SimplifySection';
import { useInvalidFields } from '../useInvalidFields';

const Harness: React.FC<{ id: string }> = ({ id }) => {
  const invalid = useInvalidFields();
  const obj = useKuraStore((s) => s.objects.find((o) => o.id === id))!;
  return <SimplifySection primary={obj} toleranceMm={0.01} setToleranceMm={() => {}} invalid={invalid} />;
};

const REPORT: SimplifyReport = {
  mode: 'lossless', objectId: 'sph', applied: true, appliedVariant: 'requested', toleranceMm: 0.01, trianglesBefore: 512, trianglesAfter: 300,
  volumeBeforeMm3: 4000, volumeAfterMm3: 3990, volumeChangePct: -0.25, genusBefore: 0, genusAfter: 0, maxDeviationMm: 0.004,
  deviationSamples: 900, warnings: [], rejectedBy: [], ms: 5,
} as SimplifyReport;

const SIG = simplifySignature({ mode: 'lossless' });

function mount(session: Partial<SimplifyPreviewSession>) {
  const obj = buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh: uvSphere(10, 32, 16) });
  useKuraStore.setState({ objects: [obj], selectedIds: [obj.id], language: 'es', busyOperation: null, toasts: [], past: [], future: [], simplifyPreview: null });
  render(<Harness id={obj.id} />);
  act(() => useKuraStore.setState({
    simplifyPreview: { objectId: 'sph', status: 'ready', phase: null, signature: SIG, report: REPORT, error: null, ...SIMPLIFY_GHOST_DEFAULTS, ghost: 'shown', ghostTriangles: 300, ...session },
  }));
}

afterEach(() => useKuraStore.setState({ simplifyPreview: null }));

describe('Simplificar: controles del fantasma', () => {
  it('«Ocultar la vista previa» y las aristas actualizan la sesión, con nombre accesible', () => {
    mount({});
    const compare = screen.getByLabelText(t('es', 'simplify.ghost.compare')) as HTMLInputElement;
    expect(compare.checked).toBe(false);
    fireEvent.click(compare);
    expect(useKuraStore.getState().simplifyPreview!.comparing).toBe(true);
    const edges = screen.getByLabelText(t('es', 'simplify.ghost.edges')) as HTMLInputElement;
    expect(edges.checked).toBe(true);
    fireEvent.click(edges);
    expect(useKuraStore.getState().simplifyPreview!.edges).toBe(false);
    act(() => useKuraStore.getState().setSimplifyGhostEdges(true));
  });

  it('en el modo liviano las aristas quedan deshabilitadas y el panel dice por qué', () => {
    mount({ ghostTriangles: SIMPLIFY_GHOST_WIRE_MAX_TRIANGLES + 5 });
    expect((screen.getByTestId('simplify-ghost-edges') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId('simplify-ghost-controls').textContent).toContain('solo el sólido');
  });

  it('sin la malla pedida no hay conmutador de variante', () => {
    mount({ hasRequested: false });
    expect(screen.queryByTestId('simplify-ghost-variant')).toBeNull();
  });

  it('con la malla pedida el conmutador alterna entre la segura y lo pedido', () => {
    mount({ hasRequested: true });
    const btn = screen.getByTestId('simplify-ghost-variant');
    expect(btn.textContent).toBe(t('es', 'simplify.ghost.variant.showRequested'));
    expect(screen.getByTestId('simplify-ghost-variant-now').textContent).toBe(t('es', 'simplify.ghost.variant.nowSafe'));
    fireEvent.click(btn);
    expect(useKuraStore.getState().simplifyPreview!.variant).toBe('requested');
    expect(screen.getByTestId('simplify-ghost-variant').textContent).toBe(t('es', 'simplify.ghost.variant.showSafe'));
    expect(screen.getByTestId('simplify-ghost-variant-now').textContent).toBe(t('es', 'simplify.ghost.variant.nowRequested'));
    fireEvent.click(screen.getByTestId('simplify-ghost-variant'));
    expect(useKuraStore.getState().simplifyPreview!.variant).toBe('applied');
  });

  it('resultado demasiado grande: dice los triángulos, solo informe, sin controles del fantasma', () => {
    mount({ ghost: 'heavy', ghostTriangles: 1_600_000 });
    expect(screen.getByTestId('simplify-ghost-heavy').textContent).toBe('El resultado tiene 1.600.000 triángulos: se muestra solo el informe.');
    expect(screen.queryByTestId('simplify-ghost-controls')).toBeNull();
    expect(screen.getByTestId('simplify-report')).toBeTruthy();
  });

  it('sin malla nueva que mostrar lo dice', () => {
    mount({ ghost: 'none', ghostTriangles: 0 });
    expect(screen.getByTestId('simplify-ghost-none').textContent).toBe(t('es', 'simplify.ghost.none'));
  });
});

describe('Simplificar: progreso por pasos de la vista previa', () => {
  const computing = (phase: string | null) => mount({ status: 'computing', report: null, phase, ghost: 'none', ghostTriangles: 0 });

  it('intento i de n: barra con valor y máximo y texto de la fase', () => {
    computing('simplify:3/12');
    const bar = screen.getByTestId('simplify-preview-steps') as HTMLProgressElement;
    expect(bar.max).toBe(12);
    expect(bar.value).toBe(3);
    expect(bar.getAttribute('aria-label')).toBe(t('es', 'simplify.progress.bar'));
    expect(screen.getByTestId('simplify-preview-phase').textContent).toBe('Ajustando al objetivo: intento 3 de 12');
  });

  it('búsqueda de la versión segura: paso i de n', () => {
    computing('simplify:safe:2/8');
    expect((screen.getByTestId('simplify-preview-steps') as HTMLProgressElement).value).toBe(2);
    expect(screen.getByTestId('simplify-preview-phase').textContent).toBe('Buscando la versión segura: paso 2 de 8');
  });

  it('verificar o reducir no son pasos: solo texto, sin barra; sin fase, solo «Calculando»', () => {
    computing('simplify:verify');
    expect(screen.queryByTestId('simplify-preview-steps')).toBeNull();
    expect(screen.getByTestId('simplify-preview-phase').textContent).toBe(t('es', 'simplify.progress.verify'));
  });

  it('sin fase solo dice que calcula y deja cancelar', () => {
    computing(null);
    expect(screen.queryByTestId('simplify-preview-steps')).toBeNull();
    expect(screen.queryByTestId('simplify-preview-phase')).toBeNull();
    expect(screen.getByTestId('simplify-preview-cancel')).toBeTruthy();
  });
});

describe('Simplificar: foco al terminar la vista previa', () => {
  it('el foco va al informe (con nombre accesible), no al botón que modifica la pieza', async () => {
    mount({ status: 'computing', report: null, phase: null, ghost: 'none', ghostTriangles: 0 });
    const cancel = screen.getByTestId('simplify-preview-cancel');
    cancel.focus();
    expect(document.activeElement).toBe(cancel);
    act(() => useKuraStore.setState({ simplifyPreview: { ...useKuraStore.getState().simplifyPreview!, status: 'ready', report: REPORT, ghost: 'shown', ghostTriangles: 300 } }));
    const report = screen.getByTestId('simplify-report');
    expect(document.activeElement).toBe(report);
    expect(report.getAttribute('tabindex')).toBe('-1');
    expect(document.getElementById(report.getAttribute('aria-labelledby')!)?.textContent).toBe(t('es', 'simplify.preview.title'));
    expect(document.activeElement?.classList.contains('kura-simplify-run')).toBe(false);
  });
});
