/**
 * @file e2e/agregar-helpers.ts
 * @description Ayudante común para crear formas y generadores desde la interfaz: en escritorio abre «Agregar» de
 * la barra vertical (primitivas) o «Insertar» de la barra superior (generadores) y elige la entrada; en pantallas
 * estrechas (≤ 900 px) abre la hoja «Agregar» de la barra inferior y toca la tarjeta. Reemplaza a los clics
 * directos en las tarjetas de la antigua pestaña «Formas».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import type { Page } from '@playwright/test';

/** Primitivas del menú «Agregar» (es). Lo demás (SVG, Imagen, Rosca, Cubo de calibración) va por «Insertar». */
const SHAPES = new Set(['Cubo', 'Cilindro', 'Disco', 'Tubo hueco', 'Esfera', 'Cono', 'Toroide', 'Prisma', 'Texto 3D', 'Box', 'Cylinder', 'Sphere', 'Cone', 'Torus', 'Prism', 'Disc', '3D text', 'Hollow tube']);

async function narrow(page: Page): Promise<boolean> {
  return page.evaluate(() => window.matchMedia('(max-width: 900px)').matches);
}

/**
 * Crea `nombre` (rótulo visible de la entrada, p. ej. «Cubo», «Rosca ISO», «Importar SVG») desde la interfaz.
 * `nombre` puede ser una expresión regular.
 */
export async function agregarForma(page: Page, nombre: string | RegExp, opciones: { tap?: boolean } = {}): Promise<void> {
  const exact = typeof nombre === 'string';
  if (await narrow(page)) {
    const sheet = page.getByTestId('add-sheet');
    if (!(await sheet.isVisible().catch(() => false))) {
      const abrir = page.locator('.kura-narrow-panel-actions').getByRole('button', { name: /^(Agregar|Add)$/ });
      if (opciones.tap) await abrir.tap();
      else await abrir.click();
      await sheet.waitFor();
    }
    const card = sheet.getByRole('button', { name: nombre, exact });
    if (opciones.tap) await card.tap();
    else await card.click();
    return;
  }
  const isShape = typeof nombre === 'string' ? SHAPES.has(nombre) : SHAPES.has(String(nombre.source).replace(/[\^$]/g, ''));
  const trigger = isShape
    ? page.locator('#kura-tool-rail').getByRole('button', { name: /^(Agregar|Add)$/ })
    : page.locator('.kura-topbar').getByRole('button', { name: /^(Insertar|Insert)$/ });
  await trigger.click();
  await page.getByRole('menuitem', { name: nombre, exact }).click();
}
