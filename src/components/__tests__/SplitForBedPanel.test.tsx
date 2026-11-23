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
    const text = document.body.textContent ?? '';
    // Sin medir el armado, las uniones con conector son un máximo (el armado puede dejar alguna para pegar).
    expect(text).toContain(t('es', 'ux7.split.jointsUpTo', { count: 4, with: 3 }));
    ready({ ...PLAN, assemblyPreview: { joints: 4, glueJoints: 1 } });
    expect(document.body.textContent).toContain(t('es', 'split.sum.jointsGlueValue', { count: 4, with: 3, glue: 1 }));
    expect(text).toContain('solo para pegar');
    expect(text).not.toContain('sin conector');
    // Margen real contra la cama de la pieza más justa y opciones para tener conectores.
    expect(text).toContain(t('es', 'split.sum.marginValue', { code: 'A1', mm: '5' }));
    expect(screen.getByRole('button', { name: t('es', 'split.glueUseLap'), hidden: true })).toBeTruthy();
    expect((splitButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('ofrece Tarugo suelto con su ayuda y cuenta los tarugos del plan en el resumen', () => {
    render(<SplitForBedPanel open onClose={() => undefined} />);
    const select = screen.getByLabelText(t('es', 'dialog.cut.connectorType'), { selector: 'select' }) as HTMLSelectElement;
    expect(Array.from(select.options).some((o) => o.value === 'loose-dowel')).toBe(true);
    fireEvent.change(select, { target: { value: 'loose-dowel' } });
    expect(request.mock.calls.at(-1)![2].connector).toMatchObject({ type: 'loose-dowel' });
    expect(screen.getByText(t('es', 'split.looseDowelHelp'))).toBeTruthy();
    expect(select.getAttribute('aria-describedby')).toBeTruthy();
    ready({ ...PLAN, connector: { type: 'loose-dowel', size: 4, depth: 6, tolerance: 0.25, count: 2 } });
    // 4 uniones, 1 sin conector (plano que no lo admite): 3 × 2 tarugos de Ø8 × 11,5.
    expect(screen.getByTestId('split-dowel-count').textContent).toBe(t('es', 'split.sum.dowelsValue', { count: 6, d: '8', l: '11,5' }));
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
    const pick = screen.getByRole('button', { name: t('es', 'split.planePickLabel', { axis: 'Z', n: 2 }), hidden: true });
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
