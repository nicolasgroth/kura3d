/**
 * @file src/components/__tests__/plateStripArrange.test.tsx
 * @description El botón «Repartir…» de la tira de placas (`data-testid="plate-arrange"`) existe con dos o más placas en
 * las vistas Imprimir y Armado, tras «una placa por objeto», se encuentra por su texto visible (el nombre accesible
 * contiene lo que se ve: WCAG 2.5.3) y abre el panel «Repartir en placas…». Falla si un cambio de la tira lo quita.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closePlateArrangePanel, usePlateArrangePanel } from '../../store/plateArrangePanel';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { PlateStrip } from '../plates/PlateStrip';

const PLATES: ScenePlate[] = [
  { id: 'p1', name: 'Placa 1', origin: [0, 0] },
  { id: 'p2', name: 'Placa 2', origin: [300, 0] },
];

function seed(layout: 'print' | 'assembly', objects: SceneObject[] = []) {
  useKuraStore.setState({
    language: 'es', plates: PLATES, objects, activePlateId: 'p1', selectedIds: [], plateSolo: false, past: [], future: [],
    busyOperation: null, layout, customBedDimensions: null, groups: [], toasts: [],
  } as never);
}

beforeEach(() => seed('print'));
afterEach(() => {
  cleanup();
  closePlateArrangePanel();
});

describe('tira de placas: botón «Repartir…»', () => {
  it('está con dos placas en Imprimir y se encuentra por su texto visible', () => {
    seed('print');
    render(<PlateStrip />);
    const byId = screen.getByTestId('plate-arrange');
    expect(screen.getByRole('button', { name: 'Repartir…' })).toBe(byId);
    expect(byId.textContent).toContain('Repartir…');
    expect((byId as HTMLButtonElement).disabled).toBe(false);
  });

  it('en Armado las placas no se editan: el botón deja su lugar a los controles de separación', () => {
    seed('assembly');
    render(<PlateStrip />);
    expect(screen.queryByTestId('plate-arrange')).toBeNull();
    expect(screen.getByTestId('viewmode-explode')).toBeTruthy();
  });

  it('sigue tras «una placa por objeto» y abre el panel de reparto', () => {
    seed('print', [{ ...fakeBox('a', 'A'), plateRef: 'p1' } as SceneObject, { ...fakeBox('b', 'B'), plateRef: 'p2' } as SceneObject]);
    render(<PlateStrip />);
    fireEvent.click(screen.getByTestId('plate-arrange'));
    expect(usePlateArrangePanel.getState().open).toBe(true);
  });
});
