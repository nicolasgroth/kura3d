/**
 * @file e2e/qa-interfaz-2.spec.ts
 * @description Recorridos Playwright de la segunda pasada de QA de interfaz: tallado sobre objeto rotado/escalado,
 * errores del motor traducidos (EN/DE), lista de escena con teclado y errores claros de corte/proyección.
 * Requiere `@playwright/test` y la web en http://127.0.0.1:5189; fixtures en .eval-tmp/qa-interfaz/fx/.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';

async function importar(page: Page, nombre: string) {
  await page.evaluate(async (n) => {
    const dt = new DataTransfer();
    const blob = await (await fetch('/.eval-tmp/qa-interfaz/fx/' + n)).blob();
    dt.items.add(new File([blob], n));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, nombre);
  await expect(page.locator('footer')).toContainText('1 objs');
}

async function fijar(page: Page, etiqueta: string, valor: string) {
  const campo = page.getByLabel(etiqueta, { exact: true }).first();
  await campo.fill(valor);
  await campo.press('Enter');
}

test('tallar un cubo rotado y escalado no duplica la transformación', async ({ page }) => {
  await page.goto('http://127.0.0.1:5189/');
  await importar(page, 'cubo10.stl');
  await fijar(page, 'Rotación (°) X', '90');
  await fijar(page, 'Rotación (°) Z', '30');
  for (const eje of ['X', 'Y', 'Z']) await fijar(page, `Escala (×) ${eje}`, '2');
  await page.getByRole('button', { name: 'Esculpir / Borrar' }).click();
  await page.mouse.click(700, 420);
  await expect(page.getByText('Volumen tallado con éxito')).toBeVisible();
  await expect(page.getByText('27.32 mm × 20 mm × 27.32 mm').first()).toBeVisible();
});

test('conector demasiado grande y gráfico fuera de la cara dan error claro', async ({ page }) => {
  await page.goto('http://127.0.0.1:5189/');
  await page.getByRole('button', { name: 'Cubo', exact: true }).first().click();
  await page.getByRole('button', { name: 'Corte por plano + uniones' }).click();
  await fijar(page, 'Tamaño del conector (mm)', '50');
  await page.getByRole('button', { name: 'Ejecutar Corte' }).click();
  await expect(page.getByText(/no caben en la cara de corte/)).toBeVisible();
  await page.getByRole('button', { name: 'Proyectar Texto/SVG en Superficie' }).click();
  await fijar(page, 'Ancho proyectado (mm)', '100');
  await page.getByRole('button', { name: 'Proyectar sobre Modelo' }).click();
  await expect(page.getByText(/se sale de la pieza/)).toBeVisible();
});

test('lista de escena: flechas, Shift+flechas, F2 y Supr con teclado', async ({ page }) => {
  await page.goto('http://127.0.0.1:5189/');
  for (const n of ['Cubo', 'Cilindro', 'Esfera']) await page.getByRole('button', { name: n, exact: true }).first().click();
  await page.getByRole('tab', { name: /Escena/ }).click();
  const lista = page.locator('.kura-scene-list');
  await lista.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(page.getByText(/2 seleccionados/)).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('F2');
  await page.keyboard.type('Renombrado');
  await page.keyboard.press('Enter');
  await expect(page.locator('.kura-scene-name', { hasText: 'Renombrado' })).toBeVisible();
  await page.keyboard.press('Delete');
  await expect(page.locator('.kura-scene-name', { hasText: 'Renombrado' })).toHaveCount(0);
});

for (const [lang, texto] of [['en', /leaves no cavity/], ['de', /lässt keinen Hohlraum/]] as const) {
  test(`pared imposible al ahuecar sale traducida (${lang})`, async ({ page }) => {
    await page.goto('http://127.0.0.1:5189/');
    await page.getByLabel(/Interface language|Idioma|Sprache/).selectOption(lang);
    await page.locator('aside button').filter({ hasText: /^(Box|Quader)/ }).first().click();
    const aplicar = page.getByRole('button', { name: /Apply hollowing|Aushöhlung anwenden/ });
    await aplicar.click(); // ahueca (pared 12 mm en cubo de 30)
    await aplicar.click(); // segunda vez: ya no cabe cavidad
    await expect(page.getByText(texto)).toBeVisible();
  });
}
