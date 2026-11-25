/**
 * @file src/components/__tests__/ux9AgregarInsertar.test.tsx
 * @description Lote ux9: «Agregar» (barra vertical) e «Insertar» (barra superior) ofrecen el mismo catálogo
 * (`store/insertCatalog.ts`): una prueba falla si divergen (Rosca y Texto/SVG no pueden faltar en una).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AddRailButton, InsertMenu } from '../shell/InsertMenus';
import { GENERATORS, insertLabelKey, SHAPES } from '../../store/insertCatalog';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';

const names = () => screen.getAllByRole('menuitem').map((el) => (el.textContent ?? '').trim());

beforeEach(() => useKuraStore.setState({ language: 'es', busyOperation: null, projectBusy: false } as never));
afterEach(cleanup);

describe('Agregar e Insertar ofrecen el mismo catálogo', () => {
  it('«Agregar» lista todas las formas y todos los generadores del catálogo', () => {
    render(<AddRailButton tabIndex={0} buttonRef={() => undefined} onFocus={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: t('es', 'r3a.add.button') }));
    const listed = names();
    for (const id of [...SHAPES.map((s) => s.id), ...GENERATORS]) {
      expect(listed.some((n) => n.includes(t('es', insertLabelKey(id)))), `falta «${t('es', insertLabelKey(id))}» en Agregar`).toBe(true);
    }
  });

  it('«Insertar» lista lo mismo que «Agregar»', () => {
    const add = render(<AddRailButton tabIndex={0} buttonRef={() => undefined} onFocus={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: t('es', 'r3a.add.button') }));
    const fromAdd = names().slice().sort();
    add.unmount();
    cleanup();
    render(<InsertMenu showLabel />);
    fireEvent.click(screen.getByRole('button', { name: t('es', 'r3a.insert.menu') }));
    expect(names().slice().sort()).toEqual(fromAdd);
  });
});
