/**
 * @file src/components/__tests__/sceneTreeRowNegative.test.tsx
 * @description Fila de un negativo seleccionado en el árbol (ancho estrecho): el nombre sigue en la fila y su estilo
 * le reserva un ancho mínimo, mientras la insignia «NEGATIVO» y el paso de armado pueden encogerse antes que él.
 * jsdom no calcula el diseño: se comprueba el DOM y las reglas CSS que lo garantizan.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject } from '../../types/kura';
import { SceneTreeRow, type SceneTreeRowProps } from '../scene/SceneTreeRow';

const proc = (globalThis as unknown as { process: { cwd: () => string; getBuiltinModule: (id: string) => { readFileSync: (path: string, encoding: 'utf8') => string } } }).process;
const css = proc.getBuiltinModule('node:fs').readFileSync(`${proc.cwd()}/src/styles/sceneTreeNameFirst.css`, 'utf8');

function rule(selector: RegExp): string {
  const match = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find((m) => selector.test(m[1]));
  return match ? match[2] : '';
}

const negative: SceneObject = { ...fakeBox('n1', 'Imán 5 × 2', 5), role: 'negative' };

function props(): SceneTreeRowProps {
  const noop = () => {};
  return {
    row: { node: { kind: 'object', key: 'o:n1', object: negative, level: 1 }, key: 'o:n1', level: 1, parentGroupId: null, parentKey: null, objectIds: ['n1'], posInSet: 1, setSize: 1 },
    id: 'row-n1', language: 'es', selected: true, active: true, renaming: false, draft: '', dropPlace: null,
    onDraft: noop, onCommitRename: noop, onCancelRename: noop, onRenameField: noop, onClick: noop, onDoubleClick: noop,
    onContextMenu: noop, onToggleExpand: noop, onToggleVisible: noop, onToggleLock: noop, onDropToBed: noop, onDuplicate: noop,
    onDelete: noop, dragHandlers: {},
  };
}

describe('fila de un negativo seleccionado', () => {
  it('muestra el nombre junto a la insignia y deja el nombre completo en el tooltip', () => {
    const { container } = render(<SceneTreeRow {...props()} />);
    const name = container.querySelector('.kura-scene-name') as HTMLElement;
    expect(name.textContent).toBe('Imán 5 × 2');
    expect(name.title).toBe('Imán 5 × 2');
    expect(container.querySelector('.kura-hole-tag')?.textContent).toBe('NEGATIVO');
  });

  it('el estilo reserva ancho al nombre y deja encoger la insignia primero', () => {
    const name = rule(/kura-scene-name/);
    expect(name).toMatch(/min-width:\s*[1-9]\d*ch/);
    const tag = rule(/kura-hole-tag/);
    expect(tag).toMatch(/min-width:\s*0/);
    expect(tag).toMatch(/text-overflow:\s*ellipsis/);
    expect(tag).toMatch(/flex:\s*0\s+[1-9]/);
  });
});
