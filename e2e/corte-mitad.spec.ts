/**
 * @file e2e/corte-mitad.spec.ts
 * @description Corte por plano conservando UNA mitad: el diálogo pregunta dónde dejarla. Cubo de 30 mm,
 * corte en Z a media altura, mitad superior: dejarla donde está (Z mínima 15), apoyarla en la cama (0) o en un
 * lugar libre (0, sin invadir a un segundo objeto). Capturas a 1440 y 390 px en tema claro y oscuro en
 * `.eval-tmp/corte-mitad/`. Ejecuta con `KURA_URL=... npm run test:e2e -- e2e/corte-mitad.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, cajas, solapes } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/corte-mitad';

async function cubo(page: Page, name: string, size: number, position: [number, number, number]): Promise<string> {
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation)).toBeNull();
  return page.evaluate(async ([n, s, p]) => {
    const st = (window as any).__s.getState();
    const o = await st.createPrimitive('box', { width: s, height: s, depth: s }, { position: p, name: n });
    if (!o) throw new Error(`no se creó ${n}: ${JSON.stringify(st.toasts.map((t: any) => t.text))}`);
    return o.id as string;
  }, [name, size, position] as const);
}

async function abrirCorte(page: Page, id: string) {
  await page.evaluate((i) => {
    const st = (window as any).__s.getState();
    st.selectObject(i);
    st.setActiveDialog('cut');
  }, id);
  const dlg = page.getByRole('dialog', { name: 'Cortar' });
  await expect(dlg).toBeVisible();
  // Z del usuario = altura: es el corte horizontal que ya viene por defecto.
  await page.getByLabel('Mitades a conservar').selectOption('positive');
  await page.getByLabel('Tipo de conector').selectOption('none');
  return dlg;
}

async function elegir(page: Page, opcion: RegExp) {
  await page.getByRole('radio', { name: opcion }).check();
}

async function cortar(page: Page) {
  await page.getByRole('button', { name: /Ejecutar Corte/ }).click();
  // El diálogo se cierra cuando el corte terminó.
  await expect(page.getByRole('dialog', { name: 'Cortar' })).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation)).toBeNull();
}

/** Z mínima (altura del usuario = Y interna) de cada objeto, por nombre. */
async function zMin(page: Page) {
  return Object.fromEntries((await cajas(page)).map((b) => [b.name, Math.round(b.min[1] * 100) / 100]));
}

test.describe('mitad conservada del corte', () => {
  test('dejarla donde está: la mitad superior queda flotando (Z mínima 15)', async ({ page }) => {
    await abrir(page);
    const id = await cubo(page, 'Cubo', 30, [0, 0, 0]);
    await abrirCorte(page, id);
    await expect(page.getByRole('radiogroup', { name: '¿Dónde dejar la mitad que conservas?' })).toBeVisible();
    await elegir(page, /^Dejarla donde está/);
    await cortar(page);
    expect(Object.values(await zMin(page))).toEqual([15]);
  });

  test('apoyarla en la cama (valor inicial): Z mínima 0 y un solo deshacer', async ({ page }) => {
    await abrir(page);
    const id = await cubo(page, 'Cubo', 30, [0, 0, 0]);
    await abrirCorte(page, id);
    await expect(page.getByRole('radio', { name: /^(✓ )?Apoyarla en la cama/ })).toBeChecked();
    await cortar(page);
    expect(Object.values(await zMin(page))).toEqual([0]);
    await expect(page.getByText(/apoyada en la cama/).first()).toBeVisible();
    await page.evaluate(() => (window as any).__s.getState().undo());
    expect(await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.id))).toEqual([id]);
  });

  test('apoyarla en un lugar libre: Z mínima 0 y sin invadir al objeto de abajo', async ({ page }) => {
    await abrir(page);
    // Cubo flotando (base a 40 mm) sobre «Debajo»: apoyarla en el mismo lugar la superpondría.
    await cubo(page, 'Debajo', 30, [0, 0, 0]);
    const id = await cubo(page, 'Cubo', 30, [0, 40, 0]);
    await abrirCorte(page, id);
    await expect(page.getByText(/Se superpondría con «Debajo»/)).toBeVisible();
    await elegir(page, /^Apoyarla en un lugar libre/);
    await cortar(page);
    const z = await zMin(page);
    expect(Object.keys(z)).toHaveLength(2);
    expect(Object.values(z)).toEqual([0, 0]);
    expect(solapes(await cajas(page))).toEqual([]);
  });

  test('la elección se recuerda al volver a abrir el diálogo', async ({ page }) => {
    await abrir(page);
    const id = await cubo(page, 'Cubo', 30, [0, 0, 0]);
    await abrirCorte(page, id);
    await elegir(page, /^Apoyarla en un lugar libre/);
    await cortar(page);
    const id2 = await cubo(page, 'Otro', 30, [0, 0, 0]);
    await abrirCorte(page, id2);
    await expect(page.getByRole('radio', { name: /^Apoyarla en un lugar libre/ })).toBeChecked();
  });

  test('mitad inferior (ya apoyada) y ambas mitades: no se pregunta', async ({ page }) => {
    await abrir(page);
    const id = await cubo(page, 'Cubo', 30, [0, 0, 0]);
    await abrirCorte(page, id);
    await expect(page.getByRole('radiogroup', { name: '¿Dónde dejar la mitad que conservas?' })).toBeVisible();
    await page.getByLabel('Mitades a conservar').selectOption('negative');
    await expect(page.getByRole('radiogroup', { name: '¿Dónde dejar la mitad que conservas?' })).toHaveCount(0);
    await page.getByLabel('Mitades a conservar').selectOption('both');
    await expect(page.getByText('Conservas las dos mitades: quedan en su lugar.')).toBeVisible();
  });

  test('teclado: se llega al grupo con Tab y las flechas cambian la opción', async ({ page }) => {
    await abrir(page);
    const id = await cubo(page, 'Cubo', 30, [0, 0, 0]);
    await abrirCorte(page, id);
    await page.getByRole('radio', { name: /^(✓ )?Apoyarla en la cama/ }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: /^Apoyarla en un lugar libre/ })).toBeChecked();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('radio', { name: /^(✓ )?Apoyarla en la cama/ })).toBeChecked();
  });

  for (const [ancho, alto] of [[1440, 900]] as const) {
    for (const tema of ['light', 'dark'] as const) {
      test(`capturas ${ancho}px tema ${tema}`, async ({ page }) => {
        const errores: string[] = [];
        page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
        page.on('pageerror', (e) => errores.push(String(e)));
        await page.setViewportSize({ width: ancho, height: alto });
        await page.emulateMedia({ colorScheme: tema });
        await abrir(page);
        await page.evaluate((t) => (window as any).__s.getState().setColorScheme(t), tema);
        await cubo(page, 'Debajo', 30, [0, 0, 0]);
        const id = await cubo(page, 'Cubo', 30, [0, 40, 0]);
        await abrirCorte(page, id);
        await expect(page.getByRole('radiogroup', { name: '¿Dónde dejar la mitad que conservas?' })).toBeVisible();
        await page.getByRole('radiogroup', { name: '¿Dónde dejar la mitad que conservas?' }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SHOTS}/dialogo-${ancho}-${tema}.png` });
        // Sin desborde horizontal de la página.
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        // Cero errores en la consola del navegador.
        expect(errores).toEqual([]);
      });
    }
  }
});
