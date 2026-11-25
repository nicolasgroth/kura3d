/**
 * @file src/components/__tests__/SimplifySection.test.tsx
 * @description Simplificar en el panel de malla: el selector de modo trae su ayuda asociada, cada modo muestra sus
 * campos, «Por cantidad» pide la petición correcta al store y el informe antes → después aparece con sus avisos
 * traducidos. (El motor no corre en jsdom: la acción del store se sustituye; el motor y el store se prueban aparte.)
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { uvSphere } from '../../engine/__tests__/smoothFixtures';
import { OPERATION_RANGES } from '../../engine/operationLimits';
import type { SimplifyReport, SimplifyRequest } from '../../engine/simplify';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { SimplifySection } from '../inspector/SimplifySection';
import { useInvalidFields } from '../useInvalidFields';
import type { SceneObject } from '../../types/kura';

const store = () => useKuraStore.getState();

const Harness: React.FC<{ id: string }> = ({ id }) => {
  const invalid = useInvalidFields();
  const obj = useKuraStore((s) => s.objects.find((o) => o.id === id))!;
  return <SimplifySection primary={obj} toleranceMm={0.01} setToleranceMm={() => {}} invalid={invalid} />;
};

const REPORT: SimplifyReport = {
  mode: 'target', applied: true, toleranceMm: 0.25, trianglesBefore: 1000, trianglesAfter: 495, volumeBeforeMm3: 4000,
  volumeAfterMm3: 3960, volumeChangePct: -1, genusBefore: 1, genusAfter: 0, maxDeviationMm: 0.3, deviationSamples: 2000,
  warnings: ['genus_changed', 'volume_changed', 'deviation_high'], rejectedBy: [],
  target: { triangles: 500, reached: true, iterations: 6, stoppedBy: 'reached' }, ms: 10,
};

async function mount(): Promise<SceneObject> {
  const mesh = uvSphere(10, 32, 16);
  const obj = buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh });
  useKuraStore.setState({ objects: [obj], selectedIds: [obj.id], language: 'es', busyOperation: null, toasts: [], past: [], future: [] });
  render(<Harness id={obj.id} />);
  return obj;
}

describe('Simplificar con modos (panel)', () => {
  beforeEach(() => useKuraStore.setState({ toasts: [] }));

  it('el selector de modo tiene etiqueta y ayuda; cada modo muestra sus campos', async () => {
    await mount();
    const select = screen.getByLabelText(t('es', 'simplify.mode')) as HTMLSelectElement;
    expect(select.value).toBe('lossless');
    const help = document.getElementById(select.getAttribute('aria-describedby')!);
    expect(help?.textContent).toBe(t('es', 'simplify.mode.lossless.help'));
    expect(screen.queryByLabelText(t('es', 'inspector.pro.simplifyTol'))).toBeNull();
    fireEvent.change(select, { target: { value: 'tolerance' } });
    expect(screen.getByLabelText(t('es', 'inspector.pro.simplifyTol'))).toBeTruthy();
    fireEvent.change(select, { target: { value: 'target' } });
    expect(screen.getByLabelText(t('es', 'simplify.target.percent'))).toBeTruthy();
    fireEvent.change(screen.getByLabelText(t('es', 'simplify.target.kind')), { target: { value: 'count' } });
    expect(screen.getByLabelText(t('es', 'simplify.target.count'))).toBeTruthy();
  });

  it('«Por cantidad» al 50 %: pide el modo y muestra el informe con sus avisos', async () => {
    const obj = await mount();
    const calls: Array<{ id: string; request: number | SimplifyRequest }> = [];
    useKuraStore.setState({
      simplifySelectedMesh: async (id, request, options) => {
        calls.push({ id, request });
        options?.onReport?.(REPORT);
        return true;
      },
    });
    fireEvent.change(screen.getByLabelText(t('es', 'simplify.mode')), { target: { value: 'target' } });
    fireEvent.click(screen.getByRole('button', { name: t('es', 'inspector.pro.simplifyBtn') }));
    const report = await waitFor(() => screen.getByTestId('simplify-report'));
    expect(calls).toEqual([{ id: obj.id, request: { mode: 'target', targetPercent: 50 } }]);
    expect(report.textContent).toContain(t('es', 'simplify.report.title'));
    const codes = [...screen.getByTestId('simplify-report-warnings').querySelectorAll('li')].map((li) => li.dataset.code);
    expect(codes).toEqual(['genus_changed', 'volume_changed', 'deviation_high']);
    expect(report.textContent).toContain(t('es', 'simplify.warn.genus_changed', { before: 1, after: 0 }));
    expect(report.getAttribute('role')).toBe('status');
  });

  it('la tolerancia acepta en la interfaz el mismo rango que el motor y MCP (una sola fuente)', async () => {
    await mount();
    fireEvent.change(screen.getByLabelText(t('es', 'simplify.mode')), { target: { value: 'tolerance' } });
    const field = screen.getByLabelText(t('es', 'inspector.pro.simplifyTol')) as HTMLInputElement;
    const typeAndBlur = (text: string) => {
      fireEvent.focus(field);
      fireEvent.change(field, { target: { value: text } });
      fireEvent.blur(field);
    };
    typeAndBlur('20');
    expect(field.getAttribute('aria-invalid')).not.toBe('true');
    typeAndBlur(String(OPERATION_RANGES.simplify.toleranceMm.max + 1));
    expect(field.getAttribute('aria-invalid')).toBe('true');
  });
});
