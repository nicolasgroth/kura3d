/**
 * @file e2e/ux6-vista-barra.spec.ts
 * @description Vista sin cama y barra lateral de Escena (mostrar u ocultar): el conmutador «Sin cama» (botón, tecla B,
 * paleta y menú del fondo) quita la cama y las sombras del visor sin tocar la geometría, deja orbitar bajo
 * Z=0 y se recuerda al recargar; el tirador muestra u oculta la Escena (el visor gana el ancho),
 * la elección sobrevive a recargar y entrar/salir del modo sin distracciones no la cambia.
 * Capturas en `.eval-tmp/ux6/`. Ejecuta con `KURA_URL=… npx playwright test e2e/ux6-vista-barra.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
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

test.describe('ux6: barra lateral de Escena (mostrar u ocultar)', () => {
  test('el tirador muestra u oculta la Escena, el visor gana el ancho y la elección se recuerda', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page);
    await page.evaluate(() => (window as any).__s.getState().setLeftSidebarMode('full'));
    const aside = page.locator('#kura-shapes-panel');
    const handle = page.getByTestId('left-sidebar-handle');
    await expect(aside).toHaveAttribute('data-mode', 'full');
    await expect(handle).toHaveAccessibleName('Ocultar la escena');
    await expect(handle).toHaveAttribute('aria-expanded', 'true');
    const visorAntes = (await page.locator('canvas').first().boundingBox())!.width;

    await handle.click();
    await expect(aside).toHaveAttribute('data-mode', 'hidden');
    await expect(handle).toHaveAccessibleName('Mostrar la escena');
    await expect.poll(async () => (await page.locator('canvas').first().boundingBox())!.width).toBeGreaterThan(visorAntes + 150);
    await handle.focus();
    await page.keyboard.press('Enter');
    await expect(aside).toHaveAttribute('data-mode', 'full');
    await handle.click();

    await page.reload();
    await abrir(page);
    await expect(page.locator('#kura-shapes-panel')).toHaveAttribute('data-mode', 'hidden');
  });

  test('entrar y salir del modo sin distracciones no cambia el estado de la barra', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page);
    for (const mode of ['hidden', 'full'] as const) {
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

});
