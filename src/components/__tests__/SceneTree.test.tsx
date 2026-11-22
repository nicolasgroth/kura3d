/**
 * @file src/components/__tests__/SceneTree.test.tsx
 * @description Árbol de la escena con grupos: filas anidadas con nivel y contador, ←/→ pliegan y
 * despliegan, Alt+→/Alt+← meten y sacan, Alt+↓ reordena, ojo y candado del grupo afectan a sus miembros,
 * búsqueda que muestra los ancestros, arrastre simulado y grupo «Organizar» del menú contextual.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { SceneObjectList } from '../scene/SceneObjectList';
import { ObjectContextMenu } from '../viewport/ObjectContextMenu';

const st = () => useKuraStore.getState();
const items = () => screen.getAllByRole('treeitem');
const names = () => items().map((el) => el.getAttribute('title'));

beforeEach(() => {
  useKuraStore.setState({
    objects: [fakeBox('a', 'Alfa'), fakeBox('b', 'Beta'), fakeBox('c', 'Gamma'), fakeBox('d', 'Delta')],
    selectedIds: [], groups: [], groupContextId: null, sceneFilter: '', past: [], future: [], language: 'es',
  } as never);
  st().groupObjects(['a', 'b'], 'Par');
});

describe('árbol de la escena', () => {
  it('muestra el grupo con nivel, contador y sus miembros anidados', () => {
    render(<SceneObjectList />);
    expect(screen.getByRole('tree')).toBeTruthy();
    expect(names()).toEqual(['Par', 'Alfa', 'Beta', 'Gamma', 'Delta']);
    const group = items()[0];
    expect(group.getAttribute('aria-level')).toBe('1');
    expect(group.getAttribute('aria-expanded')).toBe('true');
    expect(items()[1].getAttribute('aria-level')).toBe('2');
    expect(group.textContent).toContain('2');
  });

  it('clic en el grupo selecciona a todos sus miembros; ←/→ pliegan y despliegan', async () => {
    const user = userEvent.setup();
    render(<SceneObjectList />);
    await user.click(items()[0]);
    expect([...st().selectedIds].sort()).toEqual(['a', 'b']);
    screen.getByRole('tree').focus();
    await user.keyboard('{ArrowLeft}');
    expect(names()).toEqual(['Par', 'Gamma', 'Delta']);
    expect(items()[0].getAttribute('aria-expanded')).toBe('false');
    await user.keyboard('{ArrowRight}');
    expect(names()).toHaveLength(5);
  });

  it('Alt+→ mete en el grupo de arriba, Alt+← lo saca y Alt+↓ reordena', async () => {
    const user = userEvent.setup();
    render(<SceneObjectList />);
    await user.click(items()[3]); // Gamma
    screen.getByRole('tree').focus();
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(st().objects.find((o) => o.id === 'c')!.groupRef).toBe(st().groups[0].id);
    await user.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(st().objects.find((o) => o.id === 'c')!.groupRef).toBeUndefined();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(st().objects.map((o) => o.id)).toEqual(['a', 'b', 'd', 'c']);
  });

  it('el ojo y el candado del grupo afectan a todos sus miembros', async () => {
    const user = userEvent.setup();
    render(<SceneObjectList />);
    await user.click(screen.getAllByTitle('Mostrar u ocultar el grupo')[0]);
    expect(st().objects.filter((o) => !o.visible).map((o) => o.id)).toEqual(['a', 'b']);
    await user.click(screen.getAllByTitle('Bloquear o desbloquear el grupo')[0]);
    expect(st().objects.filter((o) => o.locked).map((o) => o.id)).toEqual(['a', 'b']);
    expect(items()[0].textContent).toMatch(/oculto/i);
  });

  it('la búsqueda muestra lo encontrado con sus ancestros aunque estén plegados', () => {
    st().setGroupCollapsed(st().groups[0].id, true);
    useKuraStore.setState({ sceneFilter: 'bet' });
    render(<SceneObjectList />);
    expect(names()).toEqual(['Par', 'Beta']);
  });

  it('arrastrar Delta sobre el centro del grupo lo mete dentro', () => {
    render(<SceneObjectList />);
    const delta = items()[4];
    const group = items()[0];
    vi.spyOn(group, 'getBoundingClientRect').mockReturnValue({ top: 0, height: 40, left: 0, width: 200, bottom: 40, right: 200, x: 0, y: 0, toJSON: () => ({}) });
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' };
    fireEvent.dragStart(delta, { dataTransfer });
    // jsdom no trae DragEvent: la coordenada se fija a mano.
    const at = (ev: Event) => Object.defineProperty(ev, 'clientY', { value: 20 }) as Event;
    fireEvent(group, at(createEvent.dragOver(group, { dataTransfer })));
    fireEvent(group, at(createEvent.drop(group, { dataTransfer })));
    expect(st().objects.find((o) => o.id === 'd')!.groupRef).toBe(st().groups[0].id);
  });
});

describe('menú contextual: Organizar', () => {
  it('muestra Agrupar, Desagrupar, Combinar, Separar y Unir con la ayuda y los atajos', async () => {
    useKuraStore.setState({ selectedIds: ['c', 'd'] });
    const target = st().objects.find((o) => o.id === 'c')!;
    render(<ObjectContextMenu menu={{ objectId: 'c', x: 10, y: 10 }} target={target} onClose={() => {}} />);
    const group = screen.getByRole('group', { name: 'Organizar' });
    expect(group.textContent).toContain('Combinar: un objeto sin fundir');
    const agrupar = screen.getByRole('menuitem', { name: /^Agrupar/ });
    expect(agrupar.getAttribute('aria-keyshortcuts')).toContain('Control+G');
    expect(screen.getByRole('menuitem', { name: /Desagrupar/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Combinar en un objeto/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Separar cuerpos/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Unir selección/ })).toBeTruthy();
    await userEvent.setup().click(agrupar);
    expect(st().groups).toHaveLength(2);
  });
});
