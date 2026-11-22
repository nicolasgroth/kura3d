/**
 * @file src/components/__tests__/SplitFitNotice.test.tsx
 * @description El aviso «No cabe en la cama» muestra el tamaño en los ejes del usuario
 * (X × Y × Z, con Z = altura), no en los ejes internos del motor (Y arriba).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PRINTER_PROFILES, type SceneObject } from '../../types/kura';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { SplitFitNotice } from '../split/SplitOverlays';

/** Caja con tamaño interno (ancho X, alto Y, fondo Z) del motor. */
const box = (sx: number, sy: number, sz: number): SceneObject => {
  const o = fakeBox('t', 'Torre', 10);
  const v: number[] = [];
  for (const x of [-sx / 2, sx / 2]) for (const y of [0, sy]) for (const z of [-sz / 2, sz / 2]) v.push(x, y, z);
  o.mesh = { positions: new Float32Array(v), indices: new Uint32Array([0, 1, 2]) } as never;
  return o;
};

beforeEach(() => {
  useKuraStore.setState({
    language: 'es',
    printerProfile: { ...DEFAULT_PRINTER_PROFILES[0], bedWidthMm: 200, bedDepthMm: 200, maxHeightMm: 200 },
    activeDialog: null,
    busyOperation: null,
  } as never);
});

describe('SplitFitNotice', () => {
  it('torre de 600 mm de alto: dice 28 × 30 × 600 mm (X × Y × Z del usuario)', () => {
    // Interno: X=28, Y(altura)=600, Z(fondo)=30
    useKuraStore.setState({ objects: [box(28, 600, 30)], selectedIds: ['t'] } as never);
    render(<SplitFitNotice />);
    const text = screen.getByRole('status').textContent ?? '';
    expect(text).toContain('28 × 30 × 600');
    expect(text).not.toContain('28 × 600 × 30');
  });
});
