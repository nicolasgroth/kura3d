/**
 * @file src/components/__tests__/SplitForBedPanel.test.tsx
 * @description Panel "Dividir para imprimir": pide el plan al abrir y al cambiar un valor, muestra
 * el resumen (piezas, uniones), deja "Dividir" deshabilitado con el motivo si el motor da error y
 * aplica la posición de un plano editada a mano o arrastrada en el visor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BedSplitPlan } from '../../engine';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { SplitForBedPanel } from '../split/SplitForBedPanel';
import { emitSplitPlaneMove } from '../split/splitPlaneDrag';

const PLAN: BedSplitPlan = {
  bounds: { min: [-60, 0, -60], max: [60, 1000, 60] },
  usableMm: [246, 246, 246],
  counts: { x: 1, y: 5, z: 1 },
  planes: [200, 400, 600, 800].map((position, index) => ({
    axis: 'y' as const,
    index,
    position,
    uniformPosition: position,
    sectionAreaMm2: 11000,
    islands: 1,
    strips: 0,
    smallestIslandMm2: 11000,
    admitsConnectors: index !== 2,
  })),
  pieces: [0, 1, 2, 3, 4].map((j) => ({
    code: `A${j + 1}`,
    cell: [0, j, 0] as [number, number, number],
    bounds: { min: [-60, j * 200, -60] as [number, number, number], max: [60, (j + 1) * 200, 60] as [number, number, number] },
    sizeMm: [120, j < 4 ? 206 : 200, 120] as [number, number, number],
    rotated: false,
    printRotation: [0, 0, 0] as [number, number, number],
    diagonal: false,
    bedMarginMm: 5,
  })),
  fitsWithoutCuts: false,
  connector: { type: 'dowel', size: 4, depth: 6, tolerance: 0.25, count: 2 },
  elapsedMs: 5,
};

const request = vi.fn();
const splitButton = () => screen.getByRole('button', { name: t('es', 'split.execute'), hidden: true });
const ready = (plan: BedSplitPlan | null, error: string | null = null) =>
  act(() =>
    useKuraStore.setState({
      splitPlanPreview: {
        objectId: 'a',
        status: error ? 'error' : 'ready',
        plan,
        bed: { widthMm: 256, depthMm: 256, heightMm: 256 },
        error,
        errorCode: error ? 'SPLIT_TOO_MANY_PIECES' : null,
      },
    }),
  );

beforeEach(() => {
  request.mockReset();
  useKuraStore.setState({
    objects: [fakeBox('a', 'Tubería', 40)],
    selectedIds: ['a'],
    customBedDimensions: { width: 256, depth: 256, height: 256 },
    requestSplitPlan: request,
    busyOperation: null,
  } as never);
});

describe('SplitForBedPanel', () => {
  it('pide el plan con la cama activa y lo vuelve a pedir al cambiar un valor', () => {
    render(<SplitForBedPanel open onClose={() => undefined} />);
    expect(request).toHaveBeenCalled();
    const [id, bed, options] = request.mock.calls.at(-1)!;
    expect(id).toBe('a');
    expect(bed).toEqual({ widthMm: 256, depthMm: 256, heightMm: 256 });
    expect(options).toMatchObject({ marginMm: 5, axes: ['x', 'y', 'z'], allowRotation: true });
    const calls = request.mock.calls.length;
    fireEvent.click(screen.getByRole('checkbox', { name: 'X', hidden: true }));
    expect(request.mock.calls.length).toBeGreaterThan(calls);
    expect(request.mock.calls.at(-1)![2].axes).toEqual(['y', 'z']);
  });

  it('muestra el resumen y deja dividir cuando el plan está listo', () => {
    render(<SplitForBedPanel open onClose={() => undefined} />);
    ready(PLAN);
    expect(screen.getByTestId('split-piece-count').textContent).toContain('5');
    expect(document.body.textContent).toContain(t('es', 'split.sum.jointsValue', { count: 4, with: 3, without: 1 }));
    expect(document.body.textContent).toContain(t('es', 'split.noJoint'));
    expect((splitButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('deshabilita Dividir con el motivo si el motor no acepta el plan', () => {
    render(<SplitForBedPanel open onClose={() => undefined} />);
    ready(null, 'Harían falta unas 900 piezas');
    const button = splitButton() as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByRole('alert', { hidden: true }).textContent).toContain('Harían falta unas 900 piezas');
    expect(button.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('un plano arrastrado en el visor se pide como posición forzada', () => {
    render(<SplitForBedPanel open onClose={() => undefined} />);
    ready(PLAN);
    act(() => emitSplitPlaneMove({ axis: 'y', index: 1, position: 432 }));
    expect(request.mock.calls.at(-1)![2].planePositions).toEqual({ y: [200, 432, 600, 800] });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('es', 'split.resetPlanes')), hidden: true }));
    expect(request.mock.calls.at(-1)![2].planePositions).toEqual({});
  });

  it('cada "Elegir" tiene nombre propio y, tras elegir, ↑/↓ (Mayús ×10) mueven el plano con el foco en el botón', () => {
    render(<SplitForBedPanel open onClose={() => undefined} />);
    ready(PLAN);
    const pick = screen.getByRole('button', { name: t('es', 'split.planePickLabel', { axis: 'Y', n: 2 }), hidden: true });
    expect(screen.getAllByRole('button', { name: new RegExp(t('es', 'split.planePick')), hidden: true }).length).toBe(4);
    expect(pick.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(pick);
    expect(useKuraStore.getState().splitActivePlane).toBe('y:1');
    expect(pick.getAttribute('aria-pressed')).toBe('true');
    pick.focus();
    fireEvent.keyDown(pick, { key: 'ArrowUp' });
    expect(request.mock.calls.at(-1)![2].planePositions).toEqual({ y: [200, 401, 600, 800] });
    fireEvent.keyDown(pick, { key: 'ArrowDown', shiftKey: true });
    expect(request.mock.calls.at(-1)![2].planePositions).toEqual({ y: [200, 391, 600, 800] });
    act(() => useKuraStore.setState({ splitActivePlane: null }));
  });

  it('queda ligado al objeto con que se abrió: deseleccionar no borra el plan; si el objeto desaparece, se cierra', () => {
    const onClose = vi.fn();
    render(<SplitForBedPanel open onClose={onClose} />);
    ready(PLAN);
    act(() => useKuraStore.setState({ selectedIds: [] }));
    expect(screen.getByTestId('split-piece-count').textContent).toContain('5');
    expect(document.body.textContent).toContain(t('es', 'split.target', { name: 'Tubería' }));
    expect(onClose).not.toHaveBeenCalled();
    act(() => useKuraStore.setState({ objects: [] }));
    expect(onClose).toHaveBeenCalled();
  });

  it('con el tope superado ofrece continuar con las piezas necesarias y pide maxPieces auto', () => {
    render(<SplitForBedPanel open onClose={() => undefined} />);
    expect(request.mock.calls.at(-1)![2].connector).toMatchObject({ type: 'dowel', minWallForConnectorMm: 8 });
    act(() =>
      useKuraStore.setState({
        splitPlanPreview: {
          objectId: 'a', status: 'error', plan: null, bed: { widthMm: 256, depthMm: 256, heightMm: 256 },
          error: 'Harían falta unas 125 piezas', errorCode: 'SPLIT_TOO_MANY_PIECES', errorParams: { needed: 125, max: 64 },
        },
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: t('es', 'split.continueWith', { count: 125 }), hidden: true }));
    expect(request.mock.calls.at(-1)![2].maxPieces).toBe('auto');
  });
});
