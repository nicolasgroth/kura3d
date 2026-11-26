/**
 * @file e2e/asistentes-galeria.spec.ts
 * @description Recorrido de la galería de Asistentes y del deslizador del formulario (ESCRITO SIN EJECUTAR: lo corre QA).
 * Abre Insertar > Asistentes, comprueba miniaturas, filtro, búsqueda y teclado; abre la caja con tapa, mueve el
 * deslizador de «Ancho interior», escribe una expresión, elige cierre a presión para ver «Holgura de la tapa» y vuelve a
 * la galería conservando el filtro. Pensado para 1440 y 1024 px, tema claro y oscuro, consola sin errores.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './qa12-helpers';

async function abrirGaleria(page: Page) {
  await abrir(page);
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Asistentes/ }).click();
  await expect(page.getByRole('list', { name: 'Asistentes disponibles' })).toBeVisible();
}

for (const ancho of [1440, 1024]) {
  test.describe(`galería de asistentes a ${ancho} px`, () => {
    test.use({ viewport: { width: ancho, height: 800 } });

    test('miniaturas, filtro, búsqueda, teclado y volver conservando el filtro', async ({ page }) => {
      const errores: string[] = [];
      page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
      await abrirGaleria(page);
      const tarjetas = page.locator('.kura-asis-card');
      await expect(tarjetas).toHaveCount(3);
      // Las miniaturas se generan: al terminar cada tarjeta trae un SVG (o su icono de respaldo).
      await expect(page.locator('.kura-asis-card svg.kura-asis-thumb')).toHaveCount(3, { timeout: 60000 });
      // Sin desbordar horizontalmente.
      const panel = page.locator('.kura-asis-panel');
      expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

      await page.getByRole('button', { name: 'Hogar y electricidad' }).click();
      await expect(tarjetas).toHaveCount(1);
      await page.getByRole('button', { name: 'Todos' }).click();
      await page.getByRole('searchbox', { name: 'Buscar asistentes' }).fill('llavero');
      await expect(tarjetas).toHaveCount(1);
      await page.getByRole('searchbox').fill('');

      await tarjetas.first().focus();
      await page.keyboard.press('ArrowRight');
      await expect(tarjetas.nth(1)).toBeFocused();

      await page.getByRole('button', { name: 'Cajas y organización' }).click();
      await page.locator('.kura-asis-card[data-recipe="kura.caja-tapa"]').click();
      const ancho_ = page.getByRole('spinbutton', { name: 'Ancho interior' });
      const deslizador = page.getByRole('slider', { name: 'Deslizador de Ancho interior' });
      await expect(deslizador).toBeVisible();
      await deslizador.focus();
      await page.keyboard.press('ArrowRight');
      await expect(ancho_).not.toHaveValue('80');
      await ancho_.fill('10+5*10');
      await ancho_.press('Enter');
      await expect(ancho_).toHaveValue('60');
      await expect(deslizador).toHaveAttribute('aria-valuetext', /60 mm/);

      await page.getByLabel('Cierre de la tapa').selectOption({ label: 'A presión' });
      await expect(page.getByRole('spinbutton', { name: 'Holgura de la tapa' })).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Cajas y organización' })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.kura-asis-card[data-recipe="kura.caja-tapa"]')).toBeFocused();
      expect(errores).toEqual([]);
    });
  });
}
