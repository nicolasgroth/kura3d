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
import { plateShortLabel } from '../../core/scene/plateShortLabel';
import { PlateBadge } from '../plates/PlateBadge';
import { useKuraStore } from '../../store/useKuraStore';

const PLATES = [
  { id: 'p1', name: 'Placa 1', origin: [0, 0] as [number, number] },
  { id: 'p2', name: 'Placa 2', origin: [300, 0] as [number, number] },
];

afterEach(cleanup);

describe('insignia de placa: rótulo corto', () => {
  it('«P» + la posición de la placa en la tira, sin importar el número del nombre; nunca una sola letra', () => {
    expect(plateShortLabel(0)).toBe('P1');
    expect(plateShortLabel(2)).toBe('P3');
    expect(plateShortLabel(2).length).toBeGreaterThan(1);
  });
});

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
    expect(badge.textContent).toBe('P2');
    expect(badge.getAttribute('aria-label')).toBe('Placa: Placa 2');
    expect(badge.getAttribute('title')).toContain('Placa 2');
  });
});

describe('insignia de placa: posición vs nombre', () => {
  it('muestra la posición en la tira y el nombre completo en title y nombre accesible', () => {
    const plates = [
      { id: 'p1', name: 'Placa 1', origin: [0, 0] as [number, number] },
      { id: 'p3', name: 'Placa 3', origin: [300, 0] as [number, number] },
    ];
    useKuraStore.setState({ language: 'es', plates } as never);
    render(<PlateBadge obj={{ plateRef: 'p3' }} />);
    const badge = screen.getByTestId('plate-badge');
    expect(badge.textContent).toBe('P2');
    expect(badge.getAttribute('aria-label')).toContain('Placa 3');
    expect(badge.getAttribute('title')).toContain('Placa 3');
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
