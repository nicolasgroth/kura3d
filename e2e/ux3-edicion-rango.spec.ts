/**
 * @file e2e/ux3-edicion-rango.spec.ts
 * @description Recorrido del evaluador: escribir −5 en el grosor de Ahuecar ya no aplica 0,8 mm en silencio: el campo
 * muestra el error con el rango y «Aplicar ahuecado» queda deshabilitado; al corregir el valor se puede aplicar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, crear, SHOTS } from './ux3-edicion-helpers';

test('Ahuecar: un grosor fuera de rango se marca y no se aplica', async ({ page }) => {
  const errs = await abrir(page, 1440, 900);
  const id = await crear(page, 'box', { width: 40, height: 40, depth: 40 }, [0, 20, 0]);
  await page.evaluate((x) => (window as any).__s.getState().setSelection([x]), id);
  const insp = page.getByRole('complementary', { name: 'Inspector' });
  // Ahuecar se abre por su acción: el panel contextual muestra solo sus opciones.
  await insp.getByRole('button', { name: 'Ahuecar…' }).click();
  const pared = insp.locator('input[aria-label="Grosor de pared"]').first();
  await pared.scrollIntoViewIfNeeded();
  const aplicar = insp.getByRole('button', { name: /Aplicar ahuecado/ });
  await pared.fill('-5');
  await expect(aplicar).toBeDisabled();
  await expect(pared).toHaveAttribute('aria-invalid', 'true');
  await pared.press('Enter');
  await expect(insp.getByRole('alert').filter({ hasText: /0,8–12/ })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/6-ahuecar-rango.png` });
  // Nada se aplicó: el objeto sigue macizo.
  expect(await page.evaluate((x) => (window as any).__s.getState().objects.find((o: any) => o.id === x).stats.triangles, id)).toBe(12);

  // Texto no numérico: también se marca y bloquea.
  await pared.fill('abc');
  await pared.press('Enter');
  await expect(aplicar).toBeDisabled();

  await pared.fill('2');
  await pared.press('Enter');
  await expect(aplicar).toBeEnabled();
  expect(errs).toEqual([]);
});
