/**
 * @file src/components/__tests__/PlaneCutModal.test.tsx
 * @description Humo del diálogo de corte: prellena los valores sugeridos para la pieza y, si los
 * conectores no caben, deshabilita Cortar mostrando el motivo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { emitCutPlaneDrag } from '../viewport/cutPlaneDrag';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { PlaneCutModal } from '../PlaneCutModal';

const suggest = vi.fn();
const check = vi.fn();
vi.mock('../../engine/cutConnectorSuggest', () => ({
  cutOffsetRange: () => ({ min: -10, max: 10 }),
  suggestCutConnectors: (...args: unknown[]) => suggest(...args),
  checkCutConnectorFit: (...args: unknown[]) => check(...args),
  cutConnectorCenters: () => Promise.resolve([]),
}));

const sizeLabel = `${t('es', 'dialog.cut.connectorSize')} (mm)`;
const executeButton = () => screen.getByRole('button', { name: new RegExp(t('es', 'dialog.cut.execute')), hidden: true });

beforeEach(() => {
  suggest.mockReset();
  check.mockReset();
  useKuraStore.setState({ objects: [fakeBox('a', 'Cubo 1', 40)], selectedIds: ['a'] } as never);
});

describe('PlaneCutModal', () => {
  it('prellena los valores sugeridos para la sección y permite cortar', async () => {
    suggest.mockResolvedValue({ feasible: true, size: 5, depth: 7, count: 3, maxSize: 9, maxDepth: 12, maxCount: 4 });
    check.mockResolvedValue(true);
    render(<PlaneCutModal open onClose={() => undefined} />);
    await waitFor(() => expect((screen.getByLabelText(sizeLabel) as HTMLInputElement).value).toBe('5'));
    await waitFor(() => expect(executeButton()).toHaveProperty('disabled', false));
    expect(suggest).toHaveBeenCalled();
  });

  it('es un panel no modal: arrastrar el plano en el visor y ↑ sincronizan el campo, Escape cierra', async () => {
    suggest.mockResolvedValue(null);
    check.mockResolvedValue(null);
    const onClose = vi.fn();
    render(<PlaneCutModal open onClose={onClose} />);
    const panel = screen.getByRole('dialog', { name: t('es', 'dialog.cut.title') });
    expect(panel.getAttribute('aria-modal')).toBe('false');
    const offsetInput = screen.getByLabelText(`${t('es', 'dialog.cut.offset')} (mm)`) as HTMLInputElement;
    act(() => emitCutPlaneDrag(7.5));
    await waitFor(() => expect(offsetInput.value).toBe('7.5'));
    act(() => emitCutPlaneDrag(99)); // se limita a la pieza
    await waitFor(() => expect(offsetInput.value).toBe('10'));
    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    await waitFor(() => expect(offsetInput.value).toBe('9.5'));
    await waitFor(() => expect(useKuraStore.getState().cutPreview.offset).toBe(9.5));
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('deshabilita Cortar y explica el motivo cuando no cabe ningún conector', async () => {
    suggest.mockResolvedValue({ feasible: false, size: 0, depth: 0, count: 0, maxSize: 0, maxDepth: 0, maxCount: 0 });
    check.mockResolvedValue(false);
    render(<PlaneCutModal open onClose={() => undefined} />);
    const reason = t('es', 'dialog.cut.reason.none');
    await waitFor(() => expect(executeButton()).toHaveProperty('disabled', true));
    await waitFor(() => expect(screen.getByRole('alert', { hidden: true }).textContent).toContain(reason));
    const describedBy = executeButton().getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toContain(reason);
  });

  it('Ejecutar entrega al store la mitad en el sentido del motor: Y del usuario (fondo) invierte, Z y X no', async () => {
    suggest.mockResolvedValue(null);
    check.mockResolvedValue(null);
    const cut = vi.fn().mockResolvedValue([]);
    useKuraStore.setState({ planeCutObject: cut } as never);
    render(<PlaneCutModal open onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText(t('es', 'dialog.cut.connectorType')), { target: { value: 'none' } });
    fireEvent.change(screen.getByLabelText(t('es', 'dialog.cut.keepMode')), { target: { value: 'positive' } });
    // Selector (valores internos): 'z' = Y del usuario, 'y' = Z del usuario (altura), 'x' = X.
    const expected = { z: 'negative', y: 'positive', x: 'positive' } as const;
    for (const internal of ['z', 'y', 'x'] as const) {
      cut.mockClear();
      fireEvent.change(screen.getByLabelText(t('es', 'dialog.cut.axis')), { target: { value: internal } });
      await waitFor(() => expect(executeButton()).toHaveProperty('disabled', false));
      fireEvent.click(executeButton());
      await waitFor(() => expect(cut).toHaveBeenCalled());
      expect(cut.mock.calls[0][1]).toMatchObject({ axis: internal, keepMode: expected[internal] });
    }
  });
});
