/**
 * @file e2e/qa19-barra-lateral.spec.ts
 * @description QA19: la barra lateral recorre completa, compacta y oculta con el tirador, el menú contextual y el teclado;
 * los botones compactos tienen nombre y crean piezas; la elección persiste y el modo Zen no la cambia.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

test.use({ viewport: { width: 1280, height: 720 } });

const CLAVE = 'kura3d-left-sidebar';
const guardado = (page: Page) => page.evaluate((k) => localStorage.getItem(k), CLAVE);
const tirador = (page: Page) => page.getByRole('button', { name: /^Barra lateral/ }).first();

test('barra lateral: tres estados por tirador, menú y teclado; compacta funcional; Zen no la toca; persiste', async ({ page }) => {
  await abrir(page);
  await page.evaluate((k) => localStorage.removeItem(k), CLAVE);
  await page.reload();
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  await page.evaluate(async () => { (window as any).__s = (await import('/src/store/useKuraStore.ts')).useKuraStore; });

  await expect(tirador(page)).toHaveAttribute('title', /completa/i);
  await tirador(page).click();
  await expect.poll(() => guardado(page)).toBe('compact');
  await tirador(page).click();
  await expect.poll(() => guardado(page)).toBe('hidden');
  await tirador(page).click();
  await expect.poll(() => guardado(page)).toBeNull();

  // Menú contextual con clic derecho y con teclado.
  await tirador(page).click({ button: 'right' });
  await page.getByRole('menuitemradio', { name: /compacta/i }).click();
  await expect.poll(() => guardado(page)).toBe('compact');
  await tirador(page).focus();
  await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('menuitemradio', { name: /compacta/i })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');

  // En compacto: todos los botones del riel tienen nombre y tooltip, y crear una forma funciona.
  const botones = await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((b) => { const r = b.getBoundingClientRect(); return r.left < 56 && r.top > 90 && r.top < 690 && r.width > 0; })
      .map((b) => ({ n: b.getAttribute('aria-label') || b.textContent?.trim(), t: b.title })),
  );
  expect(botones.length).toBeGreaterThanOrEqual(12);
  for (const b of botones) { expect(b.n, 'nombre accesible').toBeTruthy(); expect(b.t, 'tooltip de ' + b.n).toBeTruthy(); }
  for (const forma of ['Cubo', 'Esfera', 'Cono', 'Prisma']) await page.getByRole('button', { name: forma, exact: true }).first().click();
  expect(await page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(4);

  // Persistencia al recargar y modo Zen sin tocar la elección.
  await page.reload();
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  expect(await guardado(page)).toBe('compact');
  await page.keyboard.press('Control+Shift+Enter');
  await expect(page.locator('.kura-app')).toHaveAttribute('data-density', 'zen');
  expect(await guardado(page)).toBe('compact');
  await page.keyboard.press(
'Control+Shift+Enter');
  await expect(page.locator('.kura-app')).not.toHaveAttribute('data-density', 'zen');
  expect(await guardado(page)).toBe('compact');
});
