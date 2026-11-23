/**
 * @file src/components/__tests__/ObjectContextMenu.test.tsx
 * @description Menú contextual del objeto: grupos con título, roles ARIA, submenús con flechas (→ abre,
 * ← cierra), Escape, "Cambiar tipo" con marca del actual y agregar pieza negativa; F2 en la lista de escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { ObjectContextMenu } from '../viewport/ObjectContextMenu';
import { SceneObjectList } from '../scene/SceneObjectList';
import { SceneSearch } from '../scene/SceneSearch';

const onClose = vi.fn();

function setup(isHole = false) {
  const obj = { ...fakeBox('a', 'Pieza A'), role: isHole ? ('negative' as const) : ('solid' as const) };
  useKuraStore.setState({ objects: [obj, fakeBox('b', 'Pieza B')], selectedIds: ['a'] } as never);
  render(
    <div className="kura-viewport-wrap">
      <ObjectContextMenu menu={{ objectId: 'a', x: 10, y: 10 }} target={obj} onClose={onClose} />
    </div>,
  );
}

/**
 * Abre el submenú del ítem enfocado y espera a que el foco pase a su primer ítem.
 * El submenú toma el foco en el siguiente cuadro de animación: sin esta espera, la tecla siguiente
 * puede llegar al menú padre (pasa en máquinas lentas, como las del CI).
 */
async function openSub(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const before = document.activeElement;
  await user.keyboard('{ArrowRight}');
  await waitFor(() => expect(document.activeElement).not.toBe(before));
}

describe('ObjectContextMenu', () => {
  beforeEach(() => onClose.mockClear());

  it('ordena las acciones en grupos con título y role=menu', () => {
    setup();
    expect(screen.getByRole('menu', { name: /Pieza A/ })).toBeTruthy();
    const titles = ['Agregar', 'Tipo', 'Geometría', 'Posición', 'Analizar', 'Objeto', 'Ayuda'];
    for (const title of titles) expect(screen.getByRole('group', { name: title })).toBeTruthy();
    const add = screen.getByRole('group', { name: 'Agregar' });
    expect(within(add).getByRole('menuitem', { name: /Agregar pieza$/ }).getAttribute('aria-haspopup')).toBe('menu');
    expect(within(add).getByRole('menuitem', { name: /Agregar pieza negativa/ }).getAttribute('aria-haspopup')).toBe('menu');
    // Ya no hay una lista plana con "Quitar esfera interior" ni "Alternar".
    expect(screen.queryByText(/Quitar esfera interior/)).toBeNull();
    expect(screen.queryByText(/Alternar Sólido/)).toBeNull();
  });

  it('enfoca el primer ítem; → abre el submenú con las 11 formas (Importar primero) y ← lo cierra', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole('menuitem', { name: /Agregar pieza$/ });
    expect(document.activeElement).toBe(trigger);
    await openSub(user);
    const sub = await screen.findByRole('menu', { name: /Agregar pieza$/ });
    const items = within(sub).getAllByRole('menuitem').map((i) => i.textContent);
    expect(items).toEqual(['Importar STL/3MF…', 'Cubo', 'Cilindro', 'Disco', 'Esfera', 'Cono', 'Toroide', 'Prisma', 'Tubo hueco', 'Texto 3D', 'SVG…']);
    expect(document.activeElement).toBe(within(sub).getAllByRole('menuitem')[0]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement?.textContent).toBe('Cubo');
    await user.keyboard('{ArrowLeft}');
    expect(screen.queryByRole('menu', { name: /Agregar pieza$/ })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('agregar pieza negativa → Esfera llama al store con el objeto del menú y cierra el menú', async () => {
    const user = userEvent.setup();
    const add = vi.fn().mockResolvedValue(null);
    useKuraStore.setState({ addPieceToObject: add } as never);
    setup();
    // Teclado: → abre el submenú, ↓↓ llega a Esfera y Enter la elige.
    screen.getByRole('menuitem', { name: /Agregar pieza negativa/ }).focus();
    await openSub(user);
    await screen.findByRole('menuitem', { name: 'Esfera' });
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    expect(add).toHaveBeenCalledWith('sphere', 'negative', 'a');
    expect(onClose).toHaveBeenCalled();
  });

  it('Convertir en marca el actual y cambia a Negativo en un paso', async () => {
    const user = userEvent.setup();
    setup();
    screen.getByRole('menuitem', { name: /Convertir en/ }).focus();
    await openSub(user);
    const solid = await screen.findByRole('menuitemradio', { name: /Sólido/ });
    const neg = screen.getByRole('menuitemradio', { name: /Negativo/ });
    expect(solid.getAttribute('aria-checked')).toBe('true');
    expect(neg.getAttribute('aria-checked')).toBe('false');
    await user.keyboard('{ArrowDown}{Enter}');
    expect((useKuraStore.getState().objects[0].role === 'negative')).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('Convertir en ofrece Referencia (sin atajo H) y la aplica en un paso de deshacer', async () => {
    const user = userEvent.setup();
    setup();
    screen.getByRole('menuitem', { name: /Convertir en/ }).focus();
    await openSub(user);
    const ref = await screen.findByRole('menuitemradio', { name: /Referencia/ });
    expect(ref.getAttribute('aria-checked')).toBe('false');
    expect(ref.getAttribute('aria-keyshortcuts')).toBeNull();
    await user.click(ref);
    expect(useKuraStore.getState().objects[0].role).toBe('reference');
    useKuraStore.getState().undo();
    expect(useKuraStore.getState().objects[0].role).toBe('solid');
  });

  it('muestra "Repetir" solo cuando hay una acción registrada y Renombrar con F2', () => {
    useKuraStore.setState({ lastRepeatable: { kind: 'duplicate' } } as never);
    setup();
    expect(screen.getByRole('menuitem', { name: /Repetir: Duplicar/ }).getAttribute('aria-keyshortcuts')).toBe('F4');
    expect(screen.getByRole('menuitem', { name: /Renombrar/ }).getAttribute('aria-keyshortcuts')).toBe('F2');
  });

  it('Espejar abre los ejes del usuario (Z = altura)', async () => {
    const user = userEvent.setup();
    setup();
    screen.getByRole('menuitem', { name: /^Transformar/ }).focus();
    await openSub(user);
    await screen.findByRole('menuitem', { name: /^Espejar/ });
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    await openSub(user);
    const sub = await screen.findByRole('menu', { name: /^Espejar/ });
    expect(within(sub).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Eje X', 'Eje Y', 'Eje Z']);
  });
});

describe('ObjectContextMenu: ideas de los laminadores', () => {
  beforeEach(() => onClose.mockClear());

  it('Centrar en la cama está junto a Apoyar en la cama y llama al store con la selección', async () => {
    const user = userEvent.setup();
    const center = vi.fn().mockReturnValue(true);
    useKuraStore.setState({ centerSelectionOnBed: center } as never);
    setup();
    const position = screen.getByRole('group', { name: 'Posición' });
    expect(within(position).getByRole('menuitem', { name: /Apoyar en cama/ })).toBeTruthy();
    within(position).getByRole('menuitem', { name: /Centrar en la cama/ }).focus();
    await user.keyboard('{Enter}');
    expect(center).toHaveBeenCalledWith(['a']);
    expect(onClose).toHaveBeenCalled();
  });

  it('Transformar ofrece Mover, Rotar, Escalar con su atajo, Espejar y los restablecer', async () => {
    const user = userEvent.setup();
    setup();
    screen.getByRole('menuitem', { name: /^Transformar/ }).focus();
    await openSub(user);
    const sub = await screen.findByRole('menu', { name: /^Transformar/ });
    expect(within(sub).getAllByRole('menuitem').map((i) => i.textContent?.replace(/[MRS]$/, ''))).toEqual([
      'Mover', 'Rotar', 'Escalar', 'Espejar', 'Restablecer rotación', 'Restablecer escala',
    ]);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(useKuraStore.getState().transformMode).toBe('rotate');
  });

  it('Alinear y distribuir está deshabilitado con 1 objeto y explica el motivo', () => {
    setup();
    const item = screen.getByRole('menuitem', { name: /Alinear y distribuir/ }) as HTMLButtonElement;
    expect(item.disabled).toBe(true);
    expect(item.title).toMatch(/2 o más objetos/);
  });

  it('Alinear y distribuir se habilita con 2 objetos seleccionados', () => {
    const obj = fakeBox('a', 'Pieza A');
    useKuraStore.setState({ objects: [obj, fakeBox('b', 'Pieza B')], selectedIds: ['a', 'b'] } as never);
    render(
      <div className="kura-viewport-wrap">
        <ObjectContextMenu menu={{ objectId: 'a', x: 10, y: 10 }} target={obj} onClose={onClose} />
      </div>,
    );
    expect((screen.getByRole('menuitem', { name: /Alinear y distribuir/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('Más ▸ Exportar selección como un STL abre la exportación con STL y alcance selección', async () => {
    const user = userEvent.setup();
    setup();
    screen.getByRole('menuitem', { name: /^Más/ }).focus();
    await openSub(user);
    await screen.findByRole('menuitem', { name: /Exportar selección como un STL/ });
    await user.keyboard('{ArrowDown}{Enter}');
    expect(useKuraStore.getState().activeDialog).toBe('export');
    expect(onClose).toHaveBeenCalled();
  });

  it('Más ▸ Ocultar deja el objeto fuera de lo exportable', async () => {
    const user = userEvent.setup();
    setup();
    screen.getByRole('menuitem', { name: /^Más/ }).focus();
    await openSub(user);
    await screen.findByRole('menuitem', { name: /Ocultar \(no se exporta\)/ });
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(useKuraStore.getState().objects.find((o) => o.id === 'a')?.visible).toBe(false);
  });
});

describe('Lista de escena: F2 y búsqueda', () => {
  it('una petición de renombrar abre el campo en línea del objeto', () => {
    useKuraStore.setState({ objects: [fakeBox('a', 'Alfa'), fakeBox('b', 'Beta')], selectedIds: ['b'] } as never);
    render(<SceneObjectList />);
    useKuraStore.getState().requestRename('b');
    return screen.findByRole('textbox', { name: /Nuevo nombre/ }).then((input) => {
      expect((input as HTMLInputElement).value).toBe('Beta');
    });
  });

  it('el campo de búsqueda filtra la lista y Enter selecciona el primero', async () => {
    const user = userEvent.setup();
    useKuraStore.setState({ objects: [fakeBox('a', 'Alfa'), fakeBox('b', 'Beta'), fakeBox('c', 'Beto')], selectedIds: [] } as never);
    render(<><SceneSearch /><SceneObjectList /></>);
    await user.type(screen.getByRole('textbox', { name: /Buscar en la escena/ }), 'bet{Enter}');
    expect(screen.getAllByRole('treeitem')).toHaveLength(2);
    expect(useKuraStore.getState().selectedIds).toEqual(['b']);
    await user.keyboard('{F3}');
    expect(useKuraStore.getState().selectedIds).toEqual(['c']);
  });
});
