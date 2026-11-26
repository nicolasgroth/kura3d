/**
 * @file src/components/__tests__/operationPanelFocus.test.tsx
 * @description Foco inicial de `OperationPanel`: al abrir cae en el primer control del cuerpo, no en
 * la X de cerrar del encabezado (el selector con prefijo solo aplicaba a la primera alternativa de la
 * lista `FOCUSABLE`), y `initialFocus` con varias alternativas también se busca dentro del cuerpo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { OperationPanel } from '../OperationPanel';

afterEach(cleanup);

const panel = (initialFocus?: string) => (
  <OperationPanel open onClose={() => undefined} title="Panel" initialFocus={initialFocus}>
    <button type="button">Primero</button>
    <input aria-label="Medida" />
  </OperationPanel>
);

describe('OperationPanel: foco al abrir', () => {
  it('va al primer control del cuerpo, no a «Volver»', () => {
    useKuraStore.setState({ language: 'es' } as never);
    render(panel());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Primero' }));
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: t('es', 'panel.action.back') }));
  });

  it('initialFocus con alternativas se busca dentro del cuerpo', () => {
    useKuraStore.setState({ language: 'es' } as never);
    render(panel('input, button'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Primero' }));
  });
});
