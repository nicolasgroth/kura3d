/**
 * @file e2e/simplificar-titulo-fijo.spec.ts
 * @description Al desplazar el informe de Simplificar dentro del panel, el título del grupo («Simplificar») queda
 * entero a la vista, pegado bajo el encabezado del panel (no a medio cortar), a 1024×768 y 1280×720.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir, cmd, libre, seleccionar } from './qa25a-helpers';

for (const [w, h] of [[1024, 768], [1280, 720]] as const) {
  test(`título del grupo entero al desplazar el informe (${w}×${h})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: w, height: h });
    const errs = await abrir(page);
    // Placa con tres agujeros a 12 triángulos: informe largo (versión segura aplicada).
    const placa = await cmd(page, 'create_primitive', { type: 'box', width: 60, depth: 40, height: 3, name: 'Placa' });
    const taladros: string[] = [];
    for (const x of [-18, 0, 18]) taladros.push((await cmd(page, 'create_primitive', { type: 'cylinder', radius: 4, height: 10, name: `T${x}`, position: [x, 1.5, 0] })).id);
    await cmd(page, 'boolean_operation', { op: 'subtract', targetId: placa.id, toolIds: taladros });
    const id = await page.evaluate(() => (window as any).__s.getState().objects[0].id as string);
    await seleccionar(page, [id]);
    await (await itemAccion(page, 'Simplificar…')).click();
    const sec = page.locator('.kura-simplify-section');
    await expect(sec).toBeVisible();
    await sec.locator('select').first().selectOption('target');
    await sec.getByRole('combobox', { name: 'Objetivo' }).selectOption({ label: 'Triángulos' });
    await sec.getByRole('spinbutton', { name: /Triángulos finales/ }).fill('12');
    await page.getByTestId('simplify-run').click();
    await libre(page);
    await expect(page.getByTestId('simplify-report')).toBeVisible();
    const titulo = page.locator('.kura-mesh-group-title').first();
    await expect(titulo).toHaveText('Simplificar');
    for (const y of [40, 120, 240, 400]) {
      const m = await page.evaluate((v) => {
        const sc = document.querySelector('.kura-ctx-body') as HTMLElement;
        sc.scrollTop = v;
        const a = sc.getBoundingClientRect();
        const r = document.querySelector('.kura-mesh-group-title')!.getBoundingClientRect();
        // Lo que se ve justo encima del borde superior del título (debe ser el propio título o el encabezado, no otra cosa).
        const probe = document.elementFromPoint(r.left + 4, a.top + 1);
        return { areaTop: a.top, top: r.top, bottom: r.bottom, h: r.height, scrolled: sc.scrollTop, cubre: probe?.closest('.kura-mesh-group-title') !== null };
      }, y);
      if (m.scrolled < 60) continue;
      // Entero y pegado al borde del área desplazable, tapando lo que pasa por debajo.
      expect(m.top, JSON.stringify(m)).toBeGreaterThanOrEqual(m.areaTop - 0.5);
      expect(m.top - m.areaTop, JSON.stringify(m)).toBeLessThan(2);
      expect(m.bottom - m.top).toBeCloseTo(m.h, 0);
      expect(m.cubre, JSON.stringify(m)).toBe(true);
    }
    expect(errs, errs.join('\n')).toEqual([]);
  });
}
