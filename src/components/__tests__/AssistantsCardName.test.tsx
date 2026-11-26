/**
 * @file src/components/__tests__/AssistantsCardName.test.tsx
 * @description Cada tarjeta de la galería de Asistentes se nombra solo con su título; la descripción va aparte
 * (`aria-describedby`), para que un lector de pantalla no lea el párrafo completo como nombre del botón.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openAssistants } from '../../store/assistantsPanel';
import { AssistantsPanel } from '../assistants/AssistantsPanel';

describe('Asistentes: nombre accesible de las tarjetas', () => {
  it('el nombre es el título y la descripción se asocia con aria-describedby', () => {
    render(<AssistantsPanel />);
    act(() => openAssistants());
    const cards = screen.getAllByRole('button').filter((b) => b.hasAttribute('data-recipe'));
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      const title = card.querySelector('.kura-asis-card-title')!.textContent!;
      expect(card.getAttribute('aria-labelledby')).toBe(card.querySelector('.kura-asis-card-title')!.id);
      expect(title.length).toBeGreaterThan(0);
      const desc = card.querySelector('.kura-asis-card-desc');
      if (desc) expect(card.getAttribute('aria-describedby')).toContain(desc.id);
    }
  });
});
