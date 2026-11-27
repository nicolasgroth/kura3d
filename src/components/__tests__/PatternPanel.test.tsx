/**
 * @file src/components/__tests__/PatternPanel.test.tsx
 * @description Panel «Patrón» (componente, con una acción `applyPattern` simulada: el entorno de componentes no carga el
 * WASM; el flujo real vive en `store/__tests__/patternBus.test.ts`): abre con el foco en la opción marcada del tipo,
 * cambia entre lineal, circular y espejo, la vista previa fantasma se recalcula al cambiar un valor, el resumen y el aviso
 * de solape se leen en una región de estado, «Aplicar» manda los valores del formulario, no deja aplicar con un valor
 * inválido o con un problema (límite), Esc y «Volver» cierran, y sin selección no abre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { closePatternPanel, openPatternPanel, usePatternPanel } from '../../store/patternPanel';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject } from '../../types/kura';
import { PatternPanel } from '../pattern/PatternPanel';

const store = () => useKuraStore.getState();
const panel = () => usePatternPanel.getState();

/** Cubo de 10 mm con malla real (para la caja envolvente del solape y el fantasma). */
function cube(id: string, name: string, size = 10): SceneObject {
  const h = size / 2;
  const v = [[-h, 0, -h], [h, 0, -h], [h, size, -h], [-h, size, -h], [-h, 0, h], [h, 0, h], [h, size, h], [-h, size, h]];
  const f = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
  return { ...fakeBox(id, name, size), mesh: { positions: new Float32Array(v.flat()), indices: new Uint32Array(f) } };
}

function mockApply() {
  const apply = vi.fn(async (_req: unknown) => ({ createdIds: ['n1', 'n2'], groupId: 'g', groupName: 'x', cells: 3, overlapCells: 0 }));
  useKuraStore.setState({ applyPattern: apply });
  return apply;
}

describe('panel Patrón', () => {
  beforeEach(() => {
    closePatternPanel();
    useKuraStore.setState({
      objects: [cube('a', 'Tornillo'), cube('b', 'Tuerca')], selectedIds: ['a'], plates: [], activePlateId: null, groups: [],
      layout: 'print', language: 'es', toasts: [], busyOperation: null,
    });
  });

  it('sin selección no abre y dice por qué', () => {
    useKuraStore.setState({ selectedIds: [] });
    expect(openPatternPanel()).toBe(false);
    expect(panel().open).toBe(false);
    expect(store().toasts.some((x) => x.text === t('es', 'pattern.noSelection'))).toBe(true);
  });

  it('abre con el foco en el tipo marcado, propone el paso con el tamaño de la pieza y muestra el resumen', async () => {
    render(<PatternPanel />);
    act(() => void openPatternPanel());
    expect(screen.getByRole('dialog', { name: 'Patrón' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('pattern-kind-linear')));
    // 10 mm de pieza + 5 mm de holgura.
    expect(panel().distanceMm).toBe(15);
    await waitFor(() => expect(screen.getByTestId('pattern-summary').textContent).toBe('Se crearán 2 piezas nuevas.'));
  });

  it('la vista previa fantasma se calcula y se recalcula al cambiar un valor', async () => {
    const user = userEvent.setup();
    render(<PatternPanel />);
    act(() => void openPatternPanel());
    await waitFor(() => expect(panel().ghost?.entries[0].count).toBe(2));
    const count = screen.getByRole('spinbutton', { name: 'Piezas en total' });
    await user.clear(count);
    await user.type(count, '5{Enter}');
    await waitFor(() => expect(panel().ghost?.entries[0].count).toBe(4));
    expect(screen.getByTestId('pattern-ghost-note').textContent).toContain('translúcidas');
    closePatternPanel();
    expect(panel().ghost).toBeNull();
  });

  it('al cambiar los parámetros pide a la cámara que quepa la caja de todo el patrón (copias y original)', async () => {
    const user = userEvent.setup();
    render(<PatternPanel />);
    useKuraStore.setState({ cameraRequest: null });
    act(() => void openPatternPanel());
    await waitFor(() => expect(store().cameraRequest?.box).toBeTruthy());
    const count = screen.getByRole('spinbutton', { name: 'Piezas en total' });
    await user.clear(count);
    await user.type(count, '5{Enter}');
    // Cubo de 10 mm con paso de 15: la original en x [-5, 5] y la última copia termina en 4·15 + 5 = 65.
    await waitFor(() => expect(store().cameraRequest?.box?.max[0]).toBeCloseTo(65));
    expect(store().cameraRequest?.box?.min[0]).toBeCloseTo(-5);
  });

  it('cambia de tipo con teclado y cada formulario muestra sus campos', async () => {
    const user = userEvent.setup();
    render(<PatternPanel />);
    act(() => void openPatternPanel());
    await user.click(screen.getByTestId('pattern-kind-circular'));
    expect(screen.getByRole('spinbutton', { name: 'Ángulo total (°)' })).toBeTruthy();
    await user.click(screen.getByTestId('pattern-center-point'));
    expect(screen.getByTestId('pattern-point-fields')).toBeTruthy();
    await user.click(screen.getByTestId('pattern-kind-mirror'));
    expect(screen.getByTestId('pattern-plane')).toBeTruthy();
    expect((screen.getByTestId('pattern-keep') as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByTestId('pattern-kind-linear'));
    await user.click(screen.getByTestId('pattern-grid'));
    expect(screen.getByTestId('pattern-grid-fields')).toBeTruthy();
  });

  it('avisa del solape con texto (no solo color) y deja aplicar', async () => {
    const user = userEvent.setup();
    render(<PatternPanel />);
    act(() => void openPatternPanel());
    const distance = screen.getByRole('spinbutton', { name: 'Distancia (mm)' });
    await user.clear(distance);
    await user.type(distance, '4{Enter}');
    await waitFor(() => expect(screen.getByTestId('pattern-overlap').textContent).toContain('podrían solaparse'));
    expect((screen.getByTestId('pattern-apply') as HTMLButtonElement).disabled).toBe(false);
  });

  it('«Aplicar» manda los valores del formulario y cierra', async () => {
    const user = userEvent.setup();
    const apply = mockApply();
    render(<PatternPanel />);
    act(() => void openPatternPanel());
    await user.click(screen.getByTestId('pattern-axis-y'));
    await user.click(screen.getByTestId('pattern-union'));
    await waitFor(() => expect((screen.getByTestId('pattern-apply') as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByTestId('pattern-apply'));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(apply.mock.calls[0][0]).toMatchObject({ kind: 'linear', ids: ['a'], union: true, spec: { count: 3, axis: 'y', mode: 'step' } });
    await waitFor(() => expect(panel().open).toBe(false));
  });

  it('con un límite superado muestra el problema y no deja aplicar', async () => {
    const user = userEvent.setup();
    const apply = mockApply();
    render(<PatternPanel />);
    act(() => void openPatternPanel());
    await user.click(screen.getByTestId('pattern-grid'));
    const count = screen.getByRole('spinbutton', { name: 'Piezas en total' });
    await user.clear(count);
    await user.type(count, '400{Enter}');
    const rows = screen.getByRole('spinbutton', { name: 'Filas' });
    await user.clear(rows);
    await user.type(rows, '2{Enter}');
    await waitFor(() => expect(screen.getByTestId('pattern-problem').textContent).toContain('máximo es 500'));
    expect((screen.getByTestId('pattern-apply') as HTMLButtonElement).disabled).toBe(true);
    expect(apply).not.toHaveBeenCalled();
  });

  it('un valor inválido en un campo desactiva «Aplicar»', async () => {
    const user = userEvent.setup();
    render(<PatternPanel />);
    act(() => void openPatternPanel());
    const count = screen.getByRole('spinbutton', { name: 'Piezas en total' });
    await user.clear(count);
    await user.type(count, '9999');
    await user.tab();
    await waitFor(() => expect((screen.getByTestId('pattern-apply') as HTMLButtonElement).disabled).toBe(true));
  });

  it('Esc y «Volver» cierran el panel', async () => {
    const user = userEvent.setup();
    render(<PatternPanel />);
    act(() => void openPatternPanel());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('pattern-kind-linear')));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(panel().open).toBe(false));
    act(() => void openPatternPanel());
    await user.click(screen.getByRole('button', { name: /Volver/ }));
    expect(panel().open).toBe(false);
  });

  it('mantiene el idioma: con inglés los textos cambian', () => {
    useKuraStore.setState({ language: 'en' });
    render(<PatternPanel />);
    act(() => void openPatternPanel());
    expect(screen.getByRole('dialog', { name: 'Pattern' })).toBeTruthy();
    expect(screen.getByTestId('pattern-apply').textContent).toBe('Apply pattern');
  });
});
