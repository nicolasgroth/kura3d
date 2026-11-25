/**
 * @file src/i18n/translations.test.ts
 * @description Verifica la paridad estricta 1:1 de claves, ausencia de cadenas vacías,
 * paridad exacta de placeholders `{variable}` e interpolación en los 6 idiomas de Kurra3D Studio v0.5.0
 * (`es`, `en`, `de`, `fr`, `hi`, `zh`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRINTER_PROFILES,
  MATERIAL_PRESETS,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
  type MaterialPresetId,
} from '../types/kura';
import { getLocalizedMaterialName, getLocalizedPrinterName, t, type TranslationKey } from './index';
import {
  TRANSLATIONS,
  TRANSLATIONS_DE,
  TRANSLATIONS_EN,
  TRANSLATIONS_ES,
  TRANSLATIONS_FR,
  TRANSLATIONS_HI,
  TRANSLATIONS_ZH,
} from './translations';

/** Extrae y ordena todos los placeholders `{var}` de una cadena traducible. */
function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\{[a-zA-Z0-9_]+\}/g);
  return matches ? [...matches].sort() : [];
}

describe('Sistema i18n multilingüe de Kurra3D Studio v0.5.0 (6 idiomas)', () => {
  const localeEntries: Array<[LanguageCode, Record<TranslationKey, string>]> = [
    ['es', TRANSLATIONS_ES],
    ['en', TRANSLATIONS_EN],
    ['de', TRANSLATIONS_DE],
    ['fr', TRANSLATIONS_FR],
    ['hi', TRANSLATIONS_HI],
    ['zh', TRANSLATIONS_ZH],
  ];

  it('registra exactamente los 6 idiomas oficiales en SUPPORTED_LANGUAGES y TRANSLATIONS', () => {
    const supportedCodes = SUPPORTED_LANGUAGES.map((spec) => spec.code).sort();
    const dictionaryCodes = Object.keys(TRANSLATIONS).sort();
    expect(supportedCodes).toEqual(['de', 'en', 'es', 'fr', 'hi', 'zh']);
    expect(dictionaryCodes).toEqual(supportedCodes);
  });

  it('mantiene paridad exacta del 100 % de claves no vacías en los 6 idiomas', () => {
    const masterKeys = Object.keys(TRANSLATIONS_ES).sort() as TranslationKey[];
    expect(masterKeys.length).toBeGreaterThan(450);

    for (const [lang, dict] of localeEntries) {
      const langKeys = Object.keys(dict).sort();
      expect(langKeys, `Claves de ${lang} no coinciden con es`).toEqual(masterKeys);

      for (const key of masterKeys) {
        const value = dict[key];
        expect(typeof value).toBe('string');
        expect(value.trim().length, `Valor vacío en ${lang}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('mantiene paridad exacta de placeholders {variable} en los 6 idiomas', () => {
    const masterKeys = Object.keys(TRANSLATIONS_ES) as TranslationKey[];

    for (const key of masterKeys) {
      const expectedPlaceholders = extractPlaceholders(TRANSLATIONS_ES[key]);

      for (const [lang, dict] of localeEntries) {
        const actualPlaceholders = extractPlaceholders(dict[key]);
        expect(
          actualPlaceholders,
          `Placeholders distintos en ${lang}.${key}: esperado ${expectedPlaceholders.join(', ')}, obtenido ${actualPlaceholders.join(', ')}`,
        ).toEqual(expectedPlaceholders);
      }
    }
  });

  it('incluye todas las claves nuevas de v0.5.0 (temas, splash, idioma y título)', () => {
    const v050Keys: TranslationKey[] = [
      'app.docTitle',
      'dialog.settings.tab.appearance',
      'dialog.settings.themesTitle',
      'dialog.settings.themesHint',
      'dialog.settings.themeDefaultBadge',
      'dialog.settings.themeActiveBadge',
      'dialog.settings.themePreviewBadge',
      'theme.obsidian.name',
      'theme.obsidian.desc',
      'theme.kura_prism.name',
      'theme.kura_prism.desc',
      'theme.studio_pro.name',
      'theme.studio_pro.desc',
      'theme.nordic_frost.name',
      'theme.nordic_frost.desc',
      'theme.solar_amber.name',
      'theme.solar_amber.desc',
      'theme.high_contrast.name',
      'theme.high_contrast.desc',
      'splash.subtitle',
      'splash.loadingEngine',
      'splash.ready',
      'splash.skip',
      'topbar.languageSelect',
      'topbar.themesShortcut',
      'dialog.settings.brandVariants',
      'palette.cmd.appearance',
      'toast.themeApplied',
    ];

    for (const [lang] of localeEntries) {
      expect(t(lang, 'app.docTitle')).toContain('v0.5.0');
      for (const key of v050Keys) {
        expect(t(lang, key).trim().length).toBeGreaterThan(0);
      }
      expect(t(lang, 'toast.themeApplied', { name: 'Kura Prism' })).toContain('Kura Prism');
    }
  });

  it('interpola parámetros dinámicos correctamente en todos los idiomas', () => {
    expect(t('es', 'sidebar.scene.objectsCount', { count: 4 })).toBe('4 objetos');
    expect(t('en', 'sidebar.scene.objectsCount', { count: 4 })).toBe('4 objects');
    expect(t('de', 'sidebar.scene.objectsCount', { count: 4 })).toBe('4 Objekte');
    expect(t('fr', 'sidebar.scene.objectsCount', { count: 4 })).toBe('4 objets');
    expect(t('hi', 'sidebar.scene.objectsCount', { count: 4 })).toBe('4 वस्तुएं');
    expect(t('zh', 'sidebar.scene.objectsCount', { count: 4 })).toBe('4 个对象');
  });

  it('localiza nombres de impresoras genéricas y materiales PBR en los 6 idiomas', () => {
    const generic220 = DEFAULT_PRINTER_PROFILES.find((p) => p.id === 'generic-220')!;
    const freeStudio = DEFAULT_PRINTER_PROFILES.find((p) => p.id === 'free-studio')!;
    const materialIds = Object.keys(MATERIAL_PRESETS) as MaterialPresetId[];

    for (const [lang] of localeEntries) {
      expect(getLocalizedPrinterName(lang, generic220)).toBe(t(lang, 'printer.generic-220'));
      expect(getLocalizedPrinterName(lang, freeStudio)).toBe(t(lang, 'printer.free-studio'));

      for (const matId of materialIds) {
        const localized = getLocalizedMaterialName(lang, matId);
        expect(localized.trim().length).toBeGreaterThan(0);
        expect(localized).not.toBe(matId);
      }
    }
  });
});
