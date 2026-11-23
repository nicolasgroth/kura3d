/**
 * @file e2e/ux6-vista-barra.spec.ts
 * @description Vista sin cama y barra lateral de tres estados: el conmutador «Sin cama» (botón, tecla B,
 * paleta y menú del fondo) quita la cama y las sombras del visor sin tocar la geometría, deja orbitar bajo
 * Z=0 y se recuerda al recargar; el tirador recorre completa → compacta → oculta, su menú lleva directo a
 * un estado, la elección sobrevive a recargar y entrar/salir del modo sin distracciones no la cambia.
 * Capturas en `.eval-tmp/ux6/`. Ejecuta con `KURA_URL=… npx playwright test e2e/ux6-vista-barra.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux6';

async function conR3f(page: Page) {
  await page.evaluate(async () => {
    const w = window as any;
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /react-three_fiber/.test(n));
    for (const u of urls) {
      const m = await import(/* @vite-ignore */ u);
      if (m._roots) w.__r3f = [...m._roots.values()][0].store;
    }
  });
}

/** Cuenta mallas de la cama (rejilla y placa) presentes en la escena 3D. */
const camaEnEscena = (page: Page) =>
  page.evaluate(() => {
    const scene = (window as any).__r3f.getState().scene;
    let grids = 0;
    scene.traverse((o: any) => { if (o.type === 'GridHelper') grids += 1; });
    return grids;
  });

const polarMax = (page: Page) => page.evaluate(() => (window as any).__r3f.getState().controls?.maxPolarAngle ?? null);

test.describe('ux6: vista sin cama', () => {
  test('el conmutador oculta la cama sin tocar la geometría y se recuerda en la sesión', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page);
    await conR3f(page);
    await page.evaluate(() => (window as any).__s.getState().createStarterCube());
    await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(1);
    const geom = () => page.evaluate(() => { const o = (window as any).__s.getState().objects[0]; return JSON.stringify([o.position, o.scale, o.mesh.positions.length]); });
    const before = await geom();
    const pasos = await page.evaluate(() => (window as any).__s.getState().past.length);

    const btn = page.getByTestId('bed-toggle');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await expect(btn).toHaveAttribute('title', /B\)$/);
    expect(await camaEnEscena(page)).toBe(1);
    expect(await polarMax(page)).toBeLessThan(Math.PI);

    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.kura-app')).toHaveAttribute('data-bed', 'off');
    await expect.poll(() => camaEnEscena(page)).toBe(0);
    expect(await polarMax(page)).toBeCloseTo(Math.PI, 5);
    expect(await geom()).toBe(before);
    expect(await page.evaluate(() => (window as any).__s.getState().past.length)).toBe(pasos);
    await page.screenshot({ path: `${SHOTS}/vista-sin-cama-1440.png` });

    // Recargar la pestaña conserva la vista (sessionStorage), no el proyecto.
    await page.reload();
    await abrir(page);
    await conR3f(page);
    await expect(page.getByTestId('bed-toggle')).toHaveAttribute('aria-pressed', 'true');

    // Tecla B y paleta de comandos vuelven a mostrarla y ocultarla.
    await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => undefined);
    await page.keyboard.press('b');
    await expect(page.getByTestId('bed-toggle')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => camaEnEscena(page)).toBe(1);
    await page.keyboard.press('Control+k');
    await page.keyboard.type('sin cama');
    await page.getByRole('option', { name: /Vista sin cama/ }).first().click();
    await expect(page.getByTestId('bed-toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  test('el menú del fondo del visor ofrece la vista sin cama; el proyecto no la guarda', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page);
    const canvas = page.locator('.kura-viewport-wrap canvas').first();
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.12, { button: 'right' });
    const item = page.getByRole('menuitem', { name: /Vista sin cama/ });
    await expect(item).toBeVisible();
    await item.click();
    await expect(page.getByTestId('bed-toggle')).toHaveAttribute('aria-pressed', 'true');
    const doc = await page.evaluate(async () => {
      const { captureProject } = await import('/src/store/useKuraStore.ts');
      return JSON.stringify(captureProject((window as any).__s.getState()));
    });
    expect(doc).not.toMatch(/showBed/);
  });
});

test.describe('ux6: barra lateral de tres estados', () => {
  test('el tirador recorre los estados, el menú elige uno y la elección se recuerda', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page);
    await page.evaluate(() => (window as any).__s.getState().setLeftSidebarMode('full'));
    const aside = page.locator('#kura-shapes-panel');
    const handle = page.getByTestId('left-sidebar-handle');
    await expect(aside).toHaveAttribute('data-mode', 'full');
    await expect(handle).toHaveAccessibleName(/completa: pasar a compacta/);

    await handle.click();
    await expect(aside).toHaveAttribute('data-mode', 'compact');
    expect(Math.round((await aside.boundingBox())!.width)).toBe(56);
    const rail = page.getByTestId('left-sidebar-rail');
    // Cada botón del rail tiene nombre accesible y tooltip.
    const sinNombre = await rail.locator('button').evaluateAll((bs) => bs.filter((b) => !b.getAttribute('aria-label') || !b.getAttribute('title')).length);
    expect(sinNombre).toBe(0);
    for (const name of ['Formas', 'Cubo', 'Disco', 'Rosca', 'Vaciar cama', 'SVG']) {
      await expect(rail.locator(`[aria-label*="${name}"]`).first()).toBeVisible();
    }
    await page.screenshot({ path: `${SHOTS}/barra-compacta-1440.png` });

    // Pestaña Escena en compacto: un botón la expande a completa.
    await rail.getByRole('tab', { name: /Escena/ }).click();
    await rail.getByRole('button', { name: /Expandir la barra/ }).click();
    await expect(aside).toHaveAttribute('data-mode', 'full');
    await expect(page.getByRole('tab', { name: /Escena/, selected: true })).toBeVisible();

    await handle.click();
    await handle.click();
    await expect(aside).toHaveAttribute('data-mode', 'hidden');
    await handle.click();
    await expect(aside).toHaveAttribute('data-mode', 'full');

    // Menú del tirador (clic derecho y teclado) para ir directo a un estado.
    await handle.click({ button: 'right' });
    const menu = page.getByTestId('left-sidebar-menu');
    await expect(menu.getByRole('menuitemradio', { name: /Completa/ })).toHaveAttribute('aria-checked', 'true');
    await menu.getByRole('menuitemradio', { name: /Oculta/ }).click();
    await expect(aside).toHaveAttribute('data-mode', 'hidden');
    await handle.focus();
    await page.keyboard.press('Shift+F10');
    await expect(menu).toBeVisible();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(aside).toHaveAttribute('data-mode', 'compact');
    await page.keyboard.press('Shift+F10');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(handle).toBeFocused();

    await page.reload();
    await abrir(page);
    await expect(page.locator('#kura-shapes-panel')).toHaveAttribute('data-mode', 'compact');
  });

  test('entrar y salir del modo sin distracciones no cambia el estado de la barra', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page);
    for (const mode of ['compact', 'hidden', 'full'] as const) {
      await page.evaluate((m) => (window as any).__s.getState().setLeftSidebarMode(m), mode);
      await page.locator('body').click({ position: { x: 700, y: 5 } }).catch(() => undefined);
      await page.keyboard.press('Control+Shift+Enter');
      await expect(page.locator('.kura-app')).toHaveAttribute('data-density', 'zen');
      await page.keyboard.press('Control+Shift+Enter');
      await expect(page.locator('.kura-app')).not.toHaveAttribute('data-density', 'zen');
      await expect(page.locator('#kura-shapes-panel')).toHaveAttribute('data-mode', mode);
      // Y la densidad «compacta» global no encoge la barra completa.
      await page.evaluate(() => (window as any).__s.getState().setUiDensity('compact'));
      await expect(page.locator('#kura-shapes-panel')).toHaveAttribute('data-mode', mode);
      if (mode === 'full') expect((await page.locator('#kura-shapes-panel').boundingBox())!.width).toBeGreaterThan(200);
      await page.evaluate(() => (window as any).__s.getState().setUiDensity('full'));
    }
  });

  test('en móvil la barra sigue en la hoja inferior aunque la preferencia sea compacta', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await abrir(page);
    await page.evaluate(() => (window as any).__s.getState().setLeftSidebarMode('compact'));
    await expect(page.getByTestId('left-sidebar-rail')).toHaveCount(0);
    await expect(page.getByTestId('left-sidebar-handle')).toBeHidden();
    await page.screenshot({ path: `${SHOTS}/movil-390.png` });
  });
});
