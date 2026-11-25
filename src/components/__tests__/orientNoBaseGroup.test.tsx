/**
 * @file src/components/__tests__/orientNoBaseGroup.test.tsx
 * @description Las orientaciones «sin base de apoyo» van en un grupo aparte y plegado al final; el grupo se abre
 * si la elegida está dentro y el resumen visible sale de una sola fuente de texto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrientAnalysis, OrientCandidate } from '../../engine/orient';
import { OrientOptionList } from '../orient/OrientOptionList';
import { splitCandidates, summaryOf, summaryText } from '../orient/orientView';

const cand = (id: string, noBase = false): OrientCandidate =>
  ({
    id,
    source: id === 'current' ? 'current' : 'face',
    down: [0, -1, 0],
    quaternion: [0, 0, 0, 1],
    measures: { supportVolumeMm3: 100, overhangAreaMm2: 50, contactAreaMm2: noBase ? 0 : 400, heightMm: 20 },
    cost: 1,
    rank: 0,
    equivalentToBest: false,
    vsCurrent: { supportVolumePct: null, overhangAreaPct: null, heightPct: 0, contactFactor: null },
    reasons: noBase ? [{ key: 'noBase' }] : [],
  }) as unknown as OrientCandidate;

const analysis = (): OrientAnalysis =>
  ({
    candidates: [cand('a'), cand('current'), cand('e1', true), cand('e2', true)],
    currentId: 'current',
    currentIsBest: false,
    baseStatus: 'ok',
    allEquivalent: false,
    overhangAngleDeg: 45,
  }) as unknown as OrientAnalysis;

afterEach(cleanup);

describe('Orientar: grupo «sin base»', () => {
  it('reparte las válidas y las sin base conservando la numeración', () => {
    const { valid, noBase } = splitCandidates(analysis());
    expect(valid.map((x) => x.c.id)).toEqual(['a', 'current']);
    expect(noBase.map((x) => [x.c.id, x.index])).toEqual([['e1', 2], ['e2', 3]]);
  });

  it('muestra un grupo plegado con título claro, aparte de las válidas', () => {
    const onApply = vi.fn();
    render(<OrientOptionList language="es" analysis={analysis()} chosenId="a" onChoose={() => {}} onApply={onApply} onPreview={() => {}} />);
    const group = screen.getByTestId('orient-nobase-group');
    expect(group.hasAttribute('open')).toBe(false);
    expect(within(group).getByText(/No recomendadas: sin base de apoyo \(2\)/)).toBeTruthy();
    expect(within(screen.getByTestId('orient-options')).getAllByTestId('orient-option')).toHaveLength(2);
    fireEvent.keyDown(within(group).getAllByTestId('orient-option')[0], { key: 'Enter' });
    expect(onApply).toHaveBeenCalledWith('e1');
  });

  it('el grupo se abre solo cuando la elegida es una sin base', () => {
    render(<OrientOptionList language="es" analysis={analysis()} chosenId="e2" onChoose={() => {}} onApply={() => {}} onPreview={() => {}} />);
    expect(screen.getByTestId('orient-nobase-group').hasAttribute('open')).toBe(true);
  });

  it('el resumen tiene una sola fuente de texto', () => {
    const a = { ...analysis(), currentIsBest: true } as OrientAnalysis;
    expect(summaryOf('es', a).text).toBe(summaryText('es', a));
    expect(summaryOf('es', a).kind).toBe('best');
  });
});
