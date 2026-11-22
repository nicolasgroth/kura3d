/**
 * @file e2e/qa11-grupos.spec.ts
 * @description QA11: grupos y árbol de escena. Agrupar y anidar con un paso de deshacer cada uno, Ctrl+G sin efecto
 * dentro de un campo de texto, combinar conserva colores, separar cuerpos conserva colores (hoy FALLA: pierde los
 * colores por cuerpo), reescalar un grupo con el inspector no despega la pieza de la cama. Usa el store del servidor
 * de desarrollo (import dinámico de /src). Requiere `@playwright/test` y la web en KURA_URL (por defecto 5210).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';

const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5210/';

async function abrir(page: Page) {
  await page.goto(URL);
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  await page.evaluate(async () => { (window as unknown as { __s: unknown }).__s = (await import('/src/store/useKuraStore.ts')).useKuraStore; });
}

async function agregar(page: Page, nombres: string[]) {
  for (const n of nombres) {
    await page.getByRole('button', { name: n, exact: true }).first().click();
    await page.waitForTimeout(300);
  }
}

test('agrupar, anidar y deshacer: un paso por acción; Ctrl+G no actúa dentro de un campo', async ({ page }) => {
  await abrir(page);
  await agregar(page, ['Cubo', 'Esfera', 'Cilindro']);
  const estado = () => page.evaluate(() => {
    const s = (window as any).__s.getState();
    return { grupos: s.groups.length, pasos: s.past.length, anidados: s.groups.filter((g: any) => g.parentId).length };
  });
  const base = await estado();
  await page.evaluate(() => { const s = (window as any).__s.getState(); s.groupObjects([s.objects[0].id, s.objects[1].id], 'A'); });
  const g1 = await estado();
  expect(g1.grupos).toBe(1);
  expect(g1.pasos).toBe(base.pasos + 1);
  await page.evaluate(() => { const s = (window as any).__s.getState(); s.groupObjects(s.objects.map((o: any) => o.id), 'B'); });
  const g2 = await estado();
  expect(g2.grupos).toBe(2);
  expect(g2.anidados).toBe(1);
  await page.keyboard.press('Control+z');
  expect((await estado()).grupos).toBe(1);
  await page.keyboard.press('Control+z');
  expect((await estado()).grupos).toBe(0);
  // Ctrl+G dentro del buscador del árbol no agrupa.
  await page.getByRole('tab', { name: /Escena/ }).click();
  await page.evaluate(() => { const s = (window as any).__s.getState(); s.selectObject(s.objects[0].id); s.selectObject(s.objects[1].id, true); });
  await page.getByRole('textbox', { name: 'Buscar en la escena' }).click();
  const antes = await estado();
  await page.keyboard.press('Control+g');
  expect(await estado()).toEqual(antes);
});

test('combinar conserva colores y separar cuerpos los devuelve con su color (BUG conocido)', async ({ page }) => {
  await abrir(page);
  await agregar(page, ['Cubo', 'Cubo']);
  await page.evaluate(() => { const s = (window as any).__s.getState(); s.combineObjects(s.objects.map((o: any) => o.id)); });
  const combinado = await page.evaluate(() => {
    const o = (window as any).__s.getState().objects[0];
    return [...new Set(Array.from(o.mesh.faceColors ?? []).map(String))];
  });
  expect(combinado.length).toBe(2);
  await page.evaluate(async () => { const s = (window as any).__s.getState(); await s.separateBodies(s.objects[0].id); });
  const colores = await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.mesh.faceColors ? [...new Set(Array.from(o.mesh.faceColors).map(String))] : [o.color]).flat());
  // Esperado: cada pieza conserva el color con el que se combinó (dos colores distintos).
  expect(new Set(colores).size).toBe(2);
});

test('escalar un grupo con el inspector mantiene la base en la cama (y = 0)', async ({ page }) => {
  await abrir(page);
  await agregar(page, ['Cubo', 'Esfera']);
  await page.evaluate(() => { const s = (window as any).__s.getState(); s.groupObjects(s.objects.map((o: any) => o.id), 'G'); });
  await page.evaluate(() => { (window as any).__s.getState().transformSelectionRigid({ scale: 2 }, { recordHistory: true }); });
  const ys = await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.position[1]));
  for (const y of ys) expect(Math.abs(y)).toBeLessThan(1e-6);
});
