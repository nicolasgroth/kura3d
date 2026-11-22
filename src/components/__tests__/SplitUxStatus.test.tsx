/**
 * @file src/components/__tests__/SplitUxStatus.test.tsx
 * @description Mejoras de usabilidad de la división: el pie del visor dice «Armado» (no «Fuera de volumen»)
 * mientras el grupo dividido está armado, el deslizador de explosión tiene nombre y valor anunciados, los
 * recuentos usan singular y plural correctos y el estado de la barra no muestra ids internos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { DEFAULT_PRINTER_PROFILES, type SceneObject } from '../../types/kura';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { ViewportHudBottom } from '../viewport/ViewportHudBottom';
import { SplitAssemblyControl } from '../split/SplitAssemblyControl';
import { bedStatusOf } from '../split/splitAssembledStatus';
import { StatusBar } from '../StatusBar';

/** Caja de `size` mm con vértices reales (los límites de la escena se miden sobre la malla). */
const solid = (o: SceneObject, size: number): SceneObject => {
  const h = size / 2;
  const v: number[] = [];
  for (const x of [-h, h]) for (const y of [0, size]) for (const z of [-h, h]) v.push(x, y, z);
  o.mesh = { positions: new Float32Array(v), indices: new Uint32Array([0, 1, 2]) } as never;
  return o;
};

const SMALL_BED = { ...DEFAULT_PRINTER_PROFILES[0], bedWidthMm: 10, bedDepthMm: 10, maxHeightMm: 10, showPrintVolume: true };

/** Pieza de una división: armada en el origen (excede la cama chica) y con su lugar de impresión lejos. */
const part = (id: string, code: string, printX: number): SceneObject => {
  const o = solid(fakeBox(id, code, 50), 50);
  o.metadata = {
    split: {
      groupId: 'g', code, cell: [0, 0, 0], assembly: { position: [0, 0, 0], rotation: [0, 0, 0] },
      print: { position: [printX, 0, 0], rotation: [0, 0, 0], plate: 0, downFace: '-y' }, jointLabels: [],
    },
  } as never;
  return o;
};

beforeEach(() => {
  useKuraStore.setState({ language: 'es', printerProfile: SMALL_BED, selectedIds: [], splitExplode: null, busyOperation: null } as never);
});

describe('estado del pie con la división armada', () => {
  it('piezas armadas que exceden la cama: «Armado», no «Fuera de volumen»', () => {
    const objects = [part('a', 'A1', 0), part('b', 'A2', 0)];
    expect(bedStatusOf(objects, SMALL_BED)).toBe('assembled');
    useKuraStore.setState({ objects } as never);
    render(<ViewportHudBottom />);
    expect(screen.getByRole('status').textContent).toContain('Armado: usa «Preparar para imprimir» para ver las placas');
    expect(screen.queryByText(t('es', 'viewport.bed.outOfBounds'))).toBeNull();
  });

  it('un objeto suelto fuera de la cama sigue diciendo «Fuera de volumen»', () => {
    const objects = [part('a', 'A1', 0), part('b', 'A2', 0), solid(fakeBox('x', 'Suelto', 50), 50)];
    expect(bedStatusOf(objects, SMALL_BED)).toBe('outOfBounds');
    useKuraStore.setState({ objects } as never);
    render(<ViewportHudBottom />);
    expect(screen.getByText(t('es', 'viewport.bed.outOfBounds'))).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('sin nada fuera de la cama no avisa de nada', () => {
    expect(bedStatusOf([solid(fakeBox('x', 'Chico', 4), 4)], SMALL_BED)).toBe('ok');
  });
});

describe('deslizador de explosión y recuentos', () => {
  it('el deslizador tiene nombre accesible y anuncia su valor', () => {
    const objects = [part('a', 'A1', 0), part('b', 'A2', 0)];
    useKuraStore.setState({ objects, selectedIds: ['a'] } as never);
    render(<SplitAssemblyControl />);
    const slider = screen.getByRole('slider', { name: t('es', 'splitUx.explode.label') });
    expect(slider.getAttribute('aria-valuetext')).toBe('0 % separado');
  });

  it('1 pieza y 1 placa en singular; varias en plural', () => {
    useKuraStore.setState({ objects: [part('a', 'A1', 0)], selectedIds: ['a'] } as never);
    const { unmount } = render(<SplitAssemblyControl />);
    expect(screen.getByText(/1 pieza · 1 placa$/)).toBeTruthy();
    unmount();
    useKuraStore.setState({ objects: [part('a', 'A1', 0), part('b', 'A2', 300)], selectedIds: ['a'] } as never);
    render(<SplitAssemblyControl />);
    expect(screen.getByText(/2 piezas · [12] placas?$/)).toBeTruthy();
  });
});

describe('barra de estado', () => {
  it('muestra el nombre de la operación y no su id interno', () => {
    useKuraStore.setState({ busyOperation: 'split_for_bed' } as never);
    const { container } = render(<StatusBar />);
    expect(container.textContent).toContain(`(${t('es', 'progress.op.split_for_bed')})`);
    expect(container.textContent).not.toContain('split_for_bed');
  });
});
