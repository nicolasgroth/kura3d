/**
 * @file src/components/__tests__/PlaneCutModalKeptHalf.test.tsx
 * @description Diálogo de corte: el grupo «¿Dónde dejar la mitad que conservas?» (radiogroup) aparece solo con
 * UNA mitad conservada que no quedaría apoyada en la cama, avisa de la superposición, recuerda la última
 * elección y la pasa al corte; con ambas mitades o con la mitad ya apoyada no aparece.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { STORAGE_KEPT_HALF_KEY } from '../../store/keptHalfPreference';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject } from '../../types/kura';
import { PlaneCutModal } from '../PlaneCutModal';

vi.mock('../../engine/cutConnectorSuggest', () => ({
  cutOffsetRange: () => ({ min: -14, max: 14 }),
  suggestCutConnectors: () => Promise.resolve(null),
  checkCutConnectorFit: () => Promise.resolve(null),
  cutConnectorCenters: () => Promise.resolve([]),
}));

/** Cubo de 30 mm con malla real, apoyado en la cama (Y interna 0 a 30) en `x`. */
function cube(id: string, name: string, x = 0): SceneObject {
  const h = 15;
  const positions = new Float32Array([
    -h, -h, -h, h, -h, -h, h, h, -h, -h, h, -h,
    -h, -h, h, h, -h, h, h, h, h, -h, h, h,
  ]);
  return { ...fakeBox(id, name, 30), position: [x, h, 0], mesh: { positions, indices: new Uint32Array([0, 1, 2]) } } as SceneObject;
}

const group = () => screen.queryByRole('radiogroup', { name: t('es', 'corteMitad.group') });
const keepSelect = () => screen.getByLabelText(t('es', 'dialog.cut.keepMode')) as HTMLSelectElement;
const radio = (key: 'corteMitad.inPlace' | 'corteMitad.drop' | 'corteMitad.free') =>
  screen.getByRole('radio', { name: new RegExp(t('es', key)) }) as HTMLInputElement;
const noConnector = () => fireEvent.change(screen.getByLabelText(t('es', 'dialog.cut.connectorType')), { target: { value: 'none' } });
const execute = () => screen.getByRole('button', { name: new RegExp(t('es', 'dialog.cut.execute')), hidden: true });

let planeCut: ReturnType<typeof vi.fn>;
beforeEach(() => {
  window.localStorage.clear();
  planeCut = vi.fn().mockResolvedValue([{ id: 'p' }]);
  useKuraStore.setState({ objects: [cube('a', 'Cubo 1')], selectedIds: ['a'], planeCutObject: planeCut } as never);
});

describe('PlaneCutModal: dónde dejar la mitad conservada', () => {
  it('con ambas mitades no aparece y la ayuda dice que quedan en su lugar', () => {
    render(<PlaneCutModal open onClose={() => undefined} />);
    expect(group()).toBeNull();
    expect(screen.getByText(t('es', 'corteMitad.bothHelp'))).toBeTruthy();
  });

  it('con una mitad que quedaría flotando aparece con tres opciones accesibles y «apoyarla en la cama» marcada', () => {
    render(<PlaneCutModal open onClose={() => undefined} />);
    fireEvent.change(keepSelect(), { target: { value: 'positive' } });
    expect(group()).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(radio('corteMitad.drop').checked).toBe(true);
    expect(radio('corteMitad.inPlace').checked).toBe(false);
  });

  it('la mitad inferior de un corte horizontal ya queda apoyada: no aparece', () => {
    render(<PlaneCutModal open onClose={() => undefined} />);
    fireEvent.change(keepSelect(), { target: { value: 'negative' } });
    expect(group()).toBeNull();
  });

  it('recuerda la última elección y la manda al corte', async () => {
    const { unmount } = render(<PlaneCutModal open onClose={() => undefined} />);
    fireEvent.change(keepSelect(), { target: { value: 'positive' } });
    noConnector();
    fireEvent.click(radio('corteMitad.free'));
    await waitFor(() => expect(execute()).toHaveProperty('disabled', false));
    fireEvent.click(execute());
    await waitFor(() => expect(planeCut).toHaveBeenCalled());
    expect(planeCut.mock.calls[0][1]).toMatchObject({ keepMode: 'positive', keptHalfPlacement: 'freeSpot' });
    expect(window.localStorage.getItem(STORAGE_KEPT_HALF_KEY)).toBe('freeSpot');
    unmount();
    useKuraStore.setState({ objects: [cube('a', 'Cubo 1')], selectedIds: ['a'] } as never);
    render(<PlaneCutModal open onClose={() => undefined} />);
    fireEvent.change(keepSelect(), { target: { value: 'positive' } });
    expect(radio('corteMitad.free').checked).toBe(true);
  });

  it('si apoyarla en el mismo lugar se superpondría con otro objeto, lo dice con su nombre', () => {
    useKuraStore.setState({
      objects: [{ ...cube('a', 'Cubo 1'), position: [0, 55, 0] }, cube('b', 'Debajo')],
      selectedIds: ['a'],
    } as never);
    render(<PlaneCutModal open onClose={() => undefined} />);
    fireEvent.change(keepSelect(), { target: { value: 'positive' } });
    expect(screen.getByText(t('es', 'corteMitad.overlap', { names: 'Debajo' }))).toBeTruthy();
  });

  it('con ambas mitades manda inPlace (no cambia el comportamiento actual)', async () => {
    render(<PlaneCutModal open onClose={() => undefined} />);
    noConnector();
    await waitFor(() => expect(execute()).toHaveProperty('disabled', false));
    fireEvent.click(execute());
    await waitFor(() => expect(planeCut).toHaveBeenCalled());
    expect(planeCut.mock.calls[0][1]).toMatchObject({ keepMode: 'both', keptHalfPlacement: 'inPlace' });
  });
});
