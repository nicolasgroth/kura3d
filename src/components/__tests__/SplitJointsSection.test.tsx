/**
 * @file src/components/__tests__/SplitJointsSection.test.tsx
 * @description Sección "Uniones" del inspector: lista con estado (firme, débil, para pegar, tipo cambiado,
 * traba el montaje), avisos y sugerencias junto a cada unión, resaltado al enfocar y "Validar armado".
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import type { SplitJointRecord, SceneObject } from '../../types/kura';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { SplitJointsSection } from '../split/SplitJointsSection';

const conn = (type: 'dowel' | 'dovetail' | 'loose-dowel', size = 4) => ({ type, size, depth: 6, tolerance: 0.25, count: 2 });
const joint = (label: string, a: string, b: string, over: Partial<SplitJointRecord> = {}): SplitJointRecord => ({
  label, axis: 'y', position: 100 * Number(label), a, b, kind: 'connector', connector: conn('dowel'),
  connectorCenters: [[0, 100, 0], [10, 100, 0]], contactAreaMm2: 800, ...over,
});
const JOINTS = [
  joint('1', 'A1', 'A2'),
  joint('2', 'A2', 'A3'),
  joint('3', 'A3', 'A4', { kind: 'glue', connector: null, connectorCenters: [] }),
  joint('4', 'A4', 'A5'),
];
const part = (id: string, code: string, step: number): SceneObject => {
  const o = fakeBox(id, code, 20);
  o.metadata = {
    split: {
      groupId: 'g', code, cell: [0, 0, 0], assembly: { position: [0, 0, 0], rotation: [0, 0, 0] },
      print: { position: [0, 0, 0], rotation: [0, 0, 0], plate: 0, downFace: '-y' }, jointLabels: [],
      assemblyStep: step, insertDirection: '-y', joints: JOINTS,
    },
  };
  return o;
};
const parts = ['A1', 'A2', 'A3', 'A4', 'A5'].map((c, i) => part(`p${i}`, c, i + 1));

const weakWarning = { code: 'ASSEMBLY_WEAK_JOINT', params: { label: '2', measured: 4, recommended: 6 } };
const lapWarning = { code: 'SPLIT_LAP_NOT_PRINTABLE', params: { label: '3', tongue: 1, groove: 1, min: 2 } };

const validate = vi.fn();
beforeEach(() => {
  validate.mockReset();
  useKuraStore.setState({
    language: 'es', objects: parts, selectedIds: ['p0'], busyOperation: null,
    splitValidation: {}, splitJointFocus: null, validateSplitGroup: validate,
    splitNotes: {
      g: {
        warnings: [weakWarning, lapWarning, { code: 'ASSEMBLY_JOINT_TYPE_CHANGED', params: { label: '4', a: 'A4', b: 'A5', from: 'dowel', to: 'dovetail' } }],
        suggestions: [], weakJoints: ['2'], gluedByFix: [], changedByFix: ['4:dovetail'],
      },
    },
  } as never);
});

const row = (label: string) => screen.getByTestId(`split-joint-${label}`);
const status = (label: string) => row(label).querySelector('.kura-split-joint-status')?.textContent?.trim();

describe('SplitJointsSection', () => {
  it('lista cada unión con sus piezas, tipo y estado en texto (no solo color)', () => {
    render(<SplitJointsSection primary={parts[0]} />);
    expect(status('1')).toBe(t('es', 'splitJoints.status.ok'));
    expect(status('2')).toBe(t('es', 'splitJoints.status.weak'));
    expect(status('3')).toBe(t('es', 'splitJoints.status.glue'));
    expect(status('4')).toBe(t('es', 'splitJoints.status.changed'));
    expect(row('1').textContent).toContain(t('es', 'splitJoints.item', { label: '1', a: 'A1', b: 'A2' }));
    expect(row('1').textContent).toContain(t('es', 'dialog.cut.connector.dowel'));
  });

  it('muestra junto a la unión el aviso de unión débil y el de solape no imprimible', () => {
    render(<SplitJointsSection primary={parts[0]} />);
    expect(row('2').textContent).toContain(t('es', 'splitJoints.note.weak', { measured: '4', recommended: '6' }));
    expect(row('3').textContent).toContain(t('es', 'engineWarning.SPLIT_LAP_NOT_PRINTABLE', { label: '3', tongue: 1, groove: 1, min: 2 }));
    expect(row('4').textContent).toContain(t('es', 'splitJoints.note.changed', { from: t('es', 'dialog.cut.connector.dowel'), to: t('es', 'dialog.cut.connector.dovetail') }));
  });

  it('resalta la unión al enfocarla o pasar el cursor y la apaga al salir; clic la fija', () => {
    render(<SplitJointsSection primary={parts[0]} />);
    const btn = within(row('2')).getByRole('button');
    fireEvent.focus(btn);
    expect(useKuraStore.getState().splitJointFocus).toEqual({ groupId: 'g', label: '2' });
    fireEvent.blur(btn);
    expect(useKuraStore.getState().splitJointFocus).toBeNull();
    fireEvent.mouseEnter(btn);
    expect(useKuraStore.getState().splitJointFocus).toEqual({ groupId: 'g', label: '2' });
    fireEvent.mouseLeave(btn);
    expect(useKuraStore.getState().splitJointFocus).toBeNull();
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.mouseLeave(btn);
    expect(useKuraStore.getState().splitJointFocus).toEqual({ groupId: 'g', label: '2' });
  });

  it('cada unión tiene nombre accesible con su estado', () => {
    render(<SplitJointsSection primary={parts[0]} />);
    const name = within(row('2')).getByRole('button').getAttribute('aria-label') ?? '';
    expect(name).toContain('A2');
    expect(name).toContain(t('es', 'splitJoints.status.weak'));
  });

  it('una unión que traba el montaje muestra las opciones del motor y cómo aplicarlas', () => {
    act(() =>
      useKuraStore.setState({
        splitValidation: {
          g: {
            status: 'done',
            report: {
              ok: false, parts: 5, joints: 4, steps: 3, blocked: ['A3'], clashes: 0, weak: [], order: [],
              suggestions: [{ joint: '1', options: ['glue', 'change-type:dovetail'] }],
              blockedDetail: [{ code: 'A3', conflictingJoints: ['1'], blockingParts: [] }],
              closure: { ok: true, interference: [], gaps: [] }, warnings: [],
            },
          },
        },
      } as never),
    );
    render(<SplitJointsSection primary={parts[0]} />);
    const r = row('1');
    expect(status('1')).toBe(t('es', 'splitJoints.status.blocked'));
    expect(r.textContent).toContain(t('es', 'splitJoints.note.blocked', { codes: 'A3' }));
    expect(within(r).getByText(t('es', 'splitJoints.suggest.glue'))).toBeTruthy();
    expect(within(r).getByText(t('es', 'splitJoints.suggest.change', { type: t('es', 'dialog.cut.connector.dovetail') }))).toBeTruthy();
    expect(r.textContent).toContain(t('es', 'splitJoints.suggest.howto'));
    // Resultado resumido: no cierra y dice qué pieza no entra.
    expect(screen.getByRole('status').textContent).toContain(t('es', 'splitJoints.result.fail'));
    expect(screen.getByRole('status').textContent).toContain('A3');
  });

  it('Validar armado llama a la validación del grupo y muestra "cierra"', () => {
    render(<SplitJointsSection primary={parts[0]} />);
    fireEvent.click(screen.getByRole('button', { name: t('es', 'splitJoints.validate') }));
    expect(validate).toHaveBeenCalledWith('g');
    act(() =>
      useKuraStore.setState({
        splitValidation: {
          g: {
            status: 'done',
            report: {
              ok: true, parts: 5, joints: 4, steps: 5, blocked: [], clashes: 0, weak: [], suggestions: [], order: [],
              blockedDetail: [], closure: { ok: true, interference: [], gaps: [] }, warnings: [],
            },
          },
        },
      } as never),
    );
    expect(screen.getByRole('status').textContent).toContain(t('es', 'splitJoints.result.ok', { count: 5 }));
  });

  it('numera las piezas por paso de montaje', () => {
    render(<SplitJointsSection primary={parts[0]} />);
    const items = screen.getAllByRole('listitem').filter((li) => li.textContent?.startsWith('Paso '));
    expect(items.map((li) => li.textContent?.slice(0, 10))).toEqual(['Paso 1: A1', 'Paso 2: A2', 'Paso 3: A3', 'Paso 4: A4', 'Paso 5: A5']);
  });

  it('no aparece si la pieza no es de una división', () => {
    const plain = fakeBox('x', 'Caja');
    useKuraStore.setState({ objects: [plain], selectedIds: ['x'] } as never);
    const { container } = render(<SplitJointsSection primary={plain} />);
    expect(container.textContent).toBe('');
  });
});
