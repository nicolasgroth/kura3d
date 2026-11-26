/**
 * @file src/components/__tests__/SplitJointFirmness.test.tsx
 * @description Firmeza de cada unión antes de dividir, con datos reales del motor (`BedSplitPlan.jointPreview` de una
 * barra de 440 mm en cama de 120: ver `fixtures/jointPreview.json`, que `splitFirmnessPreview.test.ts` mantiene al
 * día contra el motor): sección amplia → firmes; sección fina → para pegar con su motivo; tamaño manual → la unión
 * débil queda marcada y ofrece dimensionar según cada unión; con el tamaño automático la misma pieza no queda débil.
 * También el conteo global, el nombre accesible de cada unión y el teclado de la lista.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SplitPreviewJoint } from '../../engine';
import data from './fixtures/jointPreview.json';
import { SplitJointFirmnessSummary, type SplitJointFirmnessSummaryProps } from '../split/SplitJointFirmnessSummary';

const CASES = data as unknown as Record<'wide' | 'thin' | 'manualWeak' | 'autoSame', SplitPreviewJoint[]>;
const { wide, thin, manualWeak, autoSame } = CASES;

const view = (joints: SplitPreviewJoint[], props: Partial<SplitJointFirmnessSummaryProps> = {}) =>
  render(<SplitJointFirmnessSummary joints={joints} hasConnector sizeAuto reinforce={false} manualDiameterMm={3} {...props} />);
const openAll = (c: HTMLElement) => c.querySelectorAll('details').forEach((d) => { d.open = true; });

describe('firmeza por unión antes de dividir', () => {
  it('barra larga de sección amplia: todas firmes, con conteo global, medidas y pared mínima', () => {
    const { container } = view(wide);
    expect(screen.getByTestId('split-firmness-counts').textContent).toContain(`${wide.length} uniones: ${wide.length} firmes`);
    openAll(container);
    const row = screen.getByTestId('split-firmness-1');
    expect(row.textContent).toContain('Firme');
    const s = wide[0].strength;
    // Las medidas salen del motor (diámetro = 2 × radio), no de un cálculo del componente
    expect(row.textContent).toContain(`${s.count} × Ø${2 * s.sizeMm} mm`);
    expect(row.textContent).toContain('pared mínima 1,2 mm');
    expect(row.querySelector('button')).toBeNull();
  });

  it('sección fina: queda para pegar con el motivo en palabras y ofrece solape de borde', () => {
    const onUseLap = vi.fn();
    const { container } = view(thin, { onUseLap });
    expect(screen.getByTestId('split-firmness-counts').textContent).toContain(`${thin.length} para pegar`);
    openAll(container);
    const row = screen.getByTestId('split-firmness-1');
    expect(row.textContent).toContain('Para pegar');
    // Ancho útil = diámetro del mayor círculo que cabe (sección de 4 mm → 4 mm; antes decía 2, la mitad).
    expect(row.textContent).toContain('tiene 4 mm de ancho útil (el círculo más grande que cabe en ella)');
    // Cada unión con su propio nombre accesible (no se confunde con el botón general «en todas las uniones»).
    const names = screen.getAllByRole('button', { name: /^Usar solape de borde: arregla la unión/ }).map((x) => x.getAttribute('aria-label'));
    expect(names).toContain('Usar solape de borde: arregla la unión 1 y se aplica a todas');
    expect(new Set(names).size).toBe(names.length);
    fireEvent.click(row.querySelector('button')!);
    expect(onUseLap).toHaveBeenCalledTimes(1);
  });

  it('tamaño manual: marca las uniones débiles y ofrece dimensionar según cada unión y reforzar', () => {
    const onEnableSizeAuto = vi.fn();
    const onEnableReinforce = vi.fn();
    const { container } = view(manualWeak, { sizeAuto: false, onEnableSizeAuto, onEnableReinforce });
    expect(screen.getByTestId('split-firmness-counts').textContent).toContain(`${manualWeak.length} débiles`);
    openAll(container);
    const row = screen.getByTestId('split-firmness-1');
    expect(row.textContent).toContain('Débil');
    expect(row.textContent).toContain('Con el tamaño manual (Ø3 mm) esta unión queda débil.');
    expect(row.textContent).toMatch(/cubren solo el [\d,]+ % del contacto/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Dimensionar según cada unión' })[0]);
    expect(onEnableSizeAuto).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'Reforzar las uniones débiles' })[0]);
    expect(onEnableReinforce).toHaveBeenCalledTimes(1);
  });

  it('con el tamaño automático la misma pieza no queda débil y no ofrece cambios', () => {
    expect(autoSame.every((j) => j.strength.level !== 'weak')).toBe(true);
    const { container } = view(autoSame, { onEnableSizeAuto: vi.fn(), onEnableReinforce: vi.fn() });
    openAll(container);
    expect(screen.queryByText(/Con el tamaño manual/)).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    // «Regular» lleva su propio nombre, no «Firme»
    expect(screen.getByTestId('split-firmness-1').textContent).toContain('Regular');
    expect(screen.getByTestId('split-firmness-counts').textContent).toContain('regulares');
  });

  it('cada unión tiene nombre accesible con su estado y la lista se recorre con el teclado', () => {
    const { container } = view(wide);
    openAll(container);
    const summaries = container.querySelectorAll<HTMLElement>('summary.kura-firmness-row-summary');
    expect(summaries).toHaveLength(wide.length);
    expect(summaries[0].getAttribute('aria-label')).toMatch(/Firmeza: Firme$/);
    summaries[0].focus();
    fireEvent.keyDown(summaries[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(summaries[1]);
    fireEvent.keyDown(summaries[1], { key: 'End' });
    expect(document.activeElement).toBe(summaries[summaries.length - 1]);
    fireEvent.keyDown(summaries[summaries.length - 1], { key: 'Home' });
    expect(document.activeElement).toBe(summaries[0]);
  });

  it('sin la previa medida lo dice; sin conector no muestra nada', () => {
    const { rerender } = render(
      <SplitJointFirmnessSummary joints={undefined} hasConnector sizeAuto reinforce={false} manualDiameterMm={8} />,
    );
    expect(screen.getByTestId('split-firmness-unmeasured')).toBeTruthy();
    rerender(<SplitJointFirmnessSummary joints={wide} hasConnector={false} sizeAuto reinforce={false} manualDiameterMm={8} />);
    expect(screen.queryByTestId('split-firmness')).toBeNull();
  });
});
