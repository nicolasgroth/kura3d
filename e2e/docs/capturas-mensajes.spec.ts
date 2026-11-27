/**
 * @file e2e/docs/capturas-mensajes.spec.ts
 * @description Capturas de la guía «Mensajes»: el mensaje emergente único con su acción, los iconos de errores,
 * advertencias e información con contador en el pie del visor y el panel con el histórico de un tipo. La pieza es un
 * STL generado en memoria (un cubo con una cara menos), nunca un modelo de terceros.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { abrir, encuadrar, IMG_DIR, importarArchivo, stlCubos, type Clip } from './helpers';

/** Captura sin pasar por `captura()`: ese ayudante cierra los mensajes, que aquí son justo lo que se muestra. */
const foto = async (page: Page, nombre: string, clip?: Clip): Promise<void> => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(IMG_DIR, `${nombre}.png`), clip });
};

test('mensajes', async ({ page }) => {
  await abrir(page);

  // 1) Importar una malla abierta: queda a la vista un solo mensaje, la advertencia con «Reparar malla».
  await importarArchivo(page, 'caja-abierta.stl', stlCubos([[0, 0, 15]], 30, true));
  const emergente = page.locator('.kura-toast');
  await expect(emergente).toHaveCount(1, { timeout: 30_000 });
  await expect(emergente.getByRole('button', { name: 'Reparar malla' })).toBeVisible();
  await encuadrar(page, 'scene');
  await page.mouse.move(700, 300);
  await foto(page, 'mensajes-01-emergente');

  // 2) Los iconos con contador en el pie del visor, junto al rótulo de la cama (recorte de la parte baja).
  const centro = page.getByTestId('toast-center');
  await expect(centro).toBeVisible();
  const advertencias = centro.getByRole('button', { name: /advertencia/ });
  await expect(advertencias).toBeVisible();
  const caja = (await centro.boundingBox())!;
  await foto(page, 'mensajes-02-iconos', { x: Math.max(0, caja.x + caja.width - 520), y: Math.max(0, caja.y - 40), width: 540, height: caja.height + 70 });

  // 3) El panel con el histórico de advertencias: cada mensaje con su acción y su botón de quitar, y «Vaciar».
  await advertencias.click();
  const panel = page.getByRole('dialog', { name: /Advertencias/ });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Reparar malla' })).toBeVisible();
  await page.waitForTimeout(300);
  await foto(page, 'mensajes-03-panel');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(advertencias).toBeFocused();
});
