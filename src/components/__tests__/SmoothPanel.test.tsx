/**
 * @file src/components/__tests__/SmoothPanel.test.tsx
 * @description Panel «Suavizar malla»: etiquetas y ayudas asociadas a cada control, ángulo visible solo con
 * la protección activa, zona pintada deshabilitada con motivo si la pieza no tiene pintura, vista previa con
 * estado `role="status"`, Enter en un campo, comparar con el original, sugerencia de aristas con su botón,
 * aplicar con un paso de deshacer, progreso por pasada y el menú de acciones (nombre único y panel).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import { uvSphere, withRadialNoise } from '../../engine/__tests__/smoothFixtures';
import { t } from '../../i18n';
import { ACTION_GROUPS, actionAvailability, actionHasPanel } from '../../store/actionsCatalog';
import { actionName } from '../../store/actionLabels';
import { useKuraStore } from '../../store/useKuraStore';
import type { InspectorLocalState } from '../inspector/inspectorTypes';
import { SMOOTH_UI_DEFAULTS } from '../../store/smoothParams';
import { smoothProgressText, SmoothStatus } from '../inspector/SmoothStatus';
import { SmoothPanel } from '../inspector/SmoothPanel';
import { panelContentOf } from '../contextPanel/panelRegistry';

const store = () => useKuraStore.getState();
const ui = {} as InspectorLocalState;
const sphere = (amp = 0.1, extra: Partial<ReturnType<typeof buildSceneObject>> = {}) =>
  ({ ...buildSceneObject({ id: 'sph', name: 'Esfera', source: 'imported', mesh: withRadialNoise(uvSphere(20, 32, 16), amp) }), ...extra });

function mount(obj = sphere()) {
  useKuraStore.setState({ objects: [obj], selectedIds: [obj.id], language: 'es', busyOperation: null, toasts: [], past: [], future: [], smoothSession: null, operationPreview: { key: null, status: 'idle', ghosts: [], guides: [] } });
  return render(<SmoothPanel primary={obj} ui={ui} />);
}

beforeEach(() => store().clearSmoothPreview());

describe('panel Suavizar', () => {
  it('cada control tiene etiqueta y ayuda de una línea asociadas', () => {
    mount();
    for (const [label, help] of [
      ['smooth.intensity', 'smooth.intensity.help'],
      ['smooth.passes', 'smooth.passes.help'],
    ] as const) {
      const input = screen.getByLabelText(t('es', label), { selector: 'input[type="text"], input:not([type])' });
      const described = (input.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent);
      expect(described).toContain(t('es', help));
    }
    const edges = screen.getByRole('checkbox', { name: t('es', 'smooth.keepEdges') }) as HTMLInputElement;
    expect(edges.checked).toBe(true);
    expect(document.getElementById(edges.getAttribute('aria-describedby')!)!.textContent).toBe(t('es', 'smooth.keepEdges.help'));
    expect(screen.getByRole('slider', { name: t('es', 'smooth.intensity.slider') })).toBeTruthy();
  });

  it('el ángulo (40° por defecto) solo se ve con la protección activa', async () => {
    const user = userEvent.setup();
    mount();
    const angle = screen.getByLabelText(t('es', 'smooth.angle')) as HTMLInputElement;
    expect(angle.value).toContain('40');
    await user.click(screen.getByRole('checkbox', { name: t('es', 'smooth.keepEdges') }));
    expect(screen.queryByLabelText(t('es', 'smooth.angle'))).toBeNull();
  });

  it('sin pintura, la zona por color está deshabilitada y dice por qué', () => {
    mount();
    const radio = screen.getByRole('radio', { name: t('es', 'smooth.where.color') }) as HTMLInputElement;
    expect(radio.disabled).toBe(true);
    expect(document.getElementById(radio.getAttribute('aria-describedby')!)!.textContent).toBe(t('es', 'smooth.where.noPaint'));
    expect((screen.getByRole('radio', { name: t('es', 'smooth.where.all') }) as HTMLInputElement).checked).toBe(true);
  });

  it('con pintura lista los colores de la pieza y la transición', async () => {
    const base = sphere();
    const tris = base.mesh.indices.length / 3;
    const faceColors = Array.from({ length: tris }, (_, i) => (i % 2 ? '#ef4444' : '#38bdf8'));
    const user = userEvent.setup();
    mount({ ...base, mesh: { ...base.mesh, faceColors } });
    await user.click(screen.getByRole('radio', { name: t('es', 'smooth.where.color') }));
    const select = screen.getByLabelText(t('es', 'smooth.color')) as HTMLSelectElement;
    expect(select.options).toHaveLength(2);
    expect(screen.getByLabelText(t('es', 'smooth.transition'))).toBeTruthy();
  });

  it('Vista previa muestra el progreso final en role=status y el fantasma; comparar lo oculta', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: new RegExp(t('es', 'smooth.preview')) }));
    await waitFor(() => expect(store().smoothSession?.status).toBe('ready'));
    expect(screen.getByRole('status').textContent).toMatch(/Vista previa lista: el volumen cambiaría \d/);
    expect(store().operationPreview.ghosts).toHaveLength(1);
    await user.click(screen.getByRole('checkbox', { name: t('es', 'smooth.compare') }));
    expect(store().operationPreview.ghosts).toHaveLength(0);
    // No se tocó la escena.
    expect(store().past).toHaveLength(0);
  });

  it('Enter en un campo actualiza la vista previa', async () => {
    const user = userEvent.setup();
    mount();
    const passes = screen.getByLabelText(t('es', 'smooth.passes'));
    await user.click(passes);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(store().smoothSession?.status).toBe('ready'));
    expect(store().smoothSession!.params.iterations).toBe(3);
  });

  it('cambiar un valor descarta la vista previa obsoleta', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: new RegExp(t('es', 'smooth.preview')) }));
    await waitFor(() => expect(store().smoothSession?.status).toBe('ready'));
    fireEvent.change(screen.getByRole('slider', { name: t('es', 'smooth.intensity.slider') }), { target: { value: '60' } });
    await waitFor(() => expect(store().smoothSession).toBeNull());
    expect(store().operationPreview.ghosts).toHaveLength(0);
  });

  it('Aplicar da un paso de deshacer y avisa el cambio de volumen', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: t('es', 'smooth.apply') }));
    await waitFor(() => expect(store().smoothSession?.status).toBe('applied'));
    expect(store().past).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toMatch(/Suavizado aplicado: el volumen cambió/);
  });

  it('ruido fuerte con aristas protegidas: sugerencia y botón que sube el ángulo', async () => {
    const user = userEvent.setup();
    mount(sphere(0.9));
    await user.click(screen.getByRole('button', { name: new RegExp(t('es', 'smooth.preview')) }));
    const suggest = await screen.findByTestId('smooth-suggest');
    expect(suggest.textContent).toContain('La protección de aristas está frenando el suavizado: sube el ángulo o desactívala');
    await user.click(screen.getByRole('button', { name: t('es', 'smooth.suggest.raise', { angle: 70 }) }));
    await waitFor(() => expect(store().smoothSession?.params.sharpAngleDeg).toBe(70));
    expect((screen.getByLabelText(t('es', 'smooth.angle')) as HTMLInputElement).value).toContain('70');
  });

  it('el progreso se dice por pasada y al comprobar daños', () => {
    expect(smoothProgressText('es', 'smooth:3/10')).toBe('Suavizando: pasada 3 de 10');
    expect(smoothProgressText('es', 'smooth:check')).toBe('Comprobando que la malla no se dañe…');
    expect(smoothProgressText('en', null)).toBe(t('en', 'smooth.progress.start'));
  });
});

describe('Suavizar en el menú de acciones', () => {
  it('está en el grupo Malla junto a Simplificar y Refinar, con panel y un solo nombre', () => {
    const mesh = ACTION_GROUPS.find((g) => g.id === 'mesh')!.items as readonly string[];
    expect(mesh).toEqual(expect.arrayContaining(['simplify', 'refine', 'smooth']));
    expect(actionHasPanel('smooth')).toBe(true);
    expect(panelContentOf('smooth')?.title).toBe('panel.title.smooth');
    expect(actionName('es', 'smooth')).toBe('Suavizar…');
  });

  it('necesita un objeto no bloqueado y dice por qué', () => {
    const obj = sphere();
    const slice = (objects: typeof obj[], selectedIds: string[]) => ({ objects, selectedIds, groups: [], busyOperation: null });
    expect(actionAvailability(slice([obj], []), 'smooth')).toEqual({ enabled: false, reason: 'rediseno.reason.noSelection' });
    expect(actionAvailability(slice([{ ...obj, locked: true }], ['sph']), 'smooth')).toEqual({ enabled: false, reason: 'rediseno.reason.locked' });
    expect(actionAvailability(slice([obj], ['sph']), 'smooth').enabled).toBe(true);
  });
});

describe('SmoothStatus: puntos protegidos por daño', () => {
  const baseReport = {
    iterations: 4, requestedStrength: 0.5, appliedStrength: 0.5, movedVertices: 900, lockedVertices: 10, weldedVertices: 1200,
    movableVertices: 1000, damageProtectedVertices: 0, strengthCoverage: 1, volumeBeforeMm3: 100, volumeAfterMm3: 99,
    volumeChangePct: -1, maxDisplacementMm: 0.2, attempts: [],
  };
  const session = (report: typeof baseReport) => ({
    objectId: 'sph', status: 'ready', phase: null, signature: 's', params: SMOOTH_UI_DEFAULTS, report, warnings: [], error: null, errorCode: null, comparing: false,
  }) as never;

  it('con vértices protegidos dice cuántos quedaron sin suavizar y el porcentaje suavizado', () => {
    render(<SmoothStatus language="es" session={session({ ...baseReport, damageProtectedVertices: 120, strengthCoverage: 0.88 })} params={SMOOTH_UI_DEFAULTS} onFix={() => {}} />);
    const line = screen.getByTestId('smooth-protected');
    expect(line.textContent).toContain('120');
    expect(line.textContent).toContain('88');
  });

  it('sin vértices protegidos no muestra la línea', () => {
    render(<SmoothStatus language="es" session={session(baseReport)} params={SMOOTH_UI_DEFAULTS} onFix={() => {}} />);
    expect(screen.queryByTestId('smooth-protected')).toBeNull();
  });
});

// `act` se importa para dejar claro que las actualizaciones asíncronas del store ocurren dentro de waitFor.
void act;
