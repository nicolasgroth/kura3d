/**
 * @file src/components/__tests__/ux8Avisos.test.tsx
 * @description Lote ux8: el emergente muestra solo el aviso más reciente (centro de mensajes); el panel
 * Dividir marca el resultado viejo como desactualizado y anuncia el cálculo con `role="status"`; la región viva
 * del panel derecho sale en el idioma activo; Medir no mueve la cámara al abrirse y ordena sus secciones.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextPanel } from '../contextPanel/ContextPanel';
import { MeasurePanel } from '../measure/MeasurePanel';
import { SplitPlanSummaryView } from '../split/SplitPlanSummaryView';
import { ToastStack } from '../ToastStack';
import { useMeasureStore } from '../../store/measureStore';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import type { InspectorLocalState } from '../inspector/inspectorTypes';

beforeEach(() => {
  useMeasureStore.getState().reset();
  useKuraStore.setState({ language: 'es', objects: [], selectedIds: [], toasts: [], activeTool: 'select' } as never);
});

describe('emergente del centro de mensajes', () => {
  it('muestra solo el aviso más reciente: sin «N avisos más» ni «Cerrar todos»; los anteriores quedan en el histórico', () => {
    render(<ToastStack />);
    act(() => {
      for (let i = 1; i <= 5; i += 1) useKuraStore.getState().addToast(`Aviso ${i}`, 'info');
    });
    expect(document.querySelectorAll('.kura-toast')).toHaveLength(1);
    expect(screen.getByText('Aviso 5')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /más|Cerrar todos/ })).toBeNull();
    expect(useKuraStore.getState().toastHistory.map((h) => h.text)).toEqual(['Aviso 1', 'Aviso 2', 'Aviso 3', 'Aviso 4', 'Aviso 5']);
  });
});

describe('Dividir: resultado desactualizado', () => {
  const summary = { pieceCount: 2, gridUser: [2, 1, 1], exact: true, plateEstimate: 1, jointCount: 1, jointsWithoutConnector: 0, planesWithoutConnector: [], rotatedCount: 0, diagonalCount: 0, assemblyMeasured: true } as never;
  const plan = { connector: null, usableMm: [200, 200, 200], warnings: [] } as never;

  it('mientras recalcula anuncia «Calculando» en un role=status y esconde el resultado anterior', () => {
    render(<SplitPlanSummaryView summary={summary} plan={plan} pending checking />);
    const estado = screen.getByTestId('split-calculating');
    expect(estado.getAttribute('role')).toBe('status');
    expect(estado.textContent).toContain('Calculando el plan');
    expect(estado.textContent).toContain('desactualizado');
    const dl = document.querySelector('.kura-split-dl') as HTMLElement;
    expect(dl.getAttribute('aria-hidden')).toBe('true');
    expect(dl.hasAttribute('data-stale')).toBe(true);
  });

  it('sin recalcular el resultado vuelve a ser accesible y el estado queda vacío', () => {
    render(<SplitPlanSummaryView summary={summary} plan={plan} pending={false} checking={false} />);
    expect(screen.getByTestId('split-calculating').textContent).toBe('');
    expect(document.querySelector('.kura-split-dl')?.hasAttribute('aria-hidden')).toBe(false);
  });
});

describe('región viva del panel derecho', () => {
  const ui = {} as InspectorLocalState;
  it('anuncia en el idioma activo y descarta el anuncio viejo al cambiar de idioma', () => {
    const box = fakeBox('a', 'Pieza A');
    useKuraStore.setState({ objects: [box], selectedIds: [] } as never);
    render(<ContextPanel ui={ui} />);
    act(() => useKuraStore.setState({ selectedIds: ['a'] } as never));
    const live = screen.getByTestId('panel-live');
    expect(live.textContent).toBe('Panel: Pieza A');
    expect(live.getAttribute('lang')).toBe('es');
    act(() => useKuraStore.setState({ language: 'en' } as never));
    expect(screen.getByTestId('panel-live').textContent).toBe('');
    expect(screen.getByTestId('panel-live').getAttribute('lang')).toBe('en');
    act(() => useKuraStore.setState({ selectedIds: [] } as never));
    expect(screen.getByTestId('panel-live').textContent).toBe('Panel: project');
  });
});

describe('Medir', () => {
  it('no mueve la cámara al abrirse y separa paso, objeto y mediciones', async () => {
    const box = fakeBox('a', 'Pieza A');
    const spy = vi.fn();
    useKuraStore.setState({ objects: [box], selectedIds: ['a'], requestCameraPreset: spy, activeTool: 'measure' } as never);
    render(<MeasurePanel />);
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByTestId('measure-step').getAttribute('role')).toBe('status');
    expect(screen.getByRole('heading', { name: 'Objeto seleccionado' })).toBeTruthy();
    expect(screen.getByTestId('measure-section-list').querySelector('h3')).toBeTruthy();
  });
});
