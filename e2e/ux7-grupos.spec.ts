/**
 * @file e2e/ux7-grupos.spec.ts
 * @description Grupos en el árbol de Escena: tras Ctrl+G queda seleccionado el grupo nuevo y F2 lo renombra
 * (también con el foco en el árbol); los botones de fila se ven con la fila seleccionada y con el foco de
 * teclado; los nombres largos llevan tooltip con el nombre completo; los atajos pasan a un botón «?».
 * Ejecuta con `KURA_URL=… npx playwright test e2e/ux7-grupos.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';
import { SHOTS } from './ux7-helpers';

async function dosCubos(page: Page) {
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    await s.createPrimitive('box', { width: 20, height: 20, depth: 20 }, {});
    await s.createPrimitive('box', { width: 20, height: 20, depth: 20 }, { name: 'Soporte de pared con un nombre larguísimo para probar el recorte' });
  });
}

async function abrirEscena(page: Page) {
  await expect(page.getByRole('tree')).toBeVisible();
}

test('Ctrl+G deja seleccionado el grupo nuevo y F2 lo renombra', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await dosCubos(page);
  await abrirEscena(page);
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.setSelection(s.objects.map((o: any) => o.id));
  });
  await page.locator('canvas').first().hover();
  await page.keyboard.press('Control+g');
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().groups.length)).toBe(1);
  const filaGrupo = page.getByRole('treeitem', { name: /Grupo 1/ });
  await expect(filaGrupo).toHaveAttribute('aria-selected', 'true');

  // F2 desde el árbol (con foco en él): renombra el grupo, no un hijo.
  await page.getByRole('tree').focus();
  await page.keyboard.press('F2');
  const campo = page.getByRole('tree').getByRole('textbox', { name: 'Nombre del grupo' });
  await expect(campo).toBeVisible();
  await campo.fill('Mi grupo');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().groups[0].name)).toBe('Mi grupo');
  await page.screenshot({ path: `${SHOTS}/grupos-renombrado-1440.png` });

  // Botones de fila visibles con la fila seleccionada (sin pasar el cursor).
  await page.mouse.move(800, 500);
  const ojo = page.getByRole('treeitem', { name: /Mi grupo/ }).getByRole('button', { name: /Más acciones/ });
  await expect(ojo).toBeVisible();
});

test('botones de fila con el foco de teclado, tooltip en nombres largos y ayuda «?»', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await dosCubos(page);
  await abrirEscena(page);
  await page.evaluate(() => (window as any).__s.getState().setSelection([]));
  await page.getByRole('tree').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Control+ArrowDown');
  await page.mouse.move(800, 500);
  // La fila activa (foco de teclado, no seleccionada) muestra sus botones.
  const activa = page.locator('.kura-tree-row.is-active-option');
  await expect(activa.getByRole('button', { name: /Más acciones/ })).toBeVisible();

  const larga = page.getByRole('treeitem', { name: /Soporte de pared/ });
  await expect(larga).toHaveAttribute('title', 'Soporte de pared con un nombre larguísimo para probar el recorte');
  await expect(larga.locator('.kura-scene-name')).toHaveAttribute('title', 'Soporte de pared con un nombre larguísimo para probar el recorte');

  // Sin párrafo de atajos a la vista; el botón «?» abre la ayuda.
  await expect(page.locator('.kura-scene-hint')).toHaveCount(0);
  const ayuda = page.getByRole('button', { name: 'Atajos del árbol de escena' });
  await expect(ayuda).toBeVisible();
  await ayuda.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: /Atajos/ })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/grupos-ayuda-1440.png` });
});
