/**
 * @file e2e/ux3-edicion-helpers.ts
 * @description Utilidades de los specs `ux3-edicion-*`: abre la web limpia en español, expone el store (`__s`),
 * crea primitivas y junta los errores de consola del navegador.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import type { Page } from '@playwright/test';
import { abrir as abrirBase } from './ux-movil-helpers';

export const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux3-edicion';

/** Abre la web y devuelve la lista viva de errores de consola (sin ruido de WebGL/favicon). */
export async function abrir(page: Page, ancho = 1280, alto = 800): Promise<string[]> {
  const errs: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|WebGL|GPU|GL_/i.test(m.text())) errs.push(m.text());
  });
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: ancho, height: alto });
  await abrirBase(page, 'es');
  const discard = page.getByRole('button', { name: 'Descartar' });
  if (await discard.count()) await discard.first().click().catch(() => undefined);
  return errs;
}

/** Crea una primitiva por el store (igual que el botón de la barra lateral) y devuelve su id. */
export async function crear(page: Page, type: string, params?: Record<string, number>, position?: [number, number, number]): Promise<string> {
  return page.evaluate(async ({ type, params, position }) => {
    const s = (window as any).__s.getState();
    const obj = await s.createPrimitive(type, params, {});
    if (position) (window as any).__s.getState().setObjectTransform(obj.id, { position }, true);
    return obj.id as string;
  }, { type, params, position });
}

/** Nombres de los objetos seleccionados. */
export async function seleccion(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const s = (window as any).__s.getState();
    return s.objects.filter((o: any) => s.selectedIds.includes(o.id)).map((o: any) => o.name as string);
  });
}
