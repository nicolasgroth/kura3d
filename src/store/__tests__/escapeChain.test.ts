/**
 * @file src/store/__tests__/escapeChain.test.ts
 * @description Cadena de prioridad de Esc: orden de los niveles y bloqueo de un panel por los niveles superiores.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { ESCAPE_ORDER, escapeBlockedBy, resolveEscapeLevel, type EscapeContext } from '../escapeChain';

const NONE: EscapeContext = { dialog: false, operation: false, menu: false, group: false, zen: false, panel: false };

describe('cadena de prioridad de Esc', () => {
  it('el orden documentado', () => {
    expect([...ESCAPE_ORDER]).toEqual(['tooltip', 'dialog', 'operation', 'menu', 'group', 'zen', 'panel', 'tool', 'selection']);
  });

  it('cada nivel gana sobre los de abajo', () => {
    const levels: Array<keyof EscapeContext> = ['dialog', 'operation', 'menu', 'group', 'zen', 'panel'];
    for (let i = 0; i < levels.length; i++) {
      const ctx = { ...NONE };
      for (const l of levels.slice(i)) ctx[l] = true;
      expect(resolveEscapeLevel(ctx)).toBe(levels[i]);
    }
    expect(resolveEscapeLevel(NONE)).toBeNull();
  });

  it('un panel solo consume el Esc si nada superior está abierto', () => {
    expect(escapeBlockedBy(NONE, 'panel')).toBeNull();
    expect(escapeBlockedBy({ ...NONE, panel: true }, 'panel')).toBeNull();
    for (const l of ['dialog', 'operation', 'menu', 'group', 'zen'] as const) {
      expect(escapeBlockedBy({ ...NONE, [l]: true }, 'panel')).toBe(l);
      expect(escapeBlockedBy({ ...NONE, [l]: true }, 'tool')).toBe(l);
    }
  });

  it('la herramienta cede ante un panel de acción abierto', () => {
    expect(escapeBlockedBy({ ...NONE, panel: true }, 'tool')).toBe('panel');
    expect(escapeBlockedBy(NONE, 'tool')).toBeNull();
  });
});
