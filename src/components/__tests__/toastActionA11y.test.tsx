/**
 * @file src/components/__tests__/toastActionA11y.test.tsx
 * @description Nombre accesible de las acciones de un aviso (WCAG 2.5.3): empieza por el texto visible; la frase larga va como
 * descripción. Incluye el aviso «Convertir en placas» de importación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { ToastActionButton } from '../ToastActionButton';
import { toastActionA11y } from '../toastActionA11y';

afterEach(cleanup);

describe('toastActionA11y', () => {
  it('sin frase larga, el texto visible es el nombre', () => {
    expect(toastActionA11y({ label: 'Deshacer' })).toEqual({ name: undefined, description: undefined });
  });
  it('una frase que empieza por la etiqueta es válida como nombre', () => {
    expect(toastActionA11y({ label: 'Deshacer', ariaLabel: 'Deshacer eliminar Caja' })).toEqual({ name: 'Deshacer eliminar Caja', description: undefined });
  });
  it('una frase que no empieza por la etiqueta pasa a descripción', () => {
    expect(toastActionA11y({ label: 'Ver notas', ariaLabel: 'Ver las notas del proyecto' })).toEqual({ name: 'Ver notas', description: 'Ver las notas del proyecto' });
  });
});

describe('ToastActionButton', () => {
  it('«Convertir en placas» se encuentra por rol y nombre, y la explicación es su descripción', () => {
    const label = t('es', 'plates.convert.offer');
    const long = t('es', 'plates.convert.importOffer', { name: 'llaveros.3mf', count: 2 });
    render(<ToastActionButton action={{ label, ariaLabel: long, run: () => undefined }} className="kura-btn" onRun={() => undefined} />);
    const btn = screen.getByRole('button', { name: label });
    expect(btn.getAttribute('aria-label')?.toLowerCase().startsWith(label.toLowerCase())).toBe(true);
    expect(btn.getAttribute('title')).toBe(long);
    expect(document.getElementById(btn.getAttribute('aria-describedby')!)?.textContent).toBe(long);
  });
});
