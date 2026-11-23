/**
 * @file e2e/gen-ui-detalles.spec.ts
 * @description Roscas: el largo por defecto sigue al diámetro y al tipo hasta que el usuario lo edita. «Separar por
 * colores» sin pintar guía al usuario. El diálogo de proyección dice qué cara usa por defecto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

test.use({ locale: 'es-CL', viewport: { width: 1440, height: 900 } });

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/gen-ui';

test('rosca: el largo por defecto sigue al diámetro y al tipo salvo que se edite', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => (window as any).__s.getState().setActiveDialog('thread'));
  const dlg = page.getByRole('dialog');
  const largo = dlg.locator('#thread-len');
  const diam = dlg.locator('#thread-diam');
  await expect(largo).toHaveValue('20');
  await diam.fill('10');
  await diam.press('Tab');
  await expect(largo).toHaveValue('25');
  await dlg.locator('#thread-kind').selectOption('nut');
  await expect(largo).toHaveValue('8');
  await diam.fill('20');
  await diam.press('Tab');
  await expect(largo).toHaveValue('16');
  // Una vez editado a mano, ya no se pisa.
  await largo.fill('30');
  await largo.press('Tab');
  await diam.fill('6');
  await diam.press('Tab');
  await expect(largo).toHaveValue('30');
  await dlg.locator('#thread-kind').selectOption('bolt');
  await expect(largo).toHaveValue('30');
  await page.screenshot({ path: `${SHOTS}/11-rosca-largo.png` });
});

test('separar por colores sin pintar: mensaje guía en lugar de «1 piezas»', async ({ page }) => {
  await abrir(page);
  const resultado = await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    const box = await s.createPrimitive('box', { width: 20, height: 20, depth: 20 }, { placement: 'free' });
    const parts = await s.splitObjectByColor(box.id, {});
    return { parts: parts.length, objetos: (window as any).__s.getState().objects.length, toasts: (window as any).__s.getState().toasts.map((t: any) => t.text) };
  });
  expect(resultado.parts).toBe(0);
  expect(resultado.objetos).toBe(1);
  expect(resultado.toasts.join(' ')).toContain('Pinta primero zonas con la herramienta Pintar');
  expect(resultado.toasts.join(' ')).not.toMatch(/1 piezas/);
});

test('proyectar: el diálogo dice qué cara usa por defecto', async ({ page }) => {
  await abrir(page);
  await page.evaluate(async () => {
    await (window as any).__s.getState().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { placement: 'free' });
    (window as any).__s.getState().setActiveDialog('project');
  });
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('Cara: la que estás mirando');
  await expect(dlg.locator('#proj-axis')).toHaveAttribute('aria-describedby', 'proj-axis-hint');
  await page.screenshot({ path: `${SHOTS}/12-proyectar-cara.png` });
});
