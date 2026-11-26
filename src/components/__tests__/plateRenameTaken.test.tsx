/**
 * @file src/components/__tests__/plateRenameTaken.test.tsx
 * @description Renombrar una placa con el nombre de otra: la tira lo rechaza con un aviso junto al campo y conserva
 * lo escrito (sin duplicar); el núcleo, por si llega de otra vía (MCP), ajusta el nombre con `uniquePlateName`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renamePlate } from '../../core/scene/plates';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { ScenePlate } from '../../types/plates';
import { PlateStrip } from '../plates/PlateStrip';

const PLATES: ScenePlate[] = [
  { id: 'p1', name: 'Placa 1', origin: [0, 0] },
  { id: 'p2', name: 'Placa 2', origin: [300, 0] },
];

beforeEach(() => {
  useKuraStore.setState({
    language: 'es', plates: PLATES, objects: [], activePlateId: 'p1', selectedIds: [], plateSolo: false, past: [], future: [],
    busyOperation: null, layout: 'print', customBedDimensions: null, groups: [], toasts: [],
  } as never);
});
afterEach(cleanup);

describe('renombrar una placa con un nombre repetido', () => {
  it('la tira avisa junto al campo, no duplica y conserva la edición', () => {
    render(<PlateStrip />);
    fireEvent.doubleClick(document.querySelector('[data-plate-id="p1"] button.kura-plate-chip-main')!);
    const input = screen.getByLabelText(t('es', 'plates.rename.label')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'placa 2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('placa 2');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.value).toBe('placa 2');
    expect(useKuraStore.getState().plates.map((p) => p.name)).toEqual(['Placa 1', 'Placa 2']);
    // Corregido, se acepta.
    fireEvent.change(input, { target: { value: 'Mangos' } });
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useKuraStore.getState().plates.map((p) => p.name)).toEqual(['Mangos', 'Placa 2']);
  });

  it('el núcleo nunca deja nombres repetidos', () => {
    const next = renamePlate({ objects: [], plates: PLATES }, 'p1', 'Placa 2');
    expect(next?.plates.map((p) => p.name)).toEqual(['Placa 3', 'Placa 2']);
    expect(renamePlate({ objects: [], plates: PLATES }, 'p1', 'PLACA 1')?.plates[0].name).toBe('PLACA 1');
  });
});
