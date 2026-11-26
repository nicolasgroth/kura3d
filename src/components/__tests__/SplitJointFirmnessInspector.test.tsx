/**
 * @file src/components/__tests__/SplitJointFirmnessInspector.test.tsx
 * @description Informe de uniones del inspector tras dividir: cada unión con su firmeza (firme, regular, débil, para
 * pegar) en texto e icono, medidas reales del conector o imán (Ø, profundidad, pared mínima), motivos en palabras,
 * conteo global, nombre accesible con el estado y resaltado en el visor al enfocar la unión. Un conector bajo lo
 * recomendado (aviso del armado) cuenta como débil, y un proyecto sin firmeza guardada se ve como antes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneObject, SplitJointRecord, SplitJointRecordStrength } from '../../types/kura';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { SplitJointsSection } from '../split/SplitJointsSection';

const strength = (over: Partial<SplitJointRecordStrength>): SplitJointRecordStrength => ({
  level: 'firm', reasons: [], count: 2, sizeMm: 3, depthMm: 8, areaRatio: 0.02, islands: 1, islandsCovered: 1, shrunk: [], discarded: [], ...over,
});
const joint = (label: string, a: string, b: string, over: Partial<SplitJointRecord> = {}): SplitJointRecord => ({
  label, axis: 'y', position: 100 * Number(label), a, b, kind: 'connector',
  connector: { type: 'dowel', size: 3, depth: 8, tolerance: 0.25, count: 2 },
  connectorCenters: [[0, 100, 0], [10, 100, 0]], contactAreaMm2: 800, ...over,
});

const JOINTS: SplitJointRecord[] = [
  joint('1', 'A1', 'A2', { strength: strength({ level: 'firm' }) }),
  joint('2', 'A2', 'A3', { strength: strength({ level: 'fair', reasons: ['single-connector'], count: 1 }) }),
  joint('3', 'A3', 'A4', { strength: strength({ level: 'weak', reasons: ['low-area'], areaRatio: 0.001 }) }),
  joint('4', 'A4', 'A5', {
    kind: 'glue', connector: null, connectorCenters: [],
    strength: strength({ level: 'glue', reasons: ['no-connector'], count: 0, sizeMm: 0, depthMm: 0, areaRatio: 0, islandsCovered: 0, discarded: [{ island: 0, reason: 'section-narrow', measuredMm: 2 }] }),
  }),
  // Proyecto anterior: sin firmeza guardada
  joint('5', 'A5', 'A6'),
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
const parts = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'].map((c, i) => part(`p${i}`, c, i + 1));

beforeEach(() => {
  useKuraStore.setState({
    language: 'es', objects: parts, selectedIds: ['p0'], busyOperation: null,
    splitValidation: {}, splitJointFocus: null,
    splitNotes: { g: { warnings: [], suggestions: [], weakJoints: [], gluedByFix: [], changedByFix: [] } },
  } as never);
});

const row = (label: string) => screen.getByTestId(`split-joint-${label}`);
const status = (label: string) => row(label).querySelector('.kura-split-joint-status')?.textContent?.trim();

describe('firmeza de las uniones en el informe del inspector', () => {
  it('cada unión muestra su nivel en texto con icono y el conteo global', () => {
    render(<SplitJointsSection primary={parts[0]} />);
    expect(status('1')).toBe('Firme');
    expect(status('2')).toBe('Regular');
    expect(status('3')).toBe('Débil');
    expect(status('4')).toBe('Para pegar');
    // Sin firmeza guardada se ve como antes (firme por no tener aviso) y no entra al conteo
    expect(status('5')).toBe('Firme');
    expect(row('2').querySelector('.kura-split-joint-status svg')).not.toBeNull();
    expect(screen.getByTestId('split-joints-firmness').textContent).toBe('4 uniones: 1 firme, 1 regular, 1 débil, 1 para pegar');
  });

  it('el detalle trae medidas reales (Ø, profundidad, pared mínima) y los motivos', () => {
    render(<SplitJointsSection primary={parts[0]} />);
    expect(screen.getByTestId('split-joint-strength-1').textContent).toContain('2 × Ø6 mm, entra 8 mm; pared mínima 1,2 mm.');
    expect(screen.getByTestId('split-joint-strength-2').textContent).toContain('Un solo conector');
    expect(screen.getByTestId('split-joint-strength-3').textContent).toContain('solo el 0,1 % del contacto');
    const glue = screen.getByTestId('split-joint-strength-4').textContent ?? '';
    expect(glue).toContain('tiene 2 mm de ancho útil');
    // «No lleva conector» ya lo dice la nota de unión pegada
    expect(glue).not.toContain('No lleva conector');
  });

  it('un conector bajo lo recomendado (aviso del armado) cuenta como débil y dice los diámetros', () => {
    useKuraStore.setState({
      splitNotes: { g: { warnings: [{ code: 'ASSEMBLY_WEAK_JOINT', params: { label: '1', measured: 3, recommended: 5 } }], suggestions: [], weakJoints: ['1'], gluedByFix: [], changedByFix: [] } },
    } as never);
    render(<SplitJointsSection primary={parts[0]} />);
    expect(status('1')).toBe('Débil');
    expect(screen.getByTestId('split-joint-strength-1').textContent).toContain('mide Ø6 mm y lo recomendado para esta unión es Ø10 mm');
  });

  it('enfocar la unión la resalta en el visor y su nombre accesible incluye el estado', () => {
    render(<SplitJointsSection primary={parts[0]} />);
    const button = row('3').querySelector('button')!;
    expect(button.getAttribute('aria-label')).toMatch(/Estado: Débil/);
    fireEvent.focus(button);
    expect(useKuraStore.getState().splitJointFocus).toEqual({ groupId: 'g', label: '3' });
  });
});
