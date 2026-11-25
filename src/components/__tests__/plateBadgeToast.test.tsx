/**
 * @file src/components/__tests__/plateBadgeToast.test.tsx
 * @description La insignia de placa de la lista de escena (solo con 2 o más placas, con nombre accesible) y el aviso
 * breve al crear una placa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlateBadge } from '../plates/PlateBadge';
import { useKuraStore } from '../../store/useKuraStore';

const PLATES = [
  { id: 'p1', name: 'Placa 1', origin: [0, 0] as [number, number] },
  { id: 'p2', name: 'Placa 2', origin: [300, 0] as [number, number] },
];

afterEach(cleanup);

describe('insignia de placa', () => {
  it('con una sola placa no pinta nada', () => {
    useKuraStore.setState({ language: 'es', plates: [PLATES[0]] } as never);
    const { container } = render(<PlateBadge obj={{ plateRef: 'p1' }} />);
    expect(container.textContent).toBe('');
  });

  it('con dos o más placas muestra el nombre y lo anuncia con nombre accesible', () => {
    useKuraStore.setState({ language: 'es', plates: PLATES } as never);
    render(<PlateBadge obj={{ plateRef: 'p2' }} />);
    const badge = screen.getByTestId('plate-badge');
    expect(badge.textContent).toBe('Placa 2');
    expect(badge.getAttribute('aria-label')).toBe('Placa: Placa 2');
    expect(badge.getAttribute('title')).toContain('Placa 2');
  });
});

describe('crear placa', () => {
  it('avisa «Placa 2 creada»', () => {
    useKuraStore.setState({ language: 'es', objects: [], selectedIds: [], plates: [], toasts: [], past: [], future: [] } as never);
    act(() => {
      useKuraStore.getState().createPlate();
    });
    const texts = useKuraStore.getState().toasts.map((x) => x.text);
    expect(texts.some((m) => /Placa 2 creada/.test(m))).toBe(true);
  });
});
