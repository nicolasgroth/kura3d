/**
 * @file src/components/__tests__/AssistantsGallery.test.tsx
 * @description Galería de Asistentes (filtro por categoría, búsqueda, teclado, conservar filtro al volver, orden de
 * foco) y `NumberWithSlider` (sincronía con el campo, expresiones y unidades, un gesto por arrastre o ráfaga de teclas,
 * `aria-valuetext`, rango del deslizador sin limitar el campo). Modelo de filtro y de cuadrícula incluidos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { closeAssistants, openAssistants, showAssistantRecipe } from '../../store/assistantsPanel';
import { useKuraStore } from '../../store/useKuraStore';
import { AssistantsPanel } from '../assistants/AssistantsPanel';
import { filterGallery, galleryHaystack, gridMove } from '../assistants/galleryModel';
import { NumberWithSlider, sliderStepFor } from '../NumberWithSlider';

beforeEach(() => {
  useKuraStore.setState({ language: 'es' });
  closeAssistants();
});

const cards = () => within(screen.getByRole('list', { name: t('es', 'asis.listLabel') })).getAllByRole('button');

describe('modelo de la galería', () => {
  const items = [
    { id: 'a', category: 'cajas' as const, haystack: galleryHaystack('Caja con tapa', 'Organiza') },
    { id: 'b', category: 'hogar' as const, haystack: galleryHaystack('Placa de enchufe') },
  ];
  it('filtra por categoría y por texto sin tildes ni mayúsculas', () => {
    expect(filterGallery(items, 'cajas', '').map((i) => i.id)).toEqual(['a']);
    expect(filterGallery(items, 'all', 'ENCHUFE').map((i) => i.id)).toEqual(['b']);
    expect(filterGallery(items, 'all', 'organiza caja').map((i) => i.id)).toEqual(['a']);
    expect(filterGallery(items, 'hogar', 'caja')).toEqual([]);
  });
  it('gridMove se mueve por filas y columnas sin dar la vuelta', () => {
    expect(gridMove('ArrowRight', 0, 5, 2)).toBe(1);
    expect(gridMove('ArrowDown', 0, 5, 2)).toBe(2);
    expect(gridMove('ArrowDown', 4, 5, 2)).toBe(4);
    expect(gridMove('ArrowUp', 1, 5, 2)).toBe(1);
    expect(gridMove('End', 0, 5, 2)).toBe(4);
    expect(gridMove('a', 0, 5, 2)).toBeNull();
  });
});

describe('Galería de Asistentes', () => {
  it('muestra una tarjeta por receta con categoría y filtra con los chips', async () => {
    const user = userEvent.setup();
    render(<AssistantsPanel />);
    act(() => openAssistants());
    expect(cards()).toHaveLength(5);
    expect(cards()[0]!.textContent).toContain(t('es', 'asis.cat.cajas'));
    await user.click(screen.getByRole('button', { name: t('es', 'asis.cat.hogar') }));
    expect(cards()).toHaveLength(2);
    expect(cards().map((c) => c!.getAttribute('data-recipe'))).toEqual(['kura.placa-enchufe', 'kura.acople-tuberia']);
    expect(screen.getByRole('button', { name: t('es', 'asis.cat.hogar') }).getAttribute('aria-pressed')).toBe('true');
  });

  it('busca por texto y avisa si no hay resultados', async () => {
    const user = userEvent.setup();
    render(<AssistantsPanel />);
    act(() => openAssistants());
    await user.type(screen.getByRole('searchbox', { name: t('es', 'asis.gallery.search') }), 'llavero');
    expect(cards()).toHaveLength(1);
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzzz');
    expect(screen.getByText(t('es', 'asis.gallery.empty'))).toBeTruthy();
    await user.click(screen.getByRole('button', { name: t('es', 'asis.gallery.clear') }));
    expect(cards()).toHaveLength(5);
  });

  it('las flechas mueven el foco entre tarjetas y Enter abre el asistente', async () => {
    const user = userEvent.setup();
    render(<AssistantsPanel />);
    act(() => openAssistants());
    cards()[0]!.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(cards()[1]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(cards()[4]);
    await user.keyboard('{Home}{Enter}');
    expect(document.querySelector('[data-field="w"]')).not.toBeNull();
  });

  it('al volver de un asistente conserva el filtro y devuelve el foco a su tarjeta', async () => {
    const user = userEvent.setup();
    render(<AssistantsPanel />);
    act(() => openAssistants());
    await user.click(screen.getByRole('button', { name: t('es', 'asis.cat.hogar') }));
    await user.click(cards()[0]!);
    act(() => showAssistantRecipe(null));
    expect(cards()).toHaveLength(2);
    expect(screen.getByRole('button', { name: t('es', 'asis.cat.hogar') }).getAttribute('aria-pressed')).toBe('true');
  });
});

function Harness(props: { onStart?: () => void; onEnd?: () => void; onValue?: (v: number) => void }) {
  const [v, setV] = useState(10);
  return (
    <NumberWithSlider
      value={v}
      onChange={(n) => {
        setV(n);
        props.onValue?.(n);
      }}
      min={0}
      max={1000}
      sliderMin={1}
      sliderMax={50}
      ariaLabel="Ancho"
      suffix="mm"
      onGestureStart={props.onStart}
      onGestureEnd={props.onEnd}
    />
  );
}

describe('NumberWithSlider', () => {
  it('el deslizador y el campo comparten el valor, con aria-valuetext con unidad', () => {
    render(<Harness />);
    const slider = screen.getByRole('slider', { name: t('es', 'asis.slider.name', { label: 'Ancho' }) }) as HTMLInputElement;
    const field = screen.getByRole('spinbutton', { name: 'Ancho' }) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '25' } });
    expect(field.value).toBe('25');
    expect(slider.getAttribute('aria-valuetext')).toBe('25 mm');
    expect(slider.title).toBe(t('es', 'asis.slider.tip', { label: 'Ancho' }));
  });

  it('el campo acepta expresiones y valores fuera del rango del deslizador', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByRole('spinbutton', { name: 'Ancho' }) as HTMLInputElement;
    await user.click(field);
    await user.clear(field);
    await user.type(field, '10+5*20{Enter}');
    expect(field.value).toBe('110');
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('50');
  });

  it('un arrastre o una ráfaga de teclas es un solo gesto', () => {
    const start = vi.fn();
    const end = vi.fn();
    render(<Harness onStart={start} onEnd={end} />);
    const slider = screen.getByRole('slider');
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '12' } });
    fireEvent.change(slider, { target: { value: '14' } });
    fireEvent.pointerUp(slider);
    expect(start).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyUp(slider, { key: 'ArrowRight' });
    expect(start).toHaveBeenCalledTimes(2);
    expect(end).toHaveBeenCalledTimes(2);
  });

  it('sin rango no muestra deslizador', () => {
    render(<NumberWithSlider value={3} onChange={() => {}} ariaLabel="x" />);
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('el paso del deslizador sigue al rango', () => {
    expect(sliderStepFor(0, 6, 0.1)).toBe(0.1);
    expect(sliderStepFor(0, 20, 1)).toBe(0.5);
    expect(sliderStepFor(10, 400, 1)).toBe(1);
    expect(sliderStepFor(1, 10, 1, true)).toBe(1);
  });
});
