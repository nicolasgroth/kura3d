/**
 * @file src/components/__tests__/qa22PaletaSubmenu.test.tsx
 * @description Correcciones de la QA22: toda acción del catálogo tiene entrada en la paleta de comandos con su
 * nombre canónico (en los 6 idiomas), y Escape dentro de un submenú cierra solo el submenú.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { actionName } from '../../store/actionLabels';
import { ACTION_GROUPS, type ActionId } from '../../store/actionsCatalog';
import { fakeBox } from '../../test/fakeObjects';
import { SUPPORTED_LANGUAGES } from '../../types/kura';
import { actionPaletteItems } from '../actionPaletteItems';
import { MenuItem, MenuSurface, SubMenu } from '../viewport/contextMenu/MenuKit';

const state = (selected: string[]) => ({
  objects: [fakeBox('a', 'A'), fakeBox('b', 'B')],
  selectedIds: selected,
  groups: [],
  busyOperation: null,
});

const ALL_IDS = ACTION_GROUPS.flatMap((g) => g.items as readonly ActionId[]);

describe('QA22: acciones del catálogo en la paleta', () => {
  it('sin rótulos previos, cada acción tiene una entrada con su nombre en los 6 idiomas', () => {
    for (const { code } of SUPPORTED_LANGUAGES) {
      const labels = actionPaletteItems(code, state(['a', 'b']) as never, []).map((i) => i.label);
      for (const id of ALL_IDS) {
        const name = actionName(code, id);
        const found = id === 'convert' || id === 'align' ? labels.some((l) => l.startsWith(`${name}: `)) : labels.includes(name);
        expect(found, `${code}: ${id} («${name}»)`).toBe(true);
      }
    }
  });

  it('no repite una acción que la paleta ya rotula igual (ignora la elipsis)', () => {
    const name = actionName('es', 'fitCheck');
    const items = actionPaletteItems('es', state(['a', 'b']) as never, [name.replace('…', '')]);
    expect(items.some((i) => i.id === 'action-fitCheck')).toBe(false);
    expect(items.some((i) => i.id === 'action-texture')).toBe(true);
  });

  it('«Comprobar encaje» se encuentra buscando «holgura»', () => {
    const item = actionPaletteItems('es', state(['a', 'b']) as never, []).find((i) => i.id === 'action-fitCheck');
    expect(item?.keywords).toContain('holgura');
  });

  it('una acción apagada lleva su motivo', () => {
    const items = actionPaletteItems('es', state([]) as never, []);
    expect(items.find((i) => i.id === 'action-union')?.unavailable).toBeTruthy();
    expect(actionPaletteItems('es', state(['a', 'b']) as never, []).find((i) => i.id === 'action-union')?.unavailable).toBeUndefined();
  });
});

describe('QA22: Escape en un submenú', () => {
  it('cierra solo el submenú, devuelve el foco a su entrada y no llega al cierre global', () => {
    const globalEscape = vi.fn();
    const onWindowKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') globalEscape();
    };
    window.addEventListener('keydown', onWindowKey);
    render(
      <MenuSurface x={10} y={10} label="Menú">
        <MenuItem label="Uno" onSelect={() => {}} />
        <SubMenu label="Más">
          <MenuItem label="Dentro" onSelect={() => {}} />
        </SubMenu>
      </MenuSurface>,
    );
    const trigger = screen.getByRole('menuitem', { name: 'Más' });
    fireEvent.keyDown(trigger, { key: 'ArrowRight' });
    const inner = screen.getByRole('menuitem', { name: 'Dentro' });
    inner.focus();
    fireEvent.keyDown(inner, { key: 'Escape' });
    expect(screen.queryByRole('menuitem', { name: 'Dentro' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Uno' })).toBeTruthy();
    expect(document.activeElement).toBe(trigger);
    expect(globalEscape).not.toHaveBeenCalled();
    // Con el submenú cerrado, Escape sí sigue hacia el cierre global del menú.
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(globalEscape).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', onWindowKey);
  });
});
