/**
 * @file src/components/__tests__/StatusBarMeasures.test.tsx
 * @description Indicador de unidad e impresora de la barra de estado: texto compacto, nombre accesible,
 * popover con los dos selectores y cambio mediante las acciones del store.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { getLocalizedPrinterName, t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { DEFAULT_PRINTER_PROFILES } from '../../types/kura';
import { StatusBarMeasures } from '../StatusBarMeasures';

// jsdom no implementa la API Popover: se simula lo mínimo para ejercitar el componente.
beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.showPopover = function showPopover(this: HTMLElement) {
    this.setAttribute('data-open', 'true');
  };
  proto.hidePopover = function hidePopover(this: HTMLElement) {
    this.removeAttribute('data-open');
  };
});

describe('StatusBarMeasures', () => {
  it('muestra unidad e impresora, con nombre accesible y popover con ambos selectores', () => {
    useKuraStore.setState({ language: 'es', unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0] } as never);
    render(<StatusBarMeasures />);
    const name = getLocalizedPrinterName('es', DEFAULT_PRINTER_PROFILES[0]);
    const trigger = screen.getByRole('button', { name: t('es', 'status.measures.button', { unit: 'mm', printer: name }) });
    expect(trigger.textContent).toContain('mm');
    expect(trigger.textContent).toContain(name);
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('title')).toContain(name);
    expect(screen.getByLabelText(t('es', 'dialog.settings.unitLabel'), { selector: 'select', exact: true })).toBeTruthy();
    expect(screen.getByLabelText(t('es', 'dialog.settings.printerLabel'), { selector: 'select', exact: true })).toBeTruthy();
  });

  it('cambiar la unidad y la impresora usa las acciones del store y el indicador se actualiza', async () => {
    useKuraStore.setState({ language: 'es', unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0] } as never);
    const user = userEvent.setup();
    render(<StatusBarMeasures />);
    await user.selectOptions(screen.getByLabelText(t('es', 'dialog.settings.unitLabel')), 'in');
    expect(useKuraStore.getState().unitSystem).toBe('in');
    const other = DEFAULT_PRINTER_PROFILES[1];
    await user.selectOptions(screen.getByLabelText(t('es', 'dialog.settings.printerLabel')), other.id);
    expect(useKuraStore.getState().printerProfile.id).toBe(other.id);
    const trigger = screen.getByRole('button', { name: /^Unidad in e impresora/ });
    expect(trigger.textContent).toContain(getLocalizedPrinterName('es', other));
  });

  it('Escape dentro del popover lo cierra y devuelve el foco al indicador', async () => {
    useKuraStore.setState({ language: 'es' } as never);
    const user = userEvent.setup();
    render(<StatusBarMeasures />);
    const unit = screen.getByLabelText(t('es', 'dialog.settings.unitLabel'));
    unit.focus();
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Unidad / }));
  });

  it('una petición de la paleta abre el popover', async () => {
    useKuraStore.setState({ language: 'es' } as never);
    render(<StatusBarMeasures />);
    useKuraStore.getState().requestMeasuresPopover('printer');
    await new Promise((r) => setTimeout(r, 120));
    expect(document.querySelector('.kura-measures-popover')?.getAttribute('data-open')).toBe('true');
  });
});
