/**
 * @file src/components/__tests__/AssemblyInstructionsPanel.test.tsx
 * @description Panel «Instrucciones de armado» sobre un grupo dividido de dos piezas apiladas: lista ordenada con un paso por pieza, enfocar o
 * pulsar un paso selecciona sus piezas, materiales visibles, la acción solo se ofrece con una pieza dividida y el
 * panel se mantiene al cambiar la selección (acción de escena), y el acceso desde el control «Armado».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { actionAvailability } from '../../store/actionsCatalog';
import { panelContextOf } from '../../store/panelContext';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject, SplitJointRecord } from '../../types/kura';
import { AssemblyInstructionsPanel } from '../split/AssemblyInstructionsPanel';
import { SplitAssemblyControl } from '../split/SplitAssemblyControl';

const store = () => useKuraStore.getState();

/** Unión A1 (abajo) – A2 (arriba) con 2 espigas de Ø6 mm; ejes del motor (Y arriba). */
const JOINT: SplitJointRecord = {
  label: '1', axis: 'y', position: 50, a: 'A1', b: 'A2', kind: 'connector',
  connector: { type: 'dowel', size: 3, depth: 8, tolerance: 0.2, count: 2 }, connectorCenters: [[0, 50, 0], [10, 50, 0]], contactAreaMm2: 2500,
};

const part = (id: string, code: string, y: number): SceneObject => {
  const o = fakeBox(id, `Caja · ${code}`, 50);
  o.position = [0, y, 0];
  o.metadata = {
    split: {
      groupId: 'g', code, cell: [0, y > 0 ? 1 : 0, 0], assembly: { position: [0, y, 0], rotation: [0, 0, 0] },
      print: { position: [0, 0, 0], rotation: [0, 0, 0], plate: 0, downFace: '-y' }, jointLabels: ['1'], joints: [JOINT],
    },
  } as never;
  return o;
};

/** Grupo dividido en dos piezas apiladas; devuelve sus ids. */
function splitBox(): string[] {
  const objects = [part('a2', 'A2', 50), part('a1', 'A1', 0)];
  useKuraStore.setState({ objects } as never);
  return ['a1', 'a2'];
}

describe('AssemblyInstructionsPanel', () => {
  beforeEach(() => {
    useKuraStore.setState({ language: 'es', objects: [], selectedIds: [], activeAction: null, splitExplode: null, busyOperation: null } as never);
  });

  it('muestra los pasos en una lista ordenada y enfocar un paso selecciona sus piezas', () => {
    const ids = splitBox();
    act(() => store().setSelection([ids[1]]));
    render(<AssemblyInstructionsPanel />);
    const list = screen.getByRole('list', { name: 'Pasos de armado' });
    expect(list.tagName).toBe('OL');
    const steps = within(list).getAllByRole('button');
    expect(steps.map((b) => b.textContent)).toEqual([expect.stringMatching(/^Paso 1 · /), expect.stringMatching(/^Paso 2 · /)]);
    expect(screen.getByTestId('asm-instr-step-1').textContent).toContain('como base, apoyada en la mesa');
    expect(screen.getByTestId('asm-instr-step-2').textContent).toContain('Une A2 con A1 por su cara inferior: 2 espigas de 6 mm.Entra bajando desde arriba (−Z).');

    act(() => steps[1].focus());
    expect([...store().selectedIds].sort()).toEqual(ids);
    expect(steps[1].getAttribute('aria-current')).toBe('step');
    fireEvent.click(steps[0]);
    expect(store().selectedIds).toHaveLength(1);
    expect(screen.getByTestId('asm-instr-materials').textContent).toContain('2 piezas impresas');
    expect(screen.getByRole('group', { name: 'Descargar instrucciones' })).toBeTruthy();
    // Sin selección el panel conserva el grupo.
    act(() => store().setSelection([]));
    expect(screen.getByRole('list', { name: 'Pasos de armado' })).toBeTruthy();
  });

  it('la acción solo se ofrece con una pieza dividida y el panel sigue con varias piezas seleccionadas', () => {
    useKuraStore.setState({ objects: [fakeBox('x', 'Suelto')] } as never);
    const base = { objects: store().objects, selectedIds: ['x'], groups: [], busyOperation: null };
    expect(actionAvailability(base, 'assemblyInstructions')).toEqual({ enabled: false, reason: 'asmInstr.reason.notSplit' });
    const parts = splitBox();
    expect(actionAvailability({ ...base, objects: store().objects, selectedIds: [parts[0]] }, 'assemblyInstructions').enabled).toBe(true);
    const ctx = panelContextOf({ activeAction: 'assemblyInstructions', activeTool: 'select', selectedIds: parts, objects: store().objects });
    expect(ctx).toMatchObject({ kind: 'action', id: 'assemblyInstructions' });
  });

  it('sin una división seleccionada avisa qué elegir', () => {
    render(<AssemblyInstructionsPanel />);
    expect(screen.getByTestId('asm-instr-empty').textContent).toContain('Selecciona una pieza de una división');
  });

  it('el control «Armado» abre el panel', () => {
    const ids = splitBox();
    act(() => store().setSelection([ids[0]]));
    render(<SplitAssemblyControl />);
    fireEvent.click(screen.getByRole('button', { name: 'Instrucciones de armado' }));
    expect(store().activeAction).toBe('assemblyInstructions');
  });
});
