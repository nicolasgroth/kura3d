/**
 * @file e2e/acciones-helpers.ts
 * @description Ayudante común del menú «Acciones» con submenús por grupo: abre el menú, abre el submenú del grupo
 * que contiene la acción (lo deduce del catálogo `store/actionsCatalog.ts` y los textos del idioma activo) y
 * devuelve el ítem para comprobarlo o elegirlo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, type Locator, type Page } from '@playwright/test';

/** Abre «Acciones» y devuelve el menú principal. */
export async function abrirAcciones(page: Page): Promise<Locator> {
  const trigger = page.locator('.kura-topbar .kura-actions-trigger');
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  const menu = page.locator('.kura-actions-layer > [role="menu"]');
  await expect(menu).toBeVisible();
  return menu;
}

/** Nombre del grupo (submenú) que contiene la acción con ese rótulo visible. */
async function grupoDe(page: Page, nombre: string): Promise<string> {
  const group = await page.evaluate(async (label) => {
    const { ACTION_GROUPS } = await import('/src/store/actionsCatalog.ts');
    const { t } = await import('/src/i18n/index.ts');
    const lang = (window as any).__s?.getState().language ?? 'es';
    for (const g of ACTION_GROUPS) {
      for (const id of g.items) if (t(lang, `rediseno.action.${id}` as never) === label) return t(lang, `rediseno.actions.group.${g.id}` as never);
    }
    return null;
  }, nombre);
  if (!group) throw new Error(`Acción desconocida en el menú: ${nombre}`);
  return group;
}

/** Abre el menú y el submenú del grupo de `nombre` y devuelve su ítem. */
export async function itemAccion(page: Page, nombre: string, exact = false): Promise<Locator> {
  const menu = await abrirAcciones(page);
  const group = await grupoDe(page, nombre);
  const trigger = menu.locator(':scope > .kura-context-subwrap > [aria-haspopup="menu"]').filter({ hasText: group });
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  const sub = page.getByRole('menu', { name: group, exact: true });
  await expect(sub).toBeVisible();
  return sub.getByRole('menuitem', { name: nombre, exact });
}
