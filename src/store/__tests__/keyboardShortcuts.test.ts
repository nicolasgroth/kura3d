/**
 * @file src/store/__tests__/keyboardShortcuts.test.ts
 * @description Pruebas de comportamiento de la tabla de atajos (`resolveShortcut`): cada atajo documentado en el
 * modal de Atajos y en `ACTION_SHORTCUTS` resuelve a su acción; los de una letra que abren paneles anulan el
 * carácter; en un campo de texto no se disparan; con un diálogo abierto se respetan las reglas vigentes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { ACTION_SHORTCUTS } from '../actionsCatalog';
import { resolveShortcut, type ShortcutAction, type ShortcutContext, type ShortcutEvent } from '../keyboardShortcuts';
import { SINGLE_KEY_SHORTCUTS } from '../singleKeyShortcuts';

const ctx = (over: Partial<ShortcutContext> = {}): ShortcutContext => ({
  dialogOpen: false, commandPaletteOpen: false, modalOpen: false, typingTarget: false, zen: false,
  inGroup: false, hasGroups: false, selectedCount: 1, objectCount: 2, ...over,
});
const ev = (key: string, over: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
  key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, ...over,
});
const ctrl = (key: string, over: Partial<ShortcutEvent> = {}) => ev(key, { ctrlKey: true, ...over });
const action = (e: ShortcutEvent, c = ctx()): ShortcutAction | null => resolveShortcut(e, c).action;

describe('atajos documentados', () => {
  const cases: Array<[string, ShortcutEvent, ShortcutAction]> = [
    ['M', ev('m'), { type: 'transformTool', mode: 'translate', opensInspector: true }],
    ['R', ev('r'), { type: 'transformTool', mode: 'rotate', opensInspector: true }],
    ['S', ev('s'), { type: 'transformTool', mode: 'scale', opensInspector: true }],
    ['V', ev('v'), { type: 'selectTool' }],
    ['1', ev('1'), { type: 'cameraPreset', preset: 'front' }],
    ['2', ev('2'), { type: 'cameraPreset', preset: 'right' }],
    ['3', ev('3'), { type: 'cameraPreset', preset: 'iso' }],
    ['7', ev('7'), { type: 'cameraPreset', preset: 'top' }],
    ['F', ev('f'), { type: 'cameraPreset', preset: 'fit' }],
    ['B', ev('b'), { type: 'toggleBed' }],
    ['A', ev('a'), { type: 'cycleViewMode' }],
    ['Ctrl+Shift+Enter', ctrl('Enter', { shiftKey: true }), { type: 'toggleZen' }],
    ['Ctrl+G', ctrl('g'), { type: 'group' }],
    ['Ctrl+Shift+G', ctrl('G', { shiftKey: true }), { type: 'ungroup' }],
    ['Cmd+G', ev('g', { metaKey: true }), { type: 'group' }],
    ['Ctrl+Shift+U', ctrl('U', { shiftKey: true }), { type: 'applyHolesOrUnion' }],
    ['Shift+M', ev('M', { shiftKey: true }), { type: 'openDialog', dialog: 'mold' }],
    ['X', ev('x'), { type: 'toggleSection' }],
    ['P', ev('p'), { type: 'togglePaint' }],
    ['D', ev('d'), { type: 'toggleMeasure' }],
    ['C', ev('c'), { type: 'openDialog', dialog: 'cut' }],
    ['Shift+C', ev('C', { shiftKey: true }), { type: 'openDialog', dialog: 'splitForBed' }],
    ['L', ev('l'), { type: 'dropToBed' }],
    ['H', ev('h'), { type: 'toggleRole' }],
    ['Shift+H', ev('H', { shiftKey: true }), { type: 'toggleSelectionVisibility' }],
    ['Ctrl+K', ctrl('k'), { type: 'togglePalette' }],
    ['Ctrl+Z', ctrl('z'), { type: 'undo' }],
    ['Ctrl+Shift+Z', ctrl('Z', { shiftKey: true }), { type: 'redo' }],
    ['Ctrl+Y', ctrl('y'), { type: 'redo' }],
    ['Ctrl+D', ctrl('d'), { type: 'duplicate' }],
    ['Shift+D', ev('D', { shiftKey: true }), { type: 'duplicate' }],
    ['Del', ev('Delete'), { type: 'deleteSelection' }],
    ['Backspace', ev('Backspace'), { type: 'deleteSelection' }],
    ['?', ev('?', { shiftKey: true }), { type: 'showShortcuts' }],
    ['F1', ev('F1'), { type: 'showShortcuts' }],
    ['Ctrl+S', ctrl('s'), { type: 'save', saveAs: false }],
    ['Ctrl+Shift+S', ctrl('S', { shiftKey: true }), { type: 'save', saveAs: true }],
    ['Ctrl+O', ctrl('o'), { type: 'open' }],
    ['Ctrl+N', ctrl('n'), { type: 'new' }],
    ['Ctrl+,', ctrl(','), { type: 'openSettings' }],
    ['Ctrl+A', ctrl('a'), { type: 'selectAll' }],
    ['Flecha izquierda', ev('ArrowLeft'), { type: 'nudge', key: 'left', scale: 'normal' }],
    ['Mayús+flecha', ev('ArrowUp', { shiftKey: true }), { type: 'nudge', key: 'up', scale: 'coarse' }],
    ['Ctrl+flecha', ctrl('ArrowDown'), { type: 'nudge', key: 'down', scale: 'fine' }],
    ['Alt+flecha', ev('ArrowRight', { altKey: true }), { type: 'nudge', key: 'right', scale: 'fine' }],
    ['PgUp', ev('PageUp'), { type: 'nudge', key: 'pageUp', scale: 'normal' }],
    ['PgDn', ev('PageDown'), { type: 'nudge', key: 'pageDown', scale: 'normal' }],
  ];
  it.each(cases)('%s resuelve a su acción', (_label, e, expected) => {
    const res = resolveShortcut(e, ctx());
    expect(res.action).toEqual(expected);
    expect(res.preventDefault).toBe(true);
  });

  it('los atajos de ACTION_SHORTCUTS siguen apuntando a la misma acción', () => {
    const expected: Record<string, ShortcutAction> = {
      splitForBed: { type: 'openDialog', dialog: 'splitForBed' },
      mold: { type: 'openDialog', dialog: 'mold' },
      group: { type: 'group' },
      ungroup: { type: 'ungroup' },
      applyHoles: { type: 'applyHolesOrUnion' },
      dropToBed: { type: 'dropToBed' },
    };
    expect(Object.keys(ACTION_SHORTCUTS).sort()).toEqual(Object.keys(expected).sort());
    for (const [id, def] of Object.entries(ACTION_SHORTCUTS)) {
      const parts = def!.keys.split('+');
      const letter = parts[parts.length - 1];
      const shiftKey = parts.includes('Shift');
      const e = ev(shiftKey ? letter.toUpperCase() : letter.toLowerCase(), { shiftKey, ctrlKey: parts.includes('Control') });
      expect(action(e), id).toEqual(expected[id]);
    }
  });
});

describe('anular el carácter', () => {
  it('toda tecla suelta de la lista que anula el defecto lo anula, haga o no algo', () => {
    for (const k of SINGLE_KEY_SHORTCUTS) {
      expect(resolveShortcut(ev(k), ctx()).preventDefault, k).toBe(true);
      expect(resolveShortcut(ev(k), ctx({ selectedCount: 0, objectCount: 0 })).preventDefault, `${k} sin objetos`).toBe(true);
    }
  });

  it('Mayús+C sin selección y Mayús+M sin objetos no abren nada pero anulan el carácter', () => {
    expect(resolveShortcut(ev('C', { shiftKey: true }), ctx({ selectedCount: 0 }))).toEqual({ action: null, preventDefault: true });
    expect(resolveShortcut(ev('M', { shiftKey: true }), ctx({ objectCount: 0 }))).toEqual({ action: null, preventDefault: true });
    expect(resolveShortcut(ev('c'), ctx({ objectCount: 0 }))).toEqual({ action: null, preventDefault: true });
  });

  it('Supr sin selección no hace nada ni anula; una tecla desconocida tampoco', () => {
    expect(resolveShortcut(ev('Delete'), ctx({ selectedCount: 0 }))).toEqual({ action: null, preventDefault: false });
    expect(resolveShortcut(ev('q'), ctx())).toEqual({ action: null, preventDefault: false });
  });

  it('Enter entra al grupo sin anular de antemano (lo decide el store)', () => {
    expect(resolveShortcut(ev('Enter'), ctx({ hasGroups: true, selectedCount: 2 }))).toEqual({ action: { type: 'enterGroup' }, preventDefault: false });
    // Con el foco en un botón, Enter es del botón (p. ej. «Convertir en placas» de un mensaje): no entra al grupo.
    expect(resolveShortcut(ev('Enter'), ctx({ hasGroups: true, selectedCount: 2, controlTarget: true })).action).toBeNull();
    expect(action(ev('Enter'), ctx({ hasGroups: true, selectedCount: 1 }))).toBeNull();
  });

  it('flechas sin selección y con varios objetos no hacen nada ni anulan la tecla', () => {
    expect(resolveShortcut(ev('ArrowLeft'), ctx({ selectedCount: 0, objectCount: 3 }))).toEqual({ action: null, preventDefault: false });
    expect(action(ev('ArrowLeft'), ctx({ selectedCount: 0, objectCount: 1 }))).toEqual({ type: 'nudge', key: 'left', scale: 'normal' });
  });

  it('repetir de tecla: guardar, agrupar, Zen y Ctrl+Mayús+U se anulan sin ejecutar otra vez', () => {
    for (const e of [ctrl('s', { repeat: true }), ctrl('g', { repeat: true }), ctrl('U', { shiftKey: true, repeat: true }), ctrl('Enter', { shiftKey: true, repeat: true })]) {
      expect(resolveShortcut(e, ctx())).toEqual({ action: null, preventDefault: true });
    }
  });

  it('M repetida no vuelve a pedir abrir el inspector; G y W solo cambian de herramienta', () => {
    expect(action(ev('m', { repeat: true }))).toEqual({ type: 'transformTool', mode: 'translate', opensInspector: false });
    expect(action(ev('g'))).toEqual({ type: 'transformTool', mode: 'translate', opensInspector: false });
  });
});

describe('campo de texto y diálogos', () => {
  it('con el foco en un campo de texto no se dispara ningún atajo salvo guardar/abrir/nuevo', () => {
    const typing = ctx({ typingTarget: true });
    for (const e of [ev('h'), ev('l'), ev('Delete'), ev('1'), ctrl('z'), ctrl('a'), ctrl('k'), ev('ArrowLeft'), ev('?', { shiftKey: true })]) {
      expect(resolveShortcut(e, typing), e.key).toEqual({ action: null, preventDefault: false });
    }
    expect(action(ctrl('s'), typing)).toEqual({ type: 'save', saveAs: false });
  });

  it('con un diálogo modal nativo abierto no se dispara nada de la escena', () => {
    const modal = ctx({ modalOpen: true });
    for (const e of [ev('h'), ctrl('z'), ev('Delete'), ev('ArrowLeft'), ctrl('k')]) {
      expect(resolveShortcut(e, modal), e.key).toEqual({ action: null, preventDefault: false });
    }
  });

  it('con un diálogo de la aplicación abierto: Ctrl+S/N no hacen nada, Ctrl+K se anula sin abrir, Ctrl+, abre ajustes', () => {
    const open = ctx({ dialogOpen: true });
    expect(resolveShortcut(ctrl('s'), open)).toEqual({ action: null, preventDefault: false });
    expect(resolveShortcut(ctrl('n'), open)).toEqual({ action: null, preventDefault: false });
    expect(resolveShortcut(ctrl('k'), open)).toEqual({ action: null, preventDefault: true });
    expect(action(ctrl(','), open)).toEqual({ type: 'openSettings' });
    for (const e of [ev('h'), ctrl('z'), ev('Delete'), ev('Escape')]) {
      expect(resolveShortcut(e, open), e.key).toEqual({ action: null, preventDefault: false });
    }
  });

  it('con la paleta abierta tampoco se tocan la escena ni Ctrl+S; Ctrl+K la cierra', () => {
    const palette = ctx({ commandPaletteOpen: true });
    expect(resolveShortcut(ctrl('s'), palette).action).toBeNull();
    expect(resolveShortcut(ev('l'), palette).action).toBeNull();
    expect(action(ctrl('k'), palette)).toEqual({ type: 'togglePalette' });
  });

  it('Escape sale del grupo y, si no, del modo Zen', () => {
    expect(action(ev('Escape'), ctx({ inGroup: true, zen: true }))).toEqual({ type: 'exitGroup' });
    expect(action(ev('Escape'), ctx({ zen: true }))).toEqual({ type: 'toggleZen' });
    expect(action(ev('Escape'), ctx())).toBeNull();
    expect(action(ev('Escape', { ctrlKey: true }), ctx({ zen: true }))).toBeNull();
  });

  it('con Ctrl o Alt los atajos de una letra no se disparan', () => {
    expect(action(ev('l', { altKey: true }))).toBeNull();
    expect(action(ctrl('l'))).toBeNull();
    expect(action(ctrl('h'))).toBeNull();
  });
});
