/**
 * @file src/components/shell/controlHelp.ts
 * @description Registro único de ayuda de los controles de las barras: `id → { nombre, descripción, atajo }`
 * (claves de i18n). Lo usan a la vez el tooltip propio (`HelpTooltipLayer`) y la línea de ayuda de la barra
 * de estado, así ambos dicen lo mismo. Un control se registra con `helpAttrs(id)` (`data-help` y
 * `aria-keyshortcuts`); su nombre accesible sigue siendo su `aria-label`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t, type TranslationKey } from '../../i18n';
import type { LanguageCode } from '../../types/kura';

/** Tecla modificadora tal como se ve en este sistema. */
export const MOD_LABEL = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform ?? '') ? '⌘' : 'Ctrl';

interface ControlHelpDef {
  name: TranslationKey;
  desc: TranslationKey;
  /** Atajo visible (con `Mod` para Ctrl/⌘). */
  shortcut?: string;
  /** Atajo para `aria-keyshortcuts`. */
  keys?: string;
  /** Rótulo visible corto cuando el nombre no cabe en una línea (debe ser parte del nombre accesible). */
  label?: TranslationKey;
}

export const CONTROL_HELP = {
  'tool.select': { name: 'topbar.tool.select', desc: 'rediseno.help.select', shortcut: 'V', keys: 'V' },
  'tool.move': { name: 'rediseno.tool.move', desc: 'rediseno.help.move', shortcut: 'M', keys: 'M' },
  'tool.rotate': { name: 'rediseno.tool.rotate', desc: 'rediseno.help.rotate', shortcut: 'R', keys: 'R' },
  'tool.scale': { name: 'rediseno.tool.scale', desc: 'rediseno.help.scale', shortcut: 'S', keys: 'S' },
  'tool.paint': { name: 'topbar.tool.paint', desc: 'rediseno.help.paint', shortcut: 'P', keys: 'P' },
  'tool.cut': { name: 'topbar.tool.cut', desc: 'rediseno.help.cut', shortcut: 'C', keys: 'C' },
  'tool.erase': { name: 'topbar.tool.erase', desc: 'rediseno.help.erase', label: 'rediseno.tool.eraseShort' },
  'tool.measure': { name: 'topbar.tool.measure', desc: 'rediseno.help.measure', shortcut: 'D', keys: 'D' },
  'tool.add': { name: 'r3a.add.button', desc: 'r3a.add.help' },
  'view.iso': { name: 'viewcube.view.iso', desc: 'rediseno.help.viewIso', shortcut: '3', keys: '3' },
  'view.top': { name: 'viewcube.view.top', desc: 'rediseno.help.viewTop', shortcut: '7', keys: '7' },
  'view.front': { name: 'viewcube.view.front', desc: 'rediseno.help.viewFront', shortcut: '1', keys: '1' },
  'view.right': { name: 'viewcube.view.right', desc: 'rediseno.help.viewRight', shortcut: '2', keys: '2' },
  'view.views': { name: 'rediseno.view.views', desc: 'rediseno.help.views' },
  'view.fit': { name: 'rediseno.view.fit', desc: 'rediseno.help.fit', shortcut: 'F', keys: 'F' },
  'view.bed': { name: 'ux6.bed.toggle', desc: 'rediseno.help.bed', shortcut: 'B', keys: 'B' },
  'view.xray': { name: 'viewport.section.toggle', desc: 'rediseno.help.xray', shortcut: 'X', keys: 'X' },
  'view.snap': { name: 'rediseno.view.snap', desc: 'rediseno.help.snap' },
  'top.importOptions': { name: 'import.menu', desc: 'rediseno.help.importOptions' },
  'top.import': { name: 'topbar.importModel', desc: 'rediseno.help.import' },
  'top.project': { name: 'fileProject.menu', desc: 'r3a.help.project' },
  'top.insert': { name: 'r3a.insert.menu', desc: 'r3a.insert.help' },
  'top.export': { name: 'topbar.export', desc: 'rediseno.help.export' },
  'top.undo': { name: 'topbar.undo', desc: 'rediseno.help.undo', shortcut: 'Mod+Z', keys: 'Control+Z' },
  'top.redo': { name: 'topbar.redo', desc: 'rediseno.help.redo', shortcut: 'Mod+Y', keys: 'Control+Y' },
  'top.history': { name: 'rediseno.history.button', desc: 'rediseno.help.history' },
  'top.actions': { name: 'rediseno.actions.menu', desc: 'rediseno.help.actions' },
  'top.palette': { name: 'topbar.cmdPalette', desc: 'rediseno.help.palette', shortcut: 'Mod+K', keys: 'Control+K' },
  'top.language': { name: 'topbar.languageSelect', desc: 'rediseno.help.language' },
  'top.theme': { name: 'topbar.themeToggle', desc: 'rediseno.help.theme' },
  'top.themes': { name: 'topbar.themesShortcut', desc: 'rediseno.help.themes' },
  'top.labels': { name: 'rediseno.labels.toggle', desc: 'rediseno.help.labels' },
  'top.zen': { name: 'rediseno.zen', desc: 'rediseno.help.zen', shortcut: 'Mod+Shift+Enter', keys: 'Control+Shift+Enter' },
  'top.mcp': { name: 'rediseno.top.mcp', desc: 'rediseno.help.mcp' },
  'top.ai': { name: 'topbar.aiChat', desc: 'rediseno.help.ai' },
  'top.settings': { name: 'topbar.settings', desc: 'rediseno.help.settings', shortcut: 'Mod+,', keys: 'Control+,' },
  'project.new': { name: 'fileProject.new', desc: 'rediseno.help.project', shortcut: 'Mod+N', keys: 'Control+N' },
  'project.open': { name: 'fileProject.open', desc: 'rediseno.help.project', shortcut: 'Mod+O', keys: 'Control+O' },
  'project.save': { name: 'fileProject.save', desc: 'rediseno.help.project', shortcut: 'Mod+S', keys: 'Control+S' },
  'project.saveAs': { name: 'fileProject.saveAs', desc: 'rediseno.help.project', shortcut: 'Mod+Shift+S', keys: 'Control+Shift+S' },
  'project.rename': { name: 'r3a.name.edit', desc: 'r3a.name.hint', shortcut: 'F2', keys: 'F2' },
  'project.bed': { name: 'r3a.bed.edit', desc: 'dialog.settings.printerHelp' },
  'project.units': { name: 'r3a.units.edit', desc: 'dialog.settings.unitHelp' },
  'left.toggle': { name: 'r3a.sidebar.label', desc: 'r3a.sidebar.tip' },
  'panel.resize': { name: 'panel.resize', desc: 'panel.help.resize' },
  'panel.collapse': { name: 'ui.panel.collapseRight', desc: 'panel.help.collapse' },
  'panel.back': { name: 'panel.action.back', desc: 'panel.help.back', shortcut: 'Esc', keys: 'Escape' },
  'fitCheck.clearance': { name: 'fitCheck.ui.clearance', desc: 'fitCheck.help.clearance' },
  'fitCheck.applyNegatives': { name: 'fitCheck.ui.applyNegatives', desc: 'fitCheck.help.applyNegatives' },
  'fitCheck.run': { name: 'fitCheck.ui.run', desc: 'fitCheck.help.run' },
  'fitCheck.cancel': { name: 'fitCheck.ui.cancel', desc: 'fitCheck.help.cancel' },
  'fitCheck.pair': { name: 'fitCheck.ui.list', desc: 'fitCheck.help.pair', shortcut: 'Enter', keys: 'Enter' },
  'orient.option': { name: 'orient.ui.list', desc: 'orient.help.option', shortcut: 'Enter', keys: 'Enter' },
  'orient.angle': { name: 'orient.ui.angle', desc: 'orient.help.angle' },
  'orient.keepXY': { name: 'orient.ui.keepPosition', desc: 'orient.help.keepPosition' },
  'orient.apply': { name: 'orient.ui.apply', desc: 'orient.help.apply', shortcut: 'Enter', keys: 'Enter' },
  'orient.cancel': { name: 'orient.ui.cancel', desc: 'orient.help.cancel' },
} as const satisfies Record<string, ControlHelpDef>;

export type HelpId = keyof typeof CONTROL_HELP;

export function isHelpId(id: string | undefined | null): id is HelpId {
  return Boolean(id) && Object.prototype.hasOwnProperty.call(CONTROL_HELP, id as string);
}

export interface HelpText {
  name: string;
  desc: string;
  shortcut?: string;
}

/** Textos de ayuda de un control en el idioma pedido. */
export function helpText(language: LanguageCode, id: HelpId): HelpText {
  const def: ControlHelpDef = CONTROL_HELP[id];
  return {
    name: t(language, def.name),
    desc: t(language, def.desc),
    ...(def.shortcut ? { shortcut: def.shortcut.replace('Mod', MOD_LABEL) } : {}),
  };
}

/** Rótulo visible del control: el corto si lo tiene, si no el nombre. */
export function helpLabel(language: LanguageCode, id: HelpId): string {
  const def: ControlHelpDef = CONTROL_HELP[id];
  return t(language, def.label ?? def.name);
}

/** Línea de la barra de estado: «Nombre — qué hace · Atajo: X». */
export function helpLine(language: LanguageCode, id: HelpId): string {
  const help = helpText(language, id);
  const keys = help.shortcut ? ` · ${t(language, 'rediseno.status.shortcut', { keys: help.shortcut })}` : '';
  return `${help.name} — ${help.desc}${keys}`;
}

/**
 * Atributos que registran un control en la ayuda (tooltip y barra de estado). Incluye un `title` corto
 * («Nombre (atajo)») como respaldo; el tooltip propio lo guarda mientras está a la vista para no duplicarlo.
 */
export function helpAttrs(id: HelpId, language: LanguageCode): { 'data-help': HelpId; 'aria-keyshortcuts'?: string; title: string } {
  const def: ControlHelpDef = CONTROL_HELP[id];
  const help = helpText(language, id);
  const title = help.shortcut ? `${help.name} (${help.shortcut})` : help.name;
  return def.keys ? { 'data-help': id, 'aria-keyshortcuts': def.keys, title } : { 'data-help': id, title };
}
