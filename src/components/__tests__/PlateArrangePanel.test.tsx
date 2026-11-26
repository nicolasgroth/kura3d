/**
 * @file src/components/__tests__/PlateArrangePanel.test.tsx
 * @description Panel «Repartir en placas…» (componente, con el motor simulado: el entorno de componentes no carga el
 * WASM; el flujo real vive en `store/__tests__/plateArrangePanel.store.test.ts`): abre con el número de piezas y la
 * selección como alcance; cada opción llega al store con sus valores (criterio, orientación, separación y margen);
 * el resumen de la vista previa nombra las piezas que no caben con su motivo; «Cancelar cálculo» cancela y lo dice;
 * «Repartir» aplica con las mismas opciones y cierra; «Una placa por objeto» llama a su acción; Esc y «Volver» cierran;
 * sin piezas no abre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArrangePlan, ArrangeReport } from '../../core/scene/plateArrangeTypes';
import { t } from '../../i18n';
import { closePlateArrangePanel, openPlateArrangePanel, usePlateArrangePanel } from '../../store/plateArrangePanel';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { PlateArrangePanel } from '../plates/PlateArrangePanel';

const store = () => useKuraStore.getState();
const panel = () => usePlateArrangePanel.getState();

const report = (over: Partial<ArrangeReport> = {}): ArrangeReport => ({
  platesUsed: ['implicit'], platesCreated: 0, placed: ['a'], moved: 1, unplaced: [], skipped: [], splitGroups: [], keptOrientation: [], ...over,
});
const planOf = (r: ArrangeReport): ArrangePlan => ({ createdPlates: [], placements: [], report: r });

/** Sustituye las acciones del motor por simulaciones que se pueden espiar. */
function mockStore(r: ArrangeReport = report()) {
  const plan = vi.fn(async () => ({ plan: planOf(r), report: r }));
  const apply = vi.fn(async () => r);
  const cancel = vi.fn();
  const spread = vi.fn(() => ({ pieces: 2, created: 1 }));
  useKuraStore.setState({ planArrangeOnPlates: plan, arrangeOnPlatesApply: apply, cancelArrangeOnPlates: cancel, spreadOnePlatePerObject: spread });
  return { plan, apply, cancel, spread };
}

describe('panel Repartir en placas', () => {
  beforeEach(() => {
    closePlateArrangePanel();
    useKuraStore.setState({
      objects: [fakeBox('a', 'Caja A', 20), fakeBox('b', 'Caja B', 20), fakeBox('c', 'Caja C', 20)],
      selectedIds: [], plates: [], activePlateId: null, groups: [], layout: 'print', language: 'es', toasts: [], busyOperation: null,
    });
  });

  it('sin piezas no abre y dice por qué', () => {
    useKuraStore.setState({ objects: [] });
    expect(openPlateArrangePanel()).toBe(false);
    expect(panel().open).toBe(false);
    expect(store().toasts.some((x) => x.text === t('es', 'plates.arrange.toast.nothing'))).toBe(true);
  });

  it('abre con la selección como alcance y muestra cuántas piezas son', async () => {
    mockStore();
    store().setSelection(['a']);
    render(<PlateArrangePanel />);
    act(() => void openPlateArrangePanel());
    expect(panel().scope).toBe('selection');
    expect((screen.getByTestId('arrange-scope-selection') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('La selección (1 pieza)')).toBeTruthy();
    expect(screen.getByText('Todas las piezas visibles (3 piezas)')).toBeTruthy();
    // Foco inicial en el primer control (la opción marcada del primer grupo).
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('arrange-scope-selection')));
  });

  it('las opciones llegan a la vista previa y a «Repartir» con sus valores', async () => {
    const user = userEvent.setup();
    const { plan, apply } = mockStore();
    render(<PlateArrangePanel />);
    act(() => void openPlateArrangePanel());
    await waitFor(() => expect(plan).toHaveBeenCalledTimes(1));
    expect((plan.mock.calls[0] as unknown[])[0]).toMatchObject({ ids: null, criterion: 'compact', orient: 'keep', spacingMm: 5, marginMm: 5 });

    await user.click(screen.getByTestId('arrange-criterion-byColor'));
    await user.click(screen.getByTestId('arrange-orient-flatDown'));
    const spacing = screen.getByRole('spinbutton', { name: 'Separación entre piezas' });
    await user.clear(spacing);
    await user.type(spacing, '8{Enter}');
    await waitFor(() => expect((plan.mock.calls.at(-1) as unknown[])[0]).toMatchObject({ criterion: 'byColor', orient: 'flatDown', spacingMm: 8, marginMm: 5 }));

    await waitFor(() => expect(panel().status).toBe('ready'));
    await user.click(screen.getByTestId('arrange-apply'));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    const call = apply.mock.calls[0] as unknown[];
    expect(call[0]).toMatchObject({ ids: null, criterion: 'byColor', orient: 'flatDown', spacingMm: 8, marginMm: 5 });
    expect(call[1]).toEqual({ quiet: true });
  });

  it('el resumen dice qué piezas no caben, cuáles se omiten y qué grupos se parten', async () => {
    mockStore(report({
      platesUsed: ['implicit', 'new:0'], platesCreated: 2, placed: ['a', 'b'],
      unplaced: [{ id: 'c', reason: 'tooLarge' }], skipped: [{ id: 'b', reason: 'lockedPlate' }],
      splitGroups: [{ groupId: 'g1', plates: ['x', 'y'] }], keptOrientation: ['a'],
    }));
    render(<PlateArrangePanel />);
    act(() => void openPlateArrangePanel());
    await waitFor(() => expect(panel().status).toBe('ready'));
    expect(screen.getByTestId('arrange-summary').textContent).toBe('Se usarán 2 placas (1 nueva). 2 piezas colocadas.');
    expect(screen.getByTestId('arrange-unplaced').textContent).toContain('Caja C: es más grande que la cama');
    expect(screen.getByTestId('arrange-skipped').textContent).toContain('Caja B: está en una placa bloqueada');
    expect(screen.getByTestId('arrange-split').textContent).toContain('queda partido en 2 placas');
    expect(screen.getByTestId('arrange-kept').textContent).toContain('1 pieza conservó su orientación');
  });

  it('«Cancelar cálculo» cancela, lo dice y no deja el panel bloqueado', async () => {
    const user = userEvent.setup();
    const { cancel } = mockStore();
    useKuraStore.setState({ planArrangeOnPlates: vi.fn(() => new Promise<never>(() => undefined)) });
    render(<PlateArrangePanel />);
    act(() => void openPlateArrangePanel());
    await waitFor(() => expect(screen.getByTestId('arrange-running')).toBeTruthy());
    await user.click(screen.getByTestId('arrange-cancel-preview'));
    expect(cancel).toHaveBeenCalled();
    expect(screen.getByTestId('arrange-cancelled').textContent).toBe(t('es', 'plates.arrangeDlg.preview.cancelled'));
    expect(screen.queryByTestId('arrange-running')).toBeNull();
  });

  it('«Repartir» aplica con las opciones del panel y cierra', async () => {
    const user = userEvent.setup();
    const { apply } = mockStore();
    render(<PlateArrangePanel />);
    act(() => void openPlateArrangePanel());
    await waitFor(() => expect(panel().status).toBe('ready'));
    await user.click(screen.getByTestId('arrange-apply'));
    await waitFor(() => expect(panel().open).toBe(false));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('arrange-apply')).toBeNull();
  });

  it('«Una placa por objeto» llama a su propia acción con las piezas del alcance', async () => {
    const user = userEvent.setup();
    const { spread, apply } = mockStore();
    render(<PlateArrangePanel />);
    act(() => void openPlateArrangePanel());
    await user.click(screen.getByTestId('arrange-criterion-onePerObject'));
    expect(screen.getByTestId('arrange-summary').textContent).toBe(t('es', 'plates.arrangeDlg.preview.onePerObject'));
    // Con esta opción la orientación, la separación y el margen no aplican.
    expect((screen.getByTestId('arrange-orient-flatDown') as HTMLInputElement).disabled).toBe(true);
    await user.click(screen.getByTestId('arrange-apply'));
    await waitFor(() => expect(spread).toHaveBeenCalledTimes(1));
    expect((spread.mock.calls[0] as unknown[])[0]).toEqual(['a', 'b', 'c']);
    expect(apply).not.toHaveBeenCalled();
    expect(panel().open).toBe(false);
  });

  it('Esc cierra el panel y el botón «Volver» también', async () => {
    const user = userEvent.setup();
    mockStore();
    render(<PlateArrangePanel />);
    act(() => void openPlateArrangePanel());
    await user.keyboard('{Escape}');
    expect(panel().open).toBe(false);
    act(() => void openPlateArrangePanel());
    await user.click(screen.getByTestId('panel-back'));
    expect(panel().open).toBe(false);
  });
});
