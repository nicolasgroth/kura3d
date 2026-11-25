/**
 * @file src/components/__tests__/ObjectContextMenu.test.tsx
 * @description Menú contextual del objeto: primer nivel corto (12 ítems o menos), los mismos grupos y nombres que
 * el menú «Acciones», roles ARIA, submenús con flechas (→ abre, ← cierra), Escape, «Convertir en» con marca del
 * actual, agregar pieza negativa y ninguna acción perdida; F2 en la lista de escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actionName } from '../../store/actionLabels';
import { ACTION_GROUPS } from '../../store/actionsCatalog';
import { useKuraStore } from '../../store/useKuraStore';
import { closeMagnetPanel, useMagnetPanel } from '../../store/magnetPanel';
import { closeScrewBossPanel, useScrewBossPanel } from '../../store/screwBossPanel';
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

/** Abre, con el teclado, la cadena de submenús indicada por nombre; devuelve el último menú abierto. */
async function openPath(user: ReturnType<typeof userEvent.setup>, ...names: Array<string | RegExp>): Promise<HTMLElement> {
  let menu: HTMLElement = screen.getAllByRole('menu')[0];
  for (const name of names) {
    const trigger = within(menu).getByRole('menuitem', { name });
    trigger.focus();
    await openSub(user);
    menu = await screen.findByRole('menu', { name: trigger.textContent ?? '' });
  }
  return menu;
}

const GROUP_NAMES = ['Preparar para imprimir', 'Malla', 'Separar y combinar', 'Posición y tipo', 'Analizar'];

describe('ObjectContextMenu', () => {
  beforeEach(() => onClose.mockClear());

  it('el primer nivel es corto (12 ítems o menos) y los submenús tienen aria-haspopup', () => {
    setup();
    const menu = screen.getByRole('menu', { name: /Pieza A/ });
    const top = within(menu).getAllByRole('menuitem');
    expect(top.length).toBeLessThanOrEqual(12);
    expect(top.map((i) => i.querySelector('.kura-context-label')?.textContent)).toEqual([
      'Renombrar', 'Duplicar', 'Ocultar (no se exporta)', 'Bloquear', 'Agrupar', ...GROUP_NAMES, 'Más', 'Eliminar',
    ]);
    for (const name of [...GROUP_NAMES, 'Más']) expect(within(menu).getByRole('menuitem', { name }).getAttribute('aria-haspopup')).toBe('menu');
    expect(screen.queryByText(/Quitar esfera interior/)).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Reparar malla/ })).toBeNull();
  });

  it('los submenús repiten los grupos del menú «Acciones» con los mismos nombres y el mismo orden', async () => {
    const user = userEvent.setup();
    setup();
    for (const [index, group] of ACTION_GROUPS.entries()) {
      const sub = await openPath(user, GROUP_NAMES[index]);
      const labels = within(sub).getAllByRole('menuitem').map((i) => i.querySelector('.kura-context-label')?.textContent);
      // Los ítems propios del contexto (Corte por plano, Transformar) van después de los del catálogo.
      expect(labels.slice(0, group.items.length)).toEqual(group.items.map((id) => actionName('es', id)));
      await user.keyboard('{ArrowLeft}');
    }
  });

  it('«Más» reúne Agregar pieza, Alojamiento de imán, Reemplazar, Exportar y Atajos; → abre las 11 formas y ← cierra', async () => {
    const user = userEvent.setup();
    setup();
    const more = await openPath(user, 'Más');
    const labels = within(more).getAllByRole('menuitem').map((i) => i.querySelector('.kura-context-label')?.textContent);
    expect(labels).toEqual(['Agregar pieza', 'Agregar pieza negativa', 'Alojamiento de imán', 'Torreta para tornillo', 'Colgar en el muro', 'Reemplazar por archivo…', 'Exportar selección como un STL…', 'Atajos de teclado']);
    const trigger = within(more).getByRole('menuitem', { name: /Agregar pieza$/ });
    expect(document.activeElement).toBe(within(more).getAllByRole('menuitem')[0]);
    await openSub(user);
    const sub = await screen.findByRole('menu', { name: /Agregar pieza$/ });
    const items = within(sub).getAllByRole('menuitem').map((i) => i.textContent);
    expect(items).toEqual(['Importar STL/3MF…', 'Cubo', 'Cilindro', 'Disco', 'Esfera', 'Cono', 'Toroide', 'Prisma', 'Tubo hueco', 'Texto 3D', 'SVG…']);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement?.textContent).toBe('Cubo');
    await user.keyboard('{ArrowLeft}');
    expect(screen.queryByRole('menu', { name: /Agregar pieza$/ })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('«Más › Alojamiento de imán» abre su panel', async () => {
    const user = userEvent.setup();
    closeMagnetPanel();
    setup();
    const more = await openPath(user, 'Más');
    await user.click(within(more).getByRole('menuitem', { name: /Alojamiento de imán/ }));
    expect(useMagnetPanel.getState().open).toBe(true);
    closeMagnetPanel();
  });

  it('«Más › Torreta para tornillo» abre su panel', async () => {
    const user = userEvent.setup();
    closeScrewBossPanel();
    setup();
    const more = await openPath(user, 'Más');
    await user.click(within(more).getByRole('menuitem', { name: /Torreta para tornillo/ }));
    expect(useScrewBossPanel.getState().open).toBe(true);
    closeScrewBossPanel();
  });

  it('agregar pieza negativa → Esfera llama al store con el objeto del menú y cierra el menú', async () => {
    const user = userEvent.setup();
    const add = vi.fn().mockResolvedValue(null);
    useKuraStore.setState({ addPieceToObject: add } as never);
    setup();
    await openPath(user, 'Más', /Agregar pieza negativa/);
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    expect(add).toHaveBeenCalledWith('sphere', 'negative', 'a');
    expect(onClose).toHaveBeenCalled();
  });

  it('el teclado recorre el primer nivel: ↓ y ↑ dan la vuelta, Inicio/Fin saltan y Tab no saca el foco del menú', async () => {
    const user = userEvent.setup();
    setup();
    const menu = screen.getByRole('menu', { name: /Pieza A/ });
    const items = within(menu).getAllByRole('menuitem').filter((i) => !(i as HTMLButtonElement).disabled);
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(items[items.length - 1]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(items[items.length - 1]);
    await user.keyboard('{Home}{Tab}');
    expect(menu.contains(document.activeElement)).toBe(true);
  });

  it('Convertir en (en «Posición y tipo») marca el actual y cambia a Negativo en un paso', async () => {
    const user = userEvent.setup();
    setup();
    await openPath(user, 'Posición y tipo');
    screen.getByRole('menuitem', { name: /Convertir en/ }).focus();
    await openSub(user);
    const solid = await screen.findByRole('menuitemradio', { name: /Sólido/ });
    const neg = screen.getByRole('menuitemradio', { name: /Negativo/ });
    expect(solid.getAttribute('aria-checked')).toBe('true');
    expect(neg.getAttribute('aria-checked')).toBe('false');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(useKuraStore.getState().objects[0].role === 'negative').toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('Convertir en ofrece Referencia (sin atajo H) y la aplica en un paso de deshacer', async () => {
    const user = userEvent.setup();
    setup();
    await openPath(user, 'Posición y tipo');
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

  it('Repetir está en «Más» solo con una acción registrada; Renombrar lleva F2', async () => {
    const user = userEvent.setup();
    useKuraStore.setState({ lastRepeatable: { kind: 'duplicate' } } as never);
    setup();
    expect(screen.getByRole('menuitem', { name: /Renombrar/ }).getAttribute('aria-keyshortcuts')).toBe('F2');
    expect(screen.queryByRole('menuitem', { name: /Repetir/ })).toBeNull();
    const more = await openPath(user, 'Más');
    expect(within(more).getByRole('menuitem', { name: /Repetir: Duplicar/ }).getAttribute('aria-keyshortcuts')).toBe('F4');
  });

  it('Bloquear (primer nivel) bloquea el objeto y cierra el menú', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('menuitem', { name: /^Bloquear/ }));
    expect(useKuraStore.getState().objects.find((o) => o.id === 'a')?.locked).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('un objeto bloqueado ofrece Desbloquear; uno oculto, Mostrar', () => {
    const obj = { ...fakeBox('a', 'Pieza A'), locked: true, visible: false };
    useKuraStore.setState({ objects: [obj], selectedIds: ['a'] } as never);
    render(
      <div className="kura-viewport-wrap">
        <ObjectContextMenu menu={{ objectId: 'a', x: 10, y: 10 }} target={obj} onClose={onClose} />
      </div>,
    );
    expect(screen.getByRole('menuitem', { name: /^Desbloquear/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /^Mostrar/ })).toBeTruthy();
  });

  it('Transformar (en «Posición y tipo») abre Espejar con los ejes del usuario (Z = altura)', async () => {
    const user = userEvent.setup();
    setup();
    await openPath(user, 'Posición y tipo');
    screen.getByRole('menuitem', { name: /^Transformar/ }).focus();
    await openSub(user);
    await screen.findByRole('menuitem', { name: /^Espejar/ });
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    await openSub(user);
    const sub = await screen.findByRole('menu', { name: /^Espejar/ });
    expect(within(sub).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Eje X', 'Eje Y', 'Eje Z']);
  });
});

describe('ObjectContextMenu: ninguna acción se pierde', () => {
  beforeEach(() => onClose.mockClear());

  it('Centrar en la cama está junto a Apoyar en la cama y llama al store con la selección', async () => {
    const user = userEvent.setup();
    const center = vi.fn().mockReturnValue(true);
    useKuraStore.setState({ centerSelectionOnBed: center } as never);
    setup();
    const position = await openPath(user, 'Posición y tipo');
    expect(within(position).getByRole('menuitem', { name: /Apoyar en la cama/ })).toBeTruthy();
    within(position).getByRole('menuitem', { name: /Centrar en la cama/ }).focus();
    await user.keyboard('{Enter}');
    expect(center).toHaveBeenCalledWith(['a']);
    expect(onClose).toHaveBeenCalled();
  });

  it('Transformar ofrece Mover, Rotar, Escalar con su atajo, Espejar y los restablecer', async () => {
    const user = userEvent.setup();
    setup();
    await openPath(user, 'Posición y tipo');
    screen.getByRole('menuitem', { name: /^Transformar/ }).focus();
    await openSub(user);
    const sub = await screen.findByRole('menu', { name: /^Transformar/ });
    expect(within(sub).getAllByRole('menuitem').map((i) => i.textContent?.replace(/[MRS]$/, ''))).toEqual([
      'Mover', 'Rotar', 'Escalar', 'Espejar', 'Restablecer rotación', 'Restablecer escala',
    ]);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(useKuraStore.getState().transformMode).toBe('rotate');
  });

  it('Alinear y distribuir está deshabilitado con 1 objeto y explica el motivo', async () => {
    const user = userEvent.setup();
    setup();
    const position = await openPath(user, 'Posición y tipo');
    const item = within(position).getByRole('menuitem', { name: /Alinear y distribuir/ }) as HTMLButtonElement;
    expect(item.disabled).toBe(true);
    expect(item.title.length).toBeGreaterThan(0);
  });

  it('Alinear y distribuir se habilita con 2 objetos seleccionados', async () => {
    const user = userEvent.setup();
    const obj = fakeBox('a', 'Pieza A');
    useKuraStore.setState({ objects: [obj, fakeBox('b', 'Pieza B')], selectedIds: ['a', 'b'] } as never);
    render(
      <div className="kura-viewport-wrap">
        <ObjectContextMenu menu={{ objectId: 'a', x: 10, y: 10 }} target={obj} onClose={onClose} />
      </div>,
    );
    const position = await openPath(user, 'Posición y tipo');
    expect((within(position).getByRole('menuitem', { name: /Alinear y distribuir/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('Más ▸ Exportar selección como un STL abre la exportación con STL y alcance selección', async () => {
    const user = userEvent.setup();
    setup();
    await openPath(user, 'Más');
    screen.getByRole('menuitem', { name: /Exportar selección como un STL/ }).focus();
    await user.keyboard('{Enter}');
    expect(useKuraStore.getState().activeDialog).toBe('export');
    expect(onClose).toHaveBeenCalled();
  });

  it('Ocultar (primer nivel) deja el objeto fuera de lo exportable', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('menuitem', { name: /Ocultar \(no se exporta\)/ }));
    expect(useKuraStore.getState().objects.find((o) => o.id === 'a')?.visible).toBe(false);
  });

  it('Corte por plano está en Preparar y Reparar malla en Malla', async () => {
    const user = userEvent.setup();
    setup();
    const prepare = await openPath(user, 'Preparar para imprimir');
    const cut = within(prepare).getAllByRole('menuitem').find((i) => i.getAttribute('aria-keyshortcuts') === 'C');
    expect(cut).toBeTruthy();
    cut!.focus();
    await user.keyboard('{Enter}');
    expect(useKuraStore.getState().activeDialog).toBe('cut');
  });

  it('Reparar malla está en el submenú Malla', async () => {
    const user = userEvent.setup();
    setup();
    const mesh = await openPath(user, 'Malla');
    expect(within(mesh).getByRole('menuitem', { name: /Reparar malla/ })).toBeTruthy();
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
