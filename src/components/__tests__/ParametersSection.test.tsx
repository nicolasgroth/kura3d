/**
 * @file src/components/__tests__/ParametersSection.test.tsx
 * @description Sección Parámetros del inspector: muestra los campos propios del tipo, confirma una
 * edición por el Command Bus (`update_primitive_params`) y, si la malla cambió, solo lo explica.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parametricOrigin } from '../../core/scene/parametric';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject } from '../../types/kura';
import { ParametersSection } from '../inspector/ParametersSection';

function cylinder(): SceneObject {
  const base = fakeBox('c', 'Cilindro');
  const mesh = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), indices: new Uint32Array([0, 1, 2]) };
  return {
    ...base, primitiveType: 'cylinder', primitiveParams: { radius: 5, height: 10 }, mesh,
    parametric: parametricOrigin('primitive', mesh),
  };
}

const label = (key: string) => t('es', `inspector.params.field.${key}` as never);

describe('ParametersSection', () => {
  it('muestra los campos del cilindro con sus valores y valores por defecto', () => {
    render(<ParametersSection primary={cylinder()} />);
    expect(screen.getByText(t('es', 'inspector.params.title'))).toBeTruthy();
    expect((screen.getByLabelText(label('radius')) as HTMLInputElement).value).toBe('5');
    expect((screen.getByLabelText(label('height')) as HTMLInputElement).value).toBe('10');
    expect((screen.getByLabelText(label('segments')) as HTMLInputElement).value).toBe('32');
    expect(screen.queryByLabelText(label('width'))).toBeNull();
  });

  it('al confirmar un valor envía update_primitive_params por el bus', async () => {
    const executeCommand = vi.fn().mockResolvedValue({ id: 'x', ok: true });
    useKuraStore.setState({ executeCommand } as never);
    render(<ParametersSection primary={cylinder()} />);
    const input = screen.getByLabelText(label('radius')) as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await vi.waitFor(() => expect(executeCommand).toHaveBeenCalled());
    expect(executeCommand.mock.calls[0][0]).toMatchObject({
      command: 'update_primitive_params', params: { id: 'c', params: { radius: 8 } },
    });
  });

  it('un valor fuera de rango o no numérico se marca con el rango y no se aplica; Escape restaura', async () => {
    const executeCommand = vi.fn().mockResolvedValue({ id: 'x', ok: true });
    useKuraStore.setState({ executeCommand } as never);
    render(<ParametersSection primary={cylinder()} />);
    const input = screen.getByLabelText(label('radius')) as HTMLInputElement;
    for (const bad of ['-5', 'abc']) {
      act(() => input.focus());
      fireEvent.change(input, { target: { value: bad } });
      act(() => input.blur());
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.value).toBe(bad);
      expect(screen.getByRole('alert').textContent).toContain('0,1');
      act(() => input.focus());
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(input.getAttribute('aria-invalid')).toBeNull();
      expect(input.value).toBe('5');
    }
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('↑/↓ aplican el valor en un solo comando al terminar la ráfaga', async () => {
    vi.useFakeTimers();
    try {
      const executeCommand = vi.fn().mockResolvedValue({ id: 'x', ok: true });
      useKuraStore.setState({ executeCommand } as never);
      render(<ParametersSection primary={cylinder()} />);
      const input = screen.getByLabelText(label('radius')) as HTMLInputElement;
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(executeCommand).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(600);
      expect(executeCommand).toHaveBeenCalledTimes(1);
      expect(executeCommand.mock.calls[0][0]).toMatchObject({ params: { params: { radius: 6.5 } } });
    } finally {
      vi.useRealTimers();
    }
  });

  it('muestra los límites del campo', () => {
    render(<ParametersSection primary={cylinder()} />);
    expect(document.querySelectorAll('.kura-param-range').length).toBeGreaterThan(0);
  });

  it('si una operación cambió la malla, reemplaza los campos por una explicación', () => {
    const obj = cylinder();
    const changed = { ...obj, mesh: { positions: new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0]), indices: new Uint32Array([0, 1, 2]) } };
    render(<ParametersSection primary={changed} />);
    expect(screen.getByRole('note').textContent).toBe(t('es', 'inspector.params.notParametric'));
    expect(screen.queryByLabelText(label('radius'))).toBeNull();
  });

  it('no aparece en objetos que nunca fueron paramétricos', () => {
    const { container } = render(<ParametersSection primary={fakeBox('b', 'Caja')} />);
    expect(container.textContent).toBe('');
  });
});
