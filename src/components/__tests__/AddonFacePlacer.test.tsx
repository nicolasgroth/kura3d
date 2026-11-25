/**
 * @file src/components/__tests__/AddonFacePlacer.test.tsx
 * @description «Colocar en el centro de la cara» sin ratón: el selector de cara con nombre, la colocación por la misma
 * ruta del clic (punto y normal en ejes internos), el aviso sin pieza y el botón apagado con campos inválidos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { makeObject } from '../../engine/__tests__/geometryTestUtils';
import { box } from '../../engine/__tests__/orientShapes';
import { fakeBox } from '../../test/fakeObjects';
import { AddonFacePlacer } from '../addons/AddonFacePlacer';

beforeEach(() => {
  useKuraStore.setState({ objects: [makeObject('b1', box(20, 20, 20), { name: 'Caja' })], selectedIds: ['b1'], toasts: [], busyOperation: null });
});

describe('AddonFacePlacer', () => {
  it('coloca en el centro de la cara elegida con la normal hacia afuera', async () => {
    const user = userEvent.setup();
    const place = vi.fn().mockResolvedValue(true);
    render(<AddonFacePlacer testId="x" place={place} blocked={false} />);
    await user.click(screen.getByTestId('x-face-place'));
    expect(place).toHaveBeenCalledTimes(1);
    const [hostId] = place.mock.calls[0];
    expect(hostId).toBe('b1');
    const up = place.mock.calls[0][2] as number[];
    expect(Math.hypot(...up)).toBeCloseTo(1, 5);
    await user.selectOptions(screen.getByLabelText(t('es', 'addon.face.label')), 'bottom');
    await user.click(screen.getByTestId('x-face-place'));
    const down = place.mock.calls[1][2] as number[];
    // Arriba y Abajo miran hacia lados opuestos del mismo eje.
    expect(down.map((n, i) => n + up[i]).every((n) => Math.abs(n) < 1e-6)).toBe(true);
  });

  it('sin pieza elegida avisa y no coloca; con campos inválidos el botón está apagado', async () => {
    const user = userEvent.setup();
    const place = vi.fn();
    useKuraStore.setState({ objects: [fakeBox('a', 'A', 10), fakeBox('b', 'B', 10)], selectedIds: [] });
    const { rerender } = render(<AddonFacePlacer testId="x" place={place} blocked={false} />);
    await user.click(screen.getByTestId('x-face-place'));
    expect(place).not.toHaveBeenCalled();
    expect(useKuraStore.getState().toasts.some((x) => x.text === t('es', 'addon.face.needHost'))).toBe(true);
    rerender(<AddonFacePlacer testId="x" place={place} blocked />);
    expect((screen.getByTestId('x-face-place') as HTMLButtonElement).disabled).toBe(true);
  });
});
