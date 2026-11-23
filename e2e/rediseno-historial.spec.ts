/**
 * @file e2e/rediseno-historial.spec.ts
 * @description Historial de deshacer en la barra superior: la lista nombra cada paso, marca el actual, salta a
 * un punto anterior de una vez (equivale a deshacer N veces) y vuelve hacia adelante; teclado con flechas,
 * Enter y Esc. Ejecuta con `KURA_URL=… npx playwright test e2e/rediseno-historial.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

test('saltar a un paso del historial y volver', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.createStarterCube();
  });
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(1);
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.duplicateObjects();
    s.nudgeSelectedObjects([10, 0, 0]);
  });
  const pasos = await page.evaluate(() => (window as any).__s.getState().past.length);
  expect(pasos).toBeGreaterThanOrEqual(3);

  const boton = page.getByRole('button', { name: 'Historial de acciones' });
  await boton.click();
  const lista = page.getByRole('listbox', { name: 'Historial de acciones' });
  await expect(lista).toBeFocused();
  const opciones = lista.getByRole('option');
  await expect(opciones).toHaveCount(pasos + 1);
  await expect(opciones.first()).toHaveText(/Inicio/);
  await expect(opciones.last()).toHaveAttribute('aria-selected', 'true');
  await expect(opciones.last()).toContainText('estado actual');
  await expect(lista).toContainText(/Duplicar|Agregar/);
  await expect(lista).toContainText('Mover');
  await page.screenshot({ path: 'G:/proyectos/kura3d/.eval-tmp/rediseno/historial.png', clip: { x: 0, y: 0, width: 700, height: 420 } });

  // Volver al inicio en un solo cambio de estado.
  let cambios = 0;
  await page.evaluate(() => {
    const w = window as any;
    w.__cambios = 0;
    // Cuenta cambios de la escena (la cámara y el foco aparte): saltar debe ser un solo cambio.
    w.__unsub = w.__s.subscribe((s: any, p: any) => { if (s.objects !== p.objects) w.__cambios += 1; });
  });
  await opciones.first().click();
  cambios = await page.evaluate(() => (window as any).__cambios);
  expect(cambios).toBe(1);
  await expect(boton).toBeFocused();
  expect(await page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(0);
  expect(await page.evaluate(() => (window as any).__s.getState().future.length)).toBe(pasos);

  // Con el teclado: End + Enter vuelve al último paso.
  await boton.click();
  await expect(lista.getByRole('option').nth(1)).toContainText('deshecho');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(2);
  expect(await page.evaluate(() => (window as any).__s.getState().past.length)).toBe(pasos);

  // Esc cierra sin cambiar nada.
  await boton.click();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Escape');
  await expect(lista).toBeHidden();
  expect(await page.evaluate(() => (window as any).__s.getState().past.length)).toBe(pasos);
});
