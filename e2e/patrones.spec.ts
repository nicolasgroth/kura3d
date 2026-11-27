/**
 * @file e2e/patrones.spec.ts
 * @description Recorrido del panel «Patrón» (repetir en fila, rejilla o círculo, y espejo con copia). ESCRITO SIN
 * EJECUTAR: lo corre QA en navegador real. Cubre: abrir desde la paleta y desde Acciones, foco inicial, vista previa
 * (el resumen se recalcula al cambiar un valor), los tres tipos, «Aplicar» (grupo con nombre, un paso de deshacer),
 * el aviso de solape, el tope de copias, Esc y «Volver», y que a 1024 px el panel no desborda. A 1024 y 1440 px, tema
 * claro y oscuro. Revisa también que la consola no tenga errores.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';
import { agregarForma } from './agregar-helpers';
import { abrir as abrirConR3f } from './qa12-helpers';

const store = <T,>(page: Page, fn: (s: any) => T): Promise<T> => page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());

const panel = (page: Page) => page.getByRole('dialog', { name: 'Patrón' });
const resumen = (page: Page) => page.getByTestId('pattern-summary');

/** Un cubo seleccionado. */
async function unCubo(page: Page) {
  await abrir(page);
  await agregarForma(page, 'Cubo');
}

/** Abre el panel desde la paleta de comandos. */
async function abrirDesdePaleta(page: Page) {
  await page.keyboard.press('Control+K');
  await page.getByRole('combobox', { name: 'Buscar comandos' }).fill('Patrón');
  await page.getByRole('option', { name: /Patrón…/ }).first().click();
  await expect(panel(page)).toBeVisible();
}

async function numero(page: Page, nombre: string, valor: string) {
  const campo = page.getByRole('spinbutton', { name: nombre, exact: true });
  await campo.fill(valor);
  await campo.press('Enter');
}

for (const width of [1024, 1440]) {
  for (const tema of ['light', 'dark'] as const) {
    test.describe(`patrón, ${width} px, tema ${tema}`, () => {
      test.use({ viewport: { width, height: 768 }, colorScheme: tema });

      test('la paleta abre el panel con el foco en el tipo y el resumen listo; no desborda', async ({ page }) => {
        const errores: string[] = [];
        page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
        await unCubo(page);
        await abrirDesdePaleta(page);
        await expect(page.getByTestId('pattern-kind-linear')).toBeFocused();
        await expect(resumen(page)).toContainText('Se crearán 2 piezas nuevas');
        const caja = await panel(page).boundingBox();
        expect(caja!.x + caja!.width).toBeLessThanOrEqual(width);
        // Ver el panel no cambia la escena.
        expect(await store(page, (s) => s.objects.length)).toBe(1);
        expect(errores).toEqual([]);
      });

      test('cambiar la cantidad recalcula el resumen; «Aplicar» crea el grupo en un paso de deshacer', async ({ page }) => {
        await unCubo(page);
        await abrirDesdePaleta(page);
        await numero(page, 'Piezas en total', '4');
        await expect(resumen(page)).toContainText('Se crearán 3 piezas nuevas');
        const pasos = await store(page, (s) => s.past.length);
        await page.getByTestId('pattern-apply').click();
        await expect(panel(page)).toBeHidden();
        expect(await store(page, (s) => s.objects.length)).toBe(4);
        expect(await store(page, (s) => s.groups.map((g: any) => g.name))).toEqual([expect.stringMatching(/^Patrón de .* ×4$/)]);
        expect(await store(page, (s) => s.past.length)).toBe(pasos + 1);
        await page.keyboard.press('Control+z');
        expect(await store(page, (s) => s.objects.length)).toBe(1);
      });

      test('circular y espejo: sus campos, y el espejo conserva el original', async ({ page }) => {
        await unCubo(page);
        await abrirDesdePaleta(page);
        await page.getByTestId('pattern-kind-circular').click();
        await expect(page.getByRole('spinbutton', { name: 'Ángulo total (°)' })).toBeVisible();
        await page.getByTestId('pattern-center-point').click();
        await expect(page.getByTestId('pattern-point-fields')).toBeVisible();
        await page.getByTestId('pattern-kind-mirror').click();
        await expect(page.getByTestId('pattern-keep')).toBeChecked();
        await page.getByTestId('pattern-base-bed').click();
        await numero(page, 'Desplazar el plano (mm)', '30');
        await expect(resumen(page)).toContainText('Se crearán 1 pieza nueva');
        await page.getByTestId('pattern-apply').click();
        await expect(panel(page)).toBeHidden();
        expect(await store(page, (s) => s.objects.length)).toBe(2);
      });

      test('el solape se avisa con texto y el tope de copias bloquea «Aplicar»', async ({ page }) => {
        await unCubo(page);
        await abrirDesdePaleta(page);
        await numero(page, 'Distancia (mm)', '2');
        await expect(page.getByTestId('pattern-overlap')).toContainText('podrían solaparse');
        await page.getByTestId('pattern-grid').check();
        await numero(page, 'Piezas en total', '400');
        await numero(page, 'Filas', '2');
        await expect(page.getByTestId('pattern-problem')).toContainText('máximo es 500');
        await expect(page.getByTestId('pattern-apply')).toBeDisabled();
      });

      test('Esc y «Volver» cierran el panel y devuelven el foco', async ({ page }) => {
        await unCubo(page);
        await abrirDesdePaleta(page);
        await page.keyboard.press('Escape');
        await expect(panel(page)).toBeHidden();
        await abrirDesdePaleta(page);
        await panel(page).getByRole('button', { name: /Volver/ }).click();
        await expect(panel(page)).toBeHidden();
      });
    });
  }
}

test.describe('patrón: encuadre de la vista previa', () => {
  test.use({ viewport: { width: 1280, height: 768 } });

  const cajaEnVista = (page: Page) => page.evaluate(() => {
    const w = window as any;
    const st = w.__r3f.getState();
    const cam = st.camera;
    cam.updateMatrixWorld();
    const rc = st.gl.domElement.getBoundingClientRect();
    const pts: number[][] = [];
    st.scene.traverse((o: any) => {
      if (o.parent?.name !== 'pattern-preview' || !o.isInstancedMesh) return;
      const m = new o.matrix.constructor();
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      for (let k = 0; k < o.count; k++) {
        o.getMatrixAt(k, m);
        for (let i = 0; i < 8; i++) {
          const v = new b.min.constructor(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(m).applyMatrix4(o.matrixWorld).project(cam);
          pts.push([v.x, v.y, v.z]);
        }
      }
    });
    return { n: pts.length, dentro: pts.every(([x, y, z]) => Math.abs(x) <= 1 && Math.abs(y) <= 1 && z >= -1 && z <= 1) };
  });

  test('una fila larga de copias de una pieza chica entra entera en el encuadre y la cámara no se acerca sola', async ({ page }) => {
    await abrirConR3f(page);
    await agregarForma(page, 'Cubo');
    await abrirDesdePaleta(page);
    await expect(page.getByTestId('pattern-summary')).toContainText('Se crearán');
    const antes = await page.evaluate(() => (window as any).__r3f.getState().camera.position.length());
    await numero(page, 'Piezas en total', '40');
    await numero(page, 'Distancia (mm)', '60');
    await expect(page.getByTestId('pattern-summary')).toContainText('Se crearán 39 piezas nuevas');
    await expect.poll(async () => { const r = await cajaEnVista(page); return r.n > 0 && r.dentro; }, { message: 'todas las copias dentro del encuadre', timeout: 8000 }).toBe(true);
    const despues = await page.evaluate(() => (window as any).__r3f.getState().camera.position.length());
    expect(despues).toBeGreaterThanOrEqual(antes - 0.01);
    // Cambiar a pocas copias no acerca la cámara: se queda donde está.
    await numero(page, 'Piezas en total', '3');
    await expect(page.getByTestId('pattern-summary')).toContainText('Se crearán 2 piezas nuevas');
    await page.waitForTimeout(800);
    const final = await page.evaluate(() => (window as any).__r3f.getState().camera.position.length());
    expect(final).toBeGreaterThanOrEqual(despues - 0.5);
  });
});
