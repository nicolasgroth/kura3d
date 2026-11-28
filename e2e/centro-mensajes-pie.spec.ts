/**
 * @file e2e/centro-mensajes-pie.spec.ts
 * @description Pie del visor con el centro de mensajes: a 1024x768 y 1280x720, con los paneles laterales abiertos,
 * una pieza seleccionada y mensajes de los tres tipos, el chip «Tamaño», el rótulo «Cama:», los iconos del centro de
 * mensajes, la píldora de Consejo y la tira de placas no se solapan entre sí ni se salen del visor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

type Caja = { x: number; y: number; width: number; height: number };
const solapa = (a: Caja, b: Caja) => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

const ELEMENTOS: Array<[string, string]> = [
  ['chip Tamaño', '.kura-hud-bottom > .kura-hud-card'],
  ['rótulo Cama', '.kura-bed-card'],
  ['iconos del centro de mensajes', '[data-testid="toast-center"] .kura-toast-center-icons'],
  ['píldora de Consejo', '.kura-protip-pill'],
  ['tira de placas', '.kura-plate-strip'],
];

async function preparar(page: Page) {
  await abrir(page);
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    const obj = await s.createPrimitive('box', { width: 30, height: 30, depth: 30 }, {});
    s.setSelection([obj.id]);
    s.addToast('Información de prueba', 'info');
    s.addToast('Advertencia de prueba', 'warning');
    s.addToast('Error de prueba', 'error');
  });
}

for (const [w, h] of [[1024, 768], [1280, 720]] as const) {
  test(`el pie del visor no solapa ni se sale del visor a ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await preparar(page);
    await expect(page.getByTestId('toast-center')).toBeVisible();
    const visor = (await page.locator('.kura-viewport-wrap').first().boundingBox())!;
    const cajas: Array<[string, Caja]> = [];
    for (const [nombre, sel] of ELEMENTOS) {
      const loc = page.locator(sel).first();
      if (!(await loc.count()) || !(await loc.isVisible())) continue;
      cajas.push([nombre, (await loc.boundingBox())!]);
    }
    expect(cajas.map(([n]) => n)).toEqual(expect.arrayContaining(['chip Tamaño', 'rótulo Cama', 'iconos del centro de mensajes']));
    for (let i = 0; i < cajas.length; i++) {
      const [n, c] = cajas[i];
      if (n !== 'tira de placas') {
        expect(c.x, `${n} se sale por la izquierda`).toBeGreaterThanOrEqual(visor.x - 0.5);
        expect(c.x + c.width, `${n} se sale por la derecha`).toBeLessThanOrEqual(visor.x + visor.width + 0.5);
        expect(c.y + c.height, `${n} se sale por abajo`).toBeLessThanOrEqual(visor.y + visor.height + 0.5);
      }
      for (let j = i + 1; j < cajas.length; j++) {
        expect(solapa(c, cajas[j][1]), `${n} solapa con ${cajas[j][0]}`).toBe(false);
      }
    }
  });
}

// Pieza fuera del volumen: el rótulo «Cama», el aviso, «Ajustar a la impresora…» y «Repartir en placas…» se leen
// completos (envuelven a otra línea dentro de la tarjeta) y no solapan con el chip «Tamaño», los iconos ni el Consejo.
for (const [w, h] of [[1024, 768], [1280, 720]] as const) {
  test(`con una pieza fuera de volumen el pie se lee completo y no solapa a ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await abrir(page);
    await page.evaluate(async () => {
      const s = (window as any).__s.getState();
      const obj = await s.createPrimitive('box', { width: 600, height: 40, depth: 40 }, {});
      s.setSelection([obj.id]);
      s.addToast('Advertencia de prueba', 'warning');
    });
    const tarjeta = page.locator('.kura-bed-card[data-oob]');
    await expect(tarjeta).toBeVisible();
    const visor = (await page.locator('.kura-viewport-wrap').first().boundingBox())!;
    // Ningún hijo de la tarjeta se recorta: su contenido cabe en su propia caja.
    const recorte = await tarjeta.evaluate((el) => {
      const caja = el.getBoundingClientRect();
      return [...el.querySelectorAll<HTMLElement>('.kura-oob-badge, .kura-oob-fit')].map((c) => {
        const r = c.getBoundingClientRect();
        return { nombre: c.textContent, dentro: r.left >= caja.left - 0.5 && r.right <= caja.right + 0.5, completo: c.scrollWidth <= c.clientWidth + 1 };
      });
    });
    expect(recorte.length).toBeGreaterThanOrEqual(3);
    for (const r of recorte) {
      expect(r.dentro, `${r.nombre} se sale de la tarjeta`).toBe(true);
      expect(r.completo, `${r.nombre} está recortado`).toBe(true);
    }
    await expect(page.getByTestId('oob-fit')).toHaveText('Ajustar a la impresora…');
    const cajas: Array<[string, Caja]> = [];
    for (const [nombre, sel] of [...ELEMENTOS, ['tarjeta Cama', '.kura-bed-card[data-oob]']] as Array<[string, string]>) {
      const loc = page.locator(sel).first();
      if (!(await loc.count()) || !(await loc.isVisible())) continue;
      cajas.push([nombre, (await loc.boundingBox())!]);
    }
    for (let i = 0; i < cajas.length; i++) {
      const [n, c] = cajas[i];
      if (n !== 'tira de placas') {
        expect(c.x, `${n} se sale por la izquierda`).toBeGreaterThanOrEqual(visor.x - 0.5);
        expect(c.x + c.width, `${n} se sale por la derecha`).toBeLessThanOrEqual(visor.x + visor.width + 0.5);
        expect(c.y + c.height, `${n} se sale por abajo`).toBeLessThanOrEqual(visor.y + visor.height + 0.5);
      }
      for (let j = i + 1; j < cajas.length; j++) {
        const [m] = cajas[j];
        if ((n === 'rótulo Cama' && m === 'tarjeta Cama') || (n === 'tarjeta Cama' && m === 'rótulo Cama')) continue;
        expect(solapa(c, cajas[j][1]), `${n} solapa con ${m}`).toBe(false);
      }
    }
    await page.screenshot({ path: `.eval-tmp/dev-placas-1024/pie-oob-${w}.png` });
  });
}
