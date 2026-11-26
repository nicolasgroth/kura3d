/**
 * @file src/components/__tests__/panelEscapeChain.test.tsx
 * @description Esc de los paneles con la cadena de prioridad: un grupo abierto, un menú, un diálogo o un cálculo
 * cancelable ganan al panel; con la cadena libre el Esc vuelve (dentro del panel y con el foco en el cuerpo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useRef } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKuraStore } from '../../store/useKuraStore';
import { usePanelEscape } from '../shell/usePanelEscape';

const Harness: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  usePanelEscape(ref, onBack, { level: 'panel', outside: 'body' });
  return <div ref={ref} className="kura-ctx-action"><button type="button">x</button></div>;
};

beforeEach(() => {
  useKuraStore.setState({ activeDialog: null, groupContextId: null, uiDensity: 'normal', busyProgress: null, commandPaletteOpen: false } as never);
});
afterEach(cleanup);

describe('Esc de un panel', () => {
  it('con la cadena libre vuelve, dentro del panel y con el foco en el cuerpo', () => {
    const back = vi.fn();
    const { container } = render(<Harness onBack={back} />);
    fireEvent.keyDown(container.querySelector('button')!, { key: 'Escape' });
    expect(back).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(back).toHaveBeenCalledTimes(2);
  });

  it('un grupo abierto gana: el panel no vuelve (App sale del grupo)', () => {
    useKuraStore.setState({ groupContextId: 'g1' } as never);
    const back = vi.fn();
    const { container } = render(<Harness onBack={back} />);
    fireEvent.keyDown(container.querySelector('button')!, { key: 'Escape' });
    expect(back).not.toHaveBeenCalled();
  });

  it('el modo sin distracciones gana al panel', () => {
    useKuraStore.setState({ uiDensity: 'zen' } as never);
    const back = vi.fn();
    const { container } = render(<Harness onBack={back} />);
    fireEvent.keyDown(container.querySelector('button')!, { key: 'Escape' });
    expect(back).not.toHaveBeenCalled();
  });

  it('un diálogo abierto gana al panel', () => {
    useKuraStore.setState({ activeDialog: 'cut' } as never);
    const back = vi.fn();
    const { container } = render(<Harness onBack={back} />);
    fireEvent.keyDown(container.querySelector('button')!, { key: 'Escape' });
    expect(back).not.toHaveBeenCalled();
  });

  it('un menú visible gana al panel', () => {
    const back = vi.fn();
    const { container } = render(<><Harness onBack={back} /><div role="menu">m</div></>);
    const menu = container.querySelector<HTMLElement>('[role="menu"]')!;
    menu.getClientRects = () => [{}] as unknown as DOMRectList;
    fireEvent.keyDown(container.querySelector('button')!, { key: 'Escape' });
    expect(back).not.toHaveBeenCalled();
  });

  it('un cálculo cancelable se cancela antes de cerrar el panel', () => {
    const cancel = vi.fn(() => true);
    useKuraStore.setState({ busyProgress: { cancellable: true }, cancelBusyOperation: cancel } as never);
    const back = vi.fn();
    const { container } = render(<Harness onBack={back} />);
    fireEvent.keyDown(container.querySelector('button')!, { key: 'Escape' });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
  });

  it('un Esc ya consumido (defaultPrevented) no cierra el panel', () => {
    const back = vi.fn();
    const { container } = render(<Harness onBack={back} />);
    const btn = container.querySelector('button')!;
    btn.addEventListener('keydown', (e) => e.preventDefault());
    fireEvent.keyDown(btn, { key: 'Escape' });
    expect(back).not.toHaveBeenCalled();
  });
});
