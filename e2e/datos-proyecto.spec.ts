/**
 * @file e2e/datos-proyecto.spec.ts
 * @description Recorrido de «Datos del proyecto» (escrito, NO ejecutado todavía; lo corre QA): editar descripción,
 * notas y autor en el panel «Proyecto», ver «Aún sin guardar» y el punto de cambios, guardar (fecha de modificación
 * en formato humano), reabrir el archivo (aviso discreto «Este proyecto tiene notas» con «Ver notas» que enfoca las
 * notas, fechas intactas), ver descripción y fecha en recientes, el HTML mostrado como texto y que nada desborde a
 * 1024 px en tema claro y oscuro, sin errores en la consola.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const HTML = '<img src=x onerror="window.__xss=1"> <b>negrita</b>';

async function abrirPanelProyecto(page: Page) {
  await page.getByRole('button', { name: /^Proyecto/ }).first().click();
  const section = page.getByTestId('panel-project-info');
  await expect(section).toBeVisible();
  return section;
}

for (const tema of ['light', 'dark'] as const) {
  test(`datos del proyecto: editar, guardar, reabrir y ver notas (1024 px, tema ${tema})`, async ({ page }) => {
    const errores: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    page.on('pageerror', (e) => errores.push(e.message));
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.emulateMedia({ colorScheme: tema });
    await page.addInitScript(() => localStorage.removeItem('kura3d-recent-info'));
    await abrir(page);

    const section = await abrirPanelProyecto(page);
    // Estado inicial: fecha de creación puesta, sin guardar todavía, tiempo menor a 1 min.
    await expect(section.getByTestId('project-info-created')).not.toHaveText('Sin fecha');
    await expect(section.getByTestId('project-info-modified')).toHaveText('Aún sin guardar');
    await expect(section.getByTestId('project-info-work')).toHaveText('Menos de 1 min');

    // Cada campo tiene etiqueta asociada y se llega con Tab.
    const descripcion = section.getByLabel('Descripción');
    const notas = section.getByLabel('Notas');
    const autor = section.getByLabel('Autor');
    await descripcion.fill('Soporte de auriculares');
    await notas.fill(`Imprimir en PETG\nRevisar la tapa\n${HTML}`);
    await autor.fill('Ana');
    await expect(section.getByTestId('project-info-notes-count')).toContainText('de 20000 caracteres');
    // Editar marca el proyecto como modificado (el botón Proyecto lo anuncia en su nombre accesible).
    await expect(page.getByRole('button', { name: /Proyecto.*cambios sin guardar/i }).first()).toBeVisible();
    // El HTML queda como texto: no se ejecuta ni se crea marcado.
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await expect(section.locator('img, b')).toHaveCount(0);

    // Sin desbordes horizontales a 1024 px.
    const desborde = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="panel-project-info"]') as HTMLElement;
      return { panel: el.scrollWidth - el.clientWidth, page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(desborde.panel).toBeLessThanOrEqual(1);
    expect(desborde.page).toBeLessThanOrEqual(1);

    // Guardar: en la web baja un archivo; la fecha de modificación pasa a formato humano.
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Guardar', exact: true }).first().click();
    const archivo = await descarga;
    // Sin File System Access el navegador no confirma el guardado: se confirma con «Ya lo guardé» (ahí se fija la fecha).
    await page.getByRole('button', { name: 'Ya lo guardé' }).click();
    await expect(section.getByTestId('project-info-modified')).toContainText('este minuto');
    const createdAntes = await section.getByTestId('project-info-created').textContent();

    // Reabrir el archivo guardado: ni la fecha de creación ni la de modificación cambian; avisa que hay notas.
    const bytes = (await (await archivo.createReadStream())!.toArray()).map((c) => Array.from(c as Buffer)).flat();
    await page.evaluate(async (data) => {
      await (window as any).__s.getState().openProject(async () => ({ name: 'Soporte.kura', bytes: new Uint8Array(data) }));
    }, bytes);
    const aviso = page.getByText('Este proyecto tiene notas.');
    await expect(aviso).toBeVisible();
    await expect(section.getByTestId('project-info-created')).toHaveText(createdAntes ?? '');
    await expect(section.getByTestId('project-info-modified')).toContainText('este minuto');
    await page.getByRole('button', { name: 'Ver las notas del proyecto' }).click();
    await expect(page.getByLabel('Notas')).toBeFocused();
    await expect(page.getByLabel('Notas')).toHaveValue(/Imprimir en PETG/);

    // Recientes: descripción y fecha junto al nombre; las notas no aparecen.
    const recientes = page.getByRole('group', { name: 'Proyectos recientes' });
    await expect(recientes.getByTestId('recent-description').first()).toHaveText('Soporte de auriculares');
    await expect(recientes.getByTestId('recent-modified').first()).toContainText('Modificado');
    await expect(recientes).not.toContainText('PETG');
    const guardado = await page.evaluate(() => localStorage.getItem('kura3d-recent-info') ?? '');
    expect(guardado).not.toContain('PETG');

    expect(errores, errores.join('\n')).toEqual([]);
  });
}
