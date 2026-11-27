/**
 * @file e2e/acople-tuberia.spec.ts
 * @description Recorrido del acople de tubería (ESCRITO SIN EJECUTAR). Abre Insertar › Asistentes, elige «Acople de
 * tubería», comprueba la miniatura y el aviso «Enrosca: holgura mínima…» de la vista previa, un aviso de pared bajo el
 * mínimo imprimible, que holgura 0 cambia el resultado a un aviso, pasa a la unión a presión («Encaja: holgura mínima
 * 0,15 mm»), crea las dos mitades (un paso de deshacer) y reabre con «Editar con el asistente». Pensado para 1440 y
 * 1024 px, consola sin errores. Los campos numéricos se buscan como `spinbutton` exacto: los botones ▲▼ llevan la
 * misma etiqueta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './qa12-helpers';

async function abrirAsistente(page: Page) {
  await abrir(page);
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Asistentes/ }).click();
  await expect(page.getByRole('list', { name: 'Asistentes disponibles' })).toBeVisible();
  const tarjeta = page.locator('.kura-asis-card[data-recipe="kura.acople-tuberia"]');
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta.locator('svg.kura-asis-thumb')).toHaveCount(1, { timeout: 60_000 });
  await tarjeta.click();
}

const campo = (page: Page, name: string) => page.getByRole('spinbutton', { name, exact: true });

async function escribir(page: Page, name: string, value: string) {
  const input = campo(page, name);
  await input.fill(value);
  await input.press('Tab');
}

for (const ancho of [1440, 1024]) {
  test.describe(`acople de tubería a ${ancho} px`, () => {
    test.use({ viewport: { width: ancho, height: 800 } });

    test('roscado y a presión: vista previa con verificación, avisos, crear y editar', async ({ page }) => {
      const errores: string[] = [];
      page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
      await abrirAsistente(page);
      await expect(campo(page, 'Diámetro interior')).toBeVisible();
      const verificacion = page.locator('.kura-asis-screwfit');
      await expect(verificacion).toContainText(/Enrosca: holgura mínima 0,3\d mm/, { timeout: 60_000 });

      // Pared bajo el mínimo imprimible: aviso junto al campo, el acople se puede crear igual.
      await escribir(page, 'Pared', '1');
      await expect(page.getByText(/Pared bajo 1,2 mm/)).toBeVisible();
      await escribir(page, 'Pared', '2');

      // Holgura 0: la vista previa avisa que no enrosca.
      await escribir(page, 'Holgura de la rosca', '0');
      await expect(verificacion).toHaveAttribute('data-status', /tight|interference/, { timeout: 60_000 });
      await expect(page.getByText(/Holgura bajo 0,15 mm/)).toBeVisible();
      await escribir(page, 'Holgura de la rosca', '0.3');
      await expect(verificacion).toHaveAttribute('data-status', 'ok', { timeout: 60_000 });

      // A presión: los campos de la rosca se ocultan y aparecen los del enchufe.
      await page.getByLabel('Tipo de unión', { exact: true }).selectOption({ label: 'A presión (enchufe)' });
      await expect(campo(page, 'Paso')).toHaveCount(0);
      await expect(campo(page, 'Largo de la espiga')).toBeVisible();
      await expect(verificacion).toContainText(/Encaja: holgura mínima 0,15 mm/, { timeout: 60_000 });

      // Crear: dos mitades, un paso de deshacer.
      const antes = await page.evaluate(() => (window as any).__s.getState().past.length as number);
      await page.getByRole('button', { name: 'Crear', exact: true }).click();
      await expect(page.getByText(/Encaja: holgura mínima/).first()).toBeVisible();
      const estado = await page.evaluate(() => {
        const s = (window as any).__s.getState();
        return { nombres: s.objects.map((o: any) => o.name), pasos: s.past.length as number };
      });
      expect(estado.nombres).toEqual(['Acople macho', 'Acople hembra']);
      expect(estado.pasos).toBe(antes + 1);

      // Editar con el asistente: vuelve con las respuestas y «Actualizar».
      const id = await page.evaluate(() => (window as any).__s.getState().objects[0].id as string);
      await page.evaluate((i) => (window as any).__s.getState().selectObjects?.([i]) ?? (window as any).__s.setState({ selectedIds: [i] }), id);
      await page.getByRole('button', { name: 'Editar con el asistente' }).click();
      await expect(page.getByRole('button', { name: 'Actualizar', exact: true })).toBeVisible();
      await expect(page.getByLabel('Tipo de unión', { exact: true })).toHaveValue('1');
      expect(errores).toEqual([]);
    });
  });
}
