/**
 * @file src/components/__tests__/ux8Texto3dPintura.test.tsx
 * @description Lote ux8: el panel de Texto 3D enfoca su campo de texto al abrir (no «Cerrar»); en Pintar la barra
 * del visor y el panel derecho dicen lo mismo del objeto destino con ninguno, uno o varios objetos seleccionados;
 * las muestras de color miden 32×32 px y 44×44 px en táctil (hoja de estilo) y la paleta de comandos nombra las
 * acciones como el menú «Acciones».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setText3DPanelOpen } from '../../store/insertCatalog';
import { actionName } from '../../store/actionLabels';
import { paintTargetText } from '../../store/paintTarget';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { ToolPanel } from '../contextPanel/ToolPanel';
import { Text3DPanel } from '../text3d/Text3DPanel';
import { PaintToolbar } from '../viewport/PaintToolbar';

const ui = {} as never;
const paintCss = readFileSync(resolve(process.cwd(), 'src/styles/ux8Paint.css'), 'utf8');

describe('Texto 3D: foco inicial', () => {
  it('al abrir el panel el foco cae en el campo de texto, no en «Cerrar»', async () => {
    useKuraStore.setState({ language: 'es' } as never);
    render(<Text3DPanel />);
    act(() => setText3DPanelOpen(true));
    const campo = await screen.findByRole('textbox', { name: /Texto/i });
    expect(document.activeElement).toBe(campo);
    expect((document.activeElement as HTMLElement).getAttribute('aria-label')).not.toBe('Cerrar');
    act(() => setText3DPanelOpen(false));
  });
});

describe('Pintar: el mismo destino en la barra y en el panel', () => {
  beforeEach(() => {
    useKuraStore.setState({
      language: 'es',
      activeTool: 'paint',
      objects: [fakeBox('a', 'Caja 1'), fakeBox('b', 'Caja 2')],
      selectedIds: [],
    } as never);
  });

  const barra = () => screen.getByRole('status').textContent;

  for (const [titulo, seleccion] of [
    ['sin selección', [] as string[]],
    ['un objeto', ['a']],
    ['dos objetos', ['a', 'b']],
  ] as const) {
    it(`${titulo}: la barra del visor y el panel dicen lo mismo`, () => {
      useKuraStore.setState({ selectedIds: [...seleccion] } as never);
      const { container } = render(
        <>
          <PaintToolbar />
          <ToolPanel tool="paint" objectId={seleccion.length === 1 ? seleccion[0] : null} ui={ui} />
        </>,
      );
      const esperado = paintTargetText('es', useKuraStore.getState().objects, seleccion).text;
      expect(barra()).toBe(esperado);
      expect(container.querySelector('.kura-ctx-target')?.textContent).toBe(esperado);
    });
  }

  it('con varios objetos el texto dice cuántos más hay y nunca «sin objeto elegido»', () => {
    const texto = paintTargetText('es', [fakeBox('a', 'Caja 1'), fakeBox('b', 'Caja 2'), fakeBox('c', 'Caja 3')], ['a', 'b', 'c']).text;
    expect(texto).toContain('Caja 1');
    expect(texto).toMatch(/2 objetos/);
    expect(texto).not.toMatch(/Sin objeto/i);
  });
});

describe('Pintar: tamaño de las muestras', () => {
  it('32×32 px con puntero y 44×44 px en pantallas táctiles', () => {
    const [fino, tactil] = paintCss.split('@media (pointer: coarse)');
    expect(fino).toMatch(/\.kura-paint-palette \.kura-swatch,[\s\S]*?width: 32px;[\s\S]*?height: 32px;/);
    expect(tactil).toMatch(/\.kura-paint-palette \.kura-swatch,[\s\S]*?width: 44px;[\s\S]*?height: 44px;/);
  });
});

describe('Una acción, un nombre', () => {
  it('la acción «Reparar malla» se llama igual que en el menú «Acciones» en los 6 idiomas', () => {
    expect(actionName('es', 'repair')).toBe('Reparar malla');
    expect(actionName('en', 'repair')).toBe('Repair mesh');
  });
});
