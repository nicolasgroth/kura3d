/**
 * @file e2e/reales-ui-corte.spec.ts
 * @description Diálogo de corte: la superposición de "Apoyarla en la cama" sale como nota de
 * advertencia propia bajo la opción (icono + texto, sin subrayado ondulado) y su enlace elige
 * directamente "Apoyarla en un lugar libre" (con teclado). Capturas en claro y oscuro.
 * Ejecuta con `KURA_URL=http://127.0.0.1:5234/ npm run test:e2e -- reales-ui-corte`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/reales-ui';

async function cubo(page: Page, name: string, size: number, position: [number, number, number]): Promise<string> {
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation)).toBeNull();
  return page.evaluate(async ([n, s, p]) => {
    const o = await (window as any).__s.getState().createPrimitive('box', { width: s, height: s, depth: s }, { position: p, name: n });
    return o.id as string;
  }, [name, size, position] as const);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`nota de superposición con enlace a «lugar libre» (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await abrir(page);
    await cubo(page, 'Debajo', 30, [0, 0, 0]);
    const id = await cubo(page, 'Cubo', 30, [0, 40, 0]);
    await page.evaluate((i) => {
      const st = (window as any).__s.getState();
      st.selectObject(i);
      st.setActiveDialog('cut');
    }, id);
    const dlg = page.getByRole('dialog', { name: 'Corte por plano + uniones' });
    await expect(dlg).toBeVisible();
    await page.getByLabel('Mitades a conservar').selectOption('positive');
    const note = dlg.getByTestId('kept-overlap-note');
    await expect(note).toBeVisible();
    await expect(note).toHaveAttribute('role', 'note');
    await expect(note).toContainText('Se superpondría con «Debajo»');
    expect(await note.locator('strong, .kura-kept-warn').count()).toBe(0);
    // La nota describe la opción «Apoyarla en la cama» para el lector.
    const drop = dlg.getByRole('radio', { name: /Apoyarla en la cama/ });
    expect(await drop.getAttribute('aria-describedby')).toContain(await note.getAttribute('id'));
    await note.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/corte-nota-${scheme}.png` });
    const link = note.getByRole('button', { name: 'Elegir «Apoyarla en un lugar libre»' });
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(dlg.getByRole('radio', { name: /Apoyarla en un lugar libre/ })).toBeChecked();
  });
}
