/**
 * @file src/components/__tests__/ParametersSection.test.tsx
 * @description Sección Parámetros del inspector: muestra los campos propios del tipo, confirma una
 * edición por el Command Bus (`update_primitive_params`) y, si la malla cambió, solo lo explica.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { fireEvent, render, screen } from '@testing-library/react';
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
