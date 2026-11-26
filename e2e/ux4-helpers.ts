/**
 * @file e2e/ux4-helpers.ts
 * @description Utilidades de los specs `ux4-*`: abre la web limpia en español (o el idioma pedido), expone el
 * store (`__s`), crea primitivas, divide un cubo grande y junta los errores de consola del navegador.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, type Page } from '@playwright/test';
import { abrir as abrirBase } from './ux-movil-helpers';

export const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux4';

/** Abre la web y devuelve la lista viva de errores de consola (sin ruido de WebGL/favicon). */
export async function abrir(page: Page, ancho = 1440, alto = 900, lang = 'es'): Promise<string[]> {
  const errs: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|WebGL|GPU|GL_/i.test(m.text())) errs.push(m.text());
  });
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: ancho, height: alto });
  await abrirBase(page, lang);
  const discard = page.getByRole('button', { name: 'Descartar' });
  if (await discard.count()) await discard.first().click().catch(() => undefined);
  return errs;
}

export async function crear(page: Page, type: string, params?: Record<string, number>, position?: [number, number, number]): Promise<string> {
  return page.evaluate(async ({ type, params, position }) => {
    const s = (window as any).__s.getState();
    const obj = await s.createPrimitive(type, params, {});
    if (position) (window as any).__s.getState().setObjectTransform(obj.id, { position }, true);
    return obj.id as string;
  }, { type, params, position });
}

/** Encuadra todo con el botón del visor (el cubo creado por el store no reencuadra solo). */
export async function encuadrar(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Encuadrar/ }).first().click();
  await page.waitForTimeout(900);
}

/** Divide un cubo de 440 mm con el panel (valores por defecto) y espera la lista de uniones. */
export async function dividirCubo(page: Page): Promise<void> {
  await crear(page, 'box', { width: 440, height: 440, depth: 440 }, [0, 220, 0]);
  await page.getByRole('button', { name: 'Dividir para imprimir' }).first().click();
  await page.getByRole('button', { name: 'Dividir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.filter((o: any) => o.metadata?.split).length), { timeout: 120_000 }).toBeGreaterThan(1);
}
