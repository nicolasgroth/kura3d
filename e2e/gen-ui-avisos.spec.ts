/**
 * @file e2e/gen-ui-avisos.spec.ts
 * @description Avisos de error: el error de un diálogo abierto se muestra solo dentro de él (sin toast), un error
 * fuera de diálogos caduca a los 12 s, queda en el historial de la barra de estado y nunca se superpone con la
 * barra de la herramienta activa ni con el aviso «No cabe en la cama». Con un modal abierto Ctrl+Z no deshace la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

test.use({ locale: 'es-CL', viewport: { width: 1440, height: 900 } });

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/gen-ui';
const SOLO_LINEAS =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><line x1="0" y1="0" x2="100" y2="100" stroke="black" fill="none"/></svg>';

test('error de un diálogo abierto: solo dentro del diálogo, sin toast, y queda en el historial', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => (window as any).__s.getState().setActiveDialog('svg'));
  const dlg = page.getByRole('dialog');
  await dlg.locator('#svg-code').fill(SOLO_LINEAS);
  await dlg.getByRole('button', { name: /Extruir SVG/ }).click();
  await expect(dlg.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__s.getState().toasts.filter((x: any) => x.kind === 'error').length)).toBe(0);
  await page.screenshot({ path: `${SHOTS}/04-svg-error-en-dialogo.png` });
  await dlg.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: /^Avisos/ }).click();
  await expect(page.getByRole('region', { name: 'Avisos recientes' })).toContainText(/línea|relleno|lines|forma/i);
  await page.screenshot({ path: `${SHOTS}/05-historial-avisos.png` });
});

test('un error fuera de diálogos caduca a los 12 s y el historial lo conserva', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => (window as any).__s.getState().addToast('Error de prueba visible', 'error'));
  const toast = page.getByRole('alert').filter({ hasText: 'Error de prueba visible' });
  await expect(toast).toBeVisible();
  await expect(toast).toBeHidden({ timeout: 16000 });
  await page.getByRole('button', { name: /^Avisos/ }).click();
  await expect(page.getByRole('region', { name: 'Avisos recientes' })).toContainText('Error de prueba visible');
});

test('los avisos no se superponen con la barra del pincel ni con «No cabe en la cama»', async ({ page }) => {
  await abrir(page);
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    await s.createPrimitive('box', { width: 400, height: 20, depth: 20 }, { placement: 'free' });
    s.setActiveTool('paint');
    s.addToast('Aviso uno de prueba', 'error');
    s.addToast('Aviso dos de prueba', 'info');
  });
  await page.waitForTimeout(600);
  const toasts = page.locator('.kura-toast');
  await expect(toasts.first()).toBeVisible();
  const cajas = async (sel: string) => (await page.locator(sel).evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height }))));
  const overlap = (a: any, b: any) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const t = await cajas('.kura-toast');
  const otros = [...(await cajas('.kura-paint-toolbar')), ...(await cajas('.kura-split-notice')), ...(await cajas('.kura-hud-bottom .kura-hud-card'))];
  for (const a of t) for (const b of otros) expect(overlap(a, b), JSON.stringify({ a, b })).toBe(false);
  await page.screenshot({ path: `${SHOTS}/06-avisos-zona-reservada.png` });
});

test('con un modal abierto Ctrl+Z no deshace la escena', async ({ page }) => {
  await abrir(page);
  await page.evaluate(async () => {
    await (window as any).__s.getState().createPrimitive('box', { width: 20, height: 20, depth: 20 }, { placement: 'free' });
  });
  await page.evaluate(() => (window as any).__s.getState().setActiveDialog('svg'));
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).focus();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(1);
});
