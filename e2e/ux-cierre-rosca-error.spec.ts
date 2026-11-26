/**
 * @file e2e/ux-cierre-rosca-error.spec.ts
 * @description Diálogo de rosca: el aviso de rango del campo Paso queda dentro de la columna de su campo (no se
 * sale a la izquierda) y usa los separadores del idioma ("0,2–6" en español, "0.2–6" en inglés).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-movil-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux-cierre';

for (const [lang, esperado] of [['es', '0,2–6'], ['en', '0.2–6']] as const) {
  test(`el aviso de rango del Paso queda en su columna y usa el formato del idioma (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page, lang);
    await page.evaluate(() => (window as any).__s.getState().setActiveDialog('thread'));
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    const campos = dialogo.locator('.kura-precision-field');
    // Paso de rosca: el segundo campo numérico (tras el diámetro nominal).
    const paso = campos.nth(1);
    await paso.fill('0');
    await paso.press('Enter');
    const aviso = dialogo.locator('.kura-precision-input.is-invalid .kura-precision-error').first();
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText(esperado);
    const a = (await aviso.boundingBox())!;
    const c = (await dialogo.locator('.kura-precision-input.is-invalid').first().boundingBox())!;
    expect(a.x).toBeGreaterThanOrEqual(c.x - 1);
    expect(a.x + a.width).toBeLessThanOrEqual(c.x + c.width + 1);
    await page.screenshot({ path: `${SHOTS}/rosca-error-${lang}.png` });
  });
}
