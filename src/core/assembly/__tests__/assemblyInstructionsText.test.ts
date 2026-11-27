/**
 * @file src/core/assembly/__tests__/assemblyInstructionsText.test.ts
 * @description Frases de las instrucciones de armado (plural correcto, medidas con el separador del idioma, cara y
 * dirección en ejes del usuario) y exportación a Markdown y HTML autocontenido con un nombre de pieza hostil escapado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { computeAssemblyInstructions } from '../assemblyInstructions';
import { instructionsHtml, instructionsMarkdown, instructionsFileName } from '../assemblyInstructionsExport';
import { materialLines, stepLines, stepSentence } from '../assemblyInstructionsText';
import type { InstructionPartInput } from '../assemblyInstructionsTypes';
import type { SplitJointRecord } from '../../../types/kura';

const magnet = { shape: 'round' as const, sizeMm: 6, heightMm: 3, clearanceMm: 0.2, depthClearanceMm: 0.3, hidden: false };

function setup(name = 'Caja') {
  const joints: SplitJointRecord[] = [
    { label: '1', axis: 'x', position: 50, a: 'A1', b: 'B1', kind: 'connector', connector: { type: 'dowel', size: 3, depth: 8, tolerance: 0.2, count: 2 }, connectorCenters: [[0, 0, 0], [0, 1, 0]], contactAreaMm2: 100 },
    { label: '2', axis: 'y', position: 50, a: 'A1', b: 'A2', kind: 'glue', connector: null, connectorCenters: [], contactAreaMm2: 100 },
    {
      label: '3', axis: 'y', position: 50, a: 'B1', b: 'B2', kind: 'connector',
      connector: { type: 'magnet', size: 3.1, depth: 3.3, tolerance: 0.2, count: 1, magnet },
      magnets: { magnet, count: 1, pocketDiameterMm: 6.2, pocketDepthMm: 3.3, polarity: 'opposite' },
      connectorCenters: [[0, 0, 0]], contactAreaMm2: 100,
    },
  ];
  const part = (code: string, bottomMm: number, vol: number): InstructionPartInput => ({
    id: code, code, name: `${name} · ${code}`, volumeMm3: vol, bottomMm, joints: joints.filter((j) => j.a === code || j.b === code),
  });
  return computeAssemblyInstructions({ parts: [part('A1', 0, 1000), part('B1', 0, 900), part('A2', 50, 800), part('B2', 50, 700)], dowels: [{ diameterMm: 2.5, lengthMm: 16, count: 1 }] });
}

describe('frases de los pasos', () => {
  it('base, espigas con plural, pegar e imanes en español', () => {
    const out = setup();
    expect(stepSentence('es', out.steps[0])).toBe('Coloca A1 como base, apoyada en la mesa.');
    expect(stepSentence('es', out.steps[1])).toBe('Une B1 con A1 por su cara izquierda: 2 espigas de 6 mm. Entra hacia la izquierda (−X).');
    expect(stepSentence('es', out.steps[2])).toBe('Une A2 con A1 por su cara inferior: pega las caras. Entra bajando desde arriba (−Z).');
    const b2 = stepLines('es', out.steps[3]);
    expect(b2.main[0]).toBe('Une B2 con B1 por su cara inferior: 1 par de imanes de Ø6 × 3 mm.');
    expect(b2.warnings[0]).toContain('polos opuestos');
  });

  it('inglés y alemán con singular y plural', () => {
    const out = setup();
    expect(stepSentence('en', out.steps[1])).toBe('Join B1 to A1 by its left face: 2 dowels of 6 mm. It goes in toward the left (−X).');
    expect(stepLines('en', out.steps[3]).main[0]).toBe('Join B2 to B1 by its bottom face: 1 pair of Ø6 × 3 mm magnets.');
    expect(stepLines('de', out.steps[3]).main[0]).toContain('1 Magnetpaar');
  });

  it('lista de materiales con decimales del idioma', () => {
    const out = setup();
    const es = materialLines('es', out.materials);
    expect(es).toContain('4 piezas impresas: A1, A2, B1, B2');
    expect(es).toContain('1 tarugo suelto de 2,5 × 16 mm (se imprimen aparte)');
    expect(es).toContain('2 imanes de Ø6 × 3 mm');
    expect(es).toContain('1 unión para pegar (pegamento para plástico)');
    expect(materialLines('en', out.materials)).toContain('2 magnets of Ø6 × 3 mm');
  });
});

describe('exportar', () => {
  const hostile = '<img src=x onerror=alert(1)> & "co" **x**';

  it('HTML autocontenido: escapa el nombre, sin scripts ni recursos externos, lista ordenada', () => {
    const out = setup(hostile);
    const html = instructionsHtml('es', { model: hostile, instructions: out });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/<(script|link|img|iframe|object|embed|a)\b/i);
    expect(html).not.toMatch(/https?:|url\(/i);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;co&quot;');
    expect(html).toContain('<ol');
    expect((html.match(/<li class="step"/g) ?? []).length).toBe(4);
    expect(html).toContain('lang="es"');
  });

  it('Markdown: escapa HTML y marcas de formato del nombre', () => {
    const out = setup(hostile);
    const md = instructionsMarkdown('es', { model: hostile, instructions: out });
    expect(md).not.toContain('<img');
    expect(md).toContain('&lt;img');
    expect(md).toContain('\\*\\*x\\*\\*');
    expect(md).toMatch(/^# Instrucciones de armado: /);
    expect(md).toContain('1. Coloca A1 como base, apoyada en la mesa.');
    expect(md).toContain('4. Une B2 con B1');
  });

  it('nombre de archivo seguro', () => {
    expect(instructionsFileName(hostile, 'html')).toMatch(/^[A-Za-z0-9._-]+\.html$/);
    expect(instructionsFileName('', 'md')).toBe('kura3d_armado.md');
    expect(instructionsFileName('Pesa', 'md')).toBe('Pesa_armado.md');
  });
});
