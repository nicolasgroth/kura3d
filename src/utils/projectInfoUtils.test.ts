/**
 * @file src/utils/projectInfoUtils.test.ts
 * @description Utilidades de los datos del proyecto: contador de tiempo de trabajo con reloj simulado (cuenta solo en
 * primer plano y con actividad reciente, no cuenta suspensiones), formato humano de fechas y duraciones, y la
 * memoria de descripción y fecha de recientes (acotada, sin notas, sin entradas hostiles).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { formatInfoDate, formatRelative, formatWorkSeconds } from './projectInfoFormat';
import { clearRecentInfo, loadRecentInfo, MAX_RECENT_INFO, RECENT_INFO_KEY, rememberRecentInfo } from './recentProjectInfo';
import { createWorkTimer, WORK_IDLE_MS, WORK_TICK_MS } from './workTimer';

describe('contador de tiempo de trabajo', () => {
  function setup(foreground = true) {
    let now = 1_000_000;
    let visible = foreground;
    let total = 0;
    const timer = createWorkTimer({ now: () => now, isForeground: () => visible, onSeconds: (s) => { total += s; } });
    return {
      timer,
      advance: (ms: number) => { now += ms; },
      setVisible: (v: boolean) => { visible = v; },
      total: () => total,
    };
  }

  it('suma el tiempo entre revisiones mientras hay actividad en primer plano', () => {
    const c = setup();
    for (let i = 0; i < 4; i++) { c.advance(WORK_TICK_MS); c.timer.activity(); c.timer.tick(); }
    expect(c.total()).toBe(60);
  });

  it('se detiene tras 2 minutos sin actividad y reanuda con la siguiente', () => {
    const c = setup();
    c.advance(WORK_TICK_MS); c.timer.tick();
    expect(c.total()).toBe(15);
    // Sin actividad: pasa el umbral y deja de contar.
    for (let i = 0; i < 20; i++) { c.advance(WORK_TICK_MS); c.timer.tick(); }
    const stopped = c.total();
    expect(stopped).toBeLessThanOrEqual(15 + WORK_IDLE_MS / 1000);
    c.advance(WORK_TICK_MS); c.timer.tick();
    expect(c.total()).toBe(stopped);
    c.timer.activity();
    c.advance(WORK_TICK_MS); c.timer.tick();
    expect(c.total()).toBe(stopped + 15);
  });

  it('no cuenta en segundo plano ni sin foco', () => {
    const c = setup(false);
    for (let i = 0; i < 4; i++) { c.advance(WORK_TICK_MS); c.timer.activity(); c.timer.tick(); }
    expect(c.total()).toBe(0);
    c.setVisible(true);
    c.advance(WORK_TICK_MS); c.timer.activity(); c.timer.tick();
    expect(c.total()).toBe(15);
  });

  it('una suspensión larga del equipo no se cuenta entera', () => {
    const c = setup();
    c.advance(3 * 3600_000); c.timer.activity(); c.timer.tick();
    expect(c.total()).toBe(30);
  });

  it('el reloj hacia atrás no resta tiempo', () => {
    const c = setup();
    c.advance(-60_000); c.timer.activity(); c.timer.tick();
    expect(c.total()).toBe(0);
  });
});

describe('formato de fechas y duraciones', () => {
  const now = Date.parse('2026-11-26T12:00:00Z');

  it('relativa en español e inglés, sin futuro', () => {
    expect(formatRelative('2026-11-23T12:00:00Z', 'es', now)).toBe('hace 3 días');
    expect(formatRelative('2026-11-23T12:00:00Z', 'en', now)).toBe('3 days ago');
    expect(formatRelative('2026-11-26T09:00:00Z', 'es', now)).toBe('hace 3 horas');
    expect(formatRelative('2026-11-26T11:59:30Z', 'en', now)).toBe('this minute');
    expect(formatRelative('2026-12-30T00:00:00Z', 'en', now)).toBe('this minute');
    expect(formatRelative('2024-11-26T12:00:00Z', 'en', now)).toBe('2 years ago');
  });

  it('une la relativa y la absoluta', () => {
    const text = formatInfoDate('2026-11-23T12:00:00Z', 'es', now);
    expect(text).toMatch(/^hace 3 días · .*2026/);
  });

  it('duración humana', () => {
    expect(formatWorkSeconds(0, 'es')).toBe('Menos de 1 min');
    expect(formatWorkSeconds(59, 'es')).toBe('Menos de 1 min');
    expect(formatWorkSeconds(45 * 60, 'es')).toBe('45 min');
    expect(formatWorkSeconds(3 * 3600, 'es')).toBe('3 h');
    expect(formatWorkSeconds(2 * 3600 + 15 * 60 + 59, 'es')).toBe('2 h 15 min');
    expect(formatWorkSeconds(2 * 3600 + 15 * 60, 'en')).toBe('2 h 15 min');
    expect(formatWorkSeconds(-5, 'en')).toBe('Under 1 min');
  });
});

describe('memoria de descripción y fecha de recientes', () => {
  const store = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, v); },
      removeItem: (k: string) => { data.delete(k); },
      raw: () => data.get(RECENT_INFO_KEY),
    };
  };

  it('guarda solo descripción corta y fecha, por nombre, la más reciente primero', () => {
    const s = store();
    rememberRecentInfo('A.kura', { description: 'Una', modifiedAt: '2026-11-23T14:05:00Z' }, s);
    rememberRecentInfo('B.kura', { description: 'Dos' }, s);
    rememberRecentInfo('A.kura', { description: 'Una v2', modifiedAt: '2026-11-24T10:00:00Z' }, s);
    expect(Object.keys(loadRecentInfo(s))).toEqual(['A.kura', 'B.kura']);
    expect(loadRecentInfo(s)['A.kura']).toEqual({ description: 'Una v2', modifiedAt: '2026-11-24T10:00:00Z' });
    expect(s.raw()).not.toContain('notes');
  });

  it('acota la descripción, la cantidad de entradas y descarta fechas inválidas', () => {
    const s = store();
    rememberRecentInfo('L.kura', { description: 'x'.repeat(1000), modifiedAt: 'ayer' }, s);
    expect(loadRecentInfo(s)['L.kura']).toEqual({ description: 'x'.repeat(140) });
    for (let i = 0; i < MAX_RECENT_INFO + 10; i++) rememberRecentInfo(`P${i}.kura`, { description: `d${i}` }, s);
    expect(Object.keys(loadRecentInfo(s))).toHaveLength(MAX_RECENT_INFO);
    expect(loadRecentInfo(s)[`P${MAX_RECENT_INFO + 9}.kura`]).toBeDefined();
  });

  it('sin descripción ni fecha borra la entrada y no guarda nombres vacíos', () => {
    const s = store();
    rememberRecentInfo('A.kura', { description: 'Una' }, s);
    rememberRecentInfo('A.kura', {}, s);
    rememberRecentInfo('   ', { description: 'x' }, s);
    expect(loadRecentInfo(s)).toEqual({});
  });

  it('tolera datos dañados o hostiles en el almacenamiento', () => {
    for (const raw of ['no es json', '{"a":1}', '[[1,2]]', '[["A.kura", null]]', `[["${'n'.repeat(500)}", {"description":"x"}]]`, 'null']) {
      const s = store();
      s.setItem(RECENT_INFO_KEY, raw);
      expect(loadRecentInfo(s)).toEqual({});
    }
    const s = store();
    s.setItem(RECENT_INFO_KEY, JSON.stringify([['A.kura', { description: 'a\u0000b\nc', modifiedAt: '1970-01-01T00:00:00Z' }]]));
    expect(loadRecentInfo(s)).toEqual({ 'A.kura': { description: 'ab c' } });
    clearRecentInfo(s);
    expect(s.raw()).toBeUndefined();
  });
});
