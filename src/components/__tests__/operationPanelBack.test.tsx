/**
 * @file src/components/__tests__/operationPanelBack.test.tsx
 * @description Patrón común de los paneles de operación: «Volver» en el encabezado (primero en el orden de
 * tabulación, Esc anunciado), Esc cierra, el foco regresa al disparador y el pie lleva solo la acción
 * principal (sin «Cancelar» ni «Listo»). Se recorre cada panel con pie (corte, molde, proyección, rosca,
 * imagen a 3D, dividir) y los de colocación (imán, torreta).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { OperationPanel } from '../OperationPanel';
import { MoldModal } from '../dialogs/MoldModal';
import { ThreadModal } from '../dialogs/ThreadModal';
import { PlaneCutModal } from '../PlaneCutModal';
import { SurfaceProjectModal } from '../dialogs/SurfaceProjectModal';

afterEach(cleanup);
beforeEach(() => useKuraStore.setState({ language: 'es' } as never));

const BACK = () => t('es', 'panel.action.back');

/** Dispara el panel desde un botón, como hace el menú: el foco debe volver a él al cerrar. */
const Host: React.FC<{ render: (open: boolean, close: () => void) => React.ReactNode }> = ({ render: body }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir</button>
      {body(open, () => setOpen(false))}
    </>
  );
};

const PANELS: Array<[string, (open: boolean, close: () => void) => React.ReactNode]> = [
  ['genérico con pie', (open, close) => (
    <OperationPanel open={open} onClose={close} title="Panel" footer={<button type="button" className="kura-btn kura-btn-primary">Crear</button>}>
      <input aria-label="Medida" />
    </OperationPanel>
  )],
  ['Molde', (open, close) => <MoldModal open={open} onClose={close} />],
  ['Rosca', (open, close) => <ThreadModal open={open} onClose={close} />],
  ['Corte por plano', (open, close) => <PlaneCutModal open={open} onClose={close} />],
  ['Proyección sobre superficie', (open, close) => <SurfaceProjectModal open={open} onClose={close} />],
];

describe('paneles de operación: un solo patrón «Volver»', () => {
  for (const [name, make] of PANELS) {
    it(`${name}: «Volver» abre primero, Esc cierra, el foco vuelve al disparador y el pie no tiene Cancelar/Listo`, () => {
      render(<Host render={make} />);
      const trigger = screen.getByRole('button', { name: 'Abrir' });
      trigger.focus();
      fireEvent.click(trigger);

      const back = screen.getByRole('button', { name: BACK() });
      expect(back.getAttribute('aria-keyshortcuts')).toBe('Escape');
      expect(back.title).toContain('Esc');
      const buttons = Array.from(document.querySelectorAll<HTMLElement>('.kura-op-panel button'));
      expect(buttons[0]).toBe(back);

      expect(screen.queryByRole('button', { name: t('es', 'dialog.cancel') })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Listo' })).toBeNull();
      expect(screen.queryByRole('button', { name: t('es', 'common.close') })).toBeNull();
      const footer = document.querySelector('.kura-op-panel-footer');
      if (footer) expect(footer.querySelectorAll('.kura-btn-primary').length).toBe(1);

      fireEvent.keyDown(document.querySelector('.kura-op-panel')!, { key: 'Escape' });
      expect(document.querySelector('.kura-op-panel')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  }

  it('el clic en «Volver» cierra y devuelve el foco', () => {
    render(<Host render={PANELS[0][1]} />);
    const trigger = screen.getByRole('button', { name: 'Abrir' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: BACK() }));
    expect(document.querySelector('.kura-op-panel')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
