/**
 * @file src/components/__tests__/SplitMagnetOptions.test.tsx
 * @description Dividir para imprimir con unión «Imanes»: el tipo se ofrece, pide el plan con el conector de imanes
 * (5 × 2 por defecto, cantidad automática), oculta los campos de conector macho/hembra, cambia de imán por preajuste,
 * pasa a cantidad fija, recuerda la polaridad y avisa si el imán elegido es cuadrado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { SplitForBedPanel } from '../split/SplitForBedPanel';

const request = vi.fn();
beforeEach(() => {
  request.mockReset();
  useKuraStore.setState({
    objects: [fakeBox('a', 'Figura', 40)],
    selectedIds: ['a'],
    customBedDimensions: { width: 256, depth: 256, height: 256 },
    requestSplitPlan: request,
    busyOperation: null,
  } as never);
});

const lastConnector = () => request.mock.calls.at(-1)![2].connector;

describe('Dividir: unión con imanes', () => {
  it('ofrece Imanes, pide el plan con 5 × 2 y cantidad automática, y oculta los campos del conector', () => {
    render(<SplitForBedPanel open onClose={() => undefined} />);
    const select = screen.getByLabelText(t('es', 'dialog.cut.connectorType'), { selector: 'select' }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'magnet' } });
    expect(lastConnector()).toMatchObject({ type: 'magnet', size: 2.5, countAuto: true, magnet: { shape: 'round', sizeMm: 5, heightMm: 2 } });
    expect(screen.getByTestId('split-magnet-options')).toBeTruthy();
    expect(screen.queryByLabelText(`${t('es', 'dialog.cut.connectorDepth')} (mm)`)).toBeNull();
    expect(screen.queryByLabelText(`${t('es', 'split.minWall')} (mm)`)).toBeNull();
    expect(screen.getByTestId('split-magnet-polarity').textContent).toContain(t('es', 'splitMagnet.polarity'));
    expect(document.body.textContent).toContain(t('es', 'splitMagnet.help', { width: '5,2', depth: '2,2' }));
  });

  it('cambia de imán por preajuste, pasa a cantidad fija y admite cuadrados y rectangulares sin aviso', () => {
    render(<SplitForBedPanel open onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText(t('es', 'dialog.cut.connectorType'), { selector: 'select' }), { target: { value: 'magnet' } });
    const preset = screen.getByTestId('split-magnet-preset') as HTMLSelectElement;
    expect(preset.value).toBe('builtin:round-5x2');
    fireEvent.change(preset, { target: { value: 'builtin:round-3x1' } });
    expect(lastConnector()).toMatchObject({ size: 1.5, magnet: { sizeMm: 3, heightMm: 1 } });
    fireEvent.click(screen.getByTestId('split-magnet-count-auto'));
    expect(lastConnector()).toMatchObject({ count: 2 });
    expect(lastConnector().countAuto).toBeUndefined();
    fireEvent.change(preset, { target: { value: 'builtin:square-5x5x2' } });
    expect(lastConnector()).toMatchObject({ magnet: { shape: 'square', sizeMm: 5 } });
    expect(screen.queryByTestId('split-magnet-square')).toBeNull();
    expect(document.body.textContent).toContain(t('es', 'splitMagnet.helpBlock', { size: '5,2 × 5,2 × 2,2' }));
    fireEvent.change(preset, { target: { value: 'builtin:rect-10x5x2' } });
    expect(preset.value).toBe('builtin:rect-10x5x2');
    expect(lastConnector()).toMatchObject({ magnet: { shape: 'rect', sizeMm: 10, widthMm: 5, heightMm: 2 } });
    expect(document.body.textContent).toContain(t('es', 'splitMagnet.helpBlock', { size: '10,2 × 5,2 × 2,2' }));
  });
});
