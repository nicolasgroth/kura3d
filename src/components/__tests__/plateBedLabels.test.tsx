/**
 * @file src/components/__tests__/plateBedLabels.test.tsx
 * @description La barra de estado nombra la cama de la placa activa cuando tiene cama propia (como el rótulo del
 * visor), y en «Cama de Placa N» el radio de «la cama del proyecto» no comparte nombre accesible con el de la misma
 * impresora en la lista.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalizedPrinterName } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { PlateBedPicker } from '../plates/PlateBedPicker';
import { StatusBarMeasures } from '../StatusBarMeasures';

afterEach(cleanup);

const OWN = { name: 'Bambu X1', widthMm: 256, depthMm: 256, heightMm: 256 };

beforeEach(() => {
  useKuraStore.setState({
    language: 'es', unitSystem: 'mm', activePlateId: 'p2', customBedDimensions: null,
    plates: [{ id: 'p1', name: 'Placa 1', origin: [0, 0] }, { id: 'p2', name: 'Placa 2', origin: [400, 0], bed: OWN }],
  } as never);
});

describe('barra de estado: cama de la placa activa', () => {
  it('con cama propia muestra su nombre; con la del proyecto, la impresora', () => {
    const { rerender } = render(<StatusBarMeasures />);
    const trigger = () => document.querySelector('.kura-measures-trigger')!;
    expect(trigger().textContent).toContain('Bambu X1');
    expect(trigger().getAttribute('aria-label')).toContain('Bambu X1');
    expect(trigger().getAttribute('title')).toContain('Bambu X1');

    useKuraStore.setState({ activePlateId: 'p1' } as never);
    rerender(<StatusBarMeasures />);
    const project = getLocalizedPrinterName('es', useKuraStore.getState().printerProfile);
    expect(trigger().textContent).toContain(project);
    expect(trigger().textContent).not.toContain('Bambu X1');
  });
});

describe('«Cama de Placa N»: nombres accesibles de los radios', () => {
  it('ningún radio comparte nombre con otro', () => {
    useKuraStore.setState({ plates: [{ id: 'p1', name: 'Placa 1', origin: [0, 0] }] } as never);
    render(<PlateBedPicker plateId="p1" onClose={vi.fn()} />);
    const names = screen.getAllByRole('radio', { hidden: true }).map((r) => r.getAttribute('aria-label') ?? r.closest('label')?.textContent ?? '');
    expect(names.length).toBeGreaterThan(2);
    expect(new Set(names).size).toBe(names.length);
    expect(names.some((n) => n.startsWith('Cama del proyecto'))).toBe(true);
  });
});
