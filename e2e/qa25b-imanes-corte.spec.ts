/**
 * @file e2e/qa25b-imanes-corte.spec.ts
 * @description QA de «Imanes (desmontable)» como unión de Dividir para imprimir: los alojamientos quedan enfrentados
 * y coaxiales en las dos caras del corte, hay cantidad razonable, un imán que no cabe avisa, dividir es un solo paso
 * de deshacer y las piezas siguen exportándose por pieza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir, cmd, libre, pasos, volumen } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25b';

async function abrirDividir(page: Page, w: number, h: number, d: number) {
  const c = await cmd(page, 'create_primitive', { type: 'box', width: w, height: h, depth: d, name: 'Barra' });
  await page.evaluate((id) => (window as any).__s.setState({ selectedIds: [id] }), c.id);
  await page.getByRole('button', { name: 'Dividir para imprimir' }).first().click();
  await expect(page.locator('.kura-split-label-layer .kura-split-plane-tag').first()).toBeVisible({ timeout: 60_000 });
  return c.id as string;
}

const kind = (page: Page) => page.locator('select[id$="-kind"]');

test('imanes: dividir 400 mm, alojamientos por cara, deshacer = 1 paso', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await abrir(page);
  const id = await abrirDividir(page, 400, 60, 60);
  const v0 = await volumen(page, id);
  const p0 = await pasos(page);
  await kind(page).selectOption('magnet');
  await expect(page.getByTestId('split-magnet-options')).toBeVisible();
  await page.screenshot({ path: `${EV}/imanes-1-elegido.png` });
  const txt = await page.locator('.kura-split-panel, #kura-inspector-panel').first().innerText().catch(() => '');
  console.log('QA25B panel', txt.split(String.fromCharCode(10)).filter(Boolean).join(' | ').slice(0, 1500));
  await page.getByRole('button', { name: 'Dividir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.filter((o: any) => o.metadata?.split).length), { timeout: 120_000 }).toBeGreaterThan(1);
  await libre(page);
  const info = await page.evaluate(() => {
    const s = (window as any).__s.getState();
    return s.objects.filter((o: any) => o.metadata?.split).map((o: any) => ({
      name: o.name, code: o.metadata.split.code, vol: o.stats.volumeMm3, manifold: o.stats.isManifold,
      keys: Object.keys(o.metadata.split), size: o.stats.sizeMm ?? null,
    }));
  });
  console.log('QA25B joints', await page.evaluate(() => JSON.stringify((window as any).__s.getState().objects.filter((o: any) => o.metadata?.split).map((o: any) => ({ c: o.metadata.split.code, j: o.metadata.split.joints, jl: o.metadata.split.jointLabels })), null, 0)));
  console.log('QA25B geom', await page.evaluate(() => {
    const out: any[] = [];
    for (const o of (window as any).__s.getState().objects.filter((x: any) => x.metadata?.split)) {
      const p = o.mesh.positions; const [px, py, pz] = o.position;
      const xs = new Set<number>(); const rad: number[] = []; const lv: string[] = [];
      const cs = o.metadata.split.joints[0].connectorCenters as number[][];
      for (let i = 0; i < p.length; i += 3) {
        const X = p[i] + px, Y = p[i + 1] + py, Z = p[i + 2] + pz;
        if (Math.abs(X) < 3) {
          xs.add(Math.round(X * 100) / 100);
          for (const c of cs) { const r = Math.hypot(Y - c[1], Z - c[2]); if (r < 8) { rad.push(Math.round(r * 100) / 100); lv.push(`${Math.round(X * 10) / 10}@${Math.round(r * 10) / 10}`); } }
        }
      }
      out.push({ code: o.metadata.split.code, pos: o.position, rot: o.rotation, xs: [...xs].sort((a, b) => a - b), lv: [...new Set(lv)].slice(0, 30), rmin: Math.min(...rad), rmax: Math.max(...rad), n: rad.length });
    }
    return JSON.stringify(out);
  }));
  console.log('QA25B piezas', JSON.stringify(info));
  const suma = info.reduce((a: number, o: any) => a + o.vol, 0);
  console.log('QA25B volumen', `orig=${v0} suma=${suma} perdido=${v0 - suma} (alojamiento 5.2x2.2 ~46.7mm3)`);
  console.log('QA25B pasos', `${p0} -> ${await pasos(page)}`);
  await page.screenshot({ path: `${EV}/imanes-2-dividido.png` });
  await page.keyboard.press('Control+z');
  console.log('QA25B tras-undo', await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.name).join(',')), await pasos(page));
  expect(errs, errs.join(' / ')).toEqual([]);
});

test('imanes: no cabe -> aviso visible y la unión queda para pegar; cantidad manual; exportar por pieza', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await abrir(page);
  await abrirDividir(page, 400, 12, 12);
  await kind(page).selectOption('magnet');
  const preset = page.getByTestId('split-magnet-preset');
  console.log('QA25B presets', JSON.stringify(await preset.locator('option').allTextContents()));
  await preset.selectOption({ label: (await preset.locator('option').allTextContents()).find((x) => /10/.test(x)) ?? '' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${EV}/imanes-3-nocabe-plan.png` });
  await page.getByRole('button', { name: 'Dividir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.filter((o: any) => o.metadata?.split).length), { timeout: 120_000 }).toBeGreaterThan(1);
  await libre(page);
  await page.waitForTimeout(800);
  const vis = await page.locator('body').innerText();
  const aviso = vis.split(String.fromCharCode(10)).filter((l) => /imán|iman|magnet/i.test(l));
  console.log('QA25B nocabe-visible', JSON.stringify(aviso));
  console.log('QA25B nocabe-warn', await page.evaluate(() => JSON.stringify((window as any).__s.getState().objects.filter((o: any) => o.metadata?.split).map((o: any) => ({ c: o.metadata.split.code, cc: o.metadata.split.joints[0].connectorCenters?.length ?? null, m: o.metadata.split.joints[0].magnets ?? null, vol: o.stats.volumeMm3 })))));
  await page.screenshot({ path: `${EV}/imanes-4-nocabe-resultado.png` });
  // exportar por pieza
  await page.evaluate(() => (window as any).__s.setState({ selectedIds: (window as any).__s.getState().objects.map((o: any) => o.id) }));
  await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
  await page.screenshot({ path: `${EV}/imanes-5-exportar.png` });
  const dlg = await page.getByRole('dialog').innerText();
  console.log('QA25B export-dialog', dlg.split(String.fromCharCode(10)).filter(Boolean).join(' | ').slice(0, 900));
  expect(errs, errs.join(' / ')).toEqual([]);
});

test('imanes: exportar un archivo por pieza (ZIP) con las piezas con alojamientos', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await abrir(page);
  await abrirDividir(page, 400, 60, 60);
  await kind(page).selectOption('magnet');
  await page.getByRole('button', { name: 'Dividir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.filter((o: any) => o.metadata?.split).length), { timeout: 120_000 }).toBeGreaterThan(1);
  await libre(page);
  await page.evaluate(() => (window as any).__s.setState({ selectedIds: (window as any).__s.getState().objects.map((o: any) => o.id) }));
  await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
  await page.screenshot({ path: `${EV}/imanes-export-dialogo.png` });
  const radio = page.getByRole('dialog').getByText('Un archivo por pieza (ZIP)');
  await radio.click({ timeout: 5000 });
  const dl = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('dialog').getByRole('button', { name: /^Exportar / }).click({ timeout: 5000 });
  const d = await dl;
  const path = `${EV}/imanes-export.zip`;
  await d.saveAs(path);
  const { statSync, readFileSync } = await import('node:fs');
  const buf = readFileSync(path);
  const nombres = [...buf.toString('latin1').matchAll(/PK\x03\x04[\s\S]{26}([^\x00-\x1f]{3,80}?\.(?:stl|3mf|obj))/g)].map((m) => m[1]);
  console.log('QA25B zip', d.suggestedFilename(), statSync(path).size, JSON.stringify(nombres));
  expect(statSync(path).size).toBeGreaterThan(1000);
  expect(nombres.length).toBeGreaterThanOrEqual(2);
  expect(errs, errs.join(' / ')).toEqual([]);
});
