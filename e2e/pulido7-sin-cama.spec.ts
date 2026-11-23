/**
 * @file e2e/pulido7-sin-cama.spec.ts
 * @description Vista sin cama: el pie del visor cambia el chip «Cama: <impresora> (medidas)» por «Cama oculta», que al
 * pulsarlo la vuelve a mostrar; la alarma «Fuera de volumen» no se muestra con la cama oculta y reaparece al volver.
 * A 390 px el botón «Sin cama» es alcanzable sin desplazar la fila de vistas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/pulido7';

test.describe('escritorio', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('con la cama oculta el chip dice «Cama oculta», no alarma y al pulsarlo vuelve la cama', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Cubo', exact: true }).first().click();
    // Un objeto más ancho que la cama: fuera de volumen
    await page.evaluate(() => { const s = (window as any).__s.getState(); s.setObjectTransform(s.objects[0].id, { scale: [20, 1, 1] }); });
    const pie = page.locator('.kura-hud-bottom');
    await expect(pie.locator('.kura-oob-badge')).toBeVisible();
    await expect(pie).toContainText('Cama:');
    await expect(page.locator('.kura-split-notice')).toBeVisible();

    await page.getByTestId('bed-toggle').click();
    const chip = page.getByTestId('bed-hidden-chip');
    await expect(chip).toBeVisible();
    await expect(chip).toHaveText('Cama oculta');
    await expect(chip).toHaveAccessibleName(/oculta/i);
    await expect(pie).not.toContainText('Cama:');
    await expect(pie).not.toContainText('256');
    await expect(pie.locator('.kura-oob-badge')).toHaveCount(0);
    await expect(page.locator('.kura-split-notice')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/sin-cama-chip-1280.png` });

    await chip.focus();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => (window as any).__s.getState().showBed)).toBe(true);
    await expect(page.getByTestId('bed-hidden-chip')).toHaveCount(0);
    await expect(pie).toContainText('Cama:');
    await expect(pie.locator('.kura-oob-badge')).toBeVisible();
    await expect(page.locator('.kura-split-notice')).toBeVisible();
  });
});

test.describe('móvil', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('el botón «Sin cama» queda dentro de la pantalla en la fila de vistas', async ({ page }) => {
    await abrir(page);
    const btn = page.getByTestId('bed-toggle');
    await expect(btn).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/sin-cama-fila-390.png` });
    const r = await btn.evaluate((e) => { const b = e.getBoundingClientRect(); return { right: b.right, left: b.left, vw: window.innerWidth }; });
    // Entero y fuera de la zona desvanecida (28 px) del borde derecho
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(r.vw - 28);
    await btn.tap();
    expect(await page.evaluate(() => (window as any).__s.getState().showBed)).toBe(false);
  });
});
