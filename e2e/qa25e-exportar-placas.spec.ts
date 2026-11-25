/**
 * @file e2e/qa25e-exportar-placas.spec.ts
 * @description QA 25-nov (E) de exportar con placas: el diálogo ofrece 3MF combinado o un 3MF por placa (ZIP) con su
 * ayuda, STL con la nota de ZIP y el botón dice `.zip`; los archivos descargados se abren (fflate): un archivo por
 * placa con nombres saneados (`/`, `:`), la misma pieza en la placa 1 y 2 sale con las mismas coordenadas, el 3MF
 * declara dos placas, una pieza sin placa se excluye con aviso y sin placas todo queda como siempre. Evidencia en
 * `.eval-tmp/qa25e/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { expect, test, type Page } from '@playwright/test';
import { abrir, cmd } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25e';
test.use({ viewport: { width: 1440, height: 900 } });

const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> =>
  page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());

/** Caja envolvente de un STL (binario o ASCII). */
function bboxStl(buf: Uint8Array): { min: number[]; max: number[]; tris: number } {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const put = (x: number, y: number, z: number) => [x, y, z].forEach((v, i) => { min[i] = Math.min(min[i], v); max[i] = Math.max(max[i], v); });
  const head = strFromU8(buf.subarray(0, 5));
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const n = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0;
  if (head !== 'solid' || 84 + n * 50 === buf.byteLength) {
    for (let t = 0; t < n; t += 1) for (let v = 0; v < 3; v += 1) { const o = 84 + t * 50 + 12 + v * 12; put(dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)); }
    return { min, max, tris: n };
  }
  let tris = 0;
  for (const m of strFromU8(buf).matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) put(+m[1], +m[2], +m[3]);
  tris = (strFromU8(buf).match(/endfacet/g) ?? []).length;
  return { min, max, tris };
}

async function preparar(page: Page, nombre2 = 'Placa 2') {
  const errs = await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 30, height: 10, name: 'Caja A', position: [10, 5, 20] });
  await S(page, (s) => s.createPlate());
  const o2 = await S(page, (s) => s.plates[1].origin as number[]);
  await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 30, height: 10, name: 'Caja B', position: [o2[0] + 10, 5, o2[1] + 20] });
  await page.evaluate((n) => { const s = (window as any).__s.getState(); s.renamePlate(s.plates[1].id, n); }, nombre2);
  await S(page, (s) => s.setSelection([]));
  return errs;
}

const abrirDialogo = async (page: Page) => {
  await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
  return page.getByRole('dialog');
};

async function descargar(page: Page, dlg: ReturnType<Page['getByRole']>, nombre: string) {
  const file = join(mkdtempSync(join(tmpdir(), 'qa25e-')), nombre);
  const dl = page.waitForEvent('download');
  await dlg.getByRole('button', { name: /^Exportar / }).click();
  const d = await dl;
  await d.saveAs(file);
  return { file, sugerido: d.suggestedFilename() };
}

test('dos placas: el diálogo ofrece las dos salidas con ayuda, y el ZIP de STL trae una pieza por placa con las mismas coordenadas', async ({ page }) => {
  const errs = await preparar(page, 'Mi/placa: <2>');
  const dlg = await abrirDialogo(page);
  await expect(dlg.getByText(/Piezas en 2 placas/)).toBeVisible();
  await dlg.getByRole('radio', { name: /^3MF/ }).check();
  await expect(dlg.getByRole('radio', { name: /Un 3MF con todas las placas/ })).toBeChecked();
  await expect(dlg.getByText(/Bambu Studio y OrcaSlicer abren cada placa/)).toBeVisible();
  await expect(dlg.getByText(/Sirve en cualquier laminador/).first()).toBeVisible();
  await expect(dlg.getByRole('button', { name: /\.3mf$/ })).toBeVisible();
  await page.screenshot({ path: `${EV}/export-3mf-claro.png` });
  await dlg.getByRole('radio', { name: /Un archivo por placa/ }).check();
  await expect(dlg.getByRole('button', { name: /\.zip$/ })).toBeVisible();
  await dlg.getByRole('radio', { name: /^STL/ }).check();
  await expect(dlg.getByText(/Se exporta un archivo STL por placa, en un ZIP/)).toBeVisible();
  await expect(dlg.getByRole('button', { name: /\.zip$/ })).toBeVisible();
  const txt = await dlg.innerText();
  expect(txt).not.toMatch(/dialog\.export\.plates|Kura3D/);
  await page.screenshot({ path: `${EV}/export-stl-claro.png` });

  const { file, sugerido } = await descargar(page, dlg, 'stl.zip');
  expect(sugerido).toMatch(/\.zip$/);
  const z = unzipSync(readFileSync(file));
  const nombres = Object.keys(z);
  console.log('QA25E zip STL', JSON.stringify(nombres));
  expect(nombres).toHaveLength(2);
  for (const n of nombres) expect(n, 'nombre saneado').not.toMatch(/[\\/:<>"|?*]/);
  const [a, b] = nombres.map((n) => bboxStl(z[n]));
  expect(a.tris).toBeGreaterThan(0);
  for (let i = 0; i < 3; i += 1) {
    expect(a.min[i]).toBeCloseTo(b.min[i], 2);
    expect(a.max[i]).toBeCloseTo(b.max[i], 2);
  }
  expect(errs, errs.join('\n')).toEqual([]);
});

test('3MF: combinado declara dos placas; un 3MF por placa trae un archivo por placa; importar de vuelta conserva 2 piezas', async ({ page }) => {
  const errs = await preparar(page);
  let dlg = await abrirDialogo(page);
  await dlg.getByRole('radio', { name: /^3MF/ }).check();
  const comb = await descargar(page, dlg, 'comb.3mf');
  const zc = unzipSync(readFileSync(comb.file));
  const cfg = Object.keys(zc).find((n) => /model_settings\.config$/i.test(n));
  console.log('QA25E 3MF combinado entradas', JSON.stringify(Object.keys(zc)));
  expect(cfg, 'config de placas').toBeTruthy();
  const xml = strFromU8(zc[cfg!]);
  expect((xml.match(/key="plater_id"/g) ?? []).length, 'dos placas declaradas').toBe(2);
  expect(xml).toContain('Placa 2');

  dlg = await abrirDialogo(page);
  await dlg.getByRole('radio', { name: /^3MF/ }).check();
  await dlg.getByRole('radio', { name: /Un archivo por placa/ }).check();
  const per = await descargar(page, dlg, 'per.zip');
  const zp = unzipSync(readFileSync(per.file));
  const n3 = Object.keys(zp).filter((n) => /\.3mf$/i.test(n));
  console.log('QA25E zip 3MF', JSON.stringify(Object.keys(zp)));
  expect(n3).toHaveLength(2);
  // Cada 3MF abre y trae un solo objeto.
  for (const n of n3) {
    const inner = unzipSync(zp[n]);
    const model = Object.keys(inner).find((k) => /3dmodel\.model$/i.test(k))!;
    expect((strFromU8(inner[model]).match(/<object /g) ?? []).length).toBe(1);
  }
  // Ida y vuelta del combinado.
  await page.getByRole('button', { name: 'Vaciar cama' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Vaciar cama' }).click();
  await expect.poll(() => S(page, (s) => s.objects.length)).toBe(0);
  const ch = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  (await ch).setFiles(comb.file);
  await expect.poll(() => S(page, (s) => s.objects.length), { timeout: 30000 }).toBe(2);
  console.log('QA25E reimport placas', await S(page, (s) => JSON.stringify({ plates: s.plates.map((p: any) => p.name), refs: s.objects.map((o: any) => [o.name, o.plateRef, o.position]) })));
  expect(errs, errs.join('\n')).toEqual([]);
});

test('pieza sin placa: se excluye con aviso y no sale en el ZIP; sin placas el diálogo es el de siempre', async ({ page }) => {
  const errs = await preparar(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 10, depth: 10, height: 10, name: 'Suelta', position: [-50, 5, -50] });
  await page.evaluate(() => {
    const w = window as any;
    w.__s.setState((st: any) => ({ objects: st.objects.map((o: any) => (o.name === 'Suelta' ? { ...o, plateRef: undefined } : o)) }));
  });
  await S(page, (s) => s.setSelection([]));
  const ref = await S(page, (s) => s.objects.find((o: any) => o.name === 'Suelta').plateRef);
  const dlg = await abrirDialogo(page);
  await dlg.getByRole('radio', { name: /^STL/ }).check();
  const nota = dlg.getByRole('note');
  console.log('QA25E ref suelta', String(ref), 'nota', await nota.allInnerTexts());
  await expect(nota.first()).toContainText(/1/);
  await page.screenshot({ path: `${EV}/export-sin-placa.png` });
  const { file } = await descargar(page, dlg, 'sinplaca.zip');
  expect(Object.keys(unzipSync(readFileSync(file)))).toHaveLength(2);

  // Sin placas: vaciar a una placa (borrar la 2) deja el diálogo normal.
  await S(page, (s) => s.deletePlate(s.plates[1].id));
  await S(page, (s) => s.plates.length > 1 && s.deletePlate(s.plates[1].id));
  const dlg2 = await abrirDialogo(page);
  await dlg2.getByRole('radio', { name: /^STL/ }).check();
  await expect(dlg2.getByText(/Piezas en \d placas/)).toHaveCount(0);
  const f = await descargar(page, dlg2, 'normal.stl');
  expect(f.sugerido).toMatch(/\.stl$/);
  expect(errs, errs.join('\n')).toEqual([]);
});
