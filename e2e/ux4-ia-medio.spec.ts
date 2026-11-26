/**
 * @file e2e/ux4-ia-medio.spec.ts
 * @description Panel de IA entre 901 y 1240 px: abre como superposición en la columna derecha con pestañas
 * «Inspector | Asistente» (la activa con aria-selected y subrayado), el inspector sigue accesible, el visor no cambia
 * de tamaño y la conversación se conserva al ir y volver. Por encima de 1240 px no hay pestañas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, crear, SHOTS } from './ux4-helpers';

const lienzo = (page: Page) =>
  page.evaluate(() => {
    const r = document.querySelector('canvas')!.getBoundingClientRect();
    return [Math.round(r.width), Math.round(r.height)];
  });

for (const [ancho, alto, esquema] of [[1024, 768, 'light'], [1024, 768, 'dark'], [901, 700, 'light'], [1240, 800, 'dark']] as const) {
  test(`pestañas Inspector | Asistente a ${ancho} px (${esquema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: esquema });
    const errs = await abrir(page, ancho, alto);
    const id = await crear(page, 'box', { width: 40, height: 40, depth: 40 }, [0, 20, 0]);
    await page.evaluate((x) => (window as any).__s.getState().setSelection([x]), id);
    await page.waitForTimeout(600);
    const antes = await lienzo(page);

    await page.evaluate(() => (window as any).__s.getState().setAiDrawerOpen(true));
    const tablist = page.getByRole('tablist', { name: 'Panel derecho' });
    await expect(tablist).toBeVisible();
    const tabAsistente = tablist.getByRole('tab', { name: 'Asistente' });
    const tabInspector = tablist.getByRole('tab', { name: 'Inspector' });
    await expect(tabAsistente).toHaveAttribute('aria-selected', 'true');
    await expect(tabInspector).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('.kura-ai-drawer')).toBeVisible();
    expect(await lienzo(page)).toEqual(antes);
    await page.screenshot({ path: `${SHOTS}/3-asistente-${ancho}-${esquema}.png` });

    // El chat conserva lo escrito al ir al inspector y volver.
    const campo = page.locator('.kura-ai-drawer input[type="text"], .kura-ai-drawer .kura-chat-form input').first();
    await page.evaluate(() => (window as any).__s.getState().addAiMessage({ role: 'user', content: 'mensaje de prueba ux4' }));
    await tabInspector.click();
    await expect(tabInspector).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.kura-ai-drawer')).toBeHidden();
    const insp = page.getByRole('complementary', { name: 'Inspector' });
    await expect(insp).toBeVisible();
    await expect(insp.getByText(/Transformación/).first()).toBeVisible();
    // Las pestañas no tapan el contenido del inspector.
    const t = await tablist.boundingBox();
    const primero = await insp.locator('.kura-card, h3, h2').first().boundingBox();
    expect(primero!.y).toBeGreaterThanOrEqual(t!.y + t!.height - 1);
    expect(await lienzo(page)).toEqual(antes);
    await page.screenshot({ path: `${SHOTS}/3-inspector-${ancho}-${esquema}.png` });

    // Teclado: flecha derecha pasa al asistente.
    await tabInspector.focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabAsistente).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.kura-ai-drawer')).toBeVisible();
    await expect(page.locator('.kura-chat-bubble', { hasText: 'mensaje de prueba ux4' })).toBeVisible();
    void campo;

    // Cerrar con la X vuelve al inspector solo.
    await page.locator('.kura-ai-drawer').getByRole('button', { name: /Cerrar/ }).click();
    await expect(page.locator('.kura-ai-drawer')).toHaveCount(0);
    await expect(tablist).toHaveCount(0);
    await expect(insp).toBeVisible();
    expect(await lienzo(page)).toEqual(antes);
    expect(errs).toEqual([]);
  });
}

test('sobre 1240 px no hay pestañas (el chat va junto al inspector)', async ({ page }) => {
  const errs = await abrir(page, 1440, 900);
  await page.evaluate(() => (window as any).__s.getState().setAiDrawerOpen(true));
  await expect(page.locator('.kura-ai-drawer')).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Panel derecho' })).toBeHidden();
  expect(errs).toEqual([]);
});
