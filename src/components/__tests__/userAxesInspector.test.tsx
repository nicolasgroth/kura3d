/**
 * @file src/components/__tests__/userAxesInspector.test.tsx
 * @description El inspector y la alineación hablan en ejes del usuario (Z = altura, como los slicers):
 * escribir Z = 10 sube la pieza 10 mm, girar 90° en Z gira sobre la cama y "Abajo (Z)" iguala las bases.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject } from '../../types/kura';
import { TransformSection } from '../inspector/TransformSection';
import { InspectorMulti } from '../inspector/InspectorMulti';
import type { InspectorLocalState } from '../inspector/inspectorTypes';

const noop = () => undefined;
const ui = {
  positionRelative: false, setPositionRelative: noop,
  rotationRelative: false, setRotationRelative: noop,
  scaleBySize: false, setScaleBySize: noop,
} as unknown as InspectorLocalState;

const byId = (id: string) => useKuraStore.getState().objects.find((o) => o.id === id)!;

function Harness({ id }: { id: string }) {
  const primary = useKuraStore((s) => s.objects.find((o) => o.id === id));
  return primary ? <TransformSection primary={primary} ui={ui} /> : null;
}

function setField(label: string, value: string) {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.blur(input);
}

beforeEach(() => {
  useKuraStore.setState({
    objects: [fakeBox('a', 'Caja', 20)], selectedIds: ['a'], past: [], future: [],
    unitSystem: 'mm', language: 'es', toasts: [], busyOperation: null,
  });
});

describe('inspector en ejes del usuario', () => {
  it('no muestra el rótulo provisorio "Y = altura" y rotula X, Y, Z', () => {
    render(<Harness id="a" />);
    expect(screen.queryByText(/Y = altura/)).toBeNull();
    const position = `${t('es', 'inspector.field.position')} (mm)`;
    for (const axis of ['X', 'Y', 'Z']) expect(screen.getByLabelText(`${position} ${axis}`)).toBeTruthy();
  });

  it('escribir Z = 10 sube la pieza 10 mm (Y interno)', () => {
    render(<Harness id="a" />);
    setField(`${t('es', 'inspector.field.position')} (mm) Z`, '10');
    expect(byId('a').position).toEqual([0, 10, 0]);
  });

  it('escribir Y = 30 la lleva 30 mm hacia el fondo (−Z interno)', () => {
    render(<Harness id="a" />);
    setField(`${t('es', 'inspector.field.position')} (mm) Y`, '30');
    expect(byId('a').position).toEqual([0, 0, -30]);
  });

  it('girar 90° en Z gira sobre la cama: solo cambia el giro vertical y la pieza sigue apoyada', () => {
    render(<Harness id="a" />);
    setField(t('es', 'inspector.field.rotation') + ' Z', '90');
    const o: SceneObject = byId('a');
    expect(o.rotation[0]).toBeCloseTo(0, 9);
    expect(o.rotation[1]).toBeCloseTo(Math.PI / 2, 9);
    expect(o.rotation[2]).toBeCloseTo(0, 9);
    expect(o.position[1]).toBe(0);
  });
});

describe('alineación en ejes del usuario', () => {
  it('"Abajo (Z)" iguala las bases en altura y "Frente (Y)" alinea hacia el frente', () => {
    const a = fakeBox('a', 'A', 20);
    const b = { ...fakeBox('b', 'B', 20), position: [40, 15, 10] } as SceneObject;
    useKuraStore.setState({ objects: [a, b], selectedIds: ['a', 'b'], rightCollapsed: false });
    render(<InspectorMulti />);
    const bottom = screen.getByRole('button', { name: t('es', 'align.tip.minY') });
    expect(bottom.textContent).toContain('Abajo (Z)');
    fireEvent.click(bottom);
    expect(byId('a').position[1]).toBeCloseTo(byId('b').position[1], 6);
    const front = screen.getByRole('button', { name: t('es', 'align.tip.maxZ') });
    expect(front.textContent).toContain('Frente (Y)');
    // Orden de los botones: fila X, luego Y (frente → fondo), luego Z (abajo → arriba).
    const labels = screen.getAllByRole('button').map((el) => el.textContent ?? '');
    expect(labels.findIndex((l) => l.includes('Frente (Y)'))).toBeLessThan(labels.findIndex((l) => l.includes('Abajo (Z)')));
  });
});
