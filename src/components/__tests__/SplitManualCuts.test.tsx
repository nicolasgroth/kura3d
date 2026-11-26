/**
 * @file src/components/__tests__/SplitManualCuts.test.tsx
 * @description Cortes a mano del panel "Dividir para imprimir": modelo de la lista (agregar en el eje más largo,
 * duplicar desplazado, quitar, acotar posición y ángulos, partir desde un plan), y en el panel: «Editar estos cortes
 * a mano» copia la rejilla, quitar/duplicar/agregar e inclinar cambian `manualCuts`, el arrastre de un plano a mano
 * mueve su fila, «Volver al automático» restablece y el conmutador «Solo las piezas» oculta los planos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BedSplitPlan, SplitManualCut } from '../../engine';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { SplitForBedPanel } from '../split/SplitForBedPanel';
import { emitSplitPlaneMove } from '../split/splitPlaneDrag';
import { addCut, cutsFromPlan, duplicateCut, positionRange, removeCut, updateCut, userBoxOfObject, userBoxOfPlan, type UserBox } from '../split/splitManualCutsModel';

const plane = (axis: 'x' | 'y' | 'z', index: number, position: number, extra: Partial<BedSplitPlan['planes'][number]> = {}) => ({
  axis, index, position, uniformPosition: position, sectionAreaMm2: 100, islands: 1, strips: 0, smallestIslandMm2: 100, admitsConnectors: true, ...extra,
});
const PLAN: BedSplitPlan = {
  bounds: { min: [-500, -500, -500], max: [500, 500, 500] },
  usableMm: [246, 246, 246],
  counts: { x: 1, y: 3, z: 1 },
  planes: [plane('y', 0, -200), plane('y', 1, 150)],
  pieces: [0, 1, 2].map((j) => ({
    code: `A${j + 1}`, cell: [0, j, 0] as [number, number, number],
    bounds: { min: [-500, -500, -500] as [number, number, number], max: [500, 500, 500] as [number, number, number] },
    sizeMm: [200, 200, 200] as [number, number, number], rotated: false, printRotation: [0, 0, 0] as [number, number, number], diagonal: false, bedMarginMm: 5,
  })),
  fitsWithoutCuts: false,
  connector: { type: 'dowel', size: 4, depth: 6, tolerance: 0.25, count: 2 },
  elapsedMs: 5,
};

const BOX: UserBox = { min: [-100, -50, 0], max: [100, 50, 300] };

describe('modelo de la lista de cortes a mano', () => {
  it('agrega en el centro del eje más largo, duplica desplazado y quita', () => {
    let cuts = addCut([], BOX);
    expect(cuts).toHaveLength(1);
    expect(cuts[0]).toMatchObject({ axis: 'z', positionMm: 150, tiltDeg: [0, 0] });
    cuts = duplicateCut(cuts, cuts[0].id, BOX);
    expect(cuts.map((c) => c.positionMm)).toEqual([150, 180]);
    expect(cuts[1].id).not.toBe(cuts[0].id);
    cuts = removeCut(cuts, cuts[0].id);
    expect(cuts.map((c) => c.positionMm)).toEqual([180]);
  });

  it('agregar no cae sobre un plano que ya existe en ese eje: va al centro del tramo libre más largo', () => {
    // Rejilla automática con un corte al centro (Z = 150): el nuevo no debe quedar encima (se cruzarían al inclinar).
    let cuts = addCut([], BOX);
    cuts = addCut(cuts, BOX);
    expect(cuts.map((c) => c.positionMm)).toEqual([150, 75]);
    cuts = addCut(cuts, BOX);
    expect(cuts.map((c) => c.positionMm)).toEqual([150, 75, 225]);
    // Otro eje no cuenta: en X vacío vuelve al centro.
    expect(addCut(cuts, BOX, 'x').at(-1)).toMatchObject({ axis: 'x', positionMm: 0 });
  });

  it('acota posición al modelo y ángulos a ±45°; al cambiar de eje vuelve al centro', () => {
    const [c] = addCut([], BOX, 'x');
    expect(updateCut([c], c.id, { positionMm: 999 }, BOX)[0].positionMm).toBe(positionRange(BOX, 'x').max);
    expect(updateCut([c], c.id, { tiltDeg: [80, -60] }, BOX)[0].tiltDeg).toEqual([45, -45]);
    expect(updateCut([c], c.id, { axis: 'y' }, BOX)[0]).toMatchObject({ axis: 'y', positionMm: 0 });
  });

  it('parte desde los planos de un plan en ejes del usuario (Y interno = Z del usuario)', () => {
    const cuts = cutsFromPlan(PLAN);
    expect(cuts.map((c) => [c.axis, c.positionMm])).toEqual([['z', -200], ['z', 150]]);
  });
});

const request = vi.fn();
const lastCuts = (): SplitManualCut[] | undefined => request.mock.calls.at(-1)![2].manualCuts;
const ready = (plan: BedSplitPlan) =>
  act(() =>
    useKuraStore.setState({
      splitPlanPreview: { objectId: 'a', status: 'ready', plan, bed: { widthMm: 256, depthMm: 256, heightMm: 256 }, error: null, errorCode: null },
    }),
  );
const button = (name: string) => screen.getByRole('button', { name, hidden: true });

beforeEach(() => {
  request.mockReset();
  useKuraStore.setState({
    objects: [fakeBox('a', 'Bloque', 1000)],
    selectedIds: ['a'],
    customBedDimensions: { width: 256, depth: 256, height: 256 },
    requestSplitPlan: request,
    busyOperation: null,
    splitShowCuts: true,
  } as never);
});

describe('panel: cortes a mano', () => {
  it('«Editar estos cortes a mano» copia la rejilla; quitar, duplicar, agregar e inclinar cambian el plan pedido', () => {
    render(<SplitForBedPanel open onClose={() => undefined} />);
    ready(PLAN);
    expect(lastCuts()).toBeUndefined();
    fireEvent.click(button(t('es', 'split.manual.fromAuto')));
    expect(lastCuts()!.map((c) => [c.axis, c.positionMm])).toEqual([['y', -200], ['y', 150]]);
    expect(screen.getByRole('radio', { name: t('es', 'split.mode.manual'), hidden: true })).toHaveProperty('checked', true);

    fireEvent.click(button(t('es', 'split.manual.removeAria', { n: 1 })));
    expect(lastCuts()!.map((c) => c.positionMm)).toEqual([150]);
    fireEvent.click(button(t('es', 'split.manual.duplicateAria', { n: 1 })));
    expect(lastCuts()).toHaveLength(2);
    fireEvent.click(button(t('es', 'split.manual.add')));
    expect(lastCuts()).toHaveLength(3);

    const tilt = screen.getByLabelText(t('es', 'split.manual.tiltAria', { n: 1, axis: 'X' }), { selector: 'input' });
    fireEvent.change(tilt, { target: { value: '15' } });
    fireEvent.blur(tilt);
    expect(lastCuts()![0].tiltDeg).toEqual([15, 0]);
  });

  it('el arrastre de un plano a mano en el visor mueve su fila (acotado al modelo)', () => {
    render(<SplitForBedPanel open onClose={() => undefined} />);
    ready(PLAN);
    fireEvent.click(button(t('es', 'split.manual.fromAuto')));
    const cuts = lastCuts()!;
    ready({ ...PLAN, manual: true, planes: cuts.map((c, i) => plane(c.axis, i, c.positionMm, { cutId: c.id, cutIndex: i })) });
    act(() => emitSplitPlaneMove({ axis: 'y', index: 1, position: 260.4 }));
    const box = userBoxOfObject(useKuraStore.getState().objects[0]) ?? userBoxOfPlan(PLAN);
    const expected = Math.min(positionRange(box, 'z').max, 260.4);
    expect(lastCuts()![1].positionMm).toBeCloseTo(expected, 1);
    // «Ver» resalta el plano en el visor
    fireEvent.click(button(t('es', 'split.manual.pickAria', { n: 2 })));
    expect(useKuraStore.getState().splitActivePlane).toBe('y:1');
  });

  it('«Volver al automático» vacía la lista y pide la rejilla; a mano sin planos bloquea Dividir con motivo', () => {
    render(<SplitForBedPanel open onClose={() => undefined} />);
    ready(PLAN);
    fireEvent.click(button(t('es', 'split.manual.fromAuto')));
    fireEvent.click(button(t('es', 'split.manual.removeAria', { n: 1 })));
    fireEvent.click(button(t('es', 'split.manual.removeAria', { n: 1 })));
    expect(screen.getAllByText(t('es', 'split.manual.empty')).length).toBeGreaterThan(0);
    expect((button(t('es', 'split.execute')) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button(t('es', 'split.manual.reset')));
    expect(lastCuts()).toBeUndefined();
    expect(screen.getByRole('radio', { name: t('es', 'split.mode.auto'), hidden: true })).toHaveProperty('checked', true);
  });

  it('el conmutador «Solo las piezas» oculta los planos y «Mostrar cortes» los vuelve a mostrar', () => {
    render(<SplitForBedPanel open onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('radio', { name: t('es', 'split.view.onlyParts'), hidden: true }));
    expect(useKuraStore.getState().splitShowCuts).toBe(false);
    fireEvent.click(screen.getByRole('radio', { name: t('es', 'split.view.showCuts'), hidden: true }));
    expect(useKuraStore.getState().splitShowCuts).toBe(true);
  });
});
