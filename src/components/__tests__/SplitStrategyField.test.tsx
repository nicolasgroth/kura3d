/**
 * @file src/components/__tests__/SplitStrategyField.test.tsx
 * @description Selector «Cómo cortar» de Dividir para imprimir: explica la opción elegida, avisa el
 * cambio y, con «Por las partes de la figura», muestra el resumen de cortes o que no hubo estrechamientos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BedSplitPlan } from '../../engine';
import { t } from '../../i18n';
import { SplitStrategyField } from '../split/SplitStrategyField';

const plan = (naturalCuts: number, straightCuts: number) =>
  ({ fitsWithoutCuts: false, strategy: 'natural', natural: { naturalCuts, straightCuts, candidates: [], analysisMs: 1 } }) as unknown as BedSplitPlan;

describe('SplitStrategyField', () => {
  it('rejilla por defecto con su explicación; cambiar avisa la estrategia nueva', () => {
    const onChange = vi.fn();
    render(<SplitStrategyField language="es" value="grid" onChange={onChange} plan={null} />);
    expect(screen.getByText(t('es', 'split.strategy.gridHelp'))).toBeTruthy();
    fireEvent.change(screen.getByLabelText(t('es', 'split.strategy')), { target: { value: 'natural' } });
    expect(onChange).toHaveBeenCalledWith('natural');
    expect(screen.queryByTestId('split-natural-summary')).toBeNull();
  });

  it('por partes: resumen de cortes, o aviso si no hubo estrechamientos', () => {
    const { rerender } = render(<SplitStrategyField language="es" value="natural" onChange={() => {}} plan={plan(2, 1)} />);
    expect(screen.getByText(t('es', 'split.strategy.naturalHelp'))).toBeTruthy();
    expect(screen.getByTestId('split-natural-summary').textContent).toBe(t('es', 'split.natural.summary', { natural: 2, straight: 1 }));
    rerender(<SplitStrategyField language="es" value="natural" onChange={() => {}} plan={plan(0, 2)} />);
    expect(screen.getByTestId('split-natural-summary').textContent).toBe(t('es', 'split.natural.none'));
  });
});
