/**
 * @file src/components/__tests__/CommandPaletteBedActions.test.tsx
 * @description En las vistas Armado y Libre las acciones de cama de la paleta de comandos (Apoyar, Centrar, Distribuir,
 * Ajustar a la impresora) salen deshabilitadas con el motivo «Disponible en la vista Imprimir»; en Imprimir, no.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { actionName } from '../../store/actionLabels';
import { t } from '../../i18n';
import { fakeBox } from '../../test/fakeObjects';
import { useKuraStore } from '../../store/useKuraStore';
import { CommandPalette } from '../CommandPalette';

afterEach(cleanup);

const NOMBRES = () => [
  actionName('es', 'dropToBed'),
  actionName('es', 'centerOnBed'),
  t('es', 'cmd.pro.arrangeGrid'),
  actionName('es', 'fitToBed'),
];

async function abrir(layout: 'print' | 'assembly', freeView = false) {
  useKuraStore.setState({ language: 'es', layout, freeView, objects: [fakeBox('a', 'Caja')], selectedIds: ['a'], busyOperation: null, commandPaletteOpen: true } as never);
  render(<CommandPalette />);
  return { input: screen.getByRole('combobox', { name: t('es', 'cmd.inputLabel') }) };
}

describe('paleta de comandos: acciones de cama según la vista', () => {
  for (const [vista, freeView] of [['Armado', false], ['Libre', true]] as const) {
    it(`en ${vista} están deshabilitadas con el motivo «Disponible en la vista Imprimir»`, async () => {
      const { input } = await abrir('assembly', freeView);
      for (const nombre of NOMBRES()) {
        
        fireEvent.change(input, { target: { value: nombre } });
        const opcion = screen.getAllByRole('option').find((o) => o.textContent?.includes(nombre));
        expect(opcion, nombre).toBeDefined();
        expect(opcion!.getAttribute('aria-disabled'), nombre).toBe('true');
        expect(opcion!.getAttribute('title'), nombre).toBe(t('es', 'viewMode.reason.printOnly'));
      }
    });
  }

  it('en Imprimir están disponibles', async () => {
    const { input } = await abrir('print');
    for (const nombre of NOMBRES()) {
      
      fireEvent.change(input, { target: { value: nombre } });
      const opcion = screen.getAllByRole('option').find((o) => o.textContent?.includes(nombre));
      expect(opcion, nombre).toBeDefined();
      expect(opcion!.getAttribute('aria-disabled'), nombre).toBeNull();
    }
  });
});
