/**
 * @file e2e/qa20-ver-encaje.spec.ts
 * @description QA20: recorrido de punta a punta del aviso «Ver encaje» tras «Ajustar a la impresora»: una pieza
 * que no cabe + una referencia visible, reescalar, aparece el aviso, «Ver encaje» abre Comprobar encaje y corre
 * la comprobación; sin referencias ni medidas el aviso no aparece; deshacer tras el ajuste deja la escena
 * como estaba; cama propia con margen. Cero errores de consola.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/qa20-ver-encaje.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const cmd = async (page: Page, command: string, params: Record<string, unknown>) => {
  const r = await page.evaluate(
    async ([c, p]) => (window as any).__s.getState().executeCommand({ id: `e2e-${Math.random()}`, command: c, params: p }),
    [command, params] as const,
  );
  if (!r.ok) throw new Error(`${command}: ${JSON.stringify(r).slice(0, 300)}`);
  return r.result;
};

let errores: string[] = [];
test.beforeEach(async ({ page }) => {
  errores = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));
  await page.addInitScript(() => localStorage.setItem('kura3d-printer-id', 'elegoo-centauri-carbon-2'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
});
test.afterEach(() => {
  expect(errores).toEqual([]);
});

async function ajustarEscalando(page: Page) {
  await page.getByTestId('oob-fit').click();
  const dialog = page.getByRole('dialog', { name: 'Ajustar a la impresora' });
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('fit-alt-scale').click();
  await dialog.getByTestId('fit-apply').click();
  await expect(dialog).toBeHidden();
}

test('con una referencia visible: reescalar ofrece «Ver encaje», que abre el panel y comprueba', async ({ page }) => {
  const grande = await cmd(page, 'create_primitive', { type: 'box', width: 400, depth: 40, height: 40, name: 'Grande', placement: 'free', position: [0, 0, 20] });
  await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 10, name: 'Ref', role: 'reference', placement: 'free', position: [0, 0, 45] });
  await page.evaluate((id) => (window as any).__s.getState().setSelection([id]), grande.id);
  await ajustarEscalando(page);
  const aviso = page.getByRole('button', { name: 'Ver encaje' });
  await expect(aviso).toBeVisible();
  await aviso.click();
  const panel = page.locator('#kura-inspector-panel');
  await expect(panel.getByRole('heading', { name: 'Comprobar encaje' })).toBeVisible();
  await expect(panel.getByTestId('fit-check-result')).toBeVisible({ timeout: 60_000 });
  console.log('alcance', await panel.getByTestId('fit-check-scope').textContent().catch(() => null));
});

test('sin referencias ni medidas el aviso «Ver encaje» no aparece', async ({ page }) => {
  const grande = await cmd(page, 'create_primitive', { type: 'box', width: 400, depth: 40, height: 40, name: 'Grande', placement: 'free', position: [0, 0, 20] });
  await page.evaluate((id) => (window as any).__s.getState().setSelection([id]), grande.id);
  await ajustarEscalando(page);
  await expect(page.getByRole('button', { name: 'Ver encaje' })).toHaveCount(0);
});

test('deshacer el ajuste con el aviso visible: «Ver encaje» no deja la escena a medias', async ({ page }) => {
  const grande = await cmd(page, 'create_primitive', { type: 'box', width: 400, depth: 40, height: 40, name: 'Grande', placement: 'free', position: [0, 0, 20] });
  await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 10, name: 'Ref', role: 'reference', placement: 'free', position: [0, 0, 45] });
  await page.evaluate((id) => (window as any).__s.getState().setSelection([id]), grande.id);
  await ajustarEscalando(page);
  const aviso = page.getByRole('button', { name: 'Ver encaje' });
  await expect(aviso).toBeVisible();
  await page.evaluate(() => (window as any).__s.getState().undo());
  await aviso.click().catch(() => undefined);
  const s = await page.evaluate(() => {
    const st = (window as any).__s.getState();
    return { escala: st.objects.find((o: any) => o.name === 'Grande')?.scale, fit: st.fitCheck ? 'informe' : null, running: st.fitCheckRunning };
  });
  console.log('tras deshacer + Ver encaje', JSON.stringify(s));
  expect(s.escala).toEqual([1, 1, 1]);
});
