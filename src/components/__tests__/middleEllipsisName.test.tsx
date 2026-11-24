/**
 * @file src/components/__tests__/middleEllipsisName.test.tsx
 * @description Nombres largos del árbol: el final se conserva, el nombre completo va en el tooltip y el texto
 * accesible es el nombre íntegro; los nombres cortos no se parten.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MiddleEllipsisName, splitNameTail } from '../scene/MiddleEllipsisName';

describe('MiddleEllipsisName', () => {
  it('conserva el final de un nombre largo y deja el nombre completo en el tooltip', () => {
    const name = '1_Tapa_Lateral_Izquierda_Soporte_Interior_0042';
    const { container } = render(<MiddleEllipsisName name={name} />);
    const root = container.querySelector('.kura-scene-name') as HTMLElement;
    expect(root.title).toBe(name);
    expect(root.textContent).toBe(name);
    expect(container.querySelector('.kura-mid-tail')?.textContent).toBe(name.slice(-12));
  });

  it('un nombre corto no se parte', () => {
    expect(splitNameTail('Cubo 1')).toEqual(['Cubo 1', '']);
    const { container } = render(<MiddleEllipsisName name="Cubo 1" />);
    expect(container.querySelector('.kura-mid-tail')).toBeNull();
  });

  it('un imán numerado conserva el contador al final aunque el nombre sea corto', () => {
    const { container } = render(<MiddleEllipsisName name="Imán 5 × 2 (3)" />);
    const root = container.querySelector('.kura-scene-name') as HTMLElement;
    expect(root.textContent).toBe('Imán 5 × 2 (3)');
    const tail = container.querySelector('.kura-mid-tail')?.textContent ?? '';
    expect(tail.endsWith('(3)')).toBe(true);
    expect(container.querySelector('.kura-mid-head')?.textContent).not.toMatch(/\(3\)/);
  });
});
