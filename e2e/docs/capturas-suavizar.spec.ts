/**
 * @file e2e/docs/capturas-suavizar.spec.ts
 * @description Capturas de la guía «Suavizar malla»: el panel abierto desde Acciones › Malla sobre una esfera
 * con ruido, con su vista previa translúcida, y la pieza tras aplicar. La esfera sale de la propia app y se le
 * suma ruido radial determinista (como el de un escaneo); nunca modelos de terceros.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { itemAccion } from '../acciones-helpers';
import { abrir, captura, cmd, encuadrar, seleccionar, sinAvisos } from './helpers';

const libre = (page: Page) => expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation), { timeout: 30_000 }).toBeNull();

test('suavizar', async ({ page }) => {
  await abrir(page);
  const esfera = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, name: 'Escaneo', position: [0, 0, 0], color: '#38bdf8' });
  // Ruido radial determinista (±0,8 mm) sobre la malla, como el de un escaneo.
  await page.evaluate((id) => {
    const s = (window as any).__s;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const objects = s.getState().objects.map((o: any) => {
      if (o.id !== id) return o;
      const p = o.mesh.positions.slice();
      for (let i = 0; i < p.length; i += 3) {
        const l = Math.hypot(p[i], p[i + 1], p[i + 2]) || 1;
        const k = 1 + ((rnd() * 2 - 1) * 0.8) / l;
        p[i] *= k; p[i + 1] *= k; p[i + 2] *= k;
      }
      return { ...o, mesh: { ...o.mesh, positions: p } };
    });
    s.setState({ objects });
  }, esfera.id);
  await encuadrar(page, 'scene');
  await seleccionar(page, [esfera.id]);

  // 1) Panel desde Acciones › Malla, con la vista previa calculada.
  await (await itemAccion(page, 'Suavizar…')).click();
  await expect(page.getByRole('heading', { name: 'Suavizar malla' })).toBeVisible();
  await page.getByRole('button', { name: /^Vista previa/ }).click();
  await expect(page.locator('#kura-inspector-panel').getByRole('status').filter({ hasText: 'Vista previa lista' })).toBeVisible({ timeout: 60_000 });
  await sinAvisos(page);
  await captura(page, 'suavizar-01-panel');

  // 2) Resultado aplicado.
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await libre(page);
  await expect(page.locator('#kura-inspector-panel').getByRole('status').filter({ hasText: 'Suavizado aplicado' })).toBeVisible();
  await sinAvisos(page);
  await encuadrar(page, 'scene');
  await expect(page.locator('footer')).toContainText('Borrador local guardado', { timeout: 40_000 });
  await captura(page, 'suavizar-02-resultado');
});
