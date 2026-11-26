/**
 * @file e2e/ajustar-impresora-recorrido.spec.ts
 * @description "Ajustar a la impresora" en la web real: abrir desde el aviso «Fuera de volumen», elegir
 * cada alternativa (escalar, girar, girar y escalar, dividir), vista previa, aplicar y deshacer en un paso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

/** Crea una caja (ancho X, alto Z, fondo Y del usuario) y la deja seleccionada. */
async function caja(page: Page, width: number, height: number, depth: number): Promise<string> {
  return page.evaluate(async ([w, h, d]) => {
    const s = (window as any).__s;
    const obj = await s.getState().createPrimitive('box', { width: w, height: h, depth: d });
    s.getState().setSelection([obj.id]);
    return obj.id as string;
  }, [width, height, depth]);
}

const estado = (page: Page, id: string) =>
  page.evaluate((oid) => {
    const s = (window as any).__s.getState();
    const o = s.objects.find((x: any) => x.id === oid);
    return { scale: o.scale as number[], rotation: o.rotation as number[], past: s.past.length as number, preview: s.fitPreview !== null };
  }, id);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kura3d-printer-id', 'elegoo-centauri-carbon-2'));
  await abrir(page);
});

test('desde el aviso Fuera de volumen: escalar, vista previa, aplicar y deshacer en un paso', async ({ page }) => {
  const id = await caja(page, 400, 40, 40);
  const boton = page.getByTestId('oob-fit');
  await expect(boton).toBeVisible();
  await boton.click();
  const dialog = page.getByRole('dialog', { name: 'Ajustar a la impresora' });
  await expect(dialog).toBeVisible();
  // Cama 256 − 2·5 = 246 → 246 / 400 = 61,5 %
  const escalar = dialog.getByTestId('fit-alt-scale');
  await expect(escalar).toContainText('Escalar a 61,5 %');
  await escalar.click();
  await expect.poll(async () => (await estado(page, id)).preview).toBe(true);
  const antes = await estado(page, id);
  await dialog.getByTestId('fit-apply').click();
  await expect(dialog).toBeHidden();
  const despues = await estado(page, id);
  expect(despues.scale[0]).toBeCloseTo(0.615, 4);
  expect(despues.past).toBe(antes.past + 1);
  expect(despues.preview).toBe(false);
  await page.evaluate(() => (window as any).__s.getState().undo());
  expect((await estado(page, id)).scale).toEqual([1, 1, 1]);
});

test('girar sin escalar acuesta la pieza alta; el teclado elige la opción', async ({ page }) => {
  // Cama baja y ancha (medidas propias 300 × 200 × 150): una pieza de 200 de alto solo cabe acostada.
  await page.evaluate(() => (window as any).__s.setState({ customBedDimensions: { width: 300, depth: 200, height: 150 } }));
  const id = await caja(page, 60, 200, 40);
  await page.evaluate(() => (window as any).__s.getState().openFitToBed());
  const dialog = page.getByRole('dialog', { name: 'Ajustar a la impresora' });
  const girar = dialog.getByTestId('fit-alt-rotate');
  await expect(girar).toContainText('Girar sin escalar');
  await expect(girar).toContainText('Queda apoyada la cara');
  // Girar es la sugerida: viene marcada.
  await expect(girar.getByRole('radio')).toBeChecked();
  // Flechas dentro del radiogroup cambian la opción; volver a la sugerida.
  await girar.getByRole('radio').focus();
  await page.keyboard.press('ArrowUp');
  await expect(dialog.getByTestId('fit-alt-scale').getByRole('radio')).toBeChecked();
  await page.keyboard.press('ArrowDown');
  await expect(girar.getByRole('radio')).toBeChecked();
  await dialog.getByTestId('fit-apply').click();
  await expect(dialog).toBeHidden();
  const after = await page.evaluate(async (oid) => {
    const { computeWorldStats } = await import('/src/engine/worldStats.ts');
    const o = (window as any).__s.getState().objects.find((x: any) => x.id === oid);
    return { dims: computeWorldStats(o.mesh, o.rotation, o.scale).dimensionsMm as number[], scale: o.scale as number[] };
  }, id);
  expect(after.scale).toEqual([1, 1, 1]);
  // La altura (Y interna) cabe en 150 − 2·5.
  expect(after.dims[1]).toBeLessThanOrEqual(140);
  await page.evaluate(() => (window as any).__s.getState().undo());
  expect((await estado(page, id)).rotation).toEqual([0, 0, 0]);
});

test('bajo la escala mínima sugiere Dividir y abre Dividir para imprimir', async ({ page }) => {
  await caja(page, 40, 40, 600);
  await page.evaluate(() => (window as any).__s.getState().openFitToBed());
  const dialog = page.getByRole('dialog', { name: 'Ajustar a la impresora' });
  // Fondo 600: solo escalar = 246/600 = 41 %; girar no cabe en 246 ni acostada.
  await expect(dialog.getByTestId('fit-alt-scale')).toContainText('41 %');
  // Girar no mejora el factor (todas las orientaciones dan 41 %): no se repite como opción.
  await expect(dialog.getByTestId('fit-alt-rotateScale')).toHaveCount(0);
  await expect(dialog).toContainText('Girar no mejora el factor');
  const dividir = dialog.getByTestId('fit-alt-split');
  await expect(dividir).toContainText('Dividir en piezas');
  // Bajo el 50 %: Dividir es la sugerida.
  await expect(dividir.getByRole('radio')).toBeChecked();
  await expect(dialog.getByTestId('fit-alt-scale')).toContainText('conviene dividir');
  await dialog.getByTestId('fit-apply').click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().activeDialog)).toBe('splitForBed');
});

test('Cancelar no cambia nada y quita el fantasma', async ({ page }) => {
  const id = await caja(page, 400, 40, 40);
  await page.evaluate(() => (window as any).__s.getState().openFitToBed());
  const dialog = page.getByRole('dialog', { name: 'Ajustar a la impresora' });
  await expect(dialog.getByTestId('fit-alt-scale')).toBeVisible();
  await expect.poll(async () => (await estado(page, id)).preview).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  const s = await estado(page, id);
  expect(s.scale).toEqual([1, 1, 1]);
  expect(s.preview).toBe(false);
});
