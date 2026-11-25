/**
 * @file src/components/__tests__/AboutDialog.test.tsx
 * @description «Acerca de»: se abre desde Ajustes, la paleta y la insignia de versión; foco y Escape; el
 * contenido usa el nombre de `BRAND` (con un mock de otro nombre no queda ningún texto con el anterior);
 * tabla de bibliotecas; huevo de pascua (10 clics rápidos sí; 9 o clics lentos no; movimiento reducido).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../brand', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../brand')>();
  return { ...original, BRAND: { ...original.BRAND, name: 'Zafiro9' } };
});

import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { ABOUT_LIBS } from '../../utils/aboutInfo';
import {
  EGG_CLICKS,
  EGG_DURATION_MS,
  EGG_GAP_MS,
  handleLogoClick,
  resetLogoClicks,
  useEggStore,
} from '../../utils/logoEasterEgg';
import { AboutDialog, AboutLayer } from '../about/AboutDialog';
import { CommandPalette } from '../CommandPalette';
import { SettingsModal } from '../dialogs/SettingsModal';
import { TopBar } from '../TopBar';

const NAME = 'Zafiro9';
const title = () => t('es', 'about.title', { name: NAME });

function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

beforeEach(() => {
  resetLogoClicks();
  useEggStore.setState({ runId: 0 });
});

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute('data-kura-egg');
});

describe('Acerca de: desplazamiento y frase', () => {
  it('la zona desplazable es enfocable con nombre, y cada apertura empieza arriba con una frase nueva', () => {
    const picks = [0, 0.99];
    let n = 0;
    const random = () => picks[Math.min(n++, picks.length - 1)];
    const { rerender } = render(<AboutDialog open={false} onClose={() => undefined} random={random} />);
    const region = document.querySelector('.kura-about') as HTMLElement;
    expect(region.tabIndex).toBe(0);
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-label')).toBe(t('es', 'about.scrollRegion', { name: NAME }));
    region.scrollTop = 120;
    const quote = () => region.querySelector('.kura-about-quote')!.textContent;
    const first = quote();
    rerender(<AboutDialog open onClose={() => undefined} random={random} />);
    expect(region.scrollTop).toBe(0);
    const second = quote();
    rerender(<AboutDialog open onClose={() => undefined} random={random} />);
    expect(quote()).toBe(second);
    expect(second).not.toBe(first);
  });
});

describe('Acerca de: entradas', () => {
  it('se abre desde la pestaña Acerca de de Ajustes', async () => {
    const user = userEvent.setup();
    useKuraStore.setState({ settingsTab: 'about' } as never);
    render(<SettingsModal open onClose={() => undefined} />);
    await user.click(screen.getByRole('button', { name: title() }));
    expect(useKuraStore.getState().activeDialog).toBe('about');
  });

  it('se abre desde la paleta de comandos', async () => {
    const user = userEvent.setup();
    useKuraStore.setState({ commandPaletteOpen: true } as never);
    render(<CommandPalette />);
    await user.type(screen.getByRole('combobox', { name: t('es', 'cmd.inputLabel') }), 'acerca de');
    const option = screen.getAllByRole('option').find((o) => o.textContent?.includes(title()));
    expect(option).toBeTruthy();
    await user.click(option as HTMLElement);
    expect(useKuraStore.getState().activeDialog).toBe('about');
  });

  it('se abre con la insignia de versión, que es un botón con nombre accesible', async () => {
    const user = userEvent.setup();
    render(<TopBar />);
    const badge = screen.getByRole('button', {
      name: t('es', 'about.badgeLabel', { version: '0.5.0', name: NAME }),
    });
    await user.click(badge);
    expect(useKuraStore.getState().activeDialog).toBe('about');
  });
});

describe('Acerca de: frase al azar', () => {
  it('muestra la frase que elige el generador y la mantiene mientras está abierto', () => {
    useKuraStore.setState({ language: 'es' } as never);
    let value = 0.99;
    const { rerender } = render(<AboutDialog open onClose={() => undefined} random={() => value} />);
    const third = t('es', 'about.purpose.3', { name: NAME });
    expect(screen.getByText(third)).toBeTruthy();
    value = 0;
    rerender(<AboutDialog open onClose={() => undefined} random={() => value} />);
    expect(screen.getByText(third)).toBeTruthy();
    rerender(<AboutDialog open={false} onClose={() => undefined} random={() => value} />);
    rerender(<AboutDialog open onClose={() => undefined} random={() => value} />);
    expect(screen.getByText(t('es', 'about.purpose.1', { name: NAME }))).toBeTruthy();
  });
});

describe('Acerca de: diálogo', () => {
  it('es un diálogo con título accesible, se cierra con Escape y con el botón', () => {
    useKuraStore.setState({ activeDialog: 'about' } as never);
    render(<AboutLayer />);
    const dialog = screen.getByRole('dialog', { name: title() });
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(within(dialog).getAllByRole('button', { name: t('es', 'common.close') }).length).toBeGreaterThan(0);
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(useKuraStore.getState().activeDialog).toBeNull();
  });

  it('usa el nombre de BRAND en todo el texto y nunca el nombre anterior', () => {
    useKuraStore.setState({ activeDialog: 'about' } as never);
    render(<AboutLayer />);
    const dialog = screen.getByRole('dialog', { name: title() });
    const text = dialog.textContent ?? '';
    expect(text).toContain(NAME);
    expect(text).not.toMatch(/kura3d/i);
    expect(text).toContain('Nicolás Groth');
    expect(text).toContain('MIT');
  });

  it('lista las bibliotecas con su licencia en una tabla con cabeceras', () => {
    useKuraStore.setState({ activeDialog: 'about' } as never);
    render(<AboutLayer />);
    const table = screen.getByRole('table', { name: t('es', 'about.libsCaption') });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(3);
    for (const lib of ABOUT_LIBS) {
      const row = within(table).getByRole('rowheader', { name: lib.name }).closest('tr');
      expect(row?.textContent).toContain(lib.license);
    }
  });

  it('los enlaces externos se abren en pestaña nueva sin referrer', () => {
    useKuraStore.setState({ activeDialog: 'about' } as never);
    render(<AboutLayer />);
    for (const label of ['about.linkGuides', 'about.linkRepo'] as const) {
      const link = screen.getByRole('link', { name: t('es', label) });
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link.getAttribute('href')).toMatch(/^https:\/\//);
    }
  });
});

describe('Huevo de pascua del logo', () => {
  it('diez clics rápidos lo disparan: anima la raíz, anuncia el mensaje y al terminar no deja nada', () => {
    vi.useFakeTimers();
    setReducedMotion(false);
    render(
      <>
        <TopBar />
        <AboutLayer />
      </>,
    );
    const logo = screen.getByAltText(NAME);
    for (let i = 0; i < EGG_CLICKS; i += 1) {
      fireEvent.click(logo);
      act(() => {
        vi.advanceTimersByTime(EGG_GAP_MS - 100);
      });
    }
    expect(document.documentElement.hasAttribute('data-kura-egg')).toBe(true);
    const status = screen.getAllByRole('status').find((el) => el.textContent === t('es', 'about.egg.message'));
    expect(status).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(EGG_DURATION_MS + 50);
    });
    expect(document.documentElement.hasAttribute('data-kura-egg')).toBe(false);
    expect(screen.queryByText(t('es', 'about.egg.message'))).toBeNull();
  });

  it('nueve clics rápidos no lo disparan', () => {
    render(<TopBar />);
    const logo = screen.getByAltText(NAME);
    for (let i = 0; i < EGG_CLICKS - 1; i += 1) fireEvent.click(logo);
    expect(useEggStore.getState().runId).toBe(0);
  });

  it('diez clics lentos no lo disparan', () => {
    vi.useFakeTimers();
    for (let i = 0; i < EGG_CLICKS + 2; i += 1) {
      handleLogoClick();
      vi.advanceTimersByTime(EGG_GAP_MS + 100);
    }
    expect(useEggStore.getState().runId).toBe(0);
  });

  it('un clic aislado no abre ni cambia nada', () => {
    render(<TopBar />);
    fireEvent.click(screen.getByAltText(NAME));
    expect(useKuraStore.getState().activeDialog).toBeNull();
    expect(document.documentElement.hasAttribute('data-kura-egg')).toBe(false);
  });

  it('con movimiento reducido solo muestra el mensaje, sin animar', () => {
    vi.useFakeTimers();
    setReducedMotion(true);
    render(<AboutLayer />);
    act(() => {
      useEggStore.setState({ runId: 1 });
    });
    expect(document.documentElement.hasAttribute('data-kura-egg')).toBe(false);
    expect(screen.getByText(t('es', 'about.egg.message'))).toBeTruthy();
    setReducedMotion(false);
  });

  it('se puede lanzar con el teclado desde el botón del diálogo', async () => {
    setReducedMotion(false);
    useKuraStore.setState({ activeDialog: 'about' } as never);
    render(<AboutLayer />);
    const button = screen.getByRole('button', { name: t('es', 'about.egg.button') });
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(useEggStore.getState().runId).toBe(1);
  });
});
