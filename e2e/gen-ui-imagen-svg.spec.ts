/**
 * @file e2e/gen-ui-imagen-svg.spec.ts
 * @description Imagen→3D: archivo vacío, formato no soportado o PNG dañado muestran el error dentro del diálogo y
 * deshabilitan «Generar»; fondo de tablero para transparencias; ancho desarrollado en modo cilíndrico. SVG: los
 * valores fuera de rango se marcan en el campo (no se acotan en silencio) y se avisa si no cabe en la cama.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

test.use({ locale: 'es-CL', viewport: { width: 1440, height: 900 } });

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/gen-ui';

async function cargar(page: Page, name: string, mimeType: string, buffer: Buffer): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Elegir imagen/ }).click();
  await (await chooser).setFiles({ name, mimeType, buffer });
}

test('imagen: archivos inválidos muestran error y bloquean Generar', async ({ page }) => {
  const errores: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await abrir(page);
  await page.evaluate(() => (window as any).__s.getState().setActiveDialog('image'));
  const dlg = page.getByRole('dialog');
  const generar = dlg.getByRole('button', { name: /Generar Malla 3D/ });
  await expect(generar).toBeEnabled();

  const corrupto = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('basura que no es un png')]);
  await cargar(page, 'roto.png', 'image/png', corrupto);
  await expect(dlg.getByRole('alert')).toContainText(/dañado/);
  await expect(generar).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/01-imagen-corrupta.png` });

  await cargar(page, 'vacio.png', 'image/png', Buffer.alloc(0));
  await expect(dlg.getByRole('alert')).toContainText(/vacío/);
  await expect(generar).toBeDisabled();

  await cargar(page, 'nota.txt', 'text/plain', Buffer.from('hola'));
  await expect(dlg.getByRole('alert')).toContainText(/Formato no compatible/);
  await expect(generar).toBeDisabled();

  // Una imagen válida (PNG con transparencia) lo vuelve a habilitar y quita el error.
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 40;
    c.height = 40;
    const x = c.getContext('2d')!;
    x.fillStyle = '#ffffff';
    x.fillRect(10, 10, 20, 20);
    return c.toDataURL('image/png').split(',')[1];
  });
  await cargar(page, 'ok.png', 'image/png', Buffer.from(png, 'base64'));
  await expect(dlg.getByRole('alert')).toHaveCount(0);
  await expect(generar).toBeEnabled();
  const fondo = await dlg.locator('canvas.kura-img-preview').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(fondo).toContain('linear-gradient');
  await page.screenshot({ path: `${SHOTS}/02-imagen-transparente.png` });
  expect(errores.filter((e) => !/404/.test(e))).toEqual([]);
});

test('imagen: en modo cilíndrico se oculta el ancho físico y se muestra el desarrollado', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => (window as any).__s.getState().setActiveDialog('image'));
  const dlg = page.getByRole('dialog');
  await expect(dlg.locator('#img-w')).toBeVisible();
  await dlg.locator('#img-shape-mode').selectOption('cylindrical');
  await expect(dlg.locator('#img-w')).toHaveCount(0);
  // 42 mm × 180° = 131,9 mm
  await expect(dlg.locator('#img-dev-w')).toContainText('131,9');
});

test('SVG: valores fuera de rango se marcan y se avisa si no cabe en la cama', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => (window as any).__s.getState().setActiveDialog('svg'));
  const dlg = page.getByRole('dialog');
  const extruir = dlg.getByRole('button', { name: /Extruir SVG/ });
  for (const [valor, id] of [['0', '#svg-width'], ['5000', '#svg-width'], ['abc', '#svg-width'], ['-3', '#svg-depth']] as const) {
    await dlg.locator(id).fill(valor);
    await dlg.locator(id).press('Tab');
    await expect(dlg.locator(id)).toHaveAttribute('aria-invalid', 'true');
    await expect(extruir).toBeDisabled();
    await dlg.locator(id).press('Escape');
    await dlg.locator(id).fill(id === '#svg-width' ? '60' : '6');
    await dlg.locator(id).press('Tab');
    await expect(extruir).toBeEnabled();
  }
  await dlg.locator('#svg-width').fill('300');
  await dlg.locator('#svg-width').press('Tab');
  await expect(dlg.getByRole('status').filter({ hasText: /no cabe en la cama/ })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/03-svg-no-cabe.png` });
});
