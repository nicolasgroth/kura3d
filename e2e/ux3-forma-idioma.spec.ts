/**
 * @file e2e/ux3-forma-idioma.spec.ts
 * @description Idioma inicial: sin preferencia guardada se elige con `navigator.languages` entre los 6 idiomas
 * (español si ninguno coincide); la preferencia guardada manda siempre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Browser } from '@playwright/test';

const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5224/';

async function idiomaInicial(browser: Browser, locale: string, guardado?: string): Promise<string> {
  const ctx = await browser.newContext({ locale });
  const page = await ctx.newPage();
  if (guardado) await page.addInitScript((l) => localStorage.setItem('kura3d-language', l), guardado);
  await page.goto(URL);
  await page.locator('.kura-app').waitFor({ timeout: 60000 });
  const lang = await page.evaluate(async () => (await import('/src/store/useKuraStore.ts')).useKuraStore.getState().language);
  await ctx.close();
  return lang;
}

test('sin preferencia guardada sigue el idioma del navegador', async ({ browser }) => {
  expect(await idiomaInicial(browser, 'en-US')).toBe('en');
  expect(await idiomaInicial(browser, 'de-DE')).toBe('de');
  expect(await idiomaInicial(browser, 'fr-CA')).toBe('fr');
  expect(await idiomaInicial(browser, 'zh-CN')).toBe('zh');
  expect(await idiomaInicial(browser, 'es-CL')).toBe('es');
  // Ningún idioma disponible: español.
  expect(await idiomaInicial(browser, 'pt-BR')).toBe('es');
});

test('la preferencia guardada manda sobre el navegador', async ({ browser }) => {
  expect(await idiomaInicial(browser, 'en-US', 'de')).toBe('de');
  expect(await idiomaInicial(browser, 'de-DE', 'es')).toBe('es');
});
