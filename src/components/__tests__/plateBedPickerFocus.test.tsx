/**
 * @file src/components/__tests__/plateBedPickerFocus.test.tsx
 * @description El diálogo «Cama de Placa N» abre con el foco en el radio marcado, no en «Cerrar».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlateBedPicker } from '../plates/PlateBedPicker';
import { useKuraStore } from '../../store/useKuraStore';

describe('selector de cama de la placa', () => {
  it('el foco inicial queda en el radio marcado', () => {
    useKuraStore.setState({
      language: 'es',
      plates: [{ id: 'p1', name: 'Placa 1', origin: [0, 0] }, { id: 'p2', name: 'Placa 2', origin: [400, 0] }],
    } as never);
    render(<PlateBedPicker plateId="p2" onClose={vi.fn()} />);
    const checked = screen.getByRole('radio', { checked: true, hidden: true }) as HTMLInputElement;
    expect(document.activeElement).toBe(checked);
  });
});
