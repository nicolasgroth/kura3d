/**
 * @file e2e/ajustar-impresora-camas.spec.ts
 * @description Camas del usuario: crear una desde «Mis camas» (con coma decimal y validación), que
 * persista tras recargar, y abrir un proyecto con otra cama («Usar mi cama» / «Mantener la del proyecto»).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

async function abrirDialogo(page: Page) {
  await page.evaluate(async () => {
    const s = (window as any).__s;
    const obj = await s.getState().createPrimitive('box', { width: 400, height: 40, depth: 40 });
    s.getState().openFitToBed([obj.id]);
  });
  const dialog = page.getByRole('dialog', { name: 'Ajustar a la impresora' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('crear una cama propia: valida rangos, la activa y persiste al recargar', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => localStorage.removeItem('kura3d-bed-profiles'));
  const dialog = await abrirDialogo(page);
  await dialog.getByTestId('fit-bed-edit').click();
  await dialog.getByTestId('bed-new').click();
  await dialog.getByTestId('bed-name').fill('Mi Prusa');
  await dialog.getByTestId('bed-widthMm').fill('5');
  await dialog.getByTestId('bed-save').click();
  await expect(dialog.getByRole('alert')).toContainText('Ancho X (mm): entre 20 y 2000');
  await dialog.getByTestId('bed-widthMm').fill('250');
  await dialog.getByTestId('bed-depthMm').fill('210');
  await dialog.getByTestId('bed-heightMm').fill('220');
  await dialog.getByTestId('bed-marginMm').fill('2,5');
  await dialog.getByTestId('bed-save').click();
  await expect(dialog.getByTestId('fit-bed-select')).toHaveValue(/^user-/);
  // 250 − 2·2,5 = 245 → 245 / 400 = 61,25 % (se informa redondeado hacia abajo)
  await expect(dialog.getByTestId('fit-alt-scale')).toContainText('Escalar a 61,2 %');

  await page.reload();
  await abrir(page);
  const saved = await page.evaluate(() => {
    const s = (window as any).__s.getState();
    return { beds: s.userBedProfiles.map((b: any) => [b.name, b.bedWidthMm, b.marginMm]), active: s.printerProfile.name };
  });
  expect(saved.beds).toEqual([['Mi Prusa', 250, 2.5]]);
  expect(saved.active).toBe('Mi Prusa');
});

test('proyecto con otra cama: aviso con Usar mi cama y Mantener la del proyecto', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kura3d-printer-id', 'elegoo-centauri-carbon-2'));
  await abrir(page);
  const bytes = await page.evaluate(async () => {
    const s = (window as any).__s;
    const { DEFAULT_PRINTER_PROFILES } = await import('/src/types/kura.ts');
    const { captureProject } = await import('/src/store/projectDocument.ts');
    const { encodeProjectAsync } = await import('/src/project/projectCodecClient.ts');
    // Cama del proyecto distinta de la preferida (sin tocar la preferencia guardada).
    s.setState({ printerProfile: DEFAULT_PRINTER_PROFILES.find((p: any) => p.id === 'bambu-a1-mini') });
    const out = await encodeProjectAsync(captureProject(s.getState()));
    return Array.from(out as Uint8Array);
  });
  const abrirProyecto = () => page.evaluate(async (b) => {
    const s = (window as any).__s;
    return s.getState().openProject(async () => ({ bytes: new Uint8Array(b), name: 'otra-cama.kura' }));
  }, bytes);

  expect(await abrirProyecto()).toBe(true);
  await expect(page.getByText(/Este proyecto usa la cama/)).toBeVisible();
  await page.getByRole('button', { name: 'Mantener la del proyecto' }).click();
  expect(await page.evaluate(() => (window as any).__s.getState().printerProfile.id)).toBe('bambu-a1-mini');

  expect(await abrirProyecto()).toBe(true);
  await page.getByRole('button', { name: 'Usar mi cama' }).click();
  expect(await page.evaluate(() => (window as any).__s.getState().printerProfile.id)).toBe('elegoo-centauri-carbon-2');
});
