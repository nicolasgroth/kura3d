/**
 * @file e2e/instrucciones-armado.spec.ts
 * @description «Instrucciones de armado» tras «Dividir para imprimir», a 1024 y 1440 px: una caja de 300 × 120 × 120 mm
 * dividida en una cama de 200 mm sale en dos piezas; desde el control «Armado» se abre el panel con la lista ordenada
 * de pasos, enfocar un paso selecciona sus dos piezas, el panel no desborda, las descargas Markdown y HTML traen los
 * pasos (el HTML sin recursos externos) y «Volver» cierra el panel.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux4-helpers';

async function bus(page: Page, command: string, params: Record<string, unknown>): Promise<any> {
  const r = await page.evaluate(
    async ([c, p]) => (window as any).__s.getState().executeCommand({ id: `e2e-${Math.random()}`, command: c, params: p }),
    [command, params] as const,
  );
  if (!r.ok) throw new Error(`${command}: ${JSON.stringify(r).slice(0, 400)}`);
  return r.result;
}

for (const ancho of [1024, 1440]) {
  test(`instrucciones de armado a ${ancho} px`, async ({ page }) => {
    test.setTimeout(240_000);
    const errs = await abrir(page, ancho, 900);
    // Ejes del usuario (Z arriba); las primitivas nacen apoyadas en su base.
    const caja = await bus(page, 'create_primitive', { type: 'box', width: 300, height: 120, depth: 120, name: 'Caja', position: [0, 0, 0] });
    const split = await bus(page, 'split_for_bed', { id: caja.id, bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200, connectorType: 'dowel', connectorSize: 3, connectorCount: 2 });
    const ids: string[] = split.parts.map((p: { id: string }) => p.id);
    expect(ids).toHaveLength(2);
    await page.evaluate((id) => (window as any).__s.setState({ selectedIds: [id] }), ids[0]);

    await page.getByTestId('split-assembly-instructions').click();
    const panel = page.locator('.kura-ctx-action[data-action="assemblyInstructions"]');
    await expect(panel.getByRole('heading', { name: 'Instrucciones de armado', exact: true })).toBeVisible();
    const lista = panel.getByRole('list', { name: 'Pasos de armado', exact: true });
    await expect(lista.locator(':scope > li')).toHaveCount(2);
    await expect(lista.locator(':scope > li').first()).toContainText('como base, apoyada en la mesa');
    await expect(lista.locator(':scope > li').nth(1)).toContainText('2 espigas de 6 mm');

    const paso2 = lista.getByRole('button', { name: /^Paso 2 · / });
    await paso2.focus();
    await expect.poll(() => page.evaluate(() => (window as any).__s.getState().selectedIds.length)).toBe(2);
    await expect(paso2).toHaveAttribute('aria-current', 'step');

    // Sin desborde horizontal del panel ni de la página.
    const desborde = await page.evaluate(() => {
      const body = document.querySelector('.kura-ctx-action .kura-ctx-body') as HTMLElement;
      return { panel: body.scrollWidth - body.clientWidth, page: document.documentElement.scrollWidth - window.innerWidth };
    });
    expect(desborde.panel).toBeLessThanOrEqual(1);
    expect(desborde.page).toBeLessThanOrEqual(1);

    const [md] = await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name: 'Markdown', exact: true }).click()]);
    expect(md.suggestedFilename()).toBe('Caja_armado.md');
    const texto = readFileSync((await md.path())!, 'utf8');
    expect(texto).toMatch(/^# Instrucciones de armado: Caja/);
    expect(texto).toContain('2. Une ');

    const [html] = await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name: 'HTML imprimible', exact: true }).click()]);
    expect(html.suggestedFilename()).toBe('Caja_armado.html');
    const pagina = readFileSync((await html.path())!, 'utf8');
    expect(pagina).toContain('<ol class="steps">');
    expect(pagina).not.toMatch(/<script|<link|https?:/i);

    await panel.getByTestId('panel-back').click();
    await expect(panel).toHaveCount(0);
    expect(errs).toEqual([]);
  });
}
