/**
 * @file src/i18n/panelTitles.test.ts
 * @description Los títulos de panel son cortos en los 6 idiomas: a 1024 px el panel mide ~303 px y, descontado «Volver»,
 * quedan ~210 px para el título (unos 28 caracteres a 13 px). Más largo se parte en dos líneas o se corta, así que
 * el detalle va en la descripción del panel, no en el título.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { t, type TranslationKey } from './index';
import type { LanguageCode } from '../types/kura';

/** Máximo de caracteres de un título de panel (medido con el panel de 303 px a 1024 px). */
export const MAX_PANEL_TITLE = 28;

const LANGS: LanguageCode[] = ['es', 'en', 'de', 'fr', 'zh', 'hi'];

/** Claves de los títulos de los paneles de operación y de acción. */
const TITLE_KEYS = [
  'dialog.img.title', 'dialog.mold.title', 'dialog.project.title', 'dialog.thread.title', 'dialog.cut.title',
  'split.title', 'r3a.text.panel', 'magnet.title', 'turret.title', 'asis.title', 'plates.action.arrange',
  'fitCheck.ui.title', 'orient.ui.title', 'measure.title',
  'panel.title.hollow', 'panel.title.simplify', 'panel.title.refine', 'panel.title.smooth', 'panel.title.texture',
  'panel.title.modules', 'panel.title.validate', 'panel.title.detect',
] as const;

describe('títulos de panel', () => {
  for (const lang of LANGS) {
    it(`ningún título supera ${MAX_PANEL_TITLE} caracteres en ${lang}`, () => {
      const largos = TITLE_KEYS.map((k) => [k, t(lang, k as TranslationKey)] as const).filter(([, v]) => v.length > MAX_PANEL_TITLE);
      expect(largos).toEqual([]);
    });
  }
});
