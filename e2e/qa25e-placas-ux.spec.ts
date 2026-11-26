/**
 * @file e2e/qa25e-placas-ux.spec.ts
 * @description QA 25-nov (E) de la interfaz de placas (usabilidad C): «Mover a placa» en el primer nivel del menú
 * contextual solo con 2+ placas, insignia de placa en la lista de escena, aviso «Placa 2 creada», el inspector
 * muestra X/Z respecto de la placa con su nota y al editar un valor la pieza no salta (cambia exactamente lo editado),
 * mover con el panel o con las flechas cambia la placa y la placa activa, y en disposición de armado la nota no aplica.
 * Evidencia en `.eval-tmp/qa25e/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir, cmd } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25e';
test.use({ viewport: { width: 1440, height: 900 } });

const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> =>
  page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());
const pos = (page: Page, n: string) => S(page, (s) => s.objects.find((o: any) => o.name === 'Cubo').position as number[]);

test('Mover a placa: ausente con una placa, en el primer nivel con dos; insignia y aviso al crear la placa', async ({ page }) => {
  const errs = await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 20, name: 'Cubo', position: [0, 10, 0] });
  const fila = page.getByRole('treeitem').first();
  await fila.click();
  await fila.press('Shift+F10');
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Mover a placa/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('plate-badge')).toHaveCount(0);

  await page.getByTestId('plate-add-first').click();
  await expect(page.getByText(/Placa 2 creada/).first()).toBeVisible();
  await page.screenshot({ path: `${EV}/placa2-creada.png` });
  await S(page, (s) => s.dismissAllToasts?.());
  await expect(page.getByTestId('plate-badge').first()).toBeVisible();
  const lista = await page.getByRole('treeitem').first().innerText();
  console.log('QA25E fila con insignia:', JSON.stringify(lista));
  // La insignia muestra un rótulo corto por posición («P1») y lleva el nombre completo en su nombre accesible.
  expect(lista).toMatch(/P1/);
  await expect(page.getByTestId('plate-badge').first()).toHaveAttribute('aria-label', /Placa 1/);

  await fila.click();
  await fila.press('Shift+F10');
  const item = page.getByRole('menuitem', { name: /Mover a placa/ });
  await expect(item).toBeVisible();
  await page.screenshot({ path: `${EV}/menu-mover-placa.png` });
  await item.click();
  const sub = page.getByRole('menuitem', { name: /Placa 2/ });
  await expect(sub.first()).toBeVisible();
  const pasos = await S(page, (s) => s.past.length);
  await sub.first().click();
  expect(await S(page, (s) => s.objects[0].plateRef === s.plates[1].id)).toBe(true);
  expect(await S(page, (s) => s.past.length)).toBe(pasos + 1);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('inspector: X/Z relativos a la placa con nota; al editar un valor la pieza cambia exactamente lo editado', async ({ page }) => {
  const errs = await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 20, name: 'Cubo', position: [0, 10, 0] });
  await S(page, (s) => s.createPlate());
  const o2 = await S(page, (s) => s.plates[1].origin as number[]);
  await cmd(page, 'transform_object', { objectId: await S(page, (s) => s.objects[0].id), position: [o2[0] + 12, 10, 7] }).catch(() => undefined);
  await S(page, (s) => { const o = s.objects[0]; s.setObjectTransform(o.id, { position: [296 + 12, o.position[1], 7] }, true); });
  await S(page, (s) => s.setSelection([s.objects[0].id]));
  const antes = await pos(page, 'Cubo');
  console.log('QA25E origen2', JSON.stringify(o2), 'pos mundo', JSON.stringify(antes), 'placa', await S(page, (s) => s.objects[0].plateRef === s.plates[1].id));
  const nota = page.getByTestId('plate-relative-note');
  await expect(nota).toBeVisible();
  await expect(nota).toContainText(/Posición respecto de Placa 2/);
  const x = page.getByRole("spinbutton", { name: "Posición (mm) X", exact: true }).first();
  const z = page.getByRole("spinbutton", { name: "Posición (mm) Y", exact: true }).first();
  const vx = await x.inputValue(), vz = await z.inputValue();
  console.log('QA25E campos', vx, vz);
  await page.screenshot({ path: `${EV}/inspector-placa-claro.png` });
  expect(Math.abs(parseFloat(vx.replace(',', '.')))).toBeLessThan(100);
  // Editar X: +5 respecto de lo que muestra.
  await x.fill(String(parseFloat(vx.replace(',', '.')) + 5));
  await x.press('Enter');
  await page.waitForTimeout(400);
  const d1 = await pos(page, 'Cubo');
  const delta1 = d1.map((v, i) => +(v - antes[i]).toFixed(3));
  console.log('QA25E delta tras editar X', JSON.stringify(delta1));
  expect(delta1.filter((v) => v !== 0)).toHaveLength(1);
  expect(Math.abs(delta1.find((v) => v !== 0)!)).toBeCloseTo(5, 2);
  await z.fill(String(parseFloat(vz.replace(',', '.')) - 3));
  await z.press('Enter');
  await page.waitForTimeout(400);
  const d2 = await pos(page, 'Cubo');
  const delta2 = d2.map((v, i) => +(v - d1[i]).toFixed(3));
  console.log('QA25E delta tras editar Z', JSON.stringify(delta2));
  expect(delta2.filter((v) => v !== 0)).toHaveLength(1);
  expect(Math.abs(delta2.find((v) => v !== 0)!)).toBeCloseTo(3, 2);
  expect(await S(page, (s) => s.objects[0].plateRef === s.plates[1].id)).toBe(true);
  // Deshacer vuelve a la posición anterior de un paso.
  await page.keyboard.press('Control+z');
  expect((await pos(page, 'Cubo')).map((v, i) => +(v - d1[i]).toFixed(3))).toEqual([0, 0, 0]);

  // Disposición de armado: la nota no aplica.
  await S(page, (s) => s.setLayout('assembly'));
  await page.waitForTimeout(400);
  console.log('QA25E nota en armado:', await page.getByTestId('plate-relative-note').count());
  await page.screenshot({ path: `${EV}/inspector-armado.png` });
  expect(await page.getByTestId('plate-relative-note').count(), 'en armado la posición relativa a la placa no aplica').toBe(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('mover con el panel o con las flechas a la otra cama cambia la placa y la placa activa', async ({ page }) => {
  const errs = await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 20, name: 'Cubo', position: [0, 10, 0] });
  await S(page, (s) => s.createPlate());
  await S(page, (s) => s.setActivePlate(s.plates[0].id));
  await S(page, (s) => s.setSelection([s.objects[0].id]));
  // Panel: X relativo = 296 (centro de la placa 2 medido desde la placa 1).
  const x = page.getByRole("spinbutton", { name: "Posición (mm) X", exact: true }).first();
  await x.fill('296');
  await x.press('Enter');
  await page.waitForTimeout(500);
  const e1 = await S(page, (s) => ({ p2: s.objects[0].plateRef === s.plates[1].id, activa: s.activePlateId === s.plates[1].id, x: s.objects[0].position[0] }));
  console.log('QA25E panel', JSON.stringify(e1));
  expect(e1.p2).toBe(true);
  expect(e1.activa).toBe(true);
  await page.keyboard.press('Control+z');
  expect(await S(page, (s) => s.objects[0].plateRef === s.plates[0].id)).toBe(true);

  // Flechas: pegado al borde de la placa 1, empujar con Mayús+flecha hasta cruzar.
  await S(page, (s) => { s.setObjectTransform(s.objects[0].id, { position: [127, 10, 0] }, true); s.setActivePlate(s.plates[0].id); });
  await S(page, (s) => s.setSelection([s.objects[0].id]));
  await page.locator('canvas').first().hover({ position: { x: 5, y: 5 } }).catch(() => undefined);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  let cruzo = false;
  for (let i = 0; i < 60 && !cruzo; i += 1) {
    await page.keyboard.press('Shift+ArrowRight');
    cruzo = await S(page, (s) => s.objects[0].plateRef === s.plates[1].id);
  }
  const e2 = await S(page, (s) => ({ p2: s.objects[0].plateRef === s.plates[1].id, activa: s.activePlateId === s.plates[1].id, x: s.objects[0].position[0] }));
  console.log('QA25E flechas', JSON.stringify(e2));
  expect(e2.p2, JSON.stringify(e2)).toBe(true);
  expect(e2.activa, JSON.stringify(e2)).toBe(true);
  expect(errs, errs.join('\n')).toEqual([]);
});
