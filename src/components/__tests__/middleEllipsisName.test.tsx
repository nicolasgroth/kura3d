/**
 * @file src/components/__tests__/middleEllipsisName.test.tsx
 * @description Nombres largos del árbol: se abrevian por el medio conservando el inicio y el final (extensión,
 * contador «(n)», código de pieza), el nombre completo va en el tooltip y en el nombre accesible, y los nombres
 * cortos no se parten. `middleTruncate` es una función pura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MiddleEllipsisName, middleTruncate, NAME_MAX_CHARS } from '../scene/MiddleEllipsisName';

const joined = (name: string, max?: number) => middleTruncate(name, max).join('');

describe('middleTruncate', () => {
  it('un nombre que cabe no se toca', () => {
    expect(middleTruncate('Cubo 1')).toEqual(['Cubo 1', '']);
    expect(middleTruncate('x'.repeat(NAME_MAX_CHARS))).toEqual(['x'.repeat(NAME_MAX_CHARS), '']);
  });

  it('conserva inicio, extensión y contador, y nunca pasa del presupuesto', () => {
    const a = '1_Tapa_Frontal_LOGO_negro.stl (5)';
    const b = '1_Tapa_Frontal_LOGO_blanco.stl (5)';
    expect(joined(a)).toBe('1_Tapa_Frontal_…egro.stl (5)');
    expect(Array.from(joined(a)).length).toBeLessThanOrEqual(NAME_MAX_CHARS);
    // Dos nombres que antes se veían iguales («GO_negr») ahora se distinguen.
    expect(joined(a)).not.toBe(joined(b));
    expect(joined(b).endsWith('nco.stl (5)')).toBe(true);
  });

  it('el código de pieza de una división queda completo al final', () => {
    const [head, tail] = middleTruncate('Linterna Delux Carcasa Exterior Superior · A1');
    expect(tail.endsWith(' · A1')).toBe(true);
    expect(head.startsWith('Linterna')).toBe(true);
    expect(head.endsWith('…')).toBe(true);
  });

  it('respeta cualquier presupuesto y no parte caracteres compuestos', () => {
    for (const max of [8, 12, 20, 40]) {
      expect(Array.from(joined('Nombre_muy_largo_de_pieza_importada_final.3mf (12)', max)).length).toBeLessThanOrEqual(max);
    }
    expect(joined('😀'.repeat(40), 10)).toBe(`${'😀'.repeat(5)}…${'😀'.repeat(4)}`);
  });
});

describe('MiddleEllipsisName', () => {
  it('abrevia, deja el nombre completo en el tooltip y en el texto accesible', () => {
    const name = '1_Tapa_Frontal_LOGO_negro.stl (5)';
    const { container } = render(<MiddleEllipsisName name={name} />);
    const root = container.querySelector('.kura-scene-name') as HTMLElement;
    expect(root.title).toBe(name);
    expect(container.querySelector('.sr-only')?.textContent).toBe(name);
    const visible = [...container.querySelectorAll('[aria-hidden="true"]')].map((n) => n.textContent).join('');
    expect(visible).toBe('1_Tapa_Frontal_…egro.stl (5)');
  });

  it('un nombre corto no se parte ni duplica el texto', () => {
    const { container } = render(<MiddleEllipsisName name="Cubo 1" />);
    expect(container.querySelector('.kura-mid-tail')).toBeNull();
    expect(container.querySelector('.sr-only')).toBeNull();
    expect(container.querySelector('.kura-scene-name')?.textContent).toBe('Cubo 1');
  });
});
