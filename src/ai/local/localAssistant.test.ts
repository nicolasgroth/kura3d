/**
 * @file src/ai/local/localAssistant.test.ts
 * @description Pruebas del asistente local determinista contra el store real (Manifold WASM): ejemplos
 * del placeholder y de los chips, encadenado sobre el objeto recién creado, confirmación antes de tocar
 * una selección no nombrada, respuestas con dimensiones reales y órdenes no entendidas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../../engine';
import { useKuraStore } from '../../store/useKuraStore';
import type { LanguageCode } from '../../types/kura';
import { t } from '../../i18n';
import { humanError, resetLocalAssistant, runLocalAssistant } from './localAssistant';
import { parseLocalPrompt } from './localParser';

const exec = (req: Parameters<ReturnType<typeof useKuraStore.getState>['executeCommand']>[0]) =>
  useKuraStore.getState().executeCommand(req);
const ask = (prompt: string, lang: LanguageCode = 'es') => runLocalAssistant(prompt, lang, exec);
const objects = () => useKuraStore.getState().objects;
const byName = (name: string) => objects().find((o) => o.name === name)!;

beforeEach(async () => {
  await initManifoldEngine();
  resetLocalAssistant();
  useKuraStore.setState({
    engineReady: true, objects: [], selectedIds: [], past: [], future: [], unitSystem: 'mm', language: 'es', toasts: [],
  });
});

async function addBoxes(count: number) {
  for (let i = 0; i < count; i++) {
    await useKuraStore.getState().createPrimitive('box', { width: 20, height: 20, depth: 20 }, { name: `Caja ${i + 1}` });
  }
  useKuraStore.getState().setSelection(objects().map((o) => o.id));
}

describe('parser', () => {
  it('reads labelled measures, chains clauses and keeps dimension fragments together', () => {
    const plan = parseLocalPrompt('Crea un tubo de 40mm de alto y 30 mm de diámetro y ahueca a 2mm');
    expect(plan.steps.map((s) => s.intent.kind)).toEqual(['create', 'hollow']);
    expect(plan.steps[0].intent).toMatchObject({ shape: 'tube', params: { height: 40, outerRadius: 15 } });
    expect(plan.steps[1].intent).toMatchObject({ wall: 2 });
  });

  it('parses AxB sizes, units, directions and enclitic pronouns', () => {
    expect(parseLocalPrompt('Crear cilindro 20x50mm').steps[0].intent).toMatchObject({ params: { radius: 10, height: 50 } });
    expect(parseLocalPrompt('crea un cubo de 4 cm').steps[0].intent).toMatchObject({ params: { width: 40 } });
    const move = parseLocalPrompt('súbela 15 mm').steps[0];
    // Ejes del usuario (Z = altura): subir es +Z; "en y" es el fondo.
    expect(move.intent).toMatchObject({ kind: 'move', axis: 2, amount: 15 });
    expect(parseLocalPrompt('muévela 10 mm a la izquierda').steps[0].ref.pronoun).toBe(true);
    expect(parseLocalPrompt('mueve 10 mm en z').steps[0].intent).toMatchObject({ axis: 2, amount: 10 });
    expect(parseLocalPrompt('muévelo 30 mm en y').steps[0].intent).toMatchObject({ axis: 1, amount: 30 });
    expect(parseLocalPrompt('muévelo 5 mm hacia adelante').steps[0].intent).toMatchObject({ axis: 1, amount: -5 });
    expect(parseLocalPrompt('gíralo 90 grados').steps[0].intent).toMatchObject({ kind: 'rotate', axis: 2, degrees: 90 });
  });

  it('treats questions as queries, not as creation', () => {
    expect(parseLocalPrompt('¿Qué tamaño tiene la esfera?').steps[0].intent).toEqual({ kind: 'query', what: 'size' });
    expect(parseLocalPrompt('¿Qué hay en la escena?').steps[0].intent).toEqual({ kind: 'query', what: 'scene' });
  });
});

describe('local assistant on the real store', () => {
  it('interpreta y responde los ejes en el sistema del usuario (Z = altura, Y = fondo)', async () => {
    await addBoxes(1);
    const id = objects()[0].id;
    const start = [...byName(objects()[0].name).position];
    const run = async (prompt: string) => {
      const out = await ask(prompt);
      return out.executedTools.length > 0 ? out : ask('sí');
    };
    const up = await run('súbela 10 mm en z');
    expect(up.executedTools.map((x) => x.name)).toContain('transform_object');
    const afterUp = objects().find((o) => o.id === id)!.position;
    expect(afterUp[1]).toBeCloseTo(start[1] + 10, 6); // interno: Y es la altura
    expect(up.assistantText).toContain('Z');
    await run('muévela 30 mm en y');
    const afterBack = objects().find((o) => o.id === id)!.position;
    expect(afterBack[2]).toBeCloseTo(start[2] - 30, 6); // Y del usuario = fondo = −Z interno
    expect(afterBack[1]).toBeCloseTo(start[1] + 10, 6);
  });

  it('placeholder example: creates the cylinder and hollows only the new cylinder, never the selection', async () => {
    await addBoxes(3);
    const before = objects().map((o) => ({ id: o.id, volume: o.stats.volumeMm3 }));

    const out = await ask('Crea un cilindro de 40mm de alto y ahueca a 2mm');

    expect(out.executedTools.map((t) => t.name)).toEqual(['create_primitive', 'hollow_object']);
    const tube = objects().find((o) => o.primitiveType === 'cylinder')!;
    expect(tube.stats.dimensionsMm[1]).toBeCloseTo(40, 0);
    expect(tube.hollow?.wallThickness).toBe(2);
    for (const { id, volume } of before) {
      expect(objects().find((o) => o.id === id)!.stats.volumeMm3).toBeCloseTo(volume, 3);
      expect(objects().find((o) => o.id === id)!.hollow?.enabled ?? false).toBe(false);
    }
    expect(out.assistantText).toContain(tube.name);
    // X × Y × Z con Z = alto.
    expect(out.assistantText).toMatch(/24 × 24 × 40 mm/);
  });

  it('creates a sphere and moves the new sphere 30 mm', async () => {
    const out = await ask('haz una esfera de 25 mm y muévela 30 mm');
    const sphere = objects().find((o) => o.primitiveType === 'sphere')!;
    expect(out.executedTools.map((t) => t.name)).toEqual(['create_primitive', 'transform_object']);
    expect(sphere.stats.dimensionsMm[0]).toBeCloseTo(25, 0);
    expect(sphere.position[0]).toBeCloseTo(30, 3);
    expect(out.assistantText).toMatch(/30 mm/);
  });

  it('answers size questions in natural language with real dimensions and no changes', async () => {
    await ask('haz una esfera de 25 mm');
    const revision = objects();
    const out = await ask('¿Qué tamaño tiene la esfera?');
    expect(objects()).toBe(revision);
    expect(out.assistantText).toMatch(/25 × 25 × 25 mm/);
    expect(out.assistantText).not.toMatch(/get_scene_state/);
  });

  it('asks before touching an unnamed selection and applies only after "sí"', async () => {
    await addBoxes(2);
    const out = await ask('ahueca a 2 mm');
    expect(out.executedTools).toEqual([]);
    expect(out.assistantText).toMatch(/Caja 1/);
    expect(objects().every((o) => !o.hollow?.enabled)).toBe(true);

    const confirmed = await ask('sí');
    expect(confirmed.executedTools.map((t) => t.name)).toEqual(['hollow_object', 'hollow_object']);
    expect(objects().every((o) => o.hollow?.wallThickness === 2)).toBe(true);
  });

  it('"muévelo" con un objeto seleccionado lo mueve sin preguntar a cuál', async () => {
    await addBoxes(2);
    const target = objects()[1];
    useKuraStore.setState({ selectedIds: [target.id] });
    const before = target.position[0];
    const out = await ask('muévelo 20 mm');
    expect(out.executedTools.map((t) => t.name)).toEqual(['transform_object']);
    expect(objects().find((o) => o.id === target.id)!.position[0]).toBeCloseTo(before + 20, 3);
    expect(out.assistantText).not.toMatch(/\?/);
  });

  it('cancels the pending action on "no" and when the user says something else', async () => {
    await addBoxes(1);
    await ask('duplica');
    expect((await ask('no')).executedTools).toEqual([]);
    expect(objects()).toHaveLength(1);
    await ask('duplica');
    await ask('¿qué hay en la escena?');
    expect((await ask('sí')).assistantText).toMatch(/No entendí/);
    expect(objects()).toHaveLength(1);
  });

  it('targets objects named explicitly or through the selection', async () => {
    await addBoxes(2);
    await ask('mueve Caja 2 15 mm a la derecha');
    expect(byName('Caja 2').position[0]).toBeCloseTo(15, 3);
    expect(byName('Caja 1').position[0]).toBeCloseTo(0, 3);
    await ask('escala el objeto seleccionado al 50%');
    expect(byName('Caja 1').scale[0]).toBeCloseTo(0.5, 3);
  });

  it('says what it did not understand without touching the scene', async () => {
    await addBoxes(1);
    const out = await ask('baila la macarena');
    expect(out.executedTools).toEqual([]);
    expect(out.assistantText).toMatch(/No entendí/);
  });

  it('runs every chip prompt in both languages', async () => {
    for (const [prompt, lang] of [['Crear cubo 40mm', 'es'], ['Create box 40mm', 'en']] as const) {
      const out = await ask(prompt, lang);
      expect(out.executedTools[0].name).toBe('create_primitive');
    }
    expect(objects()[0].stats.dimensionsMm[0]).toBeCloseTo(40, 0);
    const cyl = await ask('Crear cilindro 20x50mm');
    expect(cyl.executedTools[0].name).toBe('create_primitive');
    const cylinder = objects().find((o) => o.primitiveType === 'cylinder')!;
    expect(cylinder.stats.dimensionsMm[1]).toBeCloseTo(50, 0);
    useKuraStore.getState().setSelection([cylinder.id]);
    expect((await ask('Ahueca el objeto seleccionado a 2,5 mm')).executedTools[0].name).toBe('hollow_object');
    expect((await ask('Hollow the selected object to 2.5 mm', 'en')).executedTools[0].name).toBe('hollow_object');
    expect(byName(cylinder.name).hollow?.wallThickness).toBe(2.5);
    const exported = await ask('Exportar STL');
    expect(exported.executedTools[0].name).toBe('export_stl');
  });

  it('greeting: threaded hole M6 confirmed with "sí" runs exactly the shown plan (no centering)', async () => {
    await useKuraStore.getState().createPrimitive('cylinder', { radius: 15, height: 30 }, { name: 'Cilindro 4' });
    const cyl = byName('Cilindro 4');
    useKuraStore.getState().setSelection([cyl.id]);
    const volumeBefore = cyl.stats.volumeMm3;
    const ask1 = await ask('agrégale un agujero roscado M6 en el centro');
    expect(ask1.executedTools).toEqual([]);
    expect(ask1.assistantText).toMatch(/agujero roscado M6×1/);
    expect(ask1.assistantText).not.toMatch(/centrar/);
    const done = await ask('sí');
    const names = done.executedTools.map((t) => t.name);
    expect(names).toEqual(['create_thread', 'transform_object', 'boolean_operation']);
    expect(names).not.toContain('center');
    const result = objects().find((o) => !o.isHole)!;
    expect(objects().filter((o) => o.isHole)).toHaveLength(0);
    expect(result.stats.volumeMm3).toBeLessThan(volumeBefore - 300);
    expect(done.assistantText).toMatch(/M6×1/);
  });

  it('threaded hole through a part taller than the max thread: threads the top and finishes plain, no internal errors', async () => {
    await useKuraStore.getState().createPrimitive('cylinder', { radius: 15, height: 400 }, { name: 'Tubo alto' });
    const tall = byName('Tubo alto');
    useKuraStore.getState().setSelection([tall.id]);
    const volumeBefore = tall.stats.volumeMm3;
    await ask('agrégale un agujero roscado M6 en el centro');
    const done = await ask('sí');
    expect(done.assistantText).not.toMatch(/lengthMm|threadHole|∈|\.\./);
    expect(done.assistantText).toContain(t('es', 'ai.local.threadHoleLimited', { thread: '300', total: '402', max: '300' }));
    expect(done.executedTools.map((x) => x.name)).toEqual(['create_thread', 'transform_object', 'create_primitive', 'transform_object', 'boolean_operation']);
    expect(objects().filter((o) => o.isHole)).toHaveLength(0);
    const result = objects().find((o) => !o.isHole)!;
    // Paso completo: al menos el volumen de un agujero de Ø ~5 mm por 400 mm.
    expect(result.stats.volumeMm3).toBeLessThan(volumeBefore - Math.PI * 2.4 * 2.4 * 390);
  }, 30_000);

  it('humanError drops internal messages and trailing periods', () => {
    expect(humanError('Parámetro "lengthMm" inválido: se esperaba number ∈ [1, 300].')).toBeNull();
    expect(humanError('La pieza está bloqueada.')).toBe('La pieza está bloqueada');
    expect(humanError(undefined)).toBeNull();
  });

  it('greeting: "¿qué tan imprimible es?" analyzes the selection without asking', async () => {
    await addBoxes(1);
    const out = await ask('¿qué tan imprimible es?');
    expect(out.executedTools.map((t) => t.name)).toEqual(['analyze_printability']);
    expect(out.assistantText).toMatch(/imprimibilidad \d+\/100/);
  });

  it('greeting: creates ISO bolts and nuts', async () => {
    const out = await ask('crea un tornillo M8 de 25 mm');
    expect(out.executedTools.map((t) => t.name)).toEqual(['create_thread']);
    expect(parseLocalPrompt('crea una tuerca M10').steps[0].intent).toMatchObject({ kind: 'thread', part: 'nut', diameter: 10, pitch: 1.5 });
    expect(parseLocalPrompt('rosca M6x0.75').steps[0].intent).toMatchObject({ diameter: 6, pitch: 0.75 });
  });

  it('does nothing at all when part of the request is not understood', async () => {
    await addBoxes(1);
    const revision = objects();
    const out = await ask('duplica Caja 1 y baila la macarena');
    expect(out.executedTools).toEqual([]);
    expect(objects()).toBe(revision);
    expect(out.assistantText).toMatch(/no ejecuté nada/);
  });

  it('"en el centro" is a location, not the center command', () => {
    expect(parseLocalPrompt('pon una esfera en el centro').steps.map((s) => s.intent.kind)).toEqual(['create']);
    expect(parseLocalPrompt('céntrala').steps[0].intent.kind).toBe('center');
  });

  it('chat-created pieces are born in free space, not inside another one', async () => {
    await ask('crea un cubo de 40 mm');
    await ask('crea un cubo de 40 mm');
    const [a, b] = objects();
    expect(Math.abs(a.position[0] - b.position[0]) + Math.abs(a.position[2] - b.position[2])).toBeGreaterThanOrEqual(40);
  });

  it('replies in the UI language', async () => {
    const out = await ask('make a 30 mm cube', 'en');
    expect(out.assistantText).toMatch(/^Created/);
  });
});
