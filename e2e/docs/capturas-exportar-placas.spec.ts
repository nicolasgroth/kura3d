/**
 * @file e2e/docs/capturas-exportar-placas.spec.ts
 * @description Capturas de la sección «Exportar con varias placas» de la guía «Exportar»: el diálogo con dos placas
 * en 3MF (un 3MF con todas las placas, con la ayuda de qué laminadores las entienden) y en STL (un archivo por placa
 * en un ZIP). Piezas creadas en la propia app (nunca modelos de terceros).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { existsSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { abrir, captura, cmd, encuadrar, seleccionar, sinAvisos } from './helpers';

const store = <T,>(page: Page, fn: (s: any) => T): Promise<T> => page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());

test('exportar con placas', async ({ page }) => {
  await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 40, depth: 40, height: 30, name: 'Cabeza', position: [-30, 0, 0], color: '#38bdf8' });
  await store(page, (s) => s.createPlate());
  const origen = await store(page, (s) => s.plates[1].origin as number[]);
  const torso = await cmd(page, 'create_primitive', { type: 'box', width: 40, depth: 40, height: 50, name: 'Cuerpo', position: [30, 0, 0], color: '#f97316' });
  await store(page, (s) => s.moveToPlate(s.plates[1].id, [s.objects.find((o: any) => o.name === 'Cuerpo').id]));
  expect(torso.id).toBeTruthy();
  expect(origen.length).toBe(2);
  await encuadrar(page, 'scene');
  await seleccionar(page, []);
  await sinAvisos(page);

  await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText(/Piezas en 2 placas/)).toBeVisible();
  await dlg.getByRole('radio', { name: /^3MF/ }).check();
  await expect(dlg.getByRole('radio', { name: /Un 3MF con todas las placas/ })).toBeChecked();
  await page.waitForTimeout(500);
  await captura(page, 'exportar-02-placas-3mf', dlg);

  await dlg.getByRole('radio', { name: /^STL/ }).check();
  await expect(dlg.getByText(/Se exporta un archivo STL por placa, en un ZIP/)).toBeVisible();
  await page.waitForTimeout(400);
  await captura(page, 'exportar-03-placas-stl', dlg);

  // Sección «Laminador» del 3MF con un proyecto de ejemplo cargado por el selector real de archivos.
  // El proyecto de ejemplo es un 3MF guardado desde un laminador; solo se lee (KURA_SLICER_SAMPLE lo cambia).
  const ejemplo = process.env.KURA_SLICER_SAMPLE ?? 'G:/proyectos/kura3d/.eval-tmp/laminador/kurra-3-placas_separado.3mf';
  test.skip(!existsSync(ejemplo), 'falta el proyecto de ejemplo del laminador');
  await dlg.getByRole('radio', { name: /^3MF/ }).check();
  await expect(dlg.getByText('No hay proyecto de ejemplo cargado.')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await dlg.getByRole('button', { name: /Cargar proyecto del laminador/ }).click();
  await (await chooser).setFiles(ejemplo);
  await expect(dlg.getByText(/Proyecto de ejemplo:/)).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(400);
  await captura(page, 'exportar-04-laminador', dlg);
});
