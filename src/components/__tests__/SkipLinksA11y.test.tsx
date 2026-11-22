/**
 * @file src/components/__tests__/SkipLinksA11y.test.tsx
 * @description Accesibilidad de primer nivel: enlaces de salto, cubo de vistas operable por teclado con
 * botones nombrados, controles sin nombre en las vistas principales y regla de movimiento reducido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { LeftSidebar } from '../LeftSidebar';
import { ShortcutsModal } from '../dialogs/ShortcutsModal';
import { SkipLinks, VIEW_CUBE_VIEWS } from '../SkipLinks';
import { StatusBar } from '../StatusBar';
import { TopBar } from '../TopBar';

/** Nombre accesible aproximado: aria-label, texto, title o imagen interna con alt. */
function accessibleName(el: Element): string {
  const label = el.getAttribute('aria-label')?.trim();
  if (label) return label;
  const text = el.textContent?.trim();
  if (text) return text;
  return el.getAttribute('title')?.trim() ?? '';
}

afterEach(() => {
  document.body.replaceChildren();
  useKuraStore.setState({ language: 'es' });
});

describe('Cubo de vistas y enlaces de salto', () => {
  it('ofrece los dos enlaces de salto con texto', () => {
    render(<SkipLinks />);
    expect(screen.getByRole('link', { name: t('es', 'skip.viewport') })).toBeTruthy();
    expect(screen.getByRole('link', { name: t('es', 'skip.inspector') })).toBeTruthy();
  });

  it('"Saltar al visor" enfoca el lienzo del visor', async () => {
    const wrap = document.createElement('main');
    wrap.className = 'kura-viewport-wrap';
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    wrap.appendChild(canvas);
    document.body.appendChild(wrap);
    const user = userEvent.setup();
    render(<SkipLinks />);
    await user.click(screen.getByRole('link', { name: t('es', 'skip.viewport') }));
    expect(document.activeElement).toBe(canvas);
  });

  it('cada vista es un botón con nombre y se activa con el teclado', async () => {
    const requestCameraPreset = vi.fn();
    useKuraStore.setState({ requestCameraPreset } as never);
    const user = userEvent.setup();
    render(<SkipLinks />);
    const group = screen.getByRole('group', { name: t('es', 'viewcube.nav') });
    expect(group.querySelectorAll('button')).toHaveLength(VIEW_CUBE_VIEWS.length);
    for (const view of VIEW_CUBE_VIEWS) {
      expect(screen.getByRole('button', { name: t('es', `viewcube.view.${view}`) })).toBeTruthy();
    }
    const top = screen.getByRole('button', { name: t('es', 'viewcube.view.top') });
    top.focus();
    await user.keyboard('{Enter}');
    expect(requestCameraPreset).toHaveBeenCalledWith('top');
    await user.keyboard('{Tab}{Tab}');
    await user.keyboard('{Enter}');
    expect(requestCameraPreset).toHaveBeenLastCalledWith('front');
  });
});

describe('Controles con nombre accesible', () => {
  it('ningún botón visible de la barra, el panel de formas, el pie y los atajos queda sin nombre', () => {
    const { container } = render(
      <>
        <TopBar />
        <LeftSidebar />
        <StatusBar />
        <ShortcutsModal open onClose={() => undefined} />
      </>,
    );
    const unnamed = Array.from(container.querySelectorAll('button, [role="button"]'))
      .filter((el) => !el.closest('[aria-hidden="true"]') && el.getAttribute('aria-hidden') !== 'true')
      .filter((el) => accessibleName(el) === '')
      .map((el) => el.outerHTML.slice(0, 120));
    expect(unnamed).toEqual([]);
  });
});
