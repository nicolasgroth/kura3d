/**
 * @file e2e/gen-ui-texto.spec.ts
 * @description Texto 3D: validación del alto de letra (abc, −5, 0, 9999), mensaje de texto vacío, contador, fuente,
 * aviso antes de crear si no cabe en la cama (con tamaño sugerido), crear con Enter o con botón, y aplicar el
 * texto desde Parámetros con Enter o con el botón visible.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-escena-helpers';
import { agregarForma } from './agregar-helpers';

test.use({ locale: 'es-CL', viewport: { width: 1440, height: 900 } });


/** Texto actual del primer objeto según sus parámetros guardados. */
const textoDelObjeto = (page: import('@playwright/test').Page) =>
  page.evaluate(async () => {
    const { parametricStateOf } = await import('/src/core/scene/parametric.ts');
    const st = parametricStateOf((window as any).__s.getState().objects[0]) as any;
    return st.params?.text as string;
  });

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/gen-ui';

test('crear texto 3D: validación, contador, fuente y aviso de cama', async ({ page }) => {
  const errores: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await abrir(page);
  await agregarForma(page, 'Texto 3D');
  const card = page.locator('form.kura-card').filter({ hasText: 'Crear texto' });
  const texto = card.locator('input.kura-input');
  const alto = card.locator('input[role=spinbutton]');
  const crear = card.getByRole('button', { name: 'Crear texto' });
  await expect(card).toContainText('Fuente: Roboto Bold');
  await expect(card).toContainText('6 de 200 caracteres');

  for (const malo of ['abc', '-5', '0', '9999']) {
    await alto.fill(malo);
    await alto.press('Tab');
    await expect(card.getByRole('alert')).toBeVisible();
    await expect(crear).toBeDisabled();
    await alto.press('Escape');
    await alto.fill('18');
    await alto.press('Tab');
    await expect(crear).toBeEnabled();
  }

  await texto.fill('   ');
  await expect(card.getByRole('alert')).toContainText('Escribe al menos un carácter');
  await expect(crear).toBeDisabled();

  await texto.fill('WWWWWWWWWWWWWWWWWWWW');
  await alto.fill('60');
  await alto.press('Tab');
  await expect(card.getByRole('status')).toContainText(/no cabe en la cama de 256 mm/);
  await expect(card.getByRole('button', { name: /^Usar / })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/07-texto-no-cabe.png` });
  await card.getByRole('button', { name: /^Usar / }).click();
  await expect(card.getByRole('status')).toHaveCount(0);

  await texto.fill('HOLA');
  await texto.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(1);
  expect(errores.filter((e) => !/404/.test(e))).toEqual([]);
});

test('texto 3D en Parámetros: vacío con mensaje, botón visible y Enter aplican', async ({ page }) => {
  await abrir(page);
  await page.evaluate(async () => {
    await (window as any).__s.getState().createPrimitive('text', { text: 'ABC', fontSize: 16, height: 4 }, { placement: 'free' });
  });
  const ins = page.locator('[aria-label="Inspector"]');
  const campo = ins.locator('textarea.kura-param-textarea');
  await expect(campo).toBeVisible();
  await campo.fill('');
  await expect(ins.getByRole('alert').filter({ hasText: 'Escribe al menos un carácter' })).toBeVisible();
  await expect(ins.getByRole('button', { name: 'Aplicar texto' })).toBeDisabled();
  await campo.fill('XYZ');
  await ins.getByRole('button', { name: 'Aplicar texto' }).click();
  await expect.poll(() => textoDelObjeto(page)).toBe('XYZ');
  await campo.fill('QQ');
  await campo.press('Control+Enter');
  await expect.poll(() => textoDelObjeto(page)).toBe('QQ');

  // Alto de letra inválido en Parámetros: el mensaje se ve en el campo.
  const alto = ins.locator('input[role=spinbutton]').first();
  for (const malo of ['abc', '-5', '0', '9999']) {
    await alto.fill(malo);
    await alto.press('Tab');
    await expect(ins.getByRole('alert').filter({ hasNotText: 'Escribe' }).first()).toBeVisible();
    await alto.press('Escape');
  }
  await page.screenshot({ path: `${SHOTS}/08-texto-parametros.png` });
});
